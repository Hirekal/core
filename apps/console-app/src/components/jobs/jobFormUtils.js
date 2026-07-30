export const MEDIA_QUESTION_TYPES = [
  { value: 'audio', label: 'Audio' },
  { value: 'video', label: 'Video' },
  { value: 'screen-recording', label: 'Screen Recording' },
  { value: 'file', label: 'Files' },
  { value: 'rich-text', label: 'Rich Text (multi-line)' },
];

export const MEDIA_TYPES = new Set(MEDIA_QUESTION_TYPES.map((t) => t.value));

export const DEFAULT_MEDIA_QUESTION = {
  id: 'default-media-video',
  type: 'video',
  category: 'media',
  label: 'Tell me about yourself',
  required: true,
  options: [],
  builtIn: true,
};

export const DEFAULT_APPLICATION_FIELDS = [
  { id: 'firstName', label: 'First Name', type: 'text', required: true, builtIn: true },
  { id: 'lastName', label: 'Last Name', type: 'text', required: true, builtIn: true },
  { id: 'email', label: 'Email', type: 'email', required: true, builtIn: true },
  { id: 'phone', label: 'Phone Number', type: 'phone', required: false, builtIn: true },
];

export const DEFAULT_CANDIDATE_INTRO_TITLE = 'Introduction Video Interview';

export const DEFAULT_CANDIDATE_INSTRUCTIONS = `Thanks for your interest in finding a remote job with a U.S. company you'll love!

We're excited to get to know you better.

This opportunity is perfect for someone who's passionate about growing their career, making an impact, and working with teams across the globe.

Important: Please record the video interview using the same email address you used in your application form so we can match your responses to your candidate profile. (You only need to record this interview once)

Let's get started! 🎥`;

export const DEFAULT_APPLICATION_SECTION_TITLE = 'Complete your application';

export function normalizeQuestions(questions = []) {
  const standard = questions.filter((q) => !MEDIA_TYPES.has(q.type));
  const existingDefault = questions.find((q) => q.id === DEFAULT_MEDIA_QUESTION.id || q.builtIn);
  const firstMedia = questions.find((q) => MEDIA_TYPES.has(q.type));

  const defaultMedia = {
    ...DEFAULT_MEDIA_QUESTION,
    label: existingDefault?.label || firstMedia?.label || DEFAULT_MEDIA_QUESTION.label,
  };

  return [...standard, defaultMedia];
}

export function normalizeApplicationFields(fields) {
  if (Array.isArray(fields)) return fields;
  if (!fields || typeof fields !== 'object') return [...DEFAULT_APPLICATION_FIELDS];

  const builtIn = DEFAULT_APPLICATION_FIELDS.map((def) => ({
    ...def,
    required: fields[def.id]?.required ?? def.required,
  }));

  const custom = (fields.custom || []).map((f) => ({ ...f, builtIn: false }));
  return [...builtIn, ...custom];
}
