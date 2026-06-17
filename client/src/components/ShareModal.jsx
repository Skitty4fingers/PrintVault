// Create a share link for a file or collection, with optional expiry/password,
// then show the generated URL with a copy button.
import { useState } from 'react';
import { Modal, Icon, useToast } from './ui.jsx';
import { api } from '../lib/api.js';

export default function ShareModal({ type, targetId, targetName, onClose }) {
  const toast = useToast();
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [useExpiry, setUseExpiry] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [link, setLink] = useState(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const body = { type, targetId };
      if (usePassword && password) body.password = password;
      if (useExpiry && expiresAt) body.expiresAt = new Date(expiresAt).toISOString();
      const share = await api.post('/api/shares', body);
      setLink(share.url);
      toast('Share link created', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); toast('Link copied', 'success'); }
    catch { toast('Could not copy', 'error'); }
  };

  return (
    <Modal title={`Share "${targetName}"`} onClose={onClose}
      footer={link
        ? <button className="btn btn-primary" onClick={onClose}>Done</button>
        : <>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={create} disabled={busy}>
              <Icon name="share" size={16} />{busy ? 'Creating…' : 'Create link'}
            </button>
          </>}>
      {link ? (
        <div>
          <p className="muted" style={{ marginTop: 0 }}>Anyone with this link can preview and download the shared {type}.</p>
          <div className="copy-field">
            <input className="input" readOnly value={link} onFocus={(e) => e.target.select()} />
            <button className="btn" onClick={copy}><Icon name="check" size={16} />Copy</button>
          </div>
        </div>
      ) : (
        <div>
          <p className="muted" style={{ marginTop: 0 }}>Creates a read-only link. Recipients cannot access any admin features.</p>
          <label className="row" style={{ marginBottom: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={useExpiry} onChange={(e) => setUseExpiry(e.target.checked)} />
            <span>Set an expiration date</span>
          </label>
          {useExpiry && (
            <input className="input" type="datetime-local" value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)} style={{ marginBottom: 14 }} />
          )}
          <label className="row" style={{ marginBottom: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={usePassword} onChange={(e) => setUsePassword(e.target.checked)} />
            <span>Protect with a password</span>
          </label>
          {usePassword && (
            <input className="input" type="text" placeholder="Share password" value={password}
              onChange={(e) => setPassword(e.target.value)} />
          )}
        </div>
      )}
    </Modal>
  );
}
