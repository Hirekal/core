import Input from '../common/Input';
import Toggle from '../common/Toggle';
import Table from '../common/Table';
import Badge from '../common/Badge';
import Card from '../common/Card';
import { formatDateTime } from '../../utils/formatDate';

export default function WebhookForm({ settings, onChange }) {
  const webhook = settings.webhook || {};

  const update = (field, value) => {
    onChange({ ...settings, webhook: { ...webhook, [field]: value } });
  };

  const updateTrigger = (field, value) => {
    onChange({
      ...settings,
      webhook: { ...webhook, triggers: { ...webhook.triggers, [field]: value } },
    });
  };

  const logColumns = [
    { key: 'event', label: 'Event' },
    { key: 'status', label: 'Status', render: (row) => <Badge status={row.status === 'success' ? 'success' : 'failed'}>{row.status}</Badge> },
    { key: 'responseCode', label: 'Response' },
    { key: 'timestamp', label: 'Timestamp', render: (row) => formatDateTime(row.timestamp) },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <h3 className="text-lg font-semibold mb-4">Webhook Configuration</h3>
        <Input
          label="Webhook URL"
          value={webhook.url || ''}
          onChange={(e) => update('url', e.target.value)}
          placeholder="https://your-api.com/webhook"
        />

        <div className="mt-4">
          <p className="text-sm font-medium text-heading mb-3">Trigger Events</p>
          <div className="space-y-3">
            <Toggle
              label="New Application"
              checked={webhook.triggers?.newApplication ?? false}
              onChange={(v) => updateTrigger('newApplication', v)}
            />
            <Toggle
              label="Stage Change"
              checked={webhook.triggers?.stageChange ?? false}
              onChange={(v) => updateTrigger('stageChange', v)}
            />
          </div>
        </div>

        <div className="mt-4">
          <p className="text-sm font-medium text-heading mb-3">Payload Options</p>
          <div className="space-y-3">
            <Toggle label="Include answers" checked={webhook.includeAnswers ?? true} onChange={(v) => update('includeAnswers', v)} />
            <Toggle label="Include video URLs" checked={webhook.includeVideoUrls ?? true} onChange={(v) => update('includeVideoUrls', v)} />
            <Toggle label="Include AI transcripts" checked={webhook.includeAiTranscripts ?? false} onChange={(v) => update('includeAiTranscripts', v)} />
          </div>
        </div>
      </Card>

      <Card padding={false}>
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-lg font-semibold">Webhook Logs</h3>
        </div>
        <Table columns={logColumns} data={webhook.logs || []} emptyMessage="No webhook logs yet" />
      </Card>
    </div>
  );
}
