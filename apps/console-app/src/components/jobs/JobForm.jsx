import { useState, useEffect } from 'react';
import {
  Plus, Trash2, GripVertical, Video,
  Briefcase, MessageSquare, FormInput, SlidersHorizontal,
  User, Mail, Phone, Type, RotateCcw, Languages, Sparkles,
} from 'lucide-react';
import Button from '../common/Button';
import Input from '../common/Input';
import { SelectDropdown } from '../common/Dropdown';
import Toggle from '../common/Toggle';
import Card from '../common/Card';
import SidePanel, { SidePanelItem } from '../common/SidePanel';
import IntroMediaPicker from '../common/IntroMediaPicker';
import {
  MEDIA_TYPES,
  DEFAULT_MEDIA_QUESTION,
  DEFAULT_APPLICATION_SECTION_TITLE,
  DEFAULT_APPLY_BUTTON_LABEL,
  normalizeQuestions,
  normalizeApplicationFields,
} from './jobFormUtils';

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'url', label: 'URL' },
];

const EMPLOYMENT_TYPES = [
  { value: 'Full-time', label: 'Full-time' },
  { value: 'Part-time', label: 'Part-time' },
  { value: 'Contract', label: 'Contract' },
  { value: 'Internship', label: 'Internship' },
];

const RETAKE_OPTIONS = [
  { value: 'none', label: 'No retakes' },
  { value: '1', label: '1 retake' },
  { value: '2', label: '2 retakes' },
  { value: '3', label: '3 retakes' },
  { value: 'unlimited', label: 'Unlimited' },
];

const STANDARD_QUESTION_TYPES = [
  { value: 'text', label: 'Text Response' },
  { value: 'email', label: 'Email' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'multiple-choice', label: 'Multiple Choice' },
];

function normalizeSettings(settings = {}) {
  let questionRetakes = settings.questionRetakes;
  if (!questionRetakes) {
    questionRetakes = settings.allowRetakes === false ? 'none' : 'unlimited';
  }

  return {
    questionRetakes,
    transcriptionLanguage: 'english',
    aiTranscripts: settings.aiTranscripts ?? true,
  };
}

function createInitialForm(initialData) {
  const questions = normalizeQuestions(initialData?.questions || []);
  const formQuestions = initialData
    ? questions
    : questions.map((q) => (q.builtIn ? { ...q, label: '' } : q));

  return {
    title: initialData?.title ?? '',
    internalTitle: initialData?.internalTitle ?? '',
    company: initialData?.company ?? '',
    companyWebsite: initialData?.companyWebsite ?? '',
    location: initialData?.location ?? '',
    employmentType: initialData?.employmentType ?? '',
    introMedia: initialData?.introMedia ?? null,
    candidateIntroTitle: initialData?.candidateIntroTitle ?? '',
    candidateInstructions: initialData?.candidateInstructions ?? '',
    applicationSectionTitle: initialData?.applicationSectionTitle ?? '',
    applyButtonLabel: initialData?.applyButtonLabel ?? DEFAULT_APPLY_BUTTON_LABEL,
    questions: formQuestions,
    applicationFields: normalizeApplicationFields(initialData?.applicationFields),
    settings: normalizeSettings(initialData?.settings),
  };
}

function prepareFormPayload(form) {
  return {
    ...form,
    title: form.title.trim(),
    internalTitle: form.internalTitle.trim(),
    company: form.company.trim(),
    companyWebsite: form.companyWebsite.trim(),
    location: form.location.trim(),
    employmentType: form.employmentType || 'Full-time',
    candidateIntroTitle: form.candidateIntroTitle.trim(),
    candidateInstructions: form.candidateInstructions.trim(),
    applicationSectionTitle: form.applicationSectionTitle.trim() || DEFAULT_APPLICATION_SECTION_TITLE,
    applyButtonLabel: form.applyButtonLabel.trim() || DEFAULT_APPLY_BUTTON_LABEL,
    questions: form.questions.map((q) => ({
      ...q,
      label: q.label.trim() || (q.builtIn ? DEFAULT_MEDIA_QUESTION.label : ''),
    })),
  };
}

const FIELD_TYPE_LABELS = Object.fromEntries(FIELD_TYPES.map((t) => [t.value, t.label]));

const FIELD_ICON_MAP = {
  firstName: User,
  lastName: User,
  email: Mail,
  phone: Phone,
};

