import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RankingModule } from '../ranking/ranking.module';
import { TaskModule } from '../task/task.module';
import { TeamModule } from '../team/team.module';
import { ActivityBroadcastService } from './activity-broadcast.service';
import { DevPlayerController } from './dev-player.controller';
import { PlayerController } from './player.controller';
import { PlayerDevService } from './player-dev.service';
import { PlayerHintService } from './player-hint.service';
import { PlayerQueryService } from './player-query.service';
import { PlayerService } from './player.service';
import { PlayerTaskService } from './player-task.service';
import { SyncService } from './sync.service';

@Module({
  imports: [ConfigModule, TaskModule, RankingModule, TeamModule],
  controllers: [PlayerController, DevPlayerController],
  providers: [
    PlayerService,
    PlayerTaskService,
    PlayerHintService,
    PlayerQueryService,
    PlayerDevService,
    ActivityBroadcastService,
    SyncService,
  ],
  exports: [PlayerService, PlayerTaskService, PlayerQueryService],
})
export class PlayerModule {}
