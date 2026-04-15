import { Global, Module } from '@nestjs/common';
import { Expo } from 'expo-server-sdk';
import { NotificationService, EXPO_CLIENT } from './notification.service';

@Global()
@Module({
  providers: [
    {
      provide: EXPO_CLIENT,
      useFactory: () => new Expo(),
    },
    NotificationService,
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
