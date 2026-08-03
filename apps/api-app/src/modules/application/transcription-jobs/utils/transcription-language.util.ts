/**
 * Maps a job transcription language value to a media-worker language code.
 * @param language - The language to map.
 * @returns The media-worker language code.
 */
export function mapTranscriptionLanguage(language?: string | null): string {
  if (!language) return 'auto';

  const normalized = language.trim().toLowerCase();
  if (!normalized || normalized === 'auto') return 'auto';

  const languageMap: Record<string, string> = {
    english: 'en',
    en: 'en',
    spanish: 'es',
    es: 'es',
    french: 'fr',
    fr: 'fr',
    german: 'de',
    de: 'de',
    hindi: 'hi',
    hi: 'hi',
  };

  return languageMap[normalized] ?? 'auto';
}
