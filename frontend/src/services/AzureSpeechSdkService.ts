import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

export async function recognizeKhmerSpeech(
  subscriptionKey: string,
  region: string
): Promise<string> {
  console.log("Using Azure SDK for Khmer!");
  console.log("Azure Key:", subscriptionKey ? "Present" : "Missing");
  console.log("Azure Region:", region);

  return new Promise((resolve, reject) => {
    try {
      console.log("Creating Azure Speech Config...");
      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
        subscriptionKey,
        region
      );
      speechConfig.speechRecognitionLanguage = "km-KH";
      console.log("Speech Config created with language: km-KH");

      console.log("Setting up audio input...");
      const audioConfig = SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();
      console.log("Audio config created");

      console.log("Creating speech recognizer...");
      const recognizer = new SpeechSDK.SpeechRecognizer(
        speechConfig,
        audioConfig
      );
      console.log("Speech recognizer created, starting recognition...");

      recognizer.recognizeOnceAsync((result) => {
        console.log("Azure SDK recognition result received:", result);
        console.log("Result reason:", result.reason);

        if (result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
          console.log("✅ Azure SDK successfully recognized:", result.text);
          resolve(result.text);
        } else if (result.reason === SpeechSDK.ResultReason.NoMatch) {
          console.log("❌ Azure SDK: No speech could be recognized");
          reject("No speech could be recognized.");
        } else if (result.reason === SpeechSDK.ResultReason.Canceled) {
          const cancellation = SpeechSDK.CancellationDetails.fromResult(result);
          console.log(
            "❌ Azure SDK: Recognition canceled:",
            cancellation.reason
          );
          console.log(
            "❌ Azure SDK: Error details:",
            cancellation.errorDetails
          );
          reject(cancellation.errorDetails || "Recognition canceled.");
        } else {
          console.log("❌ Azure SDK: Unknown recognition error");
          reject("Unknown recognition error.");
        }
        recognizer.close();
      });
    } catch (err) {
      console.error("❌ Azure SDK Error:", err);
      reject(err);
    }
  });
}
