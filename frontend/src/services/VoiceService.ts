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
    this.recognition.continuous = true; // Changed to true for better capture
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

      let finalTranscript = "";
      let interimTranscript = "";
      let timeoutId: NodeJS.Timeout;

      this.recognition.onresult = (event) => {
        console.log("Speech recognition result event:", event);

        interimTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          console.log(
            "Transcript part:",
            transcript,
            "Final:",
            event.results[i].isFinal
          );

          if (event.results[i].isFinal) {
            finalTranscript += transcript;
            // Clear any existing timeout when we get final results
            if (timeoutId) clearTimeout(timeoutId);
            // Set a short timeout to end recognition after final result
            timeoutId = setTimeout(() => {
              this.recognition?.stop();
            }, 500);
          } else {
            interimTranscript += transcript;
          }
        }

        console.log("Final transcript so far:", finalTranscript);
        console.log("Interim transcript:", interimTranscript);
      };

      this.recognition.onend = () => {
        console.log("Speech recognition ended. Final result:", finalTranscript);
        if (timeoutId) clearTimeout(timeoutId);
        resolve(finalTranscript.trim());
      };

      this.recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        if (timeoutId) clearTimeout(timeoutId);
        reject(new Error(`Recognition error: ${event.error}`));
      };

      // Use addEventListener instead of onstart for better compatibility
      this.recognition.addEventListener("start", () => {
        console.log("Speech recognition started");
        finalTranscript = "";
        interimTranscript = "";
      });

      try {
        console.log("Starting speech recognition...");
        this.recognition.start();
      } catch (error) {
        console.error("Error starting recognition:", error);
        reject(error);
      }
    });
  }

  stopListening(): void {
    if (this.recognition) {
      this.recognition.stop();
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
