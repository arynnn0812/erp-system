// Controllers stay thin: the service owns the access rules, so every entry
// point here just forwards the acting user.
const documentService = require('../services/document.service');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

// POST /api/documents  (multipart: file, ownerType, ownerId)
const upload = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "No file uploaded (field name must be 'file')");
  const { ownerType, ownerId } = req.body;
  const result = await documentService.upload({
    file: req.file,
    ownerType,
    ownerId: Number(ownerId),
    actor: req.user,
    ip: req.ip,
  });
  res.status(201).json({ success: true, data: result });
});

// GET /api/documents?ownerType=EMPLOYEE&ownerId=1
const list = asyncHandler(async (req, res) => {
  const { ownerType, ownerId } = req.query;
  const rows = await documentService.listByOwner({
    ownerType,
    ownerId: Number(ownerId),
    actor: req.user,
  });
  res.json({ success: true, count: rows.length, data: rows });
});

// GET /api/documents/:id/url  -> 5-minute presigned download link
const downloadUrl = asyncHandler(async (req, res) => {
  const result = await documentService.getDownloadUrl({
    documentId: Number(req.params.id),
    actor: req.user,
    ip: req.ip,
  });
  res.json({ success: true, data: result });
});

module.exports = { upload, list, downloadUrl };
