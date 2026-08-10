import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller';
import { CoursesService } from './courses.service';
import { CourseConfigService } from './course-config.service';
import { RbacModule } from '../rbac/rbac.module';
import { RubricsModule } from '../rubrics/rubrics.module';

@Module({
  imports: [RbacModule, RubricsModule],
  controllers: [CoursesController],
  providers: [CoursesService, CourseConfigService],
  exports: [CoursesService, CourseConfigService],
})
export class CoursesModule {}
