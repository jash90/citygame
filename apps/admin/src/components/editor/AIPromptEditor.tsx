'use client';

import { useState, useRef } from 'react';
import { Bot, Eye, EyeOff, Hash } from 'lucide-react';
import { TaskType } from '@citygame/shared';

interface AIPromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  taskType: TaskType.PHOTO_AI | TaskType.TEXT_AI | TaskType.AUDIO_AI;
  taskDescription?: string;
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
}: AIPromptEditorProps) {
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    .replace(/\{\{player_answer\}\}/g, '[odpowiedź gracza]')
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
        <div className="rounded-xl border border-orange-200 bg-orange-50/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bot size={14} className="text-[#FF6B35]" />
            <span className="text-xs font-semibold text-[#FF6B35]">Podgląd promptu</span>
          </div>
          <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
            {previewText || <span className="text-gray-400 italic">Brak treści promptu</span>}
          </pre>
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
    </div>
  );
}
