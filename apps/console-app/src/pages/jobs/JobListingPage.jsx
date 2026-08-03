import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Briefcase } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import JobFilterBar from '../../components/jobs/JobFilterBar';
import JobCard from '../../components/jobs/JobCard';
import JobActionsMenu from '../../components/jobs/JobActionsMenu';
import Tabs from '../../components/common/Tabs';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useFilterStore } from '../../store/filterStore';
import { useToast } from '../../context/ToastContext';
import * as jobService from '../../services/jobService';
import { formatRelative } from '../../utils/formatDate';

export default function JobListingPage() {
  const { jobStatus, jobSearch, jobSortBy, jobViewMode, setJobStatus, setJobSearch, setJobSortBy, setJobViewMode } = useFilterStore();
  const { showError, showSuccess } = useToast();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copyToast, setCopyToast] = useState(false);
  const [jobToDelete, setJobToDelete] = useState(null);
  const [jobToArchive, setJobToArchive] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const loadJobs = () => {
    setLoading(true);
    jobService
      .getJobs({ status: jobStatus, search: jobSearch, sortBy: jobSortBy })
      .then(setJobs)
      .catch((err) => {
        setJobs([]);
        if (err.status !== 401) {
          showError(err, 'Failed to load jobs');
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadJobs(); }, [jobStatus, jobSearch, jobSortBy]);

  const statusTabs = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'paused', label: 'Paused' },
    { id: 'archived', label: 'Archived' },
  ];

  const handleDuplicate = async (id) => {
    try {
      await jobService.duplicateJob(id);
      loadJobs();
      showSuccess('Job duplicated');
    } catch (err) {
      showError(err, 'Failed to duplicate job');
    }
  };

  const handleCopyLink = (link) => {
    navigator.clipboard.writeText(link);
    setCopyToast(true);
    setTimeout(() => setCopyToast(false), 2000);
  };

  const handleDeleteConfirm = async () => {
    if (!jobToDelete) return;
    setDeleting(true);
    try {
      await jobService.deleteJob(jobToDelete.id);
      setJobToDelete(null);
      loadJobs();
      showSuccess('Job deleted');
    } catch (err) {
      showError(err, 'Failed to delete job');
    } finally {
      setDeleting(false);
    }
  };

  const handleArchiveConfirm = async () => {
    if (!jobToArchive) return;
    setArchiving(true);
    try {
      await jobService.archiveJob(jobToArchive.id);
      setJobToArchive(null);
      loadJobs();
      showSuccess('Job archived');
    } catch (err) {
      showError(err, 'Failed to archive job');
    } finally {
      setArchiving(false);
    }
  };

  const handleRestore = async (job) => {
    try {
      await jobService.restoreJob(job.id);
      loadJobs();
      showSuccess('Job restored');
    } catch (err) {
      showError(err, 'Failed to restore job');
    }
  };

  const handlePause = async (job) => {
    try {
      await jobService.pauseJob(job.id);
      loadJobs();
      showSuccess('Job paused');
    } catch (err) {
      showError(err, 'Failed to pause job');
    }
  };

  const handleResume = async (job) => {
    try {
      await jobService.resumeJob(job.id);
      loadJobs();
      showSuccess('Job resumed');
    } catch (err) {
      showError(err, 'Failed to resume job');
    }
  };

  const tableColumns = [
    {
      key: 'title',
      label: 'Job Name',
      render: (row) => (
        <Link to={`/jobs/${row.id}`} className="font-medium hover:text-accent">{row.title}</Link>
      ),
    },
    {
      key: 'updatedAt',
      label: 'Last Updated',
      render: (row) => formatRelative(row.updatedAt),
    },
    { key: 'applicationCount', label: 'Application Count' },
    {
      key: 'status',
      label: 'Status',
      render: (row) => <Badge status={row.status}>{row.status}</Badge>,
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <JobActionsMenu
          job={row}
          onDuplicate={handleDuplicate}
          onCopyLink={handleCopyLink}
          onPause={handlePause}
          onResume={handleResume}
          onArchive={setJobToArchive}
          onRestore={handleRestore}
          onDelete={setJobToDelete}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Jobs"
        description="Manage your video interview job listings"
        actions={
          <Link to="/jobs/new">
            <Button><Plus size={18} /> Add New Job</Button>
          </Link>
        }
      />

      <Tabs tabs={statusTabs} activeTab={jobStatus} onChange={setJobStatus} className="mb-6" />

      <JobFilterBar
        search={jobSearch}
        onSearchChange={setJobSearch}
        sortBy={jobSortBy}
        onSortChange={setJobSortBy}
        viewMode={jobViewMode}
        onViewModeChange={setJobViewMode}
      />

      {copyToast && (
        <div className="fixed bottom-6 right-6 rounded-lg bg-heading px-4 py-2 text-sm text-white shadow-lg z-50">
          Link copied to clipboard!
        </div>
      )}

      <Modal
        isOpen={!!jobToArchive}
        onClose={() => setJobToArchive(null)}
        title="Archive Job"
        size="sm"
      >
        <p className="text-sm text-muted">
          Archive <strong className="text-heading">{jobToArchive?.title}</strong>?
          Archived jobs move to the Archived tab. You can restore or permanently delete them later.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setJobToArchive(null)}>Cancel</Button>
          <Button onClick={handleArchiveConfirm} disabled={archiving}>
            {archiving ? 'Archiving...' : 'Archive Job'}
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={!!jobToDelete}
        onClose={() => setJobToDelete(null)}
        title="Delete Archived Job"
        size="sm"
      >
        <p className="text-sm text-muted">
          Are you sure you want to permanently delete <strong className="text-heading">{jobToDelete?.title}</strong>?
          This archived job and its data will be removed. This action cannot be undone.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setJobToDelete(null)}>Cancel</Button>
          <Button variant="danger" onClick={handleDeleteConfirm} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete Archived Job'}
          </Button>
        </div>
      </Modal>

      <div className="mt-6">
        {loading ? (
          <LoadingSpinner />
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No jobs found"
            description="Create your first job listing to start receiving video applications."
            action={<Link to="/jobs/new"><Button><Plus size={16} /> Add New Job</Button></Link>}
          />
        ) : jobViewMode === 'table' ? (
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <Table columns={tableColumns} data={jobs} />
          </div>
        ) : jobViewMode === 'list' ? (
          <div className="space-y-3">
            {jobs.map((job) => (
              <div key={job.id} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link to={`/jobs/${job.id}`} className="font-semibold hover:text-accent">{job.title}</Link>
                    <Badge status={job.status}>{job.status}</Badge>
                  </div>
                  <p className="text-sm text-muted mt-1">
                    {job.applicationCount} applications · Updated {formatRelative(job.updatedAt)}
                  </p>
                </div>
                <JobActionsMenu
                  job={job}
                  onDuplicate={handleDuplicate}
                  onCopyLink={handleCopyLink}
                  onPause={handlePause}
                  onResume={handleResume}
                  onArchive={setJobToArchive}
                  onRestore={handleRestore}
                  onDelete={setJobToDelete}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onDuplicate={handleDuplicate}
                onCopyLink={handleCopyLink}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
