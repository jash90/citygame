import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { StorageController } from './storage.controller';
import { StorageService, S3_CLIENT } from './storage.service';

@Module({
  controllers: [StorageController],
  providers: [
    {
      provide: S3_CLIENT,
      useFactory: (configService: ConfigService) =>
        new S3Client({
          region: 'auto',
          endpoint: configService.getOrThrow<string>('R2_ENDPOINT'),
          credentials: {
            accessKeyId: configService.getOrThrow<string>('R2_ACCESS_KEY'),
            secretAccessKey: configService.getOrThrow<string>('R2_SECRET_KEY'),
          },
        }),
      inject: [ConfigService],
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
