import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { GameAnalyticsService } from './game-analytics.service';
import { GameController } from './game.controller';
import { GameExpiryService } from './game-expiry.service';
import { GameRunService } from './game-run.service';
import { GameService } from './game.service';

@Module({
  imports: [NotificationModule],
  controllers: [GameController],
  providers: [GameService, GameRunService, GameAnalyticsService, GameExpiryService],
  exports: [GameService, GameRunService, GameAnalyticsService],
})
export class GameModule {}
