import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SessionRubricReviewService } from './session-rubric-review.service';
import { ListRubricReviewsDto } from './dto/list-rubric-reviews.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('teacher', 'admin', 'ministerio')
@Controller('rubric-reviews')
export class RubricReviewsController {
  constructor(private readonly reviewService: SessionRubricReviewService) {}

  @Get()
  async list(
    @CurrentUser() user: any,
    @Query() query: ListRubricReviewsDto,
  ) {
    return this.reviewService.listReviews(user, {
      course_id: query.course_id,
      student_id: query.student_id,
      page: query.page,
      limit: query.limit,
    });
  }
}
