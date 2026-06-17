import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import TagInput from '../components/TagInput.jsx';
import { Icon, useToast } from '../components/ui.jsx';
import { uploadFiles, uploadThumbnail } from '../lib/api.js';
import { renderModelThumbnail } from '../lib/thumbnailer.js';
import { formatBytes, fileGlyph, is3D } from '../lib/format.js';

const ALLOWED = ['stl', '3mf', 'obj', 'step', 'stp', 'gcode', 'zip', 'png', 'jpg', 'jpeg', 'webp'];
const relPath = (f) => f.webkitRelativePath || f._relativePath || f.name;

export default function Upload() {
  const toast = useToast();
  const navigate = useNavigate();
  const inputRef = useRef();
  const folderRef = useRef();
  const [files, setFiles] = useState([]);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState(0);
  const [thumbProg, setThumbProg] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState(null);

  const [category, setCategory] = useState('');
  const [tags, setTags] = useState([]);
  const [description, setDescription] = useState('');
  const [printerNotes, setPrinterNotes] = useState('');
  const [materialNotes, setMaterialNotes] = useState('');
  const [autoTag, setAutoTag] = useState(true);
  const [autoCollections, setAutoCollections] = useState(false);

  // Enable directory selection on the hidden folder input.
  useEffect(() => {
    if (folderRef.current) {
      folderRef.current.setAttribute('webkitdirectory', '');
      folderRef.current.setAttribute('directory', '');
    }
  }, []);

  const addFiles = (list) => setFiles((prev) => [...prev, ...Array.from(list)]);
  const removeFile = (i) => setFiles((f) => f.filter((_, idx) => idx !== i));

  const onDrop = (e) => {
    e.preventDefault(); setDrag(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const validFiles = files.filter((f) => ALLOWED.includes(f.name.split('.').pop().toLowerCase()));
  const invalidCount = files.length - validFiles.length;
  const hasFolders = files.some((f) => (f.webkitRelativePath || '').includes('/'));

  const submit = async () => {
    if (!validFiles.length) { toast('No supported files to upload', 'error'); return; }
    setUploading(true); setProgress(0); setThumbProg(null); setSummary(null);
    const batch = validFiles; // capture before clearing
    const relativePaths = batch.map(relPath);
    try {
      const res = await uploadFiles(batch, {
        category, tags: tags.join(','), description, printerNotes, materialNotes,
        relativePaths: JSON.stringify(relativePaths),
        autoTag: autoTag ? '1' : '0',
        autoCollections: autoCollections ? '1' : '0',
      }, setProgress);

      // Generate model thumbnails in the browser for STL/OBJ uploads.
      const uploaded = res.uploaded || [];
      const jobs = uploaded.map((u, i) => ({ u, file: batch[i] })).filter((x) => x.file && is3D(x.u.ext));
      if (jobs.length) {
        setThumbProg({ done: 0, total: jobs.length });
        for (let i = 0; i < jobs.length; i++) {
          try {
            const buf = await jobs[i].file.arrayBuffer();
            const blob = await renderModelThumbnail(buf, jobs[i].u.ext);
            if (blob) await uploadThumbnail(jobs[i].u.id, blob);
          } catch { /* non-fatal */ }
          setThumbProg({ done: i + 1, total: jobs.length });
        }
      }

      setSummary({ uploaded: uploaded.length, skipped: invalidCount, collections: res.collectionsCreated || [] });
      setFiles([]);
      toast(`Uploaded ${uploaded.length} file(s)`, 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setUploading(false);
      setThumbProg(null);
    }
  };

  return (
    <AppShell title="Upload">
      <div className="detail-grid" style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(280px,1fr)' }}>
        <div>
          <div className={`dropzone ${drag ? 'drag' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current.click()}>
            <div className="ico-big"><Icon name="upload" size={42} /></div>
            <h3 style={{ margin: '12px 0 6px' }}>Drag & drop files here</h3>
            <p className="muted" style={{ margin: 0 }}>or use the buttons below · STL, 3MF, OBJ, STEP, G-code, images, ZIP</p>
          </div>

          {/* Pickers live outside the dropzone so their clicks don't collide. */}
          <div className="row" style={{ marginTop: 12, gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="btn" onClick={() => inputRef.current.click()}>
              <Icon name="upload" size={16} /> Select files
            </button>
            <button type="button" className="btn" onClick={() => folderRef.current.click()}>
              <Icon name="collection" size={16} /> Select folder (with subfolders)
            </button>
          </div>
          <input ref={inputRef} type="file" multiple hidden accept={ALLOWED.map((e) => '.' + e).join(',')}
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          {/* webkitdirectory enables whole-folder selection; also set via ref for older engines. */}
          <input ref={folderRef} type="file" multiple hidden webkitdirectory="" directory="" mozdirectory=""
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />

          {files.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div className="section-head">
                <h2>{files.length} file(s) ready{hasFolders ? ' · folder structure detected' : ''}</h2>
                <button className="btn btn-ghost btn-sm" onClick={() => setFiles([])} disabled={uploading}>Clear</button>
              </div>
              <div style={{ maxHeight: 320, overflow: 'auto' }}>
                {files.map((f, i) => {
                  const ok = ALLOWED.includes(f.name.split('.').pop().toLowerCase());
                  const rp = relPath(f);
                  return (
                    <div className="upload-item" key={i}>
                      <span style={{ fontSize: 22 }}>{fileGlyph(f.name.split('.').pop())}</span>
                      <div className="lr-main">
                        <div className="lr-name">{f.name}</div>
                        <div className="lr-sub">
                          {rp.includes('/') && <span className="muted">{rp} · </span>}
                          {formatBytes(f.size)}{!ok && <span className="danger-text"> · unsupported, will be skipped</span>}
                        </div>
                      </div>
                      {!uploading && <button className="btn btn-ghost btn-icon" onClick={() => removeFile(i)}><Icon name="close" size={16} /></button>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {uploading && (
            <div className="upload-item" style={{ marginTop: 12 }}>
              <div className="progress"><div style={{ width: `${thumbProg ? 100 : progress}%` }} /></div>
              <span className="muted" style={{ minWidth: 120, textAlign: 'right' }}>
                {thumbProg ? `Thumbnails ${thumbProg.done}/${thumbProg.total}` : `Uploading ${progress}%`}
              </span>
            </div>
          )}

          {summary && (
            <div className="card" style={{ cursor: 'default', marginTop: 16, padding: 18 }}>
              <h3 style={{ margin: '0 0 8px' }}>✅ Upload complete</h3>
              <p className="muted" style={{ margin: '0 0 8px' }}>
                {summary.uploaded} file(s) added{summary.skipped ? `, ${summary.skipped} skipped` : ''}.
              </p>
              {summary.collections.length > 0 && (
                <p className="muted" style={{ margin: '0 0 14px' }}>
                  Collections: {summary.collections.map((c) => `${c.name} (${c.count})`).join(', ')}
                </p>
              )}
              <div className="row">
                <button className="btn btn-primary" onClick={() => navigate('/library')}>Go to library</button>
                <button className="btn" onClick={() => setSummary(null)}>Upload more</button>
              </div>
            </div>
          )}
        </div>

        <div className="meta-panel">
          <h3 style={{ marginTop: 0 }}>Apply to all files</h3>
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>Applied to every file in this batch. You can edit individual files later.</p>

          <label className="row" style={{ marginBottom: 10, cursor: 'pointer', gap: 8 }}>
            <input type="checkbox" checked={autoTag} onChange={(e) => setAutoTag(e.target.checked)} />
            <span>Auto-tag from folder names</span>
          </label>
          <label className="row" style={{ marginBottom: 16, cursor: 'pointer', gap: 8 }}>
            <input type="checkbox" checked={autoCollections} onChange={(e) => setAutoCollections(e.target.checked)} />
            <span>Create collections from top-level folders</span>
          </label>

          <label className="field"><span>Category</span><input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Miniatures" /></label>
          <label className="field"><span>Tags {autoTag && hasFolders ? '(folder tags added automatically)' : ''}</span><TagInput value={tags} onChange={setTags} /></label>
          <label className="field"><span>Description</span><textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} /></label>
          <label className="field"><span>Printer notes</span><input className="input" value={printerNotes} onChange={(e) => setPrinterNotes(e.target.value)} /></label>
          <label className="field"><span>Material / filament</span><input className="input" value={materialNotes} onChange={(e) => setMaterialNotes(e.target.value)} /></label>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={submit} disabled={uploading || !validFiles.length}>
            <Icon name="upload" size={16} /> {uploading ? 'Uploading…' : `Upload ${validFiles.length || ''} file(s)`}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
