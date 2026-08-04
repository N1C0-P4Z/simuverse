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
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { usePagination } from '@/hooks/usePagination';
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
  const { data: students, total, page, totalPages, setPage, setExtraParams, loading: fetching, error } = usePagination<StudentSummary>({
    endpoint: '/legajo/students',
  });
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'activity' | 'score'>('activity');

  useEffect(() => {
    if (!loading && user && !hasRole('admin') && !hasRole('teacher') && !hasRole('ministerio') && !hasRole('supervisor')) {
      router.push('/auth');
    }
  }, [user, loading, hasRole, router]);

  // Server-side search via debounced setExtraParams
  useEffect(() => {
    const timer = setTimeout(() => {
      const params: Record<string, unknown> = {};
      if (search) params.search = search;
      setExtraParams(params);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, setExtraParams]);

  const n = (v: string | number | null) => (v === null || v === undefined ? 0 : Number(v));

  // Client-side sort on current page only (server handles search/filtering)
  const sorted = [...students].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'score') return n(b.avg_score) - n(a.avg_score);
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
            {total} alumno{total !== 1 ? 's' : ''} registrado{total !== 1 ? 's' : ''}
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
          {search && (
            <Badge variant="outline" className="shrink-0">
              {total} resultado{total !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>

        {/* Summary bar — total uses server count; other stats are page-scoped */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            {
              label: 'Alumnos totales',
              value: total,
              icon: GraduationCap,
              color: 'text-blue-600',
            },
            {
              // Page-scoped: full counts would require a separate aggregate endpoint
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
        {sorted.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-40" />
            <p className="text-lg font-medium">
              {search ? 'No se encontraron alumnos con ese criterio' : 'No hay alumnos registrados'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sorted.map(student => {
              const sims = n(student.total_simulations);
              const evals = n(student.total_evaluations);
              const avg = student.avg_score !== null ? n(student.avg_score) : null;
              const best = student.best_score !== null ? n(student.best_score) : null;

              return (
                <Card
                  key={student.id}
                  className="hover:shadow-md transition-all duration-200 cursor-pointer group border hover:border-primary/30"
                  onClick={() => router.push(`/student-ledger/${student.id}`)}
                >
                  <CardContent className="pt-5 pb-4">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold truncate group-hover:text-primary transition-colors leading-tight">
                          {student.name}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{student.email}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 ml-2 mt-0.5" />
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-1.5 mb-3">
                      <div className="text-center bg-muted/40 rounded-md py-2">
                        <p className="text-lg font-bold leading-none">{sims}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Sims.</p>
                      </div>
                      <div className="text-center bg-muted/40 rounded-md py-2">
                        <p className="text-lg font-bold leading-none">{evals}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Sim.</p>
                      </div>
                      <div className="text-center bg-muted/40 rounded-md py-2">
                        <p className={`text-lg font-bold leading-none ${scoreColor(avg)}`}>
                          {avg !== null ? avg.toFixed(0) : '—'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">Prom.</p>
                      </div>
                    </div>

                    {/* Best score bar */}
                    {best !== null && (
                      <div className="mb-2">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Mejor puntaje</span>
                          <span className={`font-semibold ${scoreColor(best)}`}>{best}/100</span>
                        </div>
                        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${getScoreBarColor(best)}`}
                            style={{ width: `${best}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Last activity */}
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
                      <Clock className="w-3 h-3 shrink-0" />
                      {student.last_activity
                        ? `Activo: ${new Date(student.last_activity).toLocaleDateString('es-AR')}`
                        : 'Sin actividad registrada'}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {total > 0 && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-muted-foreground">{total} alumno{total !== 1 ? 's' : ''}</p>
            {totalPages > 1 && (
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => page > 1 && setPage(page - 1)}
                      className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <PaginationItem key={p}>
                      <PaginationLink
                        isActive={p === page}
                        onClick={() => setPage(p)}
                        className="cursor-pointer"
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => page < totalPages && setPage(page + 1)}
                      className={page >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
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
