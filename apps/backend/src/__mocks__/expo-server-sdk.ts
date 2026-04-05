export class Expo {
  static isExpoPushToken(token: string): boolean {
    return typeof token === 'string' && token.startsWith('ExponentPushToken[');
  }

  chunkPushNotifications(messages: unknown[]): unknown[][] {
    return [messages];
  }

  async sendPushNotificationsAsync(_messages: unknown[]): Promise<unknown[]> {
    return [];
  }
}

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: string;
};
