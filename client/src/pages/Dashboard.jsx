import { useEffect, useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import AppShell from '../components/AppShell.jsx';
import { FileCard } from '../components/FileCard.jsx';
import { Icon, EmptyState, ErrorState, SkeletonGrid, useToast } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { formatBytes, formatDate } from '../lib/format.js';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const toast = useToast();

  const load = useCallback(() => {
    setError(null);
    api.get('/api/stats').then(setStats).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  const favorite = async (file) => {
    try {
      await api.post(`/api/files/${file.id}/favorite`, { favorite: !file.favorite });
      load();
    } catch (e) { toast(e.message, 'error'); }
  };

  const actions = (
    <button className="btn btn-primary" onClick={() => navigate('/upload')}>
      <Icon name="upload" size={16} /> Upload
    </button>
  );

  return (
    <AppShell title="Dashboard" actions={actions}>
      {error && <ErrorState message={error} onRetry={load} />}
      {!error && !stats && <SkeletonGrid count={4} />}
      {stats && (
        <>
          <div className="stats-grid">
            <Stat label="Files" icon="library" value={stats.fileCount} />
            <Stat label="Storage used" icon="database" value={formatBytes(stats.storageUsed)} />
            <Stat label="Favorites" icon="star" value={stats.favorites} />
            <Stat label="Collections" icon="collection" value={stats.collections} />
          </div>

          <div className="section-head">
            <h2>Recent uploads</h2>
            <Link to="/library" className="btn btn-ghost btn-sm">View all</Link>
          </div>
          {stats.recentUploads.length === 0 ? (
            <EmptyState icon="📦" title="No files yet"
              message="Upload your first STL, 3MF or G-code file to get started."
              action={<button className="btn btn-primary" onClick={() => navigate('/upload')}><Icon name="upload" size={16} />Upload files</button>} />
          ) : (
            <div className="grid">
              {stats.recentUploads.map((f) => (
                <FileCard key={f.id} file={f} onFavorite={favorite} />
              ))}
            </div>
          )}

          <div className="section-head" style={{ marginTop: 34 }}>
            <h2>Recent share links</h2>
          </div>
          {stats.recentShares.length === 0 ? (
            <p className="muted">No active share links.</p>
          ) : (
            <div className="list">
              {stats.recentShares.map((s) => (
                <div key={s.id} className="list-row" style={{ cursor: 'default' }}>
                  <div className="lr-glyph"><Icon name="share" size={18} /></div>
                  <div className="lr-main">
                    <div className="lr-name">{s.targetName}</div>
                    <div className="lr-sub">
                      {s.type} · created {formatDate(s.createdAt)}
                      {s.hasPassword ? ' · 🔒 password' : ''}
                      {s.expiresAt ? ` · expires ${formatDate(s.expiresAt)}` : ''}
                    </div>
                  </div>
                  <span className="chip">{s.viewCount} views</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}

function Stat({ label, value, icon }) {
  return (
    <div className="stat-card">
      <div className="label"><Icon name={icon} size={16} /> {label}</div>
      <div className="value">{value}</div>
    </div>
  );
}
