// Multer config: file arrives as multipart/form-data, is held in memory
// (never written to our disk), and is rejected early if too big or the
// wrong type.
const multer = require('multer');
const ApiError = require('../utils/ApiError');

const ALLOWED_MIME = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      return cb(new ApiError(400, `File type not allowed: ${file.mimetype}`));
    }
    cb(null, true);
  },
});

module.exports = upload;
