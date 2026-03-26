import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PresignRequestDto } from './dto/presign-request.dto';
import { StorageService } from './storage.service';

@UseGuards(JwtAuthGuard)
@Controller('api/storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('presign')
  getPresignedUrl(@Body() dto: PresignRequestDto) {
    return this.storageService.getPresignedUploadUrl(dto.key, dto.contentType);
  }
}
