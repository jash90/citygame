import { Logger } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

const logger = new Logger('PrismaRetry');

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 50;

/**
 * Retry wrapper for Prisma interactive transactions with Serializable isolation.
 * PostgreSQL SSI may abort transactions with error P2034 (serialization_failure)
 * when concurrent transactions have conflicting read/write dependencies.
 * This wrapper retries the transaction with exponential backoff + jitter.
 */
export async function withSerializableRetry<T>(
  prisma: Pick<PrismaClient, '$transaction'>,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await (prisma.$transaction as Function)(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      const isSerializationFailure =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034';

      if (!isSerializationFailure || attempt === MAX_RETRIES) {
        throw error;
      }

      const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * BASE_DELAY_MS;
      logger.warn(
        `Serialization failure (P2034), retrying attempt ${attempt + 1}/${MAX_RETRIES} after ${Math.round(delay)}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Unreachable, but TypeScript needs it
  throw new Error('withSerializableRetry: exhausted retries');
}
