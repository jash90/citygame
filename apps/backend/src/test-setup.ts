import { ConsoleLogger } from '@nestjs/common';

// Silence NestJS Logger during tests. ConsoleLogger.printMessages writes
// directly to process.stdout/stderr, so we stub it at the prototype level.
 
(ConsoleLogger.prototype as any).printMessages = () => {};
