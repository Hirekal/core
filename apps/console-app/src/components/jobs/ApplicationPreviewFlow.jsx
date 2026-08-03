import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  User,
  Mail,
  Phone,
  Link2,
  Calendar,
  Hash,
  Type,
} from 'lucide-react';
import Button from '../common/Button';
import VideoRecorderPanel from '../common/VideoRecorderPanel';
import { isVideoMedia } from '../../utils/mediaHelpers';
import * as applicationService from '../../services/applicationService';
import {
  normalizeApplicationFields,
  normalizeQuestions,
  DEFAULT_APPLICATION_SECTION_TITLE,
  DEFAULT_APPLY_BUTTON_LABEL,
  MEDIA_TYPES,
} from './jobFormUtils';
import {
  canRetakeVideo,
  getRetakeButtonLabel,
  getRetakesRemaining,
} from '../../utils/retakeHelpers';

const CARD_CLASS = 'rounded-2xl border border-border bg-card shadow-sm';
const CONTENT_WIDTH = 'mx-auto w-full max-w-4xl';

function StepLayout({ children }) {
  return (
    <div className="flex min-h-[calc(100dvh-8.5rem)] w-full items-center justify-center py-6 sm:py-8">
      <div className={CONTENT_WIDTH}>{children}</div>
    </div>
  );
}

