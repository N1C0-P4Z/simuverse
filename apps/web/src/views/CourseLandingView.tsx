'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/services/ApiClient';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Building2,
  CheckCircle2,
  Loader,
  Lock,
  Mail,
  Play,
  AlertTriangle,
  Table2,
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

type LandingInstitution = {
  id: number;
  name: string;
  logo_url?: string | null;
  website?: string | null;
  short_name?: string | null;
};

type LandingData = {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  category: string;
  tags: string[];
  requires_password: boolean;
  is_enrolled: boolean;
  teachers: Array<{ id: string; name: string; email: string }>;
  sponsors: LandingInstitution[];
  endorsers: LandingInstitution[];
  tech_sheet: null | {
    id: number;
    name: string;
    analyzed: boolean;
    competencies: Array<{ name: string; description: string | null; level: string }>;
    tasks: Array<{
      title: string;
      description: string | null;
      difficulty: string;
      sequence: number;
      expected_duration_minutes?: number;
    }>;
    content: {
      emails: any[];
      spreadsheet: any;
      crisis: any[];
    };
  };
};

function InstitutionCard({
  item,
  kind,
}: {
  item: LandingInstitution;
  kind: 'patrocinador' | 'auspiciante';
}) {
  const label = item.short_name || item.name;
  const inner = (
    <div className="flex flex-col items-center justify-center gap-2 text-center">
      <div className="relative h-16 w-24 shrink-0 overflow-hidden flex items-center justify-center">
        {item.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.logo_url} alt={label} className="h-full w-full object-contain" />
        ) : (
          <Building2 className="h-8 w-8 text-primary" />
        )}
      </div>
      <div className="min-w-0 w-full">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
          {kind === 'patrocinador' ? 'Patrocinador' : 'Auspiciante'}
        </p>
        <p className="font-semibold text-sm truncate">{label}</p>
      </div>
    </div>
  );

  if (item.website) {
    return (
      <a href={item.website} target="_blank" rel="noopener noreferrer" className="block hover:opacity-90 transition">
        {inner}
      </a>
    );
  }
  return inner;
}

function getCoursesHomePath(role?: string): string {
  if (role === 'admin') return '/admin/mis-cursos';
  if (role === 'teacher' || role === 'supervisor') return '/profesor/cursos';
  return '/estudiante/cursos';
}

