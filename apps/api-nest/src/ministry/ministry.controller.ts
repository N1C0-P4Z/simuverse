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
import { MinistryService } from './ministry.service';
import {
  CreateMinistryRequirementDto,
  UpdateMinistryRequirementDto,
  CreateKpiDto,
  ProcessRequirementDto,
} from './dto/ministry.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller('ministry')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin', 'ministerio')
@Permissions('ministry.manage')
export class MinistryController {
  constructor(private ministryService: MinistryService) {}

  // ── Ministry Requirements ──────────────────────────────────────────

  @Get('requirements')
  async listRequirements(
    @Query('course_id') course_id?: string,
    @Query('status') status?: string,
    @Query() pagination?: PaginationDto,
  ) {
    return this.ministryService.listRequirements({
      course_id,
      status,
      page: pagination?.page,
      limit: pagination?.limit,
    });
  }

  @Get('requirements/:id')
  async getRequirement(@Param('id') id: string) {
    return this.ministryService.getRequirement(id);
  }

  @Post('requirements')
  async createRequirement(@Body() dto: CreateMinistryRequirementDto) {
    return this.ministryService.createRequirement(dto);
  }

  @Put('requirements/:id')
  async updateRequirement(
    @Param('id') id: string,
    @Body() dto: UpdateMinistryRequirementDto,
  ) {
    return this.ministryService.updateRequirement(id, dto);
  }

  @Post('requirements/:id/process')
  async processRequirement(
    @Param('id') id: string,
    @Body() dto: ProcessRequirementDto,
  ) {
    return this.ministryService.processRequirement(id, dto);
  }

  @Put('requirements/:id/activate')
  async activateRequirement(@Param('id') id: string) {
    return this.ministryService.activateRequirement(id);
  }

  @Delete('requirements/:id')
  @HttpCode(HttpStatus.OK)
  async archiveRequirement(@Param('id') id: string) {
    return this.ministryService.archiveRequirement(id);
  }

  @Post('requirements/:id/extract-kpis')
  async extractKpis(@Param('id') id: string) {
    return this.ministryService.extractKpisFromDocument(id);
  }

  // ── KPIs ────────────────────────────────────────────────────────────

  @Get('kpis')
  async listKpis(
    @Query('course_id') course_id?: string,
    @Query('ministry_requirement_id') ministry_requirement_id?: string,
    @Query('active') active?: string,
    @Query() pagination?: PaginationDto,
  ) {
    return this.ministryService.listKpis({
      course_id,
      ministry_requirement_id,
      active,
      page: pagination?.page,
      limit: pagination?.limit,
    });
  }

  @Get('kpis/:id')
  async getKpi(@Param('id') id: string) {
    return this.ministryService.getKpi(id);
  }

  @Post('kpis')
  async createKpi(@Body() dto: CreateKpiDto) {
    return this.ministryService.createKpi(dto);
  }

  @Put('kpis/:id')
  async updateKpi(
    @Param('id') id: string,
    @Body() body: Partial<CreateKpiDto> & { is_active?: boolean },
  ) {
    return this.ministryService.updateKpi(id, body);
  }

  @Delete('kpis/:id')
  @HttpCode(HttpStatus.OK)
  async deactivateKpi(@Param('id') id: string) {
    return this.ministryService.deactivateKpi(id);
  }

  // ── Health ──────────────────────────────────────────────────────────

  @Get('health')
  async healthCheck() {
    return this.ministryService.healthCheck();
  }
}
