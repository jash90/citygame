import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { GameModule } from './modules/game/game.module';
import { TaskModule } from './modules/task/task.module';
import { PlayerModule } from './modules/player/player.module';
import { RankingModule } from './modules/ranking/ranking.module';
import { TeamModule } from './modules/team/team.module';
import { AiModule } from './modules/ai/ai.module';
import { StorageModule } from './modules/storage/storage.module';
import { NotificationModule } from './modules/notification/notification.module';
import { HealthModule } from './health/health.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot(),
    PrismaModule,
    HealthModule,
    AuthModule,
    GameModule,
    TaskModule,
    PlayerModule,
    RankingModule,
    TeamModule,
    AiModule,
    StorageModule,
    NotificationModule,
    AdminModule,
  ],
})
export class AppModule {}
