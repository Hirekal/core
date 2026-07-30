import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PipelineStageTabs({
  stages,
  activeStage,
  onChange,
  counts = {},
  addStageHref,
  newCounts = {},
}) {
  return (
    <div className="overflow-x-auto">
      <div className="flex min-w-max items-center gap-2 py-0.5">
        {stages.map((stage) => {
          const count = counts[stage.id] ?? 0;
          const isActive = activeStage === stage.id;
          const hasNew = (newCounts[stage.id] ?? 0) > 0;

          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => onChange(stage.id)}
              className={`relative inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? 'bg-accent/10 text-accent ring-1 ring-accent/20'
                  : 'text-muted hover:bg-hover hover:text-heading'
              }`}
            >
              <span className="whitespace-nowrap">{stage.name}</span>
              <span
                className={`inline-flex min-w-[1.5rem] items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                  isActive ? 'bg-accent/15 text-accent' : 'bg-hover text-muted'
                }`}
              >
                {count}
              </span>
              {isActive && hasNew && (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-blue-500 ring-2 ring-card" />
              )}
            </button>
          );
        })}

        {addStageHref && (
          <Link
            to={addStageHref}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-heading transition-colors hover:bg-hover"
          >
            <Plus size={16} />
            <span className="whitespace-nowrap">Add Stage</span>
          </Link>
        )}
      </div>
    </div>
  );
}
