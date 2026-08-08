/**
 * @fileoverview Pulse skeleton placeholders for billing pages.
 */
export default function BillingSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-2xl border border-border/70 bg-card p-6 shadow-sm"
        >
          <div className="h-5 w-1/3 rounded bg-hover" />
          <div className="mt-4 h-8 w-1/2 rounded bg-hover" />
          <div className="mt-6 space-y-2">
            <div className="h-3 w-full rounded bg-hover" />
            <div className="h-3 w-5/6 rounded bg-hover" />
            <div className="h-3 w-4/6 rounded bg-hover" />
          </div>
          <div className="mt-8 h-10 w-full rounded-lg bg-hover" />
        </div>
      ))}
    </div>
  );
}
