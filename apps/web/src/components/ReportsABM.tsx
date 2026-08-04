'use client'
/**
 * ReportsABM.tsx — Panel de Reportes con Historia del Alumno
 */
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Calendar, CheckCircle2, Clock, Download, Filter, GraduationCap, Target, Timer, TrendingUp, Trophy, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';

import { getScoreBarColor, getScoreBg, getScoreText } from '@/lib/score-colors';
import { apiClient } from '@/services/ApiClient';

interface Evaluation {
  id: number; student_id: string; simulation_id: string; assignment_id: number;
  attempt_number: number; kpi_results: any; overall_score: number;
  overall_feedback: string; completion_percentage: number; time_spent_seconds: number;
  evaluated_at: string; student_name?: string; student_email?: string; course_title?: string;
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
  const label = n >= 85 ? '✅ Aprobado' : n >= 70 ? '⚠️ Regular' : '❌ Desaprobado';
  return <span className={`text-xs font-semibold px-2 py-1 rounded border ${cls}`}>{n.toFixed(1)} — {label}</span>;
}

function StudentHistoryDialog({ studentId, studentName, onClose }: {
  studentId: string; studentName: string; onClose: () => void;
}) {
  const [history, setHistory] = useState<StudentHistory | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [histRes, statsRes] = await Promise.all([
          apiClient.get(`/students/${studentId}/history`),
          apiClient.get(`/students/${studentId}/stats`),
        ]);
        setHistory(histRes.data);
        setStats(statsRes.data);
      } catch { setHistory(null); }
      finally { setLoading(false); }
    })();
  }, [studentId]);

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
            {/* Stats expandidas usando el endpoint /students/:id/stats */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                <Card className="p-3 text-center bg-blue-50">
                  <p className="text-2xl font-bold text-blue-700">{stats.total_sessions}</p>
                  <p className="text-xs text-blue-600">Simulaciones</p>
                </Card>
                <Card className="p-3 text-center bg-green-50">
                  <p className="text-2xl font-bold text-green-700">{stats.avg_score?.toFixed(1) ?? '—'}</p>
                  <p className="text-xs text-green-600">Promedio</p>
                </Card>
                <Card className="p-3 text-center bg-purple-50">
                  <p className="text-2xl font-bold text-purple-700">{stats.total_time_minutes}</p>
                  <p className="text-xs text-purple-600">Min total</p>
                </Card>
                <Card className={`p-3 text-center ${stats.final_exam?.overall_score >= 70 ? 'bg-green-50' : stats.final_exam ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <p className={`text-2xl font-bold ${stats.final_exam?.overall_score >= 70 ? 'text-green-700' : stats.final_exam ? 'text-red-700' : 'text-gray-400'}`}>
                    {stats.final_exam ? (stats.final_exam.overall_score >= 70 ? '✅' : '❌') : '—'}
                  </p>
                  <p className="text-xs text-gray-600">Examen Final</p>
                </Card>
              </div>
            )}

            {/* Aciertos / Desaciertos / KPI rate */}
            {stats && (
              <div className="grid grid-cols-3 gap-3">
                <Card className="p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <p className="text-xl font-bold text-green-700">{stats.correct_answers}</p>
                  </div>
                  <p className="text-xs text-gray-500">Aciertos</p>
                  {stats.accuracy_rate != null && (
                    <p className="text-xs text-green-600 font-semibold">{stats.accuracy_rate}%</p>
                  )}
                </Card>
                <Card className="p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <p className="text-xl font-bold text-red-700">{stats.incorrect_answers}</p>
                  </div>
                  <p className="text-xs text-gray-500">Desaciertos</p>
                </Card>
                <Card className="p-3 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Target className="w-4 h-4 text-indigo-500" />
                    <p className="text-xl font-bold text-indigo-700">
                      {stats.kpi_approval_rate != null ? `${stats.kpi_approval_rate}%` : '—'}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500">KPIs aprobados</p>
                </Card>
              </div>
            )}

            {/* Examen final si existe */}
            {stats?.final_exam && (
              <Card className={`p-3 flex items-center gap-3 ${stats.final_exam.overall_score >= 70 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <Trophy className={`w-5 h-5 ${stats.final_exam.overall_score >= 70 ? 'text-green-600' : 'text-red-600'}`} />
                <div>
                  <p className="text-sm font-semibold">
                    Simulación Final: {stats.final_exam.overall_score >= 70 ? '✅ APROBADO' : '❌ DESAPROBADO'}
                    {' — '}<span className="font-bold">{parseFloat(stats.final_exam.overall_score).toFixed(1)} pts</span>
                  </p>
                  <p className="text-xs text-gray-600">{stats.final_exam.scenario_title} · {stats.final_exam.course_title}</p>
                  <p className="text-xs text-gray-400">{stats.final_exam.evaluated_at ? new Date(stats.final_exam.evaluated_at).toLocaleDateString('es-AR') : ''}</p>
                </div>
              </Card>
            )}

            {/* Stats por curso */}
            {stats?.by_course?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" /> Rendimiento por curso
                </h4>
                <div className="grid gap-2">
                  {stats.by_course.map((c: any, i: number) => (
                    <Card key={i} className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm">{c.course_title || '(Sin curso)'}</p>
                        <ScoreBadge score={parseFloat(c.avg_score) || 0} />
                      </div>
                      <div className="flex gap-3 text-xs text-gray-500">
                        <span>📚 {c.sessions} sesiones</span>
                        <span>📊 {c.evaluations} evaluaciones</span>
                        <span className={c.approved_evals > 0 ? 'text-green-600' : 'text-red-500'}>
                          {c.approved_evals > 0 ? `✅ ${c.approved_evals} aprobadas` : '❌ sin aprobar'}
                        </span>
                        <span><Timer className="w-3 h-3 inline" /> {Math.round((c.total_time_seconds || 0) / 60)} min</span>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            <Tabs defaultValue="evaluations" className="mt-4">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="evaluations">📊 Evaluaciones</TabsTrigger>
                <TabsTrigger value="assignments">📋 Asignaciones</TabsTrigger>
                <TabsTrigger value="timeline">📅 Timeline</TabsTrigger>
              </TabsList>
              <TabsContent value="evaluations" className="space-y-4 mt-4">
                {history.evaluations.length === 0 ? <p className="text-center text-gray-500 py-6">Sin evaluaciones.</p>
                  : history.evaluations.map(ev => {
                    const kpis = typeof ev.kpi_results === 'string' ? JSON.parse(ev.kpi_results || '{}') : (ev.kpi_results || {});
                    return (
                      <Card key={ev.id} className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-semibold">{ev.course_title || 'Curso'}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(ev.evaluated_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
                              {' · '}Intento #{ev.attempt_number}{' · '}{Math.round((ev.time_spent_seconds || 0) / 60)} min
                            </p>
                          </div>
                          <ScoreBadge score={ev.overall_score || 0} />
                        </div>
                        {Object.keys(kpis).length > 0 && <div className="mb-3">{Object.entries(kpis).map(([k, v]) => <KpiBar key={k} label={k} value={Number(v)} />)}</div>}
                        {ev.overall_feedback && (
                          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 border-l-4 border-blue-400">
                            <p className="font-semibold text-xs text-gray-500 mb-1">💬 Feedback del evaluador IA</p>
                            {ev.overall_feedback}
                          </div>
                        )}
                      </Card>
                    );
                  })}
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
                            <Badge variant="outline" className="text-xs">{a.scenario_type === 'evaluation' ? '📊 Evaluación' : '📚 Práctica'}</Badge>
                            <Badge variant="outline" className="text-xs">{a.difficulty}</Badge>
                            <span className={`text-xs px-2 py-0.5 rounded border font-medium ${a.assignment_status === 'completed' ? 'bg-green-100 text-green-800 border-green-300' : 'bg-gray-100 text-gray-700 border-gray-300'}`}>
                              {a.assignment_status === 'completed' ? '✅ Completado' : a.assignment_status === 'in_progress' ? '🔄 En progreso' : '⏳ Pendiente'}
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
                      const evalMatch = history.evaluations.find(e => e.simulation_id === inst.id);
                      return (
                        <div key={inst.id} className="relative">
                          <div className={`absolute -left-5 w-4 h-4 rounded-full border-2 ${inst.status === 'completed' ? 'bg-green-500 border-green-600' : 'bg-blue-400 border-blue-500'}`} />
                          <Card className="p-4 ml-2">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-semibold text-sm">{inst.status === 'completed' ? '✅' : '🔄'} {inst.scenario_title || inst.scenario_id}</p>
                                <p className="text-xs text-gray-500 flex items-center gap-1 mt-1"><Calendar className="w-3 h-3" />{inst.started_at ? new Date(inst.started_at).toLocaleString('es-AR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'sin fecha'}</p>
                                <p className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" />{Math.round((inst.time_spent_seconds || 0) / 60)} min · {inst.progress_percentage || 0}% completado</p>
                              </div>
                              {inst.score != null && <ScoreBadge score={inst.score} />}
                            </div>
                            {evalMatch && (
                              <div className="mt-2 text-xs text-blue-700 bg-blue-50 rounded p-2">
                                📊 Evaluación final: {evalMatch.overall_score.toFixed(1)} — {(evalMatch.overall_feedback || '').substring(0, 120)}...
                              </div>
                            )}
                            {inst.feedback && !evalMatch && <p className="mt-2 text-xs text-gray-600 italic">"{inst.feedback.substring(0, 140)}..."</p>}
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
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCourse, setFilterCourse] = useState('all');
  const [filterStudent, setFilterStudent] = useState('all');
  const [historyTarget, setHistoryTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    Promise.all([
      apiClient.get('/evaluations/student/all').then(r => r.data).then(d => setEvaluations(Array.isArray(d) ? d : [])).catch(() => {}),
      apiClient.get('/courses/dropdown/list').then(r => r.data).then(d => setCourses(Array.isArray(d) ? d : [])).catch(() => {}),
    ]).then(() => setLoading(false));
  }, []);

  const filtered = evaluations.filter(e =>
    (filterCourse === 'all' || e.course_title === filterCourse) &&
    (filterStudent === 'all' || e.student_id === filterStudent)
  );

  const uniqueStudents = [...new Map(evaluations.map(e => [e.student_id, { id: e.student_id, name: e.student_name || e.student_id }])).values()];
  const uniqueCourses = [...new Set(evaluations.map(e => e.course_title).filter(Boolean))];

  const courseStats = courses.map(c => {
    const evals = evaluations.filter(e => e.course_title === c.title);
    const avg = evals.length ? evals.reduce((s, e) => s + (e.overall_score || 0), 0) / evals.length : 0;
    return { id: c.id, title: c.title, total_students: new Set(evals.map(e => e.student_id)).size, total_evaluations: evals.length, avg };
  }).filter(s => s.total_evaluations > 0);

  const handleExportCSV = () => {
    const csv = [['Estudiante', 'Curso', 'Calificación', 'Completitud %', 'Tiempo (min)', 'Fecha'].join(','),
      ...filtered.map(e => [e.student_name || e.student_id, e.course_title || '-', (e.overall_score || 0).toFixed(2),
        e.completion_percentage || 0, Math.floor((e.time_spent_seconds || 0) / 60), new Date(e.evaluated_at).toLocaleDateString()].join(','))
    ].join('\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: `reporte_${new Date().toISOString().split('T')[0]}.csv` });
    a.click();
  };

  const handleExportExcel = () => {
    // Hoja 1: Evaluaciones
    const evRows = filtered.map(e => {
      let kpis: Record<string, number> = {};
      try { kpis = typeof e.kpi_results === 'string' ? JSON.parse(e.kpi_results) : (e.kpi_results || {}); } catch {}
      return {
        'Estudiante': e.student_name || e.student_id,
        'Email': e.student_email || '',
        'Curso': e.course_title || '—',
        'Calificación': Number((e.overall_score || 0).toFixed(2)),
        'Resultado': (e.overall_score || 0) >= 70 ? 'Aprobado' : 'Desaprobado',
        'Completitud %': e.completion_percentage || 0,
        'Tiempo (min)': Math.floor((e.time_spent_seconds || 0) / 60),
        'Intento #': e.attempt_number || 1,
        'Fecha': new Date(e.evaluated_at).toLocaleDateString('es-AR'),
        'Feedback': e.overall_feedback || '',
        ...Object.fromEntries(Object.entries(kpis).map(([k, v]) => [`KPI: ${k}`, Number(v)])),
      };
    });
    // Hoja 2: Estadísticas por curso
    const statRows = courseStats.map(s => ({
      'Curso': s.title,
      'Alumnos': s.total_students,
      'Evaluaciones': s.total_evaluations,
      'Promedio': Number(s.avg.toFixed(2)),
      'Tasa Aprobación %': Math.round(
        evaluations.filter(e => e.course_title === s.title && e.overall_score >= 70).length / s.total_evaluations * 100
      ),
    }));
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(evRows);
    const ws2 = XLSX.utils.json_to_sheet(statRows);
    XLSX.utils.book_append_sheet(wb, ws1, 'Evaluaciones');
    XLSX.utils.book_append_sheet(wb, ws2, 'Estadísticas');
    XLSX.writeFile(wb, `simuverse_reporte_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (loading) return <div className="p-8 text-center">Cargando reportes...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Reportes y Análisis</h2>
          <p className="text-gray-600 mt-1">Hacé click en <GraduationCap className="inline w-4 h-4 text-blue-600" /> para ver la historia completa de un alumno</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExportCSV} variant="outline"><Download className="w-4 h-4 mr-2" /> CSV</Button>
          <Button onClick={handleExportExcel} className="bg-green-600 hover:bg-green-700 text-white"><Download className="w-4 h-4 mr-2" /> Exportar Excel</Button>
        </div>
      </div>

      {courseStats.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5" /> Resumen por Curso</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courseStats.map(s => (
              <Card key={s.id} className="p-4">
                <h4 className="font-semibold text-sm">{s.title}</h4>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-600">Alumnos:</span><span className="font-semibold">{s.total_students}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Evaluaciones:</span><span className="font-semibold">{s.total_evaluations}</span></div>
                  <div className="flex justify-between items-center"><span className="text-gray-600">Promedio:</span><ScoreBadge score={s.avg} /></div>
                  <div className="mt-2"><KpiBar label="Tasa de aprobación" value={Math.round(evaluations.filter(e => e.course_title === s.title && e.overall_score >= 70).length / s.total_evaluations * 100)} /></div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Card className="p-4 bg-gray-50">
        <div className="flex items-center gap-4 flex-wrap">
          <Filter className="w-4 h-4 text-gray-600" />
          <div className="flex-1 min-w-44">
            <label className="text-xs text-gray-600">Curso</label>
            <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)} className="w-full p-2 border rounded-md text-sm mt-1">
              <option value="all">Todos los cursos</option>
              {uniqueCourses.map(c => <option key={c} value={c}>{c}</option>)}
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

      <div>
        <h3 className="text-lg font-semibold mb-4">Detalle de Evaluaciones ({filtered.length})</h3>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left">Estudiante</th>
                <th className="px-4 py-3 text-left">Curso</th>
                <th className="px-4 py-3 text-center">Calificación</th>
                <th className="px-4 py-3 text-center">Completitud</th>
                <th className="px-4 py-3 text-center">Tiempo</th>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-center">Historia</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? filtered.map(e => (
                <tr key={e.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3"><p className="font-semibold">{e.student_name || e.student_id}</p><p className="text-xs text-gray-400">{e.student_email || ''}</p></td>
                  <td className="px-4 py-3 text-gray-700">{e.course_title || '—'}</td>
                  <td className="px-4 py-3 text-center"><ScoreBadge score={e.overall_score || 0} /></td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex flex-col items-center">
                      <span className="font-semibold">{e.completion_percentage || 0}%</span>
                      <div className="w-16 h-1.5 bg-gray-200 rounded-full mt-1"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${e.completion_percentage || 0}%` }} /></div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-gray-600">{Math.floor((e.time_spent_seconds || 0) / 60)} min</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(e.evaluated_at).toLocaleDateString('es-AR')}</td>
                  <td className="px-4 py-3 text-center">
                    <Button size="sm" variant="outline" title="Ver historia completa" onClick={() => setHistoryTarget({ id: e.student_id, name: e.student_name || e.student_id })}>
                      <GraduationCap className="w-4 h-4 text-blue-600" />
                    </Button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500">Sin evaluaciones para los filtros seleccionados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {evaluations.length === 0 && (
        <Card className="p-8 text-center">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-gray-600">No hay evaluaciones registradas.</p>
        </Card>
      )}

      {historyTarget && <StudentHistoryDialog studentId={historyTarget.id} studentName={historyTarget.name} onClose={() => setHistoryTarget(null)} />}
    </div>
  );
}
