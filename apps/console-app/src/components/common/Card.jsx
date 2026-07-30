export default function Card({ children, className = '', padding = true }) {
  return (
    <div className={`rounded-xl border border-border bg-white shadow-sm ${padding ? 'p-6' : ''} ${className}`}>
      {children}
    </div>
  );
}

export function KpiCard({ label, value, icon: Icon, trend }) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-heading">{value}</p>
          {trend && <p className="mt-1 text-xs text-green-600">{trend}</p>}
        </div>
        {Icon && (
          <div className="rounded-lg bg-accent/10 p-2 text-accent">
            <Icon size={20} />
          </div>
        )}
      </div>
    </Card>
  );
}
