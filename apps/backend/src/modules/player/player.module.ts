import { Module, Type } from '@nestjs/common';
import { RankingModule } from '../ranking/ranking.module';
import { TaskModule } from '../task/task.module';
import { TeamModule } from '../team/team.module';
import { ActivityBroadcastService } from './activity-broadcast.service';
import { DevPlayerController } from './dev-player.controller';
import { PlayerController } from './player.controller';
import { PlayerService } from './player.service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const controllers: Type<any>[] = [PlayerController];
if (process.env.ENABLE_DEV_ENDPOINTS === 'true') {
  controllers.push(DevPlayerController);
}

@Module({
  imports: [TaskModule, RankingModule, TeamModule],
  controllers,
  providers: [PlayerService, ActivityBroadcastService],
})
export class PlayerModule {}
