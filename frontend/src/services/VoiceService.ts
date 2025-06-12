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
  onnomatch?: (() => void) | null;
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
  private stream: MediaStream | null = null;

  constructor() {
    console.log("Initializing VoiceService...");
    this.synthesis = window.speechSynthesis;
  }

  public async initialize(): Promise<void> {
    try {
      console.log("Initializing VoiceService...");

      if (typeof window === "undefined" || !window.navigator) {
        throw new Error("Browser environment not detected");
      }

      // Clean up any existing instances
      this.stopListening();
      this.stopSpeaking();

      // Set up speech recognition if not already initialized
      if (!this.isInitialized) {
        const SpeechRecognition =
          window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
          this.recognition = new SpeechRecognition();
          this.setupRecognitionConfig();
          console.log("Speech recognition configured");
        } else {
          console.warn("Speech recognition not supported in this browser");
        }

        if (window.speechSynthesis) {
          this.synthesis = window.speechSynthesis;
        } else {
          console.warn("Speech synthesis not supported in this browser");
        }

        this.isInitialized = true;
        console.log("VoiceService initialization complete");
      }
    } catch (error) {
      console.error("Error during initialization:", error);
      throw error;
    }
  }

  private setupRecognitionConfig(): void {
    if (!this.recognition) return;

    // Set up initial configuration
    this.recognition.continuous = false; // Changed to false to get complete phrases
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1; // We only need the best result
    this.recognition.lang = "km-KH";
    console.log("Speech recognition configured");
  }

  public startListening(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.recognition) {
        reject(new Error("Speech recognition not supported"));
        return;
      }

      // Reset recognition instance to clear any previous state
      this.stopListening();
      this.recognition = new (window.SpeechRecognition ||
        window.webkitSpeechRecognition)();
      this.setupRecognitionConfig();

      let fullTranscript = "";
      let interimTranscript = "";
      let hasReceivedResults = false;
      let timeoutId: NodeJS.Timeout | null = null;

      this.recognition.onstart = () => {
        console.log("Speech recognition started");
        hasReceivedResults = false;
        fullTranscript = "";
        interimTranscript = "";
      };

      this.recognition.onresult = (event) => {
        hasReceivedResults = true;
        interimTranscript = "";

        // Process all results in the event
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript.trim();

          if (result.isFinal) {
            fullTranscript += (fullTranscript ? " " : "") + transcript;
            console.log("Final transcript:", fullTranscript);
          } else {
            interimTranscript = transcript;
            console.log("Interim transcript:", transcript);
          }
        }
      };

      this.recognition.onend = () => {
        console.log("Speech recognition ended");
        if (timeoutId) clearTimeout(timeoutId);

        // Use the accumulated transcript if available
        if (fullTranscript) {
          resolve(fullTranscript);
        }
        // Fall back to interim transcript if we have it
        else if (interimTranscript) {
          resolve(interimTranscript);
        }
        // If we got results but no transcript, try to restart
        else if (hasReceivedResults) {
          this.recognition?.start();
        }
        // If no results at all, reject
        else {
          reject(new Error("No speech detected. Please try speaking again."));
        }
      };

      this.recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === "no-speech") {
          reject(new Error("No speech detected. Please try speaking again."));
        } else {
          reject(new Error(`Speech recognition error: ${event.error}`));
        }
      };

      // Set a timeout to stop recognition if no speech is detected
      timeoutId = setTimeout(() => {
        if (this.recognition) {
          this.recognition.stop();
        }
      }, 7000); // Increased timeout to 7 seconds

      try {
        this.recognition.start();
      } catch (error) {
        reject(error);
      }
    });
  }

  public stopListening(): void {
    try {
      if (this.recognition) {
        this.recognition.onend = null; // Remove end handler before stopping
        this.recognition.onresult = null; // Remove result handler
        this.recognition.onerror = null; // Remove error handler
        this.recognition.onstart = null; // Remove start handler
        this.recognition.stop();
      }
    } catch (error) {
      console.warn("Error stopping recognition:", error);
    }
  }

public async speak(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      if (!this.synthesis) {
        console.log("Speech synthesis not available - continuing without audio");
        return resolve();
      }

      this.stopSpeaking();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "km-KH"; // <== SET KHMER LANGUAGE HERE
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.voice = speechSynthesis.getVoices().find(v => v.lang.startsWith("km"));


      utterance.onend = () => {
        console.log("Speech completed");
        resolve();
      };

      utterance.onerror = (event) => {
        if (event.error === "not-allowed") {
          console.log("Speech synthesis blocked - continuing without audio");
          resolve();
          return;
        }

        console.error("Speech error:", event.error);
        resolve();
      };

      this.synthesis.speak(utterance);
    } catch (error) {
      console.log("Speech did not start - continuing without audio");
      resolve();
    }
  });
}


  stopSpeaking(): void {
    console.log("Stopping speech");
    if (this.synthesis) {
      this.synthesis.cancel();
    }
  }

  cleanup(): void {
    console.log("Cleaning up resources...");
    this.stopListening();
    this.stopSpeaking();

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    this.isListening = false;
    console.log("Cleanup complete");
  }

  public isSupported(): boolean {
    try {
      // Check for required APIs
      const hasMediaDevices = !!(
        navigator.mediaDevices && navigator.mediaDevices.getUserMedia
      );
      const hasSpeechRecognition = !!(
        window.SpeechRecognition || window.webkitSpeechRecognition
      );
      const hasSpeechSynthesis = !!window.speechSynthesis;

      console.log("Browser support check:");
      console.log("- MediaDevices API:", hasMediaDevices);
      console.log("- Speech Recognition:", hasSpeechRecognition);
      console.log("- Speech Synthesis:", hasSpeechSynthesis);

      // We only need SpeechRecognition and MediaDevices for basic functionality
      return hasMediaDevices && hasSpeechRecognition;
    } catch (error) {
      console.error("Error checking browser support:", error);
      return false;
    }
  }

  public reset(): void {
    console.log("Resetting voice service...");
    // Stop any ongoing speech
    this.stopSpeaking();

    // Stop and cleanup recognition
    if (this.recognition) {
      this.recognition.onend = null;
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.onstart = null;
      this.recognition.stop();
      this.recognition = null;
    }

    // Reset initialization state
    this.isInitialized = false;

    // Reinitialize for next use
    this.initialize();
  }
}
