import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { paginate, PaginatedResult } from '../common/helpers/paginate';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import * as crypto from 'crypto';

const HMAC_SECRET = process.env.ASSESSMENT_HMAC_SECRET;

@Injectable()
export class AssessmentsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Compute HMAC-SHA256 digital signature for assessment data
   * Ported from Express: assessment signing pattern
   */
  computeDigitalSignature(data: {
    simulation_id: string;
    user_id: string;
    course_id: string;
    kpis: any;
    timestamp: number;
  }): string {
    const payload = JSON.stringify({
      simulation_id: data.simulation_id,
      user_id: data.user_id,
      course_id: data.course_id,
      kpis: data.kpis,
      timestamp: data.timestamp,
    });
    return crypto.createHmac('sha256', HMAC_SECRET).update(payload).digest('hex');
  }

  /**
   * Score KPIs: calculate overall score from individual KPI results
   * Each KPI has a weight and a scored value (0-100)
   */
  scoreKPIs(kpiResults: Record<string, { score: number; weight?: number }>): {
    overall_score: number;
    kpi_scores: Record<string, number>;
    passed_kpis: string[];
    failed_kpis: string[];
  } {
    const kpi_scores: Record<string, number> = {};
    const passed_kpis: string[] = [];
    const failed_kpis: string[] = [];
    let totalWeight = 0;
    let weightedSum = 0;

    for (const [kpiName, result] of Object.entries(kpiResults)) {
      const weight = result.weight || 1;
      const score = Math.min(100, Math.max(0, result.score));

      kpi_scores[kpiName] = score;
      totalWeight += weight;
      weightedSum += score * weight;

      if (score >= 70) {
        passed_kpis.push(kpiName);
      } else {
        failed_kpis.push(kpiName);
      }
    }

    const overall_score = totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : 0;

    return { overall_score, kpi_scores, passed_kpis, failed_kpis };
  }

  async findAll(filters?: {
    course_id?: string;
    user_id?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResult<any>> {
    const { page = 1, limit = 20, ...queryFilters } = filters || {};
    const where: any = {};
    if (queryFilters.course_id) where.course_id = queryFilters.course_id;
    if (queryFilters.user_id) where.user_id = queryFilters.user_id;

    return paginate(this.prisma.assessment, where, {
      page,
      limit,
      orderBy: { created_at: 'desc' },
      include: {
        simulation: { select: { status: true } },
        user: { select: { name: true, email: true } },
        course: { select: { title: true } },
      },
    });
  }

  async findOne(id: string) {
    const assessment = await this.prisma.assessment.findUnique({
      where: { id },
      include: {
        simulation: true,
        user: { select: { name: true, email: true } },
        course: { select: { title: true } },
      },
    });
    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }
    return assessment;
  }

  async findBySimulation(simulationId: string) {
    return this.prisma.assessment.findMany({
      where: { simulation_id: simulationId },
      orderBy: { created_at: 'desc' },
    });
  }

  async create(dto: CreateAssessmentDto) {
    // Score KPIs if provided
    let overallScore = 0;
    let kpis = dto.kpis || {};

    if (dto.kpis && typeof dto.kpis === 'object' && Object.keys(dto.kpis).length > 0) {
      // Check if kpis have score/weight structure
      const hasScoring = Object.values(dto.kpis).some(
        (v: any) => typeof v === 'object' && v !== null && 'score' in v,
      );
      if (hasScoring) {
        const scored = this.scoreKPIs(dto.kpis);
        overallScore = scored.overall_score;
        kpis = scored.kpi_scores;
      }
    }

    // Compute digital signature
    const timestamp = Date.now();
    const digital_signature = this.computeDigitalSignature({
      simulation_id: dto.simulation_id,
      user_id: dto.user_id,
      course_id: dto.course_id,
      kpis,
      timestamp,
    });

    return this.prisma.assessment.create({
      data: {
        simulation_id: dto.simulation_id,
        user_id: dto.user_id,
        course_id: dto.course_id,
        kpis,
        ai_evaluation: dto.ai_evaluation,
        recommendation: dto.recommendation,
        feedback: dto.feedback,
        digital_signature,
        completed_at: new Date(),
      },
    });
  }

  async verifySignature(id: string): Promise<{ valid: boolean; assessment_id: string }> {
    const assessment = await this.findOne(id);
    if (!assessment.digital_signature) {
      return { valid: false, assessment_id: id };
    }

    // Recompute signature with stored data
    const recomputed = this.computeDigitalSignature({
      simulation_id: assessment.simulation_id,
      user_id: assessment.user_id,
      course_id: assessment.course_id,
      kpis: assessment.kpis,
      timestamp: assessment.created_at.getTime(),
    });

    return {
      valid: recomputed === assessment.digital_signature,
      assessment_id: id,
    };
  }
}
