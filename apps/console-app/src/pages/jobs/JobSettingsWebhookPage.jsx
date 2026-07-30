import { useOutletContext } from 'react-router-dom';
import WebhookForm from '../../components/settings/WebhookForm';

export default function JobSettingsWebhookPage() {
  const { settings, setSettings } = useOutletContext();
  return <WebhookForm settings={settings} onChange={setSettings} />;
}
