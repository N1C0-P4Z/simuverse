'use client'
import { AssignmentsABM } from '@/components/AssignmentsABM';
import { CategoriesABM } from '@/components/CategoriesABM';
import { CompaniesABM } from '@/components/CompaniesABM';
import { DocumentsABM } from '@/components/DocumentsABM';
import { PracticesABM } from '@/components/PracticesABM';
import { EndorsersABM } from '@/components/EndorsersABM';
import { FoundationABM } from '@/components/FoundationABM';
import { GlobalStatsDashboard } from '@/components/GlobalStatsDashboard';
import { PromptTemplatesABM } from '@/components/PromptTemplatesABM';
import { ReportsABM } from '@/components/ReportsABM';
import { RolesABM } from '@/components/RolesABM';
import { ScenariosABM } from '@/components/ScenariosABM';
import { SponsorsABM } from '@/components/SponsorsABM';
import { SimulationCalendar } from '@/components/SimulationCalendar';
import TeacherSessionsPage from '@/views/TeacherSessionsPage';
import { TeacherGroupsABM } from '@/components/TeacherGroupsABM';
import { TechSheetsABM } from '@/components/TechSheetsABM';
import { TermsABM } from '@/components/TermsABM';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { UsersABM } from '@/components/UsersABM';
import { useAuth } from '@/hooks/useAuth';
import { useAdmin } from '@/lib/admin-context';
import { apiClient } from '@/services/ApiClient';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Copy, Plus, Power, Save, Settings, Shield, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

const AVAILABLE_MODULES = [
  { id: 'chat_ia', label: 'Chat IA (Simulación Conversacional)' },
  { id: 'email_simulado', label: 'Email Simulado' },
  { id: 'documentos', label: 'Carpeta de Documentos' },
  { id: 'hoja_calculo', label: 'Hoja de Cálculo' },
  { id: 'crisis_engine', label: 'Motor de Crisis' },
];

interface CrisisEventConfig {
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  options: [
    { text: string; score: number; feedback: string },
    { text: string; score: number; feedback: string },
    { text: string; score: number; feedback: string },
  ];
}

interface CourseForm {
  course_id: string;
  title: string;
  description: string;
  category: string;
  modules: string[];
  eval_criteria: string[];
  crisis_events: CrisisEventConfig[];
  is_active: boolean;
  categories: string[];
  endorser_ids: number[];
  company_ids: number[];
  foundation_ids: number[];
  sponsor_ids: number[];
  password: string;
  clear_password: boolean;
  drive_folder_url: string;
  teacher_ids: string[];
}

const emptyForm: CourseForm = {
  course_id: '',
  title: '',
  description: '',
  category: 'general',
  modules: ['chat_ia'],
  eval_criteria: [],
  crisis_events: [],
  is_active: true,
  categories: [],
  endorser_ids: [],
  company_ids: [],
  foundation_ids: [],
  sponsor_ids: [],
  password: '',
  clear_password: false,
  drive_folder_url: '',
  teacher_ids: [],
};

