import Tabs from '../common/Tabs';

export default function StageTabs({ stages, activeStage, onChange, counts = {} }) {
  const tabs = stages.map((s) => ({
    id: s.id,
    label: s.name,
    count: counts[s.id] || 0,
  }));

  return (
    <Tabs tabs={tabs} activeTab={activeStage} onChange={onChange} className="mb-6" />
  );
}
