import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Set up Swagger/OpenAPI documentation at /api/docs.
 * Extracted from main.ts to keep bootstrap function focused.
 */
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('CityGame API')
    .setDescription(
      'Backend API for CityGame — location-based city exploration game platform',
    )
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

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
}
