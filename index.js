import express from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import fs from 'fs';
import https from 'https' ;
import cors from 'cors';
import bodyParser from 'body-parser';
import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';
const app = express();
app.use(cors({origin: '*'}));
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

const privateKey = fs.readFileSync('./ssl/key.pem', 'utf8');
const certificate = fs.readFileSync('./ssl/certificate.pem', 'utf8');

const credentials = {
    key: privateKey,
    cert: certificate
};


const accessKeyId = 'WQKE34D4QT1LXFXAOOQNPG=='
const secretAccessKey = 'C87E0FDB-2C6A-44E5-9CAF-B9180BFBDFA4'


//
// AWS.config.update({
//     accessKeyId: 'WQKE34D4QT1LXFXAOOQNPG==',
//     secretAccessKey: 'C87E0FDB-2C6A-44E5-9CAF-B9180BFBDFA4',
//     region: 'ap-southeast-1' // Update with your AWS region
// });


const bucketName = 'exceltoflechallange-stc';


// Set up Multer to handle file uploads
const storage = multer.memoryStorage();
const upload = multer({storage: storage});

function validateForm(fields) {

    const fullName = fields['Họ và tên'];
    const dayOfBirth = fields['Ngày sinh'];
    const monthOfBirth = fields['Tháng sinh'];
    const yearOfBirth = fields['Năm sinh'];
    const gender = fields['Giới Tính'];
    const idNumber = fields['Số CCCD/CMT\\r\\n(nếu có)'];
    const grade = fields['Khối'];
    const className = fields['Lớp'];
    const fatherFullName = fields['Họ và tên phụ huynh thí sinh\\r\\n(Bố)'];
    const motherFullName = fields['Họ và tên phụ huynh thí sinh\\r\\n(Mẹ)'];
    const email = fields['Email'];
    const parentPhoneNumber = fields['Số điện thoại của Phụ huynh\r\n(bắt buộc)'];

    // Validation rules
    const isNumber = /^\d+$/;
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Validation logic for each field
    const isFullNameValid = !!fullName; // Example: Must not be empty

    const isDateOfBirthValid = (dayOfBirth <= 31 && [1, 3, 5, 7, 8, 10, 12].includes(monthOfBirth)) ||
        (dayOfBirth <= 30 && [4, 6, 9, 11].includes(monthOfBirth)) ||
        (dayOfBirth <= 29 && monthOfBirth === 2);

    const isMonthOfBirthValid = monthOfBirth <= 12;

    const isYearOfBirthValid = yearOfBirth >= 1900;

    const isGenderValid = gender === 0 || gender === 1;

    const isIdNumberValid = !idNumber || isNumber.test(idNumber);

    const isGradeValid = grade <= 12;

    // Other validations for each field...
    const phoneRegex = /^(0|\+84)(\d{9,10})$/;

    // Validation for parentPhoneNumber (specifically <= 10 digits)
    const isParentPhoneNumberValid = parentPhoneNumber.length <= 10 && isNumber.test(parentPhoneNumber) && phoneRegex.test(parentPhoneNumber);
    const isEmailValid = isEmail.test(email);
    // Check if all validations pass
    const isValid = isFullNameValid && isDateOfBirthValid && isMonthOfBirthValid &&
        isYearOfBirthValid && isGenderValid && isIdNumberValid && isGradeValid && isEmailValid
    isParentPhoneNumberValid;
    let message = '';
    if (!isFullNameValid) {
        message += ' <br /> Họ và tên không hợp lệ <br /> ';
    }
    if (!isEmailValid) {
        message += ' <br /> Email không hợp lệ <br /> ';
    }
    if (!isDateOfBirthValid) {
        message += ' <br /> Ngày sinh không hợp lệ';
    }
    if (!isMonthOfBirthValid) {
        message += ' <br /> Tháng sinh không hợp lệ <br /> ';
    }
    if (!isYearOfBirthValid) {
        message += '<br />Năm sinh không hợp lệ<br />';
    }
    if (!isGenderValid) {
        message += '<br />Giới tính không hợp lệ<br />';
    }
    if (!isIdNumberValid) {
        message += '<br />Số CCCD/CMT không hợp lệ<br />';
    }
    if (!isGradeValid) {
        message += '<br />Khối không hợp lệ<br />';
    }
    if (!isParentPhoneNumberValid) {
        message += '<br />Số điện thoại không hợp lệ<br />';
    }
    return {
        check: isValid,
        message: message
    };

}


