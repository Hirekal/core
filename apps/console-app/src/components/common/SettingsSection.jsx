import Card from './Card';

/** Shared settings section header + body layout for consistent typography */
export default function SettingsSection({ title, description, action, children, className = '' }) {
  return (
    <Card className={`!p-0 overflow-hidden shadow-sm ${className}`}>
      <div className="border-b border-border bg-hover/40 px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-heading">{title}</h3>
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          {action}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </Card>
  );
}
