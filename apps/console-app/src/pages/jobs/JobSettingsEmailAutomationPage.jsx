import { useOutletContext } from 'react-router-dom';
import EmailAutomationForm from '../../components/settings/EmailAutomationForm';

export default function JobSettingsEmailAutomationPage() {
  const { settings, setSettings } = useOutletContext();
  return <EmailAutomationForm settings={settings} onChange={setSettings} />;
}
