import { Game, GameRun } from '@prisma/client';

/** Game record enriched with flat count fields expected by the frontend. */
export type GameWithCounts = Game & {
  taskCount: number;
  playerCount: number;
  activeRun: GameRun | null;
  creator: { id: string; displayName: string | null };
};

/**
 * Flatten Prisma's `_count` and `runs` includes into the frontend-friendly
 * `taskCount`, `playerCount`, and `activeRun` shape.
 */
export function mapGameCounts(
  game: Game & {
    creator: { id: string; displayName: string | null };
    runs?: GameRun[];
    _count: { tasks: number; sessions: number };
  },
): GameWithCounts {
  const { _count, runs, ...rest } = game;
  return {
    ...rest,
    taskCount: _count.tasks,
    playerCount: _count.sessions,
    activeRun: runs?.[0] ?? null,
  };
}
