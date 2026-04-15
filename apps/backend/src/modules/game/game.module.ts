import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { AdminGameController } from './admin-game.controller';
import { GameAnalyticsService } from './game-analytics.service';
import { GameExpiryService } from './game-expiry.service';
import { GameRunActivityService } from './game-run-activity.service';
import { GameRunService } from './game-run.service';
import { GameService } from './game.service';
import { GameStatusService } from './game-status.service';
import { PlayerGameController } from './player-game.controller';

@Module({
  imports: [NotificationModule],
  controllers: [AdminGameController, PlayerGameController],
  providers: [
    GameService,
    GameStatusService,
    GameRunService,
    GameRunActivityService,
    GameAnalyticsService,
    GameExpiryService,
  ],
  exports: [GameService, GameRunService, GameAnalyticsService],
})
export class GameModule {}
