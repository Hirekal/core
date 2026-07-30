import { createContext, useContext, useState, useCallback } from 'react';
import * as jobService from '../services/jobService';

const JobContext = createContext(null);

export function JobProvider({ children }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchJobs = useCallback(async (filters = {}) => {
    setLoading(true);
    try {
      const data = await jobService.getJobs(filters);
      setJobs(data);
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshJob = useCallback(async (id) => {
    const job = await jobService.getJobById(id);
    if (job) {
      setJobs((prev) => prev.map((j) => (j.id === id ? job : j)));
    }
    return job;
  }, []);

  return (
    <JobContext.Provider value={{ jobs, loading, fetchJobs, refreshJob, setJobs }}>
      {children}
    </JobContext.Provider>
  );
}

export function useJobs() {
  const context = useContext(JobContext);
  if (!context) throw new Error('useJobs must be used within JobProvider');
  return context;
}

export default JobContext;
