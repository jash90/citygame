'use client';

import { useState, useCallback } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';

export interface HintItem {
  /** Temporary client-side ID for list keying */
  _key: string;
  id?: string;
  content: string;
  pointPenalty: number;
  orderIndex: number;
}

interface HintEditorProps {
  hints: HintItem[];
  onChange: (hints: HintItem[]) => void;
  maxHints?: number;
}

function inputClass(error?: boolean) {
  return `w-full px-3 py-2 text-sm border rounded-lg outline-none transition-colors focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35] ${
    error ? 'border-red-400' : 'border-gray-300'
  }`;
}

let nextKey = 0;
function generateKey() {
  return `hint-${++nextKey}`;
}

export function HintEditor({ hints, onChange, maxHints = 3 }: HintEditorProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateHint = useCallback(
    (key: string, field: 'content' | 'pointPenalty', value: string | number) => {
      onChange(
        hints.map((h) =>
          h._key === key ? { ...h, [field]: value } : h,
        ),
      );
      // Clear error when user types
      if (field === 'content') {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
    },
    [hints, onChange],
  );

  const addHint = useCallback(() => {
    if (hints.length >= maxHints) return;
    onChange([
      ...hints,
      {
        _key: generateKey(),
        content: '',
        pointPenalty: 10,
        orderIndex: hints.length,
      },
    ]);
  }, [hints, onChange, maxHints]);

  const removeHint = useCallback(
    (key: string) => {
      onChange(
        hints
          .filter((h) => h._key !== key)
          .map((h, i) => ({ ...h, orderIndex: i })),
      );
    },
    [hints, onChange],
  );

  const moveHint = useCallback(
    (key: string, direction: 'up' | 'down') => {
      const idx = hints.findIndex((h) => h._key === key);
      if (direction === 'up' && idx === 0) return;
      if (direction === 'down' && idx === hints.length - 1) return;

      const newHints = [...hints];
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      [newHints[idx], newHints[swapIdx]] = [newHints[swapIdx], newHints[idx]];
      onChange(newHints.map((h, i) => ({ ...h, orderIndex: i })));
    },
    [hints, onChange],
  );

  return (
    <div className="flex flex-col gap-3">
      {hints.length === 0 && (
        <p className="text-sm text-gray-400 italic py-2 text-center">
          Brak podpowiedzi. Dodaj do {maxHints}.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {hints.map((hint, idx) => (
          <li
            key={hint._key}
            className="flex items-start gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200"
          >
            {/* Drag handle (visual only for MVP) */}
            <div className="flex flex-col items-center gap-0.5 pt-1 text-gray-300 flex-shrink-0">
              <GripVertical size={14} />
            </div>

            {/* Order badge */}
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#FF6B35] text-white text-xs font-bold flex items-center justify-center mt-2">
              {idx + 1}
            </span>

            <div className="flex-1 flex flex-col gap-2">
              <textarea
                value={hint.content}
                onChange={(e) => updateHint(hint._key, 'content', e.target.value)}
                rows={2}
                placeholder="Treść podpowiedzi..."
                className={`${inputClass(!!errors[hint._key])} resize-none`}
              />
              {errors[hint._key] && (
                <p className="text-xs text-red-600">{errors[hint._key]}</p>
              )}

              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 flex-shrink-0">Kara punktowa:</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={hint.pointPenalty}
                  onChange={(e) =>
                    updateHint(hint._key, 'pointPenalty', Number(e.target.value))
                  }
                  className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-[#FF6B35]/30 focus:border-[#FF6B35]"
                />
                <span className="text-xs text-gray-400">pkt</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => moveHint(hint._key, 'up')}
                disabled={idx === 0}
                className="p-1 rounded text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors"
                title="Przesuń wyżej"
              >
                <ChevronUp size={14} />
              </button>
              <button
                type="button"
                onClick={() => moveHint(hint._key, 'down')}
                disabled={idx === hints.length - 1}
                className="p-1 rounded text-gray-400 hover:text-gray-700 disabled:opacity-30 transition-colors"
                title="Przesuń niżej"
              >
                <ChevronDown size={14} />
              </button>
              <button
                type="button"
                onClick={() => removeHint(hint._key)}
                className="p-1 rounded text-gray-400 hover:text-red-600 transition-colors"
                title="Usuń podpowiedź"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {hints.length < maxHints && (
        <button
          type="button"
          onClick={addHint}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:border-[#FF6B35] hover:text-[#FF6B35] transition-colors"
        >
          <Plus size={15} />
          Dodaj podpowiedź ({hints.length}/{maxHints})
        </button>
      )}
    </div>
  );
}
