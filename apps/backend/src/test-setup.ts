import { ConsoleLogger } from '@nestjs/common';

// Silence NestJS Logger during tests. ConsoleLogger.printMessages writes
// directly to process.stdout/stderr, so we stub it at the prototype level.
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
(ConsoleLogger.prototype as any).printMessages = () => {};
