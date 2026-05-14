import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import ProjectList from './pages/ProjectList';
import ProjectDetail from './pages/ProjectDetail';
import EcoreEditor from './components/ecore-diagram/EcoreEditor';
import ModelList from './pages/ModelList';
import ModelEditor from './pages/ModelEditor';
import SpecEditor from './pages/SpecEditor';
import OCLConstraintPage from './pages/OCLConstraintPage';
import CodeTemplatePage from './pages/CodeTemplatePage';
import ToastProvider, { useToast } from './components/ToastProvider';
import './App.css';

function AppLayout() {
  const location = useLocation();
  const isEditor = location.pathname.includes('/edit');
  const { addToast } = useToast();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }, []);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    addToast(`Switched to ${next} mode`, 'info');
  }

  // Editor renders fullscreen (no app chrome)
  if (isEditor) {
    return (
      <Routes>
        <Route path="/projects/:pid/metamodels/:mmid/edit" element={<EcoreEditor />} />
        <Route path="/projects/:pid/metamodels/:mmid/models/:modelId/edit" element={<ModelEditor />} />
      </Routes>
    );
  }

  return (
    <div className="app-wrapper">
      <header className="app-header">
        <div className="header-inner">
          <Link to="/" className="app-title">
            <div className="app-logo">E</div>
            EMF WebApp
          </Link>
          <nav className="app-nav">
            <Link to="/" className="nav-link active">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              </svg>
              Projects
            </Link>
          </nav>
          <button
            onClick={toggleTheme}
            className="btn btn-ghost btn-icon"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            style={{ fontSize: 18 }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<ProjectList />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/projects/:pid/metamodels/:mmid/models" element={<ModelList />} />
          <Route path="/projects/:pid/metamodels/:mmid/specs" element={<SpecEditor />} />
          <Route path="/projects/:pid/metamodels/:mmid/specs/:specId" element={<SpecEditor />} />
          <Route path="/projects/:pid/metamodels/:mmid/constraints" element={<OCLConstraintPage />} />
          <Route path="/projects/:pid/metamodels/:mmid/templates" element={<CodeTemplatePage />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AppLayout />
      </ToastProvider>
    </BrowserRouter>
  );
}
