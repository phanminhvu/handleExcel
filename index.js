import express from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import fs from 'fs';
import cors from 'cors';
const app = express();
app.use(cors({origin: '*'}));
// Set up Multer to handle file uploads
const storage = multer.memoryStorage();
const upload = multer({storage: storage});

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
        // Check if all validations pass
        const isValid = isFullNameValid && isDateOfBirthValid && isMonthOfBirthValid &&
            isYearOfBirthValid && isGenderValid && isIdNumberValid && isGradeValid &&
            isParentPhoneNumberValid;
        return isValid;

    }
// Condition: Even numbers go to evenArray, odd numbers go to oddArray
    const {wrongArr, validArr} = data.reduce(
        (result, current) => {
            if (
                !validateForm(current)
            ) {
                result.wrongArr.push(current);
            } else {
                result.validArr.push(current);
            }
            return result;
        },
        {wrongArr: [], validArr: []}
    );

    const checkFileExist = fs.existsSync(`${schoolId}.xlsx`);
    const ws = xlsx.utils.json_to_sheet(validArr);
    let wb = {}
    // console.log(checkFileExist)
    if (checkFileExist) {
        wb = xlsx.readFile(`${schoolId}.xlsx`);
        const sheetNames = wb.SheetNames;
        xlsx.utils.book_append_sheet(wb, ws, `Sheet${sheetNames.length + 1}`);
    } else {
        wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
    }
    xlsx.writeFile(wb, `${schoolId}.xlsx`);

    res.json({
        success: true,
        message: 'File uploaded successfully for schoolId: ' + schoolId + '!',
        data: {
            inValidArr:  wrongArr,
            validArr: validArr
        }
    });
});


app.post('/update',  async (req, res) => {
    const schoolId = req.query.schoolId;
    console.log(req)
    res.json({
        success: true,
        message: 'Update successfully for schoolId: ' + schoolId + '!',
    });


    });
app.get('/distinct', upload.single('file'), async (req, res) => {
    const schoolId = req.query.schoolId;
    const wb = xlsx.readFile(`${schoolId}.xlsx`);
    const sheetNames = wb.SheetNames;
    let data = [];
    sheetNames.forEach((sheetName) => {
        const worksheet = wb.Sheets[sheetName];
        let item = xlsx.utils.sheet_to_json(worksheet);
//         item = item.slice(3);
// // Delete the first property of every object in arr
//         item.forEach(obj => delete obj[Object.keys(obj)[0]]);
        data = data.concat(item);
    });

    function filterUnique(arr) {
        const seen = new Set();
        return arr.filter(obj => {
            const stringified = JSON.stringify(obj);
            return seen.has(stringified) ? false : seen.add(stringified);
        });
    }

    const uniqueArr = filterUnique(data);
    res.json({
        success: true,
        message: 'Distinct data for schoolId: ' + schoolId + '!',
        data: uniqueArr
    });
});


// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
