# Media Worker — Speech & Assessment Scores

This document explains the metrics returned by `POST /transcribe` in the `speech` and `assessment` blocks, how they are computed, what recruiters can infer from them, and important limitations.

For API usage see [README.md](./README.md).

---

## Response overview

A full `/transcribe` response has three analytic layers:

| Block | Purpose |
|-------|---------|
| `transcript` | What was said (Whisper ASR): text, segments, duration, language |
| `speech` | How speech was delivered acoustically (timing, pace, language metadata) |
| `assessment` | English pronunciation quality (scores + word/phoneme feedback) |

`assessment` is only populated when:

- `PRONUNCIATION_ENABLED=true`
- Whisper detects **English** (`transcript.language` = `en`)
- The pronunciation model loaded successfully

---

## `speech` metrics

These come from **SpeechBrain VAD** (voice activity detection), **Whisper** (language), and simple derivations.

### `language`

- **Source:** Whisper detection (primary), not SpeechBrain lang-id
- **Format:** ISO-style code, e.g. `en`
- **Recruiter use:** Confirm the candidate spoke the expected language; gate whether pronunciation assessment applies

### `language_confidence`

- **Source:** SpeechBrain lang-id classifier confidence (0–1)
- **Note:** This reflects SpeechBrain’s own classification, which can disagree with Whisper. It is **not** Whisper’s 90% English probability from logs.
- **Recruiter use:** Low confidence (< 0.6) suggests noisy audio, mixed language, or short clip — treat other metrics with caution

### `speech_duration` (seconds)

- **Source:** Sum of SpeechBrain VAD speech segments
- **Recruiter use:** How long the candidate actively spoke (excluding long silences)

### `silence_duration` (seconds)

- **Source:** Total clip duration minus speech duration
- **Recruiter use:** Dead air, thinking pauses, or technical gaps in the recording

### `speech_ratio` (%)

- **Formula:** `speech_duration / total_duration × 100`
- **Recruiter use:**
  - **High (95%+):** Confident, continuous delivery; little dead air
  - **Low (< 80%):** Many pauses, hesitation, or recording issues

Example: `98.18%` → almost the entire clip is active speech.

### `average_pause_duration` (seconds)

- **Source:** Mean gap between VAD speech segments (including leading/trailing silence)
- **Recruiter use:**
  - **< 0.5 s:** Fast, fluent pacing
  - **0.5–1.5 s:** Normal conversational pauses
  - **> 2 s:** Frequent hesitation or searching for words

### `longest_pause_duration` (seconds)

- **Source:** Single longest gap between speech segments
- **Recruiter use:** Flags one awkward freeze or technical pause; useful for interview highlight reels

### `speaking_rate` (words per minute, WPM)

- **Formula:** Whisper word count ÷ `speech_duration` × 60
- **Recruiter use:**

| WPM | Typical interpretation |
|-----|------------------------|
| < 110 | Slow; may be deliberate or uncertain |
| 110–160 | Conversational (good for most roles) |
| 160–190 | Energetic; common in sales/presentations |
| > 190 | Very fast; may hurt clarity |

Example: `166.95 WPM` → energetic, suitable for customer-facing roles.

---

## `assessment` scores

English-only. All scores are **0–100** (higher = better unless noted).

### `pronunciation_accuracy`

- **What it measures:** IPA phoneme match between:
  - **Expected:** phonemes derived from `reference_text` via eng-to-ipa
  - **Actual:** phonemes derived from wav2vec2’s separate ASR transcript (`asr_transcript`)
- **Formula:** Percentage of expected phonemes that align with actual (SequenceMatcher)
- **Recruiter use:** Rough indicator of clarity and accent impact on intelligibility
- **Caveats:**
  - Depends heavily on wav2vec2 ASR quality (often garbled on names, accents)
  - Without a fixed `reference_text`, expected = Whisper text → score reflects ASR disagreement more than true mispronunciation
  - **Not** certification-grade; use comparatively across candidates, not as absolute truth

Example: `67.9` → moderate; review `words` with low scores rather than trusting the number alone.

