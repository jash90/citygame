import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PlayerLocationService } from './player-location.service';
import { RankingGateway } from './ranking.gateway';
import { RankingService } from './ranking.service';
import { TeamRankingService } from './team-ranking.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  providers: [RankingService, TeamRankingService, PlayerLocationService, RankingGateway],
  exports: [RankingService, TeamRankingService, RankingGateway],
})
export class RankingModule {}
