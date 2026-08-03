import { useCallback, useEffect, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import WebhookForm from '../../components/settings/WebhookForm';
import * as jobService from '../../services/jobService';

export default function JobSettingsWebhookPage() {
  const { id } = useParams();
  const { settings, setSettings } = useOutletContext();
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState('');

  const loadLogs = useCallback(() => {
    setLogsLoading(true);
    setLogsError('');

    return jobService
      .getWebhookLogs(id)
      .then((data) => {
        setLogs(data);
      })
      .catch((err) => {
        setLogs([]);
        setLogsError(err.message || 'Unable to load delivery logs.');
      })
      .finally(() => {
        setLogsLoading(false);
      });
  }, [id]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <WebhookForm
      settings={settings}
      onChange={setSettings}
      logs={logs}
      logsLoading={logsLoading}
      logsError={logsError}
      onRefreshLogs={loadLogs}
    />
  );
}
