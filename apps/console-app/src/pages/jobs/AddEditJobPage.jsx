import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader';
import JobForm from '../../components/jobs/JobForm';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import * as jobService from '../../services/jobService';
import { openJobPreview } from '../../utils/openJobPreview';

export default function AddEditJobPage() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEditing) {
      jobService.getJobById(id).then((data) => {
        setJob(data);
        setLoading(false);
      });
    }
  }, [id, isEditing]);

  const handleSubmit = async (formData, { openPreview = false } = {}) => {
    setSaving(true);
    let result;
    if (isEditing) {
      result = await jobService.updateJob(id, formData);
    } else {
      result = await jobService.createJob(formData);
    }
    setSaving(false);
    if (!result) return;
    if (openPreview) {
      await openJobPreview(result.id, result);
    }
    navigate(`/jobs/${result.id}`);
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
