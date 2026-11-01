// Two layers of access control, same as the employees module:
//  - Route level (here): which roles may call the endpoint at all
//  - Object level (document.service.js): whether THIS user may touch THIS
//    owner's files. Route-level checks alone would still let any authenticated
//    user enumerate ownerId values and download other people's HR documents.
// upload.single('file') runs BEFORE validators - multer parses the
// multipart body; until then req.body doesn't exist.
const express = require('express');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/roles');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const { uploadRules, listRules, idRule } = require('../validators/document.validator');
const ctrl = require('../controllers/document.controller');

const router = express.Router();
router.use(authenticate);

router.post(
  '/',
  authorize('ADMIN', 'HR', 'MANAGER'), // narrowed further per ownerType in the service
  upload.single('file'),
  uploadRules,
  validate,
  ctrl.upload
);
router.get('/', listRules, validate, ctrl.list);
router.get('/:id/url', idRule, validate, ctrl.downloadUrl);
router.delete('/:id', authorize('ADMIN', 'HR', 'MANAGER'), idRule, validate, ctrl.remove);

module.exports = router;
