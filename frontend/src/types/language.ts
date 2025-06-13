export type Language = "en" | "km";

export interface LanguageConfig {
  language: Language;
  label: string;
  flag: string;
}

export const LANGUAGES: LanguageConfig[] = [
  {
    language: "en",
    label: "English",
    flag: "🇺🇸",
  },
  {
    language: "km",
    label: "ខ្មែរ",
    flag: "🇰🇭",
  },
];
