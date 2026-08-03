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
import { DocumentsService } from './documents.service';
import { AssignmentsService } from './assignments.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin', 'teacher')
@Permissions('documents.manage')
export class DocumentsController {
  constructor(private documentsService: DocumentsService) {}

  @Get('documents')
  async findAll(
    @Query() pagination: PaginationDto,
    @Query('course_id') courseId?: string,
  ) {
    return this.documentsService.findAll(courseId, { page: pagination.page, limit: pagination.limit });
  }

  @Get('documents/dropdown/list')
  async findAllDropdown(@Query('course_id') courseId?: string) {
    return this.documentsService.findAllDropdown(courseId);
  }

  @Get('documents/:id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.documentsService.findOne(id);
  }

  @Post('documents')
  async create(@Body() dto: CreateDocumentDto) {
    return this.documentsService.create(dto);
  }

  @Put('documents/:id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.documentsService.update(id, dto);
  }

  @Delete('documents/:id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.documentsService.remove(id);
  }

  @Put('documents/:id/reactivate')
  @HttpCode(HttpStatus.OK)
  async reactivate(@Param('id', ParseIntPipe) id: number) {
    return this.documentsService.reactivate(id);
  }
}
