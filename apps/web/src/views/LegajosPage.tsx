'use client'
/**
 * LegajosPage — Lista de alumnos con acceso a sus legajos individuales
 * Accesible para: admin, teacher, ministerio (con permiso)
 * Ruta: /legajos
 */
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import {
    AlertCircle, BarChart3,
    ChevronRight,
    Clock,
    FileText,
    GraduationCap, Search,
    XCircle,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { apiClient } from '@/services/ApiClient';
import { getScoreBarColor, getScoreText } from '@/lib/score-colors';

interface StudentSummary {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
  total_simulations: string | number;
  completed_simulations: string | number;
  total_evaluations: string | number;
  best_score: string | number | null;
  avg_score: string | number | null;
  last_activity: string | null;
}

const LegajosPage = () => {
  const { user, loading, hasRole } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'activity' | 'score'>('activity');
  const [courseFilter, setCourseFilter] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');
  const [courses, setCourses] = useState<Array<{ id: string; title: string }>>([]);
  const [teachers, setTeachers] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (!loading && user && !hasRole('admin') && !hasRole('teacher') && !hasRole('ministerio') && !hasRole('supervisor')) {
      router.push('/auth');
    }
  }, [user, loading, hasRole, router]);

  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams();
    if (courseFilter) params.set('course_id', courseFilter);
    if (teacherFilter) params.set('teacher_id', teacherFilter);
    const qs = params.toString();
    apiClient.get(`/legajo/students${qs ? `?${qs}` : ''}`)
      .then(r => r.data)
      .then(data => {
        if (Array.isArray(data)) setStudents(data);
        else if (data.error) setError(data.error);
        setFetching(false);
      })
      .catch(err => {
        setError(err.message || 'Error al cargar alumnos');
        setFetching(false);
      });
  }, [user, courseFilter, teacherFilter]);

  // Fetch courses and teachers for filter dropdowns
  useEffect(() => {
    if (!user) return;
    apiClient.get('/courses').then(r => {
      const list = Array.isArray(r.data) ? r.data : [];
      setCourses(list.map((c: any) => ({ id: c.id, title: c.title })));
    }).catch(() => {});
    apiClient.get('/users', { params: { role: 'teacher' } }).then(r => {
      const list = Array.isArray(r.data) ? r.data : [];
      setTeachers(list.map((t: any) => ({ id: t.id, name: t.name })));
    }).catch(() => {});
  }, [user]);

  const n = (v: string | number | null) => (v === null || v === undefined ? 0 : Number(v));

  const filtered = students
    .filter(s =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'score') return n(b.avg_score) - n(a.avg_score);
      // activity: most recent first
      if (!a.last_activity && !b.last_activity) return 0;
      if (!a.last_activity) return 1;
      if (!b.last_activity) return -1;
      return new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime();
    });

  const scoreColor = (v: number | null) =>
    v === null ? '' : getScoreText(v);

  if (loading || fetching) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center py-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-16 text-center">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <p className="text-destructive font-semibold text-lg mb-2">Acceso denegado</p>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => {
            if (hasRole('admin')) router.push('/admin/mis-cursos');
            else if (hasRole('teacher') || hasRole('supervisor')) router.push('/profesor/cursos');
            else if (hasRole('ministerio')) router.push('/ministerio');
            else router.push('/estudiante/cursos');
          }}>Volver al inicio</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold">Legajos de Alumnos</h1>
          <p className="text-muted-foreground text-sm">
            {students.length} alumno{students.length !== 1 ? 's' : ''} registrado{students.length !== 1 ? 's' : ''}
          </p>
        </div>
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={sortBy} onValueChange={v => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-44 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="activity">Última actividad</SelectItem>
              <SelectItem value="name">Nombre (A-Z)</SelectItem>
              <SelectItem value="score">Mejor puntaje</SelectItem>
            </SelectContent>
          </Select>
          <Select value={courseFilter} onValueChange={v => setCourseFilter(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-48 shrink-0">
              <SelectValue placeholder="Todos los cursos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los cursos</SelectItem>
              {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={teacherFilter} onValueChange={v => setTeacherFilter(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-48 shrink-0">
              <SelectValue placeholder="Todos los docentes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los docentes</SelectItem>
              {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {search && (
            <Badge variant="outline" className="shrink-0">
              {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {/* Summary bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            {
              label: 'Alumnos totales',
              value: students.length,
              icon: GraduationCap,
              color: 'text-blue-600',
            },
            {
              label: 'Con simulaciones',
              value: students.filter(s => n(s.total_simulations) > 0).length,
              icon: BarChart3,
              color: 'text-purple-600',
            },
            {
              label: 'Sin actividad',
              value: students.filter(s => !s.last_activity).length,
              icon: XCircle,
              color: 'text-muted-foreground',
            },
          ].map(stat => (
            <Card key={stat.label} className="glass-card">
              <CardContent className="pt-4 pb-3 flex items-center gap-3">
                <stat.icon className={`w-6 h-6 ${stat.color} shrink-0`} />
                <div>
                  <p className="text-2xl font-bold leading-none">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Student grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-40" />
            <p className="text-lg font-medium">
              {search ? 'No se encontraron alumnos con ese criterio' : 'No hay alumnos registrados'}
            </p>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alumno</TableHead>
                  <TableHead className="text-center">Sims.</TableHead>
                  <TableHead className="text-center">Eval.</TableHead>
                  <TableHead className="text-center">Prom.</TableHead>
                  <TableHead>Mejor puntaje</TableHead>
                  <TableHead>Última actividad</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(student => {
                  const sims = n(student.total_simulations);
                  const evals = n(student.total_evaluations);
                  const avg = student.avg_score !== null ? n(student.avg_score) : null;
                  const best = student.best_score !== null ? n(student.best_score) : null;

                  return (
                    <TableRow
                      key={student.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => router.push(`/student-ledger/${student.id}`)}
                    >
                      <TableCell>
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{student.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{student.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-medium">{sims}</TableCell>
                      <TableCell className="text-center font-medium">{evals}</TableCell>
                      <TableCell className={`text-center font-medium ${scoreColor(avg)}`}>
                        {avg !== null ? avg.toFixed(0) : '—'}
                      </TableCell>
                      <TableCell>
                        {best !== null ? (
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${getScoreBarColor(best)}`}
                                style={{ width: `${best}%` }}
                              />
                            </div>
                            <span className={`text-xs font-semibold ${scoreColor(best)}`}>{best}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3 shrink-0" />
                          {student.last_activity
                            ? new Date(student.last_activity).toLocaleDateString('es-AR')
                            : 'Sin actividad'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Footer note */}
        <p className="text-xs text-muted-foreground text-center mt-10 flex items-center justify-center gap-1">
          <FileText className="w-3 h-3" />
          Los legajos son documentos confidenciales. Acceso restringido según permisos de rol.
        </p>
      </main>
    </div>
  );
};

export default LegajosPage;
