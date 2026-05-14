/**
 * @emf-webapp/frontend — Breadcrumbs
 *
 * Componente de navegación jerárquica en el header.
 * Parsea la URL manualmente (useParams no funciona fuera de Route).
 *
 * Projects → ProjectName → View
 * Projects → ProjectName → MetamodelName → View  (dentro de metamodel)
 *
 * NOTA: Las rutas del editor (EcoreEditor) renderizan sus propios
 * breadcrumbs dentro del topbar del editor, no aquí.
 */
import { Link, useLocation } from 'react-router-dom';
import { useMemo } from 'react';

interface Crumb {
  label: string;
  to?: string;
}

/** Títulos legibles para sub-vistas de metamodelo */
const VIEW_LABELS: Record<string, string> = {
  edit: 'Editor',
  models: 'Models',
  specs: 'Graphics',
  constraints: 'OCL',
  templates: 'Code',
};

export default function Breadcrumbs() {
  const location = useLocation();
  const path = location.pathname;

  const crumbs = useMemo<Crumb[]>(() => {
    const parts: Crumb[] = [{ label: 'Projects', to: '/' }];
    const segments = path.split('/').filter(Boolean);

    // /projects/:id[/...]
    const projIdx = segments.indexOf('projects');
    if (projIdx !== -1 && segments[projIdx + 1]) {
      const projectId = segments[projIdx + 1];
      parts.push({
        label: `Project ${projectId.slice(0, 8)}…`,
        to: `/projects/${projectId}`,
      });

      // /projects/:pid/metamodels/:mmid/...
      const metaIdx = segments.indexOf('metamodels');
      if (metaIdx !== -1 && segments[metaIdx + 1]) {
        const mmid = segments[metaIdx + 1];
        const viewSeg = segments[metaIdx + 2]; // edit / models / specs / constraints / templates
        const viewLabel = VIEW_LABELS[viewSeg] || viewSeg;

        parts.push({
          label: `Metamodel ${mmid.slice(0, 8)}…`,
          to: `/projects/${projectId}/metamodels/${mmid}/edit`,
        });
        parts.push({ label: viewLabel });
      }
    }

    return parts;
  }, [path]);

  // Don't render on home page or editor routes (they have their own)
  if (path === '/' || path.includes('/edit')) return null;

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
