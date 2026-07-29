import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export default function PageHeader({ title, description, breadcrumbs, actions }) {
  return (
    <div className="mb-8">
      {breadcrumbs && (
        <nav className="mb-3 flex items-center gap-1 text-sm text-muted">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={14} />}
              {crumb.to ? (
                <Link to={crumb.to} className="hover:text-accent">{crumb.label}</Link>
              ) : (
                <span className="text-heading">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-heading">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}
