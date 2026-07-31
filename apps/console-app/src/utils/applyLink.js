/**
 * Resolves the candidate-facing apply URL for a job.
 * Falls back to the current console origin when the API shareLink
 * points at the wrong host (common local misconfig: localhost:3000).
 *
 * @param {{ slug?: string, shareLink?: string } | null | undefined} job
 * @returns {string}
 */
export function getPublicApplyUrl(job) {
  if (!job?.slug) {
    return job?.shareLink || '';
  }

  const shareLink = job.shareLink || '';
  const localApplyUrl = `${window.location.origin}/j/${job.slug}`;

  if (!shareLink) {
    return localApplyUrl;
  }

  try {
    const parsed = new URL(shareLink);
    const isLocalApiHost =
      parsed.hostname === 'localhost' && parsed.port === '3000';

    if (isLocalApiHost) {
      return localApplyUrl;
    }
  } catch {
    return localApplyUrl;
  }

  return shareLink;
}
