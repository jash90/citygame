import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { matchesOrigin } from './common/utils/cors';
import { setupSwagger } from './common/config/swagger-setup';
import { validateStartupConfig } from './common/config/startup-validation';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(cookieParser());

  // Trust the first proxy (e.g. Railway, Vercel) for correct req.secure / X-Forwarded-Proto
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (matchesOrigin(origin, (key) => configService.get<string>(key))) {
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

  setupSwagger(app);
  validateStartupConfig(configService);

  const port = configService.get<number>('PORT', 3001);
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`Backend running on http://localhost:${port}`);
}

bootstrap();
