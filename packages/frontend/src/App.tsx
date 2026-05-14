import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import ProjectList from './pages/ProjectList';
import ProjectDetail from './pages/ProjectDetail';
import EcoreEditor from './components/ecore-diagram/EcoreEditor';

function AppLayout() {
  const location = useLocation();
  const isEditor = location.pathname.includes('/edit');

  if (isEditor) {
    return (
      <Routes>
        <Route path="/projects/:pid/metamodels/:mmid/edit" element={<EcoreEditor />} />
      </Routes>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="app-title">
          EMF WebApp
        </Link>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<ProjectList />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
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
