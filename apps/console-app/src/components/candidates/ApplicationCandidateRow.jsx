import { ChevronRight } from 'lucide-react';
import { formatDateTime } from '../../utils/formatDate';
import CandidateVideoAvatar from './CandidateVideoAvatar';

function isCandidateNew(candidate) {
  if (!candidate.submittedAt) return false;
  const submitted = new Date(candidate.submittedAt).getTime();
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return submitted >= weekAgo;
}

export default function ApplicationCandidateRow({
  candidate,
  selected,
  onSelect,
  onClick,
}) {
  const isNew = isCandidateNew(candidate);

  return (
    <article
      onClick={() => onClick?.(candidate)}
      className="group flex cursor-pointer items-center gap-4 py-4 transition-colors hover:bg-hover/60"
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => {
          e.stopPropagation();
          onSelect?.(candidate.id, e.target.checked);
        }}
        onClick={(e) => e.stopPropagation()}
        className="h-4 w-4 shrink-0 rounded border-border text-accent focus:ring-accent/30"
        aria-label={`Select ${candidate.firstName} ${candidate.lastName}`}
      />

      <CandidateVideoAvatar candidate={candidate} className="h-11 w-11 rounded-full" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {isNew && (
            <span className="inline-flex rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">
              New
            </span>
          )}
          <p className="text-xs text-muted">
            {candidate.submittedAt
              ? `Submitted on ${formatDateTime(candidate.submittedAt)}`
              : 'Application in progress'}
          </p>
        </div>
        <h3 className="mt-0.5 truncate text-base font-semibold text-heading transition-colors group-hover:text-accent">
          {candidate.firstName} {candidate.lastName}
        </h3>
        {candidate.email && (
          <p className="mt-0.5 truncate text-sm text-muted">{candidate.email}</p>
        )}
      </div>

      <ChevronRight
        size={18}
        className="shrink-0 text-muted/40 transition-colors group-hover:text-accent"
      />
    </article>
  );
}

export { isCandidateNew };
