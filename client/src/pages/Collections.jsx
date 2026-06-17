import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { Icon, EmptyState, ErrorState, CenterSpinner, Modal, useToast } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { formatDate } from '../lib/format.js';

export default function Collections() {
  const toast = useToast();
  const navigate = useNavigate();
  const [collections, setCollections] = useState(null);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setError(null);
    api.get('/api/collections').then(setCollections).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  const actions = <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> New collection</button>;

  return (
    <AppShell title="Collections" actions={actions}>
      {error && <ErrorState message={error} onRetry={load} />}
      {!error && !collections && <CenterSpinner />}
      {collections && collections.length === 0 && (
        <EmptyState icon="📁" title="No collections yet"
          message="Group related files into projects or collections."
          action={<button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> Create collection</button>} />
      )}
      {collections && collections.length > 0 && (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))' }}>
          {collections.map((c) => (
            <div key={c.id} className="card" style={{ padding: 20 }} onClick={() => navigate(`/collections/${c.id}`)}>
              <div className="row" style={{ gap: 12 }}>
                <span className="logo" style={{ width: 42, height: 42, borderRadius: 11 }}><Icon name="collection" size={20} /></span>
                <div style={{ minWidth: 0 }}>
                  <div className="card-title" style={{ fontSize: 16 }}>{c.name}</div>
                  <div className="muted" style={{ fontSize: 13 }}>{c.fileCount} file(s) · {formatDate(c.createdAt)}</div>
                </div>
              </div>
              {c.description && <p className="muted" style={{ margin: '14px 0 0', fontSize: 14 }}>{c.description}</p>}
            </div>
          ))}
        </div>
      )}
      {creating && <CreateModal onClose={() => setCreating(false)} onDone={(c) => navigate(`/collections/${c.id}`)} />}
    </AppShell>
  );
}

function CreateModal({ onClose, onDone }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try { const c = await api.post('/api/collections', { name: name.trim(), description }); toast('Collection created', 'success'); onDone(c); }
    catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  return (
    <Modal title="New collection" onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={create} disabled={busy}>{busy ? 'Creating…' : 'Create'}</button>
      </>}>
      <label className="field"><span>Name</span><input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="field"><span>Description (optional)</span><textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} /></label>
    </Modal>
  );
}
