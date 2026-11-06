// Document upload/download via S3.
// Key ideas:
//  - the bucket is PRIVATE; nothing is publicly readable
//  - MySQL stores only the s3_key + metadata, never file bytes
//  - downloads use short-lived PRESIGNED URLs generated per request
//  - EVERY entry point checks who may touch this owner's files (see below)
const crypto = require('crypto');
const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const { s3, isConfigured } = require('../config/s3');
const config = require('../config/env');
const documentModel = require('../models/document.model');
const employeeModel = require('../models/employee.model');
const productModel = require('../models/product.model');
const ApiError = require('../utils/ApiError');
const audit = require('../utils/audit');
const logger = require('../utils/logger');
const { matchesDeclaredType } = require('../utils/fileSignature');

function assertConfigured() {
  if (!isConfigured) {
    throw new ApiError(503, 'File storage is not configured (set AWS_REGION and S3_BUCKET_NAME)');
  }
}

// ---------------------------------------------------------------------------
// Object-level authorization.
//
// A role check on the ROUTE only answers "may this role use this endpoint".
// It does not answer "may this user see THIS row" - without the check below,
// any authenticated user could walk ownerId 1,2,3... and pull presigned URLs
// for other people's HR files. Policy:
//
//   EMPLOYEE-owned docs (contracts, offer letters, payslips)
//     read : ADMIN, HR, or the employee whose own record it is
//     write: ADMIN, HR
//     (MANAGER is deliberately excluded - same reasoning as hiding salary
//      from managers in employee.model.js)
//
//   PRODUCT-owned docs (spec sheets, invoices, images)
//     read : any authenticated user (matches the product read policy)
//     write: ADMIN, MANAGER
// ---------------------------------------------------------------------------
async function assertCanAccess(ownerType, ownerId, actor, mode) {
  if (ownerType === 'PRODUCT') {
    if (mode === 'read') return;
    if (actor.role !== 'ADMIN' && actor.role !== 'MANAGER') {
      throw new ApiError(403, 'Forbidden: only ADMIN or MANAGER may manage product documents');
    }
    return;
  }

  // ownerType === 'EMPLOYEE'
  if (actor.role === 'ADMIN' || actor.role === 'HR') return;

  if (mode === 'read') {
    const employee = await employeeModel.findRaw(ownerId);
    // An employee may read their own file (employees.user_id links to the login account).
    if (employee && employee.user_id !== null && Number(employee.user_id) === Number(actor.id)) {
      return;
    }
  }

  // Same 403 whether or not the row exists - don't leak which employee ids are real.
  throw new ApiError(403, 'Forbidden: employee documents are restricted to ADMIN and HR');
}

// Validate that the owner row actually exists before attaching a file to it.
async function assertOwnerExists(ownerType, ownerId) {
  const owner = ownerType === 'EMPLOYEE'
    ? await employeeModel.findRaw(ownerId)
    : await productModel.findById(ownerId);
  if (!owner) throw new ApiError(400, `Invalid ${ownerType.toLowerCase()} id: ${ownerId}`);
}

async function upload({ file, ownerType, ownerId, actor, ip }) {
  // Authorize BEFORE reporting infrastructure state: an unauthorized caller
  // gets 403, not a 503 that confirms whether storage is wired up.
  await assertCanAccess(ownerType, ownerId, actor, 'write');
  if (!matchesDeclaredType(file.buffer, file.mimetype)) {
    throw new ApiError(415, `File content is not a valid ${file.mimetype}`);
  }
  assertConfigured();
  await assertOwnerExists(ownerType, ownerId);

  // Key layout: employees/7/9f3c...-offer_letter.pdf
  // Random UUID prefix prevents collisions AND stops anyone guessing keys.
  const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
  const s3Key = `${ownerType.toLowerCase()}s/${ownerId}/${crypto.randomUUID()}-${safeName}`;

  await s3.send(new PutObjectCommand({
    Bucket: config.aws.bucket,
    Key: s3Key,
    Body: file.buffer,          // multer memoryStorage: file is in RAM, never on our disk
    ContentType: file.mimetype,
  }));

  // S3 and MySQL cannot share a transaction. Upload first, then record; if
  // the record fails, delete the object so the bucket holds no file that the
  // database doesn't know about.
  let id;
  try {
    id = await documentModel.create({
      ownerType,
      ownerId,
      fileName: file.originalname,
      s3Key,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      uploadedBy: actor.id,
    });
  } catch (err) {
    await s3.send(new DeleteObjectCommand({ Bucket: config.aws.bucket, Key: s3Key }))
      .catch((cleanupErr) => logger.error({ err: cleanupErr, s3Key }, 'orphaned S3 object after failed insert'));
    throw err;
  }

  await audit({
    userId: actor.id, action: 'DOCUMENT_UPLOAD', entity: 'documents', entityId: id,
    details: { ownerType, ownerId, fileName: file.originalname, sizeBytes: file.size }, ip,
  });

  return { id, s3Key };
}

// Listing is an access decision too: the file NAMES alone leak information
// ("2026-termination-letter.pdf"), so it goes through the same gate.
async function listByOwner({ ownerType, ownerId, actor }) {
  await assertCanAccess(ownerType, ownerId, actor, 'read');
  return documentModel.listByOwner(ownerType, ownerId);
}

// Presigned URL: the API authorizes the request (JWT + RBAC + this owner check),
// then hands the client a URL that is only valid for 5 minutes. S3 serves the
// bytes directly - the file never streams through our server.
async function getDownloadUrl({ documentId, actor, ip }) {
  const doc = await documentModel.findById(documentId);
  if (!doc) throw new ApiError(404, 'Document not found');

  // Authorize against the OWNER stored on the row, not anything the client sent.
  await assertCanAccess(doc.owner_type, doc.owner_id, actor, 'read');
  assertConfigured();

  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: config.aws.bucket, Key: doc.s3_key }),
    { expiresIn: 300 } // seconds
  );

  // A presigned URL is a handed-out capability - record who was given one.
  await audit({
    userId: actor.id, action: 'DOCUMENT_DOWNLOAD', entity: 'documents', entityId: doc.id,
    details: { ownerType: doc.owner_type, ownerId: doc.owner_id, fileName: doc.file_name }, ip,
  });

  return { fileName: doc.file_name, url, expiresInSeconds: 300 };
}

// Delete uses the WRITE policy of the owner (same people who may upload).
// Row first, then object: a failed S3 delete leaves an unreachable object to
// sweep later, never a database row pointing at a missing file.
async function remove({ documentId, actor, ip }) {
  const doc = await documentModel.findById(documentId);
  if (!doc) throw new ApiError(404, 'Document not found');
  await assertCanAccess(doc.owner_type, doc.owner_id, actor, 'write');
  assertConfigured();

  await documentModel.remove(doc.id);
  await s3.send(new DeleteObjectCommand({ Bucket: config.aws.bucket, Key: doc.s3_key }))
    .catch((err) => logger.error({ err, s3Key: doc.s3_key }, 'S3 delete failed; object orphaned'));

  await audit({
    userId: actor.id, action: 'DOCUMENT_DELETE', entity: 'documents', entityId: doc.id,
    details: { ownerType: doc.owner_type, ownerId: doc.owner_id, fileName: doc.file_name }, ip,
  });
}

module.exports = { upload, listByOwner, getDownloadUrl, remove };
