import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Task, TaskType } from '@prisma/client';
import { AudioAiStrategy } from './strategies/audio-ai.strategy';
import { CipherStrategy } from './strategies/cipher.strategy';
import { GpsReachStrategy } from './strategies/gps-reach.strategy';
import { MixedStrategy } from './strategies/mixed.strategy';
import { PhotoAiStrategy } from './strategies/photo-ai.strategy';
import { QrScanStrategy } from './strategies/qr-scan.strategy';
import { TextAiStrategy } from './strategies/text-ai.strategy';
import { TextExactStrategy } from './strategies/text-exact.strategy';
import {
  VerificationResult,
  VerificationStrategy,
} from './strategies/verification-strategy.interface';

@Injectable()
export class VerificationService {
  private readonly strategies: Partial<Record<TaskType, VerificationStrategy>>;

  constructor(
    private readonly qrScanStrategy: QrScanStrategy,
    private readonly gpsReachStrategy: GpsReachStrategy,
    private readonly textExactStrategy: TextExactStrategy,
    private readonly photoAiStrategy: PhotoAiStrategy,
    private readonly textAiStrategy: TextAiStrategy,
    private readonly audioAiStrategy: AudioAiStrategy,
    private readonly cipherStrategy: CipherStrategy,
    @Inject(forwardRef(() => MixedStrategy))
    private readonly mixedStrategy: MixedStrategy,
  ) {
    this.strategies = {
      [TaskType.QR_SCAN]: this.qrScanStrategy,
      [TaskType.GPS_REACH]: this.gpsReachStrategy,
      [TaskType.TEXT_EXACT]: this.textExactStrategy,
      [TaskType.PHOTO_AI]: this.photoAiStrategy,
      [TaskType.TEXT_AI]: this.textAiStrategy,
      [TaskType.AUDIO_AI]: this.audioAiStrategy,
      [TaskType.CIPHER]: this.cipherStrategy,
      [TaskType.MIXED]: this.mixedStrategy,
    };
  }

  /**
   * Dispatch verification to the appropriate strategy for the task type.
   * All task types including AI-based ones (PHOTO_AI, TEXT_AI, AUDIO_AI, CIPHER)
   * are handled via registered strategies.
   *
   * Returns UNSUPPORTED result instead of throwing — callers decide how to handle it.
   */
  async verify(
    task: Task,
    submission: Record<string, unknown>,
  ): Promise<VerificationResult> {
    const strategy = this.strategies[task.type];

    if (!strategy) {
      Logger.warn(
        `No verification strategy registered for task type ${task.type}`,
        VerificationService.name,
      );
      return {
        status: 'ERROR',
        score: 0,
        feedback: `Task type ${task.type} is not supported`,
      };
    }

    const config = task.verifyConfig as Record<string, unknown>;
    return strategy.verify(config, submission);
  }

  /**
   * Verify a single sub-step by its type string.
   * Used internally by MixedStrategy to delegate each sub-step to the correct strategy.
   *
   * Throws BadRequestException for truly invalid sub-step types (caller misconfiguration)
   * rather than NotImplementedException — the strategy map is the single source of truth.
   */
  async verifyStep(
    type: string,
    config: Record<string, unknown>,
    submission: Record<string, unknown>,
  ): Promise<VerificationResult> {
    const taskType = type as TaskType;
    const strategy = this.strategies[taskType];

    if (!strategy) {
      throw new BadRequestException(
        `Invalid sub-step type: ${type}`,
      );
    }

    return strategy.verify(config, submission);
  }

  hasStrategy(type: TaskType): boolean {
    return type in this.strategies;
  }
}
