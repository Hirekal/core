import { useOutletContext } from 'react-router-dom';
import CustomStagesForm from '../../components/settings/CustomStagesForm';

export default function JobSettingsStagesPage() {
  const { settings, setSettings } = useOutletContext();
  return (
    <CustomStagesForm
      stages={settings.customStages || []}
      onChange={(stages) => setSettings({ ...settings, customStages: stages })}
    />
  );
}
