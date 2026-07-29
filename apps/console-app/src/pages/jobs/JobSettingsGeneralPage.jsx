import { useOutletContext } from 'react-router-dom';
import GeneralSettingsForm from '../../components/settings/GeneralSettingsForm';

export default function JobSettingsGeneralPage() {
  const { settings, setSettings } = useOutletContext();
  return <GeneralSettingsForm settings={settings} onChange={setSettings} />;
}
