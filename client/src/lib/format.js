export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(n) / Math.log(1024));
  return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

// Pick an emoji glyph for a file type (used as a lightweight thumbnail).
export function fileGlyph(ext) {
  const e = String(ext || '').toLowerCase();
  if (['png', 'jpg', 'jpeg', 'webp'].includes(e)) return '🖼️';
  if (e === 'gcode') return '🧾';
  if (e === 'zip') return '🗜️';
  if (['stl', '3mf', 'obj', 'step', 'stp'].includes(e)) return '🧊';
  return '📦';
}

export const isImage = (ext) => ['png', 'jpg', 'jpeg', 'webp'].includes(String(ext || '').toLowerCase());
export const is3D = (ext) => ['stl', 'obj'].includes(String(ext || '').toLowerCase());
