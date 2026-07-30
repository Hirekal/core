import SidePanel, { SidePanelItem } from '../common/SidePanel';

export default function StageSidebar({ stages, activeStage, onChange, counts = {}, embedded = false }) {
  const allStages = [{ id: 'all', name: 'All Applications' }, ...stages.filter((s) => s.isDefault)];

  return (
    <SidePanel title="Pipeline" subtitle="Filter by stage" embedded={embedded}>
      <div className="space-y-1.5">
        {allStages.map((stage) => {
          const count = counts[stage.id] ?? 0;
          const isActive = activeStage === stage.id;
          return (
            <SidePanelItem
              key={stage.id}
              active={isActive}
              onClick={() => onChange(stage.id)}
              label={stage.name}
              badge={count}
            />
          );
        })}
      </div>
    </SidePanel>
  );
}
