import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { X } from 'lucide-react';
import ApplicationPreviewFlow from '../../components/jobs/ApplicationPreviewFlow';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import * as jobService from '../../services/jobService';

export default function ApplicationPreviewPage() {
  const { id } = useParams();
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
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <LoadingSpinner message="Loading application..." />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex flex-col items-center justify-center text-muted">
        <p>Job not found.</p>
        <button type="button" onClick={handleClose} className="mt-3 text-sm text-accent hover:underline">
          Close tab
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f3f4f6]">
      <header className="sticky top-0 z-10 border-b border-gray-200/70 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-end px-5 sm:px-8 lg:px-10">
          <button
            type="button"
            onClick={handleClose}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-gray-100 hover:text-heading transition-colors"
          >
            <X size={16} />
            Close preview
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl pb-16">
        <ApplicationPreviewFlow job={job} />
      </main>
    </div>
  );
}
