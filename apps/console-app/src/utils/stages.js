/** Core pipeline stages every job starts with */
export const DEFAULT_PIPELINE_STAGES = [
  { id: 'stage-1', name: 'In Progress', slug: 'in-progress', order: 1, active: true, isDefault: true },
  { id: 'stage-2', name: 'To Be Reviewed', slug: 'to-be-reviewed', order: 2, active: true, isDefault: true },
  { id: 'stage-4', name: 'Shortlisted', slug: 'shortlisted', order: 3, active: true, isDefault: true },
  { id: 'stage-5', name: 'Rejected', slug: 'rejected', order: 4, active: true, isDefault: true },
];

/** Full catalog for global candidate views (includes optional stages) */
export const dummyStages = [
  ...DEFAULT_PIPELINE_STAGES,
  { id: 'stage-7', name: 'Disqualified', slug: 'disqualified', order: 5, active: true, isDefault: false },
  { id: 'stage-6', name: 'Technical Interview', slug: 'technical-interview', order: 6, active: true, isDefault: false },
];

export function getActivePipelineStages(stages) {
  return [...(stages || DEFAULT_PIPELINE_STAGES)]
    .filter((s) => s.active)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function resolveJobStages(customStages) {
  if (customStages?.length) {
    return customStages.map((stage) => ({
      ...stage,
      order: stage.order ?? stage.sortOrder ?? 0,
      active: stage.active !== false,
    }));
  }
  return DEFAULT_PIPELINE_STAGES;
}
