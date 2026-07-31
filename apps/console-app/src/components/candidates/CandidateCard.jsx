import { Calendar } from 'lucide-react';
import Badge from '../common/Badge';
import { formatDate } from '../../utils/formatDate';
import CandidateVideoAvatar from './CandidateVideoAvatar';

export default function CandidateCard({ candidate, stageName, onClick }) {
  return (
    <div
      onClick={() => onClick?.(candidate)}
      className="flex cursor-pointer items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
    >
      <CandidateVideoAvatar
        candidate={candidate}
        className="h-16 w-24 rounded-lg"
        showPlayIcon
      />

      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-heading truncate">
          {candidate.firstName} {candidate.lastName}
        </h3>
        <p className="text-sm text-muted truncate">{candidate.email}</p>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1">
            <Calendar size={12} />
            {candidate.submittedAt ? formatDate(candidate.submittedAt) : 'In progress'}
          </span>
          {stageName && <Badge status="default">{stageName}</Badge>}
        </div>
      </div>
    </div>
  );
}
