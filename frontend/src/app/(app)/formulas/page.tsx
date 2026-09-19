'use client';

import { useState } from 'react';
import { createThread, streamAssistantReply } from '@/lib/api';

export default function FormulasPage() {
  const [platform, setPlatform] = useState('excel');
  const [mode, setMode] = useState('generate');
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState({ used: 0, total: 4 });

  const handleGenerate = async () => {
    if (!input.trim()) return;

    // Check usage limit
    if (usage.used >= usage.total) {
      alert('You have reached your free trial limit. Please sign up to continue.');
      window.location.href = '/login';
      return;
    }

    setLoading(true);

    try {
      const { thread } = await createThread({ title: `${platform} formula ${mode}` });
      const prompt = mode === 'generate'
        ? `Generate a ${platform} formula for this request. Return the formula first, followed by a concise explanation: ${input}`
        : `Explain this ${platform} formula step by step and mention any edge cases: ${input}`;
      setResult('');
      await streamAssistantReply(thread.id, prompt, {
        onDelta: (delta) => setResult((current) => current + delta),
        onComplete: () => undefined,
      });
      setUsage(prev => ({ ...prev, used: prev.used + 1 }));
    } catch (error) {
      setResult('Error generating formula. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setInput('');
    setResult('');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    alert('Copied to clipboard!');
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      {/* Left Panel - Input */}
      <div className="w-full md:w-1/2 p-5 md:p-8 border-r border-border-gray overflow-y-auto">
        <h1 className="text-3xl font-bold text-text-primary mb-2">Formulas</h1>
        <p className="text-text-secondary mb-8">Create and manage formulas</p>

        {/* Platform Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-text-primary mb-2">
            I am using ...
          </label>
          <div className="relative">
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full px-4 py-3 border border-border-gray rounded-md bg-white text-text-primary appearance-none pr-10"
            >
              <option value="excel">Microsoft Excel</option>
              <option value="sheets">Google Sheets</option>
              <option value="airtable">Airtable</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              ⚙️
            </div>
          </div>
        </div>

        {/* Mode Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-text-primary mb-2">
            I want the formula to be...
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => setMode('generate')}
              className={`flex-1 py-2.5 rounded-md border-2 transition ${
                mode === 'generate'
                  ? 'border-text-primary bg-white text-text-primary'
                  : 'border-border-gray bg-bg-gray text-text-secondary'
              }`}
            >
              GENERATED
            </button>
            <button
              onClick={() => setMode('explain')}
              className={`flex-1 py-2.5 rounded-md border-2 transition ${
                mode === 'explain'
                  ? 'border-text-primary bg-white text-text-primary'
                  : 'border-border-gray bg-bg-gray text-text-secondary'
              }`}
            >
              EXPLAINED
            </button>
          </div>
        </div>

        {/* Input Area */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-text-primary mb-2">
            Describe the formula you want to generate, try to be as detailed as possible
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Calculate the sum of a range of A1:A10"
            className="w-full h-40 px-4 py-3 border border-border-gray rounded-md resize-none"
          />
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={loading || !input.trim()}
          className="w-full bg-text-primary text-white py-3 rounded-md font-medium hover:bg-opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Generating...' : 'generate'}
        </button>

        {/* Best Practices */}
        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex items-start gap-2">
            <span className="text-lg">💡</span>
            <div>
              <h3 className="text-sm font-semibold text-text-primary mb-1">Best Practices</h3>
              <p className="text-sm text-text-secondary">
                Be specific about your requirements. Include cell ranges, conditions, and expected output format.
              </p>
            </div>
          </div>
        </div>

        {/* Trial Usage Indicator */}
        <div className="mt-6 p-4 bg-bg-gray rounded-md">
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-secondary">Free Trial Usage:</span>
            <span className="text-text-primary font-medium">{usage.used} / {usage.total} used</span>
          </div>
          <div className="mt-2 h-2 bg-white rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-green transition-all"
              style={{ width: `${(usage.used / usage.total) * 100}%` }}
            />
          </div>
          {usage.used >= usage.total && (
            <p className="mt-2 text-sm text-warning-orange">
              Trial limit reached. <a href="/login" className="underline font-medium">Sign up</a> to continue.
            </p>
          )}
        </div>
      </div>

      {/* Right Panel - Result */}
      <div className="w-full md:w-1/2 p-5 md:p-8 bg-bg-gray overflow-y-auto">
        <h2 className="text-2xl font-bold text-text-primary mb-2">Result:</h2>
        <p className="text-text-secondary mb-6">Results will be displayed here</p>

        {result ? (
          <div className="bg-white rounded-md p-6 border border-border-gray">
            <div className="mb-4 p-4 bg-green-50 rounded border border-green-200">
              <code className="text-sm font-mono text-brand-green break-all">
                {result}
              </code>
            </div>

            {mode === 'generate' && (
              <div className="text-sm text-text-secondary space-y-2">
                <p><strong>Explanation:</strong></p>
                <p>This formula will calculate based on your description.</p>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 text-text-secondary hover:text-text-primary transition"
              >
                <span>↺</span> reset
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md transition"
              >
                <span>📋</span> copy
              </button>
            </div>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-text-secondary">
            <p>Your generated formula will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}
