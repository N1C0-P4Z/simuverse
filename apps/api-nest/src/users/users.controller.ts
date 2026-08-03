import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles('admin')
  @Permissions('users.manage')
  async findAll(
    @Query() pagination: PaginationDto,
    @Query('q') search?: string,
    @Query('role') role?: string,
  ) {
    return this.usersService.findAll({ page: pagination.page, limit: pagination.limit, search, role });
  }

  @Public()
  @Get('all')
  async findAllUsers() {
    return this.usersService.findAll();
  }

  @Post('create')
  @Roles('admin')
  @Permissions('users.manage')
  async createUser(@Body() dto: CreateUserDto) {
    const bcrypt = await import('bcrypt');
    const password_hash = await bcrypt.hash(dto.password, 10);
    return this.usersService.create({
      email: dto.email,
      password_hash,
      name: dto.name,
      role: dto.role || 'student',
    });
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser('id') currentUserId: string,
    @CurrentUser('role') currentUserRole: string,
  ) {
    // Students can only view themselves
    if (currentUserRole === 'student' && currentUserId !== id) {
      throw new ForbiddenException('Students can only view their own profile');
    }
    return this.usersService.findByIdPublic(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser('id') currentUserId: string,
    @CurrentUser('role') currentUserRole: string,
  ) {
    // Students can only update themselves
    if (currentUserRole === 'student' && currentUserId !== id) {
      throw new ForbiddenException('Students can only update their own profile');
    }

    const updateData: any = { ...dto };
    if (dto.password) {
      const bcrypt = await import('bcrypt');
      updateData.password_hash = await bcrypt.hash(dto.password, 10);
      delete updateData.password;
    }

    return this.usersService.update(id, updateData);
  }

  @Delete(':id')
  @Roles('admin')
  @Permissions('users.manage')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    await this.usersService.remove(id);
    return { message: 'User deactivated' };
  }

  @Put(':id/reactivate')
  @Roles('admin')
  @Permissions('users.manage')
  @HttpCode(HttpStatus.OK)
  async reactivate(@Param('id') id: string) {
    await this.usersService.reactivate(id);
    return { message: 'User reactivated' };
  }

  @Delete(':id/hard')
  @Roles('admin')
  @Permissions('users.hard-delete')
  @HttpCode(HttpStatus.OK)
  async hardDelete(@Param('id') id: string) {
    await this.usersService.hardDelete(id);
    return { message: 'User permanently deleted' };
  }
}
