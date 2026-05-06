import { Injectable, Logger } from '@nestjs/common';
import {
  AttemptStatus,
  GameEnding,
  GameSession,
  Prisma,
  SessionStatus,
} from '@prisma/client';
import type {
  EndingCondition,
  RevealedItem,
  UnlockedItems,
} from '@citygame/shared';
import { PrismaService } from '../../prisma/prisma.service';

export interface EndingEvaluationResult {
  ending: GameEnding | null;
  unlockedItems: UnlockedItems;
}

/**
 * Evaluates `GameEnding.condition` against the current state of a session.
 *
 * - Conditions are evaluated in `orderIndex` ascending order.
 * - The first match wins. The default ending should have the highest
 *   `orderIndex` so it acts as a fallback only when nothing else matched.
 * - If no ending matches, returns `null` and the session stays ACTIVE.
 */
@Injectable()
export class GameEndingEvaluatorService {
  private readonly logger = new Logger(GameEndingEvaluatorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Merge a `RevealedItem` into a session's `unlockedItems` JSON. Idempotent —
   * if the slug already exists, the latest value wins.
   */
  async mergeRevealedItem(
    tx: Prisma.TransactionClient,
    sessionId: string,
    item: RevealedItem,
  ): Promise<UnlockedItems> {
    const session = await tx.gameSession.findUnique({
      where: { id: sessionId },
      select: { unlockedItems: true },
    });
    const current = (session?.unlockedItems ?? {}) as unknown as UnlockedItems;
    const next: UnlockedItems = { ...current, [item.slug]: item };
    await tx.gameSession.update({
      where: { id: sessionId },
      data: { unlockedItems: next as unknown as Prisma.InputJsonValue },
    });
    return next;
  }

  /**
   * Evaluate every ending defined for a game and return the first that matches
   * the session's state. Marks the session COMPLETED + records `endingId` if a
   * match is found.
   */
  async evaluateAndApply(
    tx: Prisma.TransactionClient,
    sessionId: string,
  ): Promise<EndingEvaluationResult> {
    const session = await tx.gameSession.findUnique({
      where: { id: sessionId },
      include: {
        attempts: {
          where: { status: AttemptStatus.CORRECT },
          select: { taskId: true },
        },
      },
    });
    if (!session) return { ending: null, unlockedItems: {} };

    const endings = await tx.gameEnding.findMany({
      where: { gameId: session.gameId },
      orderBy: { orderIndex: 'asc' },
    });
    if (!endings.length) {
      return {
        ending: null,
        unlockedItems: (session.unlockedItems ?? {}) as unknown as UnlockedItems,
      };
    }

    const completedTaskIds = new Set(session.attempts.map((a) => a.taskId));
    const unlockedItems = (session.unlockedItems ?? {}) as unknown as UnlockedItems;
    const totalPoints = session.totalPoints;

    const totalTasks = await tx.task.count({ where: { gameId: session.gameId } });

    for (const ending of endings) {
      if (
        this.matches(
          ending.condition as unknown as EndingCondition,
          completedTaskIds,
          unlockedItems,
          totalPoints,
          totalTasks,
        )
      ) {
        await this.markCompleted(tx, session, ending);
        return { ending, unlockedItems };
      }
    }
    return { ending: null, unlockedItems };
  }

  private async markCompleted(
    tx: Prisma.TransactionClient,
    session: GameSession,
    ending: GameEnding,
  ): Promise<void> {
    await tx.gameSession.update({
      where: { id: session.id },
      data: {
        endingId: ending.id,
        status: SessionStatus.COMPLETED,
        completedAt: new Date(),
      },
    });
    this.logger.log(
      `Session ${session.id} reached ending ${ending.slug} (${ending.id})`,
    );
  }

  private matches(
    condition: EndingCondition,
    completedTaskIds: Set<string>,
    unlockedItems: UnlockedItems,
    totalPoints: number,
    totalTasks: number,
  ): boolean {
    switch (condition.type) {
      case 'ALL_OF':
        return condition.taskIds.every((id) => completedTaskIds.has(id));
      case 'ANY_OF':
        return condition.taskIds.some((id) => completedTaskIds.has(id));
      case 'SCORE_GTE':
        return totalPoints >= condition.minScore;
      case 'ITEM_COLLECTED':
        return Boolean(unlockedItems[condition.slug]);
      case 'TIMEOUT':
        // TIMEOUT is fired by the GameExpiry job, not in the submit path.
        return false;
      case 'DEFAULT':
        // Default fires once every task is completed (linear games) or as a
        // genuine fallback when nothing else matched.
        return totalTasks > 0 && completedTaskIds.size >= totalTasks;
    }
  }
}