function filterUnique(arr) {
    const seen = new Set();
    return arr.filter(obj => {
        const stringified = JSON.stringify(obj);
        return seen.has(stringified) ? false : seen.add(stringified);
    });
}

const uploadFileService = (fileName, ws) => {
    const params = {
        Bucket: bucketName,
        Key: fileName
    };

    const s3 = new AWS.S3({
        endpoint: "https://s3.sunteco.app",
        credentials: {
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey,
        },
        s3ForcePathStyle: true,
    });


    s3.getObject(params, (err, data) => {
        if (err) {
            if (err.code === 'NoSuchKey') {
                const wb = xlsx.utils.book_new();
                xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
                const uploadParams = {
                    Bucket: bucketName,
                    Key: fileName,
                    Body: xlsx.write(wb, {type: 'buffer'})
                };
                s3.upload(uploadParams, (uploadErr) => {
                    if (uploadErr) {
                        console.error('Error uploading file to S3:', uploadErr);
                    } else {
                        console.log('File uploaded to S3');
                    }
                });
            }
        } else {
            // Parse the Excel file content
            const workbook = xlsx.read(data.Body);
            // Modify the workbook as needed
            const sheetNames = workbook.SheetNames;
            xlsx.utils.book_append_sheet(workbook, ws, `Sheet${sheetNames.length + 1}`);

            // Convert the modified workbook back to a buffer
            const updatedFile = xlsx.write(workbook, {type: 'buffer'});

            // Upload the modified file back to S3, overwriting the existing file
            const uploadParams = {
                Bucket: bucketName,
                Key: fileName,
                Body: updatedFile
            };
            s3.upload(uploadParams, (uploadErr) => {
                if (uploadErr) {
                    console.error('Error updating file in S3:', uploadErr);
                } else {
                    console.log('File updated and uploaded to S3');
                }
            });
        }
    });
};


// API endpoint for file upload
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    const schoolId = req.query.schoolId;
    const workbook = xlsx.read(req.file.buffer, {type: 'buffer'});
    const sheetName = workbook.SheetNames[0]; // Assuming only one sheet for simplicity
    const worksheet = workbook.Sheets[sheetName];

    let data = xlsx.utils.sheet_to_json(worksheet, {range: 1});
    // data = data.slice(3);
    // Delete the first property of every object in arr
    data.forEach(obj => delete obj[Object.keys(obj)[0]]);


// Condition: Even numbers go to evenArray, odd numbers go to oddArray
    const {wrongArr, validArr} = data.reduce(
        (result, current) => {
            if (
                !validateForm(current).check
            ) {
                current['Lỗi'] = validateForm(current).message;
                result.wrongArr.push(current);
            } else {
                result.validArr.push(current);
            }
            return result;
        },
        {wrongArr: [], validArr: []}
    );

    const fileName = `${schoolId}.xlsx`;


    const checkFileExist = fs.existsSync(`${schoolId}.xlsx`);
    const resultArr = validArr.map ((item) => {
        return {
            ...item,
            id: uuidv4()
        }
    });
    const ws = xlsx.utils.json_to_sheet(resultArr);
    let wb = {}

    uploadFileService(fileName, ws);

    // console.log(checkFileExist)
    // if (checkFileExist) {
    //     wb = xlsx.readFile(`${schoolId}.xlsx`);
    //     const sheetNames = wb.SheetNames;
    //     xlsx.utils.book_append_sheet(wb, ws, `Sheet${sheetNames.length + 1}`);
    // } else {
    //     wb = xlsx.utils.book_new();
    //     xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
    // }
    // if(validArr.length > 0){
    //     xlsx.writeFile(wb, `${schoolId}.xlsx`);
    // }
    ;


    res.json({
        success: true,
        message: 'File uploaded successfully for schoolId: ' + schoolId + '!',
        data: {
            inValidArr: filterUnique(wrongArr),
            validArr: resultArr
        },
        invalidCount: wrongArr.length,
        validCount: resultArr.length,
        totalCount: data.length
    });
});


