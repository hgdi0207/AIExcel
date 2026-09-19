'use client';

import { useState } from 'react';
import { createThread, streamAssistantReply } from '@/lib/api';

export default function ScriptsPage() {
  const [platform, setPlatform] = useState('vba');
  const [mode, setMode] = useState('generate');
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const { thread } = await createThread({ title: `${platform} script ${mode}` });
      const prompt = mode === 'generate'
        ? `Generate a ${platform} script for this task. Return usable code with a short explanation: ${input}`
        : `Explain this ${platform} script clearly and identify risks or improvements: ${input}`;
      setResult('');
      await streamAssistantReply(thread.id, prompt, {
        onDelta: (delta) => setResult((current) => current + delta),
        onComplete: () => undefined,
      });
    } catch { setResult('Unable to generate script. Please sign in and try again.'); }
    finally { setLoading(false); }
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      {/* Left Panel */}
      <div className="w-full md:w-1/2 p-5 md:p-8 border-r border-border-gray overflow-y-auto">
        <h1 className="text-3xl font-bold text-text-primary mb-2">Scripts</h1>
        <p className="text-text-secondary mb-8">Create and manage scripts</p>

        <div className="mb-6">
          <label className="block text-sm font-medium text-text-primary mb-2">
            I am using ...
          </label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full px-4 py-3 border border-border-gray rounded-md"
          >
            <option value="vba">Visual Basic Script (VBA)</option>
            <option value="apps-script">Google Apps Script</option>
          </select>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-text-primary mb-2">
            I want the script to be...
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => setMode('generate')}
              className={`flex-1 py-2.5 rounded-md border-2 transition ${
                mode === 'generate'
                  ? 'border-text-primary bg-white'
                  : 'border-border-gray bg-bg-gray'
              }`}
            >
              GENERATED
            </button>
            <button
              onClick={() => setMode('explain')}
              className={`flex-1 py-2.5 rounded-md border-2 transition ${
                mode === 'explain'
                  ? 'border-text-primary bg-white'
                  : 'border-border-gray bg-bg-gray'
              }`}
            >
              EXPLAINED
            </button>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-text-primary mb-2">
            Describe the script you want to generate, try to be as detailed as possible
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Create a bar chart within the range of A1:B5 with the title 'Sales Report' and the x-axis labeled 'Months' and the y-axis labeled 'Sales'"
            className="w-full h-40 px-4 py-3 border border-border-gray rounded-md resize-none"
          />
        </div>

        <button
          onClick={() => void handleGenerate()}
          disabled={loading || !input.trim()}
          className="w-full bg-text-primary text-white py-3 rounded-md font-medium hover:bg-opacity-90 transition disabled:opacity-50"
        >
          {loading ? 'Generating...' : 'generate'}
        </button>
      </div>

      {/* Right Panel */}
      <div className="w-full md:w-1/2 p-5 md:p-8 bg-bg-gray overflow-y-auto">
        <h2 className="text-2xl font-bold text-text-primary mb-2">Result:</h2>
        <p className="text-text-secondary mb-6">Results will be displayed here</p>

        {result ? (
          <div className="bg-white rounded-md p-6 border border-border-gray">
            <pre className="text-sm font-mono whitespace-pre-wrap">{result}</pre>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-text-secondary">
            <p>Your generated script will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}
