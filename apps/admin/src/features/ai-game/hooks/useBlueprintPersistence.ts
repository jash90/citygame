'use client';

import { useEffect, useMemo, useRef } from 'react';
import type { BlueprintInput } from '@citygame/shared';

/**
 * localStorage helper for stage-by-stage AI generation.
 *
 * - Keyed by a stable hash of the canonical `BlueprintInput` so changing any
 *   field (city, theme, allowed task types, etc.) starts a fresh run.
 * - Writes are debounced to 200 ms so a flurry of reducer dispatches during
 *   per-POI fan-out doesn't thrash storage.
 * - Entries expire after 24 h — long enough to survive a coffee break /
 *   network drop, short enough to prevent stale partial blueprints surviving
 *   prompt or model changes.
 *
 * Two-tab caveat: last-write-wins. Two tabs running the same input will
 * stomp each other. Acceptable for an admin tool — documented for posterity.
 */

const STORAGE_PREFIX = 'citygame:ai-blueprint:';
const TTL_MS = 24 * 60 * 60 * 1000;

export interface PersistedEntry<TState> {
  /** Hash of the input that produced this state — used to match on resume. */
  inputHash: string;
  /** Pretty-printed input for the resume modal. */
  inputSummary: { city: string; theme: string };
  /** Reducer state snapshot. Opaque to this hook. */
  state: TState;
  /** Wall-clock timestamp the snapshot was written at. */
  savedAt: number;
}

export function hashBlueprintInput(input: BlueprintInput): string {
  // Canonical key order matters — JSON.stringify is non-deterministic on key
  // order across engines but the V8 / Hermes / JSC implementations all walk
  // own-enumerable keys in insertion order, which is what we get here. Hash
  // is base16-ish — collisions don't matter for a per-admin local cache.
  const canonical = canonicalJson(input);
  let h = 0;
  for (let i = 0; i < canonical.length; i++) {
    h = (h << 5) - h + canonical.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(16).padStart(8, '0');
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJson(v)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
    .join(',')}}`;
}

function storageKey(inputHash: string) {
  return `${STORAGE_PREFIX}${inputHash}`;
}

export function readPersisted<TState>(
  inputHash: string,
): PersistedEntry<TState> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(inputHash));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedEntry<TState>;
    if (
      typeof parsed?.savedAt !== 'number' ||
      Date.now() - parsed.savedAt > TTL_MS
    ) {
      window.localStorage.removeItem(storageKey(inputHash));
      return null;
    }
    if (parsed.inputHash !== inputHash) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPersisted(inputHash: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(storageKey(inputHash));
}

/**
 * Debounced writer. Pass the live state on each render; the hook flushes
 * 200 ms after the last change. Pass `null` for state to suspend writes
 * (e.g. before the user has clicked "Start" or after they pick "Zacznij od
 * nowa" in the resume modal).
 */
export function useDebouncedPersist<TState>(
  inputHash: string | null,
  inputSummary: { city: string; theme: string } | null,
  state: TState | null,
): void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSerialised = useRef<string | null>(null);

  useEffect(() => {
    if (!inputHash || !inputSummary || !state) return;
    const next = JSON.stringify(state);
    if (next === lastSerialised.current) return;
    lastSerialised.current = next;

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        const entry: PersistedEntry<TState> = {
          inputHash,
          inputSummary,
          state,
          savedAt: Date.now(),
        };
        window.localStorage.setItem(storageKey(inputHash), JSON.stringify(entry));
      } catch {
        // Quota exceeded or storage disabled — fail silently; orchestrator
        // still works in-memory, only the resume-after-refresh affordance
        // is lost.
      }
    }, 200);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [inputHash, inputSummary, state]);
}

/**
 * Returns a memoised pair `{ inputHash, inputSummary }` for the given
 * `BlueprintInput`. Inputs that fail validation client-side never reach the
 * orchestrator, so we don't guard against undefined here.
 */
export function useInputIdentity(
  input: BlueprintInput | null,
): { inputHash: string; inputSummary: { city: string; theme: string } } | null {
  return useMemo(() => {
    if (!input) return null;
    return {
      inputHash: hashBlueprintInput(input),
      inputSummary: { city: input.city, theme: input.theme },
    };
  }, [input]);
}