app.post('/update', async (req, res) => {
    const schoolId = req.query.schoolId;
    const data = req.body;
    const {wrongArr, validArr} = data.reduce(
        (result, current) => {
            if (
                !validateForm(current).check
            ) {
                current['Lỗi'] = validateForm(current).message;
                result.wrongArr.push(current);
            } else {
                result.validArr.push(current);
            }
            return result;
        },
        {wrongArr: [], validArr: []}
    );

    // const checkFileExist = fs.existsSync(`${schoolId}.xlsx`);
    const resultArr = validArr.map ((item) => {
        return {
            ...item,
            id: uuidv4()
        }
    });
    const ws = xlsx.utils.json_to_sheet(resultArr);
    let wb = {}
    // console.log(checkFileExist)
    const fileName = `${schoolId}.xlsx`;
    uploadFileService(fileName, ws);
    // if (checkFileExist) {
    //     wb = xlsx.readFile(`${schoolId}.xlsx`);
    //     const sheetNames = wb.SheetNames;
    //     xlsx.utils.book_append_sheet(wb, ws, `Sheet${sheetNames.length + 1}`);
    // } else {
    //     wb = xlsx.utils.book_new();
    //     xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
    // }
    // if(validArr.length > 0){
    //     xlsx.writeFile(wb, `${schoolId}.xlsx`);
    // }

    res.json({
        success: true,
        message: 'File uploaded successfully for schoolId: ' + schoolId + '!',
        data: {
            inValidArr: filterUnique(wrongArr),
            validArr: resultArr
        },
        invalidCount: wrongArr.length,
        validCount: resultArr.length,
        totalCount: data.length
    });
});
app.get('/distinct', upload.single('file'), async (req, res) => {
    const schoolId = req.query.schoolId;



    const fileName = `${schoolId}.xlsx`;
    const params = {
        Bucket: bucketName,
        Key: fileName
    };

    const s3 = new AWS.S3({
        endpoint: "https://s3.sunteco.app",
        credentials: {
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey,
        },
        s3ForcePathStyle: true,
    });

    s3.getObject(params, (err, data) => {
        if (err) {
            console.log(err)
            res.json({
                success: false,
                message: 'Distinct data for schoolId: ' + schoolId + '!',
                data: uniqueArr
            });
        } else {
            // Parse the Excel file content
            const workbook = xlsx.read(data.Body);
            // Modify the workbook as needed
            const sheetNames = workbook.SheetNames;
            let dataArr = [];
            sheetNames.forEach((sheetName) => {
                const worksheet = workbook.Sheets[sheetName];
                let item = xlsx.utils.sheet_to_json(worksheet);
                dataArr = dataArr.concat(item);
            });
            const uniqueArr = filterUnique(dataArr);
            res.json({
                success: true,
                message: 'Distinct data for schoolId: ' + schoolId + '!',
                data: uniqueArr
            });
        }
    });

    // const wb = xlsx.readFile(`${schoolId}.xlsx`);
    // const sheetNames = wb.SheetNames;
    // let data = [];
    // sheetNames.forEach((sheetName) => {
    //     const worksheet = wb.Sheets[sheetName];
    //     let item = xlsx.utils.sheet_to_json(worksheet);
    //     data = data.concat(item);
    // });
});


// Start the server
const PORT = 9281;

const httpsServer = https.createServer(credentials, app);
httpsServer.listen(PORT, () => {
    console.log(`Server is running on HTTPS port ${PORT}`);
});
