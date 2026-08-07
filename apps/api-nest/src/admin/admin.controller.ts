import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AdminService } from './admin.service';
import { CoursesService } from '../courses/courses.service';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';

@Controller('admin')
@Roles('admin')
@UseGuards(RolesGuard)
export class AdminController {
  constructor(
    private adminService: AdminService,
    private coursesService: CoursesService,
  ) {}

  // ── Courses (admin view) ────────────────────────────────────────

  @Get('courses')
  async getCourses(@Query() pagination: PaginationDto) {
    return this.coursesService.findAll({ page: pagination.page, limit: pagination.limit });
  }

  @Delete('courses/:id')
  @HttpCode(HttpStatus.OK)
  async deleteCourse(@Param('id') id: string) {
    return this.coursesService.remove(id);
  }

  @Put('courses/:id/reactivate')
  @HttpCode(HttpStatus.OK)
  async reactivateCourse(@Param('id') id: string) {
    return this.coursesService.update(id, { is_active: true });
  }

  // ── Teacher Permissions ────────────────────────────────────────

  @Get('teacher-permissions')
  async getTeacherPermissions() {
    return this.adminService.getTeacherPermissions();
  }

  @Put('teacher-permissions')
  async updateTeacherPermissions(
    @Body() body: Record<string, boolean>,
  ) {
    return this.adminService.updateTeacherPermissions(body);
  }

  // ── System Stats ───────────────────────────────────────────────

  @Get('stats')
  async getSystemStats() {
    return this.adminService.getSystemStats();
  }

  // ── Roles ──────────────────────────────────────────────────────

  @Get('roles')
  async getRoles() {
    return this.adminService.getRoles();
  }

  @Post('roles')
  async createRole(
    @Body() body: { name: string; description?: string; color?: string },
  ) {
    return this.adminService.createRole(body);
  }

  @Put('roles/:id')
  async updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; description?: string; color?: string; is_active?: boolean },
  ) {
    return this.adminService.updateRole(id, body);
  }

  @Delete('roles/:id')
  @HttpCode(HttpStatus.OK)
  async deleteRole(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.removeRole(id);
  }

  @Put('roles/:id/reactivate')
  @HttpCode(HttpStatus.OK)
  async reactivateRole(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.reactivateRole(id);
  }

  // ── Functionalities ────────────────────────────────────────────

  @Get('functionalities')
  async getFunctionalities() {
    return this.adminService.getFunctionalities();
  }

  @Post('functionalities')
  async createFunctionality(
    @Body() body: { name: string; description?: string; module?: string; icon?: string; route?: string },
  ) {
    return this.adminService.createFunctionality(body);
  }

  @Put('functionalities/:id')
  async updateFunctionality(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; description?: string; module?: string; icon?: string; route?: string; is_active?: boolean },
  ) {
    return this.adminService.updateFunctionality(id, body);
  }

  @Delete('functionalities/:id')
  @HttpCode(HttpStatus.OK)
  async removeFunctionality(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.removeFunctionality(id);
  }

  @Put('functionalities/:id/reactivate')
  @HttpCode(HttpStatus.OK)
  async reactivateFunctionality(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.reactivateFunctionality(id);
  }

  // ── Role Permissions ──────────────────────────────────────────────

  @Get('roles/:roleName/permissions')
  async getRolePermissions(@Param('roleName') roleName: string) {
    return this.adminService.getRolePermissions(roleName);
  }

  @Post('roles/:roleName/permissions')
  async upsertRolePermission(
    @Param('roleName') roleName: string,
    @Body() body: { functionality_id: number; enabled: boolean },
  ) {
    return this.adminService.upsertRolePermission({
      role_name: roleName,
      functionality_id: body.functionality_id,
      enabled: body.enabled,
    });
  }

  @Post('roles/:roleName/permissions/bulk')
  async bulkUpsertRolePermissions(
    @Param('roleName') roleName: string,
    @Body() body: { permissions: Array<{ functionality_id: number; enabled: boolean }> },
  ) {
    return this.adminService.bulkUpsertRolePermissions(roleName, body.permissions);
  }
}
