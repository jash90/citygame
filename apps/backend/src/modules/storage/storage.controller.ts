import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PresignRequestDto } from './dto/presign-request.dto';
import { StorageService } from './storage.service';

@ApiTags('Storage')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('api/storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @ApiOperation({ summary: 'Get a presigned upload URL for file storage' })
  @ApiResponse({ status: 201, description: 'Presigned URL and public file URL' })
  @Post('presign')
  getPresignedUrl(@Body() dto: PresignRequestDto) {
    return this.storageService.getPresignedUploadUrl(dto.key, dto.contentType);
  }
}
