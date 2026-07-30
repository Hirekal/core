import { useOutletContext } from 'react-router-dom';
import GeneralSettingsForm from '../../components/settings/GeneralSettingsForm';

export default function JobSettingsGeneralPage() {
  const { settings, setSettings, job } = useOutletContext();
  return <GeneralSettingsForm settings={settings} onChange={setSettings} job={job} />;
}
