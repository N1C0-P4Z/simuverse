'use client';

/**
 * TeacherSessionsPage — lista sesiones del curso filtradas por alumno,
 * con detalle de mensajes agrupados por hora.
 */
import { SessionRubricPanel, RubricStatusBadge } from '@/components/SimulationSessionViewer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiClient } from '@/services/ApiClient';
import { Bot, ClipboardCheck, Clock, Download, FileText, MessageSquare, Search, User } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

interface SessionRow {
  id: string;
  status: string;
  started_at: string;
  completed_at?: string;
  student_id: string;
  student_name: string;
  student_email: string;
  course_id: string;
  course_title: string;
  scenario_title: string;
  agent_key?: string;
  difficulty?: string;
  total_turns: number;
}

interface HourGroup {
  hour: string;
  messages: Array<{
    id: number;
    turn_number: number;
    speaker: string;
    message: string;
    created_at: string;
  }>;
}

interface SessionSubmission {
  id: string;
  file_name: string;
  file_type: string;
  file_size_bytes: string;
  created_at: string;
  download_url: string;
}

interface SessionDetail {
  instance: SessionRow & { practice_summary?: string; course_id?: string };
  logs_by_hour: HourGroup[];
  summary: { total_turns: number; student_turns: number };
  submissions?: SessionSubmission[];
}

type RubricBadgeState = {
  passed: boolean;
  total_score: number;
  max_score: number;
  reviewed_at: string;
} | null;

