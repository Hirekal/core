import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Eye,
  Users,
  PlayCircle,
  CheckCircle,
  Copy,
  Download,
  Settings,
  Edit,
  ExternalLink,
  Link2,
  Building2,
  Calendar,
  Clock,
  ChevronRight,
  ArrowUpDown,
} from 'lucide-react';
import { KpiCard } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import PipelineStageTabs from '../../components/candidates/PipelineStageTabs';
import ApplicationCandidateRow, { isCandidateNew } from '../../components/candidates/ApplicationCandidateRow';
import CandidateDrawer from '../../components/candidates/CandidateDrawer';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { SelectDropdown } from '../../components/common/Dropdown';
import JobActionsMenu from '../../components/jobs/JobActionsMenu';
import * as jobService from '../../services/jobService';
import * as candidateService from '../../services/candidateService';
import { formatDate, formatRelative } from '../../utils/formatDate';
import { openJobPreview } from '../../utils/openJobPreview';
import { getPublicApplyUrl } from '../../utils/applyLink';

function MetaChip({ icon: Icon, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-hover px-3 py-1.5 text-xs font-medium text-muted">
      <Icon size={13} className="shrink-0 opacity-80" />
      {children}
    </span>
  );
}

function HeaderAction({ icon: Icon, label, onClick, to }) {
  const className =
    'inline-flex h-10 items-center gap-2 rounded-xl border border-border/70 bg-card px-3.5 text-sm font-medium text-muted shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/30 hover:bg-accent/5 hover:text-accent hover:shadow-md';

  if (to) {
    return (
      <Link to={to} title={label} className={className}>
        <Icon size={16} strokeWidth={2} />
        <span className="hidden sm:inline">{label}</span>
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} title={label} className={className}>
      <Icon size={16} strokeWidth={2} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

export default function JobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [stages, setStages] = useState([]);
  const [activeStage, setActiveStage] = useState('');
  const [applicationSortBy, setApplicationSortBy] = useState('submitted');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const [exportToast, setExportToast] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [jobData, candidatesData, stagesData] = await Promise.all([
        jobService.getJobById(id),
        candidateService.getCandidates({ jobId: id }),
        candidateService.getStages(id),
      ]);
      setJob(jobData);
      setCandidates(candidatesData);
      setStages(stagesData);
    } catch (err) {
      window.alert(err.message || 'Failed to load job');
      setJob(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [id]);

  useEffect(() => {
    if (!stages.length) return;
    if (!activeStage || !stages.some((s) => s.id === activeStage)) {
      const stageWithCandidates = stages.find((s) =>
        candidates.some((c) => c.stageId === s.id)
      );
      setActiveStage(stageWithCandidates?.id ?? stages[0].id);
    }
  }, [stages, activeStage, candidates]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeStage]);

  const stageCounts = useMemo(() => {
    const counts = {};
    stages.forEach((s) => {
      counts[s.id] = candidates.filter((c) => c.stageId === s.id).length;
    });
    return counts;
  }, [candidates, stages]);

  const newCounts = useMemo(() => {
    const counts = {};
    stages.forEach((s) => {
      counts[s.id] = candidates.filter((c) => c.stageId === s.id && isCandidateNew(c)).length;
    });
    return counts;
  }, [candidates, stages]);

  const filteredAndSortedCandidates = useMemo(() => {
    let result = activeStage
      ? candidates.filter((c) => c.stageId === activeStage)
      : [...candidates];

    result.sort((a, b) => {
      switch (applicationSortBy) {
        case 'name':
          return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
        case 'stage': {
          const stageA = stages.find((s) => s.id === a.stageId)?.name || '';
          const stageB = stages.find((s) => s.id === b.stageId)?.name || '';
          return stageA.localeCompare(stageB);
        }
        case 'submitted':
        default:
          return new Date(b.submittedAt || b.startedAt || 0) - new Date(a.submittedAt || a.startedAt || 0);
      }
    });

    return result;
  }, [candidates, activeStage, applicationSortBy, stages]);

  if (loading) return <LoadingSpinner />;
  if (!job) return <div className="py-16 text-center text-muted">Job not found</div>;

  const subtitle = job.internalTitle?.trim() || [job.company, job.location].filter(Boolean).join(' · ');

  const allSelected = filteredAndSortedCandidates.length > 0
    && filteredAndSortedCandidates.every((c) => selectedIds.has(c.id));

  const handleSelectCandidate = (candidateId, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(candidateId);
      else next.delete(candidateId);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSortedCandidates.map((c) => c.id)));
    }
  };

  const handleExport = () => {
    if (!candidates.length) return;

    setExporting(true);

    const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const headers = ['First Name', 'Last Name', 'Email', 'Phone', 'Stage', 'Submitted At', 'Rating'];
    const rows = candidates.map((candidate) => {
      const stageName = stages.find((s) => s.id === candidate.stageId)?.name || '';
      return [
        escape(candidate.firstName),
        escape(candidate.lastName),
        escape(candidate.email),
        escape(candidate.phone),
        escape(stageName),
        escape(candidate.submittedAt || ''),
        escape(candidate.rating ?? ''),
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const slug = job.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || id;

    link.href = url;
    link.download = `applications-${slug}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    setExporting(false);
    setExportToast(true);
    setTimeout(() => setExportToast(false), 2000);
  };

  const activeStageName = stages.find((s) => s.id === activeStage)?.name || 'this stage';

  const handleCopyLink = () => {
    const applyUrl = getPublicApplyUrl(job);
    navigator.clipboard.writeText(applyUrl);
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 2000);
  };

  const handleOpenApplyPage = () => {
    const applyUrl = getPublicApplyUrl(job);
    if (applyUrl) {
      window.open(applyUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleStageChange = async (stageId) => {
    if (!selectedCandidate) return;
    await candidateService.updateCandidateStage(selectedCandidate.id, stageId);
    const updated = await candidateService.getCandidateById(selectedCandidate.id);
    setSelectedCandidate(updated);
    loadData();
  };

  const handleRatingChange = async (rating) => {
    if (!selectedCandidate) return;
    await candidateService.updateCandidateRating(selectedCandidate.id, rating);
    const updated = await candidateService.getCandidateById(selectedCandidate.id);
    setSelectedCandidate(updated);
  };

  const handleAddNote = async (text) => {
    if (!selectedCandidate) return;
    await candidateService.addCandidateNote(selectedCandidate.id, { text, author: 'Sarah Chen' });
    const updated = await candidateService.getCandidateById(selectedCandidate.id);
    setSelectedCandidate(updated);
  };

  const handleDelete = async (candidateId) => {
    await candidateService.deleteCandidate(candidateId);
    setSelectedCandidate(null);
    loadData();
  };

  const handleDeleteJob = async () => {
    setDeleting(true);
    try {
      await jobService.deleteJob(id);
      navigate('/jobs');
    } catch (err) {
      window.alert(err.message || 'Failed to delete job');
    } finally {
      setDeleting(false);
    }
  };

  const handlePauseJob = async () => {
    try {
      const updated = await jobService.pauseJob(id);
      if (updated) setJob(updated);
    } catch (err) {
      window.alert(err.message || 'Failed to pause job');
    }
  };

  const handleResumeJob = async () => {
    try {
      const updated = await jobService.resumeJob(id);
      if (updated) setJob(updated);
    } catch (err) {
      window.alert(err.message || 'Failed to resume job');
    }
  };

  const handleArchiveJob = async () => {
    setArchiving(true);
    try {
      const updated = await jobService.archiveJob(id);
      setShowArchiveModal(false);
      if (updated) setJob(updated);
    } catch (err) {
      window.alert(err.message || 'Failed to archive job');
    } finally {
      setArchiving(false);
    }
  };

  const handleRestoreJob = async () => {
    try {
      const updated = await jobService.restoreJob(id);
      if (updated) setJob(updated);
    } catch (err) {
      window.alert(err.message || 'Failed to restore job');
    }
  };

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-1 text-sm text-muted">
        <Link to="/jobs" className="transition-colors hover:text-accent">Jobs</Link>
        <ChevronRight size={14} />
        <span className="truncate font-medium text-heading">{job.title}</span>
      </nav>

      <section className="rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <Badge status={job.status} className="uppercase tracking-wide">
              {job.status}
            </Badge>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight leading-tight text-heading">{job.title}</h1>
            {subtitle && (
              <p className="mt-1.5 truncate text-sm font-medium text-muted">{subtitle}</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {job.company && <MetaChip icon={Building2}>{job.company}</MetaChip>}
              <MetaChip icon={Calendar}>Created {formatDate(job.createdAt)}</MetaChip>
              <MetaChip icon={Clock}>Updated {formatRelative(job.updatedAt)}</MetaChip>
              <MetaChip icon={Users}>{job.applicationCount} applications</MetaChip>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <HeaderAction
              icon={ExternalLink}
              label="Preview"
              onClick={() => openJobPreview(id, job).catch(() => {})}
            />
            <HeaderAction icon={Edit} label="Edit" to={`/jobs/${id}/edit`} />
            <HeaderAction icon={Settings} label="Settings" to={`/jobs/${id}/settings`} />
            <JobActionsMenu
              job={job}
              statusOnly
              triggerVariant="header"
              onPause={handlePauseJob}
              onResume={handleResumeJob}
              onArchive={() => setShowArchiveModal(true)}
              onRestore={handleRestoreJob}
              onDelete={() => setShowDeleteModal(true)}
            />
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Visitor Count" value={job.visitorCount} icon={Eye} />
        <KpiCard label="Viewers" value={job.viewers} icon={Users} />
        <KpiCard label="Applications Started" value={job.applicationsStarted} icon={PlayCircle} />
        <KpiCard label="Applications Submitted" value={job.applicationsSubmitted} icon={CheckCircle} />
      </div>

      <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-4">
            <div className="rounded-xl bg-accent/10 p-3 text-accent">
              <Link2 size={20} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-heading">Shareable Application Link</h2>
              <p className="mt-1 truncate text-sm text-muted">{getPublicApplyUrl(job)}</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={handleOpenApplyPage}>
              <ExternalLink size={16} /> Open Apply Page
            </Button>
            <Button variant="secondary" size="sm" onClick={handleCopyLink}>
              <Copy size={16} /> Copy Link
            </Button>
          </div>
        </div>
      </section>

      {copyToast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-heading px-4 py-2.5 text-sm text-white shadow-lg">
          Link copied!
        </div>
      )}

      {exportToast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-heading px-4 py-2.5 text-sm text-white shadow-lg">
          CSV downloaded!
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-heading">Applications</h2>
            <p className="mt-0.5 text-sm text-muted">
              {filteredAndSortedCandidates.length} in {activeStageName} · {candidates.length} total
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <ArrowUpDown size={15} className="hidden shrink-0 text-muted sm:block" />
              <SelectDropdown
                size="sm"
                value={applicationSortBy}
                onChange={setApplicationSortBy}
                placeholder="Sort by"
                options={[
                  { value: 'submitted', label: 'Submission Date' },
                  { value: 'name', label: 'Name A-Z' },
                  { value: 'stage', label: 'Stage' },
                ]}
                className="w-44"
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExport}
              disabled={exporting}
              className="rounded-xl"
            >
              <Download size={16} /> {exporting ? 'Exporting...' : 'Export to CSV'}
            </Button>
          </div>
        </div>

        <div className="border-b border-border bg-hover/30 px-6 py-4">
          <PipelineStageTabs
            stages={stages}
            activeStage={activeStage}
            onChange={setActiveStage}
            counts={stageCounts}
            newCounts={newCounts}
            addStageHref={`/jobs/${id}/settings/stages?add=1`}
          />
        </div>

        <div>
          {filteredAndSortedCandidates.length > 0 && (
            <div className="border-b border-border/70 px-6 py-3">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-muted">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleSelectAll}
                  className="h-4 w-4 rounded border-border text-accent focus:ring-accent/30"
                />
                Select all
              </label>
            </div>
          )}

          {filteredAndSortedCandidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-muted">
              <p className="text-sm">No applications in this stage yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border/70 px-6">
              {filteredAndSortedCandidates.map((candidate) => (
                <ApplicationCandidateRow
                  key={candidate.id}
                  candidate={candidate}
                  selected={selectedIds.has(candidate.id)}
                  onSelect={handleSelectCandidate}
                  onClick={setSelectedCandidate}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      <CandidateDrawer
        candidate={selectedCandidate}
        stages={stages}
        onClose={() => setSelectedCandidate(null)}
        onStageChange={handleStageChange}
        onRatingChange={handleRatingChange}
        onAddNote={handleAddNote}
        onDelete={handleDelete}
      />

      <Modal isOpen={showArchiveModal} onClose={() => setShowArchiveModal(false)} title="Archive Job" size="sm">
        <p className="text-sm text-muted">
          Archive <strong className="text-heading">{job.title}</strong>? It will be moved to Archived jobs and stop accepting new applications.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowArchiveModal(false)}>Cancel</Button>
          <Button onClick={handleArchiveJob} disabled={archiving}>
            {archiving ? 'Archiving...' : 'Archive Job'}
          </Button>
        </div>
      </Modal>

      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Job" size="sm">
        <p className="text-sm text-muted">
          Permanently delete <strong className="text-heading">{job.title}</strong>? This cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDeleteJob} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete Job'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
