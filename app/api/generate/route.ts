import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: NextRequest) {
  const { topic, level, levelName } = await req.json();

  if (!topic) {
    return NextResponse.json({ error: 'Topic is required.' }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Server misconfiguration: missing API key.' }, { status: 500 });
  }

  const model = process.env.GEMINI_MODEL ?? 'gemini-3-flash-preview';

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          parts: [
            {
              text: `Write an engaging, educational passage of approximately 500 words about the topic: "${topic}".
The passage should be appropriate for an English learner at the ${level} (${levelName}) CEFR level — use vocabulary complexity and sentence structure that matches that level.
Write only the passage text. Do not include a title, headings, or any meta-commentary.`,
            },
          ],
        },
      ],
    });

    const text = response.text?.trim() ?? '';
    if (!text) {
      return NextResponse.json({ error: 'Failed to generate material.' }, { status: 500 });
    }

    return NextResponse.json({ text, topic });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Generation failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
