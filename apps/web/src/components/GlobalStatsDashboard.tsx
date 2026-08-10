'use client'
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/services/ApiClient';
import { AlertCircle, BarChart3, BookOpen, CheckCircle2, Clock, Star, TrendingUp, Users, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

interface GlobalStats {
  users: Array<{ role: string; count: number }>;
  total_evaluations: number;
  avg_score: string;
  avg_minutes: number;
  approval_rate: number;
  completed_this_week: number;
  top_courses: Array<{ title: string; uses: number; avg_score: string }>;
  top_students: Array<{ name: string; avg_score: string; sims: number }>;
}

function toUserCount(count: number | Record<string, unknown> | undefined): number {
  if (typeof count === 'number' && !Number.isNaN(count)) return count;
  if (count && typeof count === 'object') {
    const c = count as Record<string, number | undefined>;
    const n = c._all ?? c.role ?? c.id;
    if (typeof n === 'number') return n;
  }
  const parsed = Number(count);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function GlobalStatsDashboard() {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get('/global-stats')
      .then(r => { setStats(r.data); setLoading(false); })
      .catch((err: { response?: { status?: number; data?: { message?: string | string[] } }; message?: string }) => {
        const status = err?.response?.status;
        const message = err?.response?.data?.message;
        const parts = [
          status ? `HTTP ${status}` : null,
          message
            ? (Array.isArray(message) ? message.join(', ') : String(message))
            : null,
          !message && err?.message ? err.message : null,
        ].filter(Boolean);
        setErrorDetail(parts.length > 0 ? parts.join(' — ') : null);
        setLoading(false);
      });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );

  if (!stats) return (
    <div className="text-center py-8">
      <p className="text-muted-foreground">No se pudieron cargar las estadísticas.</p>
      {errorDetail && (
        <p className="text-xs text-muted-foreground mt-2">{errorDetail}</p>
      )}
    </div>
  );

  const roleMap: Record<string, { label: string; color: string }> = {
    admin: { label: 'Administradores', color: 'bg-purple-100 text-purple-800' },
    teacher: { label: 'Docentes', color: 'bg-blue-100 text-blue-800' },
    student: { label: 'Alumnos', color: 'bg-green-100 text-green-800' },
    ministerio: { label: 'Ministerio', color: 'bg-yellow-100 text-yellow-800' },
  };

  const totalUsers = stats.users.reduce((a, u) => a + toUserCount(u.count), 0);
  const scoreNum = Number(stats.avg_score);
  const scoreColor = scoreNum >= 85 ? 'text-green-600' : scoreNum >= 70 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-blue-600" />
            Dashboard Estadístico Global
          </h2>
          <p className="text-muted-foreground mt-1">Revisiones humanas del sistema — actualizado en tiempo real</p>
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalUsers}</p>
                <p className="text-xs text-muted-foreground">Usuarios totales</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total_evaluations}</p>
                <p className="text-xs text-muted-foreground">Revisiones humanas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className={`text-2xl font-bold ${scoreColor}`}>{stats.avg_score}</p>
                <p className="text-xs text-muted-foreground">Score promedio global</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                <Star className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.approval_rate}%</p>
                <p className="text-xs text-muted-foreground">Tasa de aprobación</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.avg_minutes}'</p>
                <p className="text-xs text-muted-foreground">Tiempo promedio</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.completed_this_week}</p>
                <p className="text-xs text-muted-foreground">Completadas esta semana</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Barra de aprobación */}
        <Card className="col-span-2">
          <CardContent className="pt-5">
            <p className="text-sm font-medium mb-2">Aprobados vs. No aprobados</p>
            <div className="h-4 bg-gray-100 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${stats.approval_rate}%` }}
              />
              <div className="h-full bg-red-300 flex-1" />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span className="text-green-700 font-medium inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> {stats.approval_rate}% Aprobados
              </span>
              <span className="text-red-600 font-medium inline-flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" /> {100 - stats.approval_rate}% No aprobados
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Usuarios por rol */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" /> Usuarios por Rol
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.users.map(u => (
              <div key={u.role} className="flex items-center justify-between">
                <Badge className={`${roleMap[u.role]?.color || 'bg-gray-100 text-gray-700'} border-0 text-xs`}>
                  {roleMap[u.role]?.label || u.role}
                </Badge>
                <span className="font-bold text-lg">{toUserCount(u.count)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Top cursos */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Top 5 Cursos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.top_courses.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin datos todavía.</p>
            )}
            {stats.top_courses.map((c, i) => (
              <div key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium truncate max-w-[140px]" title={c.title}>{c.title}</span>
                  <span className="text-muted-foreground text-xs">{c.uses} usos · avg {c.avg_score}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${Math.min(100, (c.uses / (stats.top_courses[0]?.uses || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Top estudiantes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="w-4 h-4 text-yellow-500" /> Top Estudiantes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.top_students.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin datos todavía.</p>
            )}
            {stats.top_students.map((s, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-yellow-100 text-yellow-700 text-xs flex items-center justify-center font-bold">{i + 1}</span>
                  <span className="text-sm font-medium">{s.name}</span>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-bold ${Number(s.avg_score) >= 85 ? 'text-green-600' : Number(s.avg_score) >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {s.avg_score}
                  </span>
                  <span className="text-xs text-muted-foreground block">{s.sims} sim{s.sims !== 1 ? 's' : ''}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
