export default function Table({ columns, data, onRowClick, emptyMessage = 'No data found', loading = false }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        <span className="ml-3 text-sm">Loading...</span>
      </div>
    );
  }

  if (!data?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted">
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-hover/30">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wide text-muted"
                style={{ width: col.width }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={row.id || i}
              onClick={() => onRowClick?.(row)}
              className={`border-b border-border/70 last:border-0 transition-colors ${
                onRowClick ? 'cursor-pointer hover:bg-hover/60' : ''
              }`}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-5 py-4 text-heading">
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
