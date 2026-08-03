import {
  Webhook,
  UserPlus,
  ArrowRightLeft,
  FileText,
  Video,
  Sparkles,
  Activity,
  Link2,
  CheckCircle2,
  AlertCircle,
  Inbox,
} from 'lucide-react';
import Button from '../common/Button';
import Input from '../common/Input';
import Badge from '../common/Badge';
import Card from '../common/Card';
import Table from '../common/Table';
import { formatDateTime } from '../../utils/formatDate';

function SectionHeader({ icon: Icon, title, description }) {
  return (
    <div className="border-b border-border bg-hover/40 px-6 py-4">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-accent/10 p-2.5 text-accent">
          <Icon size={20} strokeWidth={2} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-heading">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
      </div>
    </div>
  );
}

function OptionCard({ icon: Icon, title, description, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`group w-full rounded-xl border p-4 text-left transition-all duration-200 ${
        checked
          ? 'border-accent/35 bg-accent/[0.06] shadow-sm ring-1 ring-accent/15'
          : 'border-border/80 bg-card hover:border-accent/20 hover:bg-hover/50'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={`shrink-0 rounded-lg p-2 transition-colors ${
              checked ? 'bg-accent/15 text-accent' : 'bg-hover text-muted group-hover:text-heading'
            }`}
          >
            <Icon size={18} strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-heading">{title}</p>
            {description && <p className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p>}
          </div>
        </div>
        <span
          className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
            checked ? 'bg-accent' : 'bg-border'
          }`}
          aria-hidden
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${
              checked ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </span>
      </div>
    </button>
  );
}

export default function WebhookForm({
  settings,
  onChange,
  logs = [],
  logsLoading = false,
  logsError = '',
  onRefreshLogs,
}) {
  const webhook = settings.webhook || {};
  const hasUrl = Boolean(webhook.url?.trim());
  const activeTriggers = [
    webhook.triggers?.newApplication,
    webhook.triggers?.stageChange,
  ].filter(Boolean).length;

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
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <Badge
          status={
            row.status === 'success'
              ? 'success'
              : row.status === 'pending'
                ? 'warning'
                : 'failed'
          }
        >
          {row.status}
        </Badge>
      ),
    },
    { key: 'responseCode', label: 'Response' },
    { key: 'timestamp', label: 'Timestamp', render: (row) => formatDateTime(row.timestamp) },
  ];

  return (
    <div className="space-y-6">
      <Card className="!p-0 overflow-hidden shadow-sm">
        <SectionHeader
          icon={Webhook}
          title="Webhook Endpoint"
          description="Send real-time application events to your external system"
        />
        <div className="space-y-5 p-6">
          {hasUrl && (
            <div className="flex items-center gap-2 rounded-xl border border-green-200/80 bg-green-50/80 px-4 py-3 text-sm text-green-800">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>Endpoint configured — events will POST to your URL when triggers are enabled</span>
            </div>
          )}

          <div className="rounded-xl border border-border/80 bg-gray-50/40 p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-heading">
              <Link2 size={16} className="text-accent" />
              Webhook URL
            </div>
            <p className="mt-1 text-xs text-muted">
              Your server must accept POST requests with a JSON payload
            </p>
            <div className="mt-4">
              <Input
                value={webhook.url || ''}
                onChange={(e) => update('url', e.target.value)}
                placeholder="https://your-api.com/webhook"
                containerClassName="mb-0"
              />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="!p-0 overflow-hidden shadow-sm">
          <SectionHeader
            icon={Activity}
            title="Trigger Events"
            description={`${activeTriggers} of 2 events enabled`}
          />
          <div className="space-y-3 p-6">
            <OptionCard
              icon={UserPlus}
              title="New Application"
              description="Fires when a candidate submits their application"
              checked={webhook.triggers?.newApplication ?? false}
              onChange={(v) => updateTrigger('newApplication', v)}
            />
            <OptionCard
              icon={ArrowRightLeft}
              title="Stage Change"
              description="Fires when a candidate is moved to a different pipeline stage"
              checked={webhook.triggers?.stageChange ?? false}
              onChange={(v) => updateTrigger('stageChange', v)}
            />
          </div>
        </Card>

        <Card className="!p-0 overflow-hidden shadow-sm">
          <SectionHeader
            icon={FileText}
            title="Payload Options"
            description="Choose what data to include in each webhook request"
          />
          <div className="space-y-3 p-6">
            <OptionCard
              icon={FileText}
              title="Include answers"
              description="Question responses and form field values"
              checked={webhook.includeAnswers ?? true}
              onChange={(v) => update('includeAnswers', v)}
            />
            <OptionCard
              icon={Video}
              title="Include video URLs"
              description="Direct links to recorded video responses"
              checked={webhook.includeVideoUrls ?? true}
              onChange={(v) => update('includeVideoUrls', v)}
            />
            <OptionCard
              icon={Sparkles}
              title="Include AI transcripts"
              description="Transcribed text from video answers"
              checked={webhook.includeAiTranscripts ?? false}
              onChange={(v) => update('includeAiTranscripts', v)}
            />
          </div>
        </Card>
      </div>

      <Card className="!p-0 overflow-hidden shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-hover/40 px-6 py-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-accent/10 p-2.5 text-accent">
              <Activity size={20} strokeWidth={2} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-heading">Delivery Logs</h3>
              <p className="mt-0.5 text-sm text-muted">Recent webhook delivery attempts for this job</p>
            </div>
          </div>
          {logs.length > 0 && (
            <span className="rounded-full bg-hover px-3 py-1 text-xs font-medium text-muted">
              {logs.length} {logs.length === 1 ? 'entry' : 'entries'}
            </span>
          )}
          {onRefreshLogs && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onRefreshLogs}
              disabled={logsLoading}
            >
              {logsLoading ? 'Refreshing...' : 'Refresh'}
            </Button>
          )}
        </div>
        <div className="px-6 pb-6">
          {logsLoading ? (
            <Table columns={logColumns} data={[]} loading />
          ) : logsError ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="mb-3 rounded-full bg-amber-50 p-3 text-amber-700">
                <AlertCircle size={22} strokeWidth={1.75} />
              </div>
              <p className="text-sm font-medium text-heading">Could not load delivery logs</p>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-muted">{logsError}</p>
              {onRefreshLogs && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-4"
                  onClick={onRefreshLogs}
                >
                  Try again
                </Button>
              )}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted">
              <div className="mb-3 rounded-full bg-hover p-3">
                <Inbox size={22} strokeWidth={1.75} />
              </div>
              <p className="text-sm font-medium text-heading">No webhook deliveries yet</p>
              <p className="mt-1 max-w-sm text-xs leading-relaxed">
                {hasUrl && activeTriggers > 0
                  ? 'Nothing has been sent to your webhook URL for this job yet. Logs appear here after a candidate applies or a stage changes.'
                  : 'Set your webhook URL, enable at least one trigger, and save changes. Delivery attempts will show up here.'}
              </p>
            </div>
          ) : (
            <Table columns={logColumns} data={logs} />
          )}
        </div>
      </Card>
    </div>
  );
}
