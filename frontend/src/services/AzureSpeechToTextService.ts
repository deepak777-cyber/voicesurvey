import axios from "axios";

export interface AzureSpeechConfig {
  subscriptionKey: string;
  region: string;
  language: string;
}

export class AzureSpeechToTextService {
  private config: AzureSpeechConfig;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private isRecording = false;
  private stream: MediaStream | null = null;
  private recordingTimeout: NodeJS.Timeout | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private silenceTimer: NodeJS.Timeout | null = null;
  private hasSpeech = false;

  constructor(config: AzureSpeechConfig) {
    this.config = config;
  }

  public async startListening(): Promise<string> {
    return new Promise(async (resolve, reject) => {
      try {
        console.log("[AzureSTT] Starting speech recognition...");
        console.log("[AzureSTT] Language:", this.config.language);

        // Clean up any existing recording
        this.cleanup();

        // Get microphone access with specific constraints
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 16000,
            channelCount: 1,
          },
        });

        // Set up audio analysis for speech detection
        await this.setupAudioAnalysis();

        // Try different MIME types in order of preference
        const mimeTypes = [
          "audio/webm;codecs=opus",
          "audio/webm",
          "audio/mp4",
          "audio/wav",
        ];

        let selectedMimeType = null;
        for (const mimeType of mimeTypes) {
          if (MediaRecorder.isTypeSupported(mimeType)) {
            selectedMimeType = mimeType;
            break;
          }
        }

        if (!selectedMimeType) {
          throw new Error("No supported audio format found");
        }

        console.log("[AzureSTT] Using MIME type:", selectedMimeType);

        // Create MediaRecorder
        this.mediaRecorder = new MediaRecorder(this.stream, {
          mimeType: selectedMimeType,
        });

        this.audioChunks = [];
        this.isRecording = true;
        this.hasSpeech = false;

        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0 && this.hasSpeech) {
            this.audioChunks.push(event.data);
            console.log(
              "[AzureSTT] Audio chunk received (speech detected):",
              event.data.size,
              "bytes"
            );
          }
        };

        this.mediaRecorder.onstop = async () => {
          if (this.audioChunks.length > 0) {
            try {
              const audioBlob = new Blob(this.audioChunks, {
                type: selectedMimeType,
              });
              console.log(
                "[AzureSTT] Final audio blob size:",
                audioBlob.size,
                "bytes"
              );

              if (audioBlob.size < 1000) {
                reject(new Error("Audio too short, please speak longer"));
                return;
              }

              const transcript = await this.transcribeAudio(
                audioBlob,
                selectedMimeType
              );
              resolve(transcript);
            } catch (error) {
              reject(error);
            }
          } else {
            reject(new Error("No speech detected. Please try speaking again."));
          }
        };

        // Start recording
        this.mediaRecorder.start(1000); // Collect data every second
        console.log("[AzureSTT] Recording started - waiting for speech...");

        // Set a timeout to stop recording
        this.recordingTimeout = setTimeout(() => {
          if (this.isRecording) {
            console.log("[AzureSTT] Recording timeout reached");
            this.stopRecording();
          }
        }, 10000); // 10 seconds timeout
      } catch (error) {
        console.error("[AzureSTT] Error starting recording:", error);
        reject(error);
      }
    });
  }

  private async setupAudioAnalysis(): Promise<void> {
    try {
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.microphone = this.audioContext.createMediaStreamSource(this.stream!);

      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;

      this.microphone.connect(this.analyser);

      // Start monitoring audio levels
      this.monitorAudioLevel();
    } catch (error) {
      console.error("[AzureSTT] Error setting up audio analysis:", error);
    }
  }

  private monitorAudioLevel(): void {
    if (!this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const checkAudio = () => {
      if (!this.isRecording) return;

      this.analyser!.getByteFrequencyData(dataArray);

      // Calculate average volume
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;

      // Threshold for speech detection (adjust as needed)
      const speechThreshold = 30;

      if (average > speechThreshold) {
        if (!this.hasSpeech) {
          console.log("[AzureSTT] Speech detected! Starting to record...");
          this.hasSpeech = true;
        }

        // Reset silence timer
        if (this.silenceTimer) {
          clearTimeout(this.silenceTimer);
        }

        this.silenceTimer = setTimeout(() => {
          if (this.isRecording && this.hasSpeech) {
            console.log("[AzureSTT] Silence detected, stopping recording");
            this.stopRecording();
          }
        }, 2000); // 2 seconds of silence
      }

      // Continue monitoring
      requestAnimationFrame(checkAudio);
    };

    checkAudio();
  }

  public stopRecording(): void {
    if (this.recordingTimeout) {
      clearTimeout(this.recordingTimeout);
      this.recordingTimeout = null;
    }

    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }

    if (this.mediaRecorder && this.isRecording) {
      this.isRecording = false;
      this.mediaRecorder.stop();
      console.log("[AzureSTT] Recording stopped");
    }
  }

  private async transcribeAudio(
    audioBlob: Blob,
    mimeType: string
  ): Promise<string> {
    try {
      console.log("[AzureSTT] Transcribing audio...");
      console.log("[AzureSTT] Audio blob size:", audioBlob.size, "bytes");
      console.log("[AzureSTT] MIME type:", mimeType);

      // Convert audio to WAV format for better Azure compatibility
      const audioBuffer = await this.convertToWav(audioBlob);

      // Azure Speech-to-Text endpoint
      const endpoint = `https://${this.config.region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1`;

      console.log("[AzureSTT] Sending to Azure with WAV format");
      console.log("[AzureSTT] Language:", this.config.language);

      const response = await axios.post(endpoint, audioBuffer, {
        headers: {
          "Ocp-Apim-Subscription-Key": this.config.subscriptionKey,
          "Content-Type": "audio/wav",
          Accept: "application/json",
        },
        params: {
          language: this.config.language,
          format: "simple",
        },
        timeout: 30000, // 30 second timeout
      });

      console.log("[AzureSTT] Full Azure response:", response.data);

      if (response.data.RecognitionStatus === "Success") {
        let transcript = response.data.DisplayText || "";

        console.log("[AzureSTT] Raw transcript from Azure:", transcript);

        // Basic cleaning
        transcript = transcript.trim();

        // If transcript is suspiciously short or contains the problematic pattern, log it
        if (transcript.includes("1 លោក") || transcript.length < 3) {
          console.warn(
            "[AzureSTT] Suspicious transcript received:",
            transcript
          );
          console.warn(
            "[AzureSTT] This might indicate an issue with the audio or API call"
          );
          throw new Error("Azure returned suspicious result");
        }

        return transcript;
      } else if (response.data.RecognitionStatus === "NoMatch") {
        throw new Error("No speech detected. Please try speaking again.");
      } else {
        throw new Error(
          `Transcription failed: ${response.data.RecognitionStatus}`
        );
      }
    } catch (error) {
      console.error("[AzureSTT] Transcription error:", error);
      console.error(
        "[AzureSTT] Error details:",
        error.response?.data || error.message
      );
      throw error;
    }
  }

  private async convertToWav(audioBlob: Blob): Promise<ArrayBuffer> {
    try {
      // For now, we'll use the audio as-is and let Azure handle the conversion
      // In a production environment, you might want to convert to WAV format
      const arrayBuffer = await audioBlob.arrayBuffer();

      // If the audio is already in a good format, return it
      if (audioBlob.type.includes("webm") || audioBlob.type.includes("mp4")) {
        console.log(
          "[AzureSTT] Using audio as-is, Azure will handle conversion"
        );
        return arrayBuffer;
      }

      return arrayBuffer;
    } catch (error) {
      console.error("[AzureSTT] Error converting audio:", error);
      throw error;
    }
  }

  public cleanup(): void {
    this.stopRecording();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    this.audioChunks = [];
    this.isRecording = false;
    this.hasSpeech = false;
    this.analyser = null;
    this.microphone = null;
  }

  public setLanguage(language: string): void {
    this.config.language = language;
    console.log("[AzureSTT] Language set to:", language);
  }
}
