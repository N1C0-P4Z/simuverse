import { Module } from '@nestjs/common';
import { CourseRubricService } from './course-rubric.service';
import { SessionRubricReviewService } from './session-rubric-review.service';
import { RubricReviewsController } from './rubric-reviews.controller';

@Module({
  controllers: [RubricReviewsController],
  providers: [CourseRubricService, SessionRubricReviewService],
  exports: [CourseRubricService, SessionRubricReviewService],
})
export class RubricsModule {}
