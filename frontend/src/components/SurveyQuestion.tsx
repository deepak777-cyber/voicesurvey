import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Mic, MicOff } from "lucide-react";

interface Option {
  value: number;
  name: string;
}

interface Question {
  id: string;
  type: "text" | "multiple-choice" | "multi-select" | "rating";
  question: string;
  options?: Option[];
  required: boolean;
}

interface SurveyQuestionProps {
  question: Question;
  answer: string;
  onAnswerChange: (answer: string) => void;
  isListening: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  voiceEnabled: boolean;
  isSpeaking: boolean;
}

export const SurveyQuestion: React.FC<SurveyQuestionProps> = ({
  question,
  answer,
  onAnswerChange,
  isListening,
  onStartRecording: parentStartRecording,
  onStopRecording: parentStopRecording,
  voiceEnabled,
  isSpeaking,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    setError(null);
    setIsProcessing(false);
    parentStartRecording();
  };

  const stopRecording = () => {
    setIsProcessing(true);
    parentStopRecording();
    // Reset processing state after a delay
    setTimeout(() => {
      setIsProcessing(false);
    }, 1000);
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64String = (reader.result as string).split(",")[1];
          resolve(base64String);
        };
      });
      reader.readAsDataURL(audioBlob);

      const base64Data = await base64Promise;

      // Call our serverless function
      const response = await fetch("/.netlify/functions/transcribe", {
        method: "POST",
        body: base64Data,
      });

      if (!response.ok) {
        throw new Error(`Transcription failed: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.results?.channels[0]?.alternatives[0]?.transcript) {
        const transcript = data.results.channels[0].alternatives[0].transcript;
        const matchedAnswer = matchVoiceToOption(transcript);
        onAnswerChange(matchedAnswer);
        setError(null);
      } else if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      console.error("Transcription failed:", err);
      if (!answer) {
        setError("Failed to transcribe audio");
      }
    }
  };

  const handleSliderChange = (value: number[]) => {
    onAnswerChange(value[0].toString());
  };

  const handleMultiSelectChange = (optionName: string, checked: boolean) => {
    const currentSelections = answer ? answer.split(",").filter(Boolean) : [];

    if (checked) {
      if (!currentSelections.includes(optionName)) {
        const newSelections = [...currentSelections, optionName];
        onAnswerChange(newSelections.join(","));
      }
    } else {
      const newSelections = currentSelections.filter(
        (item) => item !== optionName
      );
      onAnswerChange(newSelections.join(","));
    }
  };

  const isOptionSelected = (optionName: string): boolean => {
    if (!answer) return false;
    const selections = answer.split(",").filter(Boolean);
    return selections.includes(optionName);
  };

  // Function to match voice input to multiple choice options
  const matchVoiceToOption = (voiceInput: string): string => {
    if (!question.options) return voiceInput;

    const normalizedInput = voiceInput
      .toLowerCase()
      .trim()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
      .replace(/\s+/g, " ");

    console.log("Matching normalized voice input:", normalizedInput);

    // For multi-select, handle multiple selections
    if (question.type === "multi-select") {
      const inputParts = normalizedInput.split(
        /\s+and\s+|\s*,\s*|\s+or\s+|\s+plus\s+/i
      );
      const matchedOptions: string[] = [];

      inputParts.forEach((part) => {
        const trimmedPart = part.trim();
        if (!trimmedPart) return;

        // Try exact match first
        const exactMatch = question.options?.find(
          (option) =>
            option.name.toLowerCase().replace(/[^\w\s]/g, "") === trimmedPart
        );
        if (exactMatch && !matchedOptions.includes(exactMatch.name)) {
          matchedOptions.push(exactMatch.name);
          return;
        }

        // Try fuzzy matching with Levenshtein distance
        const fuzzyMatches = question.options
          ?.map((option) => ({
            option,
            distance: levenshteinDistance(
              option.name.toLowerCase().replace(/[^\w\s]/g, ""),
              trimmedPart
            ),
          }))
          .sort((a, b) => a.distance - b.distance);

        if (
          fuzzyMatches &&
          fuzzyMatches[0].distance <= Math.min(3, trimmedPart.length / 3)
        ) {
          const bestMatch = fuzzyMatches[0].option.name;
          if (!matchedOptions.includes(bestMatch)) {
            matchedOptions.push(bestMatch);
          }
        }
      });

      if (matchedOptions.length > 0) {
        console.log("Multi-select matches found:", matchedOptions);
        return matchedOptions.join(",");
      }
    }

    // For single selection, try exact match first
    const exactMatch = question.options.find(
      (option) =>
        option.name.toLowerCase().replace(/[^\w\s]/g, "") === normalizedInput
    );
    if (exactMatch) {
      console.log("Exact match found:", exactMatch.name);
      return exactMatch.name;
    }

    // Try fuzzy matching for single selection
    const fuzzyMatches = question.options
      .map((option) => ({
        option,
        distance: levenshteinDistance(
          option.name.toLowerCase().replace(/[^\w\s]/g, ""),
          normalizedInput
        ),
      }))
      .sort((a, b) => a.distance - b.distance);

    if (fuzzyMatches[0].distance <= Math.min(3, normalizedInput.length / 3)) {
      console.log("Fuzzy match found:", fuzzyMatches[0].option.name);
      return fuzzyMatches[0].option.name;
    }

    // For rating questions, extract numbers and validate range
    if (question.type === "rating") {
      const numbers = normalizedInput.match(
        /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b/i
      );
      if (numbers) {
        const number = convertWordToNumber(numbers[1]);
        if (number >= 1 && number <= 10) {
          console.log("Number extracted for rating:", number);
          return number.toString();
        }
      }
    }

    console.log("No match found, returning original input:", voiceInput);
    return voiceInput;
  };

  // Helper function to calculate Levenshtein distance for fuzzy matching
  const levenshteinDistance = (str1: string, str2: string): number => {
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
          track[j][i - 1] + 1,
          track[j - 1][i] + 1,
          track[j - 1][i - 1] + indicator
        );
      }
    }

    return track[str2.length][str1.length];
  };

  // Helper function to convert word numbers to digits
  const convertWordToNumber = (word: string): number => {
    const wordToNum: { [key: string]: number } = {
      zero: 0,
      one: 1,
      two: 2,
      three: 3,
      four: 4,
      five: 5,
      six: 6,
      seven: 7,
      eight: 8,
      nine: 9,
      ten: 10,
    };

    const lowercaseWord = word.toLowerCase();
    return wordToNum[lowercaseWord] !== undefined
      ? wordToNum[lowercaseWord]
      : parseInt(word);
  };

  const renderVoiceButton = () => {
    if (!voiceEnabled) return null;

    return (
      <div className="flex flex-col items-center mt-4">
        <Button
          variant={isListening ? "destructive" : "outline"}
          size="lg"
          onClick={isListening ? stopRecording : startRecording}
          disabled={isProcessing || isSpeaking}
          className={`flex items-center gap-2 transition-all duration-200 w-full sm:w-auto justify-center ${
            isListening ? "animate-pulse bg-red-500 hover:bg-red-600" : ""
          }`}
        >
          {isListening ? <MicOff size={20} /> : <Mic size={20} />}
          {isProcessing
            ? "Processing..."
            : isSpeaking
            ? "Reading..."
            : isListening
            ? "Tap to Stop"
            : "Tap to Record"}
        </Button>
        {isListening && (
          <div className="mt-4 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-full animate-pulse">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              Recording... Tap to stop
            </div>
          </div>
        )}
        {error && (
          <div className="mt-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            <p className="font-medium">Recording Error</p>
            <p>{error}</p>
          </div>
        )}
      </div>
    );
  };

  const renderQuestionInput = () => {
    switch (question.type) {
      case "text":
        return (
          <div className="space-y-4">
            <Textarea
              placeholder="Type your answer here or use voice recording..."
              value={answer}
              onChange={(e) => onAnswerChange(e.target.value)}
              className="min-h-[120px] text-lg"
            />
            {renderVoiceButton()}
          </div>
        );

      case "multiple-choice":
        return (
          <div className="space-y-4">
            <RadioGroup
              value={answer}
              onValueChange={onAnswerChange}
              className="space-y-3"
            >
              {question.options?.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <RadioGroupItem
                    value={option.name}
                    id={`option-${option.value}`}
                  />
                  <Label
                    htmlFor={`option-${option.value}`}
                    className="text-lg cursor-pointer flex-1 py-2"
                  >
                    {option.name}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">
                Or say your choice aloud:
              </p>
              {renderVoiceButton()}
            </div>
          </div>
        );

      case "multi-select":
        return (
          <div className="space-y-4">
            <div className="space-y-3">
              {question.options?.map((option) => (
                <div key={option.value} className="flex items-center space-x-3">
                  <Checkbox
                    id={`multi-option-${option.value}`}
                    checked={isOptionSelected(option.name)}
                    onCheckedChange={(checked) =>
                      handleMultiSelectChange(option.name, !!checked)
                    }
                  />
                  <Label
                    htmlFor={`multi-option-${option.value}`}
                    className="text-lg cursor-pointer flex-1 py-2"
                  >
                    {option.name}
                  </Label>
                </div>
              ))}
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">
                Or say your choices separated by "and":
              </p>
              {renderVoiceButton()}
            </div>
          </div>
        );

      case "rating":
        const rating = answer ? parseInt(answer) : 5;
        return (
          <div className="space-y-6">
            <div className="px-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>1 - Not likely</span>
                <span>10 - Very likely</span>
              </div>
              <Slider
                value={[rating]}
                onValueChange={handleSliderChange}
                max={10}
                min={1}
                step={1}
                className="w-full"
              />
              <div className="text-center mt-4">
                <span className="text-2xl font-bold text-blue-600">
                  {rating}
                </span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">
                Or say a number from 1 to 10:
              </p>
              {renderVoiceButton()}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {question.question}
        </h2>
        {question.required && (
          <p className="text-sm text-red-600">* Required</p>
        )}
      </div>

      {renderQuestionInput()}

      {isListening && (
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-full">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
            Listening... Speak now
          </div>
        </div>
      )}
    </div>
  );
};
