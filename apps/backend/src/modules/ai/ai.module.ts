import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AiController } from './ai.controller';
import { AiService, OPENAI_CLIENT } from './ai.service';

@Module({
  controllers: [AiController],
  providers: [
    {
      provide: OPENAI_CLIENT,
      useFactory: (configService: ConfigService) =>
        new OpenAI({
          baseURL: configService.get<string>('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1'),
          apiKey: configService.getOrThrow<string>('OPENROUTER_API_KEY'),
          timeout: configService.get<number>('AI_TIMEOUT_MS', 30000),
          defaultHeaders: {
            'HTTP-Referer': configService.get<string>('APP_URL', 'https://citygame.pl'),
            'X-Title': 'CityGame',
          },
        }),
      inject: [ConfigService],
    },
    AiService,
  ],
  exports: [AiService],
})
export class AiModule {}
