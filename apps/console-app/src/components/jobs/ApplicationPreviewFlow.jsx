import { useMemo, useState } from 'react';
import { CheckCircle2, Video, ChevronRight } from 'lucide-react';
import Button from '../common/Button';
import VideoRecorderModal from '../common/VideoRecorderModal';
import { isVideoMedia } from '../../utils/mediaHelpers';
import {
  normalizeApplicationFields,
  normalizeQuestions,
  DEFAULT_APPLICATION_SECTION_TITLE,
  MEDIA_TYPES,
} from './jobFormUtils';

const PAGE_CLASS = 'mx-auto w-full max-w-5xl px-5 sm:px-8 lg:px-10 py-8 sm:py-10';
const CARD_CLASS = 'rounded-2xl border border-border bg-white shadow-sm';

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

function CompanyLogo({ company }) {
  const initial = (company || 'C').charAt(0).toUpperCase();
  return (
    <div className="flex items-center justify-center gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-white shadow-sm">
        <span className="text-lg font-bold">{initial}</span>
      </div>
      <div className="text-left leading-tight">
        <p className="text-base font-semibold text-heading">{company}</p>
        <p className="text-xs font-medium text-muted tracking-wide">Careers</p>
      </div>
    </div>
  );
}

function InstructionText({ text }) {
  const paragraphs = text.includes('\n\n')
    ? text.split('\n\n').map((p) => p.trim()).filter(Boolean)
    : text.split('\n').map((p) => p.trim()).filter(Boolean);

  return (
    <div className="space-y-4 text-[15px] leading-7 text-gray-600">
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

function PreviewField({
  label,
  required,
  type = 'text',
  value,
  onChange,
  error,
  placeholder,
  className = '',
}) {
  const inputType =
    type === 'phone' ? 'tel' : type === 'email' ? 'email' : type === 'number' ? 'number' : type === 'date' ? 'date' : 'text';

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <label className="text-sm font-medium text-heading">
        {label}
        {required && <span className="text-accent ml-0.5">*</span>}
      </label>
      <input
        type={inputType}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-xl border bg-white px-4 py-3 text-[15px] text-heading placeholder:text-gray-400 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 ${
          error ? 'border-red-400 bg-red-50/30' : 'border-border hover:border-gray-300'
        }`}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

export default function ApplicationPreviewFlow({ job }) {
  const fields = useMemo(() => normalizeApplicationFields(job.applicationFields), [job.applicationFields]);
  const questions = useMemo(() => normalizeQuestions(job.questions || []), [job.questions]);
  const standardQuestions = questions.filter((q) => !MEDIA_TYPES.has(q.type));
  const mediaQuestion = questions.find((q) => q.builtIn || MEDIA_TYPES.has(q.type));

  const introTitle = job.candidateIntroTitle?.trim() || '';
  const instructions = job.candidateInstructions?.trim() || '';
  const hasInstructions = Boolean(instructions);
  const applicationTitle = job.applicationSectionTitle || DEFAULT_APPLICATION_SECTION_TITLE;

  const [phase, setPhase] = useState('intro');
  const [applicationValues, setApplicationValues] = useState(() =>
    Object.fromEntries(fields.map((f) => [f.id, '']))
  );
  const [applicationErrors, setApplicationErrors] = useState({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [questionAnswers, setQuestionAnswers] = useState({});
  const [questionError, setQuestionError] = useState('');
  const [videoRecording, setVideoRecording] = useState(null);
  const [recorderOpen, setRecorderOpen] = useState(false);
  const [videoError, setVideoError] = useState('');

  const currentQuestion = standardQuestions[questionIndex];

  const handleApplicationChange = (fieldId, value) => {
    setApplicationValues((prev) => ({ ...prev, [fieldId]: value }));
    setApplicationErrors((prev) => ({ ...prev, [fieldId]: '' }));
  };

  const handleStartNow = () => {
    const errors = {};
    fields.forEach((field) => {
      const error = validateApplicationField(field, applicationValues[field.id]);
      if (error) errors[field.id] = error;
    });

    if (Object.keys(errors).length > 0) {
      setApplicationErrors(errors);
      return;
    }

    if (standardQuestions.length > 0) {
      setPhase('questions');
      setQuestionIndex(0);
    } else {
      setPhase('video');
    }
  };

  const handleQuestionNext = () => {
    const error = validateStandardQuestion(currentQuestion, questionAnswers[currentQuestion.id]);
    if (error) {
      setQuestionError(error);
      return;
    }

    setQuestionError('');
    if (questionIndex < standardQuestions.length - 1) {
      setQuestionIndex((i) => i + 1);
    } else {
      setPhase('video');
    }
  };

  const handleVideoRecorded = (media) => {
    setVideoRecording(media);
    setVideoError('');
    setRecorderOpen(false);
  };

  const handleSubmit = () => {
    if (!videoRecording?.url) {
      setVideoError('Please record your video response to continue');
      return;
    }
    setPhase('done');
  };

  if (phase === 'done') {
    return (
      <div className={`${PAGE_CLASS} text-center`}>
        <div className={`${CARD_CLASS} px-8 py-14 sm:px-12`}>
          <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 text-accent">
            <CheckCircle2 size={36} />
          </span>
          <h2 className="text-2xl font-semibold text-heading">Application submitted!</h2>
          <p className="mt-3 text-muted max-w-md mx-auto text-[15px] leading-relaxed">
            Thank you for applying to <strong className="text-heading">{job.title}</strong> at {job.company}.
            We&apos;ll review your responses and get back to you soon.
          </p>
        </div>
      </div>
    );
  }

  if (phase === 'questions' && currentQuestion) {
    const answer = questionAnswers[currentQuestion.id] ?? '';

    return (
      <div className={PAGE_CLASS}>
        <div className="mb-6 text-center">
          <p className="text-sm text-muted">
            Question {questionIndex + 1} of {standardQuestions.length}
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-gray-100 overflow-hidden max-w-sm mx-auto">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${((questionIndex + 1) / standardQuestions.length) * 100}%` }}
            />
          </div>
        </div>

        <div className={`${CARD_CLASS} p-8 sm:p-10`}>
          <h2 className="text-xl font-semibold text-heading mb-6">
            {currentQuestion.label || 'Untitled question'}
            {currentQuestion.required && <span className="text-accent"> *</span>}
          </h2>

          {currentQuestion.type === 'multiple-choice' ? (
            <div className="space-y-3">
              {(currentQuestion.options || []).map((opt) => (
                <label
                  key={opt}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 cursor-pointer transition-colors ${
                    answer === opt ? 'border-accent bg-accent/5' : 'border-border hover:bg-gray-50'
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
                  <span className="text-sm text-heading">{opt}</span>
                </label>
              ))}
              {questionError && <p className="text-xs text-red-500">{questionError}</p>}
            </div>
          ) : (
            <PreviewField
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

          <Button className="w-full mt-8 rounded-full py-3.5" size="lg" onClick={handleQuestionNext}>
            {questionIndex < standardQuestions.length - 1 ? 'Next' : 'Continue to video'}{' '}
            <ChevronRight size={18} />
          </Button>
        </div>
      </div>
    );
  }

  if (phase === 'video') {
    return (
      <div className={PAGE_CLASS}>
        <div className={`${CARD_CLASS} p-8 sm:p-10 text-center`}>
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <Video size={26} />
          </span>
          <h2 className="text-xl font-semibold text-heading">
            {mediaQuestion?.label || 'Tell me about yourself'}
            <span className="text-accent"> *</span>
          </h2>
          <p className="mt-2 text-sm text-muted max-w-lg mx-auto leading-relaxed">
            Record a short video using your camera and microphone. This step is required to submit your application.
          </p>

          {videoRecording?.url ? (
            <div className="mt-6 mx-auto max-w-xl">
              <video src={videoRecording.url} controls playsInline className="w-full rounded-xl bg-black shadow-md" />
              <button
                type="button"
                onClick={() => setRecorderOpen(true)}
                className="mt-3 text-sm font-medium text-accent hover:underline"
              >
                Re-record video
              </button>
            </div>
          ) : (
            <div className="mt-6 mx-auto max-w-xl rounded-xl border border-dashed border-border bg-gray-50 py-12 px-6">
              <p className="text-sm text-muted">No recording yet</p>
              <Button className="mt-4" onClick={() => setRecorderOpen(true)}>
                <Video size={16} /> Record video
              </Button>
            </div>
          )}

          {videoError && <p className="mt-3 text-sm text-red-500">{videoError}</p>}

          <Button className="w-full mt-8 max-w-xl mx-auto rounded-full py-3.5" size="lg" onClick={handleSubmit}>
            Submit application
          </Button>
        </div>

        <VideoRecorderModal
          isOpen={recorderOpen}
          onClose={() => setRecorderOpen(false)}
          onRecorded={handleVideoRecorded}
          title="Record your response"
        />
      </div>
    );
  }

  const jobMeta = [job.title, job.location, job.employmentType].filter(Boolean).join(' · ');

  return (
    <div className={PAGE_CLASS}>
      <header className="mb-6 sm:mb-8">
        <CompanyLogo company={job.company} />
      </header>

      {job.introMedia?.url && (
        <section className="mb-8 sm:mb-10">
          <div className="overflow-hidden rounded-2xl shadow-md ring-1 ring-black/5">
            {isVideoMedia(job.introMedia) ? (
              <video
                key={job.introMedia.url}
                src={job.introMedia.url}
                controls
                playsInline
                className="w-full aspect-video max-h-[440px] bg-black object-cover"
              />
            ) : (
              <img
                key={job.introMedia.url}
                src={job.introMedia.url}
                alt="Introduction"
                className="w-full aspect-video max-h-[440px] object-cover"
              />
            )}
          </div>
        </section>
      )}

      {(introTitle || jobMeta || hasInstructions) && (
        <section className="mb-8 sm:mb-10 max-w-3xl mx-auto text-center">
          {introTitle && (
            <h1 className="text-2xl sm:text-3xl font-bold text-heading tracking-tight leading-tight">
              {introTitle}
            </h1>
          )}
          {jobMeta && (
            <p className={`text-base text-muted font-medium ${introTitle ? 'mt-3' : ''}`}>{jobMeta}</p>
          )}
          {hasInstructions && (
            <div className={`text-left ${introTitle || jobMeta ? 'mt-8' : ''}`}>
              <InstructionText text={instructions} />
            </div>
          )}
        </section>
      )}

      <section className={`${CARD_CLASS} p-7 sm:p-9 lg:p-10`}>
        <h2 className="text-lg sm:text-xl font-semibold text-accent mb-7">{applicationTitle}</h2>

        <div className="grid gap-5 sm:grid-cols-2 lg:gap-6">
          {fields.map((field) => (
            <PreviewField
              key={field.id}
              label={field.label}
              required={field.required}
              type={field.type}
              value={applicationValues[field.id] ?? ''}
              onChange={(v) => handleApplicationChange(field.id, v)}
              error={applicationErrors[field.id]}
              placeholder={`Enter ${field.label.toLowerCase()}`}
              className={!field.builtIn || field.id === 'email' ? 'sm:col-span-2' : ''}
            />
          ))}
        </div>

        <Button className="w-full mt-8 sm:mt-10 rounded-full py-3.5 text-base font-semibold" size="lg" onClick={handleStartNow}>
          Start now
        </Button>

        <p className="mt-6 text-center text-xs sm:text-sm text-muted">
          By continuing, you agree to our{' '}
          <a href="#" className="text-accent font-medium hover:underline" onClick={(e) => e.preventDefault()}>
            Privacy policy & Terms
          </a>
        </p>
      </section>
    </div>
  );
}
