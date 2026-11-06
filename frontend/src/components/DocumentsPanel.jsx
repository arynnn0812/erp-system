// Files attached to an employee or a product. Who may see or change them is
// decided by the API (document.service.js); `canWrite` only hides controls a
// role could never use. Downloads go through a 5-minute presigned S3 link.
import { useRef, useState } from 'react';
import api, { errMsg } from '../api/axios.js';
import { useApi } from '../hooks/useApi.js';
import Button from './ui/Button.jsx';
import Icon from './ui/Icon.jsx';
import { useToast } from './ui/Toast.jsx';
import { useConfirm } from './ui/ConfirmDialog.jsx';
import { Card, EmptyState, Skeleton } from './ui/index.jsx';
import { tsDate } from '../utils/format.js';

// Mirrors the API's allow-list and size cap, so a wrong file is caught
// before the upload instead of after it.
const ACCEPT = {
  'application/pdf': 'PDF',
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
};
const MAX_BYTES = 5 * 1024 * 1024;

const size = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`);

export default function DocumentsPanel({ ownerType, ownerId, canWrite = false, title = 'Documents' }) {
  const toast = useToast();
  const confirm = useConfirm();
  const docs = useApi('/documents', { ownerType, ownerId });
  const input = useRef(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file) {
    if (!file) return;
    if (!ACCEPT[file.type]) { toast.error(`${file.name} is not a PDF, PNG, JPEG or Word file.`); return; }
    if (file.size > MAX_BYTES) { toast.error(`${file.name} is ${size(file.size)}; the limit is 5 MB.`); return; }
    const body = new FormData();
    body.append('ownerType', ownerType);
    body.append('ownerId', String(ownerId));
    body.append('file', file);
    setUploading(true);
    try {
      await api.post('/documents', body);
      toast.success(file.name, 'Uploaded');
      docs.reload();
    } catch (err) { toast.error(errMsg(err), 'Upload failed'); }
    finally { setUploading(false); if (input.current) input.current.value = ''; }
  }

  async function download(doc) {
    try {
      const res = await api.get(`/documents/${doc.id}/url`);
      window.open(res.data.data.url, '_blank', 'noopener');
    } catch (err) { toast.error(errMsg(err), 'Download failed'); }
  }

  async function remove(doc) {
    const ok = await confirm({ title: `Delete ${doc.file_name}?`, message: 'The file is deleted from storage permanently.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    try { await api.delete(`/documents/${doc.id}`); toast.success(`${doc.file_name} deleted`); docs.reload(); }
    catch (err) { toast.error(errMsg(err)); }
  }

  const rows = docs.data || [];

  return (
    <Card
      title={title}
      subtitle="PDF, PNG, JPEG or Word · up to 5 MB"
      actions={canWrite && (
        <>
          <input ref={input} type="file" hidden accept={Object.keys(ACCEPT).join(',')} onChange={(e) => upload(e.target.files[0])} />
          <Button size="sm" icon="upload" loading={uploading} onClick={() => input.current?.click()}>Upload</Button>
        </>
      )}
    >
      {docs.loading ? (
        <div className="card-body stack"><Skeleton width="60%" /><Skeleton width="45%" /></div>
      ) : docs.error ? (
        <EmptyState icon="error" title="Could not load documents" message={docs.error} />
      ) : rows.length === 0 ? (
        <EmptyState icon="file" title="No documents" message={canWrite ? 'Upload contracts, spec sheets or invoices here.' : undefined} />
      ) : (
        <ul className="doc-list">
          {rows.map((d) => (
            <li key={d.id}>
              <span className="doc-icon"><Icon name="file" size={18} /></span>
              <div className="doc-name">
                <span className="cell-strong">{d.file_name}</span>
                <span className="cell-sub">{size(d.size_bytes)} · {tsDate(d.created_at)}{d.uploaded_by ? ` · ${d.uploaded_by}` : ''}</span>
              </div>
              <div className="row-end">
                <Button size="sm" variant="ghost" iconOnly icon="download" aria-label={`Download ${d.file_name}`} title="Download" onClick={() => download(d)} />
                {canWrite && <Button size="sm" variant="ghost-danger" iconOnly icon="trash" aria-label={`Delete ${d.file_name}`} title="Delete" onClick={() => remove(d)} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
