import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin', 'teacher')
@Permissions('assignments.manage')
export class AssignmentsController {
  constructor(private assignmentsService: AssignmentsService) {}

  @Get('assignments')
  @Roles('admin', 'teacher', 'student')
  @Permissions('assignments.read')
  async findAll(
    @Query('student_id') studentId?: string,
    @Query('course_id') courseId?: string,
    @Query('status') status?: string,
    @Query() pagination?: PaginationDto,
  ) {
    return this.assignmentsService.findAll({
      student_id: studentId,
      course_id: courseId,
      status,
      page: pagination?.page,
      limit: pagination?.limit,
    });
  }

  @Get('assignments/student/:studentId')
  @Roles('admin', 'teacher', 'student')
  @Permissions('assignments.read')
  async findByStudent(@Param('studentId') studentId: string) {
    return this.assignmentsService.findByStudent(studentId);
  }

  @Get('assignments/course/:courseId')
  @Roles('admin', 'teacher', 'student')
  @Permissions('assignments.read')
  async findByCourse(@Param('courseId') courseId: string) {
    return this.assignmentsService.findByCourse(courseId);
  }

  @Get('assignments/:id')
  @Roles('admin', 'teacher', 'student')
  @Permissions('assignments.read')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.assignmentsService.findOne(id);
  }

  @Post('assignments')
  async create(@Body() dto: CreateAssignmentDto) {
    return this.assignmentsService.create(dto);
  }

  @Put('assignments/:id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAssignmentDto,
  ) {
    return this.assignmentsService.update(id, dto);
  }

  @Delete('assignments/:id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.assignmentsService.remove(id);
  }
}
