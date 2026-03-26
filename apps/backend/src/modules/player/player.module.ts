import { Module } from '@nestjs/common';
import { RankingModule } from '../ranking/ranking.module';
import { TaskModule } from '../task/task.module';
import { TeamModule } from '../team/team.module';
import { PlayerController } from './player.controller';
import { PlayerService } from './player.service';

@Module({
  imports: [TaskModule, RankingModule, TeamModule],
  controllers: [PlayerController],
  providers: [PlayerService],
})
export class PlayerModule {}
