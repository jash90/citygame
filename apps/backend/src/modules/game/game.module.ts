import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { GameController } from './game.controller';
import { GameExpiryService } from './game-expiry.service';
import { GameService } from './game.service';

@Module({
  imports: [NotificationModule],
  controllers: [GameController],
  providers: [GameService, GameExpiryService],
  exports: [GameService],
})
export class GameModule {}
