import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminService } from './admin.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('api/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  private readonly logger = new Logger(AdminController.name);

  @Get('users')
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Patch('users/:id/role')
  async updateUserRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() admin: CurrentUserPayload,
  ) {
    const result = await this.adminService.updateUserRole(id, dto.role);
    this.logger.log(
      `AUDIT: Admin ${admin.email} (${admin.id}) changed role of user ${id} to ${dto.role}`,
    );
    return result;
  }

  @Get('system/info')
  getSystemInfo() {
    return this.adminService.getSystemInfo();
  }

  @Get('stats')
  getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('activity')
  getRecentActivity() {
    return this.adminService.getRecentActivity();
  }
}
