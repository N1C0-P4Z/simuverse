'use client'
/**
 * ReportsABM.tsx — Panel de Reportes con Historia del Alumno
 */
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, BarChart3, Calendar, CheckCircle2, ClipboardList, Clock, Download, Filter, GraduationCap, Loader2, TrendingUp, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';

import { getScoreBarColor, getScoreBg, getScoreText } from '@/lib/score-colors';
import { apiClient } from '@/services/ApiClient';

interface RubricReview {
  id: string;
  simulation_instance_id: string;
  total_score: number;
  max_score: number;
  passed: boolean;
  pass_threshold_snapshot: number;
  reviewed_at: string;
  reviewer: { id: string; name: string; email: string } | null;
  rubric: { id: string; name: string; pass_threshold: number } | null;
  student: { id: string; name: string; email: string } | null;
  course: { id: string; course_id: string; title: string } | null;
  scenario_title: string | null;
  session_status: string | null;
}

interface StudentHistory {
  student: { id: string; name: string; email: string; role: string; created_at: string };
  assignments: Array<{
    id: number; scenario_id: string; course_id: string; start_date: string; end_date: string;
    max_attempts: number; attempts_used: number; assignment_status: string;
    course_title: string; course_category: string; scenario_title: string;
    scenario_type: string; difficulty: string;
  }>;
  instances: Array<{
    id: string; scenario_id: string; scenario_title: string; status: string;
    progress_percentage: number; started_at: string; completed_at: string;
    time_spent_seconds: number; score: number; feedback: string;
  }>;
  evaluations: Array<{
    id: number; simulation_id: string; attempt_number: number; kpi_results: any;
    overall_score: number; overall_feedback: string; completion_percentage: number;
    time_spent_seconds: number; evaluated_at: string; course_title: string;
  }>;
}

function reviewPct(r: { total_score: number; max_score: number }) {
  return r.max_score > 0 ? (r.total_score / r.max_score) * 100 : 0;
}

async function fetchAllReviews(): Promise<RubricReview[]> {
  const all: RubricReview[] = [];
  let page = 1;
  const limit = 100;
  while (true) {
    const res = await apiClient.get('/rubric-reviews', { params: { page, limit } });
    const { data, total } = res.data;
    all.push(...(Array.isArray(data) ? data : []));
    if (all.length >= total || !data?.length) break;
    page++;
  }
  return all;
}

function KpiBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-700 font-medium">{label}</span>
        <span className={`font-bold ${getScoreText(pct)}`}>{pct}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${getScoreBarColor(pct)} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number | string | null }) {
  const n = Number(score ?? 0);
  const cls = getScoreBg(n);
  const Icon = n >= 85 ? CheckCircle2 : n >= 70 ? AlertTriangle : XCircle;
  const label = n >= 85 ? 'Aprobado' : n >= 70 ? 'Regular' : 'Desaprobado';
  const iconCls = n >= 85 ? 'text-green-600' : n >= 70 ? 'text-amber-600' : 'text-red-500';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded border ${cls}`}>
      {n.toFixed(1)} — <Icon className={`w-3.5 h-3.5 ${iconCls}`} aria-hidden /> {label}
    </span>
  );
}

function ReviewScoreBadge({ review }: { review: RubricReview }) {
  const pct = reviewPct(review);
  const cls = getScoreBg(pct);
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded border ${cls}`}>
      {review.total_score}/{review.max_score} ({pct.toFixed(0)}%)
    </span>
  );
}

