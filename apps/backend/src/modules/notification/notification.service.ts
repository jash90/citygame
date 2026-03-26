import { Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly expo = new Expo();

  /**
   * Send a push notification to a single Expo push token.
   *
   * @param pushToken  Expo push token stored on the user record.
   * @param title      Notification title.
   * @param body       Notification body text.
   * @param data       Optional arbitrary data payload.
   */
  async sendPushNotification(
    pushToken: string,
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    if (!Expo.isExpoPushToken(pushToken)) {
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
   *
   * @param tokens  Array of Expo push tokens.
   * @param title   Notification title.
   * @param body    Notification body text.
   * @param data    Optional arbitrary data payload.
   */
  async sendToMultiple(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    const messages: ExpoPushMessage[] = tokens
      .filter((t) => Expo.isExpoPushToken(t))
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
