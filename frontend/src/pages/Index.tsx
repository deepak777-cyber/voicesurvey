import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SurveyQuestion } from "@/components/SurveyQuestion";
import { VoiceService } from "@/services/VoiceService";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Language } from "@/types/language";
import { getSurveyQuestions } from "@/data/surveyQuestions";
import config from "@/config";
import { ThankYou } from "@/components/ThankYou";

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
}

interface Answer {
  questionId: string;
  answer: string;
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

// Add these utility functions before the Index component
function levenshteinDistance(str1: string, str2: string): number {
  const track = Array(str2.length + 1)
    .fill(null)
    .map(() => Array(str1.length + 1).fill(null));
  for (let i = 0; i <= str1.length; i += 1) {
    track[0][i] = i;
  }
  for (let j = 0; j <= str2.length; j += 1) {
    track[j][0] = j;
  }
  for (let j = 1; j <= str2.length; j += 1) {
    for (let i = 1; i <= str1.length; i += 1) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator // substitution
      );
    }
  }
  return track[str2.length][str1.length];
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findBestMatch(
  input: string,
  options: string[]
): { match: string; score: number } {
  const normalizedInput = normalizeText(input);
  let bestMatch = options[0];
  let bestScore = Infinity;

  options.forEach((option) => {
    const normalizedOption = normalizeText(option);

    // Try exact match first
    if (normalizedInput === normalizedOption) {
      bestMatch = option;
      bestScore = 0;
      return;
    }

    // Check if input contains the option or vice versa
    if (
      normalizedInput.includes(normalizedOption) ||
      normalizedOption.includes(normalizedInput)
    ) {
      const score =
        Math.abs(normalizedInput.length - normalizedOption.length) * 0.5;
      if (score < bestScore) {
        bestMatch = option;
        bestScore = score;
      }
      return;
    }

    // Try word-by-word matching
    const inputWords = normalizedInput.split(" ");
    const optionWords = normalizedOption.split(" ");
    const wordMatches = inputWords.filter((word) =>
      optionWords.some(
        (optWord) =>
          levenshteinDistance(word, optWord) <=
          Math.min(2, Math.floor(optWord.length / 3))
      )
    ).length;

    if (wordMatches > 0) {
      const score =
        inputWords.length -
        wordMatches +
        Math.abs(inputWords.length - optionWords.length) * 0.5;
      if (score < bestScore) {
        bestMatch = option;
        bestScore = score;
      }
      return;
    }

    // Fallback to Levenshtein distance
    const distance = levenshteinDistance(normalizedInput, normalizedOption);
    const score =
      distance / Math.max(normalizedInput.length, normalizedOption.length);
    if (score < bestScore) {
      bestMatch = option;
      bestScore = score;
    }
  });

  return { match: bestMatch, score: bestScore };
}

