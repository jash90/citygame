import { Module } from '@nestjs/common';
import { RankingGateway } from './ranking.gateway';
import { RankingService } from './ranking.service';

@Module({
  providers: [RankingService, RankingGateway],
  exports: [RankingService, RankingGateway],
})
export class RankingModule {}