const CourseLandingView = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();
  const { loading: authLoading, isAuthenticated, user } = useAuth();
  const coursesHome = getCoursesHomePath(user?.role);
  const [data, setData] = useState<LandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState('');

  const loadLanding = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    try {
      const res = await apiClient.get(`/courses/${courseId}/landing`);
      setData(res.data);
    } catch {
      toast.error('No se pudo cargar la información del curso');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/auth');
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated && courseId) void loadLanding();
  }, [isAuthenticated, courseId, loadLanding]);

  const handleEnroll = async () => {
    if (!data) return;
    setEnrollError('');
    setEnrolling(true);
    try {
      await apiClient.post(`/courses/${data.id}/enroll`, {
        password: data.requires_password ? password : undefined,
      });
      toast.success('¡Inscripción exitosa!');
      await loadLanding();
    } catch (err: any) {
      const status = err?.response?.status;
      const msg =
        err?.response?.data?.message ||
        (status === 409 ? 'Ya estás inscrito' : 'No se pudo completar la inscripción');
      const text = Array.isArray(msg) ? msg.join(', ') : String(msg);
      setEnrollError(text);
      toast.error(text);
    } finally {
      setEnrolling(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-12 text-center space-y-4">
        <p className="text-muted-foreground">Curso no encontrado.</p>
        <Button variant="outline" onClick={() => router.push(coursesHome)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver a mis cursos
        </Button>
      </div>
    );
  }

  const sheet = data.tech_sheet;
  const institutions = [
    ...data.sponsors.map((s) => ({ item: s, kind: 'patrocinador' as const })),
    ...data.endorsers.map((e) => ({ item: e, kind: 'auspiciante' as const })),
  ];
  const emails = Array.isArray(sheet?.content?.emails) ? sheet!.content.emails : [];
  const crisis = Array.isArray(sheet?.content?.crisis) ? sheet!.content.crisis : [];
  const spreadsheet = sheet?.content?.spreadsheet ?? null;
  const hasContent = emails.length > 0 || spreadsheet != null || crisis.length > 0;
  const hasAnalyzed = !!sheet?.analyzed;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-blue-700 text-white">
        <div className="container mx-auto px-4 py-6 sm:py-10">
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 text-white/80 hover:text-white hover:bg-white/10"
            onClick={() => router.push(coursesHome)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
          </Button>
          <div className="flex flex-wrap gap-2 mb-3">
            {data.category && (
              <Badge className="bg-sky-400/20 text-sky-100 border-sky-300/30 hover:bg-sky-400/30">
                {data.category}
              </Badge>
            )}
            {data.tags
              .filter((t) => t.toLowerCase() !== data.category.toLowerCase())
              .slice(0, 4)
              .map((tag) => (
                <Badge key={tag} variant="outline" className="border-white/30 text-white/90">
                  {tag}
                </Badge>
              ))}
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold uppercase tracking-tight max-w-4xl">
            {data.title}
          </h1>
          {data.teachers.length > 0 && (
            <p className="mt-3 text-sm text-white/70">
              Docentes: {data.teachers.map((t) => t.name).join(', ')}
            </p>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="rounded-2xl shadow-sm border-0">
              <CardContent className="pt-6">
                <Tabs defaultValue="info" className="w-full">
                  <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-transparent p-0 mb-4 border-b rounded-none">
                    {[
                      ['info', 'Info'],
                      ['competencias', 'Competencias'],
                      ['tareas', 'Tareas'],
                      ['contenido', 'Contenido'],
                    ].map(([value, label]) => (
                      <TabsTrigger
                        key={value}
                        value={value}
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-emerald-500 data-[state=active]:bg-transparent data-[state=active]:shadow-none uppercase text-xs tracking-wide px-3"
                      >
                        {label}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  <TabsContent value="info" className="mt-0 space-y-3">
                    <h2 className="text-lg font-semibold">Sobre el curso</h2>
                    <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                      {data.description || 'Este curso aún no tiene una descripción configurada.'}
                    </p>
                  </TabsContent>

                  <TabsContent value="competencias" className="mt-0 space-y-3">
                    <h2 className="text-lg font-semibold">Competencias</h2>
                    {!hasAnalyzed || !sheet?.competencies?.length ? (
                      <p className="text-sm text-muted-foreground">
                        {sheet
                          ? 'La ficha técnica aún no tiene competencias analizadas.'
                          : 'Este curso no tiene ficha técnica analizada. Solo se muestra la descripción del curso.'}
                      </p>
                    ) : (
                      <ul className="space-y-3">
                        {sheet.competencies.map((c, i) => (
                          <li key={`${c.name}-${i}`} className="rounded-xl border bg-white p-4">
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-medium">{c.name}</p>
                              {c.level && (
                                <Badge variant="secondary" className="capitalize shrink-0">
                                  {c.level}
                                </Badge>
                              )}
                            </div>
                            {c.description && (
                              <p className="text-sm text-muted-foreground mt-1">{c.description}</p>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </TabsContent>

                  <TabsContent value="tareas" className="mt-0 space-y-3">
                    <h2 className="text-lg font-semibold">Tareas</h2>
                    {!hasAnalyzed || !sheet?.tasks?.length ? (
                      <p className="text-sm text-muted-foreground">
                        {sheet
                          ? 'La ficha técnica aún no tiene tareas analizadas.'
                          : 'Este curso no tiene ficha técnica analizada.'}
                      </p>
                    ) : (
                      <ol className="space-y-3">
                        {sheet.tasks.map((t, i) => (
                          <li key={`${t.title}-${i}`} className="rounded-xl border bg-white p-4">
                            <div className="flex items-start gap-3">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                {t.sequence ?? i + 1}
                              </span>
                              <div className="min-w-0">
                                <p className="font-medium">{t.title}</p>
                                {t.description && (
                                  <p className="text-sm text-muted-foreground mt-1">{t.description}</p>
                                )}
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {t.difficulty && (
                                    <Badge variant="outline" className="capitalize text-xs">
                                      {t.difficulty}
                                    </Badge>
                                  )}
                                  {t.expected_duration_minutes ? (
                                    <Badge variant="secondary" className="text-xs">
                                      {t.expected_duration_minutes} min
                                    </Badge>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </TabsContent>

                  <TabsContent value="contenido" className="mt-0 space-y-4">
                    <h2 className="text-lg font-semibold">Contenido</h2>
                    {!hasAnalyzed || !hasContent ? (
                      <p className="text-sm text-muted-foreground">
                        {sheet
                          ? 'Todavía no hay contenido generado a partir de la ficha técnica.'
                          : 'Este curso no tiene ficha técnica analizada.'}
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {emails.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                              <Mail className="h-4 w-4 text-primary" /> Correos de práctica
                            </h3>
                            <ul className="space-y-2">
                              {emails.map((email: any, i: number) => (
                                <li key={i} className="rounded-lg border p-3 text-sm">
                                  <p className="font-medium">
                                    {email.asunto || email.subject || email.titulo || `Correo ${i + 1}`}
                                  </p>
                                  {(email.resumen || email.preview || email.cuerpo || email.body) && (
                                    <p className="text-muted-foreground mt-1 line-clamp-3">
                                      {email.resumen || email.preview || email.cuerpo || email.body}
                                    </p>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {spreadsheet && (
                          <div>
                            <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                              <Table2 className="h-4 w-4 text-primary" /> Planilla
                            </h3>
                            <div className="rounded-lg border p-3 text-sm">
                              {Array.isArray(spreadsheet.columnas || spreadsheet.columns) ? (
                                <p>
                                  Columnas:{' '}
                                  {(spreadsheet.columnas || spreadsheet.columns)
                                    .map((c: any) => (typeof c === 'string' ? c : c.nombre || c.name))
                                    .filter(Boolean)
                                    .join(', ')}
                                </p>
                              ) : (
                                <p className="text-muted-foreground">Planilla de práctica disponible en la simulación.</p>
                              )}
                            </div>
                          </div>
                        )}
                        {crisis.length > 0 && (
                          <div>
                            <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
                              <AlertTriangle className="h-4 w-4 text-primary" /> Situaciones de crisis
                            </h3>
                            <ul className="space-y-2">
                              {crisis.map((item: any, i: number) => (
                                <li key={i} className="rounded-lg border p-3 text-sm">
                                  <p className="font-medium">
                                    {item.detonante || item.titulo || item.title || `Crisis ${i + 1}`}
                                  </p>
                                  {(item.descripcion || item.description) && (
                                    <p className="text-muted-foreground mt-1">
                                      {item.descripcion || item.description}
                                    </p>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Instituciones — priority block */}
            <section className="rounded-2xl bg-gradient-to-br from-blue-50 to-slate-50 border border-blue-100 p-5 sm:p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-1.5 h-8 rounded-full bg-blue-600" />
                <h2 className="text-xl sm:text-2xl font-bold text-blue-900">
                  Patrocinadores que hacen posible este curso
                </h2>
              </div>
              {institutions.length === 0 ? (
                <Card className="rounded-2xl border-dashed bg-white/80">
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    Este curso aún no tiene patrocinadores ni auspiciantes asignados.
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                  {institutions.map(({ item, kind }) => (
                    <InstitutionCard key={`${kind}-${item.id}`} item={item} kind={kind} />
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Sidebar CTA */}
          <aside className="lg:col-span-4 lg:sticky lg:top-24">
            <div className="rounded-2xl overflow-hidden shadow-md bg-[#e8f4f0]">
              <div className="bg-blue-700 text-white px-5 py-3 font-semibold tracking-wide text-sm flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {data.is_enrolled ? 'YA ESTÁS INSCRITO' : 'INSCRIPCIONES ABIERTAS'}
              </div>

              <div className="p-5 space-y-4">
                {data.is_enrolled ? (
                  <>
                    <div className="flex items-start gap-2 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                      <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                      <p>Ya estás inscrito a este curso. Podés entrar a la práctica cuando quieras.</p>
                    </div>
                    <Button
                      className="w-full bg-blue-700 hover:bg-blue-800"
                      onClick={() => router.push(`/simulation/${data.id}`)}
                    >
                      <Play className="mr-2 h-4 w-4" /> Ir a la práctica
                    </Button>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="font-bold text-lg text-slate-900">¡Inscribite a este curso!</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Completá la inscripción para empezar a practicar.
                        {data.requires_password
                          ? ' Este curso requiere la contraseña que te compartió tu docente.'
                          : ''}
                      </p>
                    </div>

                    {data.requires_password && (
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase text-slate-600 flex items-center gap-1">
                          <Lock className="h-3.5 w-3.5" /> Contraseña del curso
                        </label>
                        <Input
                          type="password"
                          placeholder="Ingresá la contraseña"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            setEnrollError('');
                          }}
                          className={enrollError ? 'border-red-500 focus-visible:ring-red-500 bg-white' : 'bg-white'}
                        />
                      </div>
                    )}

                    {enrollError && (
                      <div className="bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2 text-sm text-destructive">
                        {enrollError}
                      </div>
                    )}

                    <Button
                      className="w-full bg-blue-700 hover:bg-blue-800"
                      disabled={enrolling || (data.requires_password && !password)}
                      onClick={() => void handleEnroll()}
                    >
                      {enrolling ? (
                        <>
                          <Loader className="mr-2 h-4 w-4 animate-spin" /> Inscribiendo...
                        </>
                      ) : (
                        <>
                          Inscribime a este curso <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </>
                )}

                {sheet?.name && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 pt-2 border-t">
                    <BookOpen className="h-3.5 w-3.5" />
                    Ficha: {sheet.name}
                  </p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default CourseLandingView;
