import React from 'react';
import { Button } from '@/components/ui/button';
import { Language, LANGUAGES } from '@/types/language';

interface LanguageSwitcherProps {
  currentLanguage: Language;
  onLanguageChange: (language: Language) => void;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({
  currentLanguage,
  onLanguageChange,
}) => {
  return (
    <div className="flex gap-2">
      {LANGUAGES.map((lang) => (
        <Button
          key={lang.language}
          variant={currentLanguage === lang.language ? "default" : "outline"}
          size="sm"
          onClick={() => onLanguageChange(lang.language)}
          className="flex items-center gap-2"
        >
          <span>{lang.flag}</span>
          <span>{lang.label}</span>
        </Button>
      ))}
    </div>
  );
}; 