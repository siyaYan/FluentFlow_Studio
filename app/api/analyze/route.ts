import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

type RawQuestion = {
  prompt?: string;
  question?: string;
  type?: string;
  options?: string[];
  choices?: string[];
  correctAnswer?: string;
  answer?: string;
  explanation?: string;
  focusWord?: string;
};

type RawExercise = {
  takeaway?: string;
  questions?: Array<RawQuestion | string>;
};

const normalizeQuestion = (question: RawQuestion | string, vocabularyWords: string[]) => {
  const vocabularyWordMap = new Map(vocabularyWords.map((word) => [word.toLowerCase(), word]));

  if (typeof question === 'string') {
    return {
      prompt: question,
      type: 'multiple_choice',
      options: [],
      correctAnswer: '',
      explanation: '',
      focusWord: '',
    };
  }

  const options = Array.isArray(question.options)
    ? question.options.filter((option): option is string => typeof option === 'string' && option.trim().length > 0)
    : Array.isArray(question.choices)
      ? question.choices.filter((option): option is string => typeof option === 'string' && option.trim().length > 0)
      : [];

  const prompt = question.prompt || question.question || 'Question unavailable.';
  const rawType = question.type === 'true_false' ? 'true_false' : 'multiple_choice';
  const rawCorrectAnswer = question.correctAnswer || question.answer || '';
  const correctAnswer =
    rawType === 'true_false'
      ? rawCorrectAnswer.toLowerCase() === 'true'
        ? 'True'
        : rawCorrectAnswer.toLowerCase() === 'false'
          ? 'False'
          : rawCorrectAnswer
      : rawCorrectAnswer;
  const normalizedFocusWord =
    (question.focusWord && vocabularyWordMap.get(question.focusWord.toLowerCase())) ||
    vocabularyWords.find((word) => prompt.toLowerCase().includes(word.toLowerCase())) ||
    '';
  const normalizedOptions =
    rawType === 'true_false'
      ? ['True', 'False']
      : options.includes(correctAnswer) || !correctAnswer
        ? options
        : [...options, correctAnswer].filter(Boolean);

  return {
    prompt,
    type: rawType,
    options: normalizedOptions,
    correctAnswer,
    explanation: question.explanation || '',
    focusWord: normalizedFocusWord,
  };
};

const normalizeExercises = (learningExercises: unknown, vocabularyWords: string[]) => {
  if (!Array.isArray(learningExercises)) {
    return [];
  }

  return learningExercises.map((exercise, index) => {
    const typedExercise = (exercise || {}) as RawExercise;

    return {
      takeaway:
        typeof typedExercise.takeaway === 'string' && typedExercise.takeaway.trim()
          ? typedExercise.takeaway
          : `Key takeaway ${index + 1}`,
      questions: Array.isArray(typedExercise.questions)
        ? typedExercise.questions.map((question) => normalizeQuestion(question, vocabularyWords))
        : [],
    };
  });
};

export async function POST(req: NextRequest) {
  const { text, level, levelName, vocabularyTarget, practiceFocus } = await req.json();

  if (!text?.trim()) {
    return NextResponse.json({ error: 'Text is required.' }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Server misconfiguration: missing API key.' }, { status: 500 });
  }

  const model = process.env.GEMINI_MODEL ?? 'gemini-3-flash-preview';
  const normalizedVocabularyTarget =
    typeof vocabularyTarget === 'number' && [8, 12, 16].includes(vocabularyTarget)
      ? vocabularyTarget
      : 12;
  const normalizedPracticeFocus = practiceFocus === 'balanced' ? 'balanced' : 'vocabulary';
  const practiceFocusInstruction =
    normalizedPracticeFocus === 'balanced'
      ? 'Keep it short and easy to answer. Focus mostly on vocabulary understanding in context, but allow up to 2 out of the 4 total questions to check overall gist or general understanding. Avoid detailed inference or tricky questions.'
      : 'Keep it short and easy to answer. Focus mainly on checking vocabulary understanding in context, paraphrased meaning, word usage, or short phrase meaning from the passage. At least 3 out of the 4 total questions must directly test vocabulary or phrase understanding. Only 1 question may check overall gist or general understanding. Avoid detailed inference or tricky questions.';

  const ai = new GoogleGenAI({ apiKey });

  try {
    const analysisResponse = await ai.models.generateContent({
      model,
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
          `You are a world-class English tutor. Analyze the text and provide a JSON response with exactly these fields: 'summary' (concise paragraph) and 'vocabulary' (array of objects). Extract only words from this text that would genuinely be unfamiliar or challenging for a ${level} (${levelName}) CEFR learner, skip words they would already know, and include as many or as few as the material warrants up to ${normalizedVocabularyTarget}. Each vocabulary object must have exactly these keys: "word", "definition" (appropriate for ${level} level), and "sentence" (a short example sentence using the word). All content must be perfectly tailored to the ${level} (${levelName}) CEFR level.`,
        responseMimeType: 'application/json',
      },
    });

    const result = JSON.parse(analysisResponse.text || '{}');

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

    const vocabularyForPractice = Array.isArray(result.vocabulary)
      ? result.vocabulary.filter(
          (item: Record<string, string>) => typeof item.word === 'string' && item.word.trim().length > 0
        )
      : [];
    const vocabularyWords = vocabularyForPractice.map((item: Record<string, string>) => item.word);

    if (vocabularyForPractice.length > 0) {
      const practiceResponse = await ai.models.generateContent({
        model,
        contents: [
          {
            parts: [
              {
                text:
                  `Create a brief understanding check for this passage.\n\n` +
                  `Passage:\n${text}\n\n` +
                  `Vocabulary list to use for the quiz:\n${JSON.stringify(vocabularyForPractice, null, 2)}`,
              },
            ],
          },
        ],
        config: {
          systemInstruction:
            `You are a world-class English tutor. Create a JSON response with exactly one field: 'learningExercises'. It must be an array of exactly 2 objects. Each object must have exactly these keys: "takeaway" and "questions". Each questions array must contain exactly 2 quiz questions. Each quiz question must be an object with exactly these keys: "prompt", "focusWord", "type", "options", "correctAnswer", and "explanation". The "focusWord" must exactly match one word from the provided vocabulary list. Every question must directly practice one of the provided vocabulary words or short phrases from that list. Do not create questions for words outside that list. Try to cover 4 different focusWord items when possible. The "type" must be either "multiple_choice" or "true_false". For "true_false", the options must be exactly ["True", "False"]. For "multiple_choice", provide 4 plausible answer options and make only one correct. The "correctAnswer" must exactly match one option. The "explanation" must briefly explain why the correct answer is right using the passage and the meaning of the focus word. This is not a full exam. ${practiceFocusInstruction} All content must be perfectly tailored to the ${level} (${levelName}) CEFR level.`,
          responseMimeType: 'application/json',
        },
      });

      const practiceResult = JSON.parse(practiceResponse.text || '{}');
      result.learningExercises = normalizeExercises(practiceResult.learningExercises, vocabularyWords);
    } else {
      result.learningExercises = [];
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json({ error: 'Analysis failed. Please try again.' }, { status: 500 });
  }
}
