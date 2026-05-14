import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import ProjectList from './pages/ProjectList';
import ProjectDetail from './pages/ProjectDetail';
import EcoreEditor from './components/ecore-diagram/EcoreEditor';
import ModelList from './pages/ModelList';
import ModelEditor from './pages/ModelEditor';
import SpecEditor from './pages/SpecEditor';
import OCLConstraintPage from './pages/OCLConstraintPage';
import CodeTemplatePage from './pages/CodeTemplatePage';
import './App.css';

function AppLayout() {
  const location = useLocation();
  const isEditor = location.pathname.includes('/edit');

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
      <AppLayout />
    </BrowserRouter>
  );
}
