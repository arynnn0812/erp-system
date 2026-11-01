// The mimetype multer reports is whatever the client claimed in the upload,
// so a renamed executable passes a mimetype whitelist. The first bytes of the
// file ("magic numbers") show what it actually is. Small, fixed list - no need
// for a detection library.
const SIGNATURES = {
  'application/pdf': [Buffer.from('%PDF-')],
  'image/png': [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
  'image/jpeg': [Buffer.from([0xff, 0xd8, 0xff])],
  // .docx is a ZIP container; the signature proves "ZIP", not "Word", which
  // still rules out executables and scripts posing as documents.
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  ],
};

function matchesDeclaredType(buffer, mimetype) {
  const expected = SIGNATURES[mimetype];
  if (!expected || !buffer) return false;
  return expected.some((sig) => buffer.length >= sig.length && buffer.subarray(0, sig.length).equals(sig));
}

module.exports = { matchesDeclaredType, ALLOWED_MIME: Object.keys(SIGNATURES) };