function StudentHistoryDialog({ studentId, studentName, onClose }: {
  studentId: string; studentName: string; onClose: () => void;
}) {
  const [history, setHistory] = useState<StudentHistory | null>(null);
  const [reviews, setReviews] = useState<RubricReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const histRes = await apiClient.get(`/students/${studentId}/history`);
        setHistory(histRes.data?.error ? null : histRes.data);
      } catch {
        setHistory(null);
      }
      try {
        const reviewsRes = await apiClient.get('/rubric-reviews', {
          params: { student_id: studentId, limit: 100 },
        });
        setReviews(Array.isArray(reviewsRes.data?.data) ? reviewsRes.data.data : []);
      } catch {
        setReviews([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [studentId]);

  const reviewStats = reviews.length > 0 ? {
    total_sessions: reviews.length,
    avg_score: reviews.reduce((s, r) => s + reviewPct(r), 0) / reviews.length,
    passed_count: reviews.filter(r => r.passed).length,
    approval_rate: Math.round(reviews.filter(r => r.passed).length / reviews.length * 100),
    by_course: Object.values(
      reviews.reduce<Record<string, { course_title: string; sessions: number; avg_score: number; approved: number }>>((acc, r) => {
        const cid = r.course?.id ?? 'unknown';
        if (!acc[cid]) acc[cid] = { course_title: r.course?.title ?? '(Sin curso)', sessions: 0, avg_score: 0, approved: 0 };
        acc[cid].sessions++;
        acc[cid].avg_score += reviewPct(r);
        if (r.passed) acc[cid].approved++;
        return acc;
      }, {}),
    ).map(c => ({ ...c, avg_score: c.sessions > 0 ? c.avg_score / c.sessions : 0, approved_evals: c.approved, evaluations: c.sessions })),
  } : null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-blue-600" /> Historia de {studentName}
          </DialogTitle>
        </DialogHeader>
        {loading ? <div className="py-12 text-center text-gray-500">Cargando historial...</div> : !history ? (
          <div className="py-8 text-center text-gray-500">No se pudo cargar el historial.</div>
        ) : (
          <>
            {reviewStats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                <Card className="p-3 text-center bg-blue-50">
                  <p className="text-2xl font-bold text-blue-700">{reviewStats.total_sessions}</p>
                  <p className="text-xs text-blue-600">Revisiones humanas</p>
                </Card>
                <Card className="p-3 text-center bg-green-50">
                  <p className="text-2xl font-bold text-green-700">{reviewStats.avg_score?.toFixed(1) ?? '—'}%</p>
                  <p className="text-xs text-green-600">Promedio</p>
                </Card>
                <Card className="p-3 text-center bg-purple-50">
                  <p className="text-2xl font-bold text-purple-700">{reviewStats.passed_count}</p>
                  <p className="text-xs text-purple-600">Aprobadas</p>
                </Card>
                <Card className={`p-3 text-center ${reviewStats.approval_rate >= 70 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <p className={`text-2xl font-bold ${reviewStats.approval_rate >= 70 ? 'text-green-700' : 'text-red-700'}`}>
                    {reviewStats.approval_rate}%
                  </p>
                  <p className="text-xs text-gray-600">Tasa aprobación</p>
                </Card>
              </div>
            )}

            {reviewStats?.by_course && reviewStats.by_course.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" /> Rendimiento por curso (revisión humana)
                </h4>
                <div className="grid gap-2">
                  {reviewStats.by_course.map((c, i) => (
                    <Card key={i} className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm">{c.course_title}</p>
                        <ScoreBadge score={c.avg_score} />
                      </div>
                      <div className="flex gap-3 text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1">
                          <BarChart3 className="w-3 h-3" /> {c.evaluations} revisiones
                        </span>
                        <span className={`inline-flex items-center gap-1 ${c.approved_evals > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {c.approved_evals > 0
                            ? <><CheckCircle2 className="w-3 h-3" /> {c.approved_evals} aprobadas</>
                            : <><XCircle className="w-3 h-3" /> sin aprobar</>}
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <Tabs defaultValue="reviews" className="mt-4">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="reviews" className="gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" /> Revisiones
                </TabsTrigger>
                <TabsTrigger value="assignments" className="gap-1.5">
                  <ClipboardList className="w-3.5 h-3.5" /> Asignaciones
                </TabsTrigger>
                <TabsTrigger value="timeline" className="gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> Timeline
                </TabsTrigger>
              </TabsList>
              <TabsContent value="reviews" className="space-y-4 mt-4">
                {reviews.length === 0 ? <p className="text-center text-gray-500 py-6">Sin revisiones humanas.</p>
                  : reviews.map(rv => (
                    <Card key={rv.id} className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold">{rv.course?.title || 'Curso'}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(rv.reviewed_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
                            {rv.scenario_title ? ` · ${rv.scenario_title}` : ''}
                          </p>
                          <p className="text-xs text-blue-600 mt-1">
                            Evaluado por {rv.reviewer?.name ?? 'Profesor'}
                          </p>
                        </div>
                        <ReviewScoreBadge review={rv} />
                      </div>
                    </Card>
                  ))}
              </TabsContent>
              <TabsContent value="assignments" className="space-y-3 mt-4">
                {history.assignments.length === 0 ? <p className="text-center text-gray-500 py-6">Sin asignaciones.</p>
                  : history.assignments.map(a => (
                    <Card key={a.id} className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold">{a.course_title}</p>
                          <p className="text-xs text-gray-500 mb-2">Escenario: {a.scenario_title || a.scenario_id}</p>
                          <div className="flex gap-1 flex-wrap">
                            <Badge variant="outline" className="text-xs inline-flex items-center gap-1">
                              {a.scenario_type === 'evaluation' ? (
                                <><BarChart3 className="w-3 h-3" /> Evaluación</>
                              ) : (
                                <><ClipboardList className="w-3 h-3" /> Práctica</>
                              )}
                            </Badge>
                            <Badge variant="outline" className="text-xs">{a.difficulty}</Badge>
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border font-medium ${a.assignment_status === 'completed' ? 'bg-green-100 text-green-800 border-green-300' : 'bg-gray-100 text-gray-700 border-gray-300'}`}>
                              {a.assignment_status === 'completed' ? (
                                <><CheckCircle2 className="w-3 h-3" /> Completado</>
                              ) : a.assignment_status === 'in_progress' ? (
                                <><Loader2 className="w-3 h-3" /> En progreso</>
                              ) : (
                                <><Clock className="w-3 h-3" /> Pendiente</>
                              )}
                            </span>
                          </div>
                        </div>
                        <div className="text-xs text-right text-gray-500">
                          <p>{a.attempts_used}/{a.max_attempts} intentos</p>
                          <p>{a.start_date ? new Date(a.start_date).toLocaleDateString('es-AR') : ''}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
              </TabsContent>
              <TabsContent value="timeline" className="mt-4">
                {history.instances.length === 0 ? <p className="text-center text-gray-500 py-6">Sin sesiones.</p> : (
                  <div className="relative pl-8 space-y-6">
                    <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-200" />
                    {history.instances.map(inst => {
                      const reviewMatch = reviews.find(r => r.simulation_instance_id === inst.id);
                      return (
                        <div key={inst.id} className="relative">
                          <div className={`absolute -left-5 w-4 h-4 rounded-full border-2 ${inst.status === 'completed' ? 'bg-green-500 border-green-600' : 'bg-blue-400 border-blue-500'}`} />
                          <Card className="p-4 ml-2">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-semibold text-sm inline-flex items-center gap-1.5">
                                  {inst.status === 'completed'
                                    ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                                    : <Loader2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                                  {inst.scenario_title || inst.scenario_id}
                                </p>
                                <p className="text-xs text-gray-500 flex items-center gap-1 mt-1"><Calendar className="w-3 h-3" />{inst.started_at ? new Date(inst.started_at).toLocaleString('es-AR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'sin fecha'}</p>
                                <p className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" />{Math.round((inst.time_spent_seconds || 0) / 60)} min · {inst.progress_percentage || 0}% completado</p>
                              </div>
                              {reviewMatch && <ReviewScoreBadge review={reviewMatch} />}
                            </div>
                            {reviewMatch && (
                              <div className="mt-2 text-xs text-blue-700 bg-blue-50 rounded p-2 inline-flex items-center gap-1.5">
                                <BarChart3 className="w-3.5 h-3.5 shrink-0" />
                                Revisión humana: {reviewMatch.total_score}/{reviewMatch.max_score} — Evaluado por {reviewMatch.reviewer?.name ?? 'Profesor'}
                              </div>
                            )}
                            {inst.feedback && !reviewMatch && <p className="mt-2 text-xs text-gray-600 italic">"{inst.feedback.substring(0, 140)}..."</p>}
                          </Card>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ReportsABM() {
  const [reviews, setReviews] = useState<RubricReview[]>([]);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCourse, setFilterCourse] = useState('all');
  const [filterStudent, setFilterStudent] = useState('all');
  const [historyTarget, setHistoryTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    Promise.all([
      fetchAllReviews().then(setReviews).catch(() => setReviews([])),
      apiClient.get('/courses/dropdown/list').then(r => r.data).then(d => setCourses(Array.isArray(d) ? d : [])).catch(() => {}),
    ]).then(() => setLoading(false));
  }, []);

  const reviewsForCourse = (courseId: string) =>
    reviews.filter(r =>
      r.course?.id === courseId || r.course?.course_id === courseId,
    );

  const matchesFilters = (r: RubricReview) => {
    const courseOk =
      filterCourse === 'all' ||
      r.course?.id === filterCourse ||
      r.course?.course_id === filterCourse;
    const studentOk =
      filterStudent === 'all' || r.student?.id === filterStudent;
    return courseOk && studentOk;
  };

  const filtered = reviews.filter(matchesFilters);

  const uniqueStudents = [...new Map(
    reviews
      .filter(r =>
        r.student &&
        (filterCourse === 'all' ||
          r.course?.id === filterCourse ||
          r.course?.course_id === filterCourse),
      )
      .map(r => [r.student!.id, { id: r.student!.id, name: r.student!.name || r.student!.id }]),
  ).values()];

  const visibleCourses =
    filterCourse === 'all'
      ? courses
      : courses.filter(c => c.id === filterCourse || (c as any).course_id === filterCourse);

  const courseStats = visibleCourses.map(c => {
    const courseReviews = reviewsForCourse(c.id).filter(r =>
      filterStudent === 'all' || r.student?.id === filterStudent,
    );
    const avg = courseReviews.length
      ? courseReviews.reduce((s, r) => s + reviewPct(r), 0) / courseReviews.length
      : 0;
    const passedRate = courseReviews.length
      ? Math.round(courseReviews.filter(r => r.passed).length / courseReviews.length * 100)
      : 0;
    return {
      id: c.id,
      title: c.title,
      total_students: new Set(courseReviews.map(r => r.student?.id).filter(Boolean)).size,
      total_reviews: courseReviews.length,
      avg,
      passedRate,
    };
  });

  const globalPassedRate = filtered.length > 0
    ? Math.round(filtered.filter(r => r.passed).length / filtered.length * 100)
    : 0;
  const globalAvg = filtered.length > 0
    ? filtered.reduce((s, r) => s + reviewPct(r), 0) / filtered.length
    : 0;

  const handleExportCSV = () => {
    const csv = [['Estudiante', 'Curso', 'Total Score', 'Max Score', 'Ratio %', 'Aprobado', 'Revisor', 'Fecha'].join(','),
      ...filtered.map(r => [
        r.student?.name || r.student?.id || '-',
        r.course?.title || '-',
        r.total_score,
        r.max_score,
        reviewPct(r).toFixed(1),
        r.passed ? 'Sí' : 'No',
        r.reviewer?.name || '-',
        new Date(r.reviewed_at).toLocaleDateString('es-AR'),
      ].join(',')),
    ].join('\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `reporte_revisiones_${new Date().toISOString().split('T')[0]}.csv` });
    a.click();
  };

  const handleExportExcel = () => {
    const reviewRows = filtered.map(r => ({
      'Estudiante': r.student?.name || r.student?.id || '—',
      'Email': r.student?.email || '',
      'Curso': r.course?.title || '—',
      'Escenario': r.scenario_title || '—',
      'Total Score': r.total_score,
      'Max Score': r.max_score,
      'Ratio %': Number(reviewPct(r).toFixed(1)),
      'Aprobado': r.passed ? 'Sí' : 'No',
      'Revisor': r.reviewer?.name || '—',
      'Fecha': new Date(r.reviewed_at).toLocaleDateString('es-AR'),
    }));
    const statRows = courseStats.map(s => ({
      'Curso': s.title,
      'Alumnos': s.total_students,
      'Revisiones': s.total_reviews,
      'Promedio %': s.total_reviews > 0 ? Number(s.avg.toFixed(1)) : 'Sin revisar',
      'Tasa Aprobación %': s.total_reviews > 0 ? s.passedRate : 0,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(reviewRows), 'Revisiones');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(statRows), 'Estadísticas');
    XLSX.writeFile(wb, `simuverse_revisiones_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) return <div className="p-8 text-center">Cargando reportes...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Reportes y Análisis</h2>
          <p className="text-gray-600 mt-1">
            Calificación oficial = revisión humana. Cursos sin revisiones figuran como pendientes.
          </p>
          <p className="text-gray-500 text-sm mt-0.5">
            Hacé click en <GraduationCap className="inline w-4 h-4 text-blue-600" /> para ver la historia completa de un alumno
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExportCSV} variant="outline"><Download className="w-4 h-4 mr-2" /> CSV</Button>
          <Button onClick={handleExportExcel} className="bg-green-600 hover:bg-green-700 text-white"><Download className="w-4 h-4 mr-2" /> Exportar Excel</Button>
        </div>
      </div>

      {reviews.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-700">{filtered.length}</p>
            <p className="text-xs text-gray-600">Total revisiones humanas</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-green-700">{globalAvg.toFixed(1)}%</p>
            <p className="text-xs text-gray-600">Promedio (score/max)</p>
          </Card>
          <Card className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-700">{globalPassedRate}%</p>
            <p className="text-xs text-gray-600">Tasa de aprobación</p>
          </Card>
        </div>
      )}

      <Card className="p-4 bg-gray-50">
        <div className="flex items-center gap-4 flex-wrap">
          <Filter className="w-4 h-4 text-gray-600" />
          <div className="flex-1 min-w-44">
            <label className="text-xs text-gray-600">Curso</label>
            <select
              value={filterCourse}
              onChange={e => {
                setFilterCourse(e.target.value);
                setFilterStudent('all');
              }}
              className="w-full p-2 border rounded-md text-sm mt-1"
            >
              <option value="all">Todos los cursos</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-44">
            <label className="text-xs text-gray-600">Estudiante</label>
            <select value={filterStudent} onChange={e => setFilterStudent(e.target.value)} className="w-full p-2 border rounded-md text-sm mt-1">
              <option value="all">Todos</option>
              {uniqueStudents.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {visibleCourses.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5" /> Resumen por Curso</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courseStats.map(s => (
              <Card key={s.id} className="p-4">
                <h4 className="font-semibold text-sm">{s.title}</h4>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-600">Alumnos:</span><span className="font-semibold">{s.total_students}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Revisiones:</span><span className="font-semibold">{s.total_reviews}</span></div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Promedio:</span>
                    {s.total_reviews > 0
                      ? <ScoreBadge score={s.avg} />
                      : <span className="text-xs font-semibold px-2 py-1 rounded border bg-gray-100 text-gray-500">Sin revisar</span>}
                  </div>
                  {s.total_reviews > 0 ? (
                    <div className="mt-2">
                      <KpiBar label="Tasa de aprobación" value={s.passedRate} />
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 mt-2">Pendiente de revisión humana</p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold mb-4">Detalle de Revisiones ({filtered.length})</h3>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left">Estudiante</th>
                <th className="px-4 py-3 text-left">Curso</th>
                <th className="px-4 py-3 text-center">Calificación</th>
                <th className="px-4 py-3 text-center">Aprobado</th>
                <th className="px-4 py-3 text-left">Revisor</th>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-center">Historia</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? filtered.map(r => (
                <tr key={r.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{r.student?.name || r.student?.id}</p>
                    <p className="text-xs text-gray-400">{r.student?.email || ''}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{r.course?.title || '—'}</td>
                  <td className="px-4 py-3 text-center"><ReviewScoreBadge review={r} /></td>
                  <td className="px-4 py-3 text-center">
                    {r.passed
                      ? <CheckCircle2 className="w-5 h-5 text-green-600 mx-auto" />
                      : <XCircle className="w-5 h-5 text-red-500 mx-auto" />}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{r.reviewer?.name || '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(r.reviewed_at).toLocaleDateString('es-AR')}</td>
                  <td className="px-4 py-3 text-center">
                    <Button size="sm" variant="outline" title="Ver historia completa" onClick={() => setHistoryTarget({ id: r.student!.id, name: r.student!.name || r.student!.id })}>
                      <GraduationCap className="w-4 h-4 text-blue-600" />
                    </Button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                  {filterCourse !== 'all'
                    ? `Sin revisiones en "${courses.find(c => c.id === filterCourse)?.title ?? 'este curso'}". Pendiente de revisión humana.`
                    : 'Sin revisiones humanas para los filtros seleccionados.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {reviews.length === 0 && courses.length > 0 && (
        <Card className="p-8 text-center">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-gray-600">Aún no hay revisiones humanas.</p>
          <p className="text-sm text-gray-400 mt-1">{courses.length} curso{courses.length !== 1 ? 's' : ''} en catálogo — pendientes de revisión humana.</p>
        </Card>
      )}

      {historyTarget && <StudentHistoryDialog studentId={historyTarget.id} studentName={historyTarget.name} onClose={() => setHistoryTarget(null)} />}
    </div>
  );
}
