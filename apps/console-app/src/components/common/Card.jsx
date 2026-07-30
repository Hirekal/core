export default function Card({ children, className = '', padding = true }) {
  return (
    <div
      className={`rounded-2xl border border-border/70 bg-card shadow-sm ${padding ? 'p-5' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

export function KpiCard({ label, value, icon: Icon, trend }) {
  return (
    <div className="group rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/15 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-heading">{value ?? 0}</p>
          {trend && <p className="mt-1.5 text-xs text-green-600">{trend}</p>}
        </div>
        {Icon && (
          <div className="rounded-xl bg-accent/10 p-2.5 text-accent transition-colors group-hover:bg-accent/15">
            <Icon size={20} strokeWidth={2} />
          </div>
        )}
      </div>
    </div>
  );
}
