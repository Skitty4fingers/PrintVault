// File card (grid) and row (list) used in the library, dashboard and collections.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './ui.jsx';
import { formatBytes, formatDate, fileGlyph, isImage } from '../lib/format.js';

// Renders the card thumbnail: the image itself for images, a rendered model
// thumbnail when one exists, or a file-type glyph as a fallback.
function Thumb({ file }) {
  const [failed, setFailed] = useState(false);
  let src = null;
  if (isImage(file.ext)) src = `/api/files/${file.id}/raw`;
  else if (file.thumb) src = `/api/files/${file.id}/thumbnail`;
  if (src && !failed) {
    return <img src={src} alt={file.name} loading="lazy" onError={() => setFailed(true)} />;
  }
  return <span className="file-glyph">{fileGlyph(file.ext)}</span>;
}

export function FileCard({ file, selectable, selected, onToggleSelect, onFavorite }) {
  const navigate = useNavigate();
  return (
    <div className={`card ${selected ? 'selected' : ''}`} onClick={() => navigate(`/files/${file.id}`)}>
      <div className="card-thumb">
        <Thumb file={file} />
        {selectable && (
          <div className={`card-select ${selected ? 'on' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleSelect(file.id); }}>
            {selected && <Icon name="check" size={14} />}
          </div>
        )}
        <button className={`card-fav ${file.favorite ? 'on' : ''}`}
          onClick={(e) => { e.stopPropagation(); onFavorite && onFavorite(file); }}
          aria-label="Toggle favorite">
          <Icon name="star" size={16} fill={file.favorite} />
        </button>
      </div>
      <div className="card-body">
        <div className="card-title" title={file.name}>{file.name}</div>
        <div className="card-meta">
          <span className="badge-type">{file.ext}</span>
          <span>{formatBytes(file.size)}</span>
          <span>·</span>
          <span>{formatDate(file.createdAt)}</span>
        </div>
        {file.tags?.length > 0 && (
          <div className="card-tags">
            {file.tags.slice(0, 3).map((t) => <span key={t} className="chip">{t}</span>)}
            {file.tags.length > 3 && <span className="chip">+{file.tags.length - 3}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export function FileRow({ file, selectable, selected, onToggleSelect, onFavorite }) {
  const navigate = useNavigate();
  return (
    <div className={`list-row ${selected ? 'selected' : ''}`} onClick={() => navigate(`/files/${file.id}`)}>
      {selectable && (
        <div className={`card-select ${selected ? 'on' : ''}`} style={{ position: 'static' }}
          onClick={(e) => { e.stopPropagation(); onToggleSelect(file.id); }}>
          {selected && <Icon name="check" size={14} />}
        </div>
      )}
      <div className="lr-glyph">{fileGlyph(file.ext)}</div>
      <div className="lr-main">
        <div className="lr-name">{file.name}</div>
        <div className="lr-sub">{file.ext.toUpperCase()} · {formatBytes(file.size)} · {formatDate(file.createdAt)}</div>
      </div>
      <div className="wrap" style={{ maxWidth: 240, justifyContent: 'flex-end' }}>
        {file.tags?.slice(0, 2).map((t) => <span key={t} className="chip">{t}</span>)}
      </div>
      <button className={`card-fav ${file.favorite ? 'on' : ''}`} style={{ position: 'static', background: 'transparent' }}
        onClick={(e) => { e.stopPropagation(); onFavorite && onFavorite(file); }} aria-label="Toggle favorite">
        <Icon name="star" size={17} fill={file.favorite} />
      </button>
    </div>
  );
}
