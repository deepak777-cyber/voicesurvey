import React, { useState, useEffect } from "react";
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

const surveyQuestions: Question[] = [
  {
    id: "1",
    type: "text",
    question: "What is your name?",
    required: true,
  },
  {
    id: "2",
    type: "single-select",
    question: "How would you rate your overall experience with our service?",
    options: [
      { value: 1, name: "Excellent" },
      { value: 2, name: "Good" },
      { value: 3, name: "Average" },
      { value: 4, name: "Poor" },
      { value: 5, name: "Very Poor" },
    ],
    required: true,
  },
  {
    id: "3",
    type: "single-select",
    question: "How satisfied are you with our customer service?",
    options: [
      { value: 1, name: "Very Dissatisfied" },
      { value: 2, name: "Dissatisfied" },
      { value: 3, name: "Neutral" },
      { value: 4, name: "Satisfied" },
      { value: 5, name: "Very Satisfied" },
    ],
    required: true,
  },
  {
    id: "4_1",
    type: "single-select",
    question: "Do you find Customer Support valuable?",
    options: [
      { value: 1, name: "Yes" },
      { value: 0, name: "No" },
    ],
    required: true,
  },
  {
    id: "4_2",
    type: "single-select",
    question: "Do you find Easy to Use valuable?",
    options: [
      { value: 1, name: "Yes" },
      { value: 0, name: "No" },
    ],
    required: true,
  },
  {
    id: "4_3",
    type: "single-select",
    question: "Do you find Good Value valuable?",
    options: [
      { value: 1, name: "Yes" },
      { value: 0, name: "No" },
    ],
    required: true,
  },
  {
    id: "4_4",
    type: "single-select",
    question: "Do you find Fast Delivery valuable?",
    options: [
      { value: 1, name: "Yes" },
      { value: 0, name: "No" },
    ],
    required: true,
  },
  {
    id: "4_5",
    type: "single-select",
    question: "Do you find Quality Products valuable?",
    options: [
      { value: 1, name: "Yes" },
      { value: 0, name: "No" },
    ],
    required: true,
  },
  {
    id: "5",
    type: "text",
    question: "What could we do to improve our service?",
    required: false,
  },
  {
    id: "6",
    type: "single-select",
    question: "How did you hear about us?",
    options: [
      { value: 1, name: "Social Media" },
      { value: 2, name: "Friend Referral" },
      { value: 3, name: "Search Engine" },
      { value: 4, name: "Advertisement" },
      { value: 5, name: "Other" },
    ],
    required: true,
  },
];

