import { dummyJobs } from '../data/dummyJobs';
import {
  persistIntroMediaForJob,
  resolveJobMedia,
  copyIntroMedia,
  deleteIntroMedia,
  isLocalMediaUrl,
} from '../utils/jobMediaStorage';

const STORAGE_KEY = 'hirekal_jobs';
const PREVIEW_PREFIX = 'hirekal_preview_';

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

function sanitizeJobForStorage(job) {
  const copy = { ...job };
  if (copy.introMedia?.url && isLocalMediaUrl(copy.introMedia.url)) {
    const { url, ...rest } = copy.introMedia;
    copy.introMedia = rest.storageKey ? rest : null;
  }
  return copy;
}

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(sanitizeJobForStorage);
      }
    }
  } catch {
    // ignore corrupt storage
  }
  return [...dummyJobs];
}

function writeStore() {
  const payload = jobsStore.map(sanitizeJobForStorage);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore quota errors — IndexedDB holds media
  }
}

let jobsStore = readStore();

export async function cacheJobForPreview(job) {
  if (!job?.id) return;
  const resolved = await resolveJobMedia(job);
  try {
    localStorage.setItem(`${PREVIEW_PREFIX}${job.id}`, JSON.stringify(sanitizeJobForStorage(resolved)));
  } catch {
    // ignore
  }
}

export async function getJobForPreview(id) {
  await delay(100);
  let job = null;
  try {
    const cached = localStorage.getItem(`${PREVIEW_PREFIX}${id}`);
    if (cached) {
      job = JSON.parse(cached);
    }
  } catch {
    // ignore
  }
  if (!job) {
    job = jobsStore.find((j) => j.id === id) || null;
  }
  return resolveJobMedia(job);
}

export async function getJobs(filters = {}) {
  await delay();
  let result = [...jobsStore];

  if (filters.status && filters.status !== 'all') {
    result = result.filter((j) => j.status === filters.status);
  }

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (j) =>
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q)
    );
  }

  if (filters.sortBy) {
    result.sort((a, b) => {
      switch (filters.sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'applications':
          return b.applicationCount - a.applicationCount;
        case 'created':
          return new Date(b.createdAt) - new Date(a.createdAt);
        case 'updated':
        default:
          return new Date(b.updatedAt) - new Date(a.updatedAt);
      }
    });
  }

  return result;
}

export async function getJobById(id) {
  await delay();
  const job = jobsStore.find((j) => j.id === id) || null;
  return resolveJobMedia(job);
}

export async function createJob(jobData) {
  await delay(500);
  const id = `job-${Date.now()}`;
  const introMedia = jobData.introMedia
    ? await persistIntroMediaForJob(id, jobData.introMedia, null)
    : null;

  const newJob = {
    ...jobData,
    introMedia,
    id,
    applicationCount: 0,
    visitorCount: 0,
    viewers: 0,
    applicationsStarted: 0,
    applicationsSubmitted: 0,
    shareLink: `https://apply.hirekal.io/j/${jobData.title.toLowerCase().replace(/\s+/g, '-')}`,
    status: jobData.status || 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  jobsStore = [newJob, ...jobsStore];
  writeStore();
  return resolveJobMedia(newJob);
}

export async function updateJob(id, jobData) {
  await delay(500);
  const index = jobsStore.findIndex((j) => j.id === id);
  if (index === -1) return null;

  const previousIntro = jobsStore[index].introMedia;
  const introMedia = jobData.introMedia !== undefined
    ? await persistIntroMediaForJob(id, jobData.introMedia, previousIntro)
    : previousIntro;

  jobsStore[index] = {
    ...jobsStore[index],
    ...jobData,
    introMedia,
    updatedAt: new Date().toISOString(),
  };
  writeStore();
  return resolveJobMedia(jobsStore[index]);
}

export async function duplicateJob(id) {
  await delay(500);
  const original = jobsStore.find((j) => j.id === id);
  if (!original) return null;
  const newId = `job-${Date.now()}`;

  let introMedia = original.introMedia;
  if (original.introMedia?.storageKey) {
    introMedia = await copyIntroMedia(id, newId);
  } else if (original.introMedia) {
    introMedia = { ...original.introMedia };
  }

  const duplicate = {
    ...JSON.parse(JSON.stringify({ ...original, introMedia })),
    id: newId,
    title: `${original.title} (Copy)`,
    applicationCount: 0,
    visitorCount: 0,
    viewers: 0,
    applicationsStarted: 0,
    applicationsSubmitted: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (duplicate.introMedia?.url && isLocalMediaUrl(duplicate.introMedia.url)) {
    delete duplicate.introMedia.url;
  }
  jobsStore = [duplicate, ...jobsStore];
  writeStore();
  return resolveJobMedia(duplicate);
}

export async function updateJobSettings(id, settings) {
  await delay(400);
  const index = jobsStore.findIndex((j) => j.id === id);
  if (index === -1) return null;
  jobsStore[index] = {
    ...jobsStore[index],
    settings: { ...jobsStore[index].settings, ...settings },
    updatedAt: new Date().toISOString(),
  };
  writeStore();
  return jobsStore[index];
}

export async function exportApplicationsCsv(jobId) {
  await delay(800);
  return { success: true, filename: `applications-${jobId}.csv` };
}

export async function deleteJob(id) {
  await delay(400);
  const job = jobsStore.find((j) => j.id === id);
  if (!job) return { success: false };
  if (job.introMedia?.storageKey) {
    await deleteIntroMedia(job.introMedia.storageKey);
  }
  jobsStore = jobsStore.filter((j) => j.id !== id);
  writeStore();
  try {
    localStorage.removeItem(`${PREVIEW_PREFIX}${id}`);
  } catch {
    // ignore
  }
  return { success: true };
}

export async function archiveJob(id) {
  await delay(400);
  const index = jobsStore.findIndex((j) => j.id === id);
  if (index === -1) return null;
  jobsStore[index] = {
    ...jobsStore[index],
    status: 'archived',
    updatedAt: new Date().toISOString(),
  };
  writeStore();
  return jobsStore[index];
}

export async function restoreJob(id) {
  await delay(400);
  const index = jobsStore.findIndex((j) => j.id === id);
  if (index === -1) return null;
  jobsStore[index] = {
    ...jobsStore[index],
    status: 'active',
    updatedAt: new Date().toISOString(),
  };
  writeStore();
  return jobsStore[index];
}
