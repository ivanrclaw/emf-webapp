import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import ProjectList from './pages/ProjectList';
import ProjectDetail from './pages/ProjectDetail';

export default function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}
