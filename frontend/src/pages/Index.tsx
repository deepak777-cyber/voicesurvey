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
// import { useLocationLanguage } from "@/hooks/useLocationLanguage";
// import LanguageSelector from "@/components/LanguageSelector";
import config from "@/config";
import { ThankYou } from "@/components/ThankYou";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

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
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1);
  const [answers, setAnswers] = useState<Answer[]>(() => {
    const savedAnswers = localStorage.getItem("surveyAnswers");
    return savedAnswers ? JSON.parse(savedAnswers) : [];
  });
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceService] = useState(() => new VoiceService());
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isVoiceSupported, setIsVoiceSupported] = useState(true);
  const [isProcessingMultiSelect, setIsProcessingMultiSelect] = useState(false);
  const [questionProcessed, setQuestionProcessed] = useState(false);
  const { toast } = useToast();
  const [showThankYou, setShowThankYou] = useState(false);
  // const { language, setLanguage, isDetecting, detectLocationAndLanguage } =
  //   useLocationLanguage();

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
      // Reset states and stop any ongoing voice activities
      setIsListening(false);
      setIsSpeaking(false);
      voiceService.stopSpeaking();
      voiceService.stopListening();

      // Add a small delay before reading the new question
      const readTimeout = setTimeout(() => {
        readQuestion();
      }, 300);

      return () => clearTimeout(readTimeout);
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

  // useEffect(() => {
  //   // Detect language on component mount
  //   detectLocationAndLanguage();
  // }, []);

  const calculateElapsedTime = () => {
    const startTime = new Date(
      localStorage.getItem("startTime") || new Date().toISOString()
    ).getTime();
    return Math.floor((Date.now() - startTime) / 1000); // Convert to seconds
  };

  const readQuestion = async () => {
    if (!isVoiceEnabled || isSpeaking || isListening) return;

    // Reset the processed flag when manually reading question
    setQuestionProcessed(false);

    // Stop any ongoing voice activities
    voiceService.stopSpeaking();
    voiceService.stopListening();
    setIsListening(false);
    setIsSpeaking(true);

    try {
      // Read the question text first
      await voiceService.speak(currentQuestion.question);

      // Brief pause after question
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // For single-select, read the options
      if (currentQuestion.type === "single-select" && currentQuestion.options) {
        const optionsText =
          ". Your options are: " +
          currentQuestion.options.map((opt) => opt.name).join(", ");
        await voiceService.speak(optionsText);
      }

      // Add instruction for rating questions
      if (currentQuestion.type === "rating") {
        await voiceService.speak(
          ". Please rate from 1 to 10, where 1 is not likely and 10 is very likely."
        );
      }

      // Add instruction for text questions
      if (currentQuestion.type === "text") {
        await voiceService.speak(". Please provide your answer when ready.");
      }

      // Add instruction for multi-select
      if (currentQuestion.type === "multi-select") {
        await voiceService.speak("I will read each option for you to select.");
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Speech error:") &&
        !error.message.includes("interrupted") &&
        !error.message.includes("not-allowed")
      ) {
        console.error("Critical speech error:", error);
        toast({
          title: "Voice Error",
          description: "Could not read the question aloud.",
          variant: "destructive",
        });
      } else {
        console.log("Non-critical speech event:", error);
      }
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

    setIsListening(true);
    try {
      // Only handle non-multi-select cases here
      if (currentQuestion.type !== "multi-select") {
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
              description:
                "Please try again with one of the available options.",
              variant: "destructive",
            });
          }
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
    // Stop any ongoing voice activities when user manually interacts
    setIsListening(false);
    setIsSpeaking(false);
    setIsProcessingMultiSelect(false);
    setQuestionProcessed(true);
    voiceService.stopSpeaking();
    voiceService.stopListening();

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
      if (!currentAnswer.trim()) return false;

      const selectedOptions = currentAnswer.split(",").map((opt) => opt.trim());
      // Check if at least one valid option from the available options is selected
      return selectedOptions.some((selected) =>
        currentQuestion.options?.some((opt) => opt.name === selected)
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

  const handleNext = async () => {
    if (!canProceed()) {
      toast({
        title: "Required Field",
        description: "Please provide an answer before proceeding.",
        variant: "destructive",
      });
      return;
    }

    // Reset all voice states and stop any ongoing processes
    setIsListening(false);
    setIsSpeaking(false);
    setIsProcessingMultiSelect(false);
    setQuestionProcessed(true);
    await voiceService.stopSpeaking();
    await voiceService.stopListening();

    await saveIncompleteResponse();

    if (isLastQuestion) {
      handleSubmit();
    } else {
      // Move to next question
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstQuestion) {
      // Reset voice states
      setIsListening(false);
      setIsSpeaking(false);
      voiceService.stopSpeaking();
      voiceService.stopListening();

      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleStopSpeaking = () => {
    voiceService.stopSpeaking();
    setIsSpeaking(false);
  };

  const handleQuestionAutomation = async () => {
    if (
      !isVoiceEnabled ||
      !isVoiceSupported ||
      !currentQuestion ||
      isSpeaking ||
      isProcessingMultiSelect ||
      questionProcessed
    )
      return;

    try {
      // Handle different question types
      if (currentQuestion.type === "multi-select" && currentQuestion.options) {
        setIsProcessingMultiSelect(true);

        try {
          // First announce the process
          setIsSpeaking(true);
          await voiceService.speak(
            "I will now read each option one by one. After each option, you have 5 seconds to say yes. No response or any other response will be considered as no."
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));
          setIsSpeaking(false);

          const selectedOptions: string[] = [];

          // Go through each option
          for (const option of currentQuestion.options) {
            try {
              // Reset states before processing each option
              setIsListening(false);
              setIsSpeaking(false);
              await voiceService.stopListening();
              await voiceService.stopSpeaking();
              await new Promise((resolve) => setTimeout(resolve, 500));

              // Read the option
              setIsSpeaking(true);
              toast({
                title: "Option",
                description: option.name,
                duration: 2000,
              });
              await voiceService.speak(option.name + "?");
              setIsSpeaking(false);

              // Wait before listening
              await new Promise((resolve) => setTimeout(resolve, 1000));

              // Start listening with timeout
              setIsListening(true);
              toast({
                title: "Listening",
                description: "Say yes within 5 seconds to select this option",
                duration: 2000,
              });

              let isSelected = false;
              try {
                const timeoutPromise = new Promise<boolean>((resolve) => {
                  setTimeout(() => resolve(false), 5000);
                });

                isSelected = await Promise.race([
                  voiceService.listenForYesNo(),
                  timeoutPromise,
                ]);

                // Ensure states are reset
                setIsListening(false);
                await voiceService.stopListening();
                await new Promise((resolve) => setTimeout(resolve, 500));
              } catch (error) {
                console.error("Error during listening:", error);
                isSelected = false;
              }

              // Provide feedback
              setIsSpeaking(true);
              if (isSelected) {
                selectedOptions.push(option.name);
                await voiceService.speak("Selected");
              } else {
                await voiceService.speak("Not selected");
              }
              setIsSpeaking(false);

              // Wait before next option
              await new Promise((resolve) => setTimeout(resolve, 1000));
            } catch (error) {
              console.error(`Error processing option ${option.name}:`, error);
              setIsListening(false);
              setIsSpeaking(false);
              await voiceService.stopListening();
              await voiceService.stopSpeaking();
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          }

          // Final feedback
          try {
            setIsSpeaking(true);
            if (selectedOptions.length > 0) {
              handleAnswerChange(selectedOptions.join(","));
              await voiceService.speak(
                `You selected: ${selectedOptions.join(", ")}`
              );
            } else {
              await voiceService.speak(
                "No options were selected. You can try again by clicking Read Question Again."
              );
            }
          } catch (error) {
            console.error("Error in final feedback:", error);
          } finally {
            setIsSpeaking(false);
            setIsListening(false);
            await voiceService.stopListening();
            await voiceService.stopSpeaking();
            setQuestionProcessed(true);
          }
        } finally {
          setIsProcessingMultiSelect(false);
        }
      } else if (
        currentQuestion.type === "single-select" &&
        currentQuestion.options
      ) {
        setIsListening(true);
        toast({
          title: "Listening",
          description: "Please say your choice",
          duration: 3000,
        });

        const result = await voiceService.startListening();
        if (result) {
          const matchedAnswer = matchVoiceToOption(result);
          const isValidAnswer = currentQuestion.options.some(
            (opt) => opt.name === matchedAnswer
          );

          if (isValidAnswer) {
            handleAnswerChange(matchedAnswer);
            await voiceService.speak(`You selected: ${matchedAnswer}`);
          } else {
            await voiceService.speak("I didn't catch that. Please try again.");
            toast({
              title: "Not Recognized",
              description:
                "Please try again with one of the available options.",
              variant: "destructive",
              duration: 3000,
            });
          }
        }
        setQuestionProcessed(true);
      } else if (currentQuestion.type === "rating") {
        setIsListening(true);
        toast({
          title: "Listening",
          description: "Please say a number between 1 and 10",
          duration: 3000,
        });

        const result = await voiceService.startListening();
        if (result) {
          const matchedAnswer = matchVoiceToOption(result);
          const rating = parseInt(matchedAnswer);
          if (!isNaN(rating) && rating >= 1 && rating <= 10) {
            handleAnswerChange(rating.toString());
            await voiceService.speak(`You rated: ${rating}`);
          } else {
            await voiceService.speak(
              "Please provide a valid rating between 1 and 10."
            );
            toast({
              title: "Invalid Rating",
              description: "Please provide a number between 1 and 10",
              variant: "destructive",
              duration: 3000,
            });
          }
        }
        setQuestionProcessed(true);
      } else {
        setIsListening(true);
        toast({
          title: "Listening",
          description: "Please speak your answer",
          duration: 3000,
        });

        const result = await voiceService.startListening();
        if (result) {
          handleAnswerChange(result);
          await voiceService.speak("Thank you. I have recorded your answer.");
        }
        setQuestionProcessed(true);
      }
    } catch (error) {
      console.error("Error in question automation:", error);
      setIsListening(false);
      setIsSpeaking(false);
      setIsProcessingMultiSelect(false);
    }
  };

  // Update the useEffect for question automation
  useEffect(() => {
    if (
      isVoiceEnabled &&
      currentQuestion &&
      !isSpeaking &&
      !isProcessingMultiSelect &&
      !questionProcessed
    ) {
      const automationTimeout = setTimeout(() => {
        handleQuestionAutomation();
      }, 1000);
      return () => clearTimeout(automationTimeout);
    }
  }, [
    currentQuestionIndex,
    isVoiceEnabled,
    isSpeaking,
    isProcessingMultiSelect,
    questionProcessed,
  ]);

  // Reset questionProcessed when moving to a new question
  useEffect(() => {
    setQuestionProcessed(false);
  }, [currentQuestionIndex]);

  const isOptionSelected = (optionName: string): boolean => {
    if (!getCurrentAnswer()) return false;
    const selections = getCurrentAnswer().split(",").filter(Boolean);
    return selections.includes(optionName);
  };

  const handleMultiSelectChange = (optionName: string, checked: boolean) => {
    // Stop any ongoing voice activities when user manually selects options
    setIsListening(false);
    setIsSpeaking(false);
    setIsProcessingMultiSelect(false);
    setQuestionProcessed(true);
    voiceService.stopSpeaking();
    voiceService.stopListening();

    const currentSelections = getCurrentAnswer()
      ? getCurrentAnswer().split(",").filter(Boolean)
      : [];
    if (checked) {
      if (!currentSelections.includes(optionName)) {
        handleAnswerChange([...currentSelections, optionName].join(","));
      }
    } else {
      handleAnswerChange(
        currentSelections.filter((item) => item !== optionName).join(",")
      );
    }
  };

  const renderQuestionInput = () => {
    switch (currentQuestion.type) {
      case "text":
        return (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="mb-4 text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">
                {currentQuestion.question}
                {currentQuestion.required && (
                  <span className="text-red-500 ml-1">*</span>
                )}
              </h2>
            </div>
            <Textarea
              placeholder="Type your answer or wait for voice recording..."
              value={getCurrentAnswer()}
              onChange={(e) => handleAnswerChange(e.target.value)}
              className="min-h-[120px] text-lg w-full"
            />
          </div>
        );

      case "single-select":
        return (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="mb-4 text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">
                {currentQuestion.question}
                {currentQuestion.required && (
                  <span className="text-red-500 ml-1">*</span>
                )}
              </h2>
            </div>
            <RadioGroup
              value={getCurrentAnswer()}
              onValueChange={handleAnswerChange}
              className="space-y-3"
            >
              {currentQuestion.options?.map((option) => (
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
          </div>
        );

      case "multi-select":
        return (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="mb-4 text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">
                {currentQuestion.question}
                {currentQuestion.required && (
                  <span className="text-red-500 ml-1">*</span>
                )}
              </h2>
            </div>
            <div className="space-y-3">
              {currentQuestion.options?.map((option) => (
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
          </div>
        );

      default:
        return null;
    }
  };

  const renderVoiceStatus = () => {
    let statusText = "Waiting...";
    let icon = null;
    let bgColor = "bg-gray-100";
    let textColor = "text-gray-600";

    if (isSpeaking) {
      statusText = "Reading...";
      icon = <Volume2 className="w-4 h-4" />;
      bgColor = "bg-blue-100";
      textColor = "text-blue-600";
    } else if (isListening) {
      statusText = "Listening...";
      icon = <Mic className="w-4 h-4" />;
      bgColor = "bg-green-100";
      textColor = "text-green-600";
    }

    return (
      <div
        className={`flex items-center justify-center gap-2 py-2 px-4 rounded-md ${bgColor} ${textColor} font-medium text-sm mt-4`}
      >
        {icon}
        <span>{statusText}</span>
      </div>
    );
  };

  // Add new function to handle survey start
  const handleStartSurvey = async () => {
    try {
      // Initialize speech synthesis with user interaction
      const utterance = new SpeechSynthesisUtterance("");
      window.speechSynthesis.speak(utterance);

      // Brief pause to ensure initialization is complete
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Start the survey
      setCurrentQuestionIndex(0);
    } catch (error) {
      console.error("Error initializing speech:", error);
      // Start survey anyway even if speech fails
      setCurrentQuestionIndex(0);
    }
  };

  // Render welcome screen
  const renderWelcomeScreen = () => {
    return (
      <Card className="p-8 mb-8 shadow-lg text-center">
        <div className="space-y-6 max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome to Voice Survey
          </h1>
          <p className="text-lg text-gray-600">
            This survey uses voice interaction to make it easier for you to
            respond. Please ensure your microphone is connected and click the
            button below to begin.
          </p>
          <div className="flex justify-center gap-4">
            <Button
              onClick={handleStartSurvey}
              className="flex items-center gap-2 text-lg px-6 py-3"
            >
              <Volume2 className="w-5 h-5" />
              Start Survey
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  if (showThankYou) {
    return <ThankYou onStartNewSurvey={handleStartNewSurvey} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="relative w-full">
        <div className="absolute left-0 top-0 pl-8 pt-4">
          <img src="/logo.png" alt="Survey Logo" className="h-16 w-auto" />
        </div>
        <div className="max-w-2xl mx-auto px-4 pt-4 pb-1">
          {currentQuestionIndex === -1 ? (
            renderWelcomeScreen()
          ) : (
            <>
              <div className="mb-8 text-center">
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
                    Question {currentQuestionIndex + 1} of{" "}
                    {surveyQuestions.length}
                  </span>
                  <span className="text-sm text-gray-600">
                    {Math.round(progress)}% Complete
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              {/* Voice Controls */}
              <div className="flex justify-center gap-4 mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={readQuestion}
                  disabled={isSpeaking || isListening}
                  className="flex items-center gap-2"
                >
                  <Volume2 size={16} />
                  {isSpeaking ? "Reading..." : "Read Question Again"}
                </Button>
              </div>

              {/* Question Card */}
              <Card className="p-6 mb-8 shadow-lg">
                <div className="max-w-2xl mx-auto">
                  {renderQuestionInput()}
                  <div className="flex justify-center mt-4">
                    {renderVoiceStatus()}
                  </div>
                </div>
              </Card>

              {/* Navigation */}
              <div className="flex justify-between max-w-2xl mx-auto mb-8">
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Index;
