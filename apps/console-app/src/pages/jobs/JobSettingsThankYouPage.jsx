import { useOutletContext } from 'react-router-dom';
import ThankYouPageForm from '../../components/settings/ThankYouPageForm';

export default function JobSettingsThankYouPage() {
  const { settings, setSettings } = useOutletContext();
  return <ThankYouPageForm settings={settings} onChange={setSettings} />;
}
