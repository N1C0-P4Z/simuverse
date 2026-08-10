'use client'
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { useSidebarHeader } from '@/lib/sidebar-header-context';
import { apiClient } from '@/services/ApiClient';
import { getScoreBarColor, getScoreText } from '@/lib/score-colors';
import {
    AlertTriangle,
    ArrowLeft,
    BarChart3,
    BookOpen,
    Brain,
    Calculator,
    CheckCircle,
    ChevronDown, ChevronUp,
    Clock,
    Info,
    Shield,
    Target,
    TrendingUp,
    Trophy,
    User,
    XCircle,
    Zap
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ScoringComponent {
  value: number;
  weight?: number;
  source: string;
  description: string;
  adjustment?: number;
}

interface ScoringMethodology {
  formula: string;
  components: Record<string, ScoringComponent>;
  puntaje_base_ia: number;
  puntaje_motor_reglas: number | null;
  puntaje_crisis: number | null;
  ajuste_crisis: number;
  puntaje_final: number;
  aprobado: boolean;
  umbral_aprobacion?: number;
  criterios_evaluados?: string[];
  ai_mode?: 'live' | 'scripted';
  total_eventos?: number;
  evaluado_por?: string;
  evaluado_en?: string;
}

interface SimulationRecord {
  simulation_id: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  course_id: string;
  course_title: string;
  course_category: string;
  assessment_id: string | null;
  score: number | null;
  passed: boolean | null;
  criteria_met: {
    kpis: Record<string, number>;
    scoring_methodology: ScoringMethodology;
    analysis_detail: {
      strengths: string[];
      areas_to_improve: string[];
      recommendations: string[];
    };
  } | null;
  assessment_comments: string | null;
  evaluated_at: string | null;
  evaluator_name: string | null;
  total_logs: number;
  messages_sent: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const familyLabel: Record<string, string> = {
  administracion: 'Administración',
  rrhh: 'RRHH',
  informatica: 'Informática',
  emprendimiento: 'Emprendimiento',
  ventas: 'Ventas',
  legal: 'Legal',
  contable: 'Contabilidad',
  general: 'General',
};

// ─── Sub-component: Scoring Methodology Table ────────────────────────────────

function ScoringTable({ method }: { method: ScoringMethodology }) {
  const components = method.components;
  const componentKeys = Object.keys(components);

  return (
    <div className="space-y-4">
      {/* Formula banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-blue-800">
        <Calculator className="w-4 h-4 flex-shrink-0" />
        <span className="font-mono font-medium">{method.formula}</span>
      </div>

      {/* Components table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="px-4 py-2 text-left font-semibold text-xs text-muted-foreground uppercase">Componente</th>
              <th className="px-4 py-2 text-center font-semibold text-xs text-muted-foreground uppercase">Puntaje</th>
              <th className="px-4 py-2 text-center font-semibold text-xs text-muted-foreground uppercase">Peso</th>
              <th className="px-4 py-2 text-center font-semibold text-xs text-muted-foreground uppercase">Aporte</th>
              <th className="px-4 py-2 text-left font-semibold text-xs text-muted-foreground uppercase">Fuente / Descripción</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {componentKeys.map(key => {
              const comp = components[key];
              const aporte = comp.weight != null
                ? Math.round(comp.value * comp.weight)
                : (comp.adjustment ?? comp.value);
              return (
                <tr key={key} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium capitalize">{key.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`font-bold ${getScoreText(comp.value)}`}>{comp.value}</span>
                  </td>
                  <td className="px-4 py-2.5 text-center text-muted-foreground">
                    {comp.weight != null ? `${Math.round(comp.weight * 100)}%` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`font-semibold ${aporte >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {aporte >= 0 ? '+' : ''}{aporte}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{comp.description}</td>
                </tr>
              );
            })}
            {/* Totals row */}
            <tr className="bg-muted/20 font-semibold border-t-2">
              <td className="px-4 py-2.5">PUNTAJE FINAL</td>
              <td className="px-4 py-2.5 text-center">
                <span className={`text-lg font-bold ${getScoreText(method.puntaje_final)}`}>
                  {method.puntaje_final}
                </span>
              </td>
              <td className="px-4 py-2.5 text-center text-muted-foreground">100%</td>
              <td className="px-4 py-2.5 text-center">
                <Badge className={method.aprobado ? 'bg-green-100 text-green-700 border-green-300 border' : 'bg-red-100 text-red-700 border-red-300 border'}>
                  {method.aprobado ? '✅ Aprobó' : '❌ No aprobó'}
                </Badge>
              </td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">
                Umbral de aprobación: {method.umbral_aprobacion ?? 70} puntos
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Metadata row */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          {(method.ai_mode ?? 'live') === 'live'
            ? <><Brain className="w-3 h-3 text-blue-500" /> IA en vivo</>
            : <><Zap className="w-3 h-3 text-yellow-500" /> Evaluación heurística (offline)</>
          }
        </span>
        <span>·</span>
        <span>{method.total_eventos ?? 0} eventos telemetría</span>
        <span>·</span>
        <span>Criterios: {method.criterios_evaluados?.join(', ') ?? '—'}</span>
        <span>·</span>
        <span>
          Evaluado:{' '}
          {method.evaluado_en
            ? new Date(method.evaluado_en).toLocaleString('es-AR')
            : '—'}
          {method.evaluado_por ? ` · ${method.evaluado_por}` : ''}
        </span>
      </div>
    </div>
  );
}

// ─── Sub-component: KPI Bars ─────────────────────────────────────────────────

function KPIBars({ kpis }: { kpis: Record<string, number> }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 mt-2">
      {Object.entries(kpis).map(([kpi, val]) => {
        const raw = val as unknown;
        const n = Math.round(
          typeof raw === 'object' && raw !== null && 'score' in raw
            ? Number((raw as { score: unknown }).score)
            : Number(raw),
        ) || 0;
        return (
          <div key={kpi}>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="capitalize text-muted-foreground">{kpi.replace(/_/g, ' ')}</span>
              <span className={`font-semibold ${getScoreText(n)}`}>{n}/100</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full ${getScoreBarColor(n)} rounded-full transition-all`} style={{ width: `${Math.min(100, n)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const StudentLedger = () => {
  const params = useParams<{ userId: string }>();
  const userId = params.userId;
  const { user, hasRole, loading } = useAuth();
  const router = useRouter();
  const { setBackTo } = useSidebarHeader();
  const [data, setData] = useState<{ student: any; stats: any; simulations: SimulationRecord[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSim, setExpandedSim] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    setBackTo('/legajos', 'Legajos');
    return () => setBackTo(undefined, undefined);
  }, [setBackTo]);

  useEffect(() => {
    if (!loading && (!user || user.role === 'student')) {
      router.push('/estudiante/cursos');
    }
  }, [user, loading, router]);

  useEffect(() => {
    // Only load if authorized
    if (!userId || !user || user.role === 'student') return;
    const load = async () => {
      try {
        const res = await apiClient.get(`/legajo/${userId}`);
        if (res.data) setData(res.data);
      } catch (err: any) {
        setError(err?.response?.data?.error || err.message || 'Error al cargar el legajo');
      } finally {
        setLoadingData(false);
      }
    };
    load();
  }, [userId, user]);

  const statusConfig: Record<string, { label: string; color: string }> = {
    completed:   { label: 'Completada', color: 'bg-primary/10 text-primary' },
    in_progress: { label: 'En Curso',   color: 'bg-success/10 text-success' },
    paused:      { label: 'Pausada',    color: 'bg-warning/10 text-warning' },
    abandoned:   { label: 'Abandonada', color: 'bg-destructive/10 text-destructive' },
  };

  // Prevent render flash during redirect
  if (loading || (!user || user.role === 'student')) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Verificando credenciales...</p>
        </div>
      </div>
    );
  }

  if (loadingData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Cargando legajo...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center space-y-4">
            <Shield className="w-12 h-12 mx-auto text-red-500" />
            <p className="font-semibold text-red-700">{error}</p>
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Volver
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { student, stats, simulations } = data;

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 space-y-8 max-w-5xl">

        {/* Student info card */}
        <Card className="glass-card">
          <CardContent className="pt-5 pb-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="w-7 h-7 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold">{student.name}</h2>
                <p className="text-muted-foreground text-sm">{student.email}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Inscripto el {new Date(student.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <div className="text-right text-xs text-muted-foreground italic">
                <Info className="w-3 h-3 inline mr-1" />
                Legajo generado por <strong>{user?.name || user?.email || 'el sistema'}</strong>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Simulaciones',  value: stats.total_simulations,    icon: <BookOpen className="w-4 h-4" />,    color: 'text-blue-600' },
            { label: 'Aprobadas',     value: stats.passed_evaluations,    icon: <Trophy className="w-4 h-4" />,      color: 'text-green-600' },
            { label: 'Prom. puntaje', value: stats.avg_score !== null ? `${stats.avg_score}/100` : '—', icon: <TrendingUp className="w-4 h-4" />, color: stats.avg_score >= 70 ? 'text-green-600' : 'text-red-600' },
          ].map(stat => (
            <Card key={stat.label} className="glass-card">
              <CardContent className="pt-4 pb-3">
                <div className={`flex items-center gap-2 ${stat.color} mb-1`}>
                  {stat.icon}
                  <span className="text-2xl font-bold">{stat.value}</span>
                </div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Approval rate bar */}
        {stats.approval_rate !== null && (
          <Card className="glass-card">
            <CardContent className="pt-4 pb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Tasa de aprobación</span>
                <span className={`font-bold text-sm ${stats.approval_rate >= 70 ? 'text-green-600' : 'text-red-600'}`}>
                  {stats.approval_rate}%
                </span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${stats.approval_rate >= 70 ? 'bg-green-500' : 'bg-red-500'}`}
                  style={{ width: `${stats.approval_rate}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                {stats.passed_evaluations} aprobadas de {stats.total_evaluations} simulaciones
                {stats.best_score !== null && stats.best_score !== undefined && ` · Mejor puntaje: ${stats.best_score}/100`}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Simulations list */}
        <div>
          <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" /> Historial de Simulaciones
          </h3>
          <div className="space-y-3">
            {simulations.length === 0 && (
              <div className="text-center py-10 text-muted-foreground">
                <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>El alumno no tiene simulaciones registradas.</p>
              </div>
            )}
            {simulations.map(sim => {
              const st = statusConfig[sim.status] || { label: sim.status, color: 'bg-muted text-muted-foreground' };
              const isOpen = expandedSim === sim.simulation_id;
              const duration = sim.completed_at
                ? Math.round((new Date(sim.completed_at).getTime() - new Date(sim.started_at).getTime()) / 60000)
                : null;

              return (
                <Card key={sim.simulation_id} className="glass-card overflow-hidden">
                  {/* Row header */}
                  <CardContent className="py-4 cursor-pointer" onClick={() => setExpandedSim(isOpen ? null : sim.simulation_id)}>
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-semibold truncate">{sim.course_title}</span>
                          <Badge variant="outline" className="text-xs">{familyLabel[sim.course_category] ?? sim.course_category}</Badge>
                          <Badge variant="secondary" className={`text-xs ${st.color}`}>{st.label}</Badge>
                          {sim.score !== null && (
                            <Badge className={`text-xs border font-bold ${
                              sim.passed ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-100 text-red-700 border-red-300'
                            }`}>
                              {sim.passed ? <Trophy className="w-3 h-3 mr-1 inline" /> : <XCircle className="w-3 h-3 mr-1 inline" />}
                              {sim.score}/100
                            </Badge>
                          )}
                          {!sim.score && sim.status === 'completed' && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">Sin evaluar</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(sim.started_at).toLocaleDateString('es-AR')}</span>
                          {duration !== null && <span>{duration} min</span>}
                          <span>{sim.total_logs} eventos · {sim.messages_sent} mensajes</span>
                          {sim.evaluator_name && <span>Evaluado por {sim.evaluator_name}</span>}
                        </div>
                      </div>
                      <div className="flex-shrink-0 mt-1 text-muted-foreground">
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </CardContent>

                  {/* Expanded: assessment detail */}
                  {isOpen && sim.criteria_met && (
                    <div className="border-t bg-muted/20 px-6 py-5 space-y-6">

                      {/* Scoring methodology */}
                      <div>
                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <Calculator className="w-4 h-4 text-primary" />
                          Metodología de Cálculo del Puntaje
                        </h4>
                        <ScoringTable method={sim.criteria_met.scoring_methodology} />
                      </div>

                      <Separator />

                      {/* KPI breakdown */}
                      {sim.criteria_met.kpis && Object.keys(sim.criteria_met.kpis).length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                            <Target className="w-4 h-4 text-primary" /> KPIs evaluados
                          </h4>
                          <KPIBars kpis={sim.criteria_met.kpis} />
                        </div>
                      )}

                      <Separator />

                      {/* Strengths / improvements / recommendations */}
                      {sim.criteria_met.analysis_detail && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          {sim.criteria_met.analysis_detail.strengths?.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-green-700 mb-2 flex items-center gap-1">
                                <CheckCircle className="w-3.5 h-3.5" /> Fortalezas
                              </h4>
                              <ul className="space-y-1">
                                {sim.criteria_met.analysis_detail.strengths.map((s, i) => (
                                  <li key={i} className="text-xs text-green-800 bg-green-50 border border-green-200 rounded px-2 py-1">{s}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {sim.criteria_met.analysis_detail.areas_to_improve?.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-red-700 mb-2 flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5" /> Áreas a mejorar
                              </h4>
                              <ul className="space-y-1">
                                {sim.criteria_met.analysis_detail.areas_to_improve.map((a, i) => (
                                  <li key={i} className="text-xs text-red-800 bg-red-50 border border-red-200 rounded px-2 py-1">{a}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {sim.criteria_met.analysis_detail.recommendations?.length > 0 && (
                            <div>
                              <h4 className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1">
                                <Brain className="w-3.5 h-3.5" /> Recomendaciones
                              </h4>
                              <ul className="space-y-1">
                                {sim.criteria_met.analysis_detail.recommendations.map((r, i) => (
                                  <li key={i} className="text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded px-2 py-1">{r}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Comments */}
                      {sim.assessment_comments && (
                        <p className="text-xs text-muted-foreground italic border-t pt-3">{sim.assessment_comments}</p>
                      )}
                    </div>
                  )}

                  {/* Expanded but no assessment yet */}
                  {isOpen && !sim.criteria_met && (
                    <div className="border-t bg-muted/20 px-6 py-5 text-center text-sm text-muted-foreground">
                      <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      Esta simulación todavía no tiene prácticas registradas por el usuario.
                      {sim.status === 'completed' && ' Un docente o administrador puede generarla desde el panel de Evaluaciones.'}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="text-xs text-muted-foreground border-t pt-4 text-center">
          <Shield className="w-3 h-3 inline mr-1" />
          Este legajo es confidencial. El acceso está restringido por rol y permisos del sistema.
          La metodología de cálculo es auditada y registrada en cada evaluación.
        </div>
      </main>
    </div>
  );
};

export default StudentLedger;
