import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Eye, Users, PlayCircle, CheckCircle, Copy, Download, Settings, Edit, ExternalLink, Trash2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import PageHeader from '../../components/layout/PageHeader';
import { KpiCard } from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Table from '../../components/common/Table';
import Modal from '../../components/common/Modal';
import StageSidebar from '../../components/candidates/StageSidebar';
import CandidateDrawer from '../../components/candidates/CandidateDrawer';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { SelectDropdown } from '../../components/common/Dropdown';
import * as jobService from '../../services/jobService';
import * as candidateService from '../../services/candidateService';
import { formatDate, formatDateTime } from '../../utils/formatDate';
import { openJobPreview } from '../../utils/openJobPreview';

export default function JobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [stages, setStages] = useState([]);
  const [activeStage, setActiveStage] = useState('all');
  const [applicationSortBy, setApplicationSortBy] = useState('submitted');
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const [jobData, candidatesData, stagesData] = await Promise.all([
      jobService.getJobById(id),
      candidateService.getCandidates({ jobId: id }),
      candidateService.getStages(id),
    ]);
    setJob(jobData);
    setCandidates(candidatesData);
    setStages(stagesData.filter((s) => s.active && s.id !== 'stage-3'));
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [id]);

  const defaultStages = useMemo(
    () => stages.filter((s) => s.isDefault),
    [stages]
  );

  const stageCounts = useMemo(() => {
    const counts = { all: candidates.length };
    stages.forEach((s) => {
      counts[s.id] = candidates.filter((c) => c.stageId === s.id).length;
    });
    return counts;
  }, [candidates, stages]);

  const filteredAndSortedCandidates = useMemo(() => {
    let result = activeStage === 'all'
      ? [...candidates]
      : candidates.filter((c) => c.stageId === activeStage);

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
  if (!job) return <div className="text-center py-16 text-muted">Job not found</div>;

  const chartData = [
    { name: 'Visitors', value: job.visitorCount },
    { name: 'Viewers', value: job.viewers },
    { name: 'Started', value: job.applicationsStarted },
    { name: 'Submitted', value: job.applicationsSubmitted },
  ];

  const candidateColumns = [
    {
      key: 'name',
      label: 'Candidate',
      render: (row) => (
        <div className="flex items-center gap-3">
          {row.videoThumbnail && (
            <img src={row.videoThumbnail} alt="" className="h-8 w-12 rounded object-cover" />
          )}
          <span className="font-medium">{row.firstName} {row.lastName}</span>
        </div>
      ),
    },
    { key: 'email', label: 'Email' },
    {
      key: 'stage',
      label: 'Stage',
      render: (row) => {
        const stage = stages.find((s) => s.id === row.stageId);
        return <Badge status="default">{stage?.name || 'Unknown'}</Badge>;
      },
    },
    {
      key: 'submittedAt',
      label: 'Submitted',
      render: (row) => row.submittedAt ? formatDateTime(row.submittedAt) : 'In progress',
    },
  ];

  const handleExport = async () => {
    setExporting(true);
    const result = await jobService.exportApplicationsCsv(id);
    setExporting(false);
    alert(`CSV export ready: ${result.filename}`);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(job.shareLink);
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 2000);
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
    await jobService.deleteJob(id);
    setDeleting(false);
    navigate('/jobs');
  };

  return (
    <div>
      <PageHeader
        title={job.title}
        breadcrumbs={[
          { to: '/jobs', label: 'Jobs' },
          { label: job.title },
        ]}
        actions={
          <>
            <Badge status={job.status}>{job.status}</Badge>
            <Button variant="secondary" size="sm" onClick={() => openJobPreview(id, job).catch(() => {})}>
              <ExternalLink size={16} /> Preview
            </Button>
            <Link to={`/jobs/${id}/edit`}><Button variant="secondary" size="sm"><Edit size={16} /> Edit</Button></Link>
            <Link to={`/jobs/${id}/settings`}><Button variant="secondary" size="sm"><Settings size={16} /> Settings</Button></Link>
            {job.status === 'archived' && (
              <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)}>
                <Trash2 size={16} /> Delete
              </Button>
            )}
          </>
        }
      />

      <div className="mb-6 flex flex-wrap gap-4 text-sm text-muted">
        <span>{job.company}</span>
        <span>·</span>
        <span>Created {formatDate(job.createdAt)}</span>
        <span>·</span>
        <span>Updated {formatDate(job.updatedAt)}</span>
        <span>·</span>
        <span>{job.applicationCount} applications</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <KpiCard label="Visitor Count" value={job.visitorCount} icon={Eye} />
        <KpiCard label="Viewers" value={job.viewers} icon={Users} />
        <KpiCard label="Applications Started" value={job.applicationsStarted} icon={PlayCircle} />
        <KpiCard label="Applications Submitted" value={job.applicationsSubmitted} icon={CheckCircle} />
      </div>

      <div className="mb-8 rounded-xl border border-border bg-white p-6 shadow-sm">
        <h3 className="text-sm font-medium text-heading mb-4">Application Funnel</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="value" fill="#e11d48" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mb-8 flex items-center gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted mb-1">Shareable Application Link</p>
          <p className="text-sm font-medium truncate">{job.shareLink}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={handleCopyLink}>
          <Copy size={16} /> Copy Link
        </Button>
      </div>

      {copyToast && (
        <div className="fixed bottom-6 right-6 rounded-lg bg-heading px-4 py-2 text-sm text-white shadow-lg z-50">
          Link copied!
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-4">
        <h2 className="text-lg font-semibold">Applications</h2>
        <div className="flex items-center gap-3">
          <SelectDropdown
            value={applicationSortBy}
            onChange={setApplicationSortBy}
            options={[
              { value: 'submitted', label: 'Sort: Submission Date' },
              { value: 'name', label: 'Sort: Name A-Z' },
              { value: 'stage', label: 'Sort: Stage' },
            ]}
            className="w-48"
          />
          <Button variant="secondary" size="sm" onClick={handleExport} disabled={exporting}>
            <Download size={16} /> {exporting ? 'Exporting...' : 'Export to CSV'}
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-10 xl:gap-12">
        <StageSidebar
          stages={defaultStages.length ? defaultStages : stages}
          activeStage={activeStage}
          onChange={setActiveStage}
          counts={stageCounts}
        />

        <div className="flex-1 min-w-0 rounded-xl border border-border bg-white shadow-sm">
          <Table
            columns={candidateColumns}
            data={filteredAndSortedCandidates}
            onRowClick={(row) => setSelectedCandidate(row)}
            emptyMessage="No applications in this stage"
          />
        </div>
      </div>

      <CandidateDrawer
        candidate={selectedCandidate}
        stages={stages}
        onClose={() => setSelectedCandidate(null)}
        onStageChange={handleStageChange}
        onRatingChange={handleRatingChange}
        onAddNote={handleAddNote}
        onDelete={handleDelete}
      />

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
