import axios from "axios";
import { Language } from "@/types/language";

export interface AzureTTSConfig {
  subscriptionKey: string;
  region: string;
  voiceName: string;
}

export class AzureTTSService {
  private config: AzureTTSConfig;
  private audioElement: HTMLAudioElement | null = null;

  constructor(config: AzureTTSConfig) {
    this.config = config;
    this.setupAudioElement();
  }

  private setupAudioElement(): void {
    if (typeof window === "undefined") return;

    if (!this.audioElement) {
      this.audioElement = new Audio();
      this.audioElement.preload = "auto";
    }
  }

  public async speak(text: string, language: Language): Promise<void> {
    try {
      console.log("[AzureTTS] Starting speech synthesis");
      console.log("[AzureTTS] Language:", language);
      console.log("[AzureTTS] Text:", text);

      // Stop any currently playing audio
      this.stopSpeaking();

      const url = `https://${this.config.region}.tts.speech.microsoft.com/cognitiveservices/v1`;
      const voice =
        language === "km" ? this.config.voiceName : "en-US-JennyNeural";

      const headers = {
        "Ocp-Apim-Subscription-Key": this.config.subscriptionKey,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-16khz-32kbitrate-mono-mp3",
      };

      const ssml = `
        <speak version='1.0' xml:lang='${
          language === "km" ? "km-KH" : "en-US"
        }'>
          <voice name='${voice}'>${text}</voice>
        </speak>`;

      console.log("[AzureTTS] Sending request to Azure TTS");
      const response = await axios.post(url, ssml, {
        headers,
        responseType: "blob",
      });

      console.log("[AzureTTS] Got response from Azure TTS");

      // Create a blob URL for the audio
      const blob = new Blob([response.data], { type: "audio/mpeg" });
      const audioUrl = URL.createObjectURL(blob);

      if (!this.audioElement) {
        this.setupAudioElement();
      }

      return new Promise((resolve, reject) => {
        if (this.audioElement) {
          this.audioElement.src = audioUrl;

          this.audioElement.onended = () => {
            URL.revokeObjectURL(audioUrl);
            resolve();
          };

          this.audioElement.onerror = (error) => {
            console.error("[AzureTTS] Error playing audio:", error);
            URL.revokeObjectURL(audioUrl);
            reject(error);
          };

          this.audioElement.play().catch((error) => {
            console.error("[AzureTTS] Playback error:", error);
            URL.revokeObjectURL(audioUrl);
            reject(error);
          });
        } else {
          URL.revokeObjectURL(audioUrl);
          reject(new Error("Audio element not available"));
        }
      });
    } catch (error) {
      console.error("[AzureTTS] Error during speech synthesis:", error);
      throw error;
    }
  }

  public stopSpeaking(): void {
    if (this.audioElement) {
      try {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
      } catch (error) {
        console.warn("[AzureTTS] Error stopping audio:", error);
      }
    }
  }

  public cleanup(): void {
    this.stopSpeaking();
    if (this.audioElement) {
      this.audioElement.src = "";
      this.audioElement = null;
    }
  }
}
