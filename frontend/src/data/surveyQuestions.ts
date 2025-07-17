import { Language } from "@/types/language";

interface Option {
  value: number;
  name: string;
}

interface Question {
  id: string;
  type: "text" | "single-select" | "multi-select" | "rating";
  question: string;
  options?: Option[];
  required: boolean;
  showIf?: { questionId: string; value: number };
}

import baseQuestions from "./baseQuestions.json";
import en from "./en.json";
import km from "./km.json";

const translations: Record<Language, any> = { en, km };

export const getSurveyQuestions = (language: Language): Question[] => {
  const locale = translations[language];
  return (baseQuestions as any[]).map((q) => ({
    ...q,
    ...locale[q.id],
  }));
};
