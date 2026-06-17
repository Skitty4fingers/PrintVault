// Chooses the right preview for a file: 3D viewer for STL/OBJ, <img> for images,
// or a typed placeholder with a download hint for everything else.
import StlViewer from './StlViewer.jsx';
import { isImage, is3D, fileGlyph } from '../lib/format.js';

export default function FilePreview({ ext, rawUrl }) {
  if (is3D(ext)) return <StlViewer url={rawUrl} ext={ext} />;
  if (isImage(ext)) {
    return (
      <div className="viewer" style={{ display: 'grid', placeItems: 'center' }}>
        <img src={rawUrl} alt="preview" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      </div>
    );
  }
  return (
    <div className="viewer" style={{ display: 'grid', placeItems: 'center' }}>
      <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
        <div style={{ fontSize: 52, marginBottom: 10 }}>{fileGlyph(ext)}</div>
        <div className="badge-type" style={{ display: 'inline-block' }}>{ext}</div>
        <p style={{ marginTop: 14 }}>No inline preview for this file type.<br />Use Download to get the file.</p>
      </div>
    </div>
  );
}
