import { useEffect, useState } from 'react';
import { useParams, Outlet } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader';
import SettingsNav from '../../components/settings/SettingsNav';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { useToast } from '../../context/ToastContext';
import * as jobService from '../../services/jobService';
import { toUserErrorMessage } from '../../utils/errorMessage';

export default function JobSettingsPage() {
  const { id } = useParams();
  const { showSuccess, showError } = useToast();
  const [job, setJob] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    jobService
      .getJobById(id)
      .then((data) => {
        setJob(data);
        setSettings(data?.settings || {});
      })
      .catch((err) => {
        setError(toUserErrorMessage(err, 'Failed to load job settings'));
        setJob(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const updated = await jobService.updateJobSettings(id, settings);
      setJob(updated);
      setSettings(updated?.settings || settings);
      showSuccess('Changes saved');
    } catch (err) {
      const message = toUserErrorMessage(err, 'Failed to save settings');
      setError(message);
      showError(err, 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!job) {
    return (
      <div className="text-center py-16 text-muted">
        {error || 'Job not found'}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl">
      <PageHeader
        title="Job Settings"
        description={job.title}
        breadcrumbs={[
          { to: '/jobs', label: 'Jobs' },
          { to: `/jobs/${id}`, label: job.title },
          { label: 'Settings' },
        ]}
        actions={
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        }
      />

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="flex gap-10 xl:gap-12">
        <SettingsNav basePath={`/jobs/${id}/settings`} />
        <div className="flex-1 min-w-0 min-h-[28rem]">
          <Outlet context={{ settings, setSettings, job }} />
        </div>
      </div>
    </div>
  );
}
