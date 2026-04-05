import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiService } from './ai.service';
import { GenerateDescriptionDto } from './dto/generate-description.dto';
import { GenerateHintsDto } from './dto/generate-hints.dto';
import { GeneratePromptDto } from './dto/generate-prompt.dto';

@ApiTags('AI')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('api/admin/ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @ApiOperation({ summary: 'Generate a task description using AI' })
  @Post('generate-description')
  async generateDescription(
    @Body() dto: GenerateDescriptionDto,
  ): Promise<{ description: string }> {
    const description = await this.aiService.generateTaskDescription(
      dto.title,
      dto.type,
      dto.city,
    );
    return { description };
  }

  @ApiOperation({ summary: 'Generate progressive hints for a task' })
  @Post('generate-hints')
  async generateHints(
    @Body() dto: GenerateHintsDto,
  ): Promise<{ hints: string[] }> {
    const hints = await this.aiService.generateHints(
      dto.taskDescription,
      dto.count ?? 3,
    );
    return { hints };
  }

  @ApiOperation({ summary: 'Generate an AI verification prompt for a task' })
  @Post('generate-prompt')
  async generatePrompt(
    @Body() dto: GeneratePromptDto,
  ): Promise<{ prompt: string }> {
    const prompt = await this.aiService.generateAIPrompt(
      dto.taskType,
      dto.taskDescription,
    );
    return { prompt };
  }
}
