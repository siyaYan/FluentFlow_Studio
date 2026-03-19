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
          `You are a world-class English tutor. Analyze the text and provide a JSON response with: 'summary' (concise paragraph), 'vocabulary' (extract only the words from this text that would genuinely be unfamiliar or challenging for a ${level} (${levelName}) CEFR learner — skip words they would already know at that level; include as many or as few as the material actually warrants, up to a maximum of 50; each entry needs word, definition appropriate for ${level} level, and a short example sentence), and 'learningExercises' (3 key takeaways, each with 3 comprehension/discussion questions). All content must be perfectly tailored to the ${level} (${levelName}) CEFR level.`,
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
