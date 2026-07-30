import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import CandidateCard from '../../components/candidates/CandidateCard';
import CandidateDrawer from '../../components/candidates/CandidateDrawer';
import EmptyState from '../../components/common/EmptyState';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { SelectDropdown } from '../../components/common/Dropdown';
import { useFilterStore } from '../../store/filterStore';
import * as candidateService from '../../services/candidateService';
import * as jobService from '../../services/jobService';

export default function CandidateListPage() {
  const { candidateSearch, candidateSortBy, setCandidateSearch, setCandidateSortBy } = useFilterStore();
  const [candidates, setCandidates] = useState([]);
  const [stages, setStages] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const [candidatesData, stagesData, jobsData] = await Promise.all([
      candidateService.getCandidates({ search: candidateSearch, sortBy: candidateSortBy }),
      candidateService.getStages(),
      jobService.getJobs(),
    ]);
    setCandidates(candidatesData);
    setStages(stagesData);
    setJobs(jobsData);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [candidateSearch, candidateSortBy]);

  const getStageName = (stageId) => stages.find((s) => s.id === stageId)?.name || 'Unknown';
  const getJobTitle = (jobId) => jobs.find((j) => j.id === jobId)?.title || 'Unknown Job';

  const handleStageChange = async (stageId) => {
    if (!selectedCandidate) return;
    await candidateService.updateCandidateStage(selectedCandidate.id, stageId);
    const updated = await candidateService.getCandidateById(selectedCandidate.id);
    setSelectedCandidate(updated);
    loadData();
  };

  const handleRatingChange = async (rating) => {
    if (!selectedCandidate) return;
    await candidateService.updateCandidateRating(selectedCandidate.id, rating);
    const updated = await candidateService.getCandidateById(selectedCandidate.id);
    setSelectedCandidate(updated);
  };

  const handleAddNote = async (text) => {
    if (!selectedCandidate) return;
    await candidateService.addCandidateNote(selectedCandidate.id, { text, author: 'Sarah Chen' });
    const updated = await candidateService.getCandidateById(selectedCandidate.id);
    setSelectedCandidate(updated);
  };

  const handleDelete = async (candidateId) => {
    await candidateService.deleteCandidate(candidateId);
    setSelectedCandidate(null);
    loadData();
  };

  return (
    <div>
      <PageHeader title="Candidates" description="Review and manage candidate applications" />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Search candidates..."
            value={candidateSearch}
            onChange={(e) => setCandidateSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-input py-2 pl-9 pr-3 text-sm text-heading placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>
        <SelectDropdown
          size="sm"
          value={candidateSortBy}
          onChange={setCandidateSortBy}
          placeholder="Sort by"
          options={[
            { value: 'submitted', label: 'Submission Date' },
            { value: 'name', label: 'Name A-Z' },
            { value: 'stage', label: 'Stage' },
          ]}
          className="w-44"
        />
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : candidates.length === 0 ? (
        <EmptyState title="No candidates found" description="Candidates will appear here once they submit applications." />
      ) : (
        <div className="space-y-3">
          {candidates.map((candidate) => (
            <div key={candidate.id}>
              <p className="text-xs text-muted mb-1 ml-1">{getJobTitle(candidate.jobId)}</p>
              <CandidateCard
                candidate={candidate}
                stageName={getStageName(candidate.stageId)}
                onClick={setSelectedCandidate}
              />
            </div>
          ))}
        </div>
      )}

      <CandidateDrawer
        candidate={selectedCandidate}
        stages={stages}
        onClose={() => setSelectedCandidate(null)}
        onStageChange={handleStageChange}
        onRatingChange={handleRatingChange}
        onAddNote={handleAddNote}
        onDelete={handleDelete}
      />
    </div>
  );
}
