import Input from '../common/Input';
import Card from '../common/Card';
import IntroMediaPicker from '../common/IntroMediaPicker';

export default function ThankYouPageForm({ settings, onChange }) {
  const thankYou = settings.thankYouPage || {};

  const update = (field, value) => {
    onChange({ ...settings, thankYouPage: { ...thankYou, [field]: value } });
  };

  const mediaValue = thankYou.mediaUrl
    ? {
        type: thankYou.mediaType || 'image',
        url: thankYou.mediaUrl,
        fileName: thankYou.fileName,
      }
    : null;

  const handleMediaChange = (media) => {
    onChange({
      ...settings,
      thankYouPage: {
        ...thankYou,
        mediaType: media?.type || null,
        mediaUrl: media?.url || null,
        fileName: media?.fileName || null,
      },
    });
  };

  return (
    <Card className="!p-0 overflow-hidden shadow-sm">
      <div className="border-b border-border bg-gray-50/60 px-6 py-4">
        <h3 className="text-lg font-semibold text-heading">Thank You Page</h3>
        <p className="text-sm text-muted mt-0.5">Media and message shown after candidates submit</p>
      </div>

      <div className="p-6 space-y-6">
        <IntroMediaPicker
          value={mediaValue}
          onChange={handleMediaChange}
          label="Media"
          emptyTitle="Add a thank you image or video"
          emptyDescription="Show a personal message or welcome clip after submission"
        />

        <div>
          <label className="text-sm font-medium text-heading mb-2 block">Description</label>
          <textarea
            value={thankYou.description?.replace(/<[^>]+>/g, '') || ''}
            onChange={(e) => update('description', `<p>${e.target.value}</p>`)}
            rows={4}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            placeholder="Thank you message for candidates..."
          />
        </div>

        <Input
          label="Auto-redirect URL"
          value={thankYou.autoRedirectUrl || ''}
          onChange={(e) => update('autoRedirectUrl', e.target.value)}
          placeholder="https://yourcompany.com/careers"
        />
      </div>
    </Card>
  );
}
