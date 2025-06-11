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

    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;
    this.recognition.lang = "en-US";
    console.log("Speech recognition configured");
  }

  public async startListening(): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        // Stop any ongoing recording/recognition
        this.stopListening();
        this.stopSpeaking();

        // Initialize if needed
        if (!this.isInitialized) {
          await this.initialize();
        }

        if (!this.recognition) {
          throw new Error("Speech recognition not available");
        }

        let finalTranscript = "";
        let timeoutId: NodeJS.Timeout | null = null;

        this.recognition.onresult = (event) => {
          let interimTranscript = "";

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

              // Clear any existing timeout when we get final results
              if (timeoutId) clearTimeout(timeoutId);

              // Stop recognition after getting final result
              this.recognition?.stop();
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
          if (timeoutId) clearTimeout(timeoutId);

          if (finalTranscript) {
            resolve(finalTranscript.trim());
          } else {
            reject(new Error("No speech detected. Please try speaking again."));
          }
        };

        this.recognition.onerror = (event) => {
          console.error("Speech recognition error:", event.error);
          if (timeoutId) clearTimeout(timeoutId);

          switch (event.error) {
            case "not-allowed":
              reject(
                new Error("Please allow microphone access to use voice input.")
              );
              break;
            case "no-speech":
              reject(
                new Error("No speech was detected. Please try speaking again.")
              );
              break;
            case "network":
              reject(
                new Error(
                  "Network error. Please check your internet connection."
                )
              );
              break;
            case "aborted":
              reject(new Error("Voice recording was cancelled."));
              break;
            default:
              reject(new Error(`Voice recording error: ${event.error}`));
          }
        };

        // Set a timeout to stop recognition if no speech is detected
        timeoutId = setTimeout(() => {
          if (this.recognition && !finalTranscript) {
            this.recognition.stop();
          }
        }, 7000); // 7 seconds timeout

        try {
          await this.recognition.start();
          console.log("Speech recognition started");
        } catch (error) {
          if (error instanceof Error) {
            if (error.message.includes("already started")) {
              // If recognition is already started, stop it and try again
              this.stopListening();
              setTimeout(() => this.startListening(), 100);
            } else {
              reject(error);
            }
          } else {
            reject(new Error("Failed to start voice recording"));
          }
        }
      } catch (error) {
        console.error("Error in startListening:", error);
        reject(error);
      }
    });
  }

  public stopListening(): void {
    try {
      if (this.recognition) {
        this.recognition.stop();
      }
    } catch (error) {
      console.warn("Error stopping recognition:", error);
    }
  }

  public async speak(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Check if speech synthesis is available
        if (!this.synthesis) {
          console.log(
            "Speech synthesis not available - continuing without audio"
          );
          return resolve();
        }

        // Cancel any ongoing speech
        this.stopSpeaking();

        // Create and configure utterance
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;

        // Handle completion
        utterance.onend = () => {
          console.log("Speech completed");
          resolve();
        };

        // Handle errors
        utterance.onerror = (event) => {
          // Don't treat not-allowed as an error, just continue silently
          if (event.error === "not-allowed") {
            console.log("Speech synthesis blocked - continuing without audio");
            resolve();
            return;
          }

          console.error("Speech error:", event.error);
          // For other errors, still resolve but log them
          resolve();
        };

        // Attempt to speak
        this.synthesis.speak(utterance);
      } catch (error) {
        console.log("Speech did not start - continuing without audio");
        resolve(); // Always resolve, don't reject
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
}