const Index = () => {
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

  const currentQuestion = surveyQuestions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / surveyQuestions.length) * 100;
  const isLastQuestion = currentQuestionIndex === surveyQuestions.length - 1;
  const isFirstQuestion = currentQuestionIndex === 0;

  // Save answers to localStorage whenever answers change
  useEffect(() => {
    localStorage.setItem("surveyAnswers", JSON.stringify(answers));
  }, [answers]);

  useEffect(() => {
    // Initialize voice service
    voiceService.initialize();

    // Check voice support on component mount
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

    return () => {
      voiceService.stopListening();
      voiceService.stopSpeaking();
    };
  }, [voiceService]);

  useEffect(() => {
    // Read the current question when it changes
    if (isVoiceEnabled && currentQuestion) {
      readQuestion();
    }
  }, [currentQuestionIndex, isVoiceEnabled]);

  useEffect(() => {
    // Set start time when component mounts
    if (!localStorage.getItem("startTime")) {
      localStorage.setItem("startTime", new Date().toISOString());
    }
  }, []);

  useEffect(() => {
    // Clear answers and other data when component mounts
    localStorage.removeItem("surveyAnswers");
    localStorage.removeItem("unique_id");
    localStorage.removeItem("startTime");
    setAnswers([]);
    setCurrentQuestionIndex(0);
  }, []); // Empty dependency array means this runs once when component mounts

  const calculateElapsedTime = () => {
    const startTime = new Date(
      localStorage.getItem("startTime") || new Date().toISOString()
    ).getTime();
    return Math.floor((Date.now() - startTime) / 1000); // Convert to seconds
  };

  const readQuestion = async () => {
    if (!isVoiceEnabled) return;

    setIsSpeaking(true);
    try {
      let textToRead = currentQuestion.question;

      // Add options for multiple choice and multi-select questions
      if (
        (currentQuestion.type === "single-select" ||
          currentQuestion.type === "multi-select") &&
        currentQuestion.options
      ) {
        textToRead += ". Your options are: ";
        textToRead += currentQuestion.options.map((opt) => opt.name).join(", ");

        if (currentQuestion.type === "multi-select") {
          textToRead +=
            '. You can select multiple options by saying them separated by "and".';
        }
      }

      // Add instruction for rating questions
      if (currentQuestion.type === "rating") {
        textToRead +=
          ". Please rate from 1 to 10, where 1 is not likely and 10 is very likely.";
      }

      await voiceService.speak(textToRead);

      // Add a brief pause and notification before starting recording
      toast({
        title: "Get Ready",
        description: "Recording will start in a moment...",
        duration: 1000,
      });

      // Wait longer after speaking finishes before starting recording
      setTimeout(() => {
        if (!isListening) {
          startVoiceRecording();
        }
      }, 1500);
    } catch (error) {
      console.error("Speech error:", error);
    } finally {
      setIsSpeaking(false);
    }
  };

  // Function to match voice input to multiple choice options
  const matchVoiceToOption = (voiceInput: string): string => {
    if (!currentQuestion.options) {
      return voiceInput;
    }

    // For rating questions (1-10), convert words to numbers and validate
    if (currentQuestion.type === "rating") {
      const normalizedInput = voiceInput.toLowerCase().trim();

      // Word to number mapping
      const wordToNumber: { [key: string]: string } = {
        one: "1",
        first: "1",
        two: "2",
        second: "2",
        three: "3",
        third: "3",
        four: "4",
        fourth: "4",
        five: "5",
        fifth: "5",
        six: "6",
        sixth: "6",
        seven: "7",
        seventh: "7",
        eight: "8",
        eighth: "8",
        nine: "9",
        ninth: "9",
        ten: "10",
        tenth: "10",
      };

      // Try to match word numbers first
      for (const [word, num] of Object.entries(wordToNumber)) {
        if (normalizedInput.includes(word)) {
          return num;
        }
      }

      // Try to match digits (including variations like "number 5" or "rating 8")
      const numberMatch = normalizedInput.match(/\b(\d+)\b/);
      if (numberMatch) {
        const number = parseInt(numberMatch[1]);
        if (number >= 1 && number <= 10) {
          return number.toString();
        }
      }

      return voiceInput;
    }

    const normalizedInput = voiceInput.toLowerCase().trim();

    // For multi-select questions, handle multiple selections
    if (currentQuestion.type === "multi-select" && currentQuestion.options) {
      const inputParts = normalizedInput.split(/\s+and\s+|\s*,\s*/);
      const matchedOptions: string[] = [];

      inputParts.forEach((part) => {
        const trimmedPart = part.trim();
        const match = currentQuestion.options?.find(
          (option) =>
            option.name.toLowerCase() === trimmedPart ||
            option.name.toLowerCase().includes(trimmedPart) ||
            trimmedPart.includes(option.name.toLowerCase())
        );
        if (match && !matchedOptions.includes(match.name)) {
          matchedOptions.push(match.name);
        }
      });

      return matchedOptions.length > 0 ? matchedOptions.join(",") : voiceInput;
    }

    // For single select questions
    if (currentQuestion.type === "single-select" && currentQuestion.options) {
      // Try exact match first
      const exactMatch = currentQuestion.options.find(
        (option) => option.name.toLowerCase() === normalizedInput
      );
      if (exactMatch) {
        return exactMatch.name;
      }

      // Try partial match if no exact match found
      const partialMatch = currentQuestion.options.find(
        (option) =>
          option.name.toLowerCase().includes(normalizedInput) ||
          normalizedInput.includes(option.name.toLowerCase())
      );
      if (partialMatch) {
        return partialMatch.name;
      }
    }

    return voiceInput;
  };

  const startVoiceRecording = async () => {
    if (!isVoiceEnabled) {
      toast({
        title: "Voice Features Disabled",
        description: "Please enable voice features to use voice recording.",
        variant: "destructive",
      });
      return;
    }

    if (!isVoiceSupported) {
      toast({
        title: "Browser Support Issue",
        description:
          "Please ensure you've granted microphone permissions and are using a supported browser.",
        variant: "destructive",
      });
      return;
    }

    // Don't start recording if already listening or still speaking
    if (isListening || isSpeaking) {
      return;
    }

    setIsListening(true);
    try {
      // Show recording started toast
      toast({
        title: "Recording Started",
        description: "Listening for your response...",
        duration: 2000,
      });

      const result = await voiceService.startListening();
      if (result) {
        const matchedAnswer = matchVoiceToOption(result);

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

        handleAnswerChange(matchedAnswer);

        if (isValidAnswer) {
          toast({
            title: "Voice Recorded",
            description: "Your response has been captured successfully.",
          });
        } else if (currentQuestion.type !== "text") {
          toast({
            title: "No Valid Option Selected",
            description: "Please try again with one of the available options.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error("Error recording voice:", error);
      let errorMessage = "Could not record your voice. Please try again.";

      if (error instanceof Error) {
        const errorLower = error.message.toLowerCase();

        if (
          errorLower.includes("permission") ||
          errorLower.includes("denied")
        ) {
          errorMessage =
            "Microphone access was denied. Please check your browser settings and make sure microphone permissions are enabled.";
        } else if (
          errorLower.includes("not found") ||
          errorLower.includes("no microphone")
        ) {
          errorMessage =
            "No microphone found. Please check your device settings and ensure a microphone is available.";
        } else if (
          errorLower.includes("not supported") ||
          errorLower.includes("mimetype")
        ) {
          errorMessage =
            "Your browser doesn't support the required audio format. Please try using Chrome or Firefox.";
        } else if (
          errorLower.includes("in use") ||
          errorLower.includes("already")
        ) {
          errorMessage =
            "Microphone is being used by another application. Please close other apps that might be using the microphone.";
        } else if (
          errorLower.includes("secure") ||
          errorLower.includes("ssl")
        ) {
          errorMessage =
            "Voice recording requires a secure connection. Please ensure you're using HTTPS.";
        } else if (errorLower.includes("timeout")) {
          errorMessage =
            "Recording timed out. Please try speaking more quickly after pressing the record button.";
        } else if (errorLower.includes("network")) {
          errorMessage =
            "A network error occurred. Please check your internet connection.";
        }
      }

      toast({
        title: "Recording Error",
        description: errorMessage,
        variant: "destructive",
        duration: 6000,
      });
    } finally {
      setIsListening(false);
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
      language: "en",
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

    // Validate required questions
    const missingRequired = surveyQuestions
      .filter((q) => q.required)
      .filter(
        (q) => !answers.find((a) => a.questionId === q.id && a.answer.trim())
      );

    if (missingRequired.length > 0) {
      toast({
        title: "Required Questions",
        description: "Please answer all required questions before submitting.",
        variant: "destructive",
      });
      return;
    }

    const formattedResponses = formatResponses(answers);
    const startTime =
      localStorage.getItem("startTime") || new Date().toISOString();

    const payload = {
      unique_id: localStorage.getItem("unique_id") || generateUUID(),
      sys_start_time: startTime,
      sys_end_time: new Date().toISOString(),
      sys_device: navigator.userAgent,
      survey_status: "completed",
      elapsed_time: calculateElapsedTime(),
      language: "en",
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

      toast({
        title: "Survey Completed",
        description:
          "Thank you for your responses! Your feedback has been saved.",
      });
    } catch (err) {
      console.error("Error saving survey:", err);
      toast({
        title: "Error",
        description:
          "There was an error saving your responses. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleNext = () => {
    if (!canProceed()) {
      toast({
        title: "Required Field",
        description: "Please provide an answer before proceeding.",
        variant: "destructive",
      });
      return;
    }

    saveIncompleteResponse();

    if (isLastQuestion) {
      handleSubmit();
    } else {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstQuestion) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleStopSpeaking = () => {
    // Only allow stopping if an answer is being selected
    if (getCurrentAnswer()) {
      voiceService.stopSpeaking();
      setIsSpeaking(false);
    }
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
            Voice Survey
          </h1>
          <p className="text-gray-600">
            Answer questions using your voice or keyboard
          </p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">
              Question {currentQuestionIndex + 1} of {surveyQuestions.length}
            </span>
            <span className="text-sm text-gray-600">
              {Math.round(progress)}% Complete
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
            Voice {isVoiceEnabled ? "On" : "Off"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={readQuestion}
            disabled={!isVoiceEnabled || isSpeaking}
            className="flex items-center gap-2"
          >
            <Volume2 size={16} />
            {isSpeaking ? "Reading..." : "Read Question"}
          </Button>
        </div>

        {/* Question Card */}
        <Card className="p-6 mb-8 shadow-lg">
          <SurveyQuestion
            question={currentQuestion}
            answer={getCurrentAnswer()}
            onAnswerChange={handleAnswerChange}
            isListening={isListening}
            onStartRecording={startVoiceRecording}
            onStopRecording={stopVoiceRecording}
            voiceEnabled={isVoiceEnabled}
            isSpeaking={isSpeaking}
            onStopSpeaking={handleStopSpeaking}
          />
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
            Previous
          </Button>

          <Button
            onClick={handleNext}
            disabled={!canProceed()}
            className="flex items-center gap-2"
          >
            {isLastQuestion ? "Submit" : "Next"}
            <ArrowRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