function getFieldIcon(field) {
  if (FIELD_ICON_MAP[field.id]) return FIELD_ICON_MAP[field.id];
  if (field.type === 'email') return Mail;
  if (field.type === 'phone') return Phone;
  return Type;
}

const FORM_SECTIONS = [
  { id: 'basic', label: 'Basic Details', description: 'Job info & intro', icon: Briefcase },
  { id: 'questions', label: 'Questions', description: 'Interview prompts', icon: MessageSquare },
  { id: 'fields', label: 'Application Fields', description: 'Candidate form', icon: FormInput },
  { id: 'settings', label: 'Additional Settings', description: 'Retakes & AI', icon: SlidersHorizontal },
];

function SectionCard({ title, description, action, icon: Icon, children }) {
  return (
    <Card className="!p-0 overflow-hidden shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border bg-hover/40 px-8 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          {Icon && (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Icon size={20} />
            </span>
          )}
          <div>
            <h3 className="text-lg font-semibold text-heading">{title}</h3>
            {description && <p className="text-sm text-muted mt-0.5">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="p-8">{children}</div>
    </Card>
  );
}

function EmptyBlock({ icon: Icon, title, description, action }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-gray-50/50 px-6 py-12 text-center">
      <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-card text-muted shadow-sm ring-1 ring-border">
        <Icon size={22} />
      </span>
      <p className="text-sm font-medium text-heading">{title}</p>
      {description && <p className="mt-1 text-sm text-muted max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export default function JobForm({ initialData, onSubmit, loading }) {
  const [form, setForm] = useState(() => createInitialForm(initialData));

  const [activeSection, setActiveSection] = useState('basic');

  useEffect(() => {
    if (!initialData) return;
    setForm(createInitialForm(initialData));
  }, [initialData?.id, initialData?.updatedAt]);

  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const addQuestion = (defaultType = 'text') => {
    setForm((prev) => ({
      ...prev,
      questions: [
        ...prev.questions,
        {
          id: `q-${Date.now()}`,
          type: defaultType,
          category: MEDIA_TYPES.has(defaultType) ? 'media' : 'standard',
          label: '',
          required: true,
          options: [],
        },
      ],
    }));
  };

  const updateQuestion = (index, updates) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q, i) => {
        if (i !== index) return q;
        if (q.builtIn) {
          return { ...q, label: updates.label ?? q.label };
        }
        const next = { ...q, ...updates };
        if (updates.type) {
          if (MEDIA_TYPES.has(updates.type)) {
            return q;
          }
          next.category = 'standard';
        }
        return next;
      }),
    }));
  };

  const removeQuestion = (questionId) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.filter((q) => q.builtIn || q.id !== questionId),
    }));
  };

  const updateApplicationField = (index, updates) => {
    setForm((prev) => ({
      ...prev,
      applicationFields: prev.applicationFields.map((f, i) => (i === index ? { ...f, ...updates } : f)),
    }));
  };

  const addApplicationField = () => {
    setForm((prev) => ({
      ...prev,
      applicationFields: [
        ...prev.applicationFields,
        {
          id: `field-${Date.now()}`,
          label: '',
          type: 'text',
          required: false,
          builtIn: false,
        },
      ],
    }));
  };

  const removeApplicationField = (index) => {
    setForm((prev) => ({
      ...prev,
      applicationFields: prev.applicationFields.filter((f, i) => i !== index || f.builtIn),
    }));
  };

  const builtInFields = form.applicationFields.filter((f) => f.builtIn);
  const customFields = form.applicationFields.filter((f) => !f.builtIn);

  const renderApplicationFieldRow = (field) => {
    const globalIndex = form.applicationFields.findIndex((f) => f.id === field.id);
    const Icon = getFieldIcon(field);

    return (
      <div
        key={field.id}
        className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-hover/60"
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
            <Icon size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-heading">{field.label}</p>
            <p className="text-xs text-muted">{FIELD_TYPE_LABELS[field.type] || 'Text'} field</p>
          </div>
        </div>
        <Toggle
          label="Required"
          checked={field.required}
          onChange={(v) => updateApplicationField(globalIndex, { required: v })}
          className="items-center shrink-0 gap-3"
        />
      </div>
    );
  };

  const renderCustomFieldCard = (field) => {
    const globalIndex = form.applicationFields.findIndex((f) => f.id === field.id);
    const Icon = getFieldIcon(field);

    return (
      <div
        key={field.id}
        className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
      >
        <div className="flex items-start gap-3">
          <span className="mt-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-muted">
            <Icon size={18} />
          </span>
          <div className="flex-1 grid gap-3 sm:grid-cols-2">
            <Input
              label="Field Label"
              value={field.label}
              onChange={(e) => updateApplicationField(globalIndex, { label: e.target.value })}
              containerClassName="sm:col-span-2"
            />
            <SelectDropdown
              label="Field Type"
              value={field.type}
              onChange={(v) => updateApplicationField(globalIndex, { type: v })}
              options={FIELD_TYPES}
              placeholder="Select field type"
            />
            <Toggle
              label="Required"
              checked={field.required}
              onChange={(v) => updateApplicationField(globalIndex, { required: v })}
            />
          </div>
          <button
            type="button"
            onClick={() => removeApplicationField(globalIndex)}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-red-50 hover:text-red-500"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    );
  };

  const sections = FORM_SECTIONS;

  const handleSave = (openPreview) => {
    if (!form.title.trim() || !form.company.trim()) return;
    onSubmit(prepareFormPayload(form), { openPreview });
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    handleSave(false);
  };

  const standardQuestions = form.questions.filter((q) => !q.builtIn && !MEDIA_TYPES.has(q.type));
  const defaultMediaQuestion = form.questions.find((q) => q.builtIn) || DEFAULT_MEDIA_QUESTION;

  const renderBuiltInMediaQuestion = (q) => {
    const globalIndex = form.questions.findIndex((item) => item.id === q.id);

    return (
      <div key={q.id} className="rounded-xl border border-border bg-gray-50/40 p-5">
        <div className="flex items-start gap-3">
          <span className="mt-2.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <Video size={16} />
          </span>
          <div className="flex-1 grid gap-3 sm:grid-cols-2">
            <Input
              label="Question"
              value={q.label}
              onChange={(e) => updateQuestion(globalIndex, { label: e.target.value })}
              placeholder="Tell me about yourself"
              containerClassName="sm:col-span-2"
            />
            <div>
              <label className="text-sm font-medium text-heading mb-1.5 block">Response Type</label>
              <div className="flex h-[38px] items-center rounded-lg border border-border bg-card px-3 text-sm text-heading">
                Video
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-heading mb-1.5 block">Required</label>
              <div className="flex h-[38px] items-center rounded-lg border border-border bg-card px-3 text-sm text-muted">
                Yes — candidates must record a video
              </div>
            </div>
            <div className="sm:col-span-2 rounded-lg bg-card px-3 py-2 text-xs text-muted ring-1 ring-border">
              Candidates will record a video response using their camera and microphone.
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderQuestionCard = (q) => {
    if (q.builtIn) return renderBuiltInMediaQuestion(q);

    const globalIndex = form.questions.findIndex((item) => item.id === q.id);

    return (
      <div key={q.id} className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
        <div className="flex items-start gap-3">
          <span className="mt-2.5 flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-lg bg-gray-50 text-muted">
            <GripVertical size={16} />
          </span>
          <div className="flex-1 grid gap-3 sm:grid-cols-2">
            <Input
              label="Question"
              value={q.label}
              onChange={(e) => updateQuestion(globalIndex, { label: e.target.value })}
              containerClassName="sm:col-span-2"
            />
            <SelectDropdown
              label="Type"
              value={q.type}
              onChange={(v) => updateQuestion(globalIndex, { type: v })}
              options={STANDARD_QUESTION_TYPES}
              placeholder="Select question type"
            />
            <Toggle
              label="Required"
              checked={q.required}
              onChange={(v) => updateQuestion(globalIndex, { required: v })}
            />
            {q.type === 'multiple-choice' && (
              <Input
                label="Options (comma separated)"
                value={(q.options || []).join(', ')}
                onChange={(e) =>
                  updateQuestion(globalIndex, {
                    options: e.target.value.split(',').map((o) => o.trim()).filter(Boolean),
                  })
                }
                containerClassName="sm:col-span-2"
              />
            )}
          </div>
          <button
            type="button"
            onClick={() => removeQuestion(q.id)}
            className="mt-1 rounded-lg p-2 text-muted transition-colors hover:bg-red-50 hover:text-red-500"
            aria-label="Delete question"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <form onSubmit={handleFormSubmit}>
      {/* Mobile section tabs */}
      <div className="lg:hidden mb-6">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sections.map((s, index) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSection(s.id)}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                activeSection === s.id
                  ? 'border-accent bg-accent text-white shadow-sm'
                  : 'border-border bg-card text-muted hover:border-accent/30 hover:text-heading'
              }`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold ${
                activeSection === s.id ? 'bg-card/20 text-white' : 'bg-hover text-muted'
              }`}>
                {index + 1}
              </span>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-10 xl:gap-12">
        <SidePanel title="Job setup" subtitle="Complete each section" className="hidden lg:block">
          <div className="space-y-1.5">
            {sections.map((s, index) => (
              <SidePanelItem
                key={s.id}
                active={activeSection === s.id}
                onClick={() => setActiveSection(s.id)}
                step={index + 1}
                label={s.label}
                description={s.description}
              />
            ))}
          </div>
        </SidePanel>

        <div className="flex-1 min-w-0 space-y-6 min-h-[28rem] pb-24">
          {activeSection === 'basic' && (
            <SectionCard
              icon={Briefcase}
              title="Basic Details"
              description="Job info and intro media for candidates"
            >
              <IntroMediaPicker
                value={form.introMedia}
                onChange={(media) => updateField('introMedia', media)}
              />

              <div className="grid gap-5 sm:grid-cols-2 sm:items-start">
                <Input label="Job Title" required value={form.title} onChange={(e) => updateField('title', e.target.value)} placeholder="e.g. Senior Software Engineer" />
                <Input label="Internal Job Title" value={form.internalTitle} onChange={(e) => updateField('internalTitle', e.target.value)} placeholder="Optional internal reference" />
                <Input label="Company Name" required value={form.company} onChange={(e) => updateField('company', e.target.value)} placeholder="e.g. Acme Corp" />
                <Input label="Company Website" value={form.companyWebsite} onChange={(e) => updateField('companyWebsite', e.target.value)} placeholder="https://example.com" />
                <Input label="Location" value={form.location} onChange={(e) => updateField('location', e.target.value)} placeholder="e.g. Remote, New York" />
                <SelectDropdown label="Employment Type" value={form.employmentType} onChange={(v) => updateField('employmentType', v)} options={EMPLOYMENT_TYPES} placeholder="Select employment type" />
              </div>

              <div className="mt-8 space-y-5 border-t border-border pt-8">
                <Input
                  label="Introduction Title"
                  value={form.candidateIntroTitle}
                  onChange={(e) => updateField('candidateIntroTitle', e.target.value)}
                  placeholder="Introduction Video Interview"
                />
                <Input
                  label="Application Section Title"
                  value={form.applicationSectionTitle}
                  onChange={(e) => updateField('applicationSectionTitle', e.target.value)}
                  placeholder="Complete your application"
                />
                <Input
                  label="Apply Button Text"
                  value={form.applyButtonLabel}
                  onChange={(e) => updateField('applyButtonLabel', e.target.value)}
                  placeholder="Start now"
                />
                <div>
                  <label className="text-sm font-medium text-heading mb-2 block">
                    Instructions for Candidates
                  </label>
                  <textarea
                    value={form.candidateInstructions}
                    onChange={(e) => updateField('candidateInstructions', e.target.value)}
                    rows={6}
                    className="w-full rounded-lg border border-border px-3 py-2.5 text-sm text-heading placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 leading-relaxed"
                    placeholder="Write a welcome message and instructions for candidates..."
                  />
                </div>
              </div>
            </SectionCard>
          )}

          {activeSection === 'questions' && (
            <div className="space-y-6">
              <SectionCard
                icon={MessageSquare}
                title="Standard Response Questions"
                description="Text, email, number, date, and multiple choice"
                action={
                  <Button type="button" variant="secondary" size="sm" onClick={() => addQuestion('text')}>
                    <Plus size={16} /> Add Question
                  </Button>
                }
              >
                {standardQuestions.length === 0 ? (
                  <EmptyBlock
                    icon={MessageSquare}
                    title="No standard questions yet"
                    description="Add text, email, or multiple choice questions for candidates"
                    action={
                      <Button type="button" variant="secondary" size="sm" onClick={() => addQuestion('text')}>
                        <Plus size={16} /> Add your first question
                      </Button>
                    }
                  />
                ) : (
                  <div className="space-y-4">{standardQuestions.map((q) => renderQuestionCard(q))}</div>
                )}
              </SectionCard>

              <SectionCard
                icon={Video}
                title="Media Responses"
                description="Video response recorded by the candidate"
              >
                {renderBuiltInMediaQuestion(defaultMediaQuestion)}
              </SectionCard>
            </div>
          )}

          {activeSection === 'fields' && (
            <SectionCard
              icon={FormInput}
              title="Application Fields"
              description="Contact details collected from every candidate"
              action={
                <Button type="button" variant="secondary" size="sm" onClick={addApplicationField}>
                  <Plus size={16} /> Add Field
                </Button>
              }
            >
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm divide-y divide-border">
                {builtInFields.map((field) => renderApplicationFieldRow(field))}
              </div>

              {customFields.length > 0 ? (
                <div className="mt-6">
                  <div className="mb-3 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-heading">Custom Fields</h4>
                    <span className="text-xs text-muted">{customFields.length} added</span>
                  </div>
                  <div className="space-y-3">
                    {customFields.map((field) => renderCustomFieldCard(field))}
                  </div>
                </div>
              ) : (
                <div className="mt-6 rounded-xl border border-dashed border-border bg-gray-50/50 px-5 py-6 text-center">
                  <p className="text-sm font-medium text-heading">Need more information?</p>
                  <p className="mt-1 text-sm text-muted">
                    Add custom fields like portfolio URL, LinkedIn, or years of experience.
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="mt-4"
                    onClick={addApplicationField}
                  >
                    <Plus size={16} /> Add custom field
                  </Button>
                </div>
              )}
            </SectionCard>
          )}

          {activeSection === 'settings' && (
            <SectionCard
              icon={SlidersHorizontal}
              title="Additional Settings"
              description="Recording limits, transcripts, and AI options"
            >
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm divide-y divide-border">
                <div className="px-5 py-5">
                  <div className="flex items-start gap-3 mb-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                      <RotateCcw size={18} />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-heading">Question Retakes</p>
                      <p className="text-xs text-muted mt-0.5">
                        How many times candidates can re-record their media answers
                      </p>
                    </div>
                  </div>
                  <SelectDropdown
                    label="Retake limit"
                    value={form.settings.questionRetakes}
                    onChange={(v) =>
                      setForm((prev) => ({
                        ...prev,
                        settings: { ...prev.settings, questionRetakes: v },
                      }))
                    }
                    options={RETAKE_OPTIONS}
                    placeholder="Select retake limit"
                  />
                </div>

                <div className="flex items-center justify-between gap-4 px-5 py-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                      <Languages size={18} />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-heading">Transcription Language</p>
                      <p className="text-xs text-muted mt-0.5">
                        Video and audio responses are transcribed in English
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-lg border border-border bg-gray-50 px-3 py-2 text-sm font-medium text-heading">
                    English
                  </span>
                </div>

                <div className="px-5 py-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                        <Sparkles size={18} />
                      </span>
                      <div>
                        <p className="text-sm font-medium text-heading">AI-based transcripts</p>
                        <p className="text-xs text-muted mt-0.5">
                          Automatically generate transcripts for video and audio responses
                        </p>
                      </div>
                    </div>
                    <Toggle
                      checked={form.settings.aiTranscripts}
                      onChange={(v) =>
                        setForm((prev) => ({
                          ...prev,
                          settings: { ...prev.settings, aiTranscripts: v },
                        }))
                      }
                      className="items-center shrink-0"
                    />
                  </div>
                </div>
              </div>
            </SectionCard>
          )}

          <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-card/95 backdrop-blur-sm">
            <div className="mx-auto flex max-w-6xl xl:max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
              <p className="hidden sm:block text-sm text-muted">
                {form.title.trim() ? (
                  <>Saving <span className="font-medium text-heading">{form.title}</span></>
                ) : (
                  'Add a job title to save'
                )}
              </p>
              <div className="flex w-full sm:w-auto justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={loading || !form.title.trim()}
                  onClick={() => handleSave(false)}
                >
                  {loading ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  type="button"
                  disabled={loading || !form.title.trim()}
                  onClick={() => handleSave(true)}
                >
                  {loading ? 'Saving...' : 'Save & Preview'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
