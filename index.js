import express from 'express';
import multer from 'multer';
import xlsx from 'xlsx';
import fs from 'fs';

const app = express();

// Set up Multer to handle file uploads
const storage = multer.memoryStorage();
const upload = multer({storage: storage});

// API endpoint for file upload
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    const workbook = xlsx.read(req.file.buffer, {type: 'buffer'});
    const sheetName = workbook.SheetNames[0]; // Assuming only one sheet for simplicity
    const worksheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(worksheet);
    const schoolId = req.query.schoolId;
    const checkFileExist = fs.existsSync(`${schoolId}.xlsx`);
    const ws = xlsx.utils.json_to_sheet(data);
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

    res.json({data});
});


app.get('/distinct', upload.single('file'), async (req, res) => {
    const schoolId = req.query.schoolId;
    const wb = xlsx.readFile(`${schoolId}.xlsx`);
    const sheetNames = wb.SheetNames;
    let data = [];
    sheetNames.forEach((sheetName) => {
        const worksheet = wb.Sheets[sheetName];
        let item = xlsx.utils.sheet_to_json(worksheet);
        item = item.slice(3);
// Delete the first property of every object in arr
        item.forEach(obj => delete obj[Object.keys(obj)[0]]);
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
    res.json({uniqueArr});
});


// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
