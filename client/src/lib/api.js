// Thin fetch wrapper around the PrintVault API. All requests include cookies.
const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function request(method, url, body) {
  const opts = { method, credentials: 'include', headers: {} };
  if (body !== undefined) {
    opts.headers = JSON_HEADERS;
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  if (res.status === 204) return null;
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const message = (data && data.error) || (typeof data === 'string' && data) || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body) => request('POST', url, body),
  patch: (url, body) => request('PATCH', url, body),
  del: (url) => request('DELETE', url),
};

// Upload files with progress via XMLHttpRequest.
export function uploadFiles(files, fields, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    for (const f of files) form.append('files', f);
    for (const [k, v] of Object.entries(fields || {})) {
      if (v !== undefined && v !== null && v !== '') form.append(k, v);
    }
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/files');
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data;
      try { data = JSON.parse(xhr.responseText); } catch { data = {}; }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.error || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(form);
  });
}

// Trigger a browser download for a streaming/binary endpoint (optionally POST).
export async function downloadUrl(url, { method = 'GET', body, filename } = {}) {
  const opts = { method, credentials: 'include', headers: {} };
  if (body !== undefined) { opts.headers = JSON_HEADERS; opts.body = JSON.stringify(body); }
  const res = await fetch(url, opts);
  if (!res.ok) {
    let msg = `Download failed (${res.status})`;
    try { const j = await res.json(); if (j.error) msg = j.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const dispo = res.headers.get('content-disposition') || '';
  const m = /filename="?([^"]+)"?/.exec(dispo);
  const name = filename || (m && decodeURIComponent(m[1])) || 'download';
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 4000);
}
