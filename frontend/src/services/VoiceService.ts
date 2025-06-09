// Extend Window interface for TypeScript
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

// Define SpeechRecognition interface since it's not in TypeScript by default
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onstart?: (() => void) | null;
  onaudiostart?: (() => void) | null;
  onsoundstart?: (() => void) | null;
  onspeechstart?: (() => void) | null;
  maxAlternatives: number;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition;
  new (): SpeechRecognition;
};

export class VoiceService {
  private recognition: SpeechRecognition | null = null;
  private synthesis: SpeechSynthesis;
  private isInitialized = false;
  private isListening = false;

  constructor() {
    this.synthesis = window.speechSynthesis;
  }

  initialize(): boolean {
    if (this.isInitialized) return true;

    const SpeechRecognitionClass =
      window.SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      console.error("Speech recognition not supported in this browser");
      return false;
    }

    this.recognition = new SpeechRecognitionClass();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = "en-US";

    // Add event listeners for all recognition events
    this.recognition.onstart = () => {
      console.log("Speech recognition started");
      this.isListening = true;
    };

    this.recognition.onaudiostart = () => {
      console.log("Audio capturing started");
    };

    this.recognition.onsoundstart = () => {
      console.log("Sound detected");
    };

    this.recognition.onspeechstart = () => {
      console.log("Speech detected");
    };

    this.isInitialized = true;
    console.log("Speech recognition initialized");
    return true;
  }

  async speak(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synthesis) {
        reject(new Error("Speech synthesis not supported"));
        return;
      }

      this.synthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.8;
      utterance.pitch = 1;
      utterance.volume = 1;

      utterance.onend = () => resolve();
      utterance.onerror = (event) =>
        reject(new Error(`Speech error: ${event.error}`));

      this.synthesis.speak(utterance);
    });
  }

  async startListening(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.recognition) {
        console.error("Speech recognition not initialized");
        reject(new Error("Speech recognition not initialized"));
        return;
      }

      // If already listening, stop first
      if (this.isListening) {
        console.log("Already listening, stopping first...");
        this.stopListening();
      }

      this.recognition.onresult = (event) => {
        let interimTranscript = "";
        let finalTranscript = "";

        // Process results
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          const confidence = event.results[i][0].confidence;

          if (event.results[i].isFinal) {
            finalTranscript = transcript;
            console.log(
              "Final transcript:",
              finalTranscript,
              "Confidence:",
              confidence
            );
            this.stopListening();
            resolve(finalTranscript.trim());
          } else {
            interimTranscript = transcript;
            console.log(
              "Interim transcript:",
              interimTranscript,
              "Confidence:",
              confidence
            );
          }
        }
      };

      this.recognition.onend = () => {
        console.log("Speech recognition ended");
        this.isListening = false;
        if (!this.recognition?.onresult) {
          console.log("No speech detected");
          reject(new Error("No speech detected"));
        }
      };

      this.recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        this.isListening = false;
        reject(new Error(event.error));
      };

      try {
        console.log("Attempting to start speech recognition...");
        this.recognition.start();
        console.log("Speech recognition started successfully");
      } catch (error) {
        console.error("Error starting speech recognition:", error);
        this.isListening = false;
        reject(error);
      }
    });
  }

  stopListening(): void {
    if (this.recognition && this.isListening) {
      try {
        console.log("Stopping speech recognition...");
        this.recognition.stop();
        console.log("Speech recognition stopped");
      } catch (error) {
        console.error("Error stopping speech recognition:", error);
      }
      this.isListening = false;
    }
  }

  stopSpeaking(): void {
    if (this.synthesis) {
      this.synthesis.cancel();
    }
  }

  isSupported(): boolean {
    const hasRecognition = !!(
      window.SpeechRecognition || (window as any).webkitSpeechRecognition
    );
    const hasSynthesis = !!window.speechSynthesis;

    return hasRecognition && hasSynthesis;
  }
}
