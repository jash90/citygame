import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { NotificationModule } from '../notification/notification.module';
import { AdminGameController } from './admin-game.controller';
import { GameAnalyticsService } from './game-analytics.service';
import { GameBlueprintPersistenceService } from './game-blueprint-persistence.service';
import { GameEndingEvaluatorService } from './game-ending-evaluator.service';
import { GameExpiryService } from './game-expiry.service';
import { GameRunActivityService } from './game-run-activity.service';
import { GameRunService } from './game-run.service';
import { GameService } from './game.service';
import { GameStatusService } from './game-status.service';
import { OfflineBundleService } from './offline-bundle.service';
import { PlayerGameController } from './player-game.controller';

@Module({
  imports: [NotificationModule, AiModule],
  controllers: [AdminGameController, PlayerGameController],
  providers: [
    GameService,
    GameStatusService,
    GameRunService,
    GameRunActivityService,
    GameAnalyticsService,
    GameExpiryService,
    OfflineBundleService,
    GameBlueprintPersistenceService,
    GameEndingEvaluatorService,
  ],
  exports: [
    GameService,
    GameRunService,
    GameAnalyticsService,
    GameEndingEvaluatorService,
  ],
})
export class GameModule {}