const Index = () => {
  const [currentLanguage, setCurrentLanguage] = useState<Language>("km");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>(() => {
    // Load answers from localStorage on component mount
    const savedAnswers = localStorage.getItem("surveyAnswers");
    return savedAnswers ? JSON.parse(savedAnswers) : [];
  });
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceService] = useState(() => new VoiceService());
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isVoiceSupported, setIsVoiceSupported] = useState(true);
  const { toast } = useToast();
  const [showThankYou, setShowThankYou] = useState(false);
  const [autoRecordTimeoutId, setAutoRecordTimeoutId] =
    useState<NodeJS.Timeout | null>(null);
  const autoRecordTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [hasNavigated, setHasNavigated] = useState(false);
  const navigationRef = useRef(false);
  const [isWaitingToRecord, setIsWaitingToRecord] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  const [isAwaitingConfirmation, setIsAwaitingConfirmation] = useState(false);
  const isListeningForConfirmationRef = useRef(false);
  const [iosConfirmationMessage, setIosConfirmationMessage] = useState<
    string | null
  >(null);
  const recordRetryCountRef = useRef(0);
  const isRetryingRef = useRef(false);
  const confirmationRetryCountRef = useRef(0);
  const isConfirmationRetryingRef = useRef(false);
  const [isActivatingMic, setIsActivatingMic] = useState(false);
  const [isLanguageSwitcherDisabled, setIsLanguageSwitcherDisabled] =
    useState(true);

  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const surveyQuestions = getSurveyQuestions(currentLanguage);
  const currentQuestion = surveyQuestions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / surveyQuestions.length) * 100;
  const isLastQuestion = currentQuestionIndex === surveyQuestions.length - 1;
  const isFirstQuestion = currentQuestionIndex === 0;

  // Save answers to localStorage whenever answers change
  useEffect(() => {
    localStorage.setItem("surveyAnswers", JSON.stringify(answers));
  }, [answers]);

  // Initialize voice service on component mount
  useEffect(() => {
    const initializeVoice = async () => {
      try {
        await voiceService.initialize();
        voiceService.setLanguage(currentLanguage);
        const isSupported = voiceService.isSupported();
        setIsVoiceSupported(isSupported);
        setIsVoiceEnabled(isSupported);

        if (!isSupported) {
          toast({
            title: "Voice Features Not Available",
            description:
              "Please ensure you've granted microphone permissions and are using a supported browser (Chrome or Safari).",
            variant: "default",
            duration: 6000,
          });
        }
        setIsInitialized(true);
      } catch (error) {
        console.error("Error initializing voice service:", error);
        setIsVoiceSupported(false);
        setIsVoiceEnabled(false);
        setIsInitialized(true);
      }
    };

    initializeVoice();

    return () => {
      voiceService.stopListening();
      voiceService.stopSpeaking();
      voiceService.reset();
    };
  }, []);

  // Update voice service language when language changes
  useEffect(() => {
    if (isInitialized) {
      voiceService.setLanguage(currentLanguage);
    }
  }, [currentLanguage, isInitialized]);

  // Handle question changes
  useEffect(() => {
    // Only proceed if voice service is initialized
    if (!isInitialized) {
      console.log("Waiting for voice service initialization...");
      return;
    }

    // Reset navigation flag when question changes
    console.log("Question changed to:", currentQuestionIndex);
    let isMounted = true;

    const setupQuestion = async () => {
      try {
        // Stop all voice activities first
        console.log("Stopping all voice activities...");
        voiceService.stopListening();
        voiceService.stopSpeaking();
        voiceService.reset();
        setIsListening(false);
        setIsSpeaking(false);
        setIsWaitingToRecord(false);

        // Clear any existing timeouts first
        if (autoRecordTimeoutRef.current) {
          console.log("Clearing existing timeout from ref");
          clearTimeout(autoRecordTimeoutRef.current);
          autoRecordTimeoutRef.current = null;
        }
        if (autoRecordTimeoutId) {
          console.log("Clearing existing timeout from state");
          clearTimeout(autoRecordTimeoutId);
          setAutoRecordTimeoutId(null);
        }

        // Wait for all cleanup to complete
        await new Promise((resolve) => setTimeout(resolve, 250));

        // Only proceed if still mounted
        if (!isMounted) return;

        // Reset navigation state
        navigationRef.current = false;
        setHasNavigated(false);

        // Only proceed if still mounted and voice is supported
        if (!isMounted || !isVoiceSupported) return;

        if (isVoiceEnabled && currentQuestion) {
          console.log(
            "Starting to read question:",
            currentQuestionIndex,
            "navigationRef:",
            navigationRef.current
          );
          await readQuestion();
        }
      } catch (error) {
        console.error("Error in setupQuestion:", error);
      }
    };

    setupQuestion();

    return () => {
      isMounted = false;
      // Clear timeouts in cleanup
      if (autoRecordTimeoutRef.current) {
        clearTimeout(autoRecordTimeoutRef.current);
        autoRecordTimeoutRef.current = null;
      }
      if (autoRecordTimeoutId) {
        clearTimeout(autoRecordTimeoutId);
        setAutoRecordTimeoutId(null);
      }
      setIsWaitingToRecord(false);
      voiceService.stopListening();
      voiceService.stopSpeaking();
      voiceService.reset();
    };
  }, [currentQuestionIndex, isVoiceEnabled, isInitialized, currentLanguage]);

  // Set start time when component mounts
  useEffect(() => {
    // Set start time when component mounts
    if (!localStorage.getItem("startTime")) {
      localStorage.setItem("startTime", new Date().toISOString());
    }
  }, []);

  // Clear answers and other data when component mounts
  useEffect(() => {
    const clearData = () => {
      localStorage.removeItem("surveyAnswers");
      localStorage.removeItem("unique_id");
      localStorage.removeItem("startTime");
      setAnswers([]);
      setCurrentQuestionIndex(0);
    };

    // Only clear data if we're starting fresh (URL has no question parameter)
    const urlParams = new URLSearchParams(window.location.search);
    const questionParam = urlParams.get("q");

    if (!questionParam) {
      clearData();
    } else {
      // If there's a question parameter, set that as the current question
      const questionIndex = parseInt(questionParam) - 1;
      if (
        !isNaN(questionIndex) &&
        questionIndex >= 0 &&
        questionIndex < surveyQuestions.length
      ) {
        setCurrentQuestionIndex(questionIndex);
      }
    }
  }, []); // Empty dependency array means this runs once when component mounts

  const calculateElapsedTime = () => {
    const startTime = new Date(
      localStorage.getItem("startTime") || new Date().toISOString()
    ).getTime();
    return Math.floor((Date.now() - startTime) / 1000); // Convert to seconds
  };

  const readQuestion = async (manual: boolean = false) => {
    if (!isVoiceEnabled) return;

    // If currently listening, stop listening before speaking
    if (isListening) {
      await voiceService.stopListening();
      setIsListening(false);
    }

    console.log(
      "Reading question. navigationRef:",
      navigationRef.current,
      "manual:",
      manual
    );

    // Only check navigation flag for automatic calls, not manual ones
    if (!manual && navigationRef.current) {
      console.log("Navigation flag is true before reading, skipping...");
      return;
    }

    // Clear any existing timeouts before starting
    if (autoRecordTimeoutRef.current) {
      clearTimeout(autoRecordTimeoutRef.current);
      autoRecordTimeoutRef.current = null;
    }
    if (autoRecordTimeoutId) {
      clearTimeout(autoRecordTimeoutId);
      setAutoRecordTimeoutId(null);
    }

    setIsSpeaking(true);
    setIsWaitingToRecord(false);

    try {
      let textToRead = currentQuestion.question;

      if (
        (currentQuestion.type === "single-select" ||
          currentQuestion.type === "multi-select") &&
        currentQuestion.options
      ) {
        if (currentLanguage === "en") {
          textToRead += ". Your options are: ";
          textToRead += currentQuestion.options
            .map((opt) => opt.name)
            .join(", ");

          if (currentQuestion.type === "multi-select") {
            textToRead +=
              '. You can select multiple options by saying them separated by "and".';
          }
        } else {
          textToRead += ". ជម្រើសរបស់អ្នកគឺ: ";
          textToRead += currentQuestion.options
            .map((opt) => opt.name)
            .join(", ");

          if (currentQuestion.type === "multi-select") {
            textToRead +=
              '. អ្នកអាចជ្រើសរើសជម្រើសច្រើនដោយនិយាយពួកវាដោយបំបែកដោយ "និង".';
          }
        }
      }

      if (currentQuestion.type === "rating") {
        if (currentLanguage === "en") {
          textToRead +=
            ". Please rate from 1 to 10, where 1 is not likely and 10 is very likely.";
        } else {
          textToRead +=
            ". សូមវាយតម្លៃពី 1 ដល់ 10 ដែល 1 គឺមិនទំនងនិង 10 គឺទំនងខ្លាំង.";
        }
      }

      await voiceService.speak(textToRead);

      // After speaking, always auto-record for Android/desktop (not iOS)
      if (!isIOS()) {
        setIsWaitingToRecord(true);
        const toastMessage =
          currentLanguage === "en"
            ? "Recording will start in a moment..."
            : "ការថតសំឡេងនឹងចាប់ផ្តើមបន្តិចទៀត...";
        toast({
          title: currentLanguage === "en" ? "Get Ready" : "រួចរាល់",
          description: toastMessage,
          duration: 1000,
        });
        const timeoutId = setTimeout(() => {
          if (isVoiceEnabled) {
            setIsWaitingToRecord(false);
            // Add a short delay to ensure isListening is false
            setTimeout(() => {
              startVoiceRecording();
            }, 100);
          } else {
            setIsWaitingToRecord(false);
          }
        }, 1500);
        autoRecordTimeoutRef.current = timeoutId;
        setAutoRecordTimeoutId(timeoutId);
      } else {
        // iOS: show tap-to-record button, do not auto-record
        setIsWaitingToRecord(true);
      }
    } catch (error) {
      console.error("Speech error:", error);
      setIsWaitingToRecord(false);
    } finally {
      setIsSpeaking(false);
    }
  };

  // Replace the existing matchVoiceToOption function with this enhanced version
  const matchVoiceToOption = (voiceInput: string): string => {
    if (!currentQuestion.options) return voiceInput;

    const normalize = normalizeText;
    const normalizedInput = normalize(voiceInput);

    // For single select questions
    if (currentQuestion.type === "single-select" && currentQuestion.options) {
      // Enhanced: Accept yes/no variants for yes/no questions with more variations
      const yesWords =
        currentLanguage === "en"
          ? [
              "yes",
              "yeah",
              "yep",
              "yup",
              "correct",
              "right",
              "sure",
              "okay",
              "confirm",
              "affirmative",
            ]
          : [
              "បាទ",
              "ចាស",
              "បាទចាស",
              "បាទ/ចាស",
              "បញ្ជាក់",
              "ត្រឹមត្រូវ",
              "ព្រម",
              "យល់ព្រម",
            ];

      const noWords =
        currentLanguage === "en"
          ? ["no", "nope", "nah", "incorrect", "wrong", "negative"]
          : [
              "ទេ",
              "មិនបញ្ជាក់",
              "ថតឡើងវិញ",
              "មិនត្រឹមត្រូវ",
              "មិនព្រម",
              "មិនយល់ព្រម",
            ];

      // Find if options are yes/no (in any language)
      const yesOption = currentQuestion.options.find((opt) =>
        yesWords.some((word) => normalize(opt.name) === normalize(word))
      );
      const noOption = currentQuestion.options.find((opt) =>
        noWords.some((word) => normalize(opt.name) === normalize(word))
      );

      // Check for yes/no matches with fuzzy matching
      if (
        yesOption &&
        yesWords.some(
          (word) =>
            levenshteinDistance(normalize(word), normalizedInput) <=
            Math.min(2, Math.floor(word.length / 3))
        )
      ) {
        return yesOption.name;
      }
      if (
        noOption &&
        noWords.some(
          (word) =>
            levenshteinDistance(normalize(word), normalizedInput) <=
            Math.min(2, Math.floor(word.length / 3))
        )
      ) {
        return noOption.name;
      }

      // For other single-select options, use fuzzy matching
      const optionNames = currentQuestion.options.map((opt) => opt.name);
      const { match, score } = findBestMatch(voiceInput, optionNames);

      // Only accept matches with good confidence
      const threshold = currentLanguage === "en" ? 0.4 : 0.5; // More lenient for English
      return score <= threshold ? match : voiceInput;
    }

    // For multi-select questions
    if (currentQuestion.type === "multi-select" && currentQuestion.options) {
      // Split input by common separators in both languages
      const inputParts = normalizedInput.split(
        /\s+and\s+|\s*,\s*|\s+or\s+|\s+plus\s+|\s+និង\s+|\s+ហើយ\s+|\s+រួមទាំង\s+/i
      );
      const matchedOptions: string[] = [];

      inputParts.forEach((part) => {
        const trimmedPart = part.trim();
        if (!trimmedPart) return;

        const { match, score } = findBestMatch(
          trimmedPart,
          currentQuestion.options!.map((opt) => opt.name)
        );

        // Only accept matches with good confidence
        const threshold = currentLanguage === "en" ? 0.4 : 0.5;
        if (score <= threshold && !matchedOptions.includes(match)) {
          matchedOptions.push(match);
        }
      });

      return matchedOptions.length > 0 ? matchedOptions.join(",") : voiceInput;
    }

    return voiceInput;
  };

  // Helper to handle retry logic
  // const handleRetry = async () => {
  //   if (recordRetryCountRef.current < 1 && !isRetryingRef.current) {
  //     isRetryingRef.current = true;
  //     recordRetryCountRef.current += 1;
  //     console.log(`[VoiceSurvey] handleRetry: Incremented retryCount to: ${recordRetryCountRef.current}, set isRetrying to true`);
  //     await voiceService.speak(
  //       currentLanguage === "en"
  //         ? "Not able to capture your answer, please try again."
  //         : "មិនអាចចាប់យកចម្លើយរបស់អ្នកបានទេ សូមព្យាយាមម្តងទៀត។"
  //     );
  //     setTimeout(() => {
  //       console.log('[VoiceSurvey] handleRetry: Retrying startVoiceRecording (auto-retry)');
  //       startVoiceRecording();
  //     }, 800);
  //   } else if (recordRetryCountRef.current >= 1) {
  //     const msg =
  //       currentLanguage === "en"
  //         ? "Please tap the microphone and try again."
  //         : "សូមចុចលើរូបមីក្រូហ្វូនហើយព្យាយាមម្តងទៀត។";
  //     toast({
  //       title:
  //         currentLanguage === "en"
  //           ? "No Answer Detected"
  //           : "រកមិនឃើញចម្លើយ",
  //       description: msg,
  //       variant: "destructive",
  //     });
  //     await voiceService.speak(msg);
  //     isRetryingRef.current = false;
  //     console.log('[VoiceSurvey] handleRetry: Max retries reached, set isRetrying to false (will reset on next question or success)');
  //   }
  // };

  const startVoiceRecording = async () => {
    if (showThankYou) {
      console.log(
        "[VoiceSurvey] Blocked: survey is complete, not starting recording"
      );
      return;
    }
    console.log(
      `[VoiceSurvey] startVoiceRecording called, retryCount: ${recordRetryCountRef.current}, isRetrying: ${isRetryingRef.current}`
    );
    if (!isVoiceEnabled) {
      console.log("[VoiceSurvey] Voice features are disabled");
      const errorMessage =
        currentLanguage === "en"
          ? "Please enable voice features to use voice recording."
          : "សូមបើកមុខងារសំឡេងដើម្បីប្រើការថតសំឡេង។";

      toast({
        title:
          currentLanguage === "en"
            ? "Voice Features Disabled"
            : "មុខងារសំឡេងត្រូវបានបិទ",
        description: errorMessage,
        variant: "destructive",
      });
      return;
    }

    if (!isVoiceSupported) {
      console.log("[VoiceSurvey] Voice is not supported in this browser");
      const errorMessage =
        currentLanguage === "en"
          ? "Please ensure you've granted microphone permissions and are using a supported browser."
          : "សូមធានាថាអ្នកបានផ្តល់ការអនុញ្ញាតមីក្រូហ្វូននិងប្រើអ្នករុករកដែលគាំទ្រ។";

      toast({
        title:
          currentLanguage === "en"
            ? "Browser Support Issue"
            : "បញ្ហាការគាំទ្រអ្នករុករក",
        description: errorMessage,
        variant: "destructive",
      });
      return;
    }

    // Don't start recording if already listening or speaking
    if (isListening || isSpeaking) {
      console.log(
        `[VoiceSurvey] Not starting recording: isListening=${isListening}, isSpeaking=${isSpeaking}`
      );
      return;
    }

    try {
      setIsActivatingMic(true);
      await new Promise((res) => setTimeout(res, 400));
      setIsListening(true);
      setIsActivatingMic(false);
      const result = await voiceService.startListening();
      console.log("[VoiceSurvey] voiceService.startListening result:", result);
      if (result) {
        recordRetryCountRef.current = 0; // Reset retry counter on success
        isRetryingRef.current = false;
        console.log(
          "[VoiceSurvey] Got result, resetting retryCount to 0 and isRetrying to false"
        );
        const matchedAnswer = matchVoiceToOption(result);
        console.log("[VoiceSurvey] Matched answer:", matchedAnswer);
        handleAnswerChange(matchedAnswer);

        // Check if a valid option was selected
        let isValidAnswer = false;
        if (
          currentQuestion.type === "single-select" &&
          currentQuestion.options
        ) {
          isValidAnswer = currentQuestion.options.some(
            (opt) => opt.name === matchedAnswer
          );
        } else if (
          currentQuestion.type === "multi-select" &&
          currentQuestion.options
        ) {
          const selectedOptions = matchedAnswer
            .split(",")
            .map((opt) => opt.trim());
          isValidAnswer = selectedOptions.some((selected) =>
            currentQuestion.options?.some((opt) => opt.name === selected)
          );
        } else if (currentQuestion.type === "text") {
          isValidAnswer = matchedAnswer.trim() !== "";
        }

        console.log("[VoiceSurvey] isValidAnswer:", isValidAnswer);

        if (isValidAnswer) {
          const successMessage =
            currentLanguage === "en"
              ? "Your response has been captured successfully."
              : "ការឆ្លើយតបរបស់អ្នកត្រូវបានចាប់យកដោយជោគជ័យ។";

          toast({
            title:
              currentLanguage === "en" ? "Voice Recorded" : "សំឡេងត្រូវបានថត",
            description: successMessage,
          });
        } else if (currentQuestion.type !== "text") {
          const errorMessage =
            currentLanguage === "en"
              ? "Please try again with one of the available options."
              : "សូមព្យាយាមម្តងទៀតជាមួយជម្រើសដែលមាន។";

          toast({
            title:
              currentLanguage === "en"
                ? "No Valid Option Selected"
                : "គ្មានជម្រើសត្រឹមត្រូវត្រូវបានជ្រើសរើស",
            description: errorMessage,
            variant: "destructive",
          });
        }
      } else {
        console.log(
          `[VoiceSurvey] No result, retryCount: ${recordRetryCountRef.current}, isRetrying: ${isRetryingRef.current}`
        );
        if (isVoiceEnabled && isVoiceSupported && !isIOS()) {
          // await handleRetry();
          // Instead, just show error and let user tap mic again
          const msg =
            currentLanguage === "en"
              ? "Please tap the microphone and try again."
              : "សូមចុចលើរូបមីក្រូហ្វូនហើយព្យាយាមម្តងទៀត។";
          toast({
            title: currentLanguage === "en" ? "Recording Error" : "កំហុសការថត",
            description: msg,
            variant: "destructive",
            duration: 6000,
          });
          await voiceService.speak(msg);
        } else if (isIOS()) {
          const msg =
            currentLanguage === "en"
              ? "Could not record your voice. Please try again."
              : "មិនអាចថតសំឡេងរបស់អ្នកបានទេ។ សូមព្យាយាមម្តងទៀត។";
          await voiceService.speak(msg);
        }
      }
    } catch (error) {
      console.log(`[VoiceSurvey] Error recording voice:`, error);
      let errorMessage =
        currentLanguage === "en"
          ? "Could not record your voice. Please try again."
          : "មិនអាចថតសំឡេងរបស់អ្នកបានទេ។ សូមព្យាយាមម្តងទៀត។";
      if (error instanceof Error) {
        const errorLower = error.message.toLowerCase();
        if (errorLower.includes("reset called")) {
          // Silently handle reset-triggered errors
          console.log("[VoiceSurvey] Reset called during recording");
          setIsListening(false);
          return;
        }
        if (
          errorLower.includes("permission") ||
          errorLower.includes("denied")
        ) {
          errorMessage =
            currentLanguage === "en"
              ? "Microphone access was denied. Please check your browser settings and make sure microphone permissions are enabled."
              : "ការចូលប្រើមីក្រូហ្វូនត្រូវបានបដិសេធ។ សូមពិនិត្យការកំណត់អ្នករុករករបស់អ្នកនិងធានាថាការអនុញ្ញាតមីក្រូហ្វូនត្រូវបានបើក។";
        } else if (
          errorLower.includes("not found") ||
          errorLower.includes("no microphone")
        ) {
          errorMessage =
            currentLanguage === "en"
              ? "No microphone found. Please check your device settings and ensure a microphone is available."
              : "រកមិនឃើញមីក្រូហ្វូនទេ។ សូមពិនិត្យការកំណត់ឧបករណ៍របស់អ្នកនិងធានាថាមីក្រូហ្វូនមាន។";
        } else if (
          errorLower.includes("not supported") ||
          errorLower.includes("mimetype")
        ) {
          errorMessage =
            currentLanguage === "en"
              ? "Your browser doesn't support the required audio format. Please try using Chrome or Firefox."
              : "អ្នករុករករបស់អ្នកមិនគាំទ្រទម្រង់អូឌីដែលត្រូវការទេ។ សូមព្យាយាមប្រើ Chrome ឬ Firefox។";
        } else if (
          errorLower.includes("in use") ||
          errorLower.includes("already")
        ) {
          errorMessage =
            currentLanguage === "en"
              ? "Microphone is being used by another application. Please close other apps that might be using the microphone."
              : "មីក្រូហ្វូនកំពុងត្រូវបានប្រើដោយកម្មវិធីផ្សេងទៀត។ សូមបិទកម្មវិធីផ្សេងទៀតដែលអាចប្រើមីក្រូហ្វូន។";
        } else if (
          errorLower.includes("secure") ||
          errorLower.includes("ssl")
        ) {
          errorMessage =
            currentLanguage === "en"
              ? "Voice recording requires a secure connection. Please ensure you're using HTTPS."
              : "ការថតសំឡេងត្រូវការការតភ្ជាប់ដែលមានសុវត្ថិភាព។ សូមធានាថាអ្នកកំពុងប្រើ HTTPS។";
        } else if (errorLower.includes("timeout")) {
          errorMessage =
            currentLanguage === "en"
              ? "Recording timed out. Please try speaking more quickly after pressing the record button."
              : "ការថតផុតកំណត់ពេលវេលា។ សូមព្យាយាមនិយាយលឿនជាងបន្ទាប់ពីចុចប៊ូតុងថត។";
        } else if (errorLower.includes("network")) {
          errorMessage =
            currentLanguage === "en"
              ? "A network error occurred. Please check your internet connection."
              : "កំហុសបណ្តាញបានកើតឡើង។ សូមពិនិត្យការតភ្ជាប់អ៊ីនធឺណិតរបស់អ្នក។";
        }
      }

      if (isIOS()) {
        const msg =
          currentLanguage === "en"
            ? "Could not record your voice. Please try again."
            : "មិនអាចថតសំឡេងរបស់អ្នកបានទេ។ សូមព្យាយាមម្តងទៀត។";
        await voiceService.speak(msg);
      }

      toast({
        title: currentLanguage === "en" ? "Recording Error" : "កំហុសការថត",
        description: errorMessage,
        variant: "destructive",
        duration: 6000,
      });
      // Retry logic for non-iOS
      if (isVoiceEnabled && isVoiceSupported && !isIOS()) {
        // await handleRetry();
        // Instead, just show error and let user tap mic again
        const msg =
          currentLanguage === "en"
            ? "Please tap the microphone and try again."
            : "សូមចុចលើរូបមីក្រូហ្វូនហើយព្យាយាមម្តងទៀត។";
        toast({
          title: currentLanguage === "en" ? "Recording Error" : "កំហុសការថត",
          description: msg,
          variant: "destructive",
          duration: 6000,
        });
        await voiceService.speak(msg);
      }
    } finally {
      setIsListening(false);
      setIsWaitingToRecord(false);
      console.log("[VoiceSurvey] Recording finished (finally block)");
    }
  };

  const stopVoiceRecording = () => {
    voiceService.stopListening();
    setIsListening(false);
  };

  const toggleVoice = () => {
    setIsVoiceEnabled(!isVoiceEnabled);
    if (isSpeaking) {
      voiceService.stopSpeaking();
      setIsSpeaking(false);
    }
    if (isListening) {
      stopVoiceRecording();
    }
  };

  const handleAnswerChange = (answer: string) => {
    // Set navigation flags when answer changes
    navigationRef.current = true;
    setHasNavigated(true);

    const existingAnswerIndex = answers.findIndex(
      (a) => a.questionId === currentQuestion.id
    );
    const newAnswer: Answer = { questionId: currentQuestion.id, answer };

    if (existingAnswerIndex >= 0) {
      const updatedAnswers = [...answers];
      updatedAnswers[existingAnswerIndex] = newAnswer;
      setAnswers(updatedAnswers);
    } else {
      setAnswers([...answers, newAnswer]);
    }

    // Confirmation logic for all devices
    if (answer.trim() !== "") {
      // For questions with options, only confirm if answer matches at least one valid option
      if (
        (currentQuestion.type === "single-select" ||
          currentQuestion.type === "multi-select") &&
        currentQuestion.options
      ) {
        let isValid = false;
        if (currentQuestion.type === "single-select") {
          isValid = currentQuestion.options.some(
            (opt) => opt.name === answer.trim()
          );
        } else if (currentQuestion.type === "multi-select") {
          const selectedOptions = answer
            .split(",")
            .map((opt) => opt.trim())
            .filter((opt) => opt);
          isValid = selectedOptions.some((selected) =>
            currentQuestion.options?.some((opt) => opt.name === selected)
          );
        }
        if (!isValid) {
          setIsAwaitingConfirmation(false);
          setIosConfirmationMessage(null);
          // Speak and toast: please try again with a valid option
          const msg =
            currentLanguage === "en"
              ? "Please try again with one of the available options."
              : "សូមព្យាយាមម្តងទៀតជាមួយជម្រើសដែលមាន។";
          voiceService.speak(msg);
          toast({
            title:
              currentLanguage === "en"
                ? "No Valid Option Selected"
                : "គ្មានជម្រើសត្រឹមត្រូវត្រូវបានជ្រើសរើស",
            description: msg,
            variant: "destructive",
          });
          return;
        }
      }

      // Divert flow for iOS devices
      if (isIOS()) {
        const message =
          currentLanguage === "en"
            ? `You answered: "${answer}". If this is incorrect, please tap to record again.`
            : `អ្នកបានឆ្លើយថា៖ "${answer}"។ ប្រសិនបើមិនត្រឹមត្រូវ សូមចុចដើម្បីថតម្តងទៀត។`;

        setIosConfirmationMessage(message);
        voiceService.speak(message);
        return; // End the flow here for iOS
      }

      // Standard confirmation flow for non-iOS
      setIsAwaitingConfirmation(true);
      voiceService.stopListening();
      const confirmText =
        currentLanguage === "en"
          ? `You answered: ${answer}. Do you confirm this answer?`
          : `អ្នកបានឆ្លើយថា: ${answer}។ តើអ្នកបញ្ជាក់ចម្លើយនេះឬទេ?`;
      (async () => {
        await voiceService.speak(confirmText);
        listenForConfirmation();
      })();
    } else {
      setIsAwaitingConfirmation(false);
      setIosConfirmationMessage(null);
    }
  };

  const getCurrentAnswer = () => {
    return (
      answers.find((a) => a.questionId === currentQuestion.id)?.answer || ""
    );
  };

  const canProceed = () => {
    const currentAnswer = getCurrentAnswer();
    if (!currentQuestion.required) return true;

    // For multi-select questions, check if at least one option is selected
    if (currentQuestion.type === "multi-select") {
      return (
        currentAnswer.trim() !== "" &&
        currentAnswer.split(",").some((opt) => opt.trim() !== "")
      );
    }

    // For single-select questions, ensure a valid option is selected
    if (currentQuestion.type === "single-select") {
      const selectedOption = currentQuestion.options?.find(
        (opt) => opt.name === currentAnswer.trim()
      );
      return !!selectedOption;
    }

    // For text and rating questions, ensure non-empty answer
    return currentAnswer.trim() !== "";
  };

  function generateUUID(): string {
    // Generates a UUID v4
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  const formatResponses = (answers: Answer[]) => {
    console.log("Formatting answers:", answers);

    const formattedResponses: { [key: string]: number | string } = {};

    answers.forEach((answer) => {
      // Skip empty answers
      if (!answer.answer.trim()) return;

      const question = surveyQuestions.find((q) => q.id === answer.questionId);
      if (!question) return;

      if (question.type === "multi-select") {
        // Parse selected option names from comma-separated string
        const selectedNames = answer.answer
          .split(",")
          .map((ans) => ans.trim())
          .filter((ans) => ans);

        // For each option in question.options, set 1 if selected, else 0
        question.options?.forEach((option) => {
          const key = `q${question.id}_${option.value}`;
          formattedResponses[key] = selectedNames.includes(option.name) ? 1 : 0;
        });
      } else if (question.options) {
        // For multiple choice, store the option value
        const option = question.options.find(
          (opt) => opt.name === answer.answer.trim()
        );
        if (option) {
          formattedResponses[`q${question.id}`] = option.value;
        }
      } else {
        // For text and rating questions, store answer as-is
        formattedResponses[`q${question.id}`] = answer.answer.trim();
      }
    });

    console.log("Formatted responses:", formattedResponses);
    return formattedResponses;
  };

  const saveIncompleteResponse = async () => {
    const formattedResponses = formatResponses(answers);
    console.log("Current answers state:", answers); // Debug log

    const payload = {
      unique_id: localStorage.getItem("unique_id") || generateUUID(),
      sys_start_time:
        localStorage.getItem("startTime") || new Date().toISOString(),
      sys_end_time: new Date().toISOString(),
      sys_device: navigator.userAgent,
      survey_status: "incomplete",
      elapsed_time: calculateElapsedTime(),
      language: currentLanguage,
      ...formattedResponses,
    };

    console.log("Saving incomplete response payload:", payload); // Debug log

    // Store unique_id and startTime in localStorage if not already present
    if (!localStorage.getItem("unique_id")) {
      localStorage.setItem("unique_id", payload.unique_id);
    }

    try {
      const res = await fetch(`${config.API_BASE_URL}/api/survey/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      console.log("Response from server for incomplete save:", data); // Debug log
    } catch (err) {
      console.error("Error saving incomplete survey:", err);
    }
  };

  const handleStartNewSurvey = () => {
    setShowThankYou(false);
    setCurrentQuestionIndex(0);
    setAnswers([]);
    localStorage.clear();
  };

  const handleSubmit = async () => {
    console.log("Submitting answers:", answers);

    const currentAnswers = answersRef.current;
    console.log("Submitting answers:", currentAnswers);

    // Validate required questions
    const missingRequired = surveyQuestions
      .filter((q) => q.required)
      .filter(
        (q) =>
          !currentAnswers.find((a) => a.questionId === q.id && a.answer.trim())
      );

    if (missingRequired.length > 0) {
      const errorMessage =
        currentLanguage === "en"
          ? "Please answer all required questions before submitting."
          : "សូមឆ្លើយសំណួរដែលត្រូវការទាំងអស់មុនពេលដាក់ស្នើ។";

      toast({
        title:
          currentLanguage === "en" ? "Required Questions" : "សំណួរដែលត្រូវការ",
        description: errorMessage,
        variant: "destructive",
      });
      return;
    }

    const formattedResponses = formatResponses(currentAnswers);
    const startTime =
      localStorage.getItem("startTime") || new Date().toISOString();

    const payload = {
      unique_id: localStorage.getItem("unique_id") || generateUUID(),
      sys_start_time: startTime,
      sys_end_time: new Date().toISOString(),
      sys_device: navigator.userAgent,
      survey_status: "completed",
      elapsed_time: calculateElapsedTime(),
      language: currentLanguage,
      ...formattedResponses,
    };

    console.log("Submitting payload:", payload);

    try {
      const res = await fetch(`${config.API_BASE_URL}/api/survey/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      console.log("Server response:", data);

      // Clear all stored data
      localStorage.clear();
      setAnswers([]);
      setShowThankYou(true); // Show thank you page instead of reloading

      const successMessage =
        currentLanguage === "en"
          ? "Thank you for your responses! Your feedback has been saved."
          : "សូមអរគុណសម្រាប់ការឆ្លើយតបរបស់អ្នក! ការអត្ថាធិប្បាយរបស់អ្នកត្រូវបានរក្សាទុក។";

      toast({
        title:
          currentLanguage === "en"
            ? "Survey Completed"
            : "ការស្ទង់មតិបានបញ្ចប់",
        description: successMessage,
      });
    } catch (err) {
      console.error("Error saving survey:", err);
      const errorMessage =
        currentLanguage === "en"
          ? "There was an error saving your responses. Please try again."
          : "មានកំហុសក្នុងការរក្សាទុកការឆ្លើយតបរបស់អ្នក។ សូមព្យាយាមម្តងទៀត។";

      toast({
        title: currentLanguage === "en" ? "Error" : "កំហុស",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleNext = (force = false) => {
    if (!force && !canProceed()) {
      const errorMessage =
        currentLanguage === "en"
          ? "Please provide an answer before proceeding."
          : "សូមផ្តល់ចម្លើយមុនពេលបន្ត។";

      toast({
        title: currentLanguage === "en" ? "Required Field" : "វាលដែលត្រូវការ",
        description: errorMessage,
        variant: "destructive",
      });
      return;
    }

    console.log("Next clicked. Setting navigation flags");
    cleanupBeforeNavigation();

    saveIncompleteResponse();

    // Add a small delay before changing the question
    setTimeout(() => {
      if (isLastQuestion) {
        cleanupBeforeNavigation();
        handleSubmit();
      } else {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      }
    }, 100);
  };

  const handlePrevious = () => {
    if (!isFirstQuestion) {
      console.log("Previous clicked. Setting navigation flags");
      cleanupBeforeNavigation();

      // Add a small delay before changing the question
      setTimeout(() => {
        setCurrentQuestionIndex(currentQuestionIndex - 1);
      }, 100);
    }
  };

  const handleStopSpeaking = () => {
    // Only allow stopping if an answer is being selected
    if (getCurrentAnswer()) {
      voiceService.stopSpeaking();
      setIsSpeaking(false);
    }
  };

  const handleLanguageChange = (language: Language) => {
    // Reset navigation flags
    navigationRef.current = false;
    setHasNavigated(false);

    // Clear any pending auto-record timeouts
    if (autoRecordTimeoutRef.current) {
      clearTimeout(autoRecordTimeoutRef.current);
      autoRecordTimeoutRef.current = null;
    }
    if (autoRecordTimeoutId) {
      clearTimeout(autoRecordTimeoutId);
      setAutoRecordTimeoutId(null);
    }

    // Stop all voice activities
    voiceService.stopListening();
    voiceService.stopSpeaking();
    voiceService.reset();
    setIsListening(false);
    setIsSpeaking(false);
    setIsWaitingToRecord(false);

    // Update language and reset state
    setCurrentLanguage(language);
    setCurrentQuestionIndex(0);
    setAnswers([]);
  };

  // Reset confirmation state and retry counter on question change
  useEffect(() => {
    setIsAwaitingConfirmation(false);
    setIosConfirmationMessage(null);
    recordRetryCountRef.current = 0;
    isRetryingRef.current = false;
    confirmationRetryCountRef.current = 0;
    isConfirmationRetryingRef.current = false;
    isListeningForConfirmationRef.current = false;
    setIsListening(false);
    setIsSpeaking(false);
    setIsWaitingToRecord(false);
    console.log(
      "[VoiceSurvey] Reset all flags/counters on question/language change"
    );
  }, [currentQuestionIndex, currentLanguage]);

  // Listen for voice confirmation (yes/no)
  const listenForConfirmation = async () => {
    if (showThankYou) {
      console.log(
        "[VoiceSurvey] Blocked: survey is complete, not starting confirmation listening"
      );
      return;
    }
    console.log("[VoiceSurvey] listenForConfirmation called");
    console.log(
      "[VoiceSurvey] isListeningForConfirmationRef:",
      isListeningForConfirmationRef.current,
      "isListening:",
      isListening
    );
    if (isListeningForConfirmationRef.current || isListening) {
      console.log("[VoiceSurvey] Blocked: already listening for confirmation");
      return;
    }
    isListeningForConfirmationRef.current = true;
    setIsActivatingMic(true);
    await new Promise((res) => setTimeout(res, 400));
    setIsListening(true);
    setIsActivatingMic(false);
    console.log(
      "[VoiceSurvey] Waiting 400ms before starting voiceService.startListening() for confirmation"
    );
    const normalize = (str: string) =>
      str
        .toLowerCase()
        .normalize("NFKC")
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    const yesWords =
      currentLanguage === "en"
        ? ["yes", "yeah", "yep", "confirm", "correct"]
        : ["បាទ", "ចាស", "បាទចាស", "បាទ/ចាស", "បញ្ជាក់"];
    const noWords =
      currentLanguage === "en"
        ? ["no", "nope", "incorrect"]
        : ["ទេ", "មិនបញ្ជាក់", "ថតឡើងវិញ"];
    try {
      const result = await voiceService.startListening();
      // Always reset both flags before any retry or exit
      setIsListening(false);
      isListeningForConfirmationRef.current = false;
      if (!result) {
        if (!isVoiceEnabled || !isVoiceSupported) return;
        // Confirmation retry logic
        // await handleConfirmationRetry();
        // Instead, just show error and let user tap to confirm again
        const msg =
          currentLanguage === "en"
            ? "Please tap to confirm your answer again."
            : "សូមចុចដើម្បីបញ្ជាក់ចម្លើយរបស់អ្នកម្តងទៀត។";
        toast({
          title:
            currentLanguage === "en"
              ? "Confirmation Not Understood"
              : "មិនយល់ការបញ្ជាក់",
          description: msg,
          variant: "destructive",
        });
        await voiceService.speak(msg);
        return;
      }
      const normalized = result.trim().toLowerCase();
      if (yesWords.some((word) => normalized.includes(normalize(word)))) {
        setIsAwaitingConfirmation(false);
        confirmationRetryCountRef.current = 0;
        isConfirmationRetryingRef.current = false;
        voiceService.speak(
          currentLanguage === "en" ? "Thank you." : "សូមអរគុណ។"
        );
        setTimeout(() => {
          if (isLastQuestion) {
            cleanupBeforeNavigation();
            handleSubmit();
          } else {
            handleNext(true);
          }
        }, 800);
      } else if (noWords.some((word) => normalized.includes(normalize(word)))) {
        setIsAwaitingConfirmation(false);
        confirmationRetryCountRef.current = 0;
        isConfirmationRetryingRef.current = false;
        handleAnswerChange("");
        (async () => {
          await voiceService.speak(
            currentLanguage === "en"
              ? "Please try again."
              : "សូមព្យាយាមម្តងទៀត។"
          );
          setTimeout(() => {
            startVoiceRecording();
          }, 800);
        })();
      } else {
        if (!isVoiceEnabled || !isVoiceSupported) return;
        // Confirmation retry logic
        // await handleConfirmationRetry();
        // Instead, just show error and let user tap to confirm again
        const msg =
          currentLanguage === "en"
            ? "Please tap to confirm your answer again."
            : "សូមចុចដើម្បីបញ្ជាក់ចម្លើយរបស់អ្នកម្តងទៀត។";
        toast({
          title:
            currentLanguage === "en"
              ? "Confirmation Not Understood"
              : "មិនយល់ការបញ្ជាក់",
          description: msg,
          variant: "destructive",
        });
        await voiceService.speak(msg);
        return;
      }
    } catch (error) {
      setIsListening(false);
      setIsActivatingMic(false);
      isListeningForConfirmationRef.current = false;
      if (!isVoiceEnabled || !isVoiceSupported) return;
      // Confirmation retry logic
      // await handleConfirmationRetry();
      // Instead, just show error and let user tap to confirm again
      const msg =
        currentLanguage === "en"
          ? "Please tap to confirm your answer again."
          : "សូមចុចដើម្បីបញ្ជាក់ចម្លើយរបស់អ្នកម្តងទៀត។";
      toast({
        title:
          currentLanguage === "en"
            ? "Confirmation Not Understood"
            : "មិនយល់ការបញ្ជាក់",
        description: msg,
        variant: "destructive",
      });
      await voiceService.speak(msg);
      return;
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setIsLanguageSwitcherDisabled(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  const cleanupBeforeNavigation = () => {
    console.log("Performing cleanup before navigation");
    navigationRef.current = true;
    setHasNavigated(true);
    setIsWaitingToRecord(false);

    if (autoRecordTimeoutRef.current) {
      console.log("Clearing timeout from ref in cleanup");
      clearTimeout(autoRecordTimeoutRef.current);
      autoRecordTimeoutRef.current = null;
    }
    if (autoRecordTimeoutId) {
      console.log("Clearing timeout from state in cleanup");
      clearTimeout(autoRecordTimeoutId);
      setAutoRecordTimeoutId(null);
    }

    voiceService.stopListening();
    voiceService.stopSpeaking();
    voiceService.reset();
    setIsListening(false);
    setIsSpeaking(false);
  };

  if (showThankYou) {
    return <ThankYou onStartNewSurvey={handleStartNewSurvey} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      {/* Logo */}
      <div className="fixed left-4 top-4 z-10">
        <img src="/logo.png" alt="Logo" className="h-8 md:h-12 w-auto" />
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="h-12 md:h-16"></div> {/* Spacer for logo */}
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            {currentLanguage === "en" ? "Voice Survey" : "ស្ទង់មតិដោយសំឡេង"}
          </h1>
          <p className="text-gray-600">
            {currentLanguage === "en"
              ? "Answer questions using your voice or keyboard"
              : "សូមឆ្លើយសំណួរដោយប្រើសំឡេងឬក្តារចុច"}
          </p>
        </div>

        {/* Language Switcher */}
        <div className="flex justify-center mb-6">
          <LanguageSwitcher
            currentLanguage={currentLanguage}
            onLanguageChange={handleLanguageChange}
            disabled={isLanguageSwitcherDisabled}
          />
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">
              {currentLanguage === "en" ? "Question" : "សំណួរ"}{" "}
              {currentQuestionIndex + 1}{" "}
              {currentLanguage === "en" ? "of" : "ក្នុងចំណោម"}{" "}
              {surveyQuestions.length}
            </span>
            <span className="text-sm text-gray-600">
              {Math.round(progress)}%{" "}
              {currentLanguage === "en" ? "Complete" : "បញ្ចប់"}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Voice Controls */}
        <div className="flex justify-center gap-4 mb-8">
          <Button
            variant={isVoiceEnabled ? "default" : "outline"}
            size="sm"
            onClick={toggleVoice}
            className="flex items-center gap-2"
          >
            {isVoiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            {currentLanguage === "en" ? "Voice" : "សំឡេង"}{" "}
            {isVoiceEnabled
              ? currentLanguage === "en"
                ? "On"
                : "បើក"
              : currentLanguage === "en"
              ? "Off"
              : "បិទ"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => readQuestion(true)}
            disabled={!isVoiceEnabled || isSpeaking}
            className="flex items-center gap-2"
          >
            <Volume2 size={16} />
            {isSpeaking
              ? currentLanguage === "en"
                ? "Reading..."
                : "កំពុងអាន..."
              : currentLanguage === "en"
              ? "Read Question"
              : "អានសំណួរ"}
          </Button>
        </div>

        {/* Question Card */}
        <Card className="p-6 mb-8 shadow-lg">
          <SurveyQuestion
            question={currentQuestion}
            answer={getCurrentAnswer()}
            onAnswerChange={handleAnswerChange}
            isListening={isListening}
            isActivatingMic={isActivatingMic}
            onStartRecording={startVoiceRecording}
            onStopRecording={stopVoiceRecording}
            voiceEnabled={isVoiceEnabled}
            isSpeaking={isSpeaking}
            onStopSpeaking={handleStopSpeaking}
            isWaitingToRecord={isWaitingToRecord}
            language={currentLanguage}
          />

          {/* iOS Confirmation Message */}
          {isIOS() && iosConfirmationMessage && (
            <div className="mt-4 text-center text-gray-700 italic">
              {iosConfirmationMessage}
            </div>
          )}

          {/* Non-iOS Confirmation UI */}
          {!isIOS() && getCurrentAnswer() && isAwaitingConfirmation && (
            <div className="mt-4 flex flex-col items-center">
              <div className="text-gray-700 mb-2">
                {currentLanguage === "en"
                  ? `You answered: "${getCurrentAnswer()}". Do you confirm this answer?`
                  : `អ្នកបានឆ្លើយថា: "${getCurrentAnswer()}". តើអ្នកបញ្ជាក់ចម្លើយនេះឬទេ?`}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setIsAwaitingConfirmation(false);
                    // Optionally, you can auto-advance here or just let user click Next
                  }}
                >
                  {currentLanguage === "en" ? "Yes, I confirm" : "បាទ/ចាស"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsAwaitingConfirmation(false);
                    handleAnswerChange("");
                    startVoiceRecording();
                  }}
                >
                  {currentLanguage === "en" ? "No, re-record" : "ទេ, ថតឡើងវិញ"}
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={isFirstQuestion}
            className="flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            {currentLanguage === "en" ? "Previous" : "មុន"}
          </Button>

          <Button
            onClick={() => handleNext(false)}
            disabled={!canProceed() || isAwaitingConfirmation}
            className="flex items-center gap-2"
          >
            {isLastQuestion
              ? currentLanguage === "en"
                ? "Submit"
                : "ដាក់ស្នើ"
              : currentLanguage === "en"
              ? "Next"
              : "បន្ទាប់"}
            <ArrowRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
