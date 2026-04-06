import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { matchesOrigin } from './common/utils/cors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  // Trust the first proxy (e.g. Railway, Vercel) for correct req.secure / X-Forwarded-Proto
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

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

  // Swagger API documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('CityGame API')
    .setDescription('Backend API for CityGame — location-based city exploration game platform')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addTag('Auth', 'Authentication & user management')
    .addTag('Games', 'Game CRUD & lifecycle')
    .addTag('Tasks', 'Task management (admin)')
    .addTag('Player', 'Player gameplay endpoints')
    .addTag('Teams', 'Team management')
    .addTag('Ranking', 'Leaderboard & ranking')
    .addTag('Admin', 'Admin dashboard & user management')
    .addTag('AI', 'AI content generation')
    .addTag('Storage', 'File upload via presigned URLs')
    .addTag('Health', 'Health check')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // Validate JWT secrets at startup
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    const logger = new Logger('Bootstrap');
    logger.warn(
      'JWT_SECRET is missing or shorter than 32 characters. ' +
      'Set a strong secret in production.',
    );
  }

  const port = process.env.PORT ?? 3001;
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`Backend running on http://localhost:${port}`);
}

bootstrap();
