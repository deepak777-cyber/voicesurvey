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
import { ThankYou } from "@/components/ThankYou";

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
    type: "multiple-choice",
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
    type: "rating",
    question:
      "On a scale of 1 to 10, how likely are you to recommend us to a friend?",
    required: true,
  },
  {
    id: "4",
    type: "multi-select",
    question:
      "Which of the following features do you find most valuable? (Select all that apply)",
    options: [
      { value: 1, name: "Customer Support" },
      { value: 2, name: "Easy to Use" },
      { value: 3, name: "Good Value" },
      { value: 4, name: "Fast Delivery" },
      { value: 5, name: "Quality Products" },
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
    type: "multiple-choice",
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
        (currentQuestion.type === "multiple-choice" ||
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
    } catch (error) {
      console.error("Error reading question:", error);
      // Only show error toast if it's a real error, not just an end event
      if (error instanceof Error && error.message !== "Speech ended") {
        toast({
          title: "Voice Error",
          description: "Could not read the question aloud.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSpeaking(false);
    }
  };

  // Function to match voice input to multiple choice options
  const matchVoiceToOption = (voiceInput: string): string => {
    if (!currentQuestion.options && currentQuestion.type !== "rating") {
      return voiceInput;
    }

    const normalizedInput = voiceInput.toLowerCase().trim();
    console.log(
      "Matching voice input:",
      normalizedInput,
      "to options:",
      currentQuestion.options
    );

    // For multi-select, handle multiple selections separated by "and"
    if (currentQuestion.type === "multi-select" && currentQuestion.options) {
      const inputParts = normalizedInput.split(/\s+and\s+|\s*,\s*/);
      const matchedOptions: string[] = [];

      inputParts.forEach((part) => {
        const trimmedPart = part.trim();

        // Find exact match
        const exactMatch = currentQuestion.options?.find(
          (option) => option.name.toLowerCase() === trimmedPart
        );
        if (exactMatch && !matchedOptions.includes(exactMatch.name)) {
          matchedOptions.push(exactMatch.name);
          return;
        }

        // Find partial match
        const partialMatch = currentQuestion.options?.find(
          (option) =>
            option.name.toLowerCase().includes(trimmedPart) ||
            trimmedPart.includes(option.name.toLowerCase())
        );
        if (partialMatch && !matchedOptions.includes(partialMatch.name)) {
          matchedOptions.push(partialMatch.name);
        }
      });

      if (matchedOptions.length > 0) {
        console.log("Multi-select matches found:", matchedOptions);
        return matchedOptions.join(",");
      }
    }

    // For single select questions
    if (currentQuestion.type === "multiple-choice" && currentQuestion.options) {
      // Find exact match (case insensitive)
      const exactMatch = currentQuestion.options.find(
        (option) => option.name.toLowerCase() === normalizedInput
      );
      if (exactMatch) {
        console.log("Exact match found:", exactMatch.name);
        return exactMatch.name;
      }

      // Find partial match
      const partialMatch = currentQuestion.options.find(
        (option) =>
          option.name.toLowerCase().includes(normalizedInput) ||
          normalizedInput.includes(option.name.toLowerCase())
      );
      if (partialMatch) {
        console.log("Partial match found:", partialMatch.name);
        return partialMatch.name;
      }
    }

    // For rating questions
    if (currentQuestion.type === "rating") {
      const numberMatch = voiceInput.match(/\b(\d+)\b/);
      if (numberMatch) {
        const number = parseInt(numberMatch[1]);
        if (number >= 1 && number <= 10) {
          console.log("Number extracted for rating:", number);
          return number.toString();
        }
      }
    }

    console.log("No match found, returning original input:", voiceInput);
    return voiceInput;
  };

  const startVoiceRecording = async () => {
    if (!isVoiceEnabled) {
      toast({
        title: "Voice Disabled",
        description: "Please enable voice features to use voice recording.",
        variant: "destructive",
      });
      return;
    }

    setIsListening(true);
    try {
      const transcript = await voiceService.startListening();
      if (transcript) {
        const matchedAnswer = matchVoiceToOption(transcript);
        handleAnswerChange(matchedAnswer);
        toast({
          title: "Voice Recorded",
          description: "Your response has been captured successfully.",
        });
      }
    } catch (error) {
      console.error("Error recording voice:", error);
      let errorMessage = "Could not record your voice. Please try again.";

      if (error instanceof Error) {
        switch (error.message) {
          case "No speech detected":
            errorMessage = "No speech was detected. Please try speaking again.";
            break;
          case "Could not transcribe audio":
            errorMessage =
              "Could not understand the audio. Please try speaking more clearly.";
            break;
          case "No microphone detected":
            errorMessage =
              "No microphone found. Please check your microphone connection.";
            break;
          case "Microphone access denied":
            errorMessage =
              "Microphone access was denied. Please allow microphone access in your browser settings.";
            break;
          case "Recording stopped":
            // Don't show error toast for normal stopping
            return;
        }
      }

      toast({
        title: "Recording Error",
        description: errorMessage,
        variant: "destructive",
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
    console.log("Handling answer change:", {
      questionId: currentQuestion.id,
      answer,
    }); // Debug log

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

    console.log("Updated answers state:", [...answers, newAnswer]); // Debug log
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
      return currentAnswer.trim() !== "";
    }

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
    console.log("Formatting answers:", answers); // Debug log

    const formattedResponses: { [key: string]: string | number } = {};

    answers.forEach((answer) => {
      // Skip empty answers
      if (!answer.answer.trim()) return;

      const question = surveyQuestions.find((q) => q.id === answer.questionId);
      if (!question) return;

      if (question.type === "multi-select" && answer.answer.includes(",")) {
        // Handle multi-select answers as separate numbered fields
        const selectedNames = answer.answer
          .split(",")
          .map((ans) => ans.trim())
          .filter((ans) => ans);

        selectedNames.forEach((name, index) => {
          const option = question.options?.find((opt) => opt.name === name);
          if (option) {
            formattedResponses[`q${answer.questionId}_${index + 1}`] =
              option.value;
          }
        });
      } else if (question.options) {
        // For multiple choice questions, save the value instead of the name
        const option = question.options.find(
          (opt) => opt.name === answer.answer.trim()
        );
        if (option) {
          formattedResponses[`q${answer.questionId}`] = option.value;
        }
      } else {
        // For text and rating questions, save as is
        formattedResponses[`q${answer.questionId}`] = answer.answer.trim();
      }
    });

    console.log("Formatted responses:", formattedResponses); // Debug log
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
      const res = await fetch("http://localhost:5000/api/survey/save", {
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
      const res = await fetch("http://localhost:5000/api/survey/save", {
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

  if (showThankYou) {
    return <ThankYou onStartNewSurvey={handleStartNewSurvey} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
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
