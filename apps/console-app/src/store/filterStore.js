import { create } from 'zustand';

export const useFilterStore = create((set) => ({
  jobStatus: 'all',
  jobSearch: '',
  jobSortBy: 'updated',
  jobViewMode: 'grid',
  setJobStatus: (status) => set({ jobStatus: status }),
  setJobSearch: (search) => set({ jobSearch: search }),
  setJobSortBy: (sortBy) => set({ jobSortBy: sortBy }),
  setJobViewMode: (viewMode) => set({ jobViewMode: viewMode }),

  candidateSearch: '',
  candidateSortBy: 'submitted',
  setCandidateSearch: (search) => set({ candidateSearch: search }),
  setCandidateSortBy: (sortBy) => set({ candidateSortBy: sortBy }),
}));
