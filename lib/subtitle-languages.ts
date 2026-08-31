/**
 * Every language the Reely Player can actually fetch subtitles in, in its own
 * script.
 *
 * The same fifty the picker inside the player offers, because they come from the
 * same table there (reely-pro-player src/languages.mjs). A language is listed
 * only once a catalog was measured to answer for it: a row that never resolves
 * is worse than no row, because it is picked, waited on, and empty.
 *
 * Out here rather than in the settings panel because two surfaces choose from it
 * now — the Playback settings and the panel inside the player itself — and a
 * language offered in one and missing from the other is a bug nobody would
 * notice until somebody asked for Icelandic on a phone.
 */
export interface SubtitleLanguage {
  value: string
  label: string
  /** The English name, so a search for "arabic" finds العربية. */
  search: string
}

export const SUBTITLE_LANGUAGES: SubtitleLanguage[] = [
  { value: 'off', label: 'Off', search: 'off none disabled' },
  { value: 'ar', label: 'العربية', search: 'arabic' },
  { value: 'en', label: 'English', search: 'english' },
  { value: 'es', label: 'Español', search: 'spanish espanol' },
  { value: 'fr', label: 'Français', search: 'french francais' },
  { value: 'de', label: 'Deutsch', search: 'german deutsch' },
  { value: 'it', label: 'Italiano', search: 'italian italiano' },
  { value: 'pt', label: 'Português', search: 'portuguese portugues' },
  { value: 'ru', label: 'Русский', search: 'russian' },
  { value: 'tr', label: 'Türkçe', search: 'turkish turkce' },
  { value: 'id', label: 'Indonesia', search: 'indonesian bahasa' },
  { value: 'fa', label: 'فارسی', search: 'persian farsi' },
  { value: 'nl', label: 'Nederlands', search: 'dutch nederlands' },
  { value: 'pl', label: 'Polski', search: 'polish polski' },
  { value: 'sv', label: 'Svenska', search: 'swedish svenska' },
  { value: 'da', label: 'Dansk', search: 'danish dansk' },
  { value: 'no', label: 'Norsk', search: 'norwegian norsk' },
  { value: 'fi', label: 'Suomi', search: 'finnish suomi' },
  { value: 'cs', label: 'Čeština', search: 'czech cestina' },
  { value: 'sk', label: 'Slovenčina', search: 'slovak slovencina' },
  { value: 'hu', label: 'Magyar', search: 'hungarian magyar' },
  { value: 'ro', label: 'Română', search: 'romanian romana' },
  { value: 'el', label: 'Ελληνικά', search: 'greek' },
  { value: 'he', label: 'עברית', search: 'hebrew' },
  { value: 'uk', label: 'Українська', search: 'ukrainian' },
  { value: 'bg', label: 'Български', search: 'bulgarian' },
  { value: 'sr', label: 'Srpski', search: 'serbian srpski' },
  { value: 'hr', label: 'Hrvatski', search: 'croatian hrvatski' },
  { value: 'bs', label: 'Bosanski', search: 'bosnian bosanski' },
  { value: 'sl', label: 'Slovenščina', search: 'slovenian slovenscina' },
  { value: 'mk', label: 'Македонски', search: 'macedonian' },
  { value: 'sq', label: 'Shqip', search: 'albanian shqip' },
  { value: 'et', label: 'Eesti', search: 'estonian eesti' },
  { value: 'lv', label: 'Latviešu', search: 'latvian latviesu' },
  { value: 'lt', label: 'Lietuvių', search: 'lithuanian lietuviu' },
  { value: 'is', label: 'Íslenska', search: 'icelandic islenska' },
  { value: 'vi', label: 'Tiếng Việt', search: 'vietnamese tieng viet' },
  { value: 'th', label: 'ไทย', search: 'thai' },
  { value: 'ms', label: 'Melayu', search: 'malay melayu' },
  { value: 'zh', label: '中文', search: 'chinese mandarin zhongwen' },
  { value: 'ja', label: '日本語', search: 'japanese nihongo' },
  { value: 'ko', label: '한국어', search: 'korean hangul' },
  { value: 'hi', label: 'हिन्दी', search: 'hindi' },
  { value: 'bn', label: 'বাংলা', search: 'bengali bangla' },
  { value: 'ta', label: 'தமிழ்', search: 'tamil' },
  { value: 'te', label: 'తెలుగు', search: 'telugu' },
  { value: 'ml', label: 'മലയാളം', search: 'malayalam' },
  { value: 'ur', label: 'اردو', search: 'urdu' },
  { value: 'si', label: 'සිංහල', search: 'sinhala' },
  { value: 'km', label: 'ខ្មែរ', search: 'khmer cambodian' },
  { value: 'my', label: 'မြန်မာ', search: 'burmese myanmar' },
]

/** What to show for a stored code, including one we no longer offer. */
export function subtitleLabel(code: string | undefined): string {
  if (!code || code === 'off') return 'Off'
  return (
    SUBTITLE_LANGUAGES.find((language) => language.value === code)?.label ??
    code
  )
}
