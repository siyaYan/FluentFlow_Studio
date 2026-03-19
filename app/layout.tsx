import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FluentFlow Studio',
  description:
    'AI-powered English learning platform for pronunciation, vocabulary analysis, and interactive comprehension.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
