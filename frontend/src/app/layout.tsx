import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Excel',
  description: 'Spreadsheet assistant, pivot builder, analysis, charts, and reports.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
