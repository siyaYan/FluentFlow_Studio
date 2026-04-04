'use client';

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play,
  Pause,
  Square,
  BookOpen,
  Sparkles,
  Volume2,
  Languages,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  RotateCcw,
  Settings,
  GraduationCap,
  MessageSquareQuote,
  Loader2,
  Shuffle,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility for Tailwind classes ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Constants & Config ---
const VOICES = [
  { id: 'Kore', name: 'Kore', trait: 'Firm & Professional' },
  { id: 'Puck', name: 'Puck', trait: 'Upbeat & Energetic' },
  { id: 'Zephyr', name: 'Zephyr', trait: 'Bright & Clear' },
  { id: 'Charon', name: 'Charon', trait: 'Informative & Calm' },
];

const LEVELS = [
  { id: 'A1', name: 'Beginner', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { id: 'A2', name: 'Elementary', color: 'bg-green-100 text-green-700 border-green-200' },
  { id: 'B1', name: 'Intermediate', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { id: 'B2', name: 'Upper-Intermediate', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  { id: 'C1', name: 'Advanced', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { id: 'C2', name: 'Proficient', color: 'bg-rose-100 text-rose-700 border-rose-200' },
];

const TOPICS = [
  'Artificial Intelligence & Society',
  'Climate Change & the Environment',
  'Space Exploration',
  'Ancient Civilizations',
  'Psychology & Human Behavior',
  'Global Economy & Trade',
  'Nutrition & Health Science',
  'Cultural Traditions Around the World',
  'Marine Biology & Ocean Life',
  'Renewable Energy & the Future',
  'Philosophy & Critical Thinking',
  'Architecture & Urban Design',
];

// --- Types ---
interface VocabularyItem {
  word: string;
  definition: string;
  sentence?: string;
  example?: string;
}

interface LearningExercise {
  takeaway: string;
  questions: PracticeQuestion[];
}

interface PracticeQuestion {
  prompt: string;
  focusWord: string;
  type: 'multiple_choice' | 'true_false';
  options: string[];
  correctAnswer: string;
  explanation: string;
}

interface AnalysisResult {
  summary: string;
  vocabulary: VocabularyItem[];
  learningExercises: LearningExercise[];
}

type PracticeFocus = 'vocabulary' | 'balanced';
type AnalysisLandingTab = 'analysis' | 'practice';

interface AppSettings {
  autoPlayAudio: boolean;
  analysisLandingTab: AnalysisLandingTab;
  vocabularyTarget: 8 | 12 | 16;
  practiceFocus: PracticeFocus;
}

const PRACTICE_OPTION_LABELS = ['A', 'B', 'C', 'D'];
const SETTINGS_STORAGE_KEY = 'fluentflow-studio-settings';
const DEFAULT_SETTINGS: AppSettings = {
  autoPlayAudio: true,
  analysisLandingTab: 'analysis',
  vocabularyTarget: 12,
  practiceFocus: 'vocabulary',
};

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// --- Audio Utilities ---
const base64ToArrayBuffer = (base64: string) => {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

const pcmToWav = (pcm16: Int16Array, sampleRate: number) => {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);

  const buffer = new ArrayBuffer(44 + pcm16.byteLength);
  const view = new DataView(buffer);

  const writeString = (v: DataView, offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      v.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcm16.byteLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, 'data');
  view.setUint32(40, pcm16.byteLength, true);

  let offset = 44;
  for (let i = 0; i < pcm16.length; i++) {
    view.setInt16(offset, pcm16[i], true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
};

// --- Main Component ---
export default function FluentFlowApp() {
  // State
  const [textInput, setTextInput] = useState(
    'Welcome to FluentFlow Studio. Here, you can transform any English text into a comprehensive learning experience. Try pasting a podcast transcript or an article to see how it works!'
  );
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0].id);
  const [selectedLevel, setSelectedLevel] = useState(LEVELS[2].id);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const playbackSpeedRef = useRef(1);
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'input' | 'analysis' | 'practice'>('input');
  const [isGeneratingMaterial, setIsGeneratingMaterial] = useState(false);
  const [lastGeneratedTopic, setLastGeneratedTopic] = useState<string | null>(null);
  const [practiceAnswers, setPracticeAnswers] = useState<Record<string, string>>({});
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Audio Refs (main player — HTMLAudioElement for pitch-preserving speed control)
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioBlobUrlRef = useRef<string | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const animationFrameRef = useRef<number | null>(null);

  // Vocab pronunciation (separate context — never affects main player)
  const vocabAudioContextRef = useRef<AudioContext | null>(null);
  const vocabAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [loadingVocabWord, setLoadingVocabWord] = useState<string | null>(null);
  const [playingVocabWord, setPlayingVocabWord] = useState<string | null>(null);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioElementRef.current) audioElementRef.current.pause();
      if (audioBlobUrlRef.current) URL.revokeObjectURL(audioBlobUrlRef.current);
    };
  }, []);

  useEffect(() => {
    try {
      const storedSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!storedSettings) return;

      const parsedSettings = JSON.parse(storedSettings) as Partial<AppSettings>;
      setSettings({
        autoPlayAudio:
          typeof parsedSettings.autoPlayAudio === 'boolean'
            ? parsedSettings.autoPlayAudio
            : DEFAULT_SETTINGS.autoPlayAudio,
        analysisLandingTab:
          parsedSettings.analysisLandingTab === 'practice' ? 'practice' : DEFAULT_SETTINGS.analysisLandingTab,
        vocabularyTarget:
          parsedSettings.vocabularyTarget === 8 ||
          parsedSettings.vocabularyTarget === 12 ||
          parsedSettings.vocabularyTarget === 16
            ? parsedSettings.vocabularyTarget
            : DEFAULT_SETTINGS.vocabularyTarget,
        practiceFocus: parsedSettings.practiceFocus === 'balanced' ? 'balanced' : DEFAULT_SETTINGS.practiceFocus,
      });
    } catch {
      window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const stopAudio = useCallback((resetProgress = true) => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      if (resetProgress) audioElementRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    if (resetProgress) setAudioProgress(0);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  }, []);

  const startProgressLoop = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    const tick = () => {
      const audio = audioElementRef.current;
      if (!audio || audio.paused || audio.ended) return;
      if (audio.duration > 0) setAudioProgress((audio.currentTime / audio.duration) * 100);
      animationFrameRef.current = requestAnimationFrame(tick);
    };
    animationFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const loadAudio = useCallback(
    async (blob: Blob, autoPlay = true) => {
      stopAudio();
      if (audioBlobUrlRef.current) URL.revokeObjectURL(audioBlobUrlRef.current);

      const url = URL.createObjectURL(blob);
      audioBlobUrlRef.current = url;

      const audio = new Audio(url);
      audio.playbackRate = playbackSpeedRef.current;
      audioElementRef.current = audio;

      audio.onloadedmetadata = () => setAudioDuration(audio.duration);
      audio.onended = () => {
        setIsPlaying(false);
        setAudioProgress(0);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      };

      if (!autoPlay) {
        setIsPlaying(false);
        setAudioProgress(0);
        return;
      }

      await audio.play();
      setIsPlaying(true);
      startProgressLoop();
    },
    [stopAudio, startProgressLoop]
  );

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioElementRef.current;
    if (!audio || !audio.duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const percentage = (e.clientX - rect.left) / rect.width;
    audio.currentTime = percentage * audio.duration;
    setAudioProgress(percentage * 100);

    if (audio.paused) {
      audio.play();
      setIsPlaying(true);
      startProgressLoop();
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    playbackSpeedRef.current = speed;
    if (audioElementRef.current) audioElementRef.current.playbackRate = speed;
  };

  const handleGenerateAudio = async (textToSpeak?: string) => {
    const text = textToSpeak || textInput;
    if (!text.trim()) {
      setError('Please provide some text first.');
      return;
    }

    setIsGeneratingAudio(true);
    setError(null);

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: selectedVoice }),
      });

      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg || 'Audio generation failed.');
      }

      const { audioData, mimeType } = await res.json();

      const rateMatch = mimeType.match(/rate=(\d+)/);
      const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
      const pcmDataBuffer = base64ToArrayBuffer(audioData);
      const pcm16 = new Int16Array(pcmDataBuffer);
      const wavBlob = pcmToWav(pcm16, sampleRate);

      await loadAudio(wavBlob, settings.autoPlayAudio);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred during audio generation.';
      console.error(err);
      setError(message);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const handleAnalyze = async () => {
    if (!textInput.trim()) {
      setError('Please provide some text to analyze.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setActiveTab('analysis');

    const levelName = LEVELS.find((l) => l.id === selectedLevel)?.name;

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textInput,
          level: selectedLevel,
          levelName,
          vocabularyTarget: settings.vocabularyTarget,
          practiceFocus: settings.practiceFocus,
        }),
      });

      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg || 'Analysis failed.');
      }

      const result = await res.json();
      setAnalysisResult(result);
      setPracticeAnswers({});
      setActiveTab(settings.analysisLandingTab);
    } catch (err: unknown) {
      console.error(err);
      setError('Analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePlayVocabWord = async (word: string) => {
    // Stop any currently playing vocab word
    if (vocabAudioSourceRef.current) {
      try { vocabAudioSourceRef.current.stop(); } catch { /* already stopped */ }
      vocabAudioSourceRef.current = null;
    }
    if (playingVocabWord === word) {
      setPlayingVocabWord(null);
      return;
    }

    setLoadingVocabWord(word);
    setPlayingVocabWord(null);

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: word, voice: selectedVoice }),
      });
      if (!res.ok) throw new Error('TTS failed');
      const { audioData, mimeType } = await res.json();

      const rateMatch = mimeType.match(/rate=(\d+)/);
      const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
      const pcmBuffer = base64ToArrayBuffer(audioData);
      const pcm16 = new Int16Array(pcmBuffer);
      const wavBlob = pcmToWav(pcm16, sampleRate);

      if (!vocabAudioContextRef.current) {
        vocabAudioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = vocabAudioContextRef.current;
      await ctx.resume();
      const arrayBuffer = await wavBlob.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start();
      vocabAudioSourceRef.current = source;
      setPlayingVocabWord(word);

      source.onended = () => {
        setPlayingVocabWord(null);
        vocabAudioSourceRef.current = null;
      };
    } catch {
      setError('Could not play pronunciation.');
    } finally {
      setLoadingVocabWord(null);
    }
  };

  const handleGenerateMaterial = async () => {
    const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)];
    const levelName = LEVELS.find((l) => l.id === selectedLevel)?.name;

    setIsGeneratingMaterial(true);
    setError(null);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, level: selectedLevel, levelName }),
      });

      if (!res.ok) {
        const { error: msg } = await res.json();
        throw new Error(msg || 'Generation failed.');
      }

      const { text } = await res.json();
      setTextInput(text);
      setLastGeneratedTopic(topic);
      setAnalysisResult(null);
      setPracticeAnswers({});
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate material.';
      setError(message);
    } finally {
      setIsGeneratingMaterial(false);
    }
  };

  const handlePracticeAnswer = (questionKey: string, answer: string) => {
    setPracticeAnswers((current) => ({
      ...current,
      [questionKey]: answer,
    }));
  };

  const practiceQuestions = analysisResult?.learningExercises.flatMap((exercise, sectionIndex) =>
    exercise.questions.map((question, questionIndex) => ({
      ...question,
      key: `${sectionIndex}-${questionIndex}`,
    }))
  ) ?? [];

  const answeredQuestions = practiceQuestions.filter((question) => practiceAnswers[question.key]).length;
  const correctAnswers = practiceQuestions.filter(
    (question) => practiceAnswers[question.key] && practiceAnswers[question.key] === question.correctAnswer
  ).length;
  const vocabularyTargetLabel =
    settings.vocabularyTarget === 8
      ? 'Essentials'
      : settings.vocabularyTarget === 16
        ? 'Deep Dive'
        : 'Balanced';

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-indigo-200 shadow-lg">
              <GraduationCap className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                FluentFlow <span className="text-indigo-600">Studio</span>
              </h1>
              <div className="hidden md:flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                  {vocabularyTargetLabel} Vocab
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                  {settings.practiceFocus === 'balanced' ? 'Balanced Check' : 'Vocab Check'}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                  {settings.analysisLandingTab === 'practice' ? 'Open Practice' : 'Open Analysis'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
              title="Open study settings"
              aria-label="Open study settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {isSettingsOpen && (
          <>
            <motion.button
              type="button"
              aria-label="Close settings"
              className="fixed inset-0 z-40 bg-slate-900/35 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
            />
            <motion.aside
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              className="fixed right-4 top-20 z-50 w-[calc(100%-2rem)] max-w-md rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/30"
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-indigo-500">Study Settings</p>
                  <h2 className="mt-2 text-xl font-bold text-slate-900">Make the app work your way</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    These preferences are saved on this device and used for the next analysis run.
                  </p>
                </div>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close settings panel"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-6 px-6 py-6">
                <section className="space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Audio playback</h3>
                    <p className="text-xs text-slate-500">Choose what happens after text-to-speech finishes generating.</p>
                  </div>
                  <button
                    onClick={() =>
                      setSettings((current) => ({
                        ...current,
                        autoPlayAudio: !current.autoPlayAudio,
                      }))
                    }
                    className={cn(
                      'flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-all',
                      settings.autoPlayAudio
                        ? 'border-indigo-300 bg-indigo-50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    )}
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Autoplay generated audio</p>
                      <p className="text-xs text-slate-500">
                        {settings.autoPlayAudio
                          ? 'Audio starts as soon as it is ready.'
                          : 'Audio is prepared and waits for manual play.'}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest',
                        settings.autoPlayAudio ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                      )}
                    >
                      {settings.autoPlayAudio ? 'On' : 'Off'}
                    </span>
                  </button>
                </section>

                <section className="space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">After analysis</h3>
                    <p className="text-xs text-slate-500">Choose which tab opens automatically once results are ready.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(['analysis', 'practice'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() =>
                          setSettings((current) => ({
                            ...current,
                            analysisLandingTab: tab,
                          }))
                        }
                        className={cn(
                          'rounded-2xl border px-4 py-3 text-left transition-all',
                          settings.analysisLandingTab === tab
                            ? 'border-indigo-600 bg-indigo-600 text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300'
                        )}
                      >
                        <p className="text-sm font-semibold capitalize">{tab}</p>
                        <p
                          className={cn(
                            'mt-1 text-xs',
                            settings.analysisLandingTab === tab ? 'text-indigo-100' : 'text-slate-400'
                          )}
                        >
                          {tab === 'analysis' ? 'Read the summary and vocab first.' : 'Jump straight into the check.'}
                        </p>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Vocabulary list size</h3>
                    <p className="text-xs text-slate-500">Control how many challenging words the AI should keep.</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 8 as const, label: 'Essentials', hint: 'Small set' },
                      { value: 12 as const, label: 'Balanced', hint: 'Default' },
                      { value: 16 as const, label: 'Deep Dive', hint: 'More coverage' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() =>
                          setSettings((current) => ({
                            ...current,
                            vocabularyTarget: option.value,
                          }))
                        }
                        className={cn(
                          'rounded-2xl border px-3 py-3 text-left transition-all',
                          settings.vocabularyTarget === option.value
                            ? 'border-slate-900 bg-slate-900 text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                        )}
                      >
                        <p className="text-sm font-semibold">{option.label}</p>
                        <p
                          className={cn(
                            'mt-1 text-xs',
                            settings.vocabularyTarget === option.value ? 'text-slate-300' : 'text-slate-400'
                          )}
                        >
                          {option.hint}
                        </p>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Understanding check style</h3>
                    <p className="text-xs text-slate-500">Tune how vocabulary-heavy the short quiz should be.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      {
                        value: 'vocabulary' as const,
                        label: 'Vocab-first',
                        hint: 'Mostly word and phrase meaning.',
                      },
                      {
                        value: 'balanced' as const,
                        label: 'Balanced',
                        hint: 'Mix vocab with a little gist checking.',
                      },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() =>
                          setSettings((current) => ({
                            ...current,
                            practiceFocus: option.value,
                          }))
                        }
                        className={cn(
                          'rounded-2xl border px-4 py-3 text-left transition-all',
                          settings.practiceFocus === option.value
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300'
                        )}
                      >
                        <p className="text-sm font-semibold">{option.label}</p>
                        <p
                          className={cn(
                            'mt-1 text-xs',
                            settings.practiceFocus === option.value ? 'text-emerald-700' : 'text-slate-400'
                          )}
                        >
                          {option.hint}
                        </p>
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
                <button
                  onClick={() => setSettings(DEFAULT_SETTINGS)}
                  className="text-xs font-bold uppercase tracking-widest text-slate-400 transition-colors hover:text-slate-700"
                >
                  Reset defaults
                </button>
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800"
                >
                  Done
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Input & Controls */}
        <div className="lg:col-span-7 space-y-6">
          {/* Tabs */}
          <div className="flex p-1 bg-slate-200/50 rounded-xl w-fit">
            {(['input', 'analysis', 'practice'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-6 py-2 rounded-lg text-sm font-medium transition-all capitalize',
                  activeTab === tab
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'input' && (
              <motion.div
                key="input"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2 shrink-0">
                      <MessageSquareQuote className="w-4 h-4 text-indigo-500" />
                      Learning Material
                    </label>
                    <div className="flex items-center gap-2 min-w-0">
                      {lastGeneratedTopic && !isGeneratingMaterial && (
                        <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 border border-indigo-200 rounded-full text-[10px] font-bold text-indigo-600 uppercase tracking-wider truncate max-w-[180px]">
                          {lastGeneratedTopic}
                        </span>
                      )}
                      <button
                        onClick={handleGenerateMaterial}
                        disabled={isGeneratingMaterial || isGeneratingAudio || isAnalyzing}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 transition-all shrink-0"
                        title="Generate random study material"
                      >
                        {isGeneratingMaterial
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Shuffle className="w-3.5 h-3.5" />}
                        Random Topic
                      </button>
                      <span className="text-xs text-slate-400 shrink-0">{textInput.length} chars</span>
                    </div>
                  </div>
                  <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Paste your English text here..."
                    className="w-full h-64 p-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all resize-none text-slate-700 leading-relaxed"
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">CEFR Level</label>
                      <div className="grid grid-cols-3 gap-2">
                        {LEVELS.map((lvl) => (
                          <button
                            key={lvl.id}
                            onClick={() => setSelectedLevel(lvl.id)}
                            className={cn(
                              'py-2 rounded-lg text-xs font-bold border transition-all',
                              selectedLevel === lvl.id
                                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                            )}
                          >
                            {lvl.id}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Voice Profile</label>
                      <div className="grid grid-cols-2 gap-2">
                        {VOICES.map((voice) => (
                          <button
                            key={voice.id}
                            onClick={() => setSelectedVoice(voice.id)}
                            className={cn(
                              'py-2 px-3 rounded-lg text-xs font-medium border transition-all text-left flex flex-col',
                              selectedVoice === voice.id
                                ? 'bg-slate-900 border-slate-900 text-white shadow-lg'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                            )}
                          >
                            <span>{voice.name}</span>
                            <span
                              className={cn(
                                'text-[10px] opacity-60',
                                selectedVoice === voice.id ? 'text-slate-300' : 'text-slate-400'
                              )}
                            >
                              {voice.trait.split(' ')[0]}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={() => handleGenerateAudio()}
                    disabled={isGeneratingAudio || isAnalyzing}
                    className="flex-1 min-w-[200px] h-14 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-3 group"
                  >
                    {isGeneratingAudio ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Volume2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    )}
                    Listen to Text
                  </button>
                  <button
                    onClick={handleAnalyze}
                    disabled={isGeneratingAudio || isAnalyzing}
                    className="flex-1 min-w-[200px] h-14 bg-white border-2 border-slate-900 text-slate-900 hover:bg-slate-50 disabled:opacity-50 rounded-xl font-bold transition-all flex items-center justify-center gap-3"
                  >
                    {isAnalyzing ? (
                      <Loader2 className="w-5 h-5 animate-spin text-slate-900" />
                    ) : (
                      <Sparkles className="w-5 h-5 text-indigo-500" />
                    )}
                    Analyze & Learn
                  </button>
                </div>
              </motion.div>
            )}

            {activeTab === 'analysis' && (
              <motion.div
                key="analysis"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {!analysisResult && !isAnalyzing ? (
                  <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-300">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="w-8 h-8 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">No Analysis Yet</h3>
                    <p className="text-slate-500 mt-2">
                      Go to the Input tab and click &quot;Analyze &amp; Learn&quot; to start.
                    </p>
                    <button
                      onClick={() => setActiveTab('input')}
                      className="mt-6 text-indigo-600 font-bold flex items-center gap-2 mx-auto hover:underline"
                    >
                      Go to Input <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                ) : isAnalyzing ? (
                  <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                    <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-6" />
                    <h3 className="text-xl font-bold text-slate-900">AI Tutor is Thinking...</h3>
                    <p className="text-slate-500 mt-2">
                      We&apos;re breaking down the text, extracting vocabulary, and creating custom exercises for your
                      level.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Summary Section */}
                    <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                      <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-indigo-600" />
                        Executive Summary
                      </h3>
                      <p className="text-slate-600 leading-relaxed italic">&quot;{analysisResult?.summary}&quot;</p>
                    </section>

                    {/* Vocabulary Grid */}
                    <section className="space-y-4">
                      <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Languages className="w-5 h-5 text-indigo-600" />
                        Key Vocabulary
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {analysisResult?.vocabulary?.map((item, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: Math.min(idx * 0.05, 0.4) }}
                            className="bg-white rounded-xl p-5 border border-slate-200 hover:border-indigo-300 transition-colors group"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-bold text-indigo-600 text-lg">{item.word}</h4>
                              <button
                                onClick={() => handlePlayVocabWord(item.word)}
                                className={cn(
                                  'p-2 rounded-lg transition-all',
                                  playingVocabWord === item.word
                                    ? 'bg-indigo-100 text-indigo-600'
                                    : 'bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                                )}
                                title={playingVocabWord === item.word ? 'Stop' : 'Pronounce'}
                              >
                                {loadingVocabWord === item.word
                                  ? <Loader2 className="w-4 h-4 animate-spin" />
                                  : <Volume2 className="w-4 h-4" />}
                              </button>
                            </div>
                            <p className="text-sm text-slate-600 mb-3 font-medium">{item.definition}</p>
                            {item.sentence && (
                              <div className="bg-slate-50 p-3 rounded-lg border-l-4 border-indigo-400">
                                <p className="text-xs text-slate-500 italic">&quot;{item.sentence}&quot;</p>
                              </div>
                            )}
                          </motion.div>
                        ))}
                      </div>
                    </section>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'practice' && (
              <motion.div
                key="practice"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {!analysisResult ? (
                  <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-300">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="text-slate-300 w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">Practice Mode Locked</h3>
                    <p className="text-slate-500 mt-2">
                      Analyze your text first to generate personalized practice questions.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="bg-slate-900 rounded-2xl p-5 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.25em] text-indigo-200 font-bold">
                          Understanding Check
                        </p>
                        <h3 className="text-lg font-bold mt-1">Brief vocabulary check</h3>
                        <p className="text-sm text-slate-300 mt-1">
                          A short quiz to confirm general meaning, with most questions focused on vocabulary in context.
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <div className="min-w-[96px] rounded-xl bg-white/10 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Answered</p>
                          <p className="text-2xl font-bold mt-1">
                            {answeredQuestions}
                            <span className="text-sm text-slate-400">/{practiceQuestions.length}</span>
                          </p>
                        </div>
                        <div className="min-w-[96px] rounded-xl bg-emerald-400/15 px-4 py-3">
                          <p className="text-[10px] uppercase tracking-widest text-emerald-200 font-bold">Correct</p>
                          <p className="text-2xl font-bold mt-1 text-emerald-300">{correctAnswers}</p>
                        </div>
                      </div>
                    </div>

                    {analysisResult.learningExercises.map((ex, idx) => (
                      <div key={idx} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-indigo-600 p-4">
                          <h4 className="text-white font-bold flex items-center gap-2">
                            <span className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center text-xs">
                              0{idx + 1}
                            </span>
                            {ex.takeaway}
                          </h4>
                        </div>
                        <div className="p-6 space-y-4">
                          {ex.questions.map((question, qIdx) => {
                            const questionKey = `${idx}-${qIdx}`;
                            const selectedAnswer = practiceAnswers[questionKey];
                            const hasInteractiveOptions = question.options.length > 0 && Boolean(question.correctAnswer);
                            const isCorrect = selectedAnswer === question.correctAnswer;

                            return (
                              <div
                                key={qIdx}
                                className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-4"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="space-y-2 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      {question.focusWord && (
                                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-700">
                                          Focus Word: {question.focusWord}
                                        </span>
                                      )}
                                      <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-700">
                                        {question.type === 'true_false' ? 'True / False' : 'Multiple Choice'}
                                      </span>
                                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                        Question {qIdx + 1}
                                      </span>
                                    </div>
                                    <p className="text-slate-800 font-medium leading-relaxed">{question.prompt}</p>
                                  </div>
                                  {selectedAnswer && (
                                    <div
                                      className={cn(
                                        'shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest',
                                        isCorrect
                                          ? 'bg-emerald-100 text-emerald-700'
                                          : 'bg-rose-100 text-rose-700'
                                      )}
                                    >
                                      {isCorrect ? 'Correct' : 'Try Again'}
                                    </div>
                                  )}
                                </div>

                                {hasInteractiveOptions ? (
                                  <div className="grid grid-cols-1 gap-3">
                                    {question.options.map((option, optionIndex) => {
                                      const isSelected = selectedAnswer === option;
                                      const isCorrectOption = option === question.correctAnswer;
                                      const revealAnswer = Boolean(selectedAnswer);

                                      return (
                                        <button
                                          key={option}
                                          onClick={() => handlePracticeAnswer(questionKey, option)}
                                          className={cn(
                                            'w-full rounded-xl border px-4 py-3 text-left transition-all',
                                            !revealAnswer && 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50',
                                            revealAnswer && isCorrectOption && 'border-emerald-400 bg-emerald-50 text-emerald-900',
                                            revealAnswer && isSelected && !isCorrectOption && 'border-rose-300 bg-rose-50 text-rose-900',
                                            revealAnswer && !isSelected && !isCorrectOption && 'border-slate-200 bg-white text-slate-500'
                                          )}
                                        >
                                          <span className="flex items-start gap-3">
                                            <span
                                              className={cn(
                                                'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                                                revealAnswer && isCorrectOption
                                                  ? 'bg-emerald-600 text-white'
                                                  : revealAnswer && isSelected
                                                    ? 'bg-rose-600 text-white'
                                                    : 'bg-slate-100 text-slate-500'
                                              )}
                                            >
                                              {PRACTICE_OPTION_LABELS[optionIndex] ?? optionIndex + 1}
                                            </span>
                                            <span className="text-sm font-medium leading-relaxed">{option}</span>
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                    This question came back without answer choices. Run analysis again to generate the
                                    interactive version.
                                  </div>
                                )}

                                {selectedAnswer && question.explanation && (
                                  <div
                                    className={cn(
                                      'rounded-xl border px-4 py-3 text-sm',
                                      isCorrect
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                                        : 'border-rose-200 bg-rose-50 text-rose-900'
                                    )}
                                  >
                                    <p className="font-bold uppercase tracking-widest text-[10px] mb-1">
                                      {isCorrect ? 'Why this is right' : `Correct answer: ${question.correctAnswer}`}
                                    </p>
                                    <p className="leading-relaxed">{question.explanation}</p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Audio Player & Status */}
        <div className="lg:col-span-5 space-y-6">
          {/* Audio Player Widget */}
          <div className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl shadow-slate-200 sticky top-24">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center animate-pulse">
                  <Volume2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Audio Studio</h3>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                    Active Voice: {VOICES.find((v) => v.id === selectedVoice)?.name}
                  </p>
                </div>
              </div>
              <div className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest">
                {isPlaying ? 'Playing' : 'Ready'}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2 mb-8">
              <div
                className="h-2 w-full bg-white/10 rounded-full cursor-pointer group relative"
                onClick={handleSeek}
              >
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
                <motion.div
                  className="h-full bg-indigo-500 relative"
                  initial={{ width: 0 }}
                  animate={{ width: `${audioProgress}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg scale-0 group-hover:scale-100 transition-transform" />
                </motion.div>
              </div>
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>
                  {audioDuration ? formatTime((audioProgress / 100) * audioDuration) : '00:00'}
                </span>
                <span>{audioDuration ? formatTime(audioDuration) : 'Studio Mode'}</span>
              </div>
            </div>

            {/* Speed Slider */}
            <div className="space-y-2 mb-8">
              <div className="flex justify-between items-baseline px-0.5">
                <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold leading-none">
                  Playback Speed
                </span>
                <span className="text-[10px] font-mono text-indigo-400 font-bold leading-none">
                  {playbackSpeed.toFixed(1)}x
                </span>
              </div>
              <div className="relative pt-1 pb-1">
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.1"
                  value={playbackSpeed}
                  onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-all"
                />
              </div>
              <div className="flex justify-between text-[8px] text-slate-600 font-bold uppercase px-0.5">
                <span>0.5x</span>
                <span>1.0x</span>
                <span>1.5x</span>
                <span>2.0x</span>
                <span>2.5x</span>
                <span>3.0x</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={() => {
                  if (audioElementRef.current) audioElementRef.current.currentTime = 0;
                  setAudioProgress(0);
                }}
                className="p-3 text-slate-400 hover:text-white transition-colors"
                title="Reset"
              >
                <RotateCcw className="w-6 h-6" />
              </button>

              <button
                onClick={() => {
                  const audio = audioElementRef.current;
                  if (isPlaying) {
                    audio?.pause();
                    setIsPlaying(false);
                    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
                  } else if (audio?.src) {
                    audio.play();
                    setIsPlaying(true);
                    startProgressLoop();
                  } else {
                    handleGenerateAudio();
                  }
                }}
                disabled={isGeneratingAudio}
                className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-slate-900 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-50"
              >
                {isGeneratingAudio ? (
                  <Loader2 className="w-8 h-8 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-8 h-8 fill-current" />
                ) : (
                  <Play className="w-8 h-8 fill-current ml-1" />
                )}
              </button>

              <button
                onClick={() => stopAudio()}
                disabled={!isPlaying}
                className="p-3 text-slate-400 hover:text-white transition-colors disabled:opacity-20"
                title="Stop"
              >
                <Square className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Tips & Info */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 space-y-4">
            <h4 className="font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Learning Tips
            </h4>
            <ul className="space-y-3">
              {[
                'Listen to the text at least 3 times to catch subtle pronunciations.',
                'Use the practice quiz to check meaning before replaying the passage.',
                'Focus on the key vocabulary in your next conversation.',
              ].map((tip, i) => (
                <li key={i} className="flex gap-3 text-sm text-slate-600">
                  <span className="text-indigo-500 font-bold">•</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          {/* Error Display */}
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <h5 className="text-sm font-bold text-rose-900">Something went wrong</h5>
                <p className="text-xs text-rose-700 mt-1">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="mt-2 text-[10px] font-bold uppercase tracking-widest text-rose-600 hover:text-rose-800"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 py-12 border-t border-slate-200 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-sm text-slate-400">© 2026 FluentFlow Studio. Powered by Gemini AI.</p>
          <div className="flex gap-8">
            <a href="#" className="text-xs font-bold text-slate-400 hover:text-indigo-600 uppercase tracking-widest">
              Privacy
            </a>
            <a href="#" className="text-xs font-bold text-slate-400 hover:text-indigo-600 uppercase tracking-widest">
              Terms
            </a>
            <a href="#" className="text-xs font-bold text-slate-400 hover:text-indigo-600 uppercase tracking-widest">
              Support
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
