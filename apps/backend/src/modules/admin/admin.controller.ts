import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminService } from './admin.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

@ApiTags('Admin')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
@Roles(UserRole.ADMIN)
@Controller('api/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  private readonly logger = new Logger(AdminController.name);

  @ApiOperation({ summary: 'List users with search and role filter' })
  @Get('users')
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.adminService.listUsers(query);
  }

  @ApiOperation({ summary: 'Change a user role' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Patch('users/:id/role')
  async updateUserRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() admin: CurrentUserPayload,
  ) {
    const result = await this.adminService.updateUserRole(id, dto.role, admin.id);
    this.logger.log(
      `AUDIT: Admin ${admin.email} (${admin.id}) changed role of user ${id} to ${dto.role}`,
    );
    return result;
  }

  @ApiOperation({ summary: 'Get system health and counts' })
  @Get('system/info')
  getSystemInfo() {
    return this.adminService.getSystemInfo();
  }

  @ApiOperation({ summary: 'Get dashboard statistics' })
  @Get('stats')
  getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @ApiOperation({ summary: 'Get recent activity feed' })
  @Get('activity')
  getRecentActivity() {
    return this.adminService.getRecentActivity();
  }
}