const AdminPanel = ({ tabId }: { tabId?: string }) => {
  const { user, hasRole, loading } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<any[]>([]);
  const [dbCategories, setDbCategories] = useState<Array<{ id: number; name: string; code: string }>>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [simCompanies, setSimCompanies] = useState<Array<{ id: number; name: string; short_name?: string }>>([]);
  const [endorsersList, setEndorsersList] = useState<Array<{ id: number; name: string }>>([]);
  const [foundationsList, setFoundationsList] = useState<Array<{ id: number; name: string }>>([]);
  const [sponsorsList, setSponsorsList] = useState<Array<{ id: number; name: string }>>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CourseForm>({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingRequiresPassword, setEditingRequiresPassword] = useState(false);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [newCriterion, setNewCriterion] = useState('');
  const [showCrisisForm, setShowCrisisForm] = useState(false);
  const [expandedCrisis, setExpandedCrisis] = useState<number | null>(null);
  const emtpyCrisisEvent: CrisisEventConfig = {
    title: '',
    description: '',
    severity: 'medium',
    options: [
      { text: '', score: 90, feedback: '' },
      { text: '', score: 55, feedback: '' },
      { text: '', score: 20, feedback: '' },
    ],
  };
  const [newCrisis, setNewCrisis] = useState<CrisisEventConfig>({ ...emtpyCrisisEvent, options: [...emtpyCrisisEvent.options] as CrisisEventConfig['options'] });
  const { currentTab: contextTab, setCurrentTab, isInitialized } = useAdmin();
  const currentTab = tabId || contextTab;
  const [showPromptConfigModal, setShowPromptConfigModal] = useState(false);
  const [selectedCourseForPromptConfig, setSelectedCourseForPromptConfig] = useState<any>(null);
  const [courseFilter, setCourseFilter] = useState<'all' | 'active' | 'inactive'>('all'); // Filtro de cursos
  const [hardDeleteCourseId, setHardDeleteCourseId] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [formErrors, setFormErrors] = useState<{
    course_id?: string;
    title?: string;
    description?: string;
    categories?: string;
    teacher_ids?: string;
  }>({});

  useEffect(() => {
    if (!loading && (!user || (!hasRole('admin') && !hasRole('ministerio')))) router.push('/auth');
  }, [user, loading, hasRole, router]);

  const fetchCourses = async () => {
    setLoadingCourses(true);
    try {
      const res = await apiClient.get('/courses');
      if (res.data) setCourses(res.data);
    } catch (error) {
      console.error('Error fetching courses:', error);
      toast.error('Error al cargar los cursos');
    } finally {
      setLoadingCourses(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchCourses();
      // Cargar categorías
      apiClient.get('/categories/dropdown/list')
        .then(r => setDbCategories(Array.isArray(r.data) ? r.data : []))
        .catch(() => {});
      apiClient.get('/simulated-companies')
        .then(r => { const d = r.data?.data ?? r.data; return d; })
        .then(d => setSimCompanies(Array.isArray(d) ? d.map((c: any) => ({ id: c.id, name: c.name, short_name: c.short_name })) : []))
        .catch(() => {});
      apiClient.get('/endorsers')
        .then(r => { const d = r.data?.data ?? r.data; return d; })
        .then(d => setEndorsersList(Array.isArray(d) ? d.map((e: any) => ({ id: e.id, name: e.name })) : []))
        .catch(() => {});
      apiClient.get('/foundation-config')
        .then(r => { const d = r.data?.data ?? r.data; return d; })
        .then(d => setFoundationsList(Array.isArray(d) ? d.map((f: any) => ({ id: f.id, name: f.name })) : []))
        .catch(() => {});
      apiClient.get('/sponsors')
        .then(r => { const d = r.data?.data ?? r.data; return d; })
        .then(d => setSponsorsList(Array.isArray(d) ? d.map((s: any) => ({ id: s.id, name: s.name })) : []))
        .catch(() => {});
      apiClient.get('/users?role=teacher')
        .then(r => { const d = r.data?.data ?? r.data; return d; })
        .then(d => setTeachers(Array.isArray(d) ? d : []))
        .catch(() => {});
    }
  }, [user]);

  const handleSave = async () => {
    const errors: typeof formErrors = {};
    if (!form.course_id.trim()) errors.course_id = 'Completá el ID del curso';
    if (!form.title.trim()) errors.title = 'Completá el título';
    if (!form.description.trim()) errors.description = 'Completá la descripción';
    if (form.categories.length < 1) errors.categories = 'Seleccioná al menos 1 categoría';
    if (form.teacher_ids.length < 1) errors.teacher_ids = 'Asociá al menos 1 profesor';

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error('Completá los campos obligatorios marcados en rojo');
      return;
    }

    setSaving(true);
    const payload = {
      course_id: form.course_id,
      title: form.title,
      description: form.description,
      category: form.categories[0] || form.category || 'general',
      categories: form.categories,
      modules: form.modules.filter((m) => m !== 'evaluacion_auto') as any,
      eval_criteria: form.eval_criteria as any,
      crisis_events: form.crisis_events as any,
      is_active: form.is_active,
      endorser_ids: form.endorser_ids,
      company_ids: form.company_ids,
      foundation_ids: form.foundation_ids,
      sponsor_ids: form.sponsor_ids,
      created_by: user!.id,
      teacher_ids: form.teacher_ids,
      drive_folder_url: form.drive_folder_url.trim() || null,
      ...(form.password ? { password: form.password } : {}),
      ...(form.clear_password ? { clear_password: true } : {}),
    };

    try {
      let res;
      if (editingId) {
        res = await apiClient.put(`/courses/${editingId}`, payload);
      } else {
        res = await apiClient.post('/courses', payload);
      }
      const plain = res?.data?.password_plain;
      toast.success(editingId ? 'Curso actualizado' : 'Curso creado');
      if (plain) {
        setRevealedPassword(plain);
      }
      setDialogOpen(false);
      setForm({ ...emptyForm });
      setFormErrors({});
      setEditingId(null);
      setEditingRequiresPassword(false);
      fetchCourses();
    } catch (error: any) {
      toast.error(error.message || 'Error al guardar el curso');
    }
    setSaving(false);
  };

  const handleEdit = (course: any) => {
    setFormErrors({});
    setForm({
      course_id: course.course_id,
      title: course.title,
      description: course.description || '',
      category: course.category || 'general',
      categories: Array.isArray(course.categories) ? course.categories : (course.category ? [course.category] : ['general']),
      modules: (course.modules || []).filter((m: string) => m !== 'evaluacion_auto'),
      eval_criteria: course.eval_criteria || [],
      crisis_events: course.crisis_events || [],
      is_active: course.is_active,
      endorser_ids: Array.isArray(course.course_endorsers) ? course.course_endorsers.map((ce: any) => ce.endorser_id) : [],
      company_ids: Array.isArray(course.course_simulated_companies) ? course.course_simulated_companies.map((c: any) => c.simulated_company_id) : [],
      foundation_ids: Array.isArray(course.course_foundation_configs) ? course.course_foundation_configs.map((f: any) => f.foundation_config_id) : [],
      sponsor_ids: Array.isArray(course.course_sponsors) ? course.course_sponsors.map((s: any) => s.sponsor_id) : [],
      password: '',
      clear_password: false,
      drive_folder_url: course.drive_folder_url || '',
      teacher_ids: Array.isArray(course.teachers)
        ? course.teachers.map((t: any) => t.teacher?.id || t.teacher_id || t.id).filter(Boolean)
        : [],
    });
    setEditingRequiresPassword(!!course.requires_password);
    setEditingId(course.id);
    setDialogOpen(true);
  };

  const handleRegeneratePassword = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await apiClient.post(`/courses/${editingId}/regenerate-password`);
      const plain = res?.data?.password_plain;
      if (plain) {
        setRevealedPassword(plain);
        setEditingRequiresPassword(true);
        setForm((p) => ({ ...p, password: '', clear_password: false }));
        toast.success('Contraseña regenerada');
        fetchCourses();
      } else {
        toast.error('No se recibió la nueva contraseña');
      }
    } catch (error: any) {
      toast.error(error.message || 'Error al regenerar contraseña');
    }
    setSaving(false);
  };

  const handleDelete = (id: string) => {
    toast.error('⚠️ ¿Desactivar este curso? Las dependencias se mantendrán pero quedarán ocultas.', {
      action: {
        label: 'Desactivar',
        onClick: async () => {
          try {
            const response = await apiClient.delete(`/admin/courses/${id}`);
            toast.success(response.data.message || 'Curso desactivado');
            fetchCourses();
          } catch (error: any) {
            if (error.response?.status === 409) {
              const data = error.response.data;
              toast.error(
                `❌ No se puede desactivar.\n\n${data.reason}\n\n` +
                `Asignaciones activas: ${data.activeAssignments}\n` +
                `Asignaciones completadas: ${data.completedAssignments}\n\n` +
                `💡 ${data.suggestion}`
              );
            } else {
              toast.error(error.message || 'Error al desactivar el curso');
            }
          }
        },
      },
      duration: 5000,
    });
  };

  const handleReactivate = async (id: string) => {
    try {
      await apiClient.put(`/admin/courses/${id}/reactivate`);
      toast.success('Curso reactivado');
      fetchCourses();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al reactivar el curso');
    }
  };

  const handlePermanentDelete = async (id: string) => {
    try {
      await apiClient.delete(`/courses/${id}/permanent`);
      toast.success('Curso eliminado permanentemente');
      setHardDeleteCourseId(null);
      fetchCourses();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Error al eliminar el curso');
    }
  };

  const handleDuplicate = async (course: any) => {
    // Generar ID único con timestamp + random para permitir duplicados múltiples
    const random = Math.random().toString(36).substring(2, 8);
    const safeCourseId = course.course_id.substring(0, 20); // Keep max 20 chars of original
    const newId = `${safeCourseId}-CPY-${random}`.substring(0, 36);
    
    const payload = {
      course_id: newId,
      title: course.title + ` (Copia ${new Date().toLocaleTimeString()})`,
      description: course.description || '',
      category: course.category,
      categories: Array.isArray(course.categories) ? course.categories : (course.category ? [course.category] : []),
      modules: (course.modules || []).filter((m: string) => m !== 'evaluacion_auto'),
      eval_criteria: course.eval_criteria || [],
      crisis_events: course.crisis_events || [],
      is_active: false, // Las copias comienzan como inactivas
      endorser_ids: Array.isArray(course.course_endorsers) ? course.course_endorsers.map((ce: any) => ce.endorser_id) : [],
      company_ids: Array.isArray(course.course_simulated_companies) ? course.course_simulated_companies.map((c: any) => c.simulated_company_id) : [],
      foundation_ids: Array.isArray(course.course_foundation_configs) ? course.course_foundation_configs.map((f: any) => f.foundation_config_id) : [],
      sponsor_ids: Array.isArray(course.course_sponsors) ? course.course_sponsors.map((s: any) => s.sponsor_id) : [],
      created_by: user!.id,
    };
    try {
      await apiClient.post('/courses', payload);
      toast.success(`Copia creada: "${payload.title}"`);
      fetchCourses();
    } catch (e: any) {
      toast.error(e.message || 'Error al duplicar el curso');
    }
  };

  const toggleModule = (mod: string) => {
    setForm(prev => ({
      ...prev,
      modules: prev.modules.includes(mod) ? prev.modules.filter(m => m !== mod) : [...prev.modules, mod],
    }));
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        {hasRole('ministerio') && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800 flex items-center gap-3">
            <Shield className="w-5 h-5 shrink-0" />
            <span><strong>Modo solo lectura — Ministerio.</strong> Podés ver toda la configuración pero no crear, editar ni eliminar.</span>
          </div>
        )}
        {/* Courses Tab */}
        {currentTab === 'courses' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-2xl font-bold">Gestión de Cursos</h2>
                <p className="text-gray-600 mt-1">Crea, edita y configura los cursos disponibles</p>
              </div>
              <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setForm({ ...emptyForm }); setFormErrors({}); setEditingId(null); setEditingRequiresPassword(false); } }}>
                {!hasRole('ministerio') && (
                <DialogTrigger asChild>
                  <Button onClick={() => { setEditingRequiresPassword(false); setFormErrors({}); setForm({ ...emptyForm }); }}><Plus className="w-4 h-4 mr-2" /> Nuevo Curso</Button>
                </DialogTrigger>
                )}
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingId ? 'Editar Curso' : hasRole('ministerio') ? 'Ver Curso' : 'Crear Nuevo Curso'}</DialogTitle>
                    <DialogDescription>Configure los módulos, criterios de evaluación y opciones del curso. Los campos con * son obligatorios.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6 mt-4">
                    {/* Basic info */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>ID del Curso <span className="text-red-600">*</span></Label>
                        <Input
                          value={form.course_id}
                          onChange={e => {
                            setForm(p => ({ ...p, course_id: e.target.value }));
                            if (formErrors.course_id) setFormErrors(prev => ({ ...prev, course_id: undefined }));
                          }}
                          placeholder="SEGUROS_01"
                          className={formErrors.course_id ? 'border-red-500 focus-visible:ring-red-500' : ''}
                          aria-invalid={!!formErrors.course_id}
                        />
                        {formErrors.course_id && <p className="text-xs text-red-600">{formErrors.course_id}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">
                          Categorías <span className="text-red-600">*</span>{' '}
                          <span className="text-gray-400 font-normal">(al menos 1)</span>
                        </Label>
                        <div className="flex items-center gap-2 mb-2">
                          <input 
                            type="checkbox"
                            checked={form.categories.length === dbCategories.length && dbCategories.length > 0}
                            onChange={() => {
                              setForm(p => ({ ...p, categories: p.categories.length === dbCategories.length ? [] : dbCategories.map(c => c.code) }));
                              if (formErrors.categories) setFormErrors(prev => ({ ...prev, categories: undefined }));
                            }}
                            className="rounded"
                          />
                          <span className="text-sm font-medium">Seleccionar todas</span>
                        </div>
                        <div className={`border rounded-lg p-2 bg-white max-h-36 overflow-y-auto flex flex-wrap gap-2 ${formErrors.categories ? 'border-red-500' : ''}`}>
                          {dbCategories.map(cat => (
                            <label key={cat.code} className={`flex items-center gap-2 p-1 rounded cursor-pointer ${form.categories.includes(cat.code) ? 'bg-blue-50' : ''}`}>
                              <input 
                                type="checkbox"
                                checked={form.categories.includes(cat.code)}
                                onChange={() => {
                                  setForm(p => ({ ...p, categories: p.categories.includes(cat.code) ? p.categories.filter(c => c !== cat.code) : [...p.categories, cat.code] }));
                                  if (formErrors.categories) setFormErrors(prev => ({ ...prev, categories: undefined }));
                                }}
                                className="rounded"
                              />
                              <span className="text-xs capitalize">{cat.name}</span>
                            </label>
                          ))}
                        </div>
                        {formErrors.categories && <p className="text-xs text-red-600">{formErrors.categories}</p>}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Título <span className="text-red-600">*</span></Label>
                      <Input
                        value={form.title}
                        onChange={e => {
                          setForm(p => ({ ...p, title: e.target.value }));
                          if (formErrors.title) setFormErrors(prev => ({ ...prev, title: undefined }));
                        }}
                        placeholder="Simulación de Seguros de Vida"
                        className={formErrors.title ? 'border-red-500 focus-visible:ring-red-500' : ''}
                        aria-invalid={!!formErrors.title}
                      />
                      {formErrors.title && <p className="text-xs text-red-600">{formErrors.title}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label>Descripción <span className="text-red-600">*</span></Label>
                      <Textarea
                        value={form.description}
                        onChange={e => {
                          setForm(p => ({ ...p, description: e.target.value }));
                          if (formErrors.description) setFormErrors(prev => ({ ...prev, description: undefined }));
                        }}
                        placeholder="El alumno actuará como asesor de seguros..."
                        className={formErrors.description ? 'border-red-500 focus-visible:ring-red-500' : ''}
                        aria-invalid={!!formErrors.description}
                      />
                      {formErrors.description && <p className="text-xs text-red-600">{formErrors.description}</p>}
                    </div>

                    {/* Modules */}
                    <div className="space-y-2">
                      <Label className="text-base font-semibold">Módulos</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {AVAILABLE_MODULES.map(mod => (
                          <label key={mod.id} className="flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                            <Switch checked={form.modules.includes(mod.id)} onCheckedChange={() => toggleModule(mod.id)} />
                            <span className="text-sm">{mod.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Eval criteria */}
                    <div className="space-y-2">
                      <Label className="text-base font-semibold">📊 Criterios de Evaluación (KPIs)</Label>

                      <div className="flex gap-2">
                        <Input value={newCriterion} onChange={e => setNewCriterion(e.target.value)} placeholder="empatía, resolución, conocimiento técnico..." onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (newCriterion.trim()) { setForm(p => ({ ...p, eval_criteria: [...p.eval_criteria, newCriterion.trim()] })); setNewCriterion(''); } } }} />
                        <Button type="button" variant="outline" size="sm" onClick={() => { if (newCriterion.trim()) { setForm(p => ({ ...p, eval_criteria: [...p.eval_criteria, newCriterion.trim()] })); setNewCriterion(''); } }}>+</Button>
                      </div>
                      <div className="flex flex-wrap gap-1">{form.eval_criteria.map((c, i) => <Badge key={i} variant="outline" className="cursor-pointer" onClick={() => setForm(p => ({ ...p, eval_criteria: p.eval_criteria.filter((_, j) => j !== i) }))}>{c} ×</Badge>)}</div>
                    </div>

                    {/* ─── Crisis Engine Config ─────────────────────────────── */}
                    {form.modules.includes('crisis_engine') && (
                      <div className="space-y-3 p-4 rounded-lg border border-dashed border-orange-300 bg-orange-50/60 dark:bg-orange-950/20">
                        <div className="flex items-center justify-between">
                          <Label className="text-base font-semibold text-orange-800 dark:text-orange-300 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            🚨 Configuración del Motor de Crisis
                          </Label>
                          <Badge variant="outline" className="text-xs text-orange-700 border-orange-300">
                            {form.crisis_events.length} evento{form.crisis_events.length !== 1 ? 's' : ''} personalizado{form.crisis_events.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>

                        {/* Info sobre eventos built-in */}
                        <div className="bg-white/60 dark:bg-black/20 rounded-md px-3 py-2 text-xs text-orange-700 dark:text-orange-400 space-y-1">
                          <p className="font-semibold">Eventos incorporados según categoría del curso:</p>
                          <ul className="space-y-0.5 ml-2">
                            <li>• <strong>administracion / contable:</strong> Error en liquidación de sueldos · Auditoría AFIP sorpresa</li>
                            <li>• <strong>rrhh:</strong> Renuncia masiva · Denuncia por acoso laboral</li>
                            <li>• <strong>informatica:</strong> Servidor de producción caído · Brecha de seguridad activa</li>
                            <li>• <strong>emprendimiento / ventas / legal / general:</strong> Proveedor cancela contrato · Competidor lanza producto similar</li>
                          </ul>
                          <p className="mt-1 text-orange-600">Los eventos personalizados que agregues tendrán <strong>prioridad</strong> sobre los incorporados.</p>
                        </div>

                        {/* Lista de eventos personalizados existentes */}
                        {form.crisis_events.length > 0 && (
                          <div className="space-y-2">
                            {form.crisis_events.map((evt, idx) => (
                              <div key={idx} className="border border-orange-200 bg-white/80 dark:bg-black/20 rounded-md overflow-hidden">
                                <button
                                  type="button"
                                  className="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-orange-50/60 transition-colors"
                                  onClick={() => setExpandedCrisis(expandedCrisis === idx ? null : idx)}
                                >
                                  <span className="text-sm font-medium truncate">{evt.title || `Evento #${idx + 1}`}</span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <Badge variant="outline" className={`text-xs ${evt.severity === 'high' ? 'border-red-300 text-red-600' : evt.severity === 'medium' ? 'border-yellow-300 text-yellow-600' : 'border-green-300 text-green-600'}`}>
                                      {evt.severity === 'high' ? 'Alta' : evt.severity === 'medium' ? 'Media' : 'Baja'}
                                    </Badge>
                                    {expandedCrisis === idx ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                  </div>
                                </button>
                                {expandedCrisis === idx && (
                                  <div className="px-3 pb-3 pt-1 space-y-2 border-t border-orange-100">
                                    <div className="space-y-1">
                                      <Label className="text-xs">Título</Label>
                                      <Input
                                        value={evt.title}
                                        onChange={e => setForm(p => { const ev = [...p.crisis_events]; ev[idx] = { ...ev[idx], title: e.target.value }; return { ...p, crisis_events: ev }; })}
                                        className="text-sm h-8"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Descripción de la crisis</Label>
                                      <Textarea
                                        value={evt.description}
                                        onChange={e => setForm(p => { const ev = [...p.crisis_events]; ev[idx] = { ...ev[idx], description: e.target.value }; return { ...p, crisis_events: ev }; })}
                                        rows={2}
                                        className="text-sm"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-xs">Severidad</Label>
                                      <Select value={evt.severity} onValueChange={v => setForm(p => { const ev = [...p.crisis_events]; ev[idx] = { ...ev[idx], severity: v as any }; return { ...p, crisis_events: ev }; })}>
                                        <SelectTrigger className="text-sm h-8"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="low">🟢 Baja</SelectItem>
                                          <SelectItem value="medium">🟡 Media</SelectItem>
                                          <SelectItem value="high">🔴 Alta</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label className="text-xs font-semibold">Opciones de respuesta (A · B · C)</Label>
                                      {evt.options.map((opt, oi) => (
                                        <div key={oi} className="grid grid-cols-[1fr_64px] gap-2 items-start">
                                          <div className="space-y-1">
                                            <Input
                                              placeholder={`Opción ${String.fromCharCode(65 + oi)}: texto de respuesta...`}
                                              value={opt.text}
                                              onChange={e => setForm(p => { const ev = [...p.crisis_events]; const ops = [...ev[idx].options] as CrisisEventConfig['options']; ops[oi] = { ...ops[oi], text: e.target.value }; ev[idx] = { ...ev[idx], options: ops }; return { ...p, crisis_events: ev }; })}
                                              className="text-xs h-7"
                                            />
                                            <Input
                                              placeholder="Feedback pedagógico..."
                                              value={opt.feedback}
                                              onChange={e => setForm(p => { const ev = [...p.crisis_events]; const ops = [...ev[idx].options] as CrisisEventConfig['options']; ops[oi] = { ...ops[oi], feedback: e.target.value }; ev[idx] = { ...ev[idx], options: ops }; return { ...p, crisis_events: ev }; })}
                                              className="text-xs h-7 text-muted-foreground"
                                            />
                                          </div>
                                          <div className="space-y-1">
                                            <Label className="text-xs text-center block">Puntaje</Label>
                                            <Input
                                              type="number"
                                              min="0"
                                              max="100"
                                              value={opt.score}
                                              onChange={e => setForm(p => { const ev = [...p.crisis_events]; const ops = [...ev[idx].options] as CrisisEventConfig['options']; ops[oi] = { ...ops[oi], score: parseInt(e.target.value) || 0 }; ev[idx] = { ...ev[idx], options: ops }; return { ...p, crisis_events: ev }; })}
                                              className="text-xs h-7 text-center"
                                            />
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                    <Button
                                      type="button"
                                      variant="destructive"
                                      size="sm"
                                      className="w-full mt-1 h-7 text-xs"
                                      onClick={() => setForm(p => ({ ...p, crisis_events: p.crisis_events.filter((_, j) => j !== idx) }))}
                                    >
                                      <Trash2 className="w-3 h-3 mr-1" /> Eliminar evento
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Agregar nuevo evento */}
                        {!showCrisisForm ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
                            onClick={() => { setShowCrisisForm(true); setNewCrisis({ ...emtpyCrisisEvent, options: [...emtpyCrisisEvent.options] as CrisisEventConfig['options'] }); }}
                          >
                            <Plus className="w-4 h-4 mr-1" /> Agregar evento personalizado
                          </Button>
                        ) : (
                          <div className="border border-orange-300 bg-white/80 dark:bg-black/20 rounded-md p-3 space-y-3">
                            <Label className="text-sm font-semibold">Nuevo evento de crisis</Label>
                            <Input placeholder="Título del evento" value={newCrisis.title} onChange={e => setNewCrisis(p => ({ ...p, title: e.target.value }))} className="text-sm" />
                            <Textarea placeholder="Descripción detallada de la situación de crisis..." value={newCrisis.description} onChange={e => setNewCrisis(p => ({ ...p, description: e.target.value }))} rows={2} className="text-sm" />
                            <Select value={newCrisis.severity} onValueChange={v => setNewCrisis(p => ({ ...p, severity: v as any }))}>
                              <SelectTrigger className="text-sm h-8"><SelectValue placeholder="Severidad" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="low">🟢 Baja</SelectItem>
                                <SelectItem value="medium">🟡 Media</SelectItem>
                                <SelectItem value="high">🔴 Alta</SelectItem>
                              </SelectContent>
                            </Select>
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold">3 opciones de respuesta (la A debe ser la mejor)</Label>
                              {newCrisis.options.map((opt, oi) => (
                                <div key={oi} className="grid grid-cols-[1fr_64px] gap-2 items-start">
                                  <div className="space-y-1">
                                    <Input
                                      placeholder={`Opción ${String.fromCharCode(65 + oi)}: texto...`}
                                      value={opt.text}
                                      onChange={e => setNewCrisis(p => { const ops = [...p.options] as CrisisEventConfig['options']; ops[oi] = { ...ops[oi], text: e.target.value }; return { ...p, options: ops }; })}
                                      className="text-xs h-7"
                                    />
                                    <Input
                                      placeholder="Feedback..."
                                      value={opt.feedback}
                                      onChange={e => setNewCrisis(p => { const ops = [...p.options] as CrisisEventConfig['options']; ops[oi] = { ...ops[oi], feedback: e.target.value }; return { ...p, options: ops }; })}
                                      className="text-xs h-7 text-muted-foreground"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-center block">Pts</Label>
                                    <Input
                                      type="number" min="0" max="100"
                                      value={opt.score}
                                      onChange={e => setNewCrisis(p => { const ops = [...p.options] as CrisisEventConfig['options']; ops[oi] = { ...ops[oi], score: parseInt(e.target.value) || 0 }; return { ...p, options: ops }; })}
                                      className="text-xs h-7 text-center"
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                className="flex-1 bg-orange-600 hover:bg-orange-700"
                                onClick={() => {
                                  if (!newCrisis.title.trim()) return;
                                  setForm(p => ({ ...p, crisis_events: [...p.crisis_events, { ...newCrisis }] }));
                                  setShowCrisisForm(false);
                                }}
                              >
                                <Plus className="w-4 h-4 mr-1" /> Agregar
                              </Button>
                              <Button type="button" variant="ghost" size="sm" onClick={() => setShowCrisisForm(false)}>Cancelar</Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Asociaciones N a N */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">🏢 Empresas Simuladas <span className="text-gray-400 font-normal">(opcional)</span></Label>
                      <MultiSelect
                        items={simCompanies}
                        selected={form.company_ids}
                        onChange={ids => setForm(p => ({ ...p, company_ids: ids }))}
                        placeholder="Sin empresas simuladas"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">🤝 Avaladores <span className="text-gray-400 font-normal">(opcional)</span></Label>
                      <MultiSelect
                        items={endorsersList}
                        selected={form.endorser_ids}
                        onChange={ids => setForm(p => ({ ...p, endorser_ids: ids }))}
                        placeholder="Sin avaladores"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">🎓 Fundaciones <span className="text-gray-400 font-normal">(opcional)</span></Label>
                      <MultiSelect
                        items={foundationsList}
                        selected={form.foundation_ids}
                        onChange={ids => setForm(p => ({ ...p, foundation_ids: ids }))}
                        placeholder="Sin fundaciones"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">💼 Sponsors <span className="text-gray-400 font-normal">(opcional)</span></Label>
                      <MultiSelect
                        items={sponsorsList}
                        selected={form.sponsor_ids}
                        onChange={ids => setForm(p => ({ ...p, sponsor_ids: ids }))}
                        placeholder="Sin sponsors"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Link de Drive (archivos &gt; 5 MB)</Label>
                      <Input
                        type="url"
                        placeholder="https://drive.google.com/drive/folders/..."
                        value={form.drive_folder_url}
                        onChange={(e) => setForm((p) => ({ ...p, drive_folder_url: e.target.value }))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Si el alumno intenta subir un archivo mayor a 5 MB, se le mostrará este link.
                      </p>
                    </div>

                    {/* Active toggle */}
                    <div className="space-y-2">
                      <Label>Contraseña del curso (opcional)</Label>
                      {editingId && (
                        <p className="text-xs text-muted-foreground">
                          Estado:{' '}
                          {editingRequiresPassword && !form.clear_password
                            ? 'Con contraseña (no se puede ver la actual; regenerá o cambiá para obtener una nueva)'
                            : 'Acceso libre'}
                        </p>
                      )}
                      <Input
                        type="password"
                        name="course-enrollment-password"
                        autoComplete="new-password"
                        placeholder={editingId ? 'Dejar vacío para no cambiar' : 'Vacío = acceso libre'}
                        value={form.password}
                        onChange={(e) => setForm((p) => ({ ...p, password: e.target.value, clear_password: false }))}
                      />
                      {editingId && (
                        <div className="flex flex-wrap items-center gap-3">
                          <label className="flex items-center gap-2 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={form.clear_password}
                              onChange={(e) =>
                                setForm((p) => ({
                                  ...p,
                                  clear_password: e.target.checked,
                                  password: e.target.checked ? '' : p.password,
                                }))
                              }
                            />
                            Quitar contraseña (acceso libre)
                          </label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={saving || form.clear_password}
                            onClick={handleRegeneratePassword}
                          >
                            Regenerar contraseña
                          </Button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Docentes asociados <span className="text-red-600">*</span></Label>
                      <div className={`max-h-32 overflow-y-auto rounded border p-2 space-y-1 ${formErrors.teacher_ids ? 'border-red-500' : ''}`}>
                        {teachers.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No hay docentes cargados</p>
                        ) : (
                          teachers.map((t) => {
                            const checked = form.teacher_ids.includes(t.id);
                            return (
                              <label key={t.id} className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    setForm((p) => ({
                                      ...p,
                                      teacher_ids: checked
                                        ? p.teacher_ids.filter((id) => id !== t.id)
                                        : [...p.teacher_ids, t.id],
                                    }));
                                    if (formErrors.teacher_ids) setFormErrors(prev => ({ ...prev, teacher_ids: undefined }));
                                  }}
                                />
                                {t.name} <span className="text-xs text-muted-foreground">({t.email})</span>
                              </label>
                            );
                          })
                        )}
                      </div>
                      {formErrors.teacher_ids && <p className="text-xs text-red-600">{formErrors.teacher_ids}</p>}
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Curso Activo</Label>
                      <Switch checked={form.is_active} onCheckedChange={v => setForm(p => ({ ...p, is_active: v }))} />
                    </div>

                    {!hasRole('ministerio') && (
                    <Button className="w-full" onClick={handleSave} disabled={saving}>
                      <Save className="w-4 h-4 mr-2" /> {saving ? 'Guardando...' : editingId ? 'Actualizar Curso' : 'Crear Curso'}
                    </Button>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={!!revealedPassword} onOpenChange={(o) => { if (!o) setRevealedPassword(null); }}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Contraseña del curso</DialogTitle>
                    <DialogDescription>
                      Copiá y guardá esta contraseña ahora. No se podrá volver a ver; solo regenerarla.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex items-center gap-2">
                    <Input readOnly value={revealedPassword || ''} className="font-mono" />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        if (!revealedPassword) return;
                        try {
                          await navigator.clipboard.writeText(revealedPassword);
                          toast.success('Contraseña copiada');
                        } catch {
                          toast.error('No se pudo copiar');
                        }
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="flex gap-2 mb-4">
              <Button 
                variant={courseFilter === 'all' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setCourseFilter('all')}
                className="gap-2"
              >
                <Settings className="w-4 h-4" />
                Todos ({courses.length})
              </Button>
              <Button 
                variant={courseFilter === 'active' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setCourseFilter('active')}
                className="gap-2"
              >
                <Badge variant="default" className="text-xs bg-green-600">✓</Badge>
                Activos ({courses.filter(c => c.is_active).length})
              </Button>
              <Button 
                variant={courseFilter === 'inactive' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setCourseFilter('inactive')}
                className="gap-2"
              >
                <Badge variant="secondary" className="text-xs bg-gray-400">✕</Badge>
                Inactivos ({courses.filter(c => !c.is_active).length})
              </Button>
            </div>

            <div className="grid gap-4">
              {courses
                .filter(course => {
                  if (courseFilter === 'active') return course.is_active;
                  if (courseFilter === 'inactive') return !course.is_active;
                  return true; // 'all'
                })
                .map(course => (
                <Card key={course.id} className={`glass-card ${!course.is_active ? 'opacity-60' : ''}`}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{course.title}</h3>
                        {Array.isArray(course.categories) && course.categories.length > 0
                          ? course.categories.map((cat: string) => <Badge key={cat} variant="secondary" className="text-xs capitalize">{cat}</Badge>)
                          : <Badge variant="secondary" className="text-xs">{course.category}</Badge>
                        }
                        {course.is_active 
                          ? <Badge variant="default" className="text-xs bg-green-600">✓ Activo</Badge>
                          : <Badge variant="secondary" className="text-xs bg-gray-400">✕ Inactivo</Badge>
                        }
                        {course.requires_password
                          ? <Badge variant="outline" className="text-xs">Con contraseña</Badge>
                          : <Badge variant="outline" className="text-xs text-muted-foreground">Acceso libre</Badge>
                        }
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{course.course_id} — {(course.modules as string[])?.join(', ')}</p>
                    </div>
                    <div className="flex gap-2">
                      {!hasRole('ministerio') && (
                        <>
                      <Button variant="outline" size="sm" title="Duplicar curso" onClick={() => handleDuplicate(course)}>
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleEdit(course)}>
                        <Settings className="w-4 h-4" />
                      </Button>
                      {course.is_active ? (
                        <Button variant="outline" size="sm" className="text-amber-600 border-amber-300" onClick={() => handleDelete(course.id)} title="Desactivar curso">
                          <Power className="w-4 h-4" />
                        </Button>
                      ) : (
                        <>
                          <Button variant="outline" size="sm" className="text-green-600 border-green-300" onClick={() => handleReactivate(course.id)} title="Reactivar curso">
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                          {hasRole('admin') && (
                            <Button variant="destructive" size="sm" onClick={() => setHardDeleteCourseId(course.id)} title="Eliminar permanentemente">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </>
                      )}
                        </>
                      )}
                      {hasRole('ministerio') && (
                        <Button variant="outline" size="sm" onClick={() => handleEdit(course)}>
                          <Settings className="w-4 h-4" /> Ver
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {loadingCourses ? (
                <div className="text-center py-16 text-muted-foreground flex flex-col items-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                  <p>Cargando cursos...</p>
                </div>
              ) : courses.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No hay cursos configurados. Cree el primero.</p>
                </div>
              ) : null}
              {!loadingCourses && courses.length > 0 && courses.filter(c => {
                if (courseFilter === 'active') return c.is_active;
                if (courseFilter === 'inactive') return !c.is_active;
                return true;
              }).length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>
                    No hay cursos {courseFilter === 'active' ? 'activos' : courseFilter === 'inactive' ? 'inactivos' : ''}.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Categories Tab */}
        {currentTab === 'categories' && <CategoriesABM />}

        {/* Documents Tab */}
        {currentTab === 'documents' && <DocumentsABM />}
        {currentTab === 'practices' && <PracticesABM />}

        {/* Tech Sheets Tab */}
        {currentTab === 'techsheets' && <TechSheetsABM />}

        {/* Assignments Tab */}
        {currentTab === 'assignments' && <AssignmentsABM />}

        {/* Reports Tab */}
        {currentTab === 'reports' && <ReportsABM />}

        {/* Scenarios Tab */}
        {currentTab === 'scenarios' && <ScenariosABM />}

        {/* Prompt Templates Tab — prompts from tech sheet analysis, per course */}
        {currentTab === 'prompt-templates' && <PromptTemplatesABM />}

        {/* Redirect legacy plantillas tab */}
        {currentTab === 'templates' && <PromptTemplatesABM />}

        {/* Sessions Tab - Solo admin/teacher */}
        {currentTab === 'sessions' && <TeacherSessionsPage />}

        {/* Users Tab */}
        {currentTab === 'users' && <UsersABM />}

        {/* Roles & Permissions Tab */}
        {currentTab === 'roles' && <RolesABM />}

        {/* Stats Tab */}
        {currentTab === 'stats' && <GlobalStatsDashboard />}

        {/* Terms Tab */}
        {currentTab === 'terms' && <TermsABM />}

        {/* Teacher Groups Tab */}
        {currentTab === 'groups' && <TeacherGroupsABM />}

        {/* Calendar Tab */}
        {currentTab === 'calendar' && <SimulationCalendar />}

        {/* Companies Tab */}
        {currentTab === 'companies' && <CompaniesABM />}

        {/* Foundation Tab */}
        {currentTab === 'foundation' && <FoundationABM />}

        {/* Endorsers Tab */}
        {currentTab === 'endorsers' && <EndorsersABM />}

        {currentTab === 'sponsors' && <SponsorsABM />}
      </main>

      {/* Confirmación de eliminación permanente de curso */}
      <AlertDialog open={!!hardDeleteCourseId} onOpenChange={o => { if (!o) setHardDeleteCourseId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">Eliminar curso permanentemente</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es irreversible. Se eliminará el curso y todos sus datos asociados
              (escenarios, prácticas, simulaciones, evaluaciones, configuración y documentos).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-700 hover:bg-red-800"
              onClick={() => hardDeleteCourseId && handlePermanentDelete(hardDeleteCourseId)}
            >
              Sí, eliminar permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminPanel;
