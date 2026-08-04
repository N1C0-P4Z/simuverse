import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { PracticesService } from './practices.service';
import { AssetDispatcherService } from './assets/asset-dispatcher.service';

@UseGuards(JwtAuthGuard)
@Controller('practices')
export class PracticesController {
  constructor(
    private readonly practices: PracticesService,
    private readonly assetDispatcher: AssetDispatcherService,
  ) {}

  @Get('course/:courseId')
  async list(
    @Param('courseId') courseId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.practices.listByCoursePaginated(
      courseId,
      pagination.page,
      pagination.limit,
    );
  }

  @Get('course/:courseId/progress')
  async progress(
    @CurrentUser('id') userId: string,
    @Param('courseId') courseId: string,
  ) {
    return this.practices.getStudentProgress(userId, courseId);
  }

  @UseGuards(RolesGuard)
  @Roles('teacher', 'admin')
  @Post('course/:courseId')
  async create(
    @Param('courseId') courseId: string,
    @Body()
    body: {
      title: string;
      description?: string;
      difficulty?: 'very_low' | 'low' | 'medium';
      content?: any;
    },
  ) {
    return this.practices.createPractice(courseId, body);
  }

  @UseGuards(RolesGuard)
  @Roles('teacher', 'admin')
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      description?: string;
      difficulty?: 'very_low' | 'low' | 'medium';
      content?: any;
      is_active?: boolean;
    },
  ) {
    return this.practices.updatePractice(id, body);
  }

  @Post('course/:courseId/start')
  async start(
    @CurrentUser('id') userId: string,
    @Param('courseId') courseId: string,
    @Body() body?: { scenario_id?: string },
  ) {
    const result = await this.practices.startNextPractice(userId, courseId, body?.scenario_id);
    if (result?.instance?.id && result?.practice?.id) {
      await this.assetDispatcher.startPractice(result.instance.id, result.practice.id);
    }
    return result;
  }

  @Post('instances/:instanceId/complete')
  async complete(
    @CurrentUser('id') userId: string,
    @Param('instanceId') instanceId: string,
  ) {
    this.assetDispatcher.endPractice(instanceId);
    return this.practices.completePractice(userId, instanceId);
  }
}
