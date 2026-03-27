import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Support comma-separated origins from env, plus sensible defaults
  // Supports exact matches and wildcard patterns (e.g., *.vercel.app)
  const rawOrigins = process.env.CORS_ORIGIN ?? 'http://localhost:3000,http://localhost:3002';
  const allowedOrigins = rawOrigins.split(',').map((o) => o.trim());

  const matchesOrigin = (origin: string): boolean => {
    return allowedOrigins.some((pattern) => {
      if (pattern.startsWith('*.')) {
        const suffix = pattern.slice(1); // e.g. ".vercel.app"
        // Only allow origins that end with the suffix AND have the expected prefix
        if (!origin.endsWith(suffix)) return false;
        // Extract the subdomain part (everything before the suffix)
        const url = new URL(origin);
        const hostname = url.hostname;
        const baseDomain = pattern.slice(2); // e.g. "vercel.app"
        const subdomain = hostname.slice(0, hostname.length - baseDomain.length - 1);
        // Only allow subdomains matching the project name pattern
        return subdomain.startsWith('citygame');
      }
      return pattern === origin;
    });
  };

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) {
        callback(null, true);
        return;
      }
      if (matchesOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} not allowed`));
      }
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`Backend running on http://localhost:${port}`);
}

bootstrap();
