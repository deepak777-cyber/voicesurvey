import { useState } from "react";

interface LocationData {
  country: string;
  language: string;
}

// Mapping of countries to preferred languages
const countryLanguageMap: Record<string, string> = {
  US: "en",
  GB: "en",
  CA: "en",
  AU: "en",
  ES: "es",
  MX: "es",
  AR: "es",
  CO: "es",
  FR: "fr",
  BE: "fr",
  CH: "fr",
  DE: "de",
  AT: "de",
  IT: "it",
  PT: "pt",
  BR: "pt",
  IN: "hi",
  CN: "zh",
  TW: "zh",
  HK: "zh",
};

export const useLocationLanguage = () => {
  const [language, setLanguage] = useState<string>("en");
  const [location, setLocation] = useState<LocationData | null>(null);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const detectLocationAndLanguage = async () => {
    setIsDetecting(true);
    setError(null);

    try {
      // Try to get user's location using browser's geolocation API
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              // Use a free IP geolocation service as fallback
              const response = await fetch("https://ipapi.co/json/");
              const data = await response.json();

              const detectedCountry = data.country_code || "US";
              const detectedLanguage =
                countryLanguageMap[detectedCountry] || "en";

              setLocation({
                country: detectedCountry,
                language: detectedLanguage,
              });
              setLanguage(detectedLanguage);
              setIsDetecting(false);
            } catch (err) {
              console.error("Error fetching location data:", err);
              setError("Failed to detect location");
              setIsDetecting(false);
            }
          },
          async () => {
            // Fallback to IP-based detection if geolocation is denied
            try {
              const response = await fetch("https://ipapi.co/json/");
              const data = await response.json();

              const detectedCountry = data.country_code || "US";
              const detectedLanguage =
                countryLanguageMap[detectedCountry] || "en";

              setLocation({
                country: detectedCountry,
                language: detectedLanguage,
              });
              setLanguage(detectedLanguage);
              setIsDetecting(false);
            } catch (err) {
              console.error("Error with IP geolocation:", err);
              setError("Failed to detect location");
              setIsDetecting(false);
            }
          }
        );
      } else {
        // No geolocation support, use IP-based detection
        const response = await fetch("https://ipapi.co/json/");
        const data = await response.json();

        const detectedCountry = data.country_code || "US";
        const detectedLanguage = countryLanguageMap[detectedCountry] || "en";

        setLocation({
          country: detectedCountry,
          language: detectedLanguage,
        });
        setLanguage(detectedLanguage);
        setIsDetecting(false);
      }
    } catch (err) {
      console.error("Error detecting location:", err);
      setError("Failed to detect location");
      setIsDetecting(false);
    }
  };

  return {
    language,
    setLanguage,
    location,
    isDetecting,
    error,
    detectLocationAndLanguage,
  };
};
