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
} from '@nestjs/common';
import { FlowTemplatesService } from './flow-templates.service';
import { PromptTemplatesService } from './prompt-templates.service';
import { PromptConfigService } from './prompt-config.service';
import { CreateFlowTemplateDto } from './dto/create-flow-template.dto';
import { UpdateFlowTemplateDto } from './dto/update-flow-template.dto';
import { CreatePromptTemplateDto } from './dto/create-prompt-template.dto';
import { UpdatePromptTemplateDto } from './dto/update-prompt-template.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller('templates')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin', 'teacher')
@Permissions('templates.manage')
export class TemplatesController {
  constructor(
    private flowTemplatesService: FlowTemplatesService,
    private promptTemplatesService: PromptTemplatesService,
    private promptConfigService: PromptConfigService,
  ) {}

  // ── Flow Templates ──────────────────────────────────────────────

  @Get('flow')
  async findAllFlowTemplates(
    @Query() pagination: PaginationDto,
    @Query('family') family?: string,
    @Query('course_id') courseId?: string,
    @Query('active') active?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.flowTemplatesService.findAll(
      { family, course_id: courseId, active, includeInactive },
      { page: pagination.page, limit: pagination.limit },
    );
  }

  @Get('flow/dropdown/list')
  async findAllFlowTemplatesDropdown() {
    return this.flowTemplatesService.findAllDropdown();
  }

  @Get('flow/:id')
  async findOneFlowTemplate(@Param('id') id: string) {
    return this.flowTemplatesService.findOne(id);
  }

  @Post('flow')
  async createFlowTemplate(@Body() dto: CreateFlowTemplateDto) {
    return this.flowTemplatesService.create(dto);
  }

  @Put('flow/:id')
  async updateFlowTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateFlowTemplateDto,
  ) {
    return this.flowTemplatesService.update(id, dto);
  }

  @Delete('flow/:id')
  @HttpCode(HttpStatus.OK)
  async removeFlowTemplate(@Param('id') id: string) {
    return this.flowTemplatesService.remove(id);
  }

  @Post('flow/:id/duplicate')
  async duplicateFlowTemplate(
    @Param('id') id: string,
    @Body('new_id') newId?: string,
  ) {
    return this.flowTemplatesService.duplicate(id, newId);
  }

  @Post('flow/bulk-import')
  async bulkImportFlowTemplates(@Body('templates') templates: CreateFlowTemplateDto[]) {
    return this.flowTemplatesService.bulkImport(templates);
  }

  // ── Prompt Templates ────────────────────────────────────────────

  @Get('prompt')
  async findAllPromptTemplates(@Query('category') category?: string) {
    return this.promptTemplatesService.findAll(category);
  }

  @Get('prompt/category/:category')
  async findPromptTemplatesByCategory(@Param('category') category: string) {
    return this.promptTemplatesService.findByCategory(category);
  }

  @Get('prompt/:id')
  async findOnePromptTemplate(@Param('id') id: string) {
    return this.promptTemplatesService.findOne(parseInt(id));
  }

  @Post('prompt')
  async createPromptTemplate(@Body() dto: CreatePromptTemplateDto) {
    return this.promptTemplatesService.create(dto);
  }

  @Put('prompt/:id')
  async updatePromptTemplate(
    @Param('id') id: string,
    @Body() dto: UpdatePromptTemplateDto,
  ) {
    return this.promptTemplatesService.update(parseInt(id), dto);
  }

  @Delete('prompt/:id')
  @HttpCode(HttpStatus.OK)
  async removePromptTemplate(@Param('id') id: string) {
    return this.promptTemplatesService.remove(parseInt(id));
  }

  @Post('prompt/:id/duplicate')
  async duplicatePromptTemplate(
    @Param('id') id: string,
    @Body('name') name: string,
  ) {
    return this.promptTemplatesService.duplicate(parseInt(id), name);
  }

  // ── Prompt Config ───────────────────────────────────────────────

  @Get('prompt-config/:courseId')
  async getPromptConfig(@Param('courseId') courseId: string) {
    return this.promptConfigService.getConfig(courseId);
  }

  @Post('prompt-config/:courseId/assign-template')
  async assignTemplate(
    @Param('courseId') courseId: string,
    @Body('templateId') templateId: number,
  ) {
    return this.promptConfigService.assignTemplate(courseId, templateId);
  }

  @Post('prompt-config/:courseId/save')
  async savePrompt(
    @Param('courseId') courseId: string,
    @Body('promptData') promptData: any,
  ) {
    return this.promptConfigService.savePrompt(courseId, promptData);
  }
}
