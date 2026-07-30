export default function SidePanel({ title, subtitle, children, className = '', embedded = false }) {
  const header = (title || subtitle) && (
    <div className="border-b border-border bg-hover/40 px-5 py-4">
      {title && <h2 className="text-lg font-semibold text-heading">{title}</h2>}
      {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
    </div>
  );

  if (embedded) {
    return (
      <aside className={`w-full shrink-0 border-b border-border bg-hover/20 lg:w-56 lg:border-b-0 lg:border-r xl:w-60 ${className}`}>
        {header}
        <div className="space-y-1 p-3">{children}</div>
      </aside>
    );
  }

  return (
    <aside className={`w-full shrink-0 lg:w-60 xl:w-64 ${className}`}>
      <div className="sticky top-24 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        {header}
        <div className="min-h-[28rem] space-y-1 p-3">{children}</div>
      </div>
    </aside>
  );
}

export function SidePanelItem({
  active,
  onClick,
  icon: Icon,
  label,
  description,
  step,
  badge,
  as: Component = 'button',
  ...props
}) {
  const content = (
    <>
      {step != null && (
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
            active ? 'bg-accent text-white' : 'bg-hover text-muted group-hover:bg-hover/80'
          }`}
        >
          {step}
        </span>
      )}
      {Icon && !step && (
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            active ? 'bg-accent/15 text-accent' : 'bg-hover text-muted group-hover:bg-hover/80'
          }`}
        >
          <Icon size={16} />
        </span>
      )}
      <span className="min-w-0 flex-1 text-left">
        <span className={`block truncate text-sm ${active ? 'font-semibold text-heading' : 'font-medium text-heading'}`}>
          {label}
        </span>
        {description && (
          <span className="mt-0.5 block truncate text-xs text-muted">
            {description}
          </span>
        )}
      </span>
      {badge != null && (
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
            active ? 'bg-accent/20 text-accent' : 'bg-hover text-muted'
          }`}
        >
          {badge}
        </span>
      )}
    </>
  );

  const className = `group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all ${
    active
      ? 'bg-accent/10 ring-1 ring-accent/20'
      : 'hover:bg-hover'
  }`;

  if (Component === 'button') {
    return (
      <button type="button" onClick={onClick} className={className} {...props}>
        {content}
      </button>
    );
  }

  return (
    <Component className={className} {...props}>
      {content}
    </Component>
  );
}
