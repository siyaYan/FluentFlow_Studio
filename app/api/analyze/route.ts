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
          `You are a world-class English tutor. Analyze the text and provide a JSON response with exactly these fields: 'summary' (concise paragraph), 'vocabulary' (array of objects — extract only words from this text that would genuinely be unfamiliar or challenging for a ${level} (${levelName}) CEFR learner, skip words they would already know; include as many or as few as the material warrants up to 50; each object must have exactly these keys: "word", "definition" (appropriate for ${level} level), "sentence" (a short example sentence using the word)), and 'learningExercises' (3 key takeaways, each with 3 comprehension/discussion questions). All content must be perfectly tailored to the ${level} (${levelName}) CEFR level.`,
        responseMimeType: 'application/json',
      },
    });

    const result = JSON.parse(response.text || '{}');

    // Normalize vocabulary — model may use different keys for the example sentence
    if (Array.isArray(result.vocabulary)) {
      result.vocabulary = result.vocabulary.map((item: Record<string, string>) => ({
        ...item,
        sentence:
          item.sentence ||
          item.example ||
          item.exampleSentence ||
          item.example_sentence ||
          item.sampleSentence ||
          '',
      }));
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 });
  }
}
