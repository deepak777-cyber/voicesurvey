import React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";

interface LanguageSelectorProps {
  currentLanguage: string;
  onLanguageChange: (language: string) => void;
  onDetectLocation: () => void;
  isDetecting: boolean;
}

const languages = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "pt", name: "Português", flag: "🇵🇹" },
  { code: "hi", name: "हिंदी", flag: "🇮🇳" },
  { code: "zh", name: "中文", flag: "🇨🇳" },
];

const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  currentLanguage,
  onLanguageChange,
  onDetectLocation,
  isDetecting,
}) => {
  const currentLang =
    languages.find((lang) => lang.code === currentLanguage) || languages[0];

  return (
    <div className="flex items-center gap-4 p-4 bg-background border-b">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{currentLang.flag}</span>
        <Select value={currentLanguage} onValueChange={onLanguageChange}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {languages.map((lang) => (
              <SelectItem key={lang.code} value={lang.code}>
                <div className="flex items-center gap-2">
                  <span>{lang.flag}</span>
                  <span>{lang.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onDetectLocation}
        disabled={isDetecting}
        className="flex items-center gap-2"
      >
        <MapPin className="h-4 w-4" />
        {isDetecting ? "Detecting..." : "Auto-detect"}
      </Button>
    </div>
  );
};

export default LanguageSelector;
