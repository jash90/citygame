'use client';

import { useState } from 'react';
import { Sparkles, X, Check, Loader2, ChevronDown } from 'lucide-react';
import { useGenerateTaskContent } from '@/hooks/useAdminApi';

type GenerationType = 'description' | 'hints' | 'prompt';

interface AIGenerateButtonProps {
  gameId: string;
  taskTitle?: string;
  taskDescription?: string;
  taskType?: string;
  onApply: (type: GenerationType, content: string) => void;
}

interface GenerateOption {
  type: GenerationType;
  label: string;
  description: string;
  requiresTitle?: boolean;
}

const GENERATE_OPTIONS: GenerateOption[] = [
  {
    type: 'description',
    label: 'Generuj opis zadania',
    description: 'Opis dla gracza na podstawie tytułu i typu',
    requiresTitle: true,
  },
  {
    type: 'hints',
    label: 'Generuj podpowiedzi',
    description: 'Trzy podpowiedzi na podstawie opisu zadania',
  },
  {
    type: 'prompt',
    label: 'Generuj prompt AI',
    description: 'Prompt weryfikacyjny dla modelu AI',
  },
];

interface GenerateResult {
  type: GenerationType;
  content: string;
}

export function AIGenerateButton({
  gameId,
  taskTitle = '',
  taskDescription = '',
  taskType = '',
  onApply,
}: AIGenerateButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState<GenerationType | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mutation = useGenerateTaskContent(gameId);

  const handleGenerate = (type: GenerationType) => {
    setError(null);
    setResult(null);
    setLoading(type);

    mutation.mutate(
      { type, title: taskTitle, description: taskDescription, taskType },
      {
        onSuccess: (data) => {
          setResult({ type, content: data.content });
          setLoading(null);
        },
        onError: (err) => {
          setError(err instanceof Error ? err.message : 'Błąd generowania');
          setLoading(null);
        },
      },
    );
  };

  const handleApply = () => {
    if (!result) return;
    onApply(result.type, result.content);
    setResult(null);
    setIsOpen(false);
  };

  const handleClose = () => {
    setIsOpen(false);
    setResult(null);
    setError(null);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-gradient-to-r from-[#FF6B35] to-orange-400 text-white font-medium hover:from-[#e55a26] hover:to-orange-500 transition-all shadow-sm shadow-orange-200"
      >
        <Sparkles size={14} />
        Generuj z AI
        <ChevronDown size={13} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={handleClose} />

          {/* Modal */}
          <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl border border-gray-200 shadow-xl z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-orange-50 to-white">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-[#FF6B35]" />
                <span className="text-sm font-semibold text-gray-800">Generuj z AI</span>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Options */}
            {!result && !error && (
              <div className="p-3 flex flex-col gap-1.5">
                {GENERATE_OPTIONS.map((option) => {
                  const isLoading = loading === option.type;
                  const disabled = loading !== null;
                  const missingTitle = option.requiresTitle && !taskTitle.trim();

                  return (
                    <button
                      key={option.type}
                      type="button"
                      disabled={disabled || missingTitle}
                      onClick={() => handleGenerate(option.type)}
                      className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 hover:border-[#FF6B35] hover:bg-orange-50/50 text-left transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                      <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-orange-50 text-[#FF6B35] group-hover:bg-orange-100">
                        {isLoading ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Sparkles size={14} />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{option.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {missingTitle ? 'Wymagany tytuł zadania' : option.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Error state */}
            {error && (
              <div className="p-4 flex flex-col gap-3">
                <p className="text-sm text-red-600">{error}</p>
                <button
                  type="button"
                  onClick={() => setError(null)}
                  className="text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  Spróbuj ponownie
                </button>
              </div>
            )}

            {/* Preview result */}
            {result && (
              <div className="p-4 flex flex-col gap-3">
                <div className="rounded-xl bg-gray-50 border border-gray-200 p-3">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Wygenerowano:</p>
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap line-clamp-6">
                    {result.content}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setResult(null)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Generuj ponownie
                  </button>
                  <button
                    type="button"
                    onClick={handleApply}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-sm bg-[#FF6B35] text-white rounded-lg hover:bg-[#e55a26] transition-colors font-medium"
                  >
                    <Check size={14} />
                    Użyj
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
