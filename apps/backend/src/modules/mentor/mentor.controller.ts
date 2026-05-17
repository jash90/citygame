import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReviewAttemptDto } from './dto/review-attempt.dto';
import { MentorService } from './mentor.service';

@ApiTags('Mentor')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MENTOR, UserRole.ADMIN)
@Controller('api/mentor')
export class MentorController {
  constructor(private readonly mentorService: MentorService) {}

  @ApiOperation({ summary: 'List games the mentor is assigned to' })
  @Get('games')
  getMyGames(@CurrentUser() user: CurrentUserPayload) {
    return this.mentorService.findMyGames(user.id);
  }

  @ApiOperation({ summary: 'List PENDING attempts in a game awaiting review' })
  @ApiParam({ name: 'id', description: 'Game UUID' })
  @Get('games/:id/pending')
  getPending(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.mentorService.findPendingAttempts(user.id, id);
  }

  @ApiOperation({
    summary:
      'Review a PENDING attempt with a 0-100 score and feedback',
  })
  @ApiParam({ name: 'attemptId', description: 'Task attempt UUID' })
  @ApiResponse({ status: 201, description: 'Attempt updated, session advanced if applicable' })
  @Post('attempts/:attemptId/review')
  review(
    @Param('attemptId', ParseUUIDPipe) attemptId: string,
    @Body() dto: ReviewAttemptDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.mentorService.reviewAttempt({
      mentorId: user.id,
      attemptId,
      score: dto.score,
      feedback: dto.feedback,
    });
  }
}
