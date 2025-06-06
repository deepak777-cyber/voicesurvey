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

interface Question {
  id: string;
  type: "text" | "multiple-choice" | "multi-select" | "rating";
  question: string;
  options?: string[];
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
    options: ["Excellent", "Good", "Average", "Poor", "Very Poor"],
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
      "Customer Support",
      "Easy to Use",
      "Good Value",
      "Fast Delivery",
      "Quality Products",
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
      "Social Media",
      "Friend Referral",
      "Search Engine",
      "Advertisement",
      "Other",
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
        textToRead += currentQuestion.options.join(", ");

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
    if (
      (currentQuestion.type !== "multiple-choice" &&
        currentQuestion.type !== "multi-select") ||
      !currentQuestion.options
    ) {
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
    if (currentQuestion.type === "multi-select") {
      const inputParts = normalizedInput.split(/\s+and\s+|\s*,\s*/);
      const matchedOptions: string[] = [];

      inputParts.forEach((part) => {
        const trimmedPart = part.trim();

        // Find exact match
        const exactMatch = currentQuestion.options?.find(
          (option) => option.toLowerCase() === trimmedPart
        );
        if (exactMatch && !matchedOptions.includes(exactMatch)) {
          matchedOptions.push(exactMatch);
          return;
        }

        // Find partial match
        const partialMatch = currentQuestion.options?.find(
          (option) =>
            option.toLowerCase().includes(trimmedPart) ||
            trimmedPart.includes(option.toLowerCase())
        );
        if (partialMatch && !matchedOptions.includes(partialMatch)) {
          matchedOptions.push(partialMatch);
        }
      });

      if (matchedOptions.length > 0) {
        console.log("Multi-select matches found:", matchedOptions);
        return matchedOptions.join(",");
      }
    }

    // For single select questions
    // Find exact match (case insensitive)
    const exactMatch = currentQuestion.options.find(
      (option) => option.toLowerCase() === normalizedInput
    );
    if (exactMatch) {
      console.log("Exact match found:", exactMatch);
      return exactMatch;
    }

    // Find partial match
    const partialMatch = currentQuestion.options.find(
      (option) =>
        option.toLowerCase().includes(normalizedInput) ||
        normalizedInput.includes(option.toLowerCase())
    );
    if (partialMatch) {
      console.log("Partial match found:", partialMatch);
      return partialMatch;
    }

    // For rating questions, extract numbers
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
      toast({
        title: "Recording Error",
        description: "Could not record your voice. Please try again.",
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

    console.log("Answer stored:", newAnswer);
    console.log("All answers:", [...answers, newAnswer]);
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
  const saveIncompleteResponse = async () => {
    const payload = {
      unique_id: localStorage.getItem("unique_id") || generateUUID(),
      sys_start_time:
        localStorage.getItem("startTime") || new Date().toISOString(),
      sys_end_time: new Date().toISOString(),
      sys_device: navigator.userAgent,
      survey_status: "incomplete",
      elapsed_time: Date.now() - Number(localStorage.getItem("startTime")),
      language: "en",
      responses: answers,
    };

    // Store unique_id and startTime in localStorage if not already present
    if (!localStorage.getItem("unique_id")) {
      localStorage.setItem("unique_id", payload.unique_id);
    }
    if (!localStorage.getItem("startTime")) {
      localStorage.setItem("startTime", payload.sys_start_time);
    }

    try {
      const res = await fetch("http://localhost:5000/api/survey/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      console.log("Incomplete survey saved:", data);
    } catch (err) {
      console.error("Error saving incomplete survey:", err);
    }
  };

  const saveSurveyResponse = async (finalAnswers: Answer[]) => {
    const payload = {
      unique_id: generateUUID(),
      sys_start_time: localStorage.getItem("startTime"), // set this on page load
      sys_end_time: new Date(),
      sys_device: navigator.userAgent,
      survey_status: "completed",
      elapsed_time: Date.now() - Number(localStorage.getItem("startTime")),
      language: "en",
      responses: finalAnswers,
    };

    try {
      const res = await fetch("http://localhost:5000/api/survey/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      console.log("Survey saved:", data);
    } catch (err) {
      console.error("Error saving survey:", err);
    }
  };

  const handleSubmit = async () => {
    const payload = {
      unique_id: localStorage.getItem("unique_id") || generateUUID(),
      sys_start_time:
        localStorage.getItem("startTime") || new Date().toISOString(),
      sys_end_time: new Date().toISOString(),
      sys_device: navigator.userAgent,
      survey_status: "completed",
      elapsed_time: Date.now() - Number(localStorage.getItem("startTime")),
      language: "en",
      responses: answers,
    };

    try {
      const res = await fetch("http://localhost:5000/api/survey/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      console.log("Survey completed and saved:", data);
    } catch (err) {
      console.error("Error saving completed survey:", err);
    }

    toast({
      title: "Survey Completed",
      description:
        "Thank you for your responses! Your feedback has been saved.",
    });

    // Clear stored data
    localStorage.removeItem("unique_id");
    localStorage.removeItem("startTime");
    localStorage.removeItem("surveyAnswers");

    setCurrentQuestionIndex(0);
    setAnswers([]);
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

  // const handleSubmit = () => {
  //   // Store final answers to localStorage with timestamp
  //   const finalSurveyData = {
  //     answers,
  //     submittedAt: new Date().toISOString(),
  //     surveyId: `survey_${Date.now()}`
  //   };

  //   localStorage.setItem('completedSurvey', JSON.stringify(finalSurveyData));
  //   console.log('Survey completed and stored:', finalSurveyData);

  //   toast({
  //     title: "Survey Completed",
  //     description: "Thank you for your responses! Your feedback has been saved.",
  //   });

  //   // Reset survey
  //   setCurrentQuestionIndex(0);
  //   setAnswers([]);
  //   localStorage.removeItem('surveyAnswers'); // Clear in-progress answers
  // };

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