export default function TeacherSessionsPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [courses, setCourses] = useState<Array<{ id: string; title: string }>>([]);
  const [courseId, setCourseId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [studentFilter, setStudentFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState('chat');
  const [reviewBySession, setReviewBySession] = useState<Record<string, RubricBadgeState>>({});

  useEffect(() => {
    apiClient.get('/courses/dropdown/list').then((res) => {
      const data = Array.isArray(res.data) ? res.data : [];
      setCourses(data);
    }).catch(() => setCourses([]));
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '100');
      params.set('page', '1');
      if (courseId) params.set('course_id', courseId);
      if (studentId) params.set('student_id', studentId);
      const res = await apiClient.get(`/teacher/sessions?${params.toString()}`);
      const raw = res.data;
      setSessions(Array.isArray(raw) ? raw : (raw?.data ?? []));
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [courseId, studentId]);

  useEffect(() => {
    apiClient
      .get('/rubric-reviews?limit=100')
      .then((res) => {
        const rows = Array.isArray(res.data) ? res.data : (res.data?.data ?? []);
        const map: Record<string, RubricBadgeState> = {};
        for (const r of rows) {
          if (!r?.simulation_instance_id) continue;
          map[r.simulation_instance_id] = {
            passed: !!r.passed,
            total_score: Number(r.total_score) || 0,
            max_score: Number(r.max_score) || 0,
            reviewed_at: r.reviewed_at,
          };
        }
        setReviewBySession(map);
      })
      .catch(() => {});
  }, [courseId, studentId, sessions.length]);

  const studentOptions = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; email: string }>();
    for (const s of sessions) {
      if (!byId.has(s.student_id)) {
        byId.set(s.student_id, {
          id: s.student_id,
          name: s.student_name,
          email: s.student_email,
        });
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [sessions]);

  const filtered = useMemo(() => {
    const q = studentFilter.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(
      (s) =>
        s.student_name?.toLowerCase().includes(q) ||
        s.student_email?.toLowerCase().includes(q),
    );
  }, [sessions, studentFilter]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setDetailTab('chat');
    try {
      const res = await apiClient.get(`/teacher/sessions/${id}`);
      setDetail(res.data);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Sesiones de alumnos</h1>
        <p className="text-muted-foreground mt-1">
          Revisá el chat de prácticas por curso y alumno. Mensajes agrupados por hora.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="min-w-[220px]">
          <label className="text-sm font-medium">Curso</label>
          <select
            className="w-full mt-1 border rounded-md p-2"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
          >
            <option value="">Todos</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[220px]">
          <label className="text-sm font-medium">Alumno</label>
          <select
            className="w-full mt-1 border rounded-md p-2"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          >
            <option value="">Todos</option>
            {studentOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className="text-sm font-medium">Buscar alumno</label>
          <div className="relative mt-1">
            <Search className="w-4 h-4 absolute left-2 top-2.5 text-gray-400" />
            <Input
              className="pl-8"
              placeholder="Nombre o email..."
              value={studentFilter}
              onChange={(e) => setStudentFilter(e.target.value)}
            />
          </div>
        </div>
        <Button variant="outline" onClick={loadSessions}>
          Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <MessageSquare className="w-4 h-4" /> Sesiones ({filtered.length})
          </h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay sesiones.</p>
          ) : (
            <ul className="space-y-2 max-h-[70vh] overflow-y-auto">
              {filtered.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => openDetail(s.id)}
                    className="w-full text-left border rounded-md p-3 hover:bg-muted/50 transition"
                  >
                    <div className="flex justify-between gap-2 items-start">
                      <span className="font-medium">{s.student_name}</span>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline">{s.status}</Badge>
                        <RubricStatusBadge review={reviewBySession[s.id] ?? null} />
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {s.course_title} · {s.agent_key || s.scenario_title} ·{' '}
                      {s.total_turns} mensajes
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(s.started_at).toLocaleString()}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Detalle
          </h2>
          {detailLoading && (
            <p className="text-sm text-muted-foreground">Cargando detalle...</p>
          )}
          {!detailLoading && !detail && (
            <p className="text-sm text-muted-foreground">
              Seleccioná una sesión para ver el chat.
            </p>
          )}
          {detail && (
            <div className="space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <p className="font-medium">{detail.instance.student_name}</p>
                <p className="text-xs text-muted-foreground">
                  {detail.instance.course_title} ·{' '}
                  {detail.instance.agent_key || detail.instance.scenario_title}
                </p>
                <p className="text-xs mt-1">
                  {detail.summary.total_turns} mensajes · {detail.summary.student_turns} del
                  alumno
                </p>
                {detail.instance.practice_summary && (
                  <p className="text-sm mt-2 bg-muted/40 p-2 rounded">
                    {detail.instance.practice_summary}
                  </p>
                )}
              </div>

              <Tabs value={detailTab} onValueChange={setDetailTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="chat" className="gap-1">
                    <MessageSquare className="w-3.5 h-3.5" /> Chat
                  </TabsTrigger>
                  <TabsTrigger
                    value="rubric"
                    className="gap-1 bg-blue-600 text-white hover:bg-blue-700 hover:text-white data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=inactive]:bg-blue-600 data-[state=inactive]:text-white"
                  >
                    <ClipboardCheck className="w-3.5 h-3.5" /> Calificar
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="chat" className="mt-3 space-y-4" forceMount hidden={detailTab !== 'chat'}>
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Entregas ({detail.submissions?.length ?? 0})
                    </h3>
                    {!detail.submissions?.length ? (
                      <p className="text-xs text-muted-foreground">Sin archivos subidos en esta sesión.</p>
                    ) : (
                      <ul className="space-y-2">
                        {detail.submissions.map((f) => (
                          <li
                            key={f.id}
                            className="flex items-center justify-between gap-2 border rounded-md px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{f.file_name}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {f.file_type} · {Math.round(Number(f.file_size_bytes) / 1024)} KB ·{' '}
                                {new Date(f.created_at).toLocaleString('es-AR')}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="shrink-0"
                              onClick={async () => {
                                try {
                                  const res = await apiClient.get(f.download_url, {
                                    responseType: 'blob',
                                  } as any);
                                  const blob = new Blob([res.data]);
                                  const url = URL.createObjectURL(blob);
                                  const a = Object.assign(document.createElement('a'), {
                                    href: url,
                                    download: f.file_name,
                                  });
                                  a.click();
                                  URL.revokeObjectURL(url);
                                } catch {
                                  toast.error('No se pudo descargar el archivo');
                                }
                              }}
                            >
                              <Download className="w-4 h-4 mr-1" /> Descargar
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {(detail.logs_by_hour || []).map((group) => (
                    <div key={group.hour} className="space-y-2">
                      <div className="sticky top-0 bg-background/90 text-xs font-semibold text-muted-foreground py-1 border-b">
                        {new Date(group.hour).toLocaleString()}
                      </div>
                      {group.messages.map((m) => {
                        const isAi = m.speaker === 'ai' || m.speaker === 'system';
                        return (
                          <div
                            key={m.id}
                            className={`flex gap-2 ${isAi ? '' : 'flex-row-reverse'}`}
                          >
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center ${
                                isAi ? 'bg-violet-100' : 'bg-sky-100'
                              }`}
                            >
                              {isAi ? (
                                <Bot className="w-3.5 h-3.5 text-violet-700" />
                              ) : (
                                <User className="w-3.5 h-3.5 text-sky-700" />
                              )}
                            </div>
                            <div
                              className={`max-w-[80%] text-sm rounded-lg px-3 py-2 ${
                                isAi ? 'bg-muted' : 'bg-sky-50'
                              }`}
                            >
                              {m.message}
                              <div className="text-[10px] text-muted-foreground mt-1">
                                {new Date(m.created_at).toLocaleTimeString()}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="rubric" className="mt-3" forceMount hidden={detailTab !== 'rubric'}>
                  <SessionRubricPanel
                    instanceId={detail.instance.id}
                    courseId={detail.instance.course_id ?? null}
                    onReviewSaved={(review) => {
                      setReviewBySession((prev) => ({
                        ...prev,
                        [detail.instance.id]: {
                          passed: review.passed,
                          total_score: review.total_score,
                          max_score: review.max_score,
                          reviewed_at: review.reviewed_at,
                        },
                      }));
                      setDetailTab('chat');
                    }}
                  />
                </TabsContent>
              </Tabs>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
