import { useState, useEffect, useRef, useCallback } from 'react';

interface TimerState {
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  isExpired: boolean;
  formattedTime: string;
}

/**
 * Countdown timer hook. Takes an ISO `endsAt` string and ticks every second.
 * Returns remaining time and an `isExpired` flag.
 */
export function useGameTimer(endsAt: string | undefined): TimerState {
  const computeRemaining = useCallback((): number => {
    if (!endsAt) return -1; // no timer
    return Math.max(0, Math.floor((new Date(endsAt).getTime() - Date.now()) / 1000));
  }, [endsAt]);

  const [remaining, setRemaining] = useState<number>(computeRemaining);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setRemaining(computeRemaining());

    if (!endsAt) return;

    intervalRef.current = setInterval(() => {
      const r = computeRemaining();
      setRemaining(r);
      if (r <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [endsAt, computeRemaining]);

  if (!endsAt || remaining < 0) {
    return {
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSeconds: -1,
      isExpired: false,
      formattedTime: '',
    };
  }

  const hours = Math.floor(remaining / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;

  const pad = (n: number) => String(n).padStart(2, '0');
  const formattedTime = hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;

  return {
    hours,
    minutes,
    seconds,
    totalSeconds: remaining,
    isExpired: remaining <= 0,
    formattedTime,
  };
}
