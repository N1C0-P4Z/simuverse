'use client'
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/services/ApiClient';
import {
    AlertTriangle,
    BarChart3,
    Brain,
    CheckCircle,
    Clock,
    FileText,
    Loader2,
    MessageCircle,
    Trophy,
    Users,
    Zap
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const EvaluationsPage = () => {
  const { user, hasRole, loading } = useAuth();
  const router = useRouter();
  const [simulations, setSimulations] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [logs, setLogs] = useState<Record<string, any[]>>({});
  const [evaluating, setEvaluating] = useState<Record<string, boolean>>({});
  const [evaluations, setEvaluations] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!loading && (!user || (!hasRole('teacher') && !hasRole('admin') && !hasRole('ministerio') && !hasRole('supervisor')))) {
      router.push('/auth');
    }
  }, [user, loading, hasRole, router]);

  useEffect(() => {
    const fetch = async () => {
      try {
        const [simsRes, coursesRes] = await Promise.all([
          apiClient.get('/simulations'),
          apiClient.get('/courses/dropdown/list'),
        ]);
        if (simsRes.data) setSimulations(simsRes.data);
        if (coursesRes.data) setCourses(coursesRes.data);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    if (user) fetch();
  }, [user]);

  const loadLogs = async (simId: string) => {
    if (logs[simId]) return;
    try {
      const res = await apiClient.get(`/simulations/${simId}/logs`);
      if (res.data) setLogs(prev => ({ ...prev, [simId]: res.data }));
    } catch (error) {
      console.error('Error loading logs:', error);
    }
  };

  const handleEvaluate = async (simId: string) => {
    setEvaluating(prev => ({ ...prev, [simId]: true }));
    try {
      const res = await apiClient.post(`/simulations/${simId}/evaluate`, {});
      if (res.data) {
        setEvaluations(prev => ({ ...prev, [simId]: res.data }));
        // Update local score on the simulation
        setSimulations(prev => prev.map(s => s.id === simId ? { ...s, score: res.data.score } : s));
        toast[res.data.passed ? 'success' : 'warning'](
          `Evaluación completada: Puntaje ${res.data.score}/100 · Modo: ${res.data.ai_mode === 'live' ? 'IA en vivo' : 'Evaluación heurística'}`
        );
      }
    } catch (error: any) {
      toast.error(`Error al evaluar: ${error.message}`);
    } finally {
      setEvaluating(prev => ({ ...prev, [simId]: false }));
    }
  };

  const filtered = selectedCourse === 'all' ? simulations : simulations.filter(s => s.course_id === selectedCourse);

  const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    active: { label: 'En Curso', color: 'bg-success/10 text-success', icon: <Clock className="w-3 h-3" /> },
    completed: { label: 'Completada', color: 'bg-primary/10 text-primary', icon: <CheckCircle className="w-3 h-3" /> },
    paused: { label: 'Pausada', color: 'bg-warning/10 text-warning', icon: <Clock className="w-3 h-3" /> },
    abandoned: { label: 'Abandonada', color: 'bg-destructive/10 text-destructive', icon: <AlertTriangle className="w-3 h-3" /> },
  };

  const scoreColor = (s: number) => s >= 85 ? 'text-green-600' : s >= 70 ? 'text-yellow-600' : 'text-red-600';
  const scoreBar  = (s: number) => s >= 85 ? 'bg-green-500' : s >= 70 ? 'bg-yellow-400' : 'bg-red-500';

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        {/* Header with filter */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Evaluaciones</h1>
            <p className="text-muted-foreground text-sm">Telemetría y calificaciones</p>
          </div>
          <Select value={selectedCourse} onValueChange={setSelectedCourse}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Filtrar curso" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los cursos</SelectItem>
              {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="glass-card">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{simulations.length}</div>
              <p className="text-xs text-muted-foreground">Total Simulaciones</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{simulations.filter(s => s.status === 'completed').length}</div>
              <p className="text-xs text-muted-foreground">Completadas</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">
                {Object.values(evaluations).filter(e => e.passed).length + simulations.filter(s => s.score >= 70 && !evaluations[s.id]).length}
              </div>
              <p className="text-xs text-muted-foreground">Aprobadas</p>
            </CardContent>
          </Card>
          <Card className="glass-card">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">
                {(() => {
                  const scored = [
                    ...simulations.filter(s => s.score !== null && s.score !== undefined && !evaluations[s.id]).map(s => s.score),
                    ...Object.values(evaluations).map((e: any) => e.score),
                  ];
                  return scored.length > 0 ? (scored.reduce((a, b) => a + b, 0) / scored.length).toFixed(1) : '—';
                })()}
              </div>
              <p className="text-xs text-muted-foreground">Puntaje Promedio</p>
            </CardContent>
          </Card>
        </div>

        {/* Simulation list */}
        <div className="space-y-3">
          {filtered.map(sim => {
            const st = statusConfig[sim.status] || statusConfig.active;
            const courseName = (sim.courses as any)?.title || courses.find(c => c.id === sim.course_id)?.title || 'Curso';
            const duration = sim.completed_at
              ? Math.round((new Date(sim.completed_at).getTime() - new Date(sim.started_at).getTime()) / 60000)
              : null;
            const evalData = evaluations[sim.id];
            const existingScore = evalData?.score ?? sim.score ?? null;
            const isCompleted = sim.status === 'completed';

            return (
              <Card key={sim.id} className="glass-card hover:shadow-lg transition-all">
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: info */}
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => loadLogs(sim.id)}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <Users className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <button
                          className="font-medium hover:text-primary hover:underline flex items-center gap-1 transition-colors"
                          onClick={e => { e.stopPropagation(); router.push(`/student-ledger/${sim.student_id}`); }}
                          title="Ver legajo del alumno"
                        >
                          {sim.user?.name || sim.student_id?.slice(0, 8) || 'Alumno'}
                          <FileText className="w-3 h-3 opacity-60" />
                        </button>
                        <Badge variant="secondary" className={`text-xs ${st.color} gap-1`}>{st.icon}{st.label}</Badge>
                        {existingScore !== null && (
                          <Badge variant="outline" className={`text-xs font-bold ${scoreColor(existingScore)}`}>
                            {existingScore >= 70 ? <Trophy className="w-3 h-3 mr-1 inline" /> : null}
                            {existingScore}/100
                          </Badge>
                        )}
                        {evalData?.ai_mode === 'scripted' && (
                          <Badge variant="outline" className="text-xs text-muted-foreground gap-1">
                            <Zap className="w-3 h-3" /> Heurístico
                          </Badge>
                        )}
                        {evalData?.ai_mode === 'live' && (
                          <Badge variant="outline" className="text-xs text-blue-600 gap-1">
                            <Brain className="w-3 h-3" /> IA
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                        <span>{courseName}</span>
                        <span>·</span>
                        <span>{new Date(sim.started_at).toLocaleDateString('es-AR')}</span>
                        {duration !== null && <><span>·</span><span>{duration} min</span></>}
                        {logs[sim.id] && <><span>·</span><MessageCircle className="w-3 h-3 inline" /><span>{logs[sim.id].length} eventos</span></>}
                      </div>

                      {/* KPI bars if evaluation exists */}
                      {evalData?.kpis && Object.keys(evalData.kpis).length > 0 && (
                        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1">
                          {Object.entries(evalData.kpis).slice(0, 4).map(([kpi, val]) => {
                            const n = Number(val);
                            return (
                              <div key={kpi}>
                                <div className="flex justify-between text-xs mb-0.5">
                                  <span className="text-muted-foreground capitalize">{kpi.replace(/_/g, ' ')}</span>
                                  <span className={`font-medium ${scoreColor(n)}`}>{n.toFixed(0)}</span>
                                </div>
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className={`h-full ${scoreBar(n)} rounded-full`} style={{ width: `${Math.min(100, n)}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Right: Evaluate button */}
                    {isCompleted && (
                      <div className="flex-shrink-0">
                        {evalData ? (
                          <Badge className={`text-sm px-3 py-1 ${evalData.passed ? 'bg-green-100 text-green-700 border-green-300' : 'bg-red-100 text-red-700 border-red-300'} border`}>
                            {evalData.passed ? '✅ Aprobó' : '❌ No aprobó'}
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            disabled={evaluating[sim.id]}
                            onClick={() => handleEvaluate(sim.id)}
                          >
                            {evaluating[sim.id] ? (
                              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Evaluando...</>
                            ) : (
                              <><BarChart3 className="w-3.5 h-3.5" /> Evaluar</>
                            )}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Expanded logs */}
                  {logs[sim.id] && (
                    <div className="mt-4 border-t pt-3">
                      <h4 className="text-xs font-semibold text-muted-foreground mb-2">
                        REGISTRO DE ACTIVIDAD ({logs[sim.id].length} eventos)
                      </h4>
                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {logs[sim.id].map(log => (
                          <div key={log.id} className="flex items-center gap-2 text-xs py-1">
                            <span className="text-muted-foreground w-16 flex-shrink-0">
                              {new Date(log.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                            <Badge variant="outline" className="text-xs">{log.action_type}</Badge>
                            <span className="text-muted-foreground truncate">{JSON.stringify(log.metadata || {}).slice(0, 80)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No hay simulaciones registradas.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default EvaluationsPage;
