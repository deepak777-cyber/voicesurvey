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
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;

  constructor() {
    this.synthesis = window.speechSynthesis;
  }

  private isMobileBrowser(): boolean {
    const userAgent = navigator.userAgent.toLowerCase();
    console.log("User Agent:", userAgent);
    return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
      userAgent
    );
  }

  private isChromeBrowser(): boolean {
    const userAgent = navigator.userAgent.toLowerCase();
    const vendor = navigator.vendor.toLowerCase();
    const isChrome = /chrome/.test(userAgent) && /google/.test(vendor);
    console.log("Is Chrome:", isChrome, "Vendor:", vendor);
    return isChrome;
  }

  private logBrowserInfo() {
    const info = {
      userAgent: navigator.userAgent,
      vendor: navigator.vendor,
      platform: navigator.platform,
      isMobile: this.isMobileBrowser(),
      isChrome: this.isChromeBrowser(),
      hasMediaDevices: !!navigator.mediaDevices,
      hasGetUserMedia: !!(
        navigator.mediaDevices && navigator.mediaDevices.getUserMedia
      ),
      hasMediaRecorder: typeof MediaRecorder !== "undefined",
      hasSpeechRecognition: !!(
        window.SpeechRecognition || (window as any).webkitSpeechRecognition
      ),
    };
    console.log("Browser Information:", info);
    return info;
  }

  async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;

    const browserInfo = this.logBrowserInfo();
    console.log("Initializing voice service...");

    try {
      // First, check if we have the required APIs
      if (!browserInfo.hasMediaDevices || !browserInfo.hasGetUserMedia) {
        console.error("Required media APIs not available");
        return false;
      }

      // Request microphone permission
      console.log("Requesting microphone permission...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Test MediaRecorder
      console.log("Testing MediaRecorder...");
      const recorder = new MediaRecorder(stream);
      recorder.stop();
      stream.getTracks().forEach((track) => track.stop());

      // For mobile browsers, we're done here
      if (this.isMobileBrowser()) {
        console.log("Mobile browser detected, initialization complete");
        this.isInitialized = true;
        return true;
      }

      // For desktop browsers, also initialize SpeechRecognition
      console.log("Initializing SpeechRecognition...");
      const SpeechRecognitionClass =
        window.SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognitionClass) {
        console.error("SpeechRecognition not available");
        // Still return true if we're on mobile since we'll use MediaRecorder
        return this.isMobileBrowser();
      }

      this.recognition = new SpeechRecognitionClass();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.maxAlternatives = 1;
      this.recognition.lang = "en-US";

      this.isInitialized = true;
      console.log("Voice service initialization complete");
      return true;
    } catch (error) {
      console.error("Error during initialization:", error);
      return false;
    }
  }

  private async setupRecording(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.mediaRecorder = new MediaRecorder(this.stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };
    } catch (error) {
      console.error("Error setting up recording:", error);
      throw new Error("Could not setup recording");
    }
  }

  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isListening = false;
  }

  async startListening(): Promise<string> {
    if (this.isMobileBrowser()) {
      return this.startMobileRecording();
    }
    return this.startDesktopRecording();
  }

  private async startMobileRecording(): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        await this.setupRecording();
        this.isListening = true;

        this.mediaRecorder!.onstop = async () => {
          const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" });
          this.cleanup();

          // Here you would typically send the audioBlob to your server
          // For now, we'll just log it
          console.log("Recording complete, blob size:", audioBlob.size);
          resolve("Recording captured successfully");
        };

        this.mediaRecorder!.start();

        // Record for 5 seconds
        setTimeout(() => {
          if (this.mediaRecorder?.state === "recording") {
            this.mediaRecorder.stop();
          }
        }, 5000);
      } catch (error) {
        this.cleanup();
        reject(new Error("Recording failed: " + error.message));
      }
    });
  }

  private async startDesktopRecording(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.recognition) {
        reject(new Error("Speech recognition not initialized"));
        return;
      }

      if (this.isListening) {
        this.stopListening();
      }

      this.recognition.onresult = (event) => {
        if (event.results.length > 0) {
          const result = event.results[event.results.length - 1];
          if (result.isFinal) {
            const transcript = result[0].transcript;
            this.stopListening();
            resolve(transcript.trim());
          }
        }
      };

      this.recognition.onerror = (event) => {
        this.isListening = false;
        reject(new Error(event.error));
      };

      try {
        this.recognition.start();
        this.isListening = true;
      } catch (error) {
        this.isListening = false;
        reject(error);
      }
    });
  }

  stopListening(): void {
    if (this.isMobileBrowser()) {
      if (this.mediaRecorder?.state === "recording") {
        this.mediaRecorder.stop();
      }
      this.cleanup();
    } else if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
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

  stopSpeaking(): void {
    if (this.synthesis) {
      this.synthesis.cancel();
    }
  }

  isSupported(): boolean {
    const browserInfo = this.logBrowserInfo();

    // Basic requirements for all browsers
    const hasBasicSupport =
      browserInfo.hasMediaDevices &&
      browserInfo.hasGetUserMedia &&
      browserInfo.hasMediaRecorder;

    if (!hasBasicSupport) {
      console.log("Basic media support missing");
      return false;
    }

    // For mobile Chrome, we only need MediaRecorder
    if (browserInfo.isMobile && browserInfo.isChrome) {
      console.log("Mobile Chrome detected, supported");
      return true;
    }

    // For desktop browsers, we need SpeechRecognition
    if (!browserInfo.isMobile) {
      const hasSpeechRecognition = browserInfo.hasSpeechRecognition;
      console.log(
        "Desktop browser detected, SpeechRecognition support:",
        hasSpeechRecognition
      );
      return hasSpeechRecognition;
    }

    // For other mobile browsers, we'll use MediaRecorder
    console.log("Other mobile browser detected, using MediaRecorder");
    return true;
  }
}
