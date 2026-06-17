// Tag editor with autocomplete sourced from the global tag list.
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { Icon } from './ui.jsx';

export default function TagInput({ value = [], onChange, placeholder = 'Add tag and press Enter' }) {
  const [draft, setDraft] = useState('');
  const [all, setAll] = useState([]);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    api.get('/api/tags').then((rows) => setAll(rows.map((r) => r.name))).catch(() => {});
  }, []);

  useEffect(() => {
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const add = (t) => {
    const tag = String(t).trim().toLowerCase();
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setDraft('');
    setOpen(false);
  };
  const remove = (t) => onChange(value.filter((x) => x !== t));

  const suggestions = all
    .filter((t) => !value.includes(t) && draft && t.includes(draft.toLowerCase()))
    .slice(0, 6);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div className="wrap" style={{ marginBottom: value.length ? 8 : 0 }}>
        {value.map((t) => (
          <span key={t} className="chip accent">
            {t}<button type="button" onClick={() => remove(t)} aria-label={`Remove ${t}`}><Icon name="close" size={12} /></button>
          </span>
        ))}
      </div>
      <input
        className="input"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => { setDraft(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); add(draft); }
          else if (e.key === 'Backspace' && !draft && value.length) remove(value[value.length - 1]);
        }}
      />
      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 30,
          background: 'var(--elevated)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', boxShadow: 'var(--shadow)',
        }}>
          {suggestions.map((s) => (
            <div key={s} onClick={() => add(s)}
              style={{ padding: '9px 12px', cursor: 'pointer', fontSize: 14 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
