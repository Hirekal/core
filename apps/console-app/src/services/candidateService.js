import { dummyCandidates } from '../data/dummyCandidates';
import { dummyStages } from '../data/dummyStages';
import { getActivePipelineStages, resolveJobStages } from '../utils/stages';
import * as jobService from './jobService';

const delay = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));

let candidatesStore = [...dummyCandidates];
let stagesStore = [...dummyStages];

export async function getCandidates(filters = {}) {
  await delay();
  let result = [...candidatesStore];

  if (filters.jobId) {
    result = result.filter((c) => c.jobId === filters.jobId);
  }

  if (filters.stageId) {
    result = result.filter((c) => c.stageId === filters.stageId);
  }

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (c) =>
        c.firstName.toLowerCase().includes(q) ||
        c.lastName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
    );
  }

  if (filters.sortBy) {
    result.sort((a, b) => {
      switch (filters.sortBy) {
        case 'name':
          return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
        case 'stage':
          return (a.stageId || '').localeCompare(b.stageId || '');
        case 'submitted':
        default:
          return new Date(b.submittedAt || b.startedAt || 0) - new Date(a.submittedAt || a.startedAt || 0);
      }
    });
  }

  return result;
}

export async function getCandidateById(id) {
  await delay();
  return candidatesStore.find((c) => c.id === id) || null;
}

export async function updateCandidateStage(id, stageId) {
  await delay(400);
  const index = candidatesStore.findIndex((c) => c.id === id);
  if (index === -1) return null;
  candidatesStore[index] = { ...candidatesStore[index], stageId };
  return candidatesStore[index];
}

export async function updateCandidateRating(id, rating) {
  await delay(200);
  const index = candidatesStore.findIndex((c) => c.id === id);
  if (index === -1) return null;
  candidatesStore[index] = { ...candidatesStore[index], rating };
  return candidatesStore[index];
}

export async function addCandidateNote(id, note) {
  await delay(300);
  const index = candidatesStore.findIndex((c) => c.id === id);
  if (index === -1) return null;
  const newNote = {
    id: `note-${Date.now()}`,
    ...note,
    createdAt: new Date().toISOString(),
  };
  candidatesStore[index] = {
    ...candidatesStore[index],
    notes: [...(candidatesStore[index].notes || []), newNote],
  };
  return candidatesStore[index];
}

export async function deleteCandidate(id) {
  await delay(400);
  candidatesStore = candidatesStore.filter((c) => c.id !== id);
  return { success: true };
}

export async function getStages(jobId) {
  await delay();
  if (jobId) {
    const job = await jobService.getJobById(jobId);
    return getActivePipelineStages(resolveJobStages(job?.settings?.customStages));
  }
  return getActivePipelineStages(stagesStore);
}

export async function updateStages(stages) {
  await delay(400);
  stagesStore = stages;
  return stagesStore;
}

export async function getStageById(id) {
  await delay(100);
  return stagesStore.find((s) => s.id === id) || null;
}
