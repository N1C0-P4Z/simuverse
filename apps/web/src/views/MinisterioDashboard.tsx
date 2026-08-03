'use client'
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/services/ApiClient';
import { ArrowRight, BookOpen, ClipboardList, FileText, Shield, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface MinistryRequirement {
  id: string;
  course_id: string;
  file_name: string;
  status: string;
  kpis_generated: number;
  tasks_generated: number;
  is_active: boolean;
}

interface KPI {
  id: string;
  course_id: string;
  ministry_requirement_id: string;
  name: string;
  category: string;
  weight: number;
  target_value: number;
  minimum_pass_value: number;
  is_active: boolean;
}

interface Course {
  id: string;
  title: string;
  category: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  uploaded: { label: 'Cargado', color: 'bg-blue-100 text-blue-800' },
  processing: { label: 'Procesando', color: 'bg-yellow-100 text-yellow-800' },
  extracted: { label: 'Extraído', color: 'bg-purple-100 text-purple-800' },
  active: { label: 'Activo', color: 'bg-green-100 text-green-800' },
  archived: { label: 'Archivado', color: 'bg-gray-100 text-gray-800' },
};

export default function MinisterioDashboard() {
  const { user, hasRole, loading } = useAuth();
  const router = useRouter();
  const [reqs, setReqs] = useState<MinistryRequirement[]>([]);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const getCourseTitle = (courseId: string) =>
    courses.find(c => c.id === courseId)?.title || courseId;

  const getCourseCategory = (courseId: string) =>
    courses.find(c => c.id === courseId)?.category || '';

  useEffect(() => {
    if (!loading && (!user || !hasRole('ministerio'))) {
      router.push('/auth');
      return;
    }
    if (!user) return;

    Promise.all([
      apiClient.get('/ministry/requirements'),
      apiClient.get('/ministry/kpis'),
      apiClient.get('/courses'),
    ])
      .then(([r, k, c]) => {
        const reqsRaw = r.data;
        const kpisRaw = k.data;
        setReqs(Array.isArray(reqsRaw) ? reqsRaw : (reqsRaw?.data ?? []));
        setKpis(Array.isArray(kpisRaw) ? kpisRaw : (kpisRaw?.data ?? []));
        setCourses(Array.isArray(c.data) ? c.data : []);
      })
      .catch(() => {})
      .finally(() => setLoadingData(false));
  }, [user, loading, hasRole, router]);

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const activeReqs = reqs.filter(r => r.is_active);
  const activeKpis = kpis.filter(k => k.is_active);
  const kpisByCourse = activeKpis.reduce((acc, kpi) => {
    if (!acc[kpi.course_id]) acc[kpi.course_id] = [];
    acc[kpi.course_id].push(kpi);
    return acc;
  }, {} as Record<string, KPI[]>);

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <Shield className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Panel de Ministerio</h1>
              <p className="text-muted-foreground text-sm">Auditoría y trazabilidad de simulaciones</p>
            </div>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Requisitos Activos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{activeReqs.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Fichas técnicas cargadas</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">KPIs Definidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{activeKpis.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Indicadores de evaluación</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cursos Vinculados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{Object.keys(kpisByCourse).length}</div>
              <p className="text-xs text-muted-foreground mt-1">Con requisitos activos</p>
            </CardContent>
          </Card>
        </div>

        {/* Requirements list */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              <CardTitle>Requisitos Ministeriales</CardTitle>
            </div>
            <CardDescription>Fichas técnicas cargadas para cada curso</CardDescription>
          </CardHeader>
          <CardContent>
            {activeReqs.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">No hay requisitos activos.</p>
            ) : (
              <div className="space-y-3">
                {activeReqs.map(req => (
                  <div key={req.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{req.file_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs capitalize">
                          {getCourseTitle(req.course_id)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {getCourseCategory(req.course_id)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-4 shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{req.kpis_generated} KPIs</p>
                        <p className="text-xs text-muted-foreground">{req.tasks_generated} tareas</p>
                      </div>
                      <Badge className={STATUS_LABELS[req.status]?.color || 'bg-gray-100'}>
                        {STATUS_LABELS[req.status]?.label || req.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* KPIs by course */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <CardTitle>KPIs por Curso</CardTitle>
            </div>
            <CardDescription>Indicadores de evaluación definidos por requisito ministerial</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(kpisByCourse).length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">No hay KPIs definidos.</p>
            ) : (
              <div className="space-y-6">
                {Object.entries(kpisByCourse).map(([courseId, courseKpis]) => (
                  <div key={courseId}>
                    <div className="flex items-center gap-2 mb-3">
                      <BookOpen className="w-4 h-4 text-primary" />
                      <h3 className="font-semibold text-sm">{getCourseTitle(courseId)}</h3>
                      <Badge variant="secondary" className="text-xs">{courseKpis.length} KPIs</Badge>
                    </div>
                    <div className="space-y-2 pl-0">
                      {courseKpis.map(kpi => (
                        <div key={kpi.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{kpi.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {kpi.category === 'hard_skills' ? 'Habilidad Técnica' : 'Habilidad Blanda'}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                Peso: {(Number(kpi.weight) * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-4">
                            <p className="text-sm font-semibold">Target: {Number(kpi.target_value)}%</p>
                            <p className="text-xs text-muted-foreground">Min: {Number(kpi.minimum_pass_value)}%</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick links */}
        <div className="grid grid-cols-1 gap-4">
          <Button
            variant="outline"
            className="h-auto py-6 justify-between"
            onClick={() => router.push('/ministerio/legajos')}
          >
            <div className="flex items-center gap-3">
              <ClipboardList className="w-5 h-5 text-primary" />
              <div className="text-left">
                <p className="font-semibold">Legajos</p>
                <p className="text-xs text-muted-foreground">Trazabilidad de alumnos</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </main>
    </div>
  );
}
