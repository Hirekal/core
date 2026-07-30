import { useEffect, useState } from 'react';
import { useParams, Outlet } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader';
import SettingsNav from '../../components/settings/SettingsNav';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import * as jobService from '../../services/jobService';

export default function JobSettingsPage() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    jobService.getJobById(id).then((data) => {
      setJob(data);
      setSettings(data?.settings || {});
      setLoading(false);
    });
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    await jobService.updateJobSettings(id, settings);
    setSaving(false);
  };

  if (loading) return <LoadingSpinner />;
  if (!job) return <div className="text-center py-16 text-muted">Job not found</div>;

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

      <div className="flex gap-10 xl:gap-12">
        <SettingsNav basePath={`/jobs/${id}/settings`} />
        <div className="flex-1 min-w-0 min-h-[28rem]">
          <Outlet context={{ settings, setSettings, job }} />
        </div>
      </div>
    </div>
  );
}
