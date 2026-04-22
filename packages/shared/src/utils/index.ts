export { haversineDistance } from './geo';
export { filterVisibleTasks } from './pinVisibility';
export type { PinCandidate, FilterVisibleTasksArgs } from './pinVisibility';

export function calculatePoints(
  maxPoints: number,
  hintsUsed: number,
  hintPenalties: number[],
): number {
  const penalty = hintPenalties
    .slice(0, hintsUsed)
    .reduce((sum, p) => sum + p, 0);
  return Math.max(0, maxPoints - penalty);
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
