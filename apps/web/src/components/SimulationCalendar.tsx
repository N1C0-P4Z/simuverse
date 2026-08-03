'use client'
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient } from '@/services/ApiClient';
import { AlertTriangle, BookOpen, Calendar, CheckCircle2, ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Assignment {
  id: number;
  student_id: string;
  course_id: string;
  course_title: string;
  course_category: string;
  start_date: string | null;
  end_date: string | null;
  max_attempts: number;
  attempts_used: number;
  attempts_remaining: number;
  status: string;
  calendar_status: string;
  overall_score: string | null;
  evaluated_at: string | null;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  assignments: { assignment: Assignment; type: 'start' | 'end' | 'active' }[];
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-blue-500',
  upcoming: 'bg-purple-500',
  completed: 'bg-green-500',
  expired: 'bg-red-400',
};

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  upcoming: 'Próximo',
  completed: 'Completado',
  expired: 'Vencido',
};

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function SimulationCalendar({ studentId }: { studentId?: string }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [allAssignments, setAllAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [filterStudent, setFilterStudent] = useState<string>(studentId || 'all');
  const [students, setStudents] = useState<any[]>([]);
  // ms offset between the server clock and the client clock, so "today" and
  // date comparisons don't drift when the user's machine has the wrong timezone/clock.
  const [serverOffset, setServerOffset] = useState(0);
  const serverNow = () => new Date(Date.now() + serverOffset);

  useEffect(() => {
    apiClient.get('/health')
      .then(r => {
        const ts = r.data?.timestamp;
        if (ts) setServerOffset(new Date(ts).getTime() - Date.now());
      })
      .catch(() => { /* fall back to client clock */ });
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (studentId) {
          const res = await apiClient.get(`/student-assignments/${studentId}`);
          setAssignments(Array.isArray(res.data) ? res.data : []);
        } else {
          const [assignRes, usersRes] = await Promise.all([
            apiClient.get('/assignments'),
            apiClient.get('/users/all'),
          ]);
          const assignRaw = assignRes.data;
          setAllAssignments(Array.isArray(assignRaw) ? assignRaw : (assignRaw?.data ?? []));
          const usersRaw = usersRes.data?.data ?? usersRes.data;
          setStudents((Array.isArray(usersRaw) ? usersRaw : []).filter((u: any) => u.role === 'student'));
        }
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [studentId]);

  const getDisplayAssignments = (): Assignment[] => {
    if (studentId) return assignments;
    let list = allAssignments;
    if (filterStudent !== 'all') list = list.filter((a: any) => a.student_id === filterStudent);
    return list.map((a: any) => ({
      ...a,
      course_title: a.course_title || `Asignación #${a.id}`,
      attempts_remaining: (a.max_attempts || 1) - (a.attempts_used || 0),
      calendar_status: a.end_date && new Date(a.end_date) < serverNow() && a.status !== 'completed'
        ? 'expired'
        : a.start_date && new Date(a.start_date) > serverNow()
        ? 'upcoming'
        : a.status === 'completed' ? 'completed' : 'active',
    }));
  };

  const buildCalendar = (): CalendarDay[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: CalendarDay[] = [];
    const displayAssignments = getDisplayAssignments();

    const isSameDay = (d1: Date, d2: Date) =>
      d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

    const inRange = (d: Date, start: Date | null, end: Date | null) =>
      start && end && d >= start && d <= end;

    // Prev month tail
    for (let i = firstDay - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, daysInPrevMonth - i);
      days.push({ date, isCurrentMonth: false, assignments: [] });
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d);
      const dayAssignments: CalendarDay['assignments'] = [];
      displayAssignments.forEach(a => {
        const start = a.start_date ? new Date(a.start_date) : null;
        const end = a.end_date ? new Date(a.end_date) : null;
        if (start && isSameDay(date, start)) dayAssignments.push({ assignment: a, type: 'start' });
        else if (end && isSameDay(date, end)) dayAssignments.push({ assignment: a, type: 'end' });
        else if (inRange(date, start, end)) dayAssignments.push({ assignment: a, type: 'active' });
      });
      days.push({ date, isCurrentMonth: true, assignments: dayAssignments });
    }

    // Next month padding to fill 6 rows
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      days.push({ date: new Date(year, month + 1, d), isCurrentMonth: false, assignments: [] });
    }

    return days;
  };

  const calendarDays = buildCalendar();
  const today = serverNow();
  const isToday = (d: Date) => d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();

  const displayAssignments = getDisplayAssignments();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-600" />
            Calendario de Simulaciones
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Las fechas de inicio y vencimiento se configuran en <strong>Admin → Asignaciones</strong> al crear o editar una asignación.
          </p>
        </div>
        {!studentId && students.length > 0 && (
          <Select value={filterStudent} onValueChange={setFilterStudent}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Filtrar por alumno" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los alumnos</SelectItem>
              {students.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap gap-4 text-xs">
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className={`w-3 h-3 rounded-full ${STATUS_COLORS[key]}`} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-orange-400" />Inicio</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-pink-400" />Vencimiento</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendario */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-4">
              {/* Header con navegación */}
              <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <h3 className="font-bold text-lg">{MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}</h3>
                <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Días de la semana */}
              <div className="grid grid-cols-7 mb-1">
                {DAYS.map(d => (
                  <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>
                ))}
              </div>

              {/* Grid de días */}
              <div className="grid grid-cols-7 gap-0.5">
                {calendarDays.map((day, i) => {
                  const hasEvents = day.assignments.length > 0;
                  const startEvents = day.assignments.filter(a => a.type === 'start');
                  const endEvents = day.assignments.filter(a => a.type === 'end');
                  const activeEvents = day.assignments.filter(a => a.type === 'active');
                  return (
                    <button
                      key={i}
                      onClick={() => hasEvents ? setSelectedDay(day) : null}
                      className={`
                        relative min-h-[52px] p-1 rounded text-xs text-left transition-colors
                        ${!day.isCurrentMonth ? 'text-gray-300 bg-gray-50/50' : 'text-foreground'}
                        ${isToday(day.date) ? 'bg-blue-50 border-2 border-blue-400 font-bold' : 'hover:bg-muted/50'}
                        ${hasEvents && day.isCurrentMonth ? 'cursor-pointer' : ''}
                      `}
                    >
                      <span className={`text-xs ${isToday(day.date) ? 'text-blue-600 font-bold' : ''}`}>
                        {day.date.getDate()}
                      </span>
                      <div className="mt-0.5 space-y-0.5">
                        {startEvents.slice(0, 2).map((a, j) => (
                          <div key={j} className="w-full h-1.5 bg-orange-400 rounded-full" title={`Inicio: ${a.assignment.course_title}`} />
                        ))}
                        {endEvents.slice(0, 2).map((a, j) => (
                          <div key={j} className="w-full h-1.5 bg-pink-400 rounded-full" title={`Vence: ${a.assignment.course_title}`} />
                        ))}
                        {activeEvents.length > 0 && (
                          <div className={`w-full h-1.5 ${STATUS_COLORS[activeEvents[0].assignment.calendar_status] || 'bg-gray-300'} rounded-full opacity-60`} />
                        )}
                        {day.assignments.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{day.assignments.length - 3}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Panel lateral: detalle del día seleccionado o lista próximas */}
        <div className="space-y-4">
          {selectedDay ? (
            <Card className="border-blue-200">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-sm">
                    {selectedDay.date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </h4>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSelectedDay(null)}>✕</Button>
                </div>
                <div className="space-y-3">
                  {selectedDay.assignments.map((item, i) => (
                    <div key={i} className="border rounded-lg p-3 text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[item.assignment.calendar_status]}`} />
                        <span className="font-medium text-xs">{item.assignment.course_title}</span>
                      </div>
                      <Badge variant="outline" className="text-xs mb-2">
                        {item.type === 'start' ? '🟠 Fecha de inicio' : item.type === 'end' ? '🔴 Fecha de vencimiento' : `● ${STATUS_LABELS[item.assignment.calendar_status] || 'Activo'}`}
                      </Badge>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{item.assignment.attempts_remaining}/{item.assignment.max_attempts} intentos</span>
                      </div>
                      {item.assignment.overall_score && (
                        <div className="flex items-center gap-2 text-xs mt-1">
                          <CheckCircle2 className="w-3 h-3 text-green-600" />
                          <span className="text-green-700 font-medium">Score: {Number(item.assignment.overall_score).toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Lista de próximas/activas */}
          <Card>
            <CardContent className="pt-4">
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4" /> Todas las Asignaciones
              </h4>
              {loading ? (
                <div className="text-center py-4"><div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mx-auto" /></div>
              ) : displayAssignments.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin asignaciones.</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {displayAssignments.map(a => (
                    <div key={a.id} className="flex items-start gap-2 text-xs border-b pb-2">
                      <span className={`w-2.5 h-2.5 rounded-full mt-0.5 shrink-0 ${STATUS_COLORS[a.calendar_status]}`} />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{a.course_title}</p>
                        <p className="text-muted-foreground">
                          {a.start_date ? `Inicio: ${new Date(a.start_date).toLocaleDateString('es-AR')}` : 'Sin fecha inicio'}
                          {a.end_date ? ` · Vence: ${new Date(a.end_date).toLocaleDateString('es-AR')}` : ''}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px] px-1 py-0">{STATUS_LABELS[a.calendar_status] || a.status}</Badge>
                          <span className="text-muted-foreground">{a.attempts_remaining}/{a.max_attempts} int.</span>
                          {a.overall_score && <span className="text-green-700 font-medium">{Number(a.overall_score).toFixed(0)} pts</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Alerta vencimientos próximos */}
          {displayAssignments.filter(a => {
            if (!a.end_date) return false;
            const diff = (new Date(a.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
            return diff >= 0 && diff <= 3 && a.calendar_status !== 'completed';
          }).length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-red-700 text-sm font-semibold mb-2">
                <AlertTriangle className="w-4 h-4" /> Vencen en 3 días o menos
              </div>
              {displayAssignments.filter(a => {
                if (!a.end_date) return false;
                const diff = (new Date(a.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
                return diff >= 0 && diff <= 3 && a.calendar_status !== 'completed';
              }).map(a => (
                <p key={a.id} className="text-xs text-red-600">• {a.course_title} — {new Date(a.end_date!).toLocaleDateString('es-AR')}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
