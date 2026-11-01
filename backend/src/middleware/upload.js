// Multer config: file arrives as multipart/form-data, is held in memory
// (never written to our disk), and is rejected early if too big or the
// wrong type.
const multer = require('multer');
const ApiError = require('../utils/ApiError');
// PDF, PNG, JPEG, .docx. The declared type is checked here (cheap, early);
// the file's actual bytes are checked against it in document.service.js.
const { ALLOWED_MIME } = require('../utils/fileSignature');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 5 }, // 5 MB, one file
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return cb(new ApiError(400, `File type not allowed: ${file.mimetype}`));
    }
    cb(null, true);
  },
});

module.exports = upload;
