import Input from '../common/Input';
import Toggle from '../common/Toggle';
import Card from '../common/Card';
import IntroMediaPicker from '../common/IntroMediaPicker';
import { isVideoMedia } from '../../utils/mediaHelpers';

function getPreviewMedia(social, job) {
  if (social.previewImage?.url) return social.previewImage;
  if (job?.introMedia?.url) return job.introMedia;
  return null;
}

function getPreviewTitle(social, job) {
  return social.siteTitle?.trim() || job?.title || 'Job Title';
}

function getPreviewDescription(social, job) {
  if (social.metaDescription?.trim()) return social.metaDescription.trim();
  const parts = [job?.company, job?.location, job?.employmentType].filter(Boolean);
  return parts.join(' · ') || 'Meta description will appear here...';
}

export default function GeneralSettingsForm({ settings, onChange, job }) {
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
  const previewMedia = getPreviewMedia(social, job);
  const previewTitle = getPreviewTitle(social, job);
  const previewDescription = getPreviewDescription(social, job);
  const usingJobImage = !social.previewImage?.url && Boolean(job?.introMedia?.url);

  const previewImageValue = social.previewImage?.url
    ? {
        type: social.previewImage.type || 'image',
        url: social.previewImage.url,
        fileName: social.previewImage.fileName,
      }
    : null;

  const handlePreviewImageChange = (media) => {
    onChange({
      ...settings,
      general: {
        ...settings.general,
        socialPreview: {
          ...settings.general.socialPreview,
          previewImage: media
            ? {
                type: media.type || 'image',
                url: media.url,
                fileName: media.fileName || null,
              }
            : null,
        },
      },
    });
  };

  return (
    <div className="space-y-6">
      <Card className="!p-0 overflow-hidden shadow-sm">
        <div className="border-b border-border bg-hover/40 px-6 py-4">
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
        <div className="border-b border-border bg-hover/40 px-6 py-4">
          <h3 className="text-lg font-semibold text-heading">Social Preview</h3>
          <p className="text-sm text-muted mt-0.5">How your job appears when shared on social media</p>
        </div>
        <div className="p-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <Input
                label="Site Title"
                value={social.siteTitle || ''}
                onChange={(e) => updateSocial('siteTitle', e.target.value)}
                placeholder={job?.title || 'Job title'}
              />
              <Input
                label="Meta Description"
                value={social.metaDescription || ''}
                onChange={(e) => updateSocial('metaDescription', e.target.value)}
                placeholder={getPreviewDescription({ metaDescription: '' }, job)}
              />
              <IntroMediaPicker
                value={previewImageValue}
                onChange={handlePreviewImageChange}
                label="Preview Image"
                emptyTitle="Add a social preview image"
                emptyDescription="Uses your job intro image by default if none is uploaded"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-heading mb-2">Live Preview</p>
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="relative h-40 bg-hover">
                  {previewMedia ? (
                    isVideoMedia(previewMedia) ? (
                      <video
                        src={previewMedia.url}
                        muted
                        playsInline
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <img
                        src={previewMedia.url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted">
                      No image
                    </div>
                  )}
                </div>
                <div className="border-t border-border p-4">
                  <p className="truncate text-sm font-semibold text-heading">{previewTitle}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted">{previewDescription}</p>
                </div>
              </div>
              {usingJobImage && (
                <p className="mt-2 text-xs text-muted">Using your job intro image</p>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
