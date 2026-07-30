import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import ApplicationPreviewFlow, { PublicCareersHeader } from '../../components/jobs/ApplicationPreviewFlow';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import * as jobService from '../../services/jobService';

export default function ApplicationPreviewPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isAdminPreview = searchParams.get('admin') === '1';
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    jobService.getJobForPreview(id).then((data) => {
      setJob(data);
      setLoading(false);
      if (data?.title) {
        document.title = `${data.title} | Apply`;
      }
    });
    return () => {
      document.title = 'Hirekal';
    };
  }, [id]);

  const handleClose = () => {
    window.close();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <LoadingSpinner message="Loading application..." />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center text-muted px-4">
        <p>This job posting is no longer available.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <header className="sticky top-0 z-10 shrink-0 border-b border-border bg-card/95 backdrop-blur-md">
        <div className="mx-auto flex h-12 max-w-4xl items-center justify-between gap-4 px-5 sm:px-6">
          <PublicCareersHeader company={job.company} />
          {isAdminPreview && (
            <button
              type="button"
              onClick={handleClose}
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-hover hover:text-heading"
            >
              <X size={16} />
              Close preview
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-5 sm:px-6">
        <ApplicationPreviewFlow job={job} />
      </main>

      <footer className="shrink-0 border-t border-border py-4 text-center text-xs text-muted">
        Powered by <span className="font-medium text-heading">Hirekal</span>
      </footer>
    </div>
  );
}
