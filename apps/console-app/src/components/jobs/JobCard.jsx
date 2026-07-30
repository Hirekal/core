import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import Badge from '../common/Badge';
import JobActionsMenu from './JobActionsMenu';
import { formatRelative } from '../../utils/formatDate';

export default function JobCard({ job, onDuplicate, onCopyLink, onArchive, onRestore, onDelete }) {
  const isArchived = job.status === 'archived';

  return (
    <div className="group relative rounded-xl border border-border bg-white p-5 shadow-sm transition-shadow hover:shadow-md overflow-visible">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Badge status={job.status}>{job.status}</Badge>
          </div>
          <Link to={`/jobs/${job.id}`} className="block">
            <h3 className="text-base font-semibold text-heading truncate hover:text-accent transition-colors">
              {job.title}
            </h3>
          </Link>
          <p className="mt-1 text-sm text-muted">{job.company} · {job.location}</p>
        </div>
        <JobActionsMenu
          job={job}
          onDuplicate={onDuplicate}
          onCopyLink={onCopyLink}
          onArchive={onArchive}
          onRestore={onRestore}
          onDelete={onDelete}
          triggerClassName={isArchived ? 'opacity-100' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity'}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
        <div className="flex items-center gap-1.5 text-muted">
          <Users size={14} />
          <span>{job.applicationCount} applications</span>
        </div>
        <span className="text-xs text-muted text-right">Updated {formatRelative(job.updatedAt)}</span>
      </div>

      <div className="mt-3 flex gap-2">
        <Link
          to={`/jobs/${job.id}`}
          className="flex-1 rounded-lg border border-border py-1.5 text-center text-xs font-medium text-heading hover:bg-gray-50"
        >
          View Job
        </Link>
        <Link
          to={`/jobs/${job.id}/edit`}
          className="flex-1 rounded-lg border border-border py-1.5 text-center text-xs font-medium text-heading hover:bg-gray-50"
        >
          Edit
        </Link>
      </div>
    </div>
  );
}
