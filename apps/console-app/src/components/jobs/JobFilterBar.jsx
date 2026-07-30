import { Search, LayoutGrid, List, Table2 } from 'lucide-react';
import { SelectDropdown } from '../common/Dropdown';

export default function JobFilterBar({
  search,
  onSearchChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative flex-1 max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          placeholder="Search jobs..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-lg border border-border bg-input py-2 pl-9 pr-3 text-sm text-heading placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
      </div>

      <div className="flex items-center gap-3">
        <SelectDropdown
          size="sm"
          value={sortBy}
          onChange={onSortChange}
          placeholder="Sort by"
          options={[
            { value: 'updated', label: 'Last Updated' },
            { value: 'created', label: 'Date Created' },
            { value: 'title', label: 'Title A-Z' },
            { value: 'applications', label: 'Most Applications' },
          ]}
          className="w-44"
        />

        <div className="flex rounded-lg border border-border bg-card">
          {[
            { mode: 'grid', icon: LayoutGrid },
            { mode: 'list', icon: List },
            { mode: 'table', icon: Table2 },
          ].map(({ mode, icon: Icon }) => (
            <button
              key={mode}
              onClick={() => onViewModeChange(mode)}
              className={`p-2 transition-colors ${viewMode === mode ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-hover'} first:rounded-l-lg last:rounded-r-lg`}
            >
              <Icon size={18} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
