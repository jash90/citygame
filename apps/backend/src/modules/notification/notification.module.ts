import { Global, Module } from '@nestjs/common';
import { NotificationService, EXPO_CLIENT, createExpoClient } from './notification.service';

@Global()
@Module({
  providers: [
    {
      provide: EXPO_CLIENT,
      useFactory: createExpoClient,
    },
    NotificationService,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
