'use client';

import { useState, useRef } from 'react';
import { Bot, Eye, EyeOff, Hash, Play, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { TaskType } from '@citygame/shared';
import { useTestAiPrompt } from '@/features/editor/hooks/useTaskGeneration';
import type { AiTestResult } from '@/features/editor/hooks/useTaskGeneration';

interface AIPromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  taskType: TaskType.PHOTO_AI | TaskType.TEXT_AI | TaskType.AUDIO_AI;
  taskDescription?: string;
  threshold?: number;
}

const VARIABLES = [
  { token: '{{player_answer}}', label: 'Odpowiedź gracza' },
  { token: '{{task_description}}', label: 'Opis zadania' },
  { token: '{{expected_criteria}}', label: 'Oczekiwane kryteria' },
] as const;

const DEFAULT_PROMPTS: Record<string, string> = {
  [TaskType.PHOTO_AI]: `Jesteś asystentem weryfikującym zdjęcia przesłane przez graczy w miejskiej grze terenowej.

Zadanie gracza: {{task_description}}

Oceń, czy przesłane zdjęcie spełnia kryteria zadania:
{{expected_criteria}}

Odpowiedź gracza/kontekst: {{player_answer}}

Zwróć ocenę w skali 0.0–1.0, gdzie 1.0 oznacza pełne spełnienie kryteriów.`,

  [TaskType.TEXT_AI]: `Jesteś asystentem weryfikującym odpowiedzi tekstowe graczy w miejskiej grze terenowej.

Zadanie: {{task_description}}

Kryteria oceny:
{{expected_criteria}}

Odpowiedź gracza: {{player_answer}}

Oceń odpowiedź w skali 0.0–1.0. Uwzględnij błędy ortograficzne i parafrazkę.`,

  [TaskType.AUDIO_AI]: `Jesteś asystentem weryfikującym nagrania audio przesłane przez graczy.

Zadanie: {{task_description}}

Kryteria:
{{expected_criteria}}

Transkrypcja odpowiedzi: {{player_answer}}

Oceń nagranie w skali 0.0–1.0.`,
};

