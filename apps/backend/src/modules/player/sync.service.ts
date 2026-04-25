import { Injectable, Logger } from '@nestjs/common';
import { PlayerHintService } from './player-hint.service';
import { PlayerTaskService } from './player-task.service';
import { SyncItemDto, SyncRequestDto } from './dto/sync-request.dto';

export interface SyncItemSuccess {
  clientSubmissionId: string;
  ok: true;
  type: SyncItemDto['type'];
  /** For submit: the persisted attempt; for hint: revealed hint content + penalty; for unlock: result message. */
  result: Record<string, unknown>;
}

export interface SyncItemFailure {
  clientSubmissionId: string;
  ok: false;
  type: SyncItemDto['type'];
  error: string;
  /** HTTP status code from the underlying NestJS exception, when available. */
  statusCode?: number;
}

export type SyncItemResult = SyncItemSuccess | SyncItemFailure;

export interface SyncResponse {
  results: SyncItemResult[];
}

/**
 * Bulk-replay a queue of player mutations captured offline. Each item is
 * processed independently — a failure on one (e.g. session expired) must not
 * abort the rest, since downstream items may still be valid.
 *
 * Idempotency is delegated to the underlying services via `clientSubmissionId`,
 * so retransmits are safe.
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    private readonly playerTaskService: PlayerTaskService,
    private readonly playerHintService: PlayerHintService,
  ) {}

  async sync(
    gameId: string,
    userId: string,
    dto: SyncRequestDto,
  ): Promise<SyncResponse> {
    const results: SyncItemResult[] = [];

    // Sequential processing preserves causal ordering — `submit` for task N
    // may unlock task N+1, which a subsequent item depends on.
    for (const item of dto.items) {
      try {
        if (item.type === 'submit') {
          const attempt = await this.playerTaskService.submitAnswer(
            gameId,
            item.taskId,
            userId,
            (item.payload ?? {}) as Record<string, unknown>,
            item.clientSubmissionId,
          );
          results.push({
            clientSubmissionId: item.clientSubmissionId,
            ok: true,
            type: 'submit',
            result: attempt as unknown as Record<string, unknown>,
          });
        } else if (item.type === 'hint') {
          const hint = await this.playerHintService.useHint(
            gameId,
            item.taskId,
            userId,
            item.clientSubmissionId,
          );
          results.push({
            clientSubmissionId: item.clientSubmissionId,
            ok: true,
            type: 'hint',
            result: hint as unknown as Record<string, unknown>,
          });
        } else if (item.type === 'unlock') {
          // Unlocks are stateless side-effects on the server (no row written
          // beyond what `submit` would do later); replays are safe without an
          // idempotency key.
          // We don't currently have a service entrypoint that takes one;
          // call the existing path with the original payload.
          const unlock = await this.playerTaskService.unlockTask(
            gameId,
            item.taskId,
            userId,
            (item.payload ?? {}) as Record<string, unknown>,
          );
          results.push({
            clientSubmissionId: item.clientSubmissionId,
            ok: true,
            type: 'unlock',
            result: unlock as unknown as Record<string, unknown>,
          });
        } else {
          results.push({
            clientSubmissionId: item.clientSubmissionId,
            ok: false,
            type: item.type,
            error: `Unknown sync item type: ${item.type as string}`,
          });
        }
      } catch (err) {
        const error = err as { message?: string; status?: number };
        this.logger.warn(
          `Sync item ${item.clientSubmissionId} (${item.type}) failed: ${error.message ?? 'unknown'}`,
        );
        results.push({
          clientSubmissionId: item.clientSubmissionId,
          ok: false,
          type: item.type,
          error: error.message ?? 'Unknown error',
          statusCode: error.status,
        });
      }
    }

    return { results };
  }
}
