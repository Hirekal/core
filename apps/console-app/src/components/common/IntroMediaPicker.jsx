import { useRef, useState } from 'react';
import { Image, Upload, Mic, Clapperboard, Trash2, AlertCircle } from 'lucide-react';
import Button from './Button';
import VideoRecorderModal from './VideoRecorderModal';
import {
  IMAGE_ACCEPT,
  VIDEO_ACCEPT,
  validateImageFile,
  validateVideoFile,
  readFileAsDataUrl,
  isVideoMedia,
} from '../../utils/mediaHelpers';

export default function IntroMediaPicker({
  value,
  onChange,
  label = 'Intro Banner / Video',
  emptyTitle = 'Add a welcome video or banner',
  emptyDescription = 'Help candidates understand the role before they apply',
}) {
  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleImageSelect = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      onChange({
        type: 'image',
        url: dataUrl,
        fileName: file.name,
      });
    } catch {
      setError('Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleVideoSelect = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const validationError = validateVideoFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      onChange({
        type: 'video',
        url: dataUrl,
        fileName: file.name,
      });
    } catch {
      setError('Failed to upload video. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleRecorded = (media) => {
    setError(null);
    onChange(media);
  };

  const handleRemove = () => {
    setError(null);
    onChange(null);
  };

  const previewUrl = value?.url;
  const hasMedia = Boolean(previewUrl);

  const actionButtons = (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={uploading}
        onClick={() => imageInputRef.current?.click()}
      >
        <Image size={16} /> {uploading ? 'Uploading...' : 'Upload Image'}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={uploading}
        onClick={() => setRecorderOpen(true)}
      >
        <Mic size={16} /> Record Video
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={uploading}
        onClick={() => videoInputRef.current?.click()}
      >
        <Upload size={16} /> Upload Video
      </Button>
    </div>
  );

  return (
    <div className="mb-8">
      <label className="text-sm font-medium text-heading mb-3 block">{label}</label>

      <input
        ref={imageInputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="hidden"
        onChange={handleImageSelect}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept={VIDEO_ACCEPT}
        className="hidden"
        onChange={handleVideoSelect}
      />

      {hasMedia ? (
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
          <div className="relative bg-gray-950 px-4 py-4 sm:px-6">
            <div className="mx-auto w-full max-w-3xl">
              {isVideoMedia(value) ? (
                <video
                  src={previewUrl}
                  controls
                  playsInline
                  className="block w-full max-h-72 rounded-lg bg-black"
                />
              ) : (
                <img
                  src={previewUrl}
                  alt="Intro media preview"
                  className="block w-full max-h-72 rounded-lg object-contain mx-auto"
                />
              )}
            </div>
            <button
              type="button"
              onClick={handleRemove}
              className="absolute top-3 right-3 rounded-lg bg-white/95 p-2 text-muted shadow-sm ring-1 ring-border hover:text-red-500 transition-colors"
              title="Remove media"
            >
              <Trash2 size={16} />
            </button>
          </div>

          <div className="flex flex-col gap-4 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="min-w-0">
              {value?.fileName && (
                <p className="text-sm font-medium text-heading truncate">{value.fileName}</p>
              )}
              <p className="text-xs text-muted mt-0.5">
                {isVideoMedia(value) ? 'Video intro' : 'Image banner'} · Replace or remove using the buttons
              </p>
            </div>
            {actionButtons}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-accent/25 bg-gradient-to-br from-rose-50/80 via-white to-gray-50 px-6 py-10 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-accent shadow-sm ring-1 ring-accent/10">
            <Clapperboard size={26} />
          </span>
          <p className="text-sm font-medium text-heading">{emptyTitle}</p>
          <p className="text-sm text-muted mt-1 max-w-md mx-auto">{emptyDescription}</p>
          <div className="mt-6 flex justify-center flex-wrap gap-2">{actionButtons}</div>
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <VideoRecorderModal
        isOpen={recorderOpen}
        onClose={() => setRecorderOpen(false)}
        onRecorded={handleRecorded}
        title="Record Intro Video"
      />
    </div>
  );
}
