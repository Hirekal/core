import { useOutletContext, useSearchParams } from 'react-router-dom';
import CustomStagesForm from '../../components/settings/CustomStagesForm';
import { resolveJobStages } from '../../utils/stages';

export default function JobSettingsStagesPage() {
  const { settings, setSettings } = useOutletContext();
  const [searchParams] = useSearchParams();
  const openAddOnMount = searchParams.get('add') === '1';
  const stages = resolveJobStages(settings.customStages);

  return (
    <CustomStagesForm
      stages={stages}
      onChange={(nextStages) => setSettings({ ...settings, customStages: nextStages })}
      openAddOnMount={openAddOnMount}
    />
  );
}
