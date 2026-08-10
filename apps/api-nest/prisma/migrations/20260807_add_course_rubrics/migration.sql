-- CreateTable
CREATE TABLE "course_rubrics" (
    "id" VARCHAR(36) NOT NULL,
    "course_id" VARCHAR(36) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "pass_threshold" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_rubrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubric_criteria" (
    "id" VARCHAR(36) NOT NULL,
    "course_rubric_id" VARCHAR(36) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "rubric_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubric_levels" (
    "id" VARCHAR(36) NOT NULL,
    "course_rubric_id" VARCHAR(36) NOT NULL,
    "value" INTEGER NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "rubric_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubric_criterion_level_descriptors" (
    "id" VARCHAR(36) NOT NULL,
    "criterion_id" VARCHAR(36) NOT NULL,
    "level_id" VARCHAR(36) NOT NULL,
    "descriptor" TEXT NOT NULL,

    CONSTRAINT "rubric_criterion_level_descriptors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_rubric_reviews" (
    "id" VARCHAR(36) NOT NULL,
    "simulation_instance_id" VARCHAR(36) NOT NULL,
    "course_rubric_id" VARCHAR(36) NOT NULL,
    "reviewer_id" VARCHAR(36) NOT NULL,
    "scores" JSONB NOT NULL,
    "total_score" INTEGER NOT NULL,
    "max_score" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "pass_threshold_snapshot" INTEGER NOT NULL,
    "comment" TEXT,
    "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_rubric_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_rubrics_course_id_idx" ON "course_rubrics"("course_id");

-- CreateIndex: one active rubric per course
CREATE UNIQUE INDEX "course_rubrics_course_id_active_key" ON "course_rubrics"("course_id") WHERE "active" = true;

-- CreateIndex
CREATE INDEX "rubric_criteria_course_rubric_id_idx" ON "rubric_criteria"("course_rubric_id");

-- CreateIndex
CREATE UNIQUE INDEX "rubric_criteria_course_rubric_id_code_key" ON "rubric_criteria"("course_rubric_id", "code");

-- CreateIndex
CREATE INDEX "rubric_levels_course_rubric_id_idx" ON "rubric_levels"("course_rubric_id");

-- CreateIndex
CREATE UNIQUE INDEX "rubric_levels_course_rubric_id_value_key" ON "rubric_levels"("course_rubric_id", "value");

-- CreateIndex
CREATE UNIQUE INDEX "rubric_criterion_level_descriptors_criterion_id_level_id_key" ON "rubric_criterion_level_descriptors"("criterion_id", "level_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_rubric_reviews_simulation_instance_id_key" ON "session_rubric_reviews"("simulation_instance_id");

-- CreateIndex
CREATE INDEX "session_rubric_reviews_course_rubric_id_idx" ON "session_rubric_reviews"("course_rubric_id");

-- CreateIndex
CREATE INDEX "session_rubric_reviews_reviewer_id_idx" ON "session_rubric_reviews"("reviewer_id");

-- AddForeignKey
ALTER TABLE "course_rubrics" ADD CONSTRAINT "course_rubrics_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubric_criteria" ADD CONSTRAINT "rubric_criteria_course_rubric_id_fkey" FOREIGN KEY ("course_rubric_id") REFERENCES "course_rubrics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubric_levels" ADD CONSTRAINT "rubric_levels_course_rubric_id_fkey" FOREIGN KEY ("course_rubric_id") REFERENCES "course_rubrics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubric_criterion_level_descriptors" ADD CONSTRAINT "rubric_criterion_level_descriptors_criterion_id_fkey" FOREIGN KEY ("criterion_id") REFERENCES "rubric_criteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rubric_criterion_level_descriptors" ADD CONSTRAINT "rubric_criterion_level_descriptors_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "rubric_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_rubric_reviews" ADD CONSTRAINT "session_rubric_reviews_simulation_instance_id_fkey" FOREIGN KEY ("simulation_instance_id") REFERENCES "simulation_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_rubric_reviews" ADD CONSTRAINT "session_rubric_reviews_course_rubric_id_fkey" FOREIGN KEY ("course_rubric_id") REFERENCES "course_rubrics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_rubric_reviews" ADD CONSTRAINT "session_rubric_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