### `prosody_score`

- **What it measures:** Vocal expressiveness from audio signal (librosa):
  - Pitch variation (F0 standard deviation)
  - Pitch range
  - Energy (volume) variation
- **Recruiter use:**
  - **High (80+):** Engaging, varied tone — good for sales, teaching, leadership
  - **Low (< 50):** Monotone; may seem disengaged (or calm/deliberate depending on role)
- **Caveat:** Rewards natural variation; does not judge “correct” intonation for a script

Example: `92.4` → expressive, dynamic delivery.

### `fluency_score`

- **What it measures:** Composite from `speech` metrics:
  - Speaking rate vs ideal 145 WPM
  - Average pause length
  - Longest pause
  - Speech ratio / speech–silence balance
- **Recruiter use:** Overall smoothness and flow without reading a script word-for-word
- **Caveat:** Penalizes very fast *and* very slow speech equally vs 145 WPM baseline

Example: `96.25` → very fluent by pacing metrics.

### `completeness_score`

- **What it measures:** Share of **reference** words that appear anywhere in the Whisper transcript
- **Formula:** `matched_reference_words / total_reference_words × 100`
- **Recruiter use:** Did the candidate cover the expected script / answer all prompt parts?
- **Caveat:** When `reference_text` is omitted, reference = Whisper transcript → score is always ~100%. **Only meaningful when you pass an explicit `reference_text`.**

Example: `100` with no `reference_text` → not informative; it only confirms Whisper transcribed itself.

### `reference_text` / `asr_transcript`

- **`reference_text`:** Script used for scoring (from request or Whisper fallback)
- **`asr_transcript`:** wav2vec2’s phonetic ASR output (often lower quality than Whisper)
- **Recruiter use:** Compare side-by-side for QA; do not show `asr_transcript` to recruiters directly — use derived word scores instead

---

## Word-level feedback (`assessment.words[]`)

Each entry:

| Field | Meaning |
|-------|---------|
| `word` | Reference word |
| `expected_ipa` | Dictionary IPA for the word |
| `actual_ipa` | IPA inferred from wav2vec2 alignment |
| `accuracy_score` | 0–100, mean of phoneme scores in this word |
| `status` | `correct` (≥90), `partial` (60–89), `mispronounced` (<60), `omitted` (0) |
| `phonemes` | Nested phoneme-level detail |

### Recruiter-facing uses

- **Highlight problem words:** Filter `status in (mispronounced, partial)` for coaching or role fit (e.g. client-facing English)
- **Name / domain terms:** Expect lower scores on proper nouns (`Kuchiko`, `Nigeria`) — ASR limitation, not necessarily poor speech
- **Keyword coverage:** Check that role-specific terms were spoken clearly (e.g. “conversion”, “customer relations”)

---

## Phoneme-level feedback (`assessment.phonemes[]`)

Each entry:

| Field | Meaning |
|-------|---------|
| `index` | Order in utterance |
| `expected` / `actual` | IPA character(s) |
| `status` | `correct`, `mispronounced`, `omitted`, `inserted` |
| `score` | 100 (correct) or 0 (anything else) |

### Recruiter-facing uses

- Mostly for **detailed coaching UI**, not recruiter summary dashboards
- Aggregate counts are more useful than raw lists:
  - **Mispronunciation rate:** `mispronounced / total expected phonemes`
  - **Insertion rate:** often ASR noise, not candidate error

---

## Suggested recruiter dashboard metrics

These are **derived in your product layer** (not returned directly by media-worker):

### 1. Communication summary (single view)

| Derived metric | Inputs | Example (sample candidate) |
|----------------|--------|----------------------------|
| **Clarity index** | `pronunciation_accuracy` (weighted) + % words `correct` | ~68 + word-level review |
| **Fluency index** | `fluency_score` | 96 |
| **Engagement index** | `prosody_score` | 92 |
| **Pace label** | `speaking_rate` | “Fast (167 WPM)” |
| **Confidence signal** | `speech_ratio`, `longest_pause_duration` | High ratio, short pauses → confident |

