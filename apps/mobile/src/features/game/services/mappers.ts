import type { BackendGame, BackendTask, Game, Task } from '@/shared/types/api.types';

export function mapGame(bg: BackendGame): Game {
  return {
    id: bg.id,
    name: bg.title,
    description: bg.description,
    city: bg.city,
    coverImageUrl: bg.coverImageUrl,
    taskCount: bg.taskCount,
    duration: bg.settings?.timeLimitMinutes ?? 0,
    currentRun: bg.currentRun ?? 0,
    endsAt: bg.activeRun?.endsAt ?? undefined,
    activeRunId: bg.activeRun?.id ?? undefined,
    isRunning: bg.activeRun?.status === 'ACTIVE',
    narrative: bg.settings?.narrative as Game['narrative'],
    tasks: bg.tasks?.map(mapTask),
  };
}

export function mapTask(bt: BackendTask): Task {
  return {
    id: bt.id,
    title: bt.title,
    description: bt.description,
    type: bt.type,
    points: bt.maxPoints,
    status: 'available',
    order: bt.orderIndex,
    timeLimitSec: bt.timeLimitSec ?? undefined,
    requiresUnlock: bt.unlockMethod === 'GPS' || bt.unlockMethod === 'QR',
    unlockMethod: (bt.unlockMethod as 'GPS' | 'QR' | 'NONE') ?? 'NONE',
    storyContext: bt.storyContext ?? undefined,
    hintCount: bt._count?.hints ?? 0,
    location: {
      lat: bt.latitude,
      lng: bt.longitude,
      radiusMeters: (bt.unlockConfig?.radiusMeters as number) ?? 50,
    },
  };
}
