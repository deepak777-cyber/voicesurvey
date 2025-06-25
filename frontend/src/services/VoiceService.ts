import { Language } from "@/types/language";
import { AzureTTSService, AzureTTSConfig } from "./AzureTTSService";
import {
  AzureSpeechToTextService,
  AzureSpeechConfig,
} from "./AzureSpeechToTextService";
import {
  recognizeKhmerSpeech,
  recognizeEnglishSpeech,
} from "./AzureSpeechSdkService";

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
  private azureTTS: AzureTTSService;
  private azureSTT: AzureSpeechToTextService;
  private isInitialized = false;
  private isListening = false;
  private stream: MediaStream | null = null;
  private currentLanguage: Language = "km";
  private useAzureTTS: boolean = true; // Default to using Azure TTS
  private useAzureSTT: boolean = true; // Default to using Azure STT

  constructor() {
    console.log("Initializing VoiceService...");
    this.synthesis = window.speechSynthesis;

    // Initialize Azure TTS service
    const azureTTSConfig: AzureTTSConfig = {
      subscriptionKey: import.meta.env.VITE_AZURE_TTS_KEY || "",
      region: import.meta.env.VITE_AZURE_TTS_REGION || "centralindia",
      voiceName: "km-KH-PisethNeural", // Default Khmer voice
    };
    this.azureTTS = new AzureTTSService(azureTTSConfig);

    // Initialize Azure Speech-to-Text service
    const azureSTTConfig: AzureSpeechConfig = {
      subscriptionKey: import.meta.env.VITE_AZURE_TTS_KEY || "", // Use same key as TTS
      region: import.meta.env.VITE_AZURE_TTS_REGION || "centralindia",
      language: "km-KH", // Default to Khmer
    };
    this.azureSTT = new AzureSpeechToTextService(azureSTTConfig);
  }

  public setLanguage(language: Language) {
    this.currentLanguage = language;
    if (this.recognition) {
      this.recognition.lang = language === "km" ? "km-KH" : "en-US";
    }
    // Update Azure STT language
    this.azureSTT.setLanguage(language === "km" ? "km-KH" : "en-US");
  }

  public setUseAzureTTS(useAzure: boolean) {
    this.useAzureTTS = useAzure;
  }

  public setUseAzureSTT(useAzure: boolean) {
    this.useAzureSTT = useAzure;
  }

  public async checkLanguageSupport(): Promise<void> {
    try {
      // Detect iOS Safari
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isSafari =
        /Safari/.test(navigator.userAgent) &&
        !/Chrome/.test(navigator.userAgent);
      const isIOSSafari = isIOS && isSafari;

      console.log("=== Language Support Check ===");
      console.log("Browser:", navigator.userAgent);
      console.log("iOS Safari:", isIOSSafari);

      if (isIOSSafari) {
        console.warn("⚠️  iOS Safari Limitations:");
        console.warn("- Limited support for non-Latin scripts like Khmer");
        console.warn("- Speech recognition may not work properly for Khmer");
        console.warn("- Consider using Chrome or Firefox on iOS");
        console.warn("- Or use a desktop browser for better Khmer support");
      }

      // Check if we can create a speech recognition instance
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const testRecognition = new SpeechRecognition();
        testRecognition.lang = "km-KH";
        console.log("✅ Speech recognition available");
        console.log("✅ Khmer language code supported:", testRecognition.lang);
      } else {
        console.error("❌ Speech recognition not available");
      }

      // Check speech synthesis support
      if (window.speechSynthesis) {
        const voices = window.speechSynthesis.getVoices();
        const khmerVoices = voices.filter((v) => v.lang.startsWith("km"));
        console.log("✅ Speech synthesis available");
        console.log("✅ Khmer voices found:", khmerVoices.length);
        if (khmerVoices.length > 0) {
          khmerVoices.forEach((v) => console.log(`  - ${v.name} (${v.lang})`));
        }
      } else {
        console.error("❌ Speech synthesis not available");
      }

      console.log("=== End Language Support Check ===");
    } catch (error) {
      console.error("Error checking language support:", error);
    }
  }

  public async initialize(): Promise<void> {
    try {
      console.log("Initializing VoiceService...");

      if (typeof window === "undefined" || !window.navigator) {
        throw new Error("Browser environment not detected");
      }

      // Check language support first
      await this.checkLanguageSupport();

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
          // Load voices asynchronously (important for iOS Safari)
          await this.loadVoices();
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

    // Detect iOS Safari
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari =
      /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    const isIOSSafari = isIOS && isSafari;

    // Set up initial configuration
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.recognition.maxAlternatives = 1;

    // iOS Safari may have issues with Khmer language
    if (isIOSSafari && this.currentLanguage === "km") {
      console.warn("iOS Safari detected - Khmer recognition may be limited");
      // Try with a more generic language code for iOS
      this.recognition.lang = "km-KH";
    } else {
      this.recognition.lang = this.currentLanguage === "km" ? "km-KH" : "en-US";
    }

    console.log(
      "Speech recognition configured for language:",
      this.recognition.lang
    );
    console.log("iOS Safari:", isIOSSafari);
  }

  // Helper function to clean up transcript
  private cleanTranscript(transcript: string): string {
    if (this.currentLanguage !== "km") return transcript;

    // Remove common English words that might be misheard
    const englishWords = [
      "the",
      "a",
      "an",
      "and",
      "or",
      "but",
      "in",
      "on",
      "at",
      "to",
      "for",
      "of",
      "with",
      "by",
      "is",
      "are",
      "was",
      "were",
      "be",
      "been",
      "being",
      "have",
      "has",
      "had",
      "do",
      "does",
      "did",
      "will",
      "would",
      "could",
      "should",
      "may",
      "might",
      "can",
      "must",
      "shall",
      "this",
      "that",
      "these",
      "those",
      "i",
      "you",
      "he",
      "she",
      "it",
      "we",
      "they",
      "me",
      "him",
      "her",
      "us",
      "them",
      "my",
      "your",
      "his",
      "her",
      "its",
      "our",
      "their",
    ];

    let cleaned = transcript;
    englishWords.forEach((word) => {
      const regex = new RegExp(`\\b${word}\\b`, "gi");
      cleaned = cleaned.replace(regex, "");
    });

    // Clean up extra spaces
    cleaned = cleaned.replace(/\s+/g, " ").trim();

    console.log(`Cleaned transcript: "${transcript}" -> "${cleaned}"`);
    return cleaned;
  }

  private async loadVoices(): Promise<void> {
    return new Promise((resolve) => {
      // Check if voices are already loaded
      let voices = speechSynthesis.getVoices();

      if (voices.length > 0) {
        console.log("Voices already loaded:", voices.length);
        resolve();
        return;
      }

      // Wait for voices to load
      const onVoicesChanged = () => {
        voices = speechSynthesis.getVoices();
        console.log("Voices loaded:", voices.length);
        speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
        resolve();
      };

      speechSynthesis.addEventListener("voiceschanged", onVoicesChanged);

      // Fallback timeout in case voices don't load
      setTimeout(() => {
        speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
        console.log("Voice loading timeout, continuing with available voices");
        resolve();
      }, 3000);
    });
  }

  public getBrowserRecommendations(): string[] {
    const recommendations: string[] = [];

    // Detect iOS Safari
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari =
      /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent);
    const isIOSSafari = isIOS && isSafari;

    if (isIOSSafari) {
      recommendations.push(
        "⚠️ iOS Safari has limited support for Khmer speech recognition"
      );
      recommendations.push(
        "💡 Try using Chrome or Firefox on iOS for better Khmer support"
      );
      recommendations.push(
        "💡 Or use a desktop browser (Chrome, Firefox, Edge)"
      );
      recommendations.push("💡 Make sure you're speaking clearly and slowly");
    } else if (isIOS) {
      recommendations.push(
        "✅ iOS detected - try using Chrome or Firefox for better Khmer support"
      );
    } else {
      recommendations.push(
        "✅ Desktop browser detected - should work well with Khmer"
      );
    }

    // Check for HTTPS (required for microphone access)
    if (location.protocol !== "https:" && location.hostname !== "localhost") {
      recommendations.push("🔒 HTTPS is required for microphone access");
    }

    return recommendations;
  }

  public startListening(): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isSafari =
          /Safari/.test(navigator.userAgent) &&
          !/Chrome/.test(navigator.userAgent);
        const isIOSSafari = isIOS && isSafari;
        const SpeechRecognition =
          window.SpeechRecognition || window.webkitSpeechRecognition;
        console.log(
          "[VoiceService] startListening called. isIOS:",
          isIOS,
          "isSafari:",
          isSafari,
          "lang:",
          this.currentLanguage
        );

        // --- iOS: Khmer (Azure SDK only, must be inside tap) ---
        if (isIOSSafari && this.currentLanguage === "km") {
          console.log(
            "[VoiceService] iOS Safari + Khmer: Using Azure SDK for Khmer"
          );
          try {
            const key = import.meta.env.VITE_AZURE_TTS_KEY || "";
            const region =
              import.meta.env.VITE_AZURE_TTS_REGION || "centralindia";
            const transcript = await recognizeKhmerSpeech(key, region);
            resolve(transcript);
            return;
          } catch (err) {
            console.error(
              "[VoiceService] Azure SDK Khmer STT failed on iOS:",
              err
            );
            reject(err);
            return;
          }
        }

        // --- iOS: English (Azure SDK instead of REST/MediaRecorder) ---
        if (isIOSSafari && this.currentLanguage === "en") {
          console.log(
            "[VoiceService] iOS Safari + English: Using Azure SDK for English"
          );
          try {
            const key = import.meta.env.VITE_AZURE_TTS_KEY || "";
            const region =
              import.meta.env.VITE_AZURE_TTS_REGION || "centralindia";
            const transcript = await recognizeEnglishSpeech(key, region);
            resolve(transcript);
            return;
          } catch (err) {
            console.error(
              "[VoiceService] Azure SDK English STT failed on iOS:",
              err
            );
            reject(err);
            return;
          }
        }

        // --- Non-iOS: Khmer or English (prefer browser, fallback to Azure for Khmer) ---
        if (SpeechRecognition) {
          console.log(
            "[VoiceService] Non-iOS or iOS non-Safari: Using browser SpeechRecognition"
          );
          this.stopListening();
          this.recognition = new SpeechRecognition();
          this.setupRecognitionConfig();
          this.recognition.lang =
            this.currentLanguage === "km" ? "km-KH" : "en-US";

          let fullTranscript = "";
          let interimTranscript = "";
          let hasReceivedResults = false;
          let silenceTimeout: NodeJS.Timeout | null = null;
          let finalTimeout: NodeJS.Timeout | null = null;
          let isFinalReceived = false;
          let lastNonEmptyTranscript = "";

          const resetSilenceTimeout = () => {
            if (silenceTimeout) clearTimeout(silenceTimeout);
            silenceTimeout = setTimeout(() => {
              if (this.recognition && !isFinalReceived) {
                console.log("Silence detected, stopping recognition");
                this.recognition.stop();
              }
            }, 3000); // 3.5 seconds of silence before stopping
          };

          this.recognition.onstart = () => {
            hasReceivedResults = false;
            fullTranscript = "";
            interimTranscript = "";
            isFinalReceived = false;
            lastNonEmptyTranscript = "";
            resetSilenceTimeout();
            setTimeout(() => {
              if (this.recognition && !isFinalReceived) {
                this.recognition.stop();
              }
            }, 15000);
          };
          this.recognition.onresult = (event) => {
            hasReceivedResults = true;
            interimTranscript = "";
            resetSilenceTimeout();
            for (let i = 0; i < event.results.length; i++) {
              const result = event.results[i];
              const transcript = result[0].transcript.trim();
              if (transcript) {
                lastNonEmptyTranscript = transcript;
              }
              if (result.isFinal) {
                isFinalReceived = true;
                let processedTranscript = this.cleanTranscript(transcript);
                fullTranscript = processedTranscript;
                if (finalTimeout) clearTimeout(finalTimeout);
                finalTimeout = setTimeout(() => {
                  if (this.recognition) {
                    this.recognition.stop();
                  }
                }, 2000);
              } else {
                interimTranscript = this.cleanTranscript(transcript);
              }
            }
          };
          this.recognition.onend = () => {
            if (silenceTimeout) clearTimeout(silenceTimeout);
            if (finalTimeout) clearTimeout(finalTimeout);
            // For Khmer: resolve with any available transcript (even if not final)
            if (this.currentLanguage === "km") {
              if (fullTranscript) {
                resolve(fullTranscript);
              } else if (interimTranscript) {
                resolve(interimTranscript);
              } else if (lastNonEmptyTranscript) {
                resolve(lastNonEmptyTranscript);
              } else {
                reject(
                  new Error("No speech detected. Please try speaking again.")
                );
              }
            } else {
              if (fullTranscript) {
                resolve(fullTranscript);
              } else if (interimTranscript) {
                resolve(interimTranscript);
              } else if (!hasReceivedResults) {
                reject(
                  new Error("No speech detected. Please try speaking again.")
                );
              } else {
                reject(
                  new Error("No speech detected. Please try speaking again.")
                );
              }
            }
          };
          this.recognition.onerror = (event) => {
            reject(new Error(`Speech recognition error: ${event.error}`));
          };
          try {
            this.recognition.start();
          } catch (error) {
            reject(error);
          }
          return;
        }

        // --- Fallback: Azure SDK for Khmer if browser SpeechRecognition not available ---
        if (this.currentLanguage === "km") {
          console.log("[VoiceService] Fallback: Using Azure SDK for Khmer");
          try {
            const key = import.meta.env.VITE_AZURE_TTS_KEY || "";
            const region =
              import.meta.env.VITE_AZURE_TTS_REGION || "centralindia";
            const transcript = await recognizeKhmerSpeech(key, region);
            resolve(transcript);
            return;
          } catch (err) {
            reject(err);
            return;
          }
        }

        // --- No support ---
        reject(new Error("Speech recognition not supported"));
      } catch (error) {
        reject(error);
      }
    });
  }

  public stopListening(): void {
    try {
      // Stop Azure STT if it's running
      this.azureSTT.stopRecording();

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
    return new Promise(async (resolve, reject) => {
      try {
        console.log("[VoiceService] Starting speak with text:", text);
        console.log("[VoiceService] Current language:", this.currentLanguage);

        // Stop any currently playing audio
        this.stopSpeaking();

        // Use Azure TTS for Khmer language
        if (this.currentLanguage === "km") {
          try {
            await this.azureTTS.speak(text, this.currentLanguage);
            resolve();
            return;
          } catch (azureError) {
            console.error("[VoiceService] Azure TTS failed:", azureError);
            reject(azureError);
            return;
          }
        }

        // Browser synthesis only for English
        if (!this.synthesis) {
          console.log("Speech synthesis not available");
          return resolve();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-US";
        utterance.rate = 1;
        utterance.pitch = 1;
        utterance.volume = 1;

        // Voice selection only for English
        const voices = speechSynthesis.getVoices();
        const selectedVoice = voices.find((v) => v.lang.startsWith("en"));
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }

        utterance.onend = () => {
          console.log("Speech completed");
          resolve();
        };

        utterance.onerror = (event) => {
          if (event.error === "not-allowed") {
            console.log("Speech synthesis blocked");
            resolve();
            return;
          }
          console.error("Speech error:", event.error);
          resolve();
        };

        this.synthesis.speak(utterance);
      } catch (error) {
        console.error("Speech error:", error);
        reject(error);
      }
    });
  }

  stopSpeaking(): void {
    console.log("Stopping speech");
    if (this.synthesis) {
      this.synthesis.cancel();
    }
    // Also stop Azure TTS
    this.azureTTS.stopSpeaking();
  }

  cleanup(): void {
    console.log("Cleaning up resources...");
    this.stopListening();
    this.stopSpeaking();

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    // Cleanup Azure TTS
    this.azureTTS.cleanup();

    // Cleanup Azure STT
    this.azureSTT.cleanup();

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

      // Detect iOS Safari
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isSafari =
        /Safari/.test(navigator.userAgent) &&
        !/Chrome/.test(navigator.userAgent);
      const isIOSSafari = isIOS && isSafari;

      console.log("Browser support check:");
      console.log("- MediaDevices API:", hasMediaDevices);
      console.log("- Speech Recognition:", hasSpeechRecognition);
      console.log("- Speech Synthesis:", hasSpeechSynthesis);
      console.log("- iOS Safari:", isIOSSafari);
      console.log("- User Agent:", navigator.userAgent);

      // iOS Safari has limited support for non-Latin scripts
      if (isIOSSafari && this.currentLanguage === "km") {
        console.warn(
          "iOS Safari has limited support for Khmer speech recognition"
        );
        console.warn(
          "Consider using Chrome or Firefox on iOS for better Khmer support"
        );
      }

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
