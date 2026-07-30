import Input from '../common/Input';
import Toggle from '../common/Toggle';
import Card from '../common/Card';

export default function GeneralSettingsForm({ settings, onChange }) {
  const update = (field, value) => {
    onChange({ ...settings, general: { ...settings.general, [field]: value } });
  };

  const updateSocial = (field, value) => {
    onChange({
      ...settings,
      general: {
        ...settings.general,
        socialPreview: { ...settings.general.socialPreview, [field]: value },
      },
    });
  };

  const social = settings.general?.socialPreview || {};

  return (
    <div className="space-y-6">
      <Card className="!p-0 overflow-hidden shadow-sm">
        <div className="border-b border-border bg-gray-50/60 px-6 py-4">
          <h3 className="text-lg font-semibold text-heading">Form Labels</h3>
          <p className="text-sm text-muted mt-0.5">Customize labels shown to candidates</p>
        </div>
        <div className="p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Application Form Label"
              value={settings.general?.applicationFormLabel || ''}
              onChange={(e) => update('applicationFormLabel', e.target.value)}
            />
            <Input
              label="Instructions Label"
              value={settings.general?.instructionsLabel || ''}
              onChange={(e) => update('instructionsLabel', e.target.value)}
            />
          </div>
          <div className="mt-5 rounded-xl border border-border bg-gray-50/40 p-4">
            <Toggle
              label="Show questions in advance"
              description="Allow candidates to see questions before starting"
              checked={settings.general?.showQuestionsInAdvance ?? true}
              onChange={(v) => update('showQuestionsInAdvance', v)}
            />
          </div>
        </div>
      </Card>

      <Card className="!p-0 overflow-hidden shadow-sm">
        <div className="border-b border-border bg-gray-50/60 px-6 py-4">
          <h3 className="text-lg font-semibold text-heading">Social Preview</h3>
          <p className="text-sm text-muted mt-0.5">How your job appears when shared on social media</p>
        </div>
        <div className="p-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <Input label="Site Title" value={social.siteTitle || ''} onChange={(e) => updateSocial('siteTitle', e.target.value)} />
              <Input label="Meta Description" value={social.metaDescription || ''} onChange={(e) => updateSocial('metaDescription', e.target.value)} />
              <div>
                <label className="text-sm font-medium text-heading mb-2 block">Preview Image</label>
                <div className="rounded-xl border border-dashed border-accent/25 bg-gradient-to-br from-rose-50/60 to-white p-6 text-center text-sm text-muted cursor-pointer hover:border-accent/40 transition-colors">
                  Click to upload preview image
                </div>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-heading mb-2">Live Preview</p>
              <div className="rounded-xl border border-border overflow-hidden shadow-sm">
                <div className="h-36 bg-gray-100 flex items-center justify-center text-muted text-sm">
                  {social.previewImage ? 'Image preview' : 'No image'}
                </div>
                <div className="p-4 bg-white">
                  <p className="text-sm font-medium truncate">{social.siteTitle || 'Job Title'}</p>
                  <p className="text-xs text-muted mt-1 line-clamp-2">{social.metaDescription || 'Meta description will appear here...'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