function StepCard({ title, subtitle, children, badge }) {
  return (
    <section className={`${CARD_CLASS} overflow-hidden`}>
      <div className="border-b border-border bg-accent/[0.04] px-5 py-4 sm:px-6">
        {badge && <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent">{badge}</p>}
        <h2 className="text-base font-semibold text-heading sm:text-lg">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

function ProgressBar({ current, total }) {
  return (
    <div className="mb-5">
      <p className="mb-2 text-center text-sm font-medium text-muted">
        Step {current} of {total}
      </p>
      <div className="mx-auto h-1.5 max-w-md overflow-hidden rounded-full bg-hover">
        <div
          className="h-full rounded-full bg-accent transition-all duration-300"
          style={{ width: `${(current / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

const FIELD_ICONS = {
  firstName: User,
  lastName: User,
  email: Mail,
  phone: Phone,
};

const TYPE_ICONS = {
  email: Mail,
  phone: Phone,
  url: Link2,
  date: Calendar,
  number: Hash,
  text: Type,
};

function validateApplicationField(field, value) {
  const trimmed = String(value ?? '').trim();

  if (field.required && !trimmed) {
    return `Please enter your ${field.label.toLowerCase()}`;
  }

  if (!trimmed) return null;

  if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return 'Please enter valid email address';
  }

  if (field.type === 'phone' && !/^[\d\s+\-()]{7,20}$/.test(trimmed)) {
    return 'Please enter a valid mobile number';
  }

  if (field.type === 'url' && !/^https?:\/\/.+/i.test(trimmed)) {
    return 'Please enter a valid URL';
  }

  return null;
}

function validateStandardQuestion(question, value) {
  const trimmed = String(value ?? '').trim();
  if (question.required && !trimmed) {
    return 'This question is mandatory to proceed';
  }
  if (question.type === 'email' && trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return 'Please enter valid email address';
  }
  return null;
}

export function PublicCareersHeader({ company }) {
  const initial = (company || 'C').charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white shadow-sm">
        {initial}
      </div>
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Careers</span>
    </div>
  );
}

function InstructionText({ text }) {
  const paragraphs = text.includes('\n\n')
    ? text.split('\n\n').map((p) => p.trim()).filter(Boolean)
    : text.split('\n').map((p) => p.trim()).filter(Boolean);

  return (
    <div className="space-y-3 text-sm leading-6 text-muted sm:text-[15px] sm:leading-7">
      {paragraphs.map((paragraph, index) => (
        <p
          key={index}
          className={paragraph.startsWith('Important:') ? 'font-semibold text-heading' : ''}
        >
          {paragraph}
        </p>
      ))}
    </div>
  );
}

function ThankYouScreen({ job, thankYou = {} }) {
  const message =
    thankYou.description?.replace(/<[^>]+>/g, '').trim()
    || 'Thank you for your application! We will review your submission and get back to you soon.';

  return (
    <StepCard
      title="Application submitted!"
      subtitle={`Thank you for applying to ${job.title}${job.company ? ` at ${job.company}` : ''}.`}
    >
      <div className="space-y-5 text-center">
        {thankYou.mediaUrl ? (
          <section className="overflow-hidden rounded-xl border border-border bg-black shadow-md">
            <div className="relative aspect-[16/9] w-full">
              {isVideoMedia({ type: thankYou.mediaType, url: thankYou.mediaUrl }) ? (
                <video
                  src={thankYou.mediaUrl}
                  controls
                  playsInline
                  className="absolute inset-0 h-full w-full object-contain"
                />
              ) : (
                <img
                  src={thankYou.mediaUrl}
                  alt="Thank you"
                  className="absolute inset-0 h-full w-full object-contain"
                />
              )}
            </div>
          </section>
        ) : (
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
            <CheckCircle2 size={32} />
          </span>
        )}

        <p className="text-sm leading-relaxed text-muted">{message}</p>
      </div>
    </StepCard>
  );
}

function getFieldIcon(field) {
  return FIELD_ICONS[field.id] || TYPE_ICONS[field.type] || Type;
}

function getFieldPlaceholder(field) {
  const placeholders = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'you@email.com',
    phone: '+1 (555) 000-0000',
  };
  return placeholders[field.id] || `Enter ${field.label.toLowerCase()}`;
}

function PreviewField({
  field,
  label,
  required,
  type = 'text',
  value,
  onChange,
  error,
  placeholder,
  className = '',
}) {
  const Icon = getFieldIcon(field || { id: '', type });
  const inputType =
    type === 'phone' ? 'tel' : type === 'email' ? 'email' : type === 'number' ? 'number' : type === 'date' ? 'date' : 'text';

  return (
    <div className={`group ${className}`}>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
        {required && <span className="text-accent normal-case tracking-normal"> *</span>}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted transition-colors group-focus-within:text-accent">
          <Icon size={17} strokeWidth={2} />
        </span>
        <input
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-xl border-2 bg-input py-2.5 pl-11 pr-3.5 text-sm text-heading placeholder:text-muted/70 transition-all focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/10 ${
            error
              ? 'border-red-400 bg-red-50/20 dark:bg-red-950/20'
              : 'border-border hover:border-accent/35'
          }`}
        />
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-red-500">{error}</p>}
    </div>
  );
}

function getFieldGridClass(field) {
  if (!field.builtIn) return 'sm:col-span-2';
  return '';
}

export default function ApplicationPreviewFlow({ job, slug, live = false }) {
  const fields = useMemo(() => normalizeApplicationFields(job.applicationFields), [job.applicationFields]);
  const questions = useMemo(() => {
    if (live) {
      return [...(job.questions || [])];
    }
    return normalizeQuestions(job.questions || []);
  }, [job.questions, live]);
  const standardQuestions = questions.filter((q) => !MEDIA_TYPES.has(q.type));
  const mediaQuestion =
    questions.find((q) => q.builtIn) ??
    questions.find((q) => MEDIA_TYPES.has(q.type));

  const introTitle = job.candidateIntroTitle?.trim() || '';
  const instructions = job.candidateInstructions?.trim() || '';
  const hasInstructions = Boolean(instructions);
  const applicationTitle = job.applicationSectionTitle || DEFAULT_APPLICATION_SECTION_TITLE;
  const applyButtonLabel = job.applyButtonLabel?.trim() || DEFAULT_APPLY_BUTTON_LABEL;
  const questionRetakes = job.settings?.questionRetakes ?? 'unlimited';

  const [phase, setPhase] = useState('intro');
  const [applicationValues, setApplicationValues] = useState(() =>
    Object.fromEntries(fields.map((f) => [f.id, '']))
  );
  const [applicationErrors, setApplicationErrors] = useState({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [questionAnswers, setQuestionAnswers] = useState({});
  const [questionError, setQuestionError] = useState('');
  const [videoRecording, setVideoRecording] = useState(null);
  const [videoRetakeCount, setVideoRetakeCount] = useState(0);
  const [videoError, setVideoError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [flowError, setFlowError] = useState('');

  const currentQuestion = standardQuestions[questionIndex];
  const hasVideoRecording = Boolean(videoRecording?.url);
  const retakesRemaining = getRetakesRemaining(
    questionRetakes,
    videoRetakeCount,
    hasVideoRecording,
  );
  const canRetake = canRetakeVideo(questionRetakes, videoRetakeCount, hasVideoRecording);
  const retakeButtonLabel = getRetakeButtonLabel(questionRetakes, retakesRemaining);

  const handleRetakeVideo = () => {
    if (!canRetake) {
      setVideoError('Retakes are disabled for this question');
      return;
    }
    if (videoRecording?.url?.startsWith('blob:')) {
      URL.revokeObjectURL(videoRecording.url);
    }
    setVideoRecording(null);
    setVideoError('');
  };

  const handleApplicationChange = (fieldId, value) => {
    setApplicationValues((prev) => ({ ...prev, [fieldId]: value }));
    setApplicationErrors((prev) => ({ ...prev, [fieldId]: '' }));
  };

  const handleStartNow = async () => {
    const errors = {};
    fields.forEach((field) => {
      const error = validateApplicationField(field, applicationValues[field.id]);
      if (error) errors[field.id] = error;
    });

    if (Object.keys(errors).length > 0) {
      setApplicationErrors(errors);
      return;
    }

    if (live && slug) {
      setSubmitting(true);
      setFlowError('');
      try {
        const existingSession = applicationService.readApplySession(slug);
        if (existingSession?.id) {
          await applicationService.updateApplication(slug, applicationValues, fields);
        } else {
          await applicationService.startApplication(slug, applicationValues, fields);
        }
      } catch (err) {
        setFlowError(err.message || 'Failed to start application');
        setSubmitting(false);
        return;
      }
      setSubmitting(false);
    }

    if (standardQuestions.length > 0) {
      setPhase('questions');
      setQuestionIndex(0);
    } else {
      setPhase('video');
    }
  };

  const handleQuestionBack = () => {
    setQuestionError('');
    if (questionIndex > 0) {
      setQuestionIndex((index) => index - 1);
      return;
    }
    setPhase('intro');
  };

  const handleVideoBack = () => {
    setVideoError('');
    setFlowError('');
    if (standardQuestions.length > 0) {
      setPhase('questions');
      setQuestionIndex(standardQuestions.length - 1);
      return;
    }
    setPhase('intro');
  };

  const handleQuestionNext = async () => {
    const error = validateStandardQuestion(currentQuestion, questionAnswers[currentQuestion.id]);
    if (error) {
      setQuestionError(error);
      return;
    }

    if (live && slug) {
      setSubmitting(true);
      setFlowError('');
      try {
        await applicationService.saveTextAnswer(
          slug,
          currentQuestion.id,
          questionAnswers[currentQuestion.id],
        );
      } catch (err) {
        setQuestionError(err.message || 'Failed to save answer');
        setSubmitting(false);
        return;
      }
      setSubmitting(false);
    }

    setQuestionError('');
    if (questionIndex < standardQuestions.length - 1) {
      setQuestionIndex((i) => i + 1);
    } else {
      setPhase('video');
    }
  };

  const handleVideoRecorded = async (media) => {
    if (videoRecording?.url?.startsWith('blob:')) {
      URL.revokeObjectURL(videoRecording.url);
    }

    if (live && slug && mediaQuestion) {
      setSubmitting(true);
      setVideoError('');
      try {
        setVideoRecording(media);
        const uploaded = await applicationService.uploadVideoAnswer(
          slug,
          mediaQuestion.id,
          media,
        );
        if (media.url?.startsWith('blob:')) {
          URL.revokeObjectURL(media.url);
        }
        setVideoRecording(uploaded);
        setVideoRetakeCount(uploaded.retakeCount ?? 0);
      } catch (err) {
        setVideoError(err.message || 'Failed to upload video');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setVideoRecording(media);
    if (videoRecording?.url) {
      setVideoRetakeCount((count) => count + 1);
    }
    setVideoError('');
  };

  const handleSubmit = async () => {
    if (!videoRecording?.url) {
      setVideoError('Please record your video response to continue');
      return;
    }

    if (live && slug) {
      setSubmitting(true);
      setFlowError('');
      try {
        await applicationService.submitApplication(slug);
        setPhase('done');
      } catch (err) {
        setFlowError(err.message || 'Failed to submit application');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setPhase('done');
  };

  if (phase === 'done') {
    const thankYou = job.settings?.thankYouPage || {};

    return (
      <StepLayout>
        <ThankYouScreen job={job} thankYou={thankYou} />
      </StepLayout>
    );
  }

  if (phase === 'questions' && currentQuestion) {
    const answer = questionAnswers[currentQuestion.id] ?? '';
    const totalSteps = standardQuestions.length + 1;
    const currentStep = questionIndex + 1;

    return (
      <StepLayout>
        <ProgressBar current={currentStep} total={totalSteps} />
        <StepCard
          title={currentQuestion.label || 'Untitled question'}
          subtitle={currentQuestion.required ? 'Required question' : 'Optional question'}
        >
          {currentQuestion.type === 'multiple-choice' ? (
            <div className="space-y-2.5">
              {(currentQuestion.options || []).map((opt) => (
                <label
                  key={opt}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 transition-all ${
                    answer === opt ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/35 hover:bg-hover'
                  }`}
                >
                  <input
                    type="radio"
                    name={currentQuestion.id}
                    checked={answer === opt}
                    onChange={() => {
                      setQuestionAnswers((prev) => ({ ...prev, [currentQuestion.id]: opt }));
                      setQuestionError('');
                    }}
                    className="text-accent"
                  />
                  <span className="text-sm font-medium text-heading">{opt}</span>
                </label>
              ))}
              {questionError && <p className="text-xs font-medium text-red-500">{questionError}</p>}
            </div>
          ) : (
            <PreviewField
              field={currentQuestion}
              label="Your answer"
              required={currentQuestion.required}
              type={currentQuestion.type}
              value={answer}
              onChange={(v) => {
                setQuestionAnswers((prev) => ({ ...prev, [currentQuestion.id]: v }));
                setQuestionError('');
              }}
              error={questionError}
              placeholder="Type your answer here"
            />
          )}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              className="w-full rounded-full py-3 text-sm font-semibold sm:flex-1 sm:text-base"
              size="lg"
              onClick={handleQuestionBack}
              disabled={submitting}
            >
              <ChevronLeft size={18} />
              Back
            </Button>
            <Button
              className="w-full rounded-full py-3 text-sm font-semibold shadow-md shadow-accent/20 sm:flex-[2] sm:text-base"
              size="lg"
              onClick={handleQuestionNext}
              disabled={submitting}
            >
              {submitting
                ? 'Saving...'
                : questionIndex < standardQuestions.length - 1
                  ? 'Next'
                  : 'Continue to video'}{' '}
              {!submitting && <ChevronRight size={18} />}
            </Button>
          </div>
        </StepCard>
      </StepLayout>
    );
  }

  if (phase === 'video') {
    const totalSteps = standardQuestions.length + 1;
    const currentStep = totalSteps;

    return (
      <StepLayout>
        <ProgressBar current={currentStep} total={totalSteps} />
        <StepCard
          badge="Final step"
          title={mediaQuestion?.label || 'Tell me about yourself'}
          subtitle="Record a short video using your camera and microphone. This step is required to submit your application."
        >
          {videoRecording?.url ? (
            <div className="overflow-hidden rounded-xl border border-border bg-black">
              <div className="relative aspect-video w-full">
                <video
                  key={videoRecording.url}
                  src={videoRecording.url}
                  controls
                  playsInline
                  preload="metadata"
                  className="absolute inset-0 h-full w-full object-contain"
                />
              </div>
              <div className="border-t border-border bg-card px-4 py-3 text-center">
                {canRetake && retakeButtonLabel ? (
                  <button
                    type="button"
                    onClick={handleRetakeVideo}
                    className="text-sm font-medium text-accent hover:underline"
                  >
                    {retakeButtonLabel}
                  </button>
                ) : (
                  <p className="text-sm text-muted">
                    Retakes are disabled for this question
                  </p>
                )}
              </div>
            </div>
          ) : (
            <VideoRecorderPanel
              onRecorded={handleVideoRecorded}
              onError={setVideoError}
              disabled={submitting}
              uploading={submitting}
            />
          )}

          {videoError && <p className="mt-3 text-center text-sm font-medium text-red-500">{videoError}</p>}
          {flowError && <p className="mt-3 text-center text-sm font-medium text-red-500">{flowError}</p>}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              className="w-full rounded-full py-3 text-sm font-semibold sm:flex-1 sm:text-base"
              size="lg"
              onClick={handleVideoBack}
              disabled={submitting}
            >
              <ChevronLeft size={18} />
              Back
            </Button>
            <Button
              className="w-full rounded-full py-3 text-sm font-semibold shadow-md shadow-accent/20 sm:flex-[2] sm:text-base"
              size="lg"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Submitting...' : 'Submit application'}
            </Button>
          </div>
        </StepCard>
      </StepLayout>
    );
  }

  const jobMeta = [job.title, job.location, job.employmentType].filter(Boolean).join(' · ');

  return (
    <div className={`${CONTENT_WIDTH} space-y-5 py-5 sm:py-6`}>
      {job.introMedia?.url && (
        <section className="overflow-hidden rounded-xl border border-border bg-black shadow-md">
          <div className="relative aspect-[16/9] w-full">
            {isVideoMedia(job.introMedia) ? (
              <video
                key={job.introMedia.url}
                src={job.introMedia.url}
                controls
                playsInline
                className="absolute inset-0 h-full w-full object-contain"
              />
            ) : (
              <img
                key={job.introMedia.url}
                src={job.introMedia.url}
                alt="Introduction"
                className="absolute inset-0 h-full w-full object-contain"
              />
            )}
          </div>
        </section>
      )}

      {(introTitle || jobMeta || hasInstructions) && (
        <section className="text-center">
          {job.company && (
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent">{job.company}</p>
          )}
          {introTitle && (
            <h1 className={`text-2xl font-semibold tracking-tight text-heading leading-tight sm:text-[1.75rem] ${job.company ? 'mt-2' : ''}`}>
              {introTitle}
            </h1>
          )}
          {jobMeta && (
            <p className={`text-sm text-muted font-medium ${introTitle || job.company ? 'mt-2' : ''}`}>{jobMeta}</p>
          )}
          {hasInstructions && (
            <div className={`mx-auto max-w-3xl text-left ${introTitle || jobMeta || job.company ? 'mt-4' : ''}`}>
              <InstructionText text={instructions} />
            </div>
          )}
        </section>
      )}

      <section className={`${CARD_CLASS} overflow-hidden`}>
        <div className="border-b border-border bg-accent/[0.04] px-5 py-4 sm:px-6">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent">Step 1</p>
          <h2 className="text-base font-semibold text-heading sm:text-lg">{applicationTitle}</h2>
          <p className="mt-0.5 text-sm text-muted">Fill in your details to continue</p>
        </div>

        <div className="p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <PreviewField
                key={field.id}
                field={field}
                label={field.label}
                required={field.required}
                type={field.type}
                value={applicationValues[field.id] ?? ''}
                onChange={(v) => handleApplicationChange(field.id, v)}
                error={applicationErrors[field.id]}
                placeholder={getFieldPlaceholder(field)}
                className={getFieldGridClass(field)}
              />
            ))}
          </div>

          <Button
            className="mt-6 w-full rounded-full py-3 text-sm font-semibold shadow-md shadow-accent/20 sm:text-base"
            size="lg"
            onClick={handleStartNow}
            disabled={submitting}
          >
            {submitting ? 'Starting...' : applyButtonLabel}
          </Button>

          {flowError && (
            <p className="mt-3 text-center text-sm font-medium text-red-500">{flowError}</p>
          )}

          <p className="mt-3 text-center text-xs text-muted">
            By continuing, you agree to our{' '}
            <a href="#" className="text-accent font-medium hover:underline" onClick={(e) => e.preventDefault()}>
              Privacy policy & Terms
            </a>
          </p>
        </div>
      </section>
    </div>
  );
}
