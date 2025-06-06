import { Handler } from "@netlify/functions";

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

export const handler: Handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  }

  try {
    // Get the audio data from the request
    const audioData = event.body;

    if (!audioData) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No audio data provided" }),
      };
    }

    // Call Deepgram API
    const response = await fetch(
      "https://api.deepgram.com/v1/listen?language=en&model=nova-3",
      {
        method: "POST",
        headers: {
          Authorization: `Token ${DEEPGRAM_API_KEY}`,
          "Content-Type": "audio/wav",
        },
        body: Buffer.from(audioData, "base64"),
      }
    );

    if (!response.ok) {
      throw new Error(`Deepgram API error: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error("Transcription error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to transcribe audio" }),
    };
  }
};
