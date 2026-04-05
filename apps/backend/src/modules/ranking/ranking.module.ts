import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { RankingGateway } from './ranking.gateway';
import { RankingService } from './ranking.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  providers: [RankingService, RankingGateway],
  exports: [RankingService, RankingGateway],
})
export class RankingModule {}
