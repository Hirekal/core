import { cacheJobForPreview } from '../services/jobService';

export async function openJobPreview(jobId, jobSnapshot) {
  if (jobSnapshot) {
    await cacheJobForPreview(jobSnapshot);
  }
  const url = `${window.location.origin}/jobs/${jobId}/preview?admin=1`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
