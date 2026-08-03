import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader';
import JobForm from '../../components/jobs/JobForm';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import * as jobService from '../../services/jobService';
import { openJobPreview } from '../../utils/openJobPreview';

export default function AddEditJobPage() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const { showError, showSuccess } = useToast();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEditing) {
      jobService
        .getJobById(id)
        .then((data) => {
          setJob(data);
        })
        .catch((err) => {
          showError(err, 'Failed to load job');
        })
        .finally(() => setLoading(false));
    }
  }, [id, isEditing, showError]);

  const handleSubmit = async (formData, { openPreview = false } = {}) => {
    setSaving(true);
    try {
      let result;
      if (isEditing) {
        result = await jobService.updateJob(id, formData);
      } else {
        result = await jobService.createJob(formData);
      }
      if (!result) return;
      if (result.mediaWarning) {
        showError(result.mediaWarning);
      }
      await jobService.cacheJobForPreview(result);
      setJob(result);
      if (openPreview) {
        await openJobPreview(result.id, result);
        navigate(`/jobs/${result.id}/edit`);
      } else if (isEditing) {
        navigate(`/jobs/${result.id}/edit`);
        showSuccess('Job saved');
      } else {
        navigate(`/jobs/${result.id}`);
        showSuccess('Job created');
      }
    } catch (error) {
      showError(error, 'Failed to save job');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl">
      <PageHeader
        title={isEditing ? 'Edit Job' : 'Create New Job'}
        description={isEditing ? 'Update your job listing details' : 'Set up a new video interview job'}
        breadcrumbs={[
          { to: '/jobs', label: 'Jobs' },
          { label: isEditing ? 'Edit Job' : 'New Job' },
        ]}
      />
      <JobForm initialData={job} onSubmit={handleSubmit} loading={saving} />
    </div>
  );
}
