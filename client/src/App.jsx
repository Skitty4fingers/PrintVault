import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { CenterSpinner } from './components/ui.jsx';

import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Library from './pages/Library.jsx';
import FileDetail from './pages/FileDetail.jsx';
import Upload from './pages/Upload.jsx';
import Collections from './pages/Collections.jsx';
import CollectionDetail from './pages/CollectionDetail.jsx';
import Settings from './pages/Settings.jsx';
import Share from './pages/Share.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <CenterSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />
      <Route path="/share/:token" element={<Share />} />

      {/* Protected admin app */}
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/library" element={<Protected><Library /></Protected>} />
      <Route path="/files/:id" element={<Protected><FileDetail /></Protected>} />
      <Route path="/upload" element={<Protected><Upload /></Protected>} />
      <Route path="/collections" element={<Protected><Collections /></Protected>} />
      <Route path="/collections/:id" element={<Protected><CollectionDetail /></Protected>} />
      <Route path="/settings" element={<Protected><Settings /></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
