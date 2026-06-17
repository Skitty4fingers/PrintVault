import { useEffect, useState, useCallback, useRef } from 'react';
import AppShell from '../components/AppShell.jsx';
import { FileCard, FileRow } from '../components/FileCard.jsx';
import TagInput from '../components/TagInput.jsx';
import { Icon, EmptyState, ErrorState, SkeletonGrid, Modal, ConfirmDialog, useToast } from '../components/ui.jsx';
import { api, downloadUrl } from '../lib/api.js';

const SORTS = [
  { v: 'created_at', l: 'Date added' },
  { v: 'name', l: 'Name' },
  { v: 'size', l: 'File size' },
  { v: 'ext', l: 'File type' },
];

export default function Library() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState('');
  const [tag, setTag] = useState('');
  const [favOnly, setFavOnly] = useState(false);
  const [sort, setSort] = useState('created_at');
  const [order, setOrder] = useState('desc');
  const [view, setView] = useState('grid');

  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [showTagModal, setShowTagModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const debTimer = useRef();
  useEffect(() => {
    clearTimeout(debTimer.current);
    debTimer.current = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(debTimer.current);
  }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const p = new URLSearchParams();
    if (debounced) p.set('search', debounced);
    if (category) p.set('category', category);
    if (type) p.set('type', type);
    if (tag) p.set('tag', tag);
    if (favOnly) p.set('favorite', '1');
    p.set('sort', sort);
    p.set('order', order);
    p.set('pageSize', '200');
    api.get(`/api/files?${p.toString()}`)
      .then((d) => { setItems(d.items); setTotal(d.total); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [debounced, category, type, tag, favOnly, sort, order]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/api/categories').then(setCategories).catch(() => {});
    api.get('/api/tags').then(setTags).catch(() => {});
  }, [items.length]);

  const toggleSelect = (id) => setSelected((s) => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const clearSel = () => setSelected(new Set());
  const selectAll = () => setSelected(new Set(items.map((f) => f.id)));

  const favorite = async (file) => {
    try { await api.post(`/api/files/${file.id}/favorite`, { favorite: !file.favorite }); load(); }
    catch (e) { toast(e.message, 'error'); }
  };

  const bulkDownload = async () => {
    try { await downloadUrl('/api/files/bulk/download', { method: 'POST', body: { ids: [...selected] } }); }
    catch (e) { toast(e.message, 'error'); }
  };
  const bulkDelete = async () => {
    try {
      const r = await api.post('/api/files/bulk/delete', { ids: [...selected] });
      toast(`Deleted ${r.deleted} file(s)`, 'success');
      clearSel(); setConfirmDelete(false); load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const extTypes = ['stl', '3mf', 'obj', 'step', 'stp', 'gcode', 'zip', 'png', 'jpg', 'jpeg', 'webp'];

  return (
    <AppShell title="Library">
      <div className="toolbar">
        <div className="searchbar">
          <Icon name="search" size={17} />
          <input className="input" placeholder="Search files…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="select" style={{ width: 'auto' }} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.name} value={c.name}>{c.name} ({c.count})</option>)}
        </select>
        <select className="select" style={{ width: 'auto' }} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {extTypes.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
        </select>
        <select className="select" style={{ width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value)}>
          {SORTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
        </select>
        <button className="btn btn-icon" title="Toggle order" onClick={() => setOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}>
          {order === 'asc' ? '↑' : '↓'}
        </button>
        <button className={`btn btn-sm ${favOnly ? 'btn-primary' : ''}`} onClick={() => setFavOnly((f) => !f)}>
          <Icon name="star" size={15} fill={favOnly} /> Favorites
        </button>
        <div className="seg">
          <button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} title="Grid"><Icon name="grid" size={16} /></button>
          <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} title="List"><Icon name="list" size={16} /></button>
        </div>
      </div>

      {tag && (
        <div style={{ marginBottom: 14 }}>
          <span className="chip accent">tag: {tag}<button onClick={() => setTag('')}><Icon name="close" size={12} /></button></span>
        </div>
      )}

      {selected.size > 0 && (
        <div className="bulkbar">
          <strong>{selected.size} selected</strong>
          <button className="btn btn-sm" onClick={selectAll}>Select all ({items.length})</button>
          <div className="spacer" style={{ flex: 1 }} />
          <button className="btn btn-sm" onClick={bulkDownload}><Icon name="download" size={15} /> Download ZIP</button>
          <button className="btn btn-sm" onClick={() => setShowTagModal(true)}><Icon name="edit" size={15} /> Edit tags</button>
          <button className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(true)}><Icon name="trash" size={15} /> Delete</button>
          <button className="btn btn-ghost btn-sm" onClick={clearSel}>Clear</button>
        </div>
      )}

      {loading && <SkeletonGrid />}
      {error && !loading && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState icon="🔍" title="No files found"
          message={debounced || category || type || tag || favOnly ? 'Try adjusting your search or filters.' : 'Your library is empty. Upload some files to begin.'} />
      )}
      {!loading && !error && items.length > 0 && (
        view === 'grid' ? (
          <div className="grid">
            {items.map((f) => (
              <FileCard key={f.id} file={f} selectable selected={selected.has(f.id)}
                onToggleSelect={toggleSelect} onFavorite={favorite} />
            ))}
          </div>
        ) : (
          <div className="list">
            {items.map((f) => (
              <FileRow key={f.id} file={f} selectable selected={selected.has(f.id)}
                onToggleSelect={toggleSelect} onFavorite={favorite} />
            ))}
          </div>
        )
      )}
      {!loading && items.length > 0 && <p className="muted" style={{ marginTop: 16, textAlign: 'center' }}>{total} file(s)</p>}

      {showTagModal && (
        <BulkTagModal ids={[...selected]} onClose={() => setShowTagModal(false)}
          onDone={() => { setShowTagModal(false); clearSel(); load(); }} />
      )}
      {confirmDelete && (
        <ConfirmDialog title="Delete files" danger confirmText="Delete"
          message={`Permanently delete ${selected.size} file(s)? This cannot be undone.`}
          onConfirm={bulkDelete} onClose={() => setConfirmDelete(false)} />
      )}
    </AppShell>
  );
}

function BulkTagModal({ ids, onClose, onDone }) {
  const toast = useToast();
  const [addTags, setAddTags] = useState([]);
  const [removeTags, setRemoveTags] = useState([]);
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState(false);

  const apply = async () => {
    setBusy(true);
    try {
      const body = { ids, addTags, removeTags };
      if (category.trim()) body.category = category.trim();
      const r = await api.post('/api/files/bulk/tag', body);
      toast(`Updated ${r.updated} file(s)`, 'success');
      onDone();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };

  return (
    <Modal title={`Edit tags for ${ids.length} file(s)`} onClose={onClose}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={apply} disabled={busy}>{busy ? 'Applying…' : 'Apply'}</button>
      </>}>
      <label className="field"><span>Add tags</span><TagInput value={addTags} onChange={setAddTags} /></label>
      <label className="field"><span>Remove tags</span><TagInput value={removeTags} onChange={setRemoveTags} placeholder="Tags to remove" /></label>
      <label className="field"><span>Set category (optional)</span>
        <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Leave blank to keep" />
      </label>
    </Modal>
  );
}
