'use client'
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAdmin } from '@/lib/admin-context';
import { apiClient } from '@/services/ApiClient';
import { usePagination } from '@/hooks/usePagination';
import {
    BookOpen,
    CheckCircle,
    ChevronRight,
    Clock,
    Copy,
    Edit2,
    FileText,
    GraduationCap, Layers,
    Mail,
    Plus,
    Target,
    Trash2
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SimEmail {
  from: string;
  subject: string;
  body: string;
}

interface SimDocument {
  name: string;
  type: string;
  content: string;
}

interface ScenarioContent {
  context: string;
  constraints: string[];
  initial_emails: SimEmail[];
  emails?: SimEmail[];
  documents: SimDocument[];
  estimated_time_minutes: number;
  spreadsheet?: { name: string; rows: string[] };
}

interface ExpectedOutcomes {
  main_objective: string;
  success_criteria: string[];
  kpis: Array<{ name: string; threshold: number; description: string }>;
}

interface Scenario {
  id: string;
  course_id: string;
  title: string;
  description: string;
  scenario_type: 'practice' | 'evaluation';
  difficulty: 'easy' | 'medium' | 'hard';
  categories?: string[];
  content: ScenarioContent;
  expected_outcomes: ExpectedOutcomes;
  is_active: boolean;
  created_at: string;
}

interface Course {
  id: string;
  course_id: string;
  title: string;
  category: string;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const emptyContent = (): ScenarioContent => ({
  context: '',
  constraints: [],
  initial_emails: [],
  documents: [],
  estimated_time_minutes: 30,
});

const emptyOutcomes = (): ExpectedOutcomes => ({
  main_objective: '',
  success_criteria: [],
  kpis: [],
});

const emptyForm = () => ({
  course_id: '',
  title: '',
  description: '',
  scenario_type: 'practice' as 'practice' | 'evaluation',
  difficulty: 'medium' as 'easy' | 'medium' | 'hard',
  categories: [] as string[],
  content: emptyContent(),
  expected_outcomes: emptyOutcomes(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const typeLabel = (t: string) =>
  t === 'evaluation' ? '🎯 Evaluación' : '📚 Práctica';

const typeBadgeClass = (t: string) =>
  t === 'evaluation'
    ? 'bg-red-100 text-red-800 border-red-200'
    : 'bg-blue-100 text-blue-800 border-blue-200';

const diffBadgeClass = (d: string) => ({
  easy: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  hard: 'bg-orange-100 text-orange-800',
}[d] ?? 'bg-gray-100 text-gray-800');

// ─── Component ────────────────────────────────────────────────────────────────

export function ScenariosABM() {
  const { readOnly } = useAdmin();
  const { data: scenarios, total, page, totalPages, setPage, loading, setExtraParams } = usePagination<Scenario>({
    endpoint: '/scenarios',
  });
  const [courses, setCourses] = useState<Course[]>([]);
  const [filterCourse, setFilterCourse] = useState('');
  const [filterType, setFilterType] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [showInactive, setShowInactive] = useState(false);

  // mini-state for adding items
  const [newConstraint, setNewConstraint] = useState('');
  const [newCriteria, setNewCriteria] = useState('');
  const [newEmail, setNewEmail] = useState<SimEmail>({ from: '', subject: '', body: '' });
  const [newDoc, setNewDoc] = useState<SimDocument>({ name: '', type: 'texto', content: '' });
  const [newKpi, setNewKpi] = useState({ name: '', threshold: 70, description: '' });

  // ── Data loading ────────────────────────────────────────────────────────────

  const refreshList = () => setPage(page);

  useEffect(() => {
    loadCourses();
  }, []);

  // Sync showInactive filter to pagination
  useEffect(() => {
    const params: Record<string, unknown> = {};
    if (showInactive) params.includeInactive = 'true';
    if (filterCourse) params.course_id = filterCourse;
    if (filterType) params.scenario_type = filterType;
    setExtraParams(params);
  }, [showInactive, filterCourse, filterType, setExtraParams]);

  const loadCourses = async () => {
    try {
      const res = await apiClient.get('/courses/dropdown/list');
      setCourses(Array.isArray(res.data) ? res.data : []);
    } catch { setCourses([]); }
  };

  // ── CRUD ────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.course_id || !form.title) {
      toast.error('El curso y el título son obligatorios');
      return;
    }
    setSaving(true);
    try {
      // Persist under both keys so runtime (emails) and ABM (initial_emails) stay in sync
      const emails = form.content.initial_emails || [];
      const payload = {
        ...form,
        content: {
          ...form.content,
          initial_emails: emails,
          emails,
        },
      };
      if (editingId) {
        await apiClient.put(`/scenarios/${editingId}`, payload);
      } else {
        await apiClient.post('/scenarios', payload);
      }
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm());
      refreshList();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al guardar el escenario');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (s: Scenario) => {
    setForm({
      course_id: s.course_id,
      title: s.title,
      description: s.description || '',
      scenario_type: s.scenario_type,
      difficulty: s.difficulty,
      categories: Array.isArray(s.categories) ? s.categories : [],
      content: {
        context: s.content?.context || '',
        constraints: s.content?.constraints || [],
        initial_emails: s.content?.initial_emails || s.content?.emails || [],
        documents: s.content?.documents || [],
        estimated_time_minutes: s.content?.estimated_time_minutes || 30,
        spreadsheet: s.content?.spreadsheet,
      },
      expected_outcomes: {
        main_objective: s.expected_outcomes?.main_objective || '',
        success_criteria: s.expected_outcomes?.success_criteria || [],
        kpis: s.expected_outcomes?.kpis || [],
      },
    });
    setEditingId(s.id);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    toast.error('¿Eliminar este escenario?', {
      action: {
        label: 'Eliminar',
        onClick: async () => {
          try {
            await apiClient.delete(`/scenarios/${id}`);
            refreshList();
            toast.success('Escenario eliminado');
          } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Error al eliminar');
          }
        },
      },
      duration: 5000,
    });
  };

  const handleReactivate = async (id: string) => {
    try {
      await apiClient.put(`/scenarios/${id}`, { is_active: true });
      refreshList();
      toast.success('Escenario reactivado');
    } catch { toast.error('Error al reactivar'); }
  };

  const handleDuplicate = async (s: Scenario) => {
    const payload = {
      course_id: s.course_id,
      title: s.title + ' (Copia)',
      description: s.description,
      scenario_type: s.scenario_type,
      difficulty: s.difficulty,
      categories: s.categories || [],
      content: s.content,
      expected_outcomes: s.expected_outcomes,
    };
    try {
      await apiClient.post('/scenarios', payload);
      refreshList();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Error al duplicar');
    }
  };

  const handleNew = () => {
    setForm(emptyForm());
    setEditingId(null);
    setDialogOpen(true);
  };

  // ── Filtered list (server-side pagination handles filtering) ─────────────────

  const filtered = scenarios;

  const courseName = (id: string) => courses.find(c => c.id === id)?.title ?? id;

  // ── Content helpers ──────────────────────────────────────────────────────────

  const updateContent = (patch: Partial<ScenarioContent>) =>
    setForm(f => ({ ...f, content: { ...f.content, ...patch } }));

  const updateOutcomes = (patch: Partial<ExpectedOutcomes>) =>
    setForm(f => ({ ...f, expected_outcomes: { ...f.expected_outcomes, ...patch } }));

  const addConstraint = () => {
    if (!newConstraint.trim()) return;
    updateContent({ constraints: [...(form.content.constraints || []), newConstraint.trim()] });
    setNewConstraint('');
  };

  const addCriteria = () => {
    if (!newCriteria.trim()) return;
    updateOutcomes({ success_criteria: [...(form.expected_outcomes.success_criteria || []), newCriteria.trim()] });
    setNewCriteria('');
  };

  const addEmail = () => {
    if (!newEmail.from || !newEmail.subject) return;
    updateContent({ initial_emails: [...(form.content.initial_emails || []), { ...newEmail }] });
    setNewEmail({ from: '', subject: '', body: '' });
  };

  const addDocument = () => {
    if (!newDoc.name) return;
    updateContent({ documents: [...(form.content.documents || []), { ...newDoc }] });
    setNewDoc({ name: '', type: 'texto', content: '' });
  };

  const addKpi = () => {
    if (!newKpi.name) return;
    updateOutcomes({ kpis: [...(form.expected_outcomes.kpis || []), { ...newKpi }] });
    setNewKpi({ name: '', threshold: 70, description: '' });
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) return <div className="p-8 text-center">Cargando escenarios...</div>;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Escenarios de Simulación</h2>
          <p className="text-gray-600 mt-1">
            Cada escenario define la situación laboral que el alumno debe resolver.
            <span className="ml-1 text-blue-700 font-medium">📚 Práctica</span> = múltiples intentos para aprender.
            <span className="ml-1 text-red-700 font-medium">🎯 Evaluación</span> = único intento, calificado.
          </p>
        </div>
{!readOnly && <Button onClick={handleNew} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" /> Nuevo Escenario
        </Button>}
      </div>

      {/* Info box */}
      <Card className="p-4 bg-amber-50 border-amber-200">
        <div className="flex gap-3 text-sm">
          <Layers className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900">¿Cómo se estructura un escenario?</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-amber-800">
              <div className="flex items-center gap-1"><ChevronRight className="w-3 h-3" /><b>Contexto:</b> La narrativa/situación</div>
              <div className="flex items-center gap-1"><Mail className="w-3 h-3" /><b>Inbox:</b> Emails pre-cargados</div>
              <div className="flex items-center gap-1"><FileText className="w-3 h-3" /><b>Docs:</b> Archivos disponibles</div>
              <div className="flex items-center gap-1"><Target className="w-3 h-3" /><b>KPIs:</b> Criterios de éxito</div>
            </div>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterCourse || 'all'} onValueChange={v => setFilterCourse(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Todos los cursos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">— Todos los cursos —</SelectItem>
            {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType || 'all'} onValueChange={v => setFilterType(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">— Todos los tipos —</SelectItem>
            <SelectItem value="practice">📚 Práctica</SelectItem>
            <SelectItem value="evaluation">🎯 Evaluación</SelectItem>
          </SelectContent>
        </Select>
        <span className="self-center text-sm text-gray-500">{filtered.length} escenarios</span>
      </div>

      {/* Toggle active/inactive */}
      <div className="flex gap-2 mb-4">
        <Button variant={!showInactive ? 'default' : 'outline'} size="sm" onClick={() => { setShowInactive(false); loadScenarios(); }}>
          Activos ({scenarios.filter(s => s.is_active !== false).length})
        </Button>
        <Button variant={showInactive ? 'default' : 'outline'} size="sm" onClick={() => { setShowInactive(true); loadScenarios(); }}>
          Inactivos ({scenarios.filter(s => s.is_active === false).length})
        </Button>
      </div>

      {/* Scenario list grouped by course */}
      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p>No hay escenarios {filterCourse ? 'para este curso' : ''}. Creá uno con el botón de arriba.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(s => (
            <Card key={s.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${typeBadgeClass(s.scenario_type)}`}>
                      {s.scenario_type === 'practice' ? 'Práctica' : s.scenario_type === 'evaluation' ? 'Evaluación' : s.scenario_type}
                    </span>
                    {s.is_active === false && <Badge variant="secondary" className="text-xs bg-gray-400">Inactivo</Badge>}
                    <span className={`text-xs px-2 py-0.5 rounded ${diffBadgeClass(s.difficulty)}`}>
                      {s.difficulty === 'easy' ? 'Fácil' : s.difficulty === 'medium' ? 'Medio' : 'Difícil'}
                    </span>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                      🎓 {courseName(s.course_id)}
                    </span>
                    {s.content?.estimated_time_minutes && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {s.content.estimated_time_minutes} min
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-gray-900">{s.title}</h3>
                  {s.description && <p className="text-sm text-gray-600 mt-1 line-clamp-2">{s.description}</p>}
                  <div className="flex gap-3 mt-2 text-xs text-gray-500">
                    {(s.content?.initial_emails?.length > 0 || s.content?.emails?.length > 0) && (
                      <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {(s.content.initial_emails || s.content.emails || []).length} email(s)</span>
                    )}
                    {s.content?.documents?.length > 0 && (
                      <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {s.content.documents.length} doc(s)</span>
                    )}
                    {s.expected_outcomes?.kpis?.length > 0 && (
                      <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {s.expected_outcomes.kpis.length} KPI(s)</span>
                    )}
                  </div>
                </div>
<div className="flex gap-2 shrink-0">
                  {!readOnly && <Button size="sm" variant="outline" title="Duplicar" onClick={() => handleDuplicate(s)}>
                    <Copy className="w-4 h-4" />
                  </Button>}
                  {!readOnly && <Button size="sm" variant="outline" onClick={() => handleEdit(s)}>
                    <Edit2 className="w-4 h-4" />
                  </Button>}
                  {!readOnly && s.is_active !== false && <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleDelete(s.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>}
                  {!readOnly && s.is_active === false && <Button size="sm" variant="outline" className="text-green-600 border-green-300" onClick={() => handleReactivate(s.id)}>
                    <CheckCircle className="w-4 h-4" />
                  </Button>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{total} escenario{total !== 1 ? 's' : ''}</p>
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

      {/* ── Edit/Create Dialog ────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) { setEditingId(null); setForm(emptyForm()); } }}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5" />
              {editingId ? 'Editar Escenario' : 'Nuevo Escenario de Simulación'}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="basic" className="mt-2">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="basic">📋 Básico</TabsTrigger>
              <TabsTrigger value="context">🗺️ Contexto</TabsTrigger>
              <TabsTrigger value="legos">📬 Legos</TabsTrigger>
              <TabsTrigger value="eval">🎯 Evaluación</TabsTrigger>
            </TabsList>

            {/* ── TAB 1: Básico ────────────────────────────────────────────── */}
            <TabsContent value="basic" className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium block mb-1">Curso *</label>
                <Select value={form.course_id || 'none'} onValueChange={v => setForm(f => ({ ...f, course_id: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecciona el curso" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Selecciona un curso —</SelectItem>
                    {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Título del Escenario *</label>
                <Input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Ej: Crisis: Cliente que reclama pago no confirmado"
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Descripción breve (para el admin)</label>
                <Textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Qué se practica en este escenario..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1">Tipo de Escenario</label>
                  <Select value={form.scenario_type} onValueChange={v => setForm(f => ({ ...f, scenario_type: v as any }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="practice">📚 Práctica (múltiples intentos)</SelectItem>
                      <SelectItem value="evaluation">🎯 Evaluación (un solo intento)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    {form.scenario_type === 'evaluation'
                      ? '⚠️ El alumno solo tiene UN intento. Se califica automáticamente.'
                      : '✅ El alumno puede repetirlo cuantas veces quiera para aprender.'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Dificultad</label>
                  <Select value={form.difficulty} onValueChange={v => setForm(f => ({ ...f, difficulty: v as any }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">🟢 Fácil</SelectItem>
                      <SelectItem value="medium">🟡 Medio</SelectItem>
                      <SelectItem value="hard">🔴 Difícil</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Tiempo estimado (minutos)</label>
                <Input
                  type="number"
                  min={5} max={180}
                  value={form.content.estimated_time_minutes}
                  onChange={e => updateContent({ estimated_time_minutes: parseInt(e.target.value) || 30 })}
                  className="w-32"
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Categorías del escenario <span className="text-gray-400 font-normal text-xs">(para filtrar en asignaciones)</span></label>
                <div className="border rounded-lg p-2 bg-white max-h-32 overflow-y-auto grid grid-cols-2 gap-0.5">
                  {['seguros', 'contable', 'rrhh', 'ventas', 'oratoria', 'legal', 'administracion', 'general'].map(cat => (
                    <label key={cat} className={`flex items-center gap-2 p-1 rounded cursor-pointer text-xs ${form.categories.includes(cat) ? 'bg-blue-50 text-blue-800' : ''}`}>
                      <input type="checkbox"
                        checked={form.categories.includes(cat)}
                        onChange={() => setForm(f => ({ ...f, categories: f.categories.includes(cat) ? f.categories.filter(c => c !== cat) : [...f.categories, cat] }))}
                        className="rounded" />
                      <span className="capitalize">{cat}</span>
                    </label>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* ── TAB 2: Contexto ──────────────────────────────────────────── */}
            <TabsContent value="context" className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium block mb-1">
                  Narrativa del Escenario (Contexto)
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  Describí la situación que enfrenta el alumno. Esto es lo primero que verá al iniciar la simulación.
                  El Chat IA también usa este texto como contexto.
                </p>
                <Textarea
                  value={form.content.context}
                  onChange={e => updateContent({ context: e.target.value })}
                  placeholder={`Ejemplo:\nSon las 9am. Acabás de entrar a trabajar en el área de atención al cliente de Tech-Store Online.\nTu bandeja tiene 1 nuevo email urgente del equipo de IT.\nAdemás, hay un cliente en el chat reclamando que pagó pero no recibió confirmación.\nTu objetivo: resolver la situación antes de que el cliente escale a Defensa del Consumidor.`}
                  rows={8}
                  className="font-mono text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Restricciones / Reglas del escenario</label>
                <p className="text-xs text-gray-500 mb-2">
                  Cosas que el alumno NO puede hacer, o condiciones del escenario.
                </p>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={newConstraint}
                    onChange={e => setNewConstraint(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addConstraint()}
                    placeholder="Ej: No puede ofrecer reembolso sin autorización del supervisor"
                  />
                  <Button type="button" variant="outline" onClick={addConstraint}>+</Button>
                </div>
                <div className="space-y-1">
                  {form.content.constraints?.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm bg-gray-50 px-3 py-1.5 rounded">
                      <ChevronRight className="w-3 h-3 text-gray-400" />
                      <span className="flex-1">{c}</span>
                      <button onClick={() => updateContent({ constraints: form.content.constraints.filter((_, j) => j !== i) })} className="text-red-400 hover:text-red-600">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* ── TAB 3: Legos (Inbox + Docs) ──────────────────────────────── */}
            <TabsContent value="legos" className="space-y-6 mt-4">

              {/* Emails */}
              <div>
                <h3 className="font-semibold flex items-center gap-2 mb-1">
                  <Mail className="w-4 h-4 text-blue-600" /> Inbox Pre-cargado
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  Estos emails aparecerán en la bandeja del alumno cuando empiece la simulación.
                  Son clave para darle contexto y pistas.
                </p>
                <div className="border rounded-lg p-3 space-y-3 bg-blue-50">
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={newEmail.from} onChange={e => setNewEmail(n => ({ ...n, from: e.target.value }))} placeholder="De: equipo-it@empresa.com" />
                    <Input value={newEmail.subject} onChange={e => setNewEmail(n => ({ ...n, subject: e.target.value }))} placeholder="Asunto: Alerta - Delay en pasarela de pagos" />
                  </div>
                  <Textarea value={newEmail.body} onChange={e => setNewEmail(n => ({ ...n, body: e.target.value }))} placeholder="Cuerpo del email..." rows={4} />
                  <Button type="button" size="sm" onClick={addEmail} disabled={!newEmail.from || !newEmail.subject}>
                    <Plus className="w-3 h-3 mr-1" /> Agregar email
                  </Button>
                </div>
                {form.content.initial_emails?.map((em, i) => (
                  <Card key={i} className="p-3 mt-2 border-l-4 border-l-blue-400">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs text-gray-500">De: <span className="font-medium text-gray-700">{em.from}</span></p>
                        <p className="text-sm font-semibold mt-0.5">{em.subject}</p>
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">{em.body}</p>
                      </div>
                      <button onClick={() => updateContent({ initial_emails: form.content.initial_emails.filter((_, j) => j !== i) })} className="text-red-400 hover:text-red-600 ml-2 shrink-0">✕</button>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Documents */}
              <div>
                <h3 className="font-semibold flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-green-600" /> Documentos Pre-cargados
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  Archivos que el alumno tiene disponibles en la carpeta de Documentos del simulador
                  (manuales, normativas, procedimientos, contratos, etc.)
                </p>
                <div className="border rounded-lg p-3 space-y-2 bg-green-50">
                  <div className="grid grid-cols-2 gap-2">
                    <Input value={newDoc.name} onChange={e => setNewDoc(n => ({ ...n, name: e.target.value }))} placeholder="Nombre: Procedimiento de devoluciones" />
                    <Select value={newDoc.type} onValueChange={v => setNewDoc(n => ({ ...n, type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="texto">📄 Texto / Normativa</SelectItem>
                        <SelectItem value="procedimiento">📋 Procedimiento</SelectItem>
                        <SelectItem value="contrato">📜 Contrato</SelectItem>
                        <SelectItem value="reporte">📊 Reporte / Datos</SelectItem>
                        <SelectItem value="formulario">📝 Formulario</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea value={newDoc.content} onChange={e => setNewDoc(n => ({ ...n, content: e.target.value }))} placeholder="Contenido del documento..." rows={4} />
                  <Button type="button" size="sm" onClick={addDocument} disabled={!newDoc.name}>
                    <Plus className="w-3 h-3 mr-1" /> Agregar documento
                  </Button>
                </div>
                {form.content.documents?.map((doc, i) => (
                  <Card key={i} className="p-3 mt-2 border-l-4 border-l-green-400">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-semibold">{doc.name}</p>
                        <p className="text-xs text-gray-500">Tipo: {doc.type}</p>
                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">{doc.content}</p>
                      </div>
                      <button onClick={() => updateContent({ documents: form.content.documents.filter((_, j) => j !== i) })} className="text-red-400 hover:text-red-600 ml-2 shrink-0">✕</button>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* ── TAB 4: Evaluación ─────────────────────────────────────────── */}
            <TabsContent value="eval" className="space-y-5 mt-4">
              <div>
                <label className="text-sm font-medium block mb-1">Objetivo Principal</label>
                <Input
                  value={form.expected_outcomes.main_objective}
                  onChange={e => updateOutcomes({ main_objective: e.target.value })}
                  placeholder="Ej: El alumno debe calmar al cliente usando la información técnica del email de IT"
                />
              </div>

              {/* Success Criteria */}
              <div>
                <label className="text-sm font-medium block mb-1">Criterios de Éxito</label>
                <p className="text-xs text-gray-500 mb-2">¿Qué tiene que hacer el alumno para pasar el escenario?</p>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={newCriteria}
                    onChange={e => setNewCriteria(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCriteria()}
                    placeholder="Ej: Menciona el problema técnico de la pasarela de pagos"
                  />
                  <Button type="button" variant="outline" onClick={addCriteria}>+</Button>
                </div>
                {form.expected_outcomes.success_criteria?.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm bg-green-50 px-3 py-1.5 rounded mb-1">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    <span className="flex-1">{c}</span>
                    <button onClick={() => updateOutcomes({ success_criteria: form.expected_outcomes.success_criteria.filter((_, j) => j !== i) })} className="text-red-400">✕</button>
                  </div>
                ))}
              </div>

              {/* KPIs */}
              <div>
                <label className="text-sm font-medium block mb-1">KPIs de Evaluación</label>
                <p className="text-xs text-gray-500 mb-2">
                  Métricas que la IA evalúa automáticamente al finalizar el escenario. Cada KPI tiene un umbral mínimo de aprobación (%).
                </p>
                <div className="border rounded-lg p-3 space-y-2 bg-yellow-50">
                  <div className="grid grid-cols-3 gap-2">
                    <Input value={newKpi.name} onChange={e => setNewKpi(n => ({ ...n, name: e.target.value }))} placeholder="Nombre del KPI" />
                    <Input type="number" min={0} max={100} value={newKpi.threshold} onChange={e => setNewKpi(n => ({ ...n, threshold: parseInt(e.target.value) }))} placeholder="Umbral %" className="w-24" />
                    <Input value={newKpi.description} onChange={e => setNewKpi(n => ({ ...n, description: e.target.value }))} placeholder="Descripción breve" />
                  </div>
                  <Button type="button" size="sm" onClick={addKpi} disabled={!newKpi.name}>
                    <Plus className="w-3 h-3 mr-1" /> Agregar KPI
                  </Button>
                </div>
                {form.expected_outcomes.kpis?.map((kpi, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm bg-yellow-50 border px-3 py-2 rounded mb-1">
                    <Target className="w-4 h-4 text-yellow-600 shrink-0" />
                    <span className="font-medium flex-1">{kpi.name}</span>
                    <span className="text-xs bg-yellow-200 px-2 py-0.5 rounded">≥ {kpi.threshold}%</span>
                    <span className="text-xs text-gray-500 flex-1">{kpi.description}</span>
                    <button onClick={() => updateOutcomes({ kpis: form.expected_outcomes.kpis.filter((_, j) => j !== i) })} className="text-red-400">✕</button>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          {/* Save button */}
          <div className="flex justify-end gap-3 pt-4 border-t mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700">
              {saving ? 'Guardando...' : editingId ? '💾 Actualizar Escenario' : '✅ Crear Escenario'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
