<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# FluentFlow Studio

An AI-powered English learning platform for pronunciation practice, vocabulary analysis, and interactive comprehension exercises — built with Next.js and Google Gemini.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 15](https://nextjs.org/) (App Router) |
| Language | TypeScript |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/) |
| Animations | [Motion (Framer Motion)](https://motion.dev/) |
| Icons | [Lucide React](https://lucide.dev/) |
| AI | [Google Gemini](https://ai.google.dev/) via `@google/genai` |
| Deployment | [Vercel](https://vercel.com/) |

## API Security

All Gemini API calls are made **server-side** via Next.js API routes (`/api/tts` and `/api/analyze`). The `GEMINI_API_KEY` is a server-only environment variable — it is never bundled into the client or exposed to the browser.

## Local Development

**Prerequisites:** Node.js 18+

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the example env file and add your Gemini API key:
   ```bash
   cp .env.example .env.local
   ```
   Then edit `.env.local`:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
   Get a key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey).

3. Start the dev server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

## Deploy to Vercel

1. Push your code to GitHub.

2. Import the repo at [vercel.com/new](https://vercel.com/new).

3. In the Vercel project settings under **Environment Variables**, add:
   ```
   GEMINI_API_KEY = your_gemini_api_key_here
   ```
   > Do **not** prefix it with `NEXT_PUBLIC_` — this keeps the key server-side only.

4. Click **Deploy**. Vercel auto-detects Next.js and configures everything.

## Project Structure

```
├── app/
│   ├── layout.tsx          # Root layout & metadata
│   ├── page.tsx            # Home page
│   ├── globals.css         # Global styles (Tailwind)
│   └── api/
│       ├── tts/route.ts    # Server-side TTS proxy → Gemini
│       └── analyze/route.ts# Server-side analysis proxy → Gemini
├── components/
│   └── FluentFlowApp.tsx   # Main UI (client component)
├── next.config.ts
├── postcss.config.mjs
└── tsconfig.json
```

## Features

- **Text-to-Speech** — Convert any English text to audio with 4 voice profiles (Kore, Puck, Zephyr, Charon) powered by Gemini's TTS model
- **AI Analysis** — Vocabulary extraction, executive summary, and CEFR-tailored comprehension exercises
- **Audio Player** — Seek, playback speed control (0.5×–3×), progress tracking
- **CEFR Levels** — Personalized content from A1 (Beginner) to C2 (Proficient)
