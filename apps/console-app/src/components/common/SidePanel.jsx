export default function SidePanel({ title, subtitle, children, className = '' }) {
  return (
    <aside className={`w-full lg:w-60 xl:w-64 shrink-0 ${className}`}>
      <div className="sticky top-24 overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
        {(title || subtitle) && (
          <div className="border-b border-border bg-gray-50/80 px-5 py-4">
            {title && (
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</p>
            )}
            {subtitle && <p className="mt-1 text-sm text-heading">{subtitle}</p>}
          </div>
        )}
        <div className="p-3 min-h-[28rem]">{children}</div>
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
            active ? 'bg-accent text-white' : 'bg-gray-100 text-muted group-hover:bg-gray-200'
          }`}
        >
          {step}
        </span>
      )}
      {Icon && !step && (
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            active ? 'bg-accent/15 text-accent' : 'bg-gray-100 text-muted group-hover:bg-gray-200'
          }`}
        >
          <Icon size={16} />
        </span>
      )}
      <span className="min-w-0 flex-1 text-left">
        <span className={`block truncate ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
        {description && (
          <span className={`block truncate text-xs mt-0.5 ${active ? 'text-accent/80' : 'text-muted'}`}>
            {description}
          </span>
        )}
      </span>
      {badge != null && (
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            active ? 'bg-accent/20 text-accent' : 'bg-gray-100 text-muted'
          }`}
        >
          {badge}
        </span>
      )}
    </>
  );

  const className = `group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition-all ${
    active
      ? 'bg-accent/10 text-accent ring-1 ring-accent/20'
      : 'text-muted hover:bg-gray-50 hover:text-heading'
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
