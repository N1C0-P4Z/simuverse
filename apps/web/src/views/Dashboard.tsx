'use client'
import { SimulationCalendar } from '@/components/SimulationCalendar';
import { StudentReviewModal } from '@/components/StudentReviewModal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/services/ApiClient';
import { Award, BookOpen, CalendarDays, CheckCircle2, Clock, Eye, GraduationCap, HelpCircle, Lock, MessageSquare, Play, Settings, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface Course {
  id: string;
  title: string;
  description: string | null;
  category: string;
  modules: string[];
  is_active: number;
}

interface Assignment {
  id: number;
  simulation_id: string;
  course_id: string;
  status: string;
}

interface CoursePracticeProgress {
  total: number;
  completed_count: number;
  practices: Array<{
    id: string;
    agent_key: string;
    title: string;
    status: 'locked' | 'available' | 'in_progress' | 'completed';
  }>;
}

const Dashboard = () => {
  const { user, signOut, loading, isAuthenticated, hasRole } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [enrichedAssignments, setEnrichedAssignments] = useState<any[]>([]);
  const [assignmentsLoaded, setAssignmentsLoaded] = useState(false);
  const [reviewModal, setReviewModal] = useState<{ instanceId: string; courseTitle: string } | null>(null);
  const [coursePractices, setCoursePractices] = useState<Record<string, CoursePracticeProgress>>({});

  // Catálogo de inscripción (alumno sin cursos)
  const [catalogQ, setCatalogQ] = useState('');
  const [catalog, setCatalog] = useState<Array<{
    id: string;
    title: string;
    description: string | null;
    tags?: string[];
    requires_password: boolean;
    teachers: Array<{ id: string; name: string; email: string }>;
  }>>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogTag, setCatalogTag] = useState('');
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogTotal, setCatalogTotal] = useState(0);
  const CATALOG_LIMIT = 20;
  const [enrollPasswords, setEnrollPasswords] = useState<Record<string, string>>({});
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [enrollError, setEnrollError] = useState('');
  const [enrollErrorCourseId, setEnrollErrorCourseId] = useState<string | null>(null);
  const [showCatalog, setShowCatalog] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push('/auth');
  }, [isAuthenticated, loading, router]);

  const loadCatalog = async (q = '', tag = catalogTag, page = 1) => {
    setCatalogLoading(true);
    try {
      const res = await apiClient.get('/courses/catalog', {
        params: { q, tag: tag || undefined, page, limit: CATALOG_LIMIT },
      });
      const payload = res.data;
      // Backward-compatible: accept either the paginated shape or a raw array
      const list = Array.isArray(payload) ? payload : (payload?.data ?? []);
      setCatalog(list);
      setCatalogTotal(Array.isArray(payload) ? list.length : (payload?.total ?? list.length));
      setCatalogPage(page);
    } catch {
      setCatalog([]);
      setCatalogTotal(0);
    } finally {
      setCatalogLoading(false);
    }
  };

  const handleEnroll = async (courseId: string, requiresPassword: boolean) => {
    setEnrollError('');
    setEnrollErrorCourseId(null);
    setEnrollingId(courseId);
    try {
      await apiClient.post(`/courses/${courseId}/enroll`, {
        password: requiresPassword ? enrollPasswords[courseId] : undefined,
      });
      setEnrollPasswords((prev) => ({ ...prev, [courseId]: '' }));
      // refresh assignments
      if (user) {
        const assignRes = await apiClient.get(`/assignments?student_id=${user.id}`);
        const assignRaw = assignRes.data;
        const assignList: Assignment[] = Array.isArray(assignRaw) ? assignRaw : (assignRaw?.data ?? []);
        setAssignments(assignList);
        const coursesRes = await apiClient.get('/courses');
        const allCourses: Course[] = coursesRes.data || [];
        const assignedCourseIds = new Set(assignList.map((a: Assignment) => a.course_id));
        setCourses(allCourses.filter((c) => assignedCourseIds.has(c.id)));
        
        setShowCatalog(false);
        toast.success('¡Inscripción exitosa!');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'No se pudo inscribir al curso';
      setEnrollError(msg);
      setEnrollErrorCourseId(courseId);
      toast.error(msg);
    } finally {
      setEnrollingId(null);
    }
  };

  useEffect(() => {
    if (!user || !isAuthenticated) return;

    const fetchData = async () => {
      try {
        // Admin, docentes y ministerio ven todos los cursos directamente
        if (hasRole('admin') || hasRole('teacher') || hasRole('ministerio') || hasRole('supervisor')) {
          const response = await apiClient.get('/courses');
          setCourses(response.data);
          setAssignmentsLoaded(true);
          return;
        }

        // Para alumnos: verificar asignaciones primero
        const [assignRes, coursesRes] = await Promise.all([
          apiClient.get(`/assignments?student_id=${user.id}`).then(r => {
            const raw = r.data;
            return Array.isArray(raw) ? raw : (raw?.data ?? []);
          }),
          apiClient.get('/courses'),
        ]);

        const assignList: Assignment[] = assignRes || [];
        setAssignments(assignList);

        const allCourses: Course[] = coursesRes.data || [];

        if (assignList.length > 0) {
          // Solo mostrar los cursos que tiene asignados
          const assignedCourseIds = new Set(assignList.map((a: Assignment) => a.course_id));
          setCourses(allCourses.filter(c => assignedCourseIds.has(c.id)));
        } else {
          setCourses([]);
          void loadCatalog('');
        }

        // Fetch enriched assignments (con intentos, fechas, score, instance_id)
        try {
          const enrichedRes = await apiClient.get(`/student-assignments/${user.id}`);
          const enriched = enrichedRes.data;
          if (Array.isArray(enriched)) setEnrichedAssignments(enriched);
        } catch { /* silent */ }

        const visibleCourses =
          assignList.length > 0
            ? allCourses.filter((c) => assignList.some((a) => a.course_id === c.id))
            : [];
        if (visibleCourses.length > 0) {
          const entries = await Promise.all(
            visibleCourses.map(async (c) => {
              try {
                const res = await apiClient.get(`/practices/course/${c.id}/progress`);
                return [c.id, res.data as CoursePracticeProgress] as const;
              } catch {
                return [c.id, null] as const;
              }
            }),
          );
          setCoursePractices(
            Object.fromEntries(entries.filter(([, v]) => v != null) as [string, CoursePracticeProgress][]),
          );
        }

        setAssignmentsLoaded(true);
      } catch (error) {
        console.error('Error fetching data:', error);
        setAssignmentsLoaded(true);
      }
    };

    fetchData();
  }, [user, isAuthenticated]);

  if (loading || !assignmentsLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const roleLabels: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    student: { label: 'Estudiante', icon: <GraduationCap className="w-3 h-3" />, color: 'bg-primary/10 text-primary' },
    teacher: { label: 'Profesor', icon: <BookOpen className="w-3 h-3" />, color: 'bg-success/10 text-success' },
    admin: { label: 'Administrador', icon: <Settings className="w-3 h-3" />, color: 'bg-accent/10 text-accent' },
    ministerio: { label: 'Ministerio', icon: <Shield className="w-3 h-3" />, color: 'bg-warning/10 text-warning' },
  };

  const isStudentOnly = hasRole('student') && !hasRole('teacher') && !hasRole('admin') && !hasRole('supervisor');
  const hasNoAssignments = isStudentOnly && assignments.length === 0;
  const displayCatalog = hasNoAssignments || showCatalog;

  return (
    <div className="min-h-screen bg-background">
      {/* Main content */}
      <main className="container mx-auto px-4 py-8">

        {/* ── CASO: alumno sin cursos → buscar e inscribirse ── */}
        {displayCatalog ? (
          <div className="max-w-2xl mx-auto">
            {showCatalog && !hasNoAssignments && (
              <Button 
                variant="ghost" 
                className="mb-4 text-muted-foreground"
                onClick={() => setShowCatalog(false)}
              >
                ← Volver a mis cursos
              </Button>
            )}
            <div className="text-center mb-8">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <GraduationCap className="w-10 h-10 text-primary" />
              </div>
              <h1 className="text-3xl font-bold text-foreground">
                {showCatalog && !hasNoAssignments ? 'Inscribirse a un nuevo curso' : `¡Bienvenido/a, ${user?.name}!`}
              </h1>
              <p className="text-muted-foreground mt-2 text-lg">
                Buscá un curso por nombre o docente e inscribite para comenzar.
              </p>
            </div>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Inscribirse a un curso</CardTitle>
                <CardDescription>
                  Si el curso tiene contraseña, el docente o admin te la compartirá.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Buscar por nombre de curso o docente..."
                    value={catalogQ}
                    onChange={(e) => setCatalogQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void loadCatalog(catalogQ);
                    }}
                  />
                  <Button type="button" onClick={() => loadCatalog(catalogQ)} disabled={catalogLoading}>
                    Buscar
                  </Button>
                </div>

                {enrollError && (
                  <div className="bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2 text-sm text-destructive">
                    {enrollError}
                  </div>
                )}

                {catalogLoading ? (
                  <p className="text-sm text-muted-foreground">Cargando cursos...</p>
                ) : catalog.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No se encontraron cursos activos.</p>
                ) : (
                  <div className="space-y-3">
                    {catalog.map((c) => (
                      <div key={c.id} className="rounded-lg border p-4 space-y-3">
                        <div>
                          <h3 className="font-semibold">{c.title}</h3>
                          {c.description && (
                            <p className="text-sm text-muted-foreground mt-1">{c.description}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-2">
                            Docentes:{' '}
                            {c.teachers.length
                              ? c.teachers.map((t) => t.name).join(', ')
                              : 'Sin docente asignado'}
                            {c.requires_password ? ' · Requiere contraseña' : ' · Acceso libre'}
                          </p>
                          {c.tags && c.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {Array.from(new Set(c.tags)).map((tag, index) => (
                                <button
                                  key={`${tag}-${index}`}
                                  type="button"
                                  onClick={() => { const next = catalogTag === tag ? '' : tag; setCatalogTag(next); loadCatalog(catalogQ, next, 1); }}
                                >
                                  <Badge
                                    variant={catalogTag === tag ? 'default' : 'secondary'}
                                    className="text-xs capitalize cursor-pointer"
                                  >
                                    {tag}
                                  </Badge>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {c.requires_password && (
                          <Input
                            type="password"
                            placeholder="Contraseña del curso"
                            value={enrollPasswords[c.id] || ''}
                            onChange={(e) => {
                              setEnrollPasswords((prev) => ({ ...prev, [c.id]: e.target.value }));
                              if (enrollErrorCourseId === c.id) { setEnrollError(''); setEnrollErrorCourseId(null); }
                            }}
                            className={enrollErrorCourseId === c.id ? 'border-red-500 focus-visible:ring-red-500' : ''}
                          />
                        )}
                        <Button
                          className="w-full"
                          disabled={enrollingId === c.id}
                          onClick={() => handleEnroll(c.id, c.requires_password)}
                        >
                          {enrollingId === c.id ? 'Inscribiendo...' : 'Inscribirme'}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {!catalogLoading && catalogTotal > CATALOG_LIMIT && (
                  <div className="flex items-center justify-between mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={catalogPage <= 1}
                      onClick={() => loadCatalog(catalogQ, catalogTag, catalogPage - 1)}
                    >
                      Anterior
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      Página {catalogPage} de {Math.max(1, Math.ceil(catalogTotal / CATALOG_LIMIT))}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={catalogPage >= Math.ceil(catalogTotal / CATALOG_LIMIT)}
                      onClick={() => loadCatalog(catalogQ, catalogTag, catalogPage + 1)}
                    >
                      Siguiente
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        ) : (
          /* ── CASO NORMAL: mostrar cursos ──────────────────────────────────── */
          <>
            <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">
                  {isStudentOnly
                    ? `Bienvenido, ${user?.name || 'Estudiante'}`
                    : 'Panel de Control'}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {isStudentOnly
                    ? courses.length > 0
                      ? `Tenés ${courses.length} simulación${courses.length !== 1 ? 'es' : ''} asignada${courses.length !== 1 ? 's' : ''}. Hacé click en "Iniciar" para comenzar.`
                      : 'Aquí verás tus simulaciones asignadas.'
                    : 'Gestione cursos y simulaciones'}
                </p>
              </div>
              <Button onClick={() => setShowCatalog(true)}>
                <GraduationCap className="w-4 h-4 mr-2" /> Inscribirse a un nuevo curso
              </Button>
            </div>

            {/* ── Guía paso a paso para alumnos ───────────────────────────────── */}
            {isStudentOnly && courses.length > 0 && (
              <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50/60 dark:bg-blue-950/20 p-4">
                <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-3 flex items-center gap-2 text-sm">
                  <HelpCircle className="w-4 h-4" /> ¿Cómo usar el simulador?
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { icon: BookOpen, title: 'Elegí tu simulación', desc: 'Hacé click en una tarjeta para ver los detalles del escenario asignado.' },
                    { icon: Play, title: 'Iniciá', desc: 'Presioná "Iniciar". El sistema te presentará el contexto del caso a resolver.' },
                    { icon: MessageSquare, title: 'Interactuá', desc: 'Usá el chat con tu asesor, revisá emails y documentos del escenario.' },
                    { icon: Award, title: 'Finalizá', desc: 'Al terminar, el sistema evalúa tu desempeño y genera tu puntaje y certificado.' },
                  ].map(({ icon: Icon, title, desc }, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                          <Icon className="w-4 h-4" /> {title}
                        </p>
                        <p className="text-sm text-blue-700 dark:text-blue-400 mt-0.5 leading-snug">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {courses.length === 0 ? (              <Card className="glass-card">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">No hay cursos disponibles</h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    {hasRole('admin') ? 'Cree un nuevo curso desde el panel de administración.' : 'Contacte a su administrador.'}
                  </p>
                  {hasRole('admin') && (
                    <Button className="mt-4" onClick={() => router.push('/admin')}>
                      <Settings className="w-4 h-4 mr-2" /> Crear Curso
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {courses.map(course => {
                  // Buscar asignación enriquecida para esta course
                  const enriched = enrichedAssignments.find(a => a.course_id === course.id);
                  const attemptsLeft = enriched ? Number(enriched.attempts_remaining ?? 99) : null;
                  const hasScore = enriched && enriched.overall_score !== null && enriched.overall_score !== undefined;
                  const passed = hasScore && Number(enriched.overall_score) >= 70;
                  const calStatus = enriched?.calendar_status;
                  const practiceSummary = coursePractices[course.id];

                  return (
                    <Card
                      key={course.id}
                      className={`flex flex-col h-full glass-card hover:shadow-xl transition-all duration-300 group cursor-pointer ${calStatus === 'expired' ? 'opacity-60' : ''}`}
                      onClick={() => calStatus !== 'expired' && router.push(`/simulation/${course.id}`)}
                    >
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className="text-xs">{course.category}</Badge>
                          <div className="flex items-center gap-1.5">
                            {calStatus === 'expired' && <Badge className="text-xs bg-red-100 text-red-700 border-red-300 border">Vencido</Badge>}
                            {calStatus === 'upcoming' && <Badge className="text-xs bg-purple-100 text-purple-700 border-purple-300 border">Próximo</Badge>}
                            {calStatus === 'completed' && <Badge className="text-xs bg-green-100 text-green-700 border-green-300 border">Completado</Badge>}
                            {course.is_active && !calStatus && <span className="w-2 h-2 rounded-full bg-success animate-pulse" />}
                          </div>
                        </div>
                        <CardTitle className="text-lg mt-2 group-hover:text-primary transition-colors">{course.title}</CardTitle>
                        <CardDescription className="line-clamp-2">{course.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-col flex-1">
                        <div className="flex flex-wrap gap-1 mb-3">
                          {(course.modules as string[])?.slice(0, 3).map((mod: string) => (
                            <Badge key={mod} variant="outline" className="text-xs">{mod}</Badge>
                          ))}
                        </div>
                        {/* Prácticas del curso (progreso secuencial) */}
                        {isStudentOnly && practiceSummary && (
                          <div className="mb-3 space-y-1.5">
                            {practiceSummary.total > 0 ? (
                              <>
                                <p className="text-xs font-medium text-muted-foreground">
                                  Prácticas: {practiceSummary.completed_count}/{practiceSummary.total} completadas
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {practiceSummary.practices.map((p) => (
                                    <Badge
                                      key={p.id}
                                      variant="outline"
                                      className={`text-xs gap-1 ${
                                        p.status === 'completed'
                                          ? 'border-green-300 bg-green-50/50 text-green-700'
                                          : p.status === 'locked'
                                            ? 'opacity-60'
                                            : p.status === 'in_progress'
                                              ? 'border-primary bg-primary/5'
                                              : ''
                                      }`}
                                    >
                                      {p.status === 'locked' && <Lock className="w-3 h-3" />}
                                      {p.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-green-600" />}
                                      {p.agent_key}
                                    </Badge>
                                  ))}
                                </div>
                              </>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                Este curso aún no tiene prácticas configuradas.
                              </p>
                            )}
                          </div>
                        )}
                        {/* Info de intentos / score */}
                        {enriched && (
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-3 bg-muted/40 rounded-md px-2 py-1.5">
                            {attemptsLeft !== null && calStatus !== 'completed' && (
                              <span className={`flex items-center gap-1 ${attemptsLeft === 0 ? 'text-red-600 font-semibold' : ''}`}>
                                <Clock className="w-3 h-3" />
                                {attemptsLeft > 0 ? `${attemptsLeft} intento${attemptsLeft !== 1 ? 's' : ''} restante${attemptsLeft !== 1 ? 's' : ''}` : 'Sin intentos'}
                              </span>
                            )}
                            {hasScore && (
                              <span className={`flex items-center gap-1 font-semibold ${passed ? 'text-green-600' : 'text-orange-600'}`}>
                                {passed ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                {Number(enriched.overall_score).toFixed(0)} pts
                              </span>
                            )}
                            {enriched.end_date && (
                              <span className="flex items-center gap-1">
                                <CalendarDays className="w-3 h-3" />
                                Vto: {new Date(enriched.end_date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="flex gap-2 mt-auto">
                          <Button
                            className="flex-1"
                            variant="default"
                            disabled={calStatus === 'expired' || (attemptsLeft !== null && attemptsLeft === 0)}
                            onClick={e => { e.stopPropagation(); router.push(`/simulation/${course.id}`); }}
                          >
                            <Play className="w-4 h-4 mr-2" /> {calStatus === 'completed' ? 'Re-intentar' : 'Iniciar'}
                          </Button>
                          {/* Botón revisión */}
                          {enriched?.instance_id && (
                            <Button
                              size="icon"
                              variant="outline"
                              title="Revisar mi simulación"
                              onClick={e => { e.stopPropagation(); setReviewModal({ instanceId: enriched.instance_id, courseTitle: course.title }); }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          {/* Botón certificado */}
                          {enriched?.instance_id && passed && (
                            <Button
                              size="icon"
                              variant="outline"
                              title="Ver certificado"
                              className="text-yellow-600 border-yellow-300 hover:bg-yellow-50"
                              onClick={e => { e.stopPropagation(); router.push(`/certificate/${enriched.instance_id}`); }}
                            >
                              <Award className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Mini calendario del alumno */}
            {isStudentOnly && enrichedAssignments.length > 0 && (
              <div className="mt-10">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-primary" />
                  Mi Calendario de Simulaciones
                </h2>
                <SimulationCalendar studentId={user?.id} />
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal de revisión de simulación */}
      {reviewModal && user && (
        <StudentReviewModal
          instanceId={reviewModal.instanceId}
          studentId={user.id}
          courseTitle={reviewModal.courseTitle}
          open={!!reviewModal}
          onClose={() => setReviewModal(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;
