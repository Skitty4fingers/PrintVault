// App layout: sticky sidebar (desktop), slide-in drawer (mobile), and topbar.
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Icon } from './ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/library', label: 'Library', icon: 'library' },
  { to: '/upload', label: 'Upload', icon: 'upload' },
  { to: '/collections', label: 'Collections', icon: 'collection' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];

function NavItems({ onNavigate }) {
  return NAV.map((n) => (
    <NavLink key={n.to} to={n.to} end={n.end} onClick={onNavigate}
      className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
      <Icon name={n.icon} />
      <span>{n.label}</span>
    </NavLink>
  ));
}

export default function AppShell({ title, actions, children }) {
  const [drawer, setDrawer] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const Brand = () => (
    <div className="brand"><span className="logo"><Icon name="box" size={18} /></span> PrintVault</div>
  );

  return (
    <div className="shell">
      <aside className="sidebar">
        <Brand />
        <NavItems />
        <div className="sidebar-spacer" />
        <div className="nav-link" style={{ cursor: 'default' }}>
          <Icon name="lock" /><span className="muted" style={{ fontSize: 13 }}>{user?.username}</span>
        </div>
        <button className="nav-link" style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left' }}
          onClick={async () => { await logout(); navigate('/login'); }}>
          <Icon name="logout" /><span>Sign out</span>
        </button>
      </aside>

      {/* Mobile drawer */}
      <div className={`scrim ${drawer ? 'show' : ''}`} onClick={() => setDrawer(false)} />
      <nav className={`mobile-nav ${drawer ? 'open' : ''}`}>
        <Brand />
        <NavItems onNavigate={() => setDrawer(false)} />
        <div className="sidebar-spacer" />
        <button className="nav-link" style={{ background: 'none', border: 'none', textAlign: 'left' }}
          onClick={async () => { await logout(); navigate('/login'); }}>
          <Icon name="logout" /><span>Sign out</span>
        </button>
      </nav>

      <div className="main">
        <header className="topbar">
          <button className="btn btn-ghost btn-icon hamburger" onClick={() => setDrawer(true)} aria-label="Menu">
            <Icon name="menu" />
          </button>
          <h1>{title}</h1>
          <div className="spacer" />
          {actions}
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
