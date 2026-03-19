import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: NextRequest) {
  const { text, level, levelName } = await req.json();

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
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            {
              text: `Analyze this text for an English learner at the ${level} (${levelName}) level:\n\n${text}`,
            },
          ],
        },
      ],
      config: {
        systemInstruction:
          "You are a world-class English tutor. Analyze the text and provide a JSON response with: 'summary' (concise paragraph), 'vocabulary' (5-7 key words with word, definition, and example sentence), and 'learningExercises' (3 key takeaways, each with 3 comprehension/discussion questions). Ensure all content is perfectly tailored to the specified CEFR level.",
        responseMimeType: 'application/json',
      },
    });

    const result = JSON.parse(response.text || '{}');
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 });
  }
}
