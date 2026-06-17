import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import TagInput from '../components/TagInput.jsx';
import { Icon, useToast } from '../components/ui.jsx';
import { uploadFiles } from '../lib/api.js';
import { formatBytes, fileGlyph } from '../lib/format.js';

const ALLOWED = ['stl', '3mf', 'obj', 'step', 'stp', 'gcode', 'zip', 'png', 'jpg', 'jpeg', 'webp'];

export default function Upload() {
  const toast = useToast();
  const navigate = useNavigate();
  const inputRef = useRef();
  const [files, setFiles] = useState([]);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState(null);

  const [category, setCategory] = useState('');
  const [tags, setTags] = useState([]);
  const [description, setDescription] = useState('');
  const [printerNotes, setPrinterNotes] = useState('');
  const [materialNotes, setMaterialNotes] = useState('');

  const addFiles = (list) => {
    const arr = Array.from(list);
    setFiles((prev) => [...prev, ...arr]);
  };
  const removeFile = (i) => setFiles((f) => f.filter((_, idx) => idx !== i));

  const onDrop = (e) => {
    e.preventDefault(); setDrag(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  const validFiles = files.filter((f) => ALLOWED.includes(f.name.split('.').pop().toLowerCase()));
  const invalidCount = files.length - validFiles.length;

  const submit = async () => {
    if (!validFiles.length) { toast('No supported files to upload', 'error'); return; }
    setUploading(true); setProgress(0); setSummary(null);
    try {
      const res = await uploadFiles(validFiles, {
        category, tags: tags.join(','), description, printerNotes, materialNotes,
      }, setProgress);
      setSummary({ uploaded: res.uploaded?.length || 0, skipped: invalidCount });
      setFiles([]);
      toast(`Uploaded ${res.uploaded?.length || 0} file(s)`, 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setUploading(false);
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
            <p className="muted" style={{ margin: 0 }}>or click to browse · STL, 3MF, OBJ, STEP, G-code, images, ZIP</p>
            <input ref={inputRef} type="file" multiple hidden accept={ALLOWED.map((e) => '.' + e).join(',')}
              onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          </div>

          {files.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div className="section-head"><h2>{files.length} file(s) ready</h2>
                <button className="btn btn-ghost btn-sm" onClick={() => setFiles([])} disabled={uploading}>Clear</button>
              </div>
              {files.map((f, i) => {
                const ok = ALLOWED.includes(f.name.split('.').pop().toLowerCase());
                return (
                  <div className="upload-item" key={i}>
                    <span style={{ fontSize: 22 }}>{fileGlyph(f.name.split('.').pop())}</span>
                    <div className="lr-main">
                      <div className="lr-name">{f.name}</div>
                      <div className="lr-sub">{formatBytes(f.size)}{!ok && <span className="danger-text"> · unsupported, will be skipped</span>}</div>
                    </div>
                    {!uploading && <button className="btn btn-ghost btn-icon" onClick={() => removeFile(i)}><Icon name="close" size={16} /></button>}
                  </div>
                );
              })}
            </div>
          )}

          {uploading && (
            <div className="upload-item" style={{ marginTop: 12 }}>
              <div className="progress"><div style={{ width: `${progress}%` }} /></div>
              <span className="muted" style={{ minWidth: 44, textAlign: 'right' }}>{progress}%</span>
            </div>
          )}

          {summary && (
            <div className="card" style={{ cursor: 'default', marginTop: 16, padding: 18 }}>
              <h3 style={{ margin: '0 0 8px' }}>✅ Upload complete</h3>
              <p className="muted" style={{ margin: '0 0 14px' }}>{summary.uploaded} file(s) added{summary.skipped ? `, ${summary.skipped} skipped` : ''}.</p>
              <div className="row">
                <button className="btn btn-primary" onClick={() => navigate('/library')}>Go to library</button>
                <button className="btn" onClick={() => setSummary(null)}>Upload more</button>
              </div>
            </div>
          )}
        </div>

        <div className="meta-panel">
          <h3 style={{ marginTop: 0 }}>Apply to all files</h3>
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>These details are applied to every file in this batch. You can edit individual files later.</p>
          <label className="field"><span>Category</span><input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Miniatures" /></label>
          <label className="field"><span>Tags</span><TagInput value={tags} onChange={setTags} /></label>
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
