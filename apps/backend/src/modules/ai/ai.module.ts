import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiCredentialsService } from './ai-credentials.service';
import { AiService } from './ai.service';
import { AiGameBlueprintService } from './ai-game-blueprint.service';

@Module({
  controllers: [AiController],
  providers: [AiCredentialsService, AiService, AiGameBlueprintService],
  exports: [AiCredentialsService, AiService, AiGameBlueprintService],
})
export class AiModule {}
