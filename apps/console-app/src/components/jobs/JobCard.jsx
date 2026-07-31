import { Link } from 'react-router-dom';
import { Users, Pencil, CopyPlus, Settings, Link2, Clock } from 'lucide-react';
import { formatRelative } from '../../utils/formatDate';
import { getPublicApplyUrl } from '../../utils/applyLink';

function CardIconAction({ icon: Icon, label, onClick, to }) {
  const className =
    'flex h-9 w-9 items-center justify-center rounded-xl border border-border/70 bg-card text-muted shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/30 hover:bg-accent/5 hover:text-accent hover:shadow-md';

  if (to) {
    return (
      <Link to={to} title={label} aria-label={label} className={className}>
        <Icon size={16} strokeWidth={2} />
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className={className}>
      <Icon size={16} strokeWidth={2} />
    </button>
  );
}

function JobCardStatus({ status }) {
  const styles = {
    active:
      'border-emerald-200/80 bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 [&_.dot]:bg-emerald-500',
    paused:
      'border-amber-200/80 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-800 [&_.dot]:bg-amber-500',
    archived:
      'border-border bg-hover text-muted [&_.dot]:bg-muted',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 self-start rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${styles[status] || styles.archived}`}
    >
      <span className="dot h-1.5 w-1.5 shrink-0 rounded-full" />
      {status}
    </span>
  );
}

function getSubtitle(job) {
  const companyLine = [job.company, job.location].filter(Boolean).join(' · ');
  const internalTitle = job.internalTitle?.trim();

  if (companyLine) return companyLine;
  if (internalTitle && internalTitle !== job.title) return internalTitle;
  return '';
}

export default function JobCard({ job, onDuplicate, onCopyLink }) {
  const subtitle = getSubtitle(job);
  const hasApplicants = job.applicationCount > 0;

  return (
    <article className="group flex h-full flex-col items-start rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/15 hover:shadow-lg sm:p-6">
      <JobCardStatus status={job.status} />

      <Link to={`/jobs/${job.id}`} className="mt-4 block w-full min-w-0 flex-1 text-left">
        <h3 className="text-lg font-semibold leading-snug text-heading transition-colors group-hover:text-accent sm:text-xl">
          {job.title}
        </h3>
        {subtitle && (
          <p className="mt-1.5 truncate text-sm text-muted">{subtitle}</p>
        )}
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
          <Clock size={13} className="shrink-0 opacity-70" />
          <span>Updated {formatRelative(job.updatedAt)}</span>
        </p>
      </Link>

      <div className="mt-5 flex w-full items-center gap-3">
        <div
          className={`relative inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums ${
            hasApplicants ? 'bg-accent/10 text-accent' : 'bg-hover text-muted'
          }`}
        >
          <Users size={14} strokeWidth={2.25} />
          <span>{job.applicationCount}</span>
          {hasApplicants && (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-accent ring-2 ring-card" />
          )}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <CardIconAction icon={Pencil} label="Edit job" to={`/jobs/${job.id}/edit`} />
          <CardIconAction
            icon={CopyPlus}
            label="Duplicate job"
            onClick={() => onDuplicate?.(job.id)}
          />
          <CardIconAction icon={Settings} label="Job settings" to={`/jobs/${job.id}/settings`} />
          <CardIconAction
            icon={Link2}
            label="Copy job link"
            onClick={() => onCopyLink?.(getPublicApplyUrl(job))}
          />
        </div>
      </div>
    </article>
  );
}
