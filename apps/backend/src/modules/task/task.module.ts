import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { StorageModule } from '../storage/storage.module';
import { AudioAiStrategy } from './verification/strategies/audio-ai.strategy';
import { CipherStrategy } from './verification/strategies/cipher.strategy';
import { GpsReachStrategy } from './verification/strategies/gps-reach.strategy';
import { MixedStrategy } from './verification/strategies/mixed.strategy';
import { PhotoAiStrategy } from './verification/strategies/photo-ai.strategy';
import { QrScanStrategy } from './verification/strategies/qr-scan.strategy';
import { TextAiStrategy } from './verification/strategies/text-ai.strategy';
import { TextExactStrategy } from './verification/strategies/text-exact.strategy';
import { VerificationService } from './verification/verification.service';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';

@Module({
  imports: [AiModule, StorageModule],
  controllers: [TaskController],
  providers: [
    TaskService,
    VerificationService,
    QrScanStrategy,
    GpsReachStrategy,
    TextExactStrategy,
    PhotoAiStrategy,
    TextAiStrategy,
    AudioAiStrategy,
    CipherStrategy,
    MixedStrategy,
  ],
  exports: [TaskService, VerificationService],
})
export class TaskModule {}
