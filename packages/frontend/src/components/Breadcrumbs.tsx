/**
 * @emf-webapp/frontend — Breadcrumbs
 *
 * Componente de navegación jerárquica que se renderiza en el header
 * de cada página. Parsea la URL actual y construye una ruta de navegación
 * contextual: Projects → ProjectName → MetamodelName → View
 *
 * Las rutas del editor (EcoreEditor, ModelEditor) renderizan su propia
 * versión dentro del componente editor.
 */
import { Link, useLocation, useParams } from 'react-router-dom';
import { useMemo } from 'react';

interface Crumb {
  label: string;
  to?: string;
}

export default function Breadcrumbs() {
  const location = useLocation();
  const { id, pid, mmid } = useParams<{ id: string; pid: string; mmid: string }>();

  const crumbs = useMemo<Crumb[]>(() => {
    const path = location.pathname;
    const parts: Crumb[] = [];

    // Base: always show Projects link
    parts.push({ label: 'Projects', to: '/' });

    // /projects/:id → ProjectDetail
    if (id || pid) {
      const projectId = id || pid;
      parts.push({ label: projectId!, to: `/projects/${projectId}` });
    }

    // /projects/:pid/metamodels/:mmid/... → metamodel views
    if (pid && mmid) {
      // Determine the current view label
      let viewLabel = '';
      if (path.endsWith('/edit')) viewLabel = 'Editor';
      else if (path.includes('/models')) viewLabel = 'Models';
      else if (path.includes('/specs')) viewLabel = 'Graphics';
      else if (path.includes('/constraints')) viewLabel = 'OCL';
      else if (path.includes('/templates')) viewLabel = 'Code';

      if (viewLabel) {
        parts.push({
          label: `${mmid.slice(0, 8)}…`,
          to: `/projects/${pid}/metamodels/${mmid}/edit`,
        });
        parts.push({ label: viewLabel });
      }
    }

    return parts;
  }, [location.pathname, id, pid, mmid]);

  // Don't render breadcrumbs on home
  if (location.pathname === '/') return null;

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {crumbs.map((crumb, i) => (
        <span key={i} className="breadcrumb-item">
          {i > 0 && <span className="breadcrumb-sep">/</span>}
          {crumb.to ? (
            <Link to={crumb.to} className="breadcrumb-link">
              {crumb.label}
            </Link>
          ) : (
            <span className="breadcrumb-current">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
