import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { logoUploadOptions, resolveLogoUrl, cleanupOldLogo } from '../files/logo-upload';
import { SponsorsService } from './sponsors.service';
import { CreateSponsorDto } from './dto/create-sponsor.dto';
import { UpdateSponsorDto } from './dto/update-sponsor.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';

@Controller('sponsors')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles('admin', 'teacher')
@Permissions('sponsors.manage')
export class SponsorsController {
  constructor(private sponsorsService: SponsorsService) {}

  @Get()
  @Public()
  @Roles()
  @Permissions()
  async findAll(@Query() pagination: PaginationDto) {
    return this.sponsorsService.findAll({ page: pagination.page, limit: pagination.limit });
  }

  @Get(':id')
  @Public()
  @Roles()
  @Permissions()
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.sponsorsService.findOne(id);
  }

  @Post()
  @UseInterceptors(FileInterceptor('logo_file', logoUploadOptions))
  async create(@Body() dto: CreateSponsorDto, @UploadedFile() logo_file?: Express.Multer.File) {
    const data = { ...dto } as any;
    delete data.logo_file;
    if (logo_file || dto.logo_url !== undefined) {
      data.logo_url = resolveLogoUrl(logo_file, dto.logo_url) ?? null;
    }
    return this.sponsorsService.create(data);
  }

  @Put(':id')
  @UseInterceptors(FileInterceptor('logo_file', logoUploadOptions))
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSponsorDto,
    @UploadedFile() logo_file?: Express.Multer.File,
  ) {
    if (logo_file) {
      const existing = await this.sponsorsService.findOne(id);
      cleanupOldLogo(existing?.logo_url);
    }
    const data = { ...dto } as any;
    delete data.logo_file;
    if (logo_file || dto.logo_url !== undefined) {
      data.logo_url = resolveLogoUrl(logo_file, dto.logo_url) ?? null;
    }
    return this.sponsorsService.update(id, data);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.sponsorsService.remove(id);
  }

  @Put(':id/reactivate')
  async reactivate(@Param('id', ParseIntPipe) id: number) {
    return this.sponsorsService.reactivate(id);
  }
}