/** Rough token estimation: ~4 chars per token */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function AIPromptEditor({
  value,
  onChange,
  taskType,
  taskDescription = '',
  threshold = 0.7,
}: AIPromptEditorProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [exampleAnswer, setExampleAnswer] = useState('');
  const [testAnswer, setTestAnswer] = useState('');
  const [testResult, setTestResult] = useState<AiTestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const testMutation = useTestAiPrompt();

  const handleTestPrompt = () => {
    if (!testAnswer.trim() || !value.trim()) return;
    setTestResult(null);
    setTestError(null);

    testMutation.mutate(
      { prompt: value, testAnswer: testAnswer.trim(), threshold, taskType },
      {
        onSuccess: (result) => setTestResult(result),
        onError: (err) => setTestError(err instanceof Error ? err.message : 'Błąd testowania promptu'),
      },
    );
  };

  const handleInsertVariable = (token: string) => {
    const el = textareaRef.current;
    if (!el) {
      onChange(value + token);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = value.slice(0, start) + token + value.slice(end);
    onChange(next);
    // Restore cursor position after React re-render
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const handleLoadDefault = () => {
    onChange(DEFAULT_PROMPTS[taskType] ?? '');
  };

  const previewText = value
    .replace(/\{\{task_description\}\}/g, taskDescription || '[opis zadania]')
    .replace(/\{\{player_answer\}\}/g, exampleAnswer || '[odpowiedź gracza]')
    .replace(/\{\{expected_criteria\}\}/g, '[kryteria oceny]');

  const charCount = value.length;
  const tokenEstimate = estimateTokens(value);

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-gray-500 mr-1">Wstaw zmienną:</span>
        {VARIABLES.map(({ token, label }) => (
          <button
            key={token}
            type="button"
            onClick={() => handleInsertVariable(token)}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-[#FF6B35] border border-gray-200 hover:border-orange-200 transition-colors font-mono"
          >
            <Hash size={10} />
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={handleLoadDefault}
            className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:border-[#FF6B35] hover:text-[#FF6B35] transition-colors"
          >
            Wczytaj domyślny
          </button>
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-colors ${
              showPreview
                ? 'bg-orange-50 border-orange-200 text-[#FF6B35]'
                : 'border-gray-200 text-gray-500 hover:border-[#FF6B35] hover:text-[#FF6B35]'
            }`}
          >
            {showPreview ? <EyeOff size={12} /> : <Eye size={12} />}
            Podgląd
          </button>
        </div>
      </div>

      {/* Editor / Preview toggle */}
      {showPreview ? (
        <div className="flex flex-col gap-3">
          {/* Example answer input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500">Testowa odpowiedź gracza:</label>
            <input
              type="text"
              value={exampleAnswer}
              onChange={(e) => setExampleAnswer(e.target.value)}
              placeholder="Wpisz przykładową odpowiedź gracza..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none transition-colors focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35]"
            />
          </div>
          <div className="rounded-xl border border-orange-200 bg-orange-50/30 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Bot size={14} className="text-[#FF6B35]" />
              <span className="text-xs font-semibold text-[#FF6B35]">Podgląd promptu</span>
            </div>
            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
              {previewText || <span className="text-gray-400 italic">Brak treści promptu</span>}
            </pre>
          </div>
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={7}
          placeholder="Wpisz prompt AI lub wczytaj domyślny szablon..."
          className="w-full px-3 py-3 text-sm border border-gray-300 rounded-xl outline-none transition-colors focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35] resize-none font-mono leading-relaxed"
        />
      )}

      {/* Char count + token estimate */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{charCount} znaków</span>
        <span className="flex items-center gap-1">
          <Bot size={11} />
          ~{tokenEstimate} tokenów
        </span>
      </div>

      {/* Test AI Prompt */}
      <div className="flex flex-col gap-2.5 pt-3 mt-1 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <Play size={13} className="text-[#FF6B35]" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Testuj prompt AI</span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={testAnswer}
            onChange={(e) => setTestAnswer(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleTestPrompt(); } }}
            placeholder="Wpisz testową odpowiedź gracza..."
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none transition-colors focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35]"
          />
          <button
            type="button"
            onClick={handleTestPrompt}
            disabled={testMutation.isPending || !testAnswer.trim() || !value.trim()}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-[#FF6B35] text-white hover:bg-[#e55a26] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {testMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            {testMutation.isPending ? 'Testowanie...' : 'Testuj'}
          </button>
        </div>

        {testError && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
            <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-700">{testError}</p>
          </div>
        )}

        {testResult && (
          <div className={`rounded-xl border p-4 ${
            testResult.passed
              ? 'bg-green-50/50 border-green-200'
              : 'bg-red-50/50 border-red-200'
          }`}>
            {/* Score header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {testResult.passed
                  ? <CheckCircle size={16} className="text-green-600" />
                  : <XCircle size={16} className="text-red-500" />
                }
                <span className={`text-sm font-semibold ${
                  testResult.passed ? 'text-green-700' : 'text-red-700'
                }`}>
                  {testResult.passed ? 'Zaliczone' : 'Niezaliczone'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Wynik:</span>
                <span className={`text-lg font-bold tabular-nums ${
                  testResult.passed ? 'text-green-600' : 'text-red-500'
                }`}>
                  {testResult.score.toFixed(2)}
                </span>
                <span className="text-xs text-gray-400">/ {threshold.toFixed(2)}</span>
              </div>
            </div>

            {/* Score bar */}
            <div className="relative h-2 bg-gray-200 rounded-full mb-3 overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all ${
                  testResult.passed ? 'bg-green-500' : 'bg-red-400'
                }`}
                style={{ width: `${Math.min(100, testResult.score * 100)}%` }}
              />
              <div
                className="absolute inset-y-0 w-0.5 bg-gray-600"
                style={{ left: `${threshold * 100}%` }}
                title={`Próg: ${threshold}`}
              />
            </div>

            {/* Feedback */}
            <div className="flex flex-col gap-2">
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Odpowiedź AI dla gracza:</p>
                <p className="text-sm text-gray-700">{testResult.feedback}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">Rozumowanie AI:</p>
                <p className="text-xs text-gray-500 leading-relaxed">{testResult.reasoning}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
