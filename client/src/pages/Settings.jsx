import { useEffect, useState, useCallback } from 'react';
import AppShell from '../components/AppShell.jsx';
import { Icon, CenterSpinner, ConfirmDialog, useToast } from '../components/ui.jsx';
import { api, downloadUrl } from '../lib/api.js';
import { formatDate } from '../lib/format.js';

export default function Settings() {
  const toast = useToast();
  const [settings, setSettings] = useState(null);
  const [shares, setShares] = useState([]);
  const [appName, setAppName] = useState('');
  const [expiry, setExpiry] = useState(0);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [revoke, setRevoke] = useState(null);

  const loadShares = useCallback(() => { api.get('/api/shares').then(setShares).catch(() => {}); }, []);
  useEffect(() => {
    api.get('/api/settings').then((s) => { setSettings(s); setAppName(s.appName); setExpiry(s.shareDefaultExpiryDays); }).catch(() => {});
    loadShares();
  }, [loadShares]);

  const saveGeneral = async () => {
    try { await api.patch('/api/settings', { appName, shareDefaultExpiryDays: expiry }); toast('Settings saved', 'success'); }
    catch (e) { toast(e.message, 'error'); }
  };
  const changePassword = async () => {
    if (pw.newPassword !== pw.confirm) { toast('Passwords do not match', 'error'); return; }
    try {
      await api.post('/api/auth/change-password', { currentPassword: pw.currentPassword, newPassword: pw.newPassword });
      toast('Password changed', 'success'); setPw({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (e) { toast(e.message, 'error'); }
  };
  const doRevoke = async () => {
    try { await api.del(`/api/shares/${revoke.id}`); toast('Link revoked', 'success'); setRevoke(null); loadShares(); }
    catch (e) { toast(e.message, 'error'); }
  };
  const exportData = (format) => downloadUrl(`/api/export?format=${format}`).catch((e) => toast(e.message, 'error'));

  if (!settings) return <AppShell title="Settings"><CenterSpinner /></AppShell>;

  return (
    <AppShell title="Settings">
      <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Section title="General">
          <label className="field"><span>App name</span><input className="input" value={appName} onChange={(e) => setAppName(e.target.value)} /></label>
          <label className="field"><span>Default share expiry (days, 0 = never)</span>
            <input className="input" type="number" min="0" value={expiry} onChange={(e) => setExpiry(Number(e.target.value))} />
          </label>
          <button className="btn btn-primary" onClick={saveGeneral}>Save</button>
        </Section>

        <Section title="Server configuration" subtitle="These values come from environment variables / .env and are read-only here.">
          <Ro k="Base URL" v={settings.baseUrl} />
          <Ro k="Port" v={settings.port} />
          <Ro k="Storage path" v={settings.storagePath} />
          <Ro k="Max upload size" v={`${settings.maxUploadMb} MB`} />
          <Ro k="Allowed extensions" v={settings.allowedExtensions.join(', ')} />
        </Section>

        <Section title="Change admin password">
          <label className="field"><span>Current password</span><input className="input" type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></label>
          <label className="field"><span>New password</span><input className="input" type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></label>
          <label className="field"><span>Confirm new password</span><input className="input" type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></label>
          <button className="btn btn-primary" onClick={changePassword}><Icon name="lock" size={16} /> Update password</button>
        </Section>

        <Section title="Share links" subtitle="Manage and revoke active share links.">
          {shares.length === 0 ? <p className="muted">No share links created yet.</p> : (
            <div className="list">
              {shares.map((s) => (
                <div key={s.id} className="list-row" style={{ cursor: 'default' }}>
                  <div className="lr-glyph"><Icon name="share" size={18} /></div>
                  <div className="lr-main">
                    <div className="lr-name">{s.targetName} {s.revoked && <span className="chip">revoked</span>}</div>
                    <div className="lr-sub">
                      {s.type} · {s.viewCount} views · created {formatDate(s.createdAt)}
                      {s.hasPassword ? ' · 🔒' : ''}{s.expiresAt ? ` · expires ${formatDate(s.expiresAt)}` : ''}
                    </div>
                  </div>
                  <button className="btn btn-sm" onClick={() => { navigator.clipboard.writeText(s.url); toast('Link copied', 'success'); }}>Copy</button>
                  {!s.revoked && <button className="btn btn-sm btn-danger" onClick={() => setRevoke(s)}>Revoke</button>}
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Export metadata" subtitle="Download metadata for all files.">
          <div className="row">
            <button className="btn" onClick={() => exportData('json')}><Icon name="download" size={16} /> Export JSON</button>
            <button className="btn" onClick={() => exportData('csv')}><Icon name="download" size={16} /> Export CSV</button>
          </div>
        </Section>
      </div>

      {revoke && <ConfirmDialog title="Revoke share link" danger confirmText="Revoke"
        message={`Revoke the share link for "${revoke.targetName}"? It will stop working immediately.`}
        onConfirm={doRevoke} onClose={() => setRevoke(null)} />}
    </AppShell>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div className="meta-panel">
      <h3 style={{ marginTop: 0, marginBottom: subtitle ? 4 : 16 }}>{title}</h3>
      {subtitle && <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>{subtitle}</p>}
      {children}
    </div>
  );
}
function Ro({ k, v }) {
  return <div className="meta-row"><span className="k">{k}</span><span className="v" style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>{v}</span></div>;
}
