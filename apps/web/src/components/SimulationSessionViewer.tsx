'use client'
/**
 * SimulationSessionViewer.tsx
 * Visor de sesiones de simulación para Profesor / Admin / Ministerio.
 * Muestra: diálogo completo IA↔Alumno, solución propuesta por IA y número de referencia.
 */
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import {
    Bot,
    ClipboardCheck,
    Download,
    Filter,
    Hash,
    Info,
    Loader2,
    MessageSquare,
    Search,
    User,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { apiClient } from '@/services/ApiClient';
import { toast } from 'sonner';

interface ChatLog {
  id: number;
  simulation_instance_id: string;
  ref_number: string;
  turn_number: number;
  speaker: 'student' | 'ai' | 'system';
  message_text: string;
  challenge_description: string | null;
  is_correct: 0 | 1 | null;
  correct_answer: string | null;
  ai_solution: string | null;
  score_impact: number;
  created_at: string;
}

interface SessionDetail {
  instance: {
    id: string; status: string; score: number; started_at: string; completed_at: string;
    time_spent_seconds: number; progress_percentage: number;
    student_name: string; student_email: string; student_id: string;
    scenario_title: string; scenario_type: string; difficulty: string; course_title: string;
  };
  logs: ChatLog[];
  submissions?: Array<{
    id: string; file_name: string; file_type: string; file_size_bytes: string; created_at: string; download_url: string;
  }>;
  evaluation: {
    overall_score: number; overall_feedback: string; kpi_results: any;
    completion_percentage: number; time_spent_seconds: number; evaluated_at: string;
  } | null;
  summary?: {
    total_turns: number; student_turns: number; evaluated_turns: number;
    correct_turns: number; incorrect_turns: number;
  };
}

interface SessionRow {
  id: string; status: string; score: number; started_at: string; completed_at: string;
  time_spent_seconds: number; progress_percentage: number;
  student_name: string; student_email: string; student_id: string;
  scenario_title: string; scenario_type: string; difficulty: string;
  course_title: string; course_id: string;
  total_turns: number; incorrect_turns: number;
}

interface RubricLevel {
  id: string;
  value: number;
  label: string;
  description: string | null;
  sort_order: number;
}

interface RubricCriterion {
  id: string;
  code: string;
  label: string;
  description: string | null;
  sort_order: number;
  descriptors: Record<string, string>;
}

interface CourseRubric {
  id: string;
  course_id: string;
  name: string;
  pass_threshold: number;
  active: boolean;
  levels: RubricLevel[];
  criteria: RubricCriterion[];
}

interface RubricReview {
  id: string;
  simulation_instance_id: string;
  scores: Record<string, number>;
  total_score: number;
  max_score: number;
  passed: boolean;
  pass_threshold_snapshot: number;
  comment: string | null;
  reviewed_at: string;
  reviewer?: { id: string; name: string; email: string };
  rubric?: { id: string; name: string; pass_threshold: number };
}

interface RubricReviewSummary {
  passed: boolean;
  total_score: number;
  max_score: number;
  reviewed_at: string;
}

function computeScorePreview(
  rubric: CourseRubric,
  scores: Record<string, number | undefined>,
) {
  const maxLevelValue = Math.max(...rubric.levels.map((l) => l.value));
  const max = rubric.criteria.length * maxLevelValue;
  let total = 0;
  let complete = true;
  for (const c of rubric.criteria) {
    const v = scores[c.code];
    if (v == null) complete = false;
    else total += v;
  }
  return {
    total,
    max,
    passed: total >= rubric.pass_threshold,
    complete,
  };
}

export function RubricStatusBadge({ review }: { review?: RubricReviewSummary | null }) {
  if (!review) {
    return (
      <Badge variant="outline" className="text-xs border-gray-300 text-gray-600">
        Pendiente
      </Badge>
    );
  }
  if (review.passed) {
    return (
      <Badge className="text-xs bg-green-100 text-green-800 border border-green-300 hover:bg-green-100">
        Aprobado
      </Badge>
    );
  }
  return (
    <Badge className="text-xs bg-red-100 text-red-800 border border-red-300 hover:bg-red-100">
      No aprobado
    </Badge>
  );
}

// ─── Sub-componente: burbuja de chat ─────────────────────────────────────────
function ChatBubble({ log, showSolution }: { log: ChatLog; showSolution: boolean }) {
  const isAI = log.speaker === 'ai';
  const isSystem = log.speaker === 'system';
  const [expanded, setExpanded] = useState(false);

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full border">
          {log.message_text}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 ${isAI ? 'flex-row' : 'flex-row-reverse'}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1
        ${isAI ? 'bg-purple-100' : 'bg-blue-100'}`}>
        {isAI
          ? <Bot className="w-4 h-4 text-purple-600" />
          : <User className="w-4 h-4 text-blue-600" />
        }
      </div>

      {/* Bubble */}
      <div className={`max-w-[75%] space-y-1`}>
        {/* Label + ref */}
        <div className={`flex items-center gap-2 ${isAI ? '' : 'flex-row-reverse'}`}>
          <span className="text-xs font-semibold text-gray-500">
            {isAI ? '🤖 IA' : '🎓 Alumno'} · Turno #{log.turn_number}
          </span>
          <span className="text-xs text-gray-400 font-mono">[{log.ref_number}]</span>
        </div>

        {/* Message */}
        <div className={`rounded-2xl px-4 py-3 text-sm
          ${isAI
            ? 'bg-purple-50 border border-purple-200 text-purple-900 rounded-tl-none'
            : 'bg-blue-50 border border-blue-200 text-blue-900 rounded-tr-none'
          }`}>
          {log.message_text}
        </div>

        {/* Challenge description (what was asked) */}
        {log.challenge_description && (
          <div className="text-xs text-gray-500 italic px-1">
            📋 <span className="font-medium">Desafío:</span> {log.challenge_description}
          </div>
        )}

        {/* AI solution (student turns with available context) */}
        {!isAI && showSolution && (log.correct_answer || log.ai_solution) && (
          <div className="mt-2 space-y-2">
            {log.correct_answer && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs">
                <p className="font-semibold text-amber-800 flex items-center gap-1 mb-1">
                  <Info className="w-3 h-3" /> Respuesta esperada:
                </p>
                <p className="text-amber-700">{log.correct_answer}</p>
              </div>
            )}
            {log.ai_solution && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs">
                <p className="font-semibold text-green-800 flex items-center gap-1 mb-1">
                  <Bot className="w-3 h-3" /> 💡 Solución propuesta por IA:
                </p>
                <p className="text-green-700">{log.ai_solution}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Panel de evaluación con rúbrica dinámica ────────────────────────────────
export function SessionRubricPanel({
  instanceId,
  courseId,
  onReviewSaved,
}: {
  instanceId: string;
  courseId: string | null;
  onReviewSaved?: (review: RubricReview) => void;
}) {
  const [rubric, setRubric] = useState<CourseRubric | null>(null);
  const [review, setReview] = useState<RubricReview | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!courseId) {
      setLoading(false);
      setError('No se encontró el curso de esta sesión.');
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      setEditing(false);
      try {
        const [rubricRes, reviewRes] = await Promise.all([
          apiClient.get(`/courses/${courseId}/rubric`),
          apiClient.get(`/teacher/sessions/${instanceId}/rubric-review`),
        ]);
        if (cancelled) return;

        const rubricData = rubricRes.data as CourseRubric;
        const existingReview = (reviewRes.data?.review ?? null) as RubricReview | null;

        setRubric(rubricData);
        setReview(existingReview);
        setScores(existingReview?.scores ?? {});
        setComment(existingReview?.comment ?? '');
        setEditing(!existingReview);
      } catch {
        if (!cancelled) {
          setRubric(null);
          setReview(null);
          setError('No se pudo cargar la rúbrica del curso.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [instanceId, courseId]);

  const preview = useMemo(
    () => (rubric ? computeScorePreview(rubric, scores) : null),
    [rubric, scores],
  );

  const canEdit = editing || !review;

  const handleSave = async () => {
    if (!rubric || !preview?.complete) return;
    setSaving(true);
    setSaveError('');
    try {
      const res = await apiClient.post(`/teacher/sessions/${instanceId}/rubric-review`, {
        scores,
        comment: comment.trim() || undefined,
      });
      const saved = res.data.review as RubricReview;
      setReview(saved);
      setScores(saved.scores);
      setComment(saved.comment ?? '');
      setEditing(false);
      toast.success(
        saved.passed
          ? `Calificación guardada: ${saved.total_score}/${saved.max_score} — Aprobado`
          : `Calificación guardada: ${saved.total_score}/${saved.max_score} — No aprobado`,
      );
      onReviewSaved?.(saved);
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      const text =
        typeof msg === 'string'
          ? msg
          : Array.isArray(msg)
            ? msg.join(', ')
            : 'Error al guardar la calificación.';
      setSaveError(text);
      toast.error(text);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-500 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Cargando rúbrica...
      </div>
    );
  }

  if (error || !rubric) {
    return <div className="py-8 text-center text-red-500">{error || 'Rúbrica no disponible.'}</div>;
  }

  const displayPreview = preview;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-blue-600" />
            {rubric.name}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {rubric.criteria.length} criterios · {rubric.levels.length} niveles · umbral {rubric.pass_threshold}
          </p>
        </div>
        <RubricStatusBadge
          review={
            review
              ? {
                  passed: review.passed,
                  total_score: review.total_score,
                  max_score: review.max_score,
                  reviewed_at: review.reviewed_at,
                }
              : null
          }
        />
      </div>

      {review && (
        <Card className="p-3 bg-gray-50 text-xs text-gray-600">
          Evaluado por <span className="font-medium">{review.reviewer?.name ?? '—'}</span>
          {' · '}
          {new Date(review.reviewed_at).toLocaleString('es-AR')}
        </Card>
      )}

      <div className="space-y-5">
        {rubric.criteria.map((criterion) => (
          <Card key={criterion.id} className="p-4">
            <p className="font-medium text-sm mb-3">{criterion.label}</p>
            {criterion.description && (
              <p className="text-xs text-muted-foreground mb-3">{criterion.description}</p>
            )}
            <RadioGroup
              value={scores[criterion.code] != null ? String(scores[criterion.code]) : ''}
              onValueChange={(v) =>
                setScores((prev) => ({ ...prev, [criterion.code]: Number(v) }))
              }
              disabled={!canEdit}
              className="space-y-2"
            >
              {rubric.levels.map((level) => {
                const descriptor = criterion.descriptors[String(level.value)];
                const inputId = `${criterion.code}-${level.value}`;
                return (
                  <div
                    key={level.id}
                    className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                      scores[criterion.code] === level.value
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-200'
                    } ${!canEdit ? 'opacity-80' : ''}`}
                  >
                    <RadioGroupItem value={String(level.value)} id={inputId} className="mt-0.5" disabled={!canEdit} />
                    <Label htmlFor={inputId} className={`flex-1 font-normal ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}>
                      <span className="font-medium text-sm">
                        {level.value} — {level.label}
                      </span>
                      {descriptor && (
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {descriptor}
                        </p>
                      )}
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </Card>
        ))}
      </div>

      <div>
        <Label htmlFor="rubric-comment" className="text-sm">
          Comentario (opcional)
        </Label>
        <Textarea
          id="rubric-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Observaciones sobre el desempeño del alumno..."
          className="mt-1.5"
          rows={3}
          disabled={!canEdit}
        />
      </div>

      {displayPreview && (
        <Card className={`p-4 ${
          !displayPreview.complete
            ? 'bg-gray-50'
            : displayPreview.passed
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Puntaje total</p>
              <p className="text-2xl font-bold">
                {displayPreview.total} <span className="text-base font-normal text-muted-foreground">/ {displayPreview.max}</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Umbral de aprobación</p>
              <p className="text-lg font-semibold">{rubric.pass_threshold}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-1">Estado</p>
              {!displayPreview.complete ? (
                <Badge variant="outline" className="text-xs">Incompleto</Badge>
              ) : (
                <RubricStatusBadge
                  review={{
                    passed: displayPreview.passed,
                    total_score: displayPreview.total,
                    max_score: displayPreview.max,
                    reviewed_at: review?.reviewed_at ?? '',
                  }}
                />
              )}
            </div>
          </div>
        </Card>
      )}

      {saveError && <p className="text-sm text-red-600">{saveError}</p>}

      <div className="flex justify-end gap-2">
        {review && !canEdit ? (
          <Button
            type="button"
            onClick={() => setEditing(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Editar Calificación
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || !preview?.complete}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar Calificación'
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Dialog con el detalle de una sesión ─────────────────────────────────────
function SessionDetailDialog({
  instanceId,
  courseId,
  sessions,
  onClose,
  onReviewSaved,
}: {
  instanceId: string;
  courseId?: string | null;
  sessions: SessionRow[];
  onClose: () => void;
  onReviewSaved?: (instanceId: string, review: RubricReview) => void;
}) {
  const [data, setData] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSolutions, setShowSolutions] = useState(true);
  const [filterSpeaker, setFilterSpeaker] = useState<'all' | 'student' | 'ai'>('all');
  const [detailTab, setDetailTab] = useState('dialogue');

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get(`/simulation-sessions/${instanceId}`);
        setData(res.data);
      } catch { setData(null); }
      finally { setLoading(false); }
    })();
  }, [instanceId]);

  const filteredLogs = data?.logs.filter(l =>
    filterSpeaker === 'all' || l.speaker === filterSpeaker
  ) ?? [];

  const resolvedCourseId = courseId ?? sessions.find((s) => s.id === instanceId)?.course_id ?? null;

  const handleExport = () => {
    if (!data) return;
    const summary = data.summary ?? {
      total_turns: 0, student_turns: 0, evaluated_turns: 0, correct_turns: 0, incorrect_turns: 0,
    };
    const lines = [
      `=== SESIÓN ${instanceId} ===`,
      `Alumno: ${data.instance.student_name} (${data.instance.student_email})`,
      `Curso: ${data.instance.course_title} | Escenario: ${data.instance.scenario_title}`,
      `Inicio: ${new Date(data.instance.started_at).toLocaleString('es-AR')}`,
      `Tiempo: ${Math.round(data.instance.time_spent_seconds / 60)} min`,
      '',
      `--- DIÁLOGO (${summary.total_turns} turnos) ---`,
      ...data.logs.map(l =>
        `[${l.ref_number}] T${l.turn_number} ${l.speaker.toUpperCase()}: ${l.message_text}` +
        (l.ai_solution ? `\n  IA: ${l.ai_solution}` : '')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `sesion_${instanceId}.txt`
    });
    a.click();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-purple-600" />
            Visor de Sesión
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-gray-500">Cargando sesión...</div>
        ) : !data ? (
          <div className="py-8 text-center text-red-500">No se pudo cargar la sesión.</div>
        ) : (() => {
          const summary = data.summary ?? {
            total_turns: 0, student_turns: 0, evaluated_turns: 0, correct_turns: 0, incorrect_turns: 0,
          };
          const aiTurns = summary.total_turns - summary.student_turns;
          return (
          <>
            {/* Metadata header */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
              <Card className="p-3 bg-blue-50">
                <p className="text-xs text-blue-600">Alumno</p>
                <p className="font-semibold text-sm">{data.instance.student_name}</p>
                <p className="text-xs text-gray-500">{data.instance.student_email}</p>
              </Card>
              <Card className="p-3 bg-purple-50">
                <p className="text-xs text-purple-600">Escenario</p>
                <p className="font-semibold text-sm">{data.instance.scenario_title}</p>
                <Badge variant="outline" className="text-xs mt-1">{data.instance.difficulty}</Badge>
              </Card>
              <Card className="p-3 bg-indigo-50">
                <p className="text-xs text-indigo-600">Turnos</p>
                <p className="text-2xl font-bold text-indigo-700">{summary.total_turns}</p>
                <p className="text-xs text-gray-500">{summary.student_turns} del alumno</p>
              </Card>
              <Card className="p-3 bg-orange-50">
                <p className="text-xs text-orange-600">Duración</p>
                <p className="text-2xl font-bold text-orange-700">{Math.round(data.instance.time_spent_seconds / 60)} min</p>
                <p className="text-xs text-gray-500">{data.instance.status}</p>
              </Card>
            </div>

            <Tabs value={detailTab} onValueChange={setDetailTab} className="mt-4">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="dialogue">Diálogo</TabsTrigger>
                <TabsTrigger value="files">Entregas ({data.submissions?.length ?? 0})</TabsTrigger>
                <TabsTrigger
                  value="rubric"
                  className="bg-blue-600 text-white hover:bg-blue-700 hover:text-white data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:bg-blue-600 data-[state=inactive]:text-white"
                >
                  Calificar
                </TabsTrigger>
                <TabsTrigger value="analysis">Resumen</TabsTrigger>
              </TabsList>

              {/* ─── DIÁLOGO ─────────────────── */}
              <TabsContent value="dialogue" className="mt-4" forceMount hidden={detailTab !== 'dialogue'}>
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-gray-400" />
                    <select
                      value={filterSpeaker}
                      onChange={e => setFilterSpeaker(e.target.value as any)}
                      className="text-sm border rounded-md px-2 py-1"
                    >
                      <option value="all">Todos los mensajes</option>
                      <option value="student">Solo alumno</option>
                      <option value="ai">Solo IA</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showSolutions}
                      onChange={e => setShowSolutions(e.target.checked)}
                      className="rounded"
                    />
                    Mostrar solución IA
                  </label>
                  <Button size="sm" variant="outline" onClick={handleExport}>
                    <Download className="w-4 h-4 mr-1" /> Exportar
                  </Button>
                </div>

                <div className="space-y-4 bg-gray-50 rounded-xl p-4 border max-h-[55vh] overflow-y-auto">
                  {filteredLogs.length === 0 ? (
                    <p className="text-center text-gray-400 py-8">Sin mensajes para este filtro.</p>
                  ) : filteredLogs.map(log => (
                    <ChatBubble key={log.id} log={log} showSolution={showSolutions} />
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="files" className="mt-4" forceMount hidden={detailTab !== 'files'}>
                {!data.submissions?.length ? (
                  <p className="text-center text-gray-400 py-8">Sin archivos entregados en esta sesión.</p>
                ) : (
                  <div className="space-y-2">
                    {data.submissions.map((f) => (
                      <Card key={f.id} className="p-3 flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-sm">{f.file_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {f.file_type} · {Math.round(Number(f.file_size_bytes) / 1024)} KB ·{' '}
                            {new Date(f.created_at).toLocaleString('es-AR')}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              const res = await apiClient.get(
                                f.download_url.startsWith('/api/')
                                  ? f.download_url.replace(/^\/api/, '')
                                  : f.download_url,
                                { responseType: 'blob' } as any,
                              );
                              const blob = new Blob([res.data]);
                              const url = URL.createObjectURL(blob);
                              const a = Object.assign(document.createElement('a'), {
                                href: url,
                                download: f.file_name,
                              });
                              a.click();
                              URL.revokeObjectURL(url);
                            } catch {
                              /* ignore */
                            }
                          }}
                        >
                          <Download className="w-4 h-4 mr-1" /> Descargar
                        </Button>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="rubric" className="mt-4" forceMount hidden={detailTab !== 'rubric'}>
                <SessionRubricPanel
                  instanceId={instanceId}
                  courseId={resolvedCourseId}
                  onReviewSaved={(review) => {
                    onReviewSaved?.(instanceId, review);
                    setDetailTab('dialogue');
                  }}
                />
              </TabsContent>

              {/* ─── RESUMEN ─────────────────── */}
              <TabsContent value="analysis" className="mt-4 space-y-4" forceMount hidden={detailTab !== 'analysis'}>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <Card className="p-4 text-center">
                    <p className="text-3xl font-bold text-blue-700">{summary.total_turns}</p>
                    <p className="text-sm text-gray-500">Total de mensajes</p>
                  </Card>
                  <Card className="p-4 text-center">
                    <p className="text-3xl font-bold text-indigo-700">{summary.student_turns}</p>
                    <p className="text-sm text-gray-500">Mensajes del alumno</p>
                  </Card>
                  <Card className="p-4 text-center">
                    <p className="text-3xl font-bold text-purple-700">{aiTurns}</p>
                    <p className="text-sm text-gray-500">Mensajes de la IA</p>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
}

// ─── Componente Principal: SimulationSessionViewer ───────────────────────────
export function SimulationSessionViewer() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [reviewsByInstanceId, setReviewsByInstanceId] = useState<Record<string, RubricReviewSummary>>({});
  const [loading, setLoading] = useState(true);
  const [filterStudent, setFilterStudent] = useState('');
  const [filterCourse, setFilterCourse] = useState('all');
  const [filterType, setFilterType] = useState<'all' | 'evaluation' | 'practice'>('all');
  const [selectedSession, setSelectedSession] = useState<{ id: string; courseId?: string } | null>(null);
  const [refSearch, setRefSearch] = useState('');
  const [refResult, setRefResult] = useState<any>(null);
  const [refLoading, setRefLoading] = useState(false);
  const [refError, setRefError] = useState('');

  const fetchReviews = async () => {
    try {
      const res = await apiClient.get('/rubric-reviews?limit=100&page=1');
      const items: Array<{ simulation_instance_id: string; passed: boolean; total_score: number; max_score: number; reviewed_at: string }> =
        res.data?.data ?? [];
      const map: Record<string, RubricReviewSummary> = {};
      for (const r of items) {
        map[r.simulation_instance_id] = {
          passed: r.passed,
          total_score: r.total_score,
          max_score: r.max_score,
          reviewed_at: r.reviewed_at,
        };
      }
      setReviewsByInstanceId(map);
    } catch {
      setReviewsByInstanceId({});
    }
  };

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/simulation-sessions?limit=100&page=1');
      const raw = res.data;
      setSessions(Array.isArray(raw) ? raw : (raw?.data ?? []));
    } catch { setSessions([]); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchSessions();
    fetchReviews();
  }, []);

  const handleReviewSaved = (instanceId: string, review: RubricReview) => {
    setReviewsByInstanceId((prev) => ({
      ...prev,
      [instanceId]: {
        passed: review.passed,
        total_score: review.total_score,
        max_score: review.max_score,
        reviewed_at: review.reviewed_at,
      },
    }));
  };

  const openSession = (id: string, courseId?: string) => {
    setSelectedSession({ id, courseId });
  };

  const handleRefSearch = async () => {
    if (!refSearch.trim()) return;
    setRefLoading(true);
    setRefError('');
    setRefResult(null);
    try {
      const res = await apiClient.get(`/simulation-sessions/ref/${encodeURIComponent(refSearch.trim())}`);
      setRefResult(res.data);
    } catch { setRefError('Error al buscar la referencia'); }
    finally { setRefLoading(false); }
  };

  const uniqueCourses = [...new Set(sessions.map(s => s.course_title).filter(Boolean))];

  const filtered = sessions.filter(s =>
    (filterStudent === '' || s.student_name.toLowerCase().includes(filterStudent.toLowerCase()) ||
     s.student_email.toLowerCase().includes(filterStudent.toLowerCase())) &&
    (filterCourse === 'all' || s.course_title === filterCourse) &&
    (filterType === 'all' || s.scenario_type === filterType)
  );

  const scoreBadge = (score: number | string | null) => {
    if (score == null || score === '') return <span className="text-xs text-gray-400">—</span>;
    const n = Number(score);
    if (isNaN(n)) return <span className="text-xs text-gray-400">—</span>;
    const cls = n >= 85 ? 'bg-green-100 text-green-800 border-green-300' :
      n >= 70 ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
      'bg-red-100 text-red-800 border-red-300';
    return <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${cls}`}>{n.toFixed(1)}</span>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-purple-600" />
          Visor de Sesiones de Simulación
        </h2>
        <p className="text-gray-600 mt-1">
          Vista exclusiva para Profesores, Administradores y Ministerio.
          Consultá el diálogo completo, los aciertos/errores y la solución propuesta por la IA.
        </p>
      </div>

      {/* ─── Búsqueda por nro de referencia ─── */}
      <Card className="p-4 bg-amber-50 border-amber-200">
        <h3 className="font-semibold text-sm text-amber-800 mb-3 flex items-center gap-2">
          <Hash className="w-4 h-4" /> Búsqueda por Número de Referencia (Auditoría)
        </h3>
        <div className="flex gap-2">
          <input
            value={refSearch}
            onChange={e => setRefSearch(e.target.value)}
            placeholder="REF-2026-P01-T02"
            className="flex-1 px-3 py-2 border rounded-md text-sm font-mono"
            onKeyDown={e => e.key === 'Enter' && handleRefSearch()}
          />
          <Button onClick={handleRefSearch} disabled={refLoading} className="bg-amber-600 hover:bg-amber-700">
            <Search className="w-4 h-4 mr-1" /> {refLoading ? 'Buscando...' : 'Buscar'}
          </Button>
        </div>
        {refError && <p className="text-red-600 text-xs mt-2">{refError}</p>}
        {refResult && (
          <div className="mt-3 bg-white border rounded-lg p-3 text-sm space-y-1">
            <p><span className="font-semibold">Referencia:</span> <span className="font-mono text-amber-700">{refResult.ref_number}</span></p>
            <p><span className="font-semibold">Alumno:</span> {refResult.student_name}</p>
            <p><span className="font-semibold">Escenario:</span> {refResult.scenario_title}</p>
            <p><span className="font-semibold">Turno #:</span> {refResult.turn_number} | <span className="font-semibold">Speaker:</span> {refResult.speaker}</p>
            <p><span className="font-semibold">Mensaje:</span> "{refResult.message_text}"</p>
            {refResult.is_correct !== null && (
              <p>
                <span className="font-semibold">Evaluación:</span>{' '}
                {refResult.is_correct == 1 ? <span className="text-green-700">✅ Correcto</span> : <span className="text-red-700">❌ Incorrecto</span>}
              </p>
            )}
            <Button size="sm" variant="outline" className="mt-2"
              onClick={() => openSession(refResult.simulation_instance_id)}>
              Ver sesión completa
            </Button>
          </div>
        )}
      </Card>

      {/* ─── Filtros ─── */}
      <Card className="p-4 bg-gray-50">
        <div className="flex items-center gap-4 flex-wrap">
          <Filter className="w-4 h-4 text-gray-500" />
          <input
            value={filterStudent}
            onChange={e => setFilterStudent(e.target.value)}
            placeholder="Buscar alumno..."
            className="flex-1 min-w-40 px-3 py-1.5 border rounded-md text-sm"
          />
          <select value={filterCourse} onChange={e => setFilterCourse(e.target.value)}
            className="px-3 py-1.5 border rounded-md text-sm min-w-44">
            <option value="all">Todos los cursos</option>
            {uniqueCourses.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value as any)}
            className="px-3 py-1.5 border rounded-md text-sm">
            <option value="all">Todos los tipos</option>
            <option value="practice">Prácticas</option>
            <option value="evaluation">Evaluaciones</option>
          </select>
        </div>
      </Card>

      {/* ─── Tabla de sesiones ─── */}
      {loading ? (
        <div className="py-12 text-center text-gray-400">Cargando sesiones...</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-4 py-3 text-left">Alumno</th>
                <th className="px-4 py-3 text-left">Curso / Escenario</th>
                <th className="px-4 py-3 text-center">Tipo</th>
                <th className="px-4 py-3 text-center">Score</th>
                <th className="px-4 py-3 text-center">Calificación</th>
                <th className="px-4 py-3 text-center">Aciertos</th>
                <th className="px-4 py-3 text-center">Tiempo</th>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400">Sin sesiones para los filtros aplicados.</td></tr>
              ) : filtered.map(s => (
                <tr key={s.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{s.student_name}</p>
                    <p className="text-xs text-gray-400">{s.student_email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{s.course_title || '—'}</p>
                    <p className="text-xs text-gray-500">{s.scenario_title}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant="outline" className={`text-xs ${s.scenario_type === 'evaluation' ? 'border-purple-300 text-purple-700' : 'border-blue-300 text-blue-700'}`}>
                      {s.scenario_type === 'evaluation' ? '📊 Eval' : '📚 Práctica'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-center">{scoreBadge(s.score)}</td>
                  <td className="px-4 py-3 text-center">
                    <RubricStatusBadge review={reviewsByInstanceId[s.id]} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    {s.total_turns > 0 ? (
                      <div className="flex items-center justify-center gap-1 text-xs">
                        <span className="text-red-600 font-medium">
                          {s.incorrect_turns > 0 ? `❌ ${s.incorrect_turns}` : ''}
                        </span>
                        <span className="text-green-600 font-medium">
                          {(s.total_turns - s.incorrect_turns) > 0 ? `✅ ${s.total_turns - s.incorrect_turns}` : ''}
                        </span>
                      </div>
                    ) : <span className="text-gray-400 text-xs">sin logs</span>}
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-gray-600">
                    {Math.round((s.time_spent_seconds || 0) / 60)} min
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {s.started_at ? new Date(s.started_at).toLocaleDateString('es-AR') : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Button size="sm" variant="outline" onClick={() => openSession(s.id, s.course_id)}
                      className="text-purple-700 border-purple-300 hover:bg-purple-50">
                      <MessageSquare className="w-4 h-4 mr-1" /> Ver
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedSession && (
        <SessionDetailDialog
          instanceId={selectedSession.id}
          courseId={selectedSession.courseId}
          sessions={sessions}
          onClose={() => setSelectedSession(null)}
          onReviewSaved={handleReviewSaved}
        />
      )}
    </div>
  );
}
