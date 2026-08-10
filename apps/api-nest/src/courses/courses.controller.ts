import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { IsString, IsOptional, IsBoolean, IsArray, IsInt, MinLength } from 'class-validator';
import { CoursesService } from './courses.service';
import { CourseRubricService } from '../rubrics/course-rubric.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { UpdateCourseRubricDto } from '../rubrics/dto/update-course-rubric.dto';

class CreateCourseDto {
  @IsString()
  @MinLength(1)
  course_id: string;

  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @MinLength(1)
  category: string;

  @IsOptional()
  @IsArray()
  modules?: any;

  @IsOptional()
  @IsArray()
  eval_criteria?: any;

  @IsOptional()
  @IsArray()
  crisis_events?: any;

  @IsOptional()
  @IsArray()
  categories?: any;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  created_by?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  drive_folder_url?: string;

  @IsOptional()
  @IsArray()
  teacher_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  endorser_ids?: number[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  company_ids?: number[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  foundation_ids?: number[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  sponsor_ids?: number[];
}

class UpdateCourseDto {
  @IsOptional()
  @IsString()
  course_id?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsArray()
  modules?: any;

  @IsOptional()
  @IsArray()
  eval_criteria?: any;

  @IsOptional()
  @IsArray()
  crisis_events?: any;

  @IsOptional()
  @IsArray()
  categories?: any;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  created_by?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsBoolean()
  clear_password?: boolean;

  @IsOptional()
  @IsString()
  drive_folder_url?: string;

  @IsOptional()
  @IsArray()
  teacher_ids?: string[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  endorser_ids?: number[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  company_ids?: number[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  foundation_ids?: number[];

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  sponsor_ids?: number[];
}

class EnrollDto {
  @IsOptional()
  @IsString()
  password?: string;
}

@Controller('courses')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class CoursesController {
  constructor(
    private coursesService: CoursesService,
    private rubricService: CourseRubricService,
  ) {}

  @Get()
  async findAll(
    @Query() pagination: PaginationDto,
    @Query('is_active') isActive?: string,
  ) {
    const active = isActive !== undefined ? isActive === 'true' : undefined;
    return this.coursesService.findAll({
      page: pagination.page,
      limit: pagination.limit,
      isActive: active,
    });
  }

  @Get('dropdown/list')
  async findAllDropdown(
    @Query('is_active') isActive?: string,
    @CurrentUser() user?: any,
  ) {
    const active = isActive !== undefined ? isActive === 'true' : undefined;
    const teacherId = user?.role === 'teacher' ? user.id : undefined;
    return this.coursesService.findAllDropdown(active, teacherId);
  }

  @Get('catalog')
  async catalog(
    @Query('q') q?: string,
    @Query('tag') tag?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.coursesService.catalog({
      q,
      tag,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':courseId/rubric')
  @Roles('admin', 'teacher', 'ministerio', 'student')
  async getRubric(@Param('courseId') courseId: string) {
    return this.rubricService.getActiveRubricForCourse(courseId);
  }

  @Put(':courseId/rubric')
  @Roles('admin', 'teacher')
  @Permissions('courses.manage')
  async updateRubric(
    @Param('courseId') courseId: string,
    @Body() dto: UpdateCourseRubricDto,
  ) {
    return this.rubricService.updateRubric(courseId, dto);
  }

  @Get(':courseId')
  async findOne(@Param('courseId') courseId: string) {
    return this.coursesService.findById(courseId);
  }

  @Get(':id/sponsors')
  @Public()
  @Roles()
  @Permissions()
  async getCourseSponsors(@Param('id') id: string) {
    return this.coursesService.findCourseSponsors(id);
  }

  @Post()
  @Roles('admin')
  @Permissions('courses.manage')
  async create(@Body() dto: CreateCourseDto) {
    return this.coursesService.create(dto);
  }

  @Put(':id')
  @Roles('admin', 'teacher')
  @Permissions('courses.manage')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCourseDto,
    @CurrentUser() user: { id: string; role: string },
  ) {
    console.log('Update payload received in API:', JSON.stringify(dto, null, 2));
    return this.coursesService.update(id, dto, user);
  }

  @Post(':id/regenerate-password')
  @Roles('admin', 'teacher')
  @Permissions('courses.manage')
  async regeneratePassword(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.coursesService.regeneratePassword(id, user);
  }

  @Post(':courseId/enroll')
  @Roles('student', 'admin', 'teacher')
  async enroll(
    @Param('courseId') courseId: string,
    @Body() dto: EnrollDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.coursesService.enroll(courseId, userId, dto.password);
  }

  @Delete(':id')
  @Roles('admin')
  @Permissions('courses.manage')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    await this.coursesService.remove(id);
    return { message: 'Course deactivated successfully' };
  }

  @Delete(':id/permanent')
  @Roles('admin')
  @Permissions('courses.manage')
  @HttpCode(HttpStatus.OK)
  async permanentDelete(@Param('id') id: string) {
    await this.coursesService.permanentDelete(id);
    return { message: 'Course permanently deleted' };
  }
}
