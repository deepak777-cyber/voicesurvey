import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GoogleCloudTTSService } from "@/services/GoogleCloudTTSService";
import { Language } from "@/types/language";

export function GoogleCloudTTSTest() {
  const [text, setText] = useState(
    "សួស្តី! នេះគឺជាការធ្វើតេស្តសម្រាប់ Google Cloud Text-to-Speech ជាមួយភាសាខ្មែរ។"
  );
  const [language, setLanguage] = useState<Language>("km");
  const [voiceName, setVoiceName] = useState("km-KH-Neural2-A");
  const [speakingRate, setSpeakingRate] = useState(1.0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const ttsService = new GoogleCloudTTSService({
    voiceName,
    speakingRate,
    pitch: 0.0,
    volumeGainDb: 0.0,
  });

  const handleSpeak = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await ttsService.speak(text, language);
      setSuccess("Speech synthesis completed successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = () => {
    ttsService.stopSpeaking();
    setSuccess("Speech stopped");
  };

  const testTexts = {
    km: [
      "សួស្តី! នេះគឺជាការធ្វើតេស្តសម្រាប់ Google Cloud Text-to-Speech ជាមួយភាសាខ្មែរ។",
      "ខ្ញុំចង់ធ្វើការស្ទង់មតិជាមួយអ្នក។",
      "សូមឆ្លើយសំណួរនេះ។",
      "អរគុណសម្រាប់ការចូលរួម។",
    ],
    en: [
      "Hello! This is a test for Google Cloud Text-to-Speech with English.",
      "I would like to conduct a survey with you.",
      "Please answer this question.",
      "Thank you for participating.",
    ],
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Google Cloud TTS Test</CardTitle>
        <CardDescription>
          Test Google Cloud Text-to-Speech with Khmer language support
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="language">Language</Label>
          <Select
            value={language}
            onValueChange={(value: Language) => setLanguage(value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="km">Khmer (ខ្មែរ)</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="voice">Voice</Label>
          <Select value={voiceName} onValueChange={setVoiceName}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="km-KH-Neural2-A">
                km-KH-Neural2-A (Female)
              </SelectItem>
              <SelectItem value="km-KH-Neural2-B">
                km-KH-Neural2-B (Male)
              </SelectItem>
              <SelectItem value="km-KH-Neural2-C">
                km-KH-Neural2-C (Female)
              </SelectItem>
              <SelectItem value="km-KH-Neural2-D">
                km-KH-Neural2-D (Male)
              </SelectItem>
              <SelectItem value="en-US-Neural2-F">
                en-US-Neural2-F (English Female)
              </SelectItem>
              <SelectItem value="en-US-Neural2-M">
                en-US-Neural2-M (English Male)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="speakingRate">Speaking Rate</Label>
          <Input
            id="speakingRate"
            type="number"
            min="0.25"
            max="4.0"
            step="0.1"
            value={speakingRate}
            onChange={(e) => setSpeakingRate(parseFloat(e.target.value))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="text">Text to Speak</Label>
          <div className="space-y-2">
            <Input
              id="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter text to synthesize..."
            />
            <div className="flex flex-wrap gap-2">
              {testTexts[language].map((testText, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => setText(testText)}
                >
                  Test {index + 1}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSpeak} disabled={isLoading} className="flex-1">
            {isLoading ? "Speaking..." : "Speak"}
          </Button>
          <Button variant="outline" onClick={handleStop} disabled={!isLoading}>
            Stop
          </Button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-green-800 text-sm">{success}</p>
          </div>
        )}

        <div className="text-xs text-gray-500">
          <p>
            Make sure you have set the VITE_GOOGLE_CLOUD_SERVICE_ACCOUNT
            environment variable with your service account JSON.
          </p>
          <p>Check the browser console for detailed error messages.</p>
          <p>
            The service account JSON should be on a single line with all quotes
            properly escaped.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
