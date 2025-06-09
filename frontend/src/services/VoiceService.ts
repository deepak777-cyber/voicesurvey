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

    // Check if speech recognition is supported
    const SpeechRecognitionClass =
      window.SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      console.warn("Speech recognition not supported in this browser");
      return false;
    }

    this.recognition = new SpeechRecognitionClass();
    this.recognition.continuous = false; // Changed to false for better control
    this.recognition.interimResults = true;
    this.recognition.lang = "en-US";

    this.isInitialized = true;
    return true;
  }

  async speak(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synthesis) {
        reject(new Error("Speech synthesis not supported"));
        return;
      }

      // Cancel any ongoing speech
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
        reject(new Error("Speech recognition not initialized"));
        return;
      }

      if (this.isListening) {
        reject(new Error("Already listening"));
        return;
      }

      let finalTranscript = "";
      let hasRecognizedSpeech = false;

      this.recognition.onresult = (event) => {
        hasRecognizedSpeech = true;
        let interimTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript = transcript; // Only keep the last final result
          } else {
            interimTranscript += transcript;
          }
        }

        console.log("Final transcript:", finalTranscript);
        console.log("Interim transcript:", interimTranscript);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        console.log("Speech recognition ended");

        if (!hasRecognizedSpeech) {
          reject(new Error("No speech detected"));
          return;
        }

        if (!finalTranscript.trim()) {
          reject(new Error("Could not transcribe audio"));
          return;
        }

        resolve(finalTranscript.trim());
      };

      this.recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        this.isListening = false;

        switch (event.error) {
          case "no-speech":
            reject(new Error("No speech detected"));
            break;
          case "aborted":
            reject(new Error("Recording stopped"));
            break;
          case "audio-capture":
            reject(new Error("No microphone detected"));
            break;
          case "not-allowed":
            reject(new Error("Microphone access denied"));
            break;
          default:
            reject(new Error(`Recognition error: ${event.error}`));
        }
      };

      try {
        console.log("Starting speech recognition...");
        this.recognition.start();
        this.isListening = true;
      } catch (error) {
        console.error("Error starting recognition:", error);
        this.isListening = false;
        reject(error);
      }
    });
  }

  stopListening(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (error) {
        console.error("Error stopping recognition:", error);
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
