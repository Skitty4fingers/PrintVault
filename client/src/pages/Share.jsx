import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import FilePreview from '../components/FilePreview.jsx';
import { Icon, CenterSpinner, EmptyState, Modal, useToast, ToastProvider } from '../components/ui.jsx';
import { api, downloadUrl } from '../lib/api.js';
import { formatBytes, fileGlyph, formatDate } from '../lib/format.js';

function ShareInner() {
  const { token } = useParams();
  const toast = useToast();
  const [info, setInfo] = useState(null);
  const [files, setFiles] = useState(null);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [preview, setPreview] = useState(null);
  const base = `/api/share/${token}`;

  const loadInfo = useCallback(() => {
    api.get(base).then(setInfo).catch((e) => setInfo({ error: e.message, notFound: e.status === 404 }));
  }, [base]);
  useEffect(() => { loadInfo(); }, [loadInfo]);

  const loadFiles = useCallback(() => {
    api.get(`${base}/files`).then(setFiles).catch((e) => toast(e.message, 'error'));
  }, [base, toast]);

  useEffect(() => { if (info && info.authorized) loadFiles(); }, [info, loadFiles]);

  const unlock = async (e) => {
    e.preventDefault();
    setAuthError('');
    try { await api.post(`${base}/auth`, { password }); loadInfo(); }
    catch (err) { setAuthError(err.message); }
  };

  const download = (fid, name) => downloadUrl(`${base}/file/${fid}/download`, { filename: name }).catch((e) => toast(e.message, 'error'));
  const downloadAll = () => downloadUrl(`${base}/download`).catch((e) => toast(e.message, 'error'));

  if (!info) return <CenterSpinner />;

  // Error / not-found / expired / revoked states
  if (info.error || info.notFound) {
    return <Centered icon="🔗" title="Link not found" message="This share link doesn’t exist." />;
  }
  if (info.revoked) return <Centered icon="🚫" title="Link revoked" message="This share link has been revoked by the owner." />;
  if (info.expired) return <Centered icon="⌛" title="Link expired" message="This share link has expired." />;

  // Password prompt
  if (info.requiresPassword && !info.authorized) {
    return (
      <div className="auth-screen">
        <form className="auth-card" onSubmit={unlock}>
          <div className="brand"><span className="logo"><Icon name="lock" size={20} /></span> Protected share</div>
          <p className="muted" style={{ marginTop: 0, textAlign: 'center' }}>Enter the password to view “{info.name}”.</p>
          <label className="field"><span>Password</span>
            <input className="input" type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {authError && <p className="danger-text" style={{ marginTop: 0 }}>{authError}</p>}
          <button className="btn btn-primary" style={{ width: '100%' }}>Unlock</button>
        </form>
      </div>
    );
  }

  return (
    <div className="public-shell">
      <div className="public-head">
        <span className="logo" style={{ width: 40, height: 40 }}><Icon name="box" size={20} /></span>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 22 }}>{info.name}</h1>
          <div className="muted" style={{ fontSize: 13 }}>
            Shared {info.type}{info.expiresAt ? ` · expires ${formatDate(info.expiresAt)}` : ''} · read-only
          </div>
        </div>
        {info.type === 'collection' && files?.length > 0 && (
          <button className="btn btn-primary" onClick={downloadAll}><Icon name="download" size={16} /> Download all (ZIP)</button>
        )}
      </div>

      {!files ? <CenterSpinner /> : files.length === 0 ? (
        <EmptyState icon="📭" title="Nothing shared" message="This share contains no files." />
      ) : (
        <div className="grid">
          {files.map((f) => (
            <div key={f.id} className="card" onClick={() => setPreview(f)}>
              <div className="card-thumb">
                {['png', 'jpg', 'jpeg', 'webp'].includes(f.ext)
                  ? <img src={`${base}/file/${f.id}/raw`} alt={f.name} loading="lazy" />
                  : <span className="file-glyph">{fileGlyph(f.ext)}</span>}
              </div>
              <div className="card-body">
                <div className="card-title" title={f.name}>{f.name}</div>
                <div className="card-meta"><span className="badge-type">{f.ext}</span><span>{formatBytes(f.size)}</span></div>
                <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); download(f.id, f.originalName); }}>
                  <Icon name="download" size={15} /> Download
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {preview && (
        <Modal title={preview.name} wide onClose={() => setPreview(null)}
          footer={<button className="btn btn-primary" onClick={() => download(preview.id, preview.originalName)}><Icon name="download" size={16} /> Download</button>}>
          <FilePreview ext={preview.ext} rawUrl={`${base}/file/${preview.id}/raw`} />
        </Modal>
      )}

      <p className="muted" style={{ textAlign: 'center', marginTop: 40, fontSize: 13 }}>Powered by PrintVault</p>
    </div>
  );
}

function Centered({ icon, title, message }) {
  return <div className="auth-screen"><div className="auth-card"><EmptyState icon={icon} title={title} message={message} /></div></div>;
}

// The public page has its own ToastProvider so it works outside the admin shell.
export default function Share() {
  return <ToastProvider><ShareInner /></ToastProvider>;
}