### 2. Role-specific flags

| Role | Watch |
|------|-------|
| Sales / CS | High prosody + 140–180 WPM + low longest pause |
| Technical | Completeness vs prompt when `reference_text` provided |
| Leadership | Prosody + structured segments in `transcript.segments` |
| Non-native English | Word-level `partial`/`mispronounced` on job vocabulary only |

### 3. Red / yellow / green bands (example thresholds)

| Score | Green | Yellow | Red |
|-------|-------|--------|-----|
| pronunciation_accuracy | ≥ 80 | 60–79 | < 60 |
| prosody_score | ≥ 75 | 50–74 | < 50 |
| fluency_score | ≥ 80 | 60–79 | < 60 |
| speaking_rate | 120–180 WPM | 100–119 or 181–200 | outside |
| longest_pause | ≤ 1.5 s | 1.5–3 s | > 3 s |

Tune thresholds per role and locale; treat as signals, not pass/fail.

### 4. Useful aggregates from words/phonemes

```
words_correct_pct     = count(status=correct) / total words × 100
words_at_risk_pct     = count(status in mispronounced, partial) / total × 100
top_problem_words     = 5 lowest accuracy_score words (exclude stopwords)
filler_density        = count("um","uh","like","now") / total words  [from transcript]
answer_length_ratio   = speech_duration / expected_max_duration
segment_count         = len(transcript.segments)  → fragmentation
```

### 5. Transcript segments (from `transcript`)

- **Time to first word:** `segments[0].start` → hesitation before starting
- **Mid-answer pauses:** large gaps between `segment[i].end` and `segment[i+1].start`
- **Structure:** number of topic shifts (manual or LLM on segment text)

---

## Best practices for recruiters

1. **Always pass `reference_text`** when you have an interview question or script — otherwise `completeness_score` and pronunciation baseline are weak.

2. **Trust Whisper transcript for content; use assessment for delivery.** Read `transcript.text` for what they said; use scores for how they said it.

3. **Do not auto-reject on pronunciation alone.** Accent, names, and ASR errors skew `pronunciation_accuracy`. Combine with human review or word-level highlights.

4. **Compare candidates on the same question.** Scores are most useful relative to a cohort, not as absolute grades.

5. **English only for assessment.** Non-English responses will have `speech` but no `assessment`.

6. **Show recruiters summaries, not raw phonemes.** Export 4–6 KPIs + 3–5 highlighted words + link to video timestamp via `transcript.segments`.

---

## Example interpretation (sample `result.json`)

Candidate: Kuchiko Gift, sales/travel background, ~53 s English intro.

| Metric | Value | Interpretation |
|--------|-------|----------------|
| speaking_rate | 166.95 WPM | Fast, energetic — fits sales |
| speech_ratio | 98.18% | Very continuous; confident delivery |
| longest_pause | 0.85 s | No long freezes |
| fluency_score | 96.25 | Excellent pacing |
| prosody_score | 92.4 | Engaging, varied tone |
| pronunciation_accuracy | 67.9 | Moderate — likely inflated by wav2vec2 ASR errors on names/accent |
| completeness | 100 | Not meaningful (no separate reference script) |

**Recruiter takeaway:** Strong fluency and expressiveness for a customer-facing role; review pronunciation on business vocabulary manually or with word-level highlights (`quite`, proper nouns) rather than relying on the single accuracy number.

---

## Technical limitations (summary)

| Limitation | Impact |
|------------|--------|
| wav2vec2 ASR for pronunciation | Garbled `asr_transcript`; lowers accuracy score |
| No `reference_text` | Completeness ≈ 100%; pronunciation compares Whisper to itself |
| English-only assessment | No pronunciation scores for other languages |
| Heuristic prosody/fluency | Not trained on human recruiter labels |
| SpeechBrain lang-id confidence | Can disagree with Whisper; misleading if shown as “English confidence” |
| CPU inference | Slower; quality same as GPU for these models |

For research-grade English pronunciation scoring, a future upgrade path is GOPT + Kaldi GOP (see README).
