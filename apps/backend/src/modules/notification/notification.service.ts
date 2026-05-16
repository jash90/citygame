import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Expo, ExpoPushMessage } from 'expo-server-sdk';

export const EXPO_CLIENT = 'EXPO_CLIENT';

type ExpoSdkModule = typeof import('expo-server-sdk');

const importExpoSdk = new Function(
  'specifier',
  'return import(specifier)',
) as (specifier: string) => Promise<ExpoSdkModule>;

export async function createExpoClient(): Promise<Expo> {
  const { Expo } = await importExpoSdk('expo-server-sdk');
  return new Expo();
}

function isExpoPushToken(token: string): boolean {
  return /^(Expo|Exponent)PushToken\[[^\]]+\]$/.test(token);
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(@Inject(EXPO_CLIENT) private readonly expo: Expo) {}

  /**
   * Send a push notification to a single Expo push token.
   */
  async sendPushNotification(
    pushToken: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    if (!isExpoPushToken(pushToken)) {
      this.logger.warn(`Invalid Expo push token: ${pushToken}`);
      return;
    }

    try {
      await this.expo.sendPushNotificationsAsync([
        { to: pushToken, title, body, data, sound: 'default' },
      ]);
    } catch (error) {
      this.logger.error('Push notification delivery failed', error);
    }
  }

  /**
   * Send the same push notification to multiple Expo push tokens.
   * Automatically chunks requests per Expo SDK limits.
   */
  async sendToMultiple(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    const messages: ExpoPushMessage[] = tokens
      .filter(isExpoPushToken)
      .map((to) => ({ to, title, body, data, sound: 'default' as const }));

    if (messages.length === 0) return;

    const chunks = this.expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      try {
        await this.expo.sendPushNotificationsAsync(chunk);
      } catch (error) {
        this.logger.error('Chunked push notification delivery failed', error);
      }
    }
  }
}
