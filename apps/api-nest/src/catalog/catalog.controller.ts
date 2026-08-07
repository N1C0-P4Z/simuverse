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
import { CategoriesService } from './categories.service';
import { TechSheetsService } from './tech-sheets.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateTechSheetDto } from './dto/create-tech-sheet.dto';
import { UpdateTechSheetDto } from './dto/update-tech-sheet.dto';
import { UpdateTechSheetConfigDto } from './dto/update-tech-sheet-config.dto';
import { TriggerAnalysisDto } from './dto/trigger-analysis.dto';
import { UpdateTechSheetPromptsDto } from './dto/update-tech-sheet-prompts.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin')
@Permissions('catalog.manage')
export class CatalogController {
  constructor(
    private categoriesService: CategoriesService,
    private techSheetsService: TechSheetsService,
  ) {}

  // ── Categories ──────────────────────────────────────────────────

  @Get('categories')
  async findAllCategories(@Query() pagination: PaginationDto) {
    return this.categoriesService.findAll({ page: pagination.page, limit: pagination.limit });
  }

  @Get('categories/dropdown/list')
  async findAllCategoriesDropdown() {
    return this.categoriesService.findAllDropdown();
  }

  @Get('categories/:id')
  async findOneCategory(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.findOne(id);
  }

  @Post('categories')
  async createCategory(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Put('categories/:id')
  async updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, dto);
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.OK)
  async removeCategory(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.remove(id);
  }

  @Put('categories/:id/reactivate')
  @HttpCode(HttpStatus.OK)
  async reactivateCategory(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.reactivate(id);
  }

  @Delete('categories/:id/hard')
  @HttpCode(HttpStatus.OK)
  async hardRemoveCategory(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.hardRemove(id);
  }

  // ── Tech Sheets ─────────────────────────────────────────────────

  @Get('tech-sheets/valid/list')
  async findValidTechSheets() {
    return this.techSheetsService.findValid();
  }

  @Get('tech-sheets/dropdown/list')
  async findAllTechSheetsDropdown() {
    return this.techSheetsService.findAllDropdown();
  }

  @Get('tech-sheets')
  async findAllTechSheets(@Query() pagination: PaginationDto) {
    return this.techSheetsService.findAll({ page: pagination.page, limit: pagination.limit });
  }

  @Get('tech-sheets/:id/config')
  async getTechSheetConfig(@Param('id', ParseIntPipe) id: number) {
    return this.techSheetsService.getConfig(id);
  }

  @Put('tech-sheets/:id/config')
  async updateTechSheetConfig(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTechSheetConfigDto,
  ) {
    return this.techSheetsService.updateConfig(id, dto);
  }

  @Put('tech-sheets/:id/prompts')
  async updateTechSheetPrompts(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTechSheetPromptsDto,
  ) {
    return this.techSheetsService.updatePrompts(id, dto);
  }

  @Get('tech-sheets/:id')
  async findOneTechSheet(@Param('id', ParseIntPipe) id: number) {
    return this.techSheetsService.findOne(id);
  }

  @Post('tech-sheets')
  async createTechSheet(@Body() dto: CreateTechSheetDto) {
    return this.techSheetsService.create(dto);
  }

  @Put('tech-sheets/:id')
  async updateTechSheet(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTechSheetDto,
  ) {
    return this.techSheetsService.update(id, dto);
  }

  @Delete('tech-sheets/:id')
  @HttpCode(HttpStatus.OK)
  async removeTechSheet(@Param('id', ParseIntPipe) id: number) {
    return this.techSheetsService.remove(id);
  }

  @Post('tech-sheets/:id/process')
  async processTechSheet(@Param('id', ParseIntPipe) id: number) {
    return this.techSheetsService.process(id);
  }

  @Post('tech-sheets/:id/analyze')
  async analyzeTechSheet(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TriggerAnalysisDto,
  ) {
    return this.techSheetsService.analyze(id);
  }
}
