import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import ShareModal from '../components/ShareModal.jsx';
import { Icon, CenterSpinner, ErrorState, EmptyState, Modal, ConfirmDialog, useToast } from '../components/ui.jsx';
import { api, downloadUrl } from '../lib/api.js';
import { formatBytes, fileGlyph } from '../lib/format.js';

export default function CollectionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [col, setCol] = useState(null);
  const [error, setError] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const dragIndex = useRef(null);

  const load = useCallback(() => {
    setError(null);
    api.get(`/api/collections/${id}`).then(setCol).catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const removeFile = async (fid) => {
    try { await api.del(`/api/collections/${id}/files/${fid}`); load(); } catch (e) { toast(e.message, 'error'); }
  };
  const download = async () => {
    try { await downloadUrl(`/api/collections/${id}/download`); } catch (e) { toast(e.message, 'error'); }
  };
  const del = async () => {
    try { await api.del(`/api/collections/${id}`); toast('Collection deleted', 'success'); navigate('/collections'); }
    catch (e) { toast(e.message, 'error'); }
  };

  const onDrop = async (toIdx) => {
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from === null || from === toIdx) return;
    const files = [...col.files];
    const [moved] = files.splice(from, 1);
    files.splice(toIdx, 0, moved);
    setCol({ ...col, files });
    try { await api.post(`/api/collections/${id}/reorder`, { ids: files.map((f) => f.id) }); }
    catch (e) { toast(e.message, 'error'); load(); }
  };

  if (error) return <AppShell title="Collection"><ErrorState message={error} onRetry={load} /></AppShell>;
  if (!col) return <AppShell title="Collection"><CenterSpinner /></AppShell>;

  const actions = <Link to="/collections" className="btn btn-ghost btn-sm"><Icon name="back" size={16} /> Back</Link>;

  return (
    <AppShell title={col.name} actions={actions}>
      <div className="action-row">
        <button className="btn btn-primary" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> Add files</button>
        <button className="btn" onClick={download} disabled={!col.files.length}><Icon name="download" size={16} /> Download ZIP</button>
        <button className="btn" onClick={() => setSharing(true)}><Icon name="share" size={16} /> Share</button>
        <button className="btn" onClick={() => setEditing(true)}><Icon name="edit" size={16} /> Edit</button>
        <button className="btn btn-danger" onClick={() => setConfirmDel(true)}><Icon name="trash" size={16} /> Delete</button>
      </div>
      {col.description && <p className="muted">{col.description}</p>}

      {col.files.length === 0 ? (
        <EmptyState icon="📁" title="This collection is empty"
          message="Add files to organize them here."
          action={<button className="btn btn-primary" onClick={() => setAdding(true)}><Icon name="plus" size={16} /> Add files</button>} />
      ) : (
        <div className="list">
          {col.files.map((f, i) => (
            <div key={f.id} className="list-row" draggable
              onDragStart={() => { dragIndex.current = i; }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(i)}>
              <span style={{ cursor: 'grab', color: 'var(--faint)' }}>⠿</span>
              <div className="lr-glyph">{fileGlyph(f.ext)}</div>
              <div className="lr-main" onClick={() => navigate(`/files/${f.id}`)} style={{ cursor: 'pointer' }}>
                <div className="lr-name">{f.name}</div>
                <div className="lr-sub">{f.ext.toUpperCase()} · {formatBytes(f.size)}</div>
              </div>
              <button className="btn btn-ghost btn-icon" title="Remove from collection" onClick={() => removeFile(f.id)}><Icon name="close" size={16} /></button>
            </div>
          ))}
        </div>
      )}

      {sharing && <ShareModal type="collection" targetId={col.id} targetName={col.name} onClose={() => setSharing(false)} />}
      {adding && <AddFilesModal collectionId={col.id} existing={col.files.map((f) => f.id)} onClose={() => setAdding(false)} onDone={() => { setAdding(false); load(); }} />}
      {editing && <EditModal col={col} onClose={() => setEditing(false)} onDone={() => { setEditing(false); load(); }} />}
      {confirmDel && <ConfirmDialog title="Delete collection" danger confirmText="Delete"
        message={`Delete "${col.name}"? Files themselves are not deleted.`} onConfirm={del} onClose={() => setConfirmDel(false)} />}
    </AppShell>
  );
}

function AddFilesModal({ collectionId, existing, onClose, onDone }) {
  const toast = useToast();
  const [files, setFiles] = useState(null);
  const [sel, setSel] = useState(new Set());
  const [q, setQ] = useState('');
  useEffect(() => { api.get('/api/files?pageSize=200').then((d) => setFiles(d.items)).catch(() => setFiles([])); }, []);

  const toggle = (id) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const add = async () => {
    try { await api.post(`/api/collections/${collectionId}/files`, { ids: [...sel] }); toast(`Added ${sel.size} file(s)`, 'success'); onDone(); }
    catch (e) { toast(e.message, 'error'); }
  };
  const available = (files || []).filter((f) => !existing.includes(f.id) && f.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <Modal title="Add files to collection" wide onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={add} disabled={!sel.size}>Add {sel.size || ''}</button>
      </>}>
      <input className="input" placeholder="Search files…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 12 }} />
      {!files ? <CenterSpinner /> : available.length === 0 ? <p className="muted">No files available to add.</p> : (
        <div className="list" style={{ maxHeight: 360, overflow: 'auto' }}>
          {available.map((f) => (
            <div key={f.id} className={`list-row ${sel.has(f.id) ? 'selected' : ''}`} onClick={() => toggle(f.id)}>
              <div className={`card-select ${sel.has(f.id) ? 'on' : ''}`} style={{ position: 'static' }}>{sel.has(f.id) && <Icon name="check" size={14} />}</div>
              <div className="lr-glyph">{fileGlyph(f.ext)}</div>
              <div className="lr-main"><div className="lr-name">{f.name}</div><div className="lr-sub">{f.ext.toUpperCase()} · {formatBytes(f.size)}</div></div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function EditModal({ col, onClose, onDone }) {
  const toast = useToast();
  const [name, setName] = useState(col.name);
  const [description, setDescription] = useState(col.description);
  const save = async () => {
    try { await api.patch(`/api/collections/${col.id}`, { name, description }); toast('Saved', 'success'); onDone(); }
    catch (e) { toast(e.message, 'error'); }
  };
  return (
    <Modal title="Edit collection" onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={save}>Save</button></>}>
      <label className="field"><span>Name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="field"><span>Description</span><textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} /></label>
    </Modal>
  );
}
