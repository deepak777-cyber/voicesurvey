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
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isSpeaking = false;
  private lastOperationTime = 0;

  constructor() {
    console.log("Initializing VoiceService...");
    this.synthesis = window.speechSynthesis;
  }

  public initialize() {
    if (this.isInitialized) return;

    console.log("Initializing VoiceService...");

    // Initialize speech recognition if available
    if ("webkitSpeechRecognition" in window) {
      this.recognition = new (window as any).webkitSpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.isInitialized = true;
    }

    // Initialize speech synthesis
    if (this.synthesis) {
      // Create and speak an empty utterance to initialize speech synthesis
      const initUtterance = new SpeechSynthesisUtterance("");
      this.synthesis.speak(initUtterance);
    }

    console.log("Speech recognition configured");
  }

  private async ensureOperationDelay(): Promise<void> {
    const now = Date.now();
    const timeSinceLastOperation = now - this.lastOperationTime;
    if (timeSinceLastOperation < 500) {
      await new Promise((resolve) =>
        setTimeout(resolve, 500 - timeSinceLastOperation)
      );
    }
    this.lastOperationTime = Date.now();
  }

  public async startListening(): Promise<string> {
    if (!this.recognition) {
      throw new Error("Speech recognition not available");
    }

    await this.ensureOperationDelay();

    // Stop any ongoing speech before starting to listen
    await this.stopSpeaking();

    // If already listening, stop first
    if (this.isListening) {
      await this.stopListening();
      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return new Promise((resolve, reject) => {
      if (!this.recognition)
        return reject(new Error("Speech recognition not available"));

      this.recognition.onresult = (event: any) => {
        const result = event.results[0][0].transcript.toLowerCase();
        this.stopListening();
        resolve(result);
      };

      this.recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        this.stopListening();
        reject(new Error(`Speech error: ${event.error}`));
      };

      this.recognition.onend = () => {
        this.isListening = false;
      };

      try {
        this.isListening = true;
        this.recognition.start();
      } catch (error) {
        this.isListening = false;
        reject(error);
      }
    });
  }

  public async listenForYesNo(): Promise<boolean> {
    try {
      await this.ensureOperationDelay();
      const response = await this.startListening();
      const normalizedResponse = response.toLowerCase().trim();
      return ["yes", "yeah", "yep", "sure", "okay", "ok"].includes(
        normalizedResponse
      );
    } catch (error) {
      console.error("Error in listenForYesNo:", error);
      // Add delay on error to prevent rapid retries
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return false;
    }
  }

  public async handleMultiSelectOption(option: string): Promise<boolean> {
    try {
      await this.speak(`Do you want to select ${option}? Say yes or no.`);
      return await this.listenForYesNo();
    } catch (error) {
      console.error("Error in handleMultiSelectOption:", error);
      return false;
    }
  }

  public stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
        this.isListening = false;
        return new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        console.error("Error stopping recognition:", error);
        this.isListening = false;
      }
    }
    return Promise.resolve();
  }

  public async speak(text: string): Promise<void> {
    await this.ensureOperationDelay();

    // If already speaking, wait for current speech to finish
    if (this.isSpeaking) {
      await this.stopSpeaking();
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    return new Promise((resolve, reject) => {
      try {
        if (!this.synthesis) {
          console.log(
            "Speech synthesis not available - continuing without audio"
          );
          return resolve();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        this.currentUtterance = utterance;
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;

        utterance.onend = () => {
          console.log("Speech completed");
          this.isSpeaking = false;
          this.currentUtterance = null;
          resolve();
        };

        utterance.onerror = (event) => {
          console.error("Speech error:", event.error);
          this.isSpeaking = false;
          this.currentUtterance = null;
          resolve();
        };

        this.isSpeaking = true;
        this.synthesis.speak(utterance);
      } catch (error) {
        console.log("Speech did not start - continuing without audio");
        this.isSpeaking = false;
        this.currentUtterance = null;
        resolve();
      }
    });
  }

  public async stopSpeaking() {
    console.log("Stopping speech");
    if (this.synthesis) {
      this.synthesis.cancel();
      this.isSpeaking = false;
      this.currentUtterance = null;
      // Add delay after stopping speech
      await new Promise((resolve) => setTimeout(resolve, 300));
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
    this.isSpeaking = false;
    console.log("Cleanup complete");
  }

  public isSupported(): boolean {
    return "webkitSpeechRecognition" in window;
  }
}
