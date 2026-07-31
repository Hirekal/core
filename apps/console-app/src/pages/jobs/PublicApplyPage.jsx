import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ApplicationPreviewFlow, { PublicCareersHeader } from '../../components/jobs/ApplicationPreviewFlow';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import * as applicationService from '../../services/applicationService';

export default function PublicApplyPage() {
  const { slug } = useParams();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    applicationService
      .getPublicJob(slug)
      .then((data) => {
        if (cancelled) return;
        setJob(data);
        if (data?.title) {
          document.title = `${data.title} | Apply`;
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || 'Failed to load job');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      document.title = 'Hirekal';
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <LoadingSpinner message="Loading application..." />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center text-muted px-4">
        <p>{error || 'This job posting is no longer available.'}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="sticky top-0 z-10 shrink-0 border-b border-border bg-card/95 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-4xl items-center justify-between gap-4 px-5 sm:px-6">
          <PublicCareersHeader company={job.company} />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-5 sm:px-6">
        <ApplicationPreviewFlow job={job} slug={slug} live />
      </main>

      <footer className="shrink-0 border-t border-border py-4 text-center text-xs text-muted">
        Powered by <span className="font-medium text-heading">Hirekal</span>
      </footer>
    </div>
  );
}
