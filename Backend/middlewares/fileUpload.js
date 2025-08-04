const multer = require('multer')

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const type = file.fieldname;
        cb(null, `uploads/${type}`);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const name = Date.now() + "_" + typeSanitize(file.originalname);
        cb(null, name);
    }
});

// Utility to sanitize file names
function typeSanitize(filename) {
  return filename.replace(/[^a-zA-Z0-9.]/g, "_");
}

const upload = multer({storage: storage})

module.exports = upload