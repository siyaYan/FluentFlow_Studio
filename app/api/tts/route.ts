import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Modality } from '@google/genai';

export async function POST(req: NextRequest) {
  const { text, voice } = await req.json();

  if (!text?.trim()) {
    return NextResponse.json({ error: 'Text is required.' }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Server misconfiguration: missing API key.' }, { status: 500 });
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-tts',
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const audioPart = response.candidates?.[0]?.content?.parts?.[0];
    const audioData = audioPart?.inlineData?.data;
    const mimeType = audioPart?.inlineData?.mimeType;

    if (!audioData || !mimeType) {
      return NextResponse.json({ error: 'Failed to generate audio.' }, { status: 500 });
    }

    return NextResponse.json({ audioData, mimeType });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Audio generation failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
