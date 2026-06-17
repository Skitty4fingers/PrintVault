import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import FilePreview from '../components/FilePreview.jsx';
import { FileCard } from '../components/FileCard.jsx';
import TagInput from '../components/TagInput.jsx';
import ShareModal from '../components/ShareModal.jsx';
import { Icon, CenterSpinner, ErrorState, Modal, ConfirmDialog, useToast } from '../components/ui.jsx';
import { api, downloadUrl } from '../lib/api.js';
import { formatBytes, formatDateTime } from '../lib/format.js';

export default function FileDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [related, setRelated] = useState([]);
  const [editing, setEditing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [addToCol, setAddToCol] = useState(false);

  const load = useCallback(() => {
    setError(null);
    api.get(`/api/files/${id}`)
      .then((f) => {
        setFile(f);
        if (f.tags[0]) api.get(`/api/files?tag=${encodeURIComponent(f.tags[0])}&pageSize=12`)
          .then((d) => setRelated(d.items.filter((x) => x.id !== f.id).slice(0, 6))).catch(() => {});
      })
      .catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const favorite = async () => {
    try { const f = await api.post(`/api/files/${id}/favorite`, { favorite: !file.favorite }); setFile(f); }
    catch (e) { toast(e.message, 'error'); }
  };
  const del = async () => {
    try { await api.del(`/api/files/${id}`); toast('File deleted', 'success'); navigate('/library'); }
    catch (e) { toast(e.message, 'error'); }
  };
  const download = async () => {
    try { await downloadUrl(`/api/files/${id}/download`); } catch (e) { toast(e.message, 'error'); }
  };

  if (error) return <AppShell title="File"><ErrorState message={error} onRetry={load} /></AppShell>;
  if (!file) return <AppShell title="File"><CenterSpinner /></AppShell>;

  const actions = (
    <Link to="/library" className="btn btn-ghost btn-sm"><Icon name="back" size={16} /> Back</Link>
  );

  return (
    <AppShell title={file.name} actions={actions}>
      <div className="action-row">
        <button className="btn btn-primary" onClick={download}><Icon name="download" size={16} /> Download</button>
        <button className="btn" onClick={() => setSharing(true)}><Icon name="share" size={16} /> Share</button>
        <button className="btn" onClick={() => setEditing(true)}><Icon name="edit" size={16} /> Edit</button>
        <button className="btn" onClick={() => setAddToCol(true)}><Icon name="collection" size={16} /> Add to collection</button>
        <button className={`btn ${file.favorite ? 'btn-primary' : ''}`} onClick={favorite}>
          <Icon name="star" size={16} fill={file.favorite} /> {file.favorite ? 'Favorited' : 'Favorite'}
        </button>
        <button className="btn btn-danger" onClick={() => setConfirmDel(true)}><Icon name="trash" size={16} /> Delete</button>
      </div>

      <div className="detail-grid">
        <FilePreview ext={file.ext} rawUrl={`/api/files/${file.id}/raw`} />

        <div className="meta-panel">
          {file.description && <p style={{ marginTop: 0 }}>{file.description}</p>}
          <Meta k="Type" v={<span className="badge-type">{file.ext}</span>} />
          <Meta k="Size" v={formatBytes(file.size)} />
          <Meta k="Category" v={file.category || '—'} />
          <Meta k="Original name" v={file.originalName} />
          <Meta k="Uploaded" v={formatDateTime(file.createdAt)} />
          {file.printerNotes && <Meta k="Printer" v={file.printerNotes} />}
          {file.materialNotes && <Meta k="Material" v={file.materialNotes} />}
          {file.profileNotes && <Meta k="Profile" v={file.profileNotes} />}
          {file.sourceUrl && <Meta k="Source" v={<a href={file.sourceUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-2)' }}>link ↗</a>} />}
          {file.tags.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>Tags</div>
              <div className="wrap">{file.tags.map((t) => <Link key={t} to={`/library`} className="chip accent">{t}</Link>)}</div>
            </div>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <>
          <div className="section-head" style={{ marginTop: 34 }}><h2>Related files</h2></div>
          <div className="grid">{related.map((f) => <FileCard key={f.id} file={f} />)}</div>
        </>
      )}

      {editing && <EditModal file={file} onClose={() => setEditing(false)} onSaved={(f) => { setFile(f); setEditing(false); }} />}
      {sharing && <ShareModal type="file" targetId={file.id} targetName={file.name} onClose={() => setSharing(false)} />}
      {addToCol && <AddToCollectionModal fileId={file.id} onClose={() => setAddToCol(false)} />}
      {confirmDel && (
        <ConfirmDialog title="Delete file" danger confirmText="Delete"
          message={`Permanently delete "${file.name}"? This cannot be undone.`}
          onConfirm={del} onClose={() => setConfirmDel(false)} />
      )}
    </AppShell>
  );
}

function Meta({ k, v }) {
  return <div className="meta-row"><span className="k">{k}</span><span className="v">{v}</span></div>;
}

function EditModal({ file, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState({
    name: file.name, description: file.description, category: file.category,
    sourceUrl: file.sourceUrl, printerNotes: file.printerNotes,
    materialNotes: file.materialNotes, profileNotes: file.profileNotes, tags: file.tags,
  });
  const [busy, setBusy] = useState(false);
  const upd = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const save = async () => {
    setBusy(true);
    try { const saved = await api.patch(`/api/files/${file.id}`, f); toast('Saved', 'success'); onSaved(saved); }
    catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <Modal title="Edit metadata" wide onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </>}>
      <label className="field"><span>Name</span><input className="input" value={f.name} onChange={upd('name')} /></label>
      <label className="field"><span>Description</span><textarea className="textarea" value={f.description} onChange={upd('description')} /></label>
      <label className="field"><span>Category</span><input className="input" value={f.category} onChange={upd('category')} /></label>
      <label className="field"><span>Tags</span><TagInput value={f.tags} onChange={(tags) => setF((s) => ({ ...s, tags }))} /></label>
      <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
        <label className="field" style={{ flex: 1 }}><span>Printer notes</span><input className="input" value={f.printerNotes} onChange={upd('printerNotes')} /></label>
        <label className="field" style={{ flex: 1 }}><span>Material / filament</span><input className="input" value={f.materialNotes} onChange={upd('materialNotes')} /></label>
      </div>
      <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
        <label className="field" style={{ flex: 1 }}><span>Nozzle / profile notes</span><input className="input" value={f.profileNotes} onChange={upd('profileNotes')} /></label>
        <label className="field" style={{ flex: 1 }}><span>Source URL</span><input className="input" value={f.sourceUrl} onChange={upd('sourceUrl')} /></label>
      </div>
    </Modal>
  );
}

function AddToCollectionModal({ fileId, onClose }) {
  const toast = useToast();
  const [collections, setCollections] = useState(null);
  const [newName, setNewName] = useState('');

  useEffect(() => { api.get('/api/collections').then(setCollections).catch(() => setCollections([])); }, []);

  const add = async (cid) => {
    try { await api.post(`/api/collections/${cid}/files`, { ids: [fileId] }); toast('Added to collection', 'success'); onClose(); }
    catch (e) { toast(e.message, 'error'); }
  };
  const create = async () => {
    if (!newName.trim()) return;
    try { const c = await api.post('/api/collections', { name: newName.trim() }); await add(c.id); }
    catch (e) { toast(e.message, 'error'); }
  };

  return (
    <Modal title="Add to collection" onClose={onClose}>
      {!collections ? <CenterSpinner /> : (
        <>
          {collections.length === 0 && <p className="muted" style={{ marginTop: 0 }}>No collections yet — create one below.</p>}
          <div className="list" style={{ marginBottom: 16 }}>
            {collections.map((c) => (
              <div key={c.id} className="list-row" onClick={() => add(c.id)}>
                <div className="lr-glyph"><Icon name="collection" size={18} /></div>
                <div className="lr-main"><div className="lr-name">{c.name}</div><div className="lr-sub">{c.fileCount} files</div></div>
                <Icon name="plus" size={16} />
              </div>
            ))}
          </div>
          <div className="copy-field">
            <input className="input" placeholder="New collection name" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <button className="btn btn-primary" onClick={create}><Icon name="plus" size={16} /> Create</button>
          </div>
        </>
      )}
    </Modal>
  );
}
