'use client'
import { toast } from 'sonner';
/**
 * TemplatesABM.tsx
 * Creador de Plantillas de Curso con Asistente IA
 * 
 * Flujo:
 * 1. Admin elige la familia/rubro del curso
 * 2. El Asistente IA hace preguntas guiadas
 * 3. Con las respuestas genera una plantilla completa (módulos + ai_config)
 * 4. El admin la revisa, ajusta y guarda en BD
 */
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAdmin } from '@/lib/admin-context';
import { apiClient } from '@/services/ApiClient';
import { usePagination } from '@/hooks/usePagination';
import {
    Bot,
    Calculator,
    CheckCircle2,
    ChevronRight, Copy,
    Edit2,
    FileText,
    Layers,
    Mail,
    MessageSquare,
    Plus,
    RefreshCw,
    Save,
    Send,
    Trash2,
    Wand2,
    Zap
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Template {
  id: string;
  course_id: string;
  course_code: string;
  title: string;
  family: string;
  description: string;
  version: string;
  template_data: any;
  is_active: boolean;
  created_at: string;
}

interface ChatMessage {
  role: 'ai' | 'user';
  text: string;
}

// ─── Lego module definitions ──────────────────────────────────────────────────

export const LEGO_MODULES = [
  {
    id: 'chat_ia',
    label: '💬 Chat IA',
    icon: MessageSquare,
    color: 'blue',
    description: 'El alumno conversa en tiempo real con un personaje interpretado por la IA (cliente, jefe, colega, auditor). Es el motor central de la simulación.',
    use_cases: ['Atención al cliente', 'Negociación', 'Entrevista de RRHH', 'Consulta legal'],
  },
  {
    id: 'email_simulado',
    label: '📧 Email Simulado',
    icon: Mail,
    color: 'purple',
    description: 'El alumno tiene una bandeja de entrada con emails pre-cargados que le dan contexto. Puede leer los mails y usarlos para resolver el escenario.',
    use_cases: ['Emails de IT con alertas', 'Comunicados internos', 'Emails de clientes/proveedores', 'Notificaciones de sistemas'],
  },
  {
    id: 'documentos',
    label: '📄 Documentos',
    icon: FileText,
    color: 'green',
    description: 'El alumno tiene acceso a una carpeta con documentos del escenario (manuales, contratos, normativas, procedimientos). Los necesita para dar respuestas correctas.',
    use_cases: ['Manual de atención al cliente', 'Normativa AFIP', 'Contrato laboral', 'Política de devoluciones'],
  },
  {
    id: 'hoja_calculo',
    label: '🧮 Hoja de Cálculo',
    icon: Calculator,
    color: 'orange',
    description: 'El alumno tiene una planilla con datos numéricos (facturas, stock, sueldos, cotizaciones). Debe usarla para tomar decisiones o argumentar.',
    use_cases: ['Liquidación de sueldos', 'Cálculo de impuestos', 'Análisis de ventas', 'Balance contable'],
  },
  {
    id: 'crisis_engine',
    label: '🚨 Motor de Crisis',
    icon: Zap,
    color: 'red',
    description: 'Eventos inesperados que se disparan durante la simulación (a los X minutos) para aumentar la presión. Por ejemplo: "El cliente amenaza con llamar a un abogado" o "El sistema cae".',
    use_cases: ['Escalada de cliente', 'Falla técnica', 'Cambio de requerimiento', 'Aparece un tercero'],
  },
  {
    id: 'evaluacion_auto',
    label: '📊 Evaluación Auto',
    icon: Zap,
    color: 'teal',
    description: 'Al terminar la simulación, la IA analiza la conversación completa y genera un reporte con score por KPI (empatía, resolución, conocimiento técnico, etc.).',
    use_cases: ['Siempre recomendado para escenarios de evaluación'],
  },
];

// ─── AI Conversation script ───────────────────────────────────────────────────

const AI_QUESTIONS = [
  {
    id: 'rubro',
    ai: '¡Hola! Soy tu asistente para crear plantillas de cursos 🎓\n\n¿En qué rubro o área se va a capacitar el alumno? Ejemplos: *ventas*, *RRHH*, *contabilidad*, *atención al cliente*, *derecho laboral*, *tecnología*, *logística*...',
  },
  {
    id: 'personaje',
    ai: '¡Perfecto! Ahora, ¿qué personaje va a interpretar la IA durante la simulación?\n\n👉 Pensá en alguien que el alumno tendría que atender, negociar o interactuar en ese rubro. Ejemplos: *un cliente enojado*, *un auditor de AFIP*, *un empleado conflictivo*, *un proveedor que no quiere bajar el precio*...',
  },
  {
    id: 'conflicto',
    ai: '¿Cuál es el conflicto o situación central del escenario?\n\n👉 ¿Qué problema concreto tiene que resolver el alumno? Cuanto más específico, mejor. Ej: *"El cliente pagó pero el sistema no procesó el pedido"*, *"El empleado llegó tarde 5 veces y niega los hechos"*, *"La declaración jurada tiene un descuadre de $2M"*',
  },
  {
    id: 'objetivo',
    ai: '¿Cuál es el objetivo que debe lograr el alumno para "ganar" el escenario?\n\n👉 ¿Qué tiene que haber logrado al terminar? Ej: *"Que el cliente quede conforme y no haga el reclamo"*, *"Llegar a un plan de mejora aceptado por el empleado"*, *"Justificar el descuadre con documentación"*',
  },
  {
    id: 'modulos',
    ai: '¿Qué herramientas necesita el alumno en el simulador? Podés elegir varias:\n\n💬 **Chat IA** → Para conversar con el personaje (recomendado siempre)\n📧 **Email** → ¿Hay emails de contexto que el alumno necesita leer antes/durante?\n📄 **Documentos** → ¿Necesita consultar manuales, contratos o normativas?\n🧮 **Planilla** → ¿Hay números que calcular o analizar?\n🚨 **Crisis** → ¿Querés que aparezca una complicación imprevista?\n\nEscribí los que querés (ej: *chat, email, documentos*)',
  },
  {
    id: 'personalidad',
    ai: 'Por último, ¿cómo es la personalidad del personaje IA?\n\n👉 Describí cómo se comporta. Ej: *"Agresivo al principio, se calma si el alumno explica bien"*, *"Formal y riguroso, no acepta argumentos vagos"*, *"Emocional, necesita sentirse escuchado"*\n\nEstos rasgos definen cuándo la IA cede y cuándo se pone difícil 🧠',
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function TemplatesABM() {
  const { readOnly } = useAdmin();
  const { data: templates, total, page, totalPages, setPage, loading, setExtraParams, refresh } = usePagination<Template>({
    endpoint: '/templates/flow',
  });
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // AI wizard state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [step, setStep] = useState(0);
  const [showInactive, setShowInactive] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [generatedTemplate, setGeneratedTemplate] = useState<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Sync showInactive to pagination
  useEffect(() => {
    const params: Record<string, unknown> = {};
    if (showInactive) params.includeInactive = 'true';
    setExtraParams(params);
  }, [showInactive, setExtraParams]);

  // Form state (for both generated and manual edit)
  const [form, setForm] = useState({
    code: '',
    title: '',
    family: 'administracion',
    description: '',
    modules: ['chat_ia'] as string[],
    ai_config: {
      base_role: '',
      course_context: '',
      personality_traits: [] as string[],
      knowledge_base_prompt: '',
    },
    eval_criteria: [] as string[],
  });
  const [newTrait, setNewTrait] = useState('');
  const [newCriteria, setNewCriteria] = useState('');

  // ── Data ─────────────────────────────────────────────────────────────────────

  // ── AI Wizard ─────────────────────────────────────────────────────────────────

  const startWizard = () => {
    setMessages([{ role: 'ai', text: AI_QUESTIONS[0].ai }]);
    setStep(0);
    setAnswers({});
    setGeneratedTemplate(null);
    setInput('');
    setAiDialogOpen(true);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendAnswer = async () => {
    if (!input.trim()) return;
    const userText = input.trim();
    setInput('');
    const key = AI_QUESTIONS[step]?.id ?? 'extra';
    const newAnswers = { ...answers, [key]: userText };
    setAnswers(newAnswers);
    setMessages(m => [...m, { role: 'user', text: userText }]);

    if (step < AI_QUESTIONS.length - 1) {
      const nextStep = step + 1;
      setStep(nextStep);
      setTimeout(() => {
        setMessages(m => [...m, { role: 'ai', text: AI_QUESTIONS[nextStep].ai }]);
      }, 400);
    } else {
      // All questions answered - generate template
      setGenerating(true);
      setTimeout(() => {
        setMessages(m => [...m, { role: 'ai', text: '⚙️ Generando la plantilla... un momento...' }]);
      }, 300);
      const tpl = buildTemplateFromAnswers(newAnswers);
      setGeneratedTemplate(tpl);
      setTimeout(() => {
        setMessages(m => [...m,
          { role: 'ai', text: `✅ ¡Plantilla generada! Acá está el resumen:\n\n**Curso:** ${tpl.title}\n**Personaje IA:** ${tpl.ai_config.base_role.substring(0, 80)}...\n**Módulos:** ${tpl.modules.join(', ')}\n\n👇 Revisá y ajustá los detalles antes de guardar.` }
        ]);
        setGenerating(false);
      }, 1200);
    }
  };

  const buildTemplateFromAnswers = (a: Record<string, string>) => {
    // Parse modules from answer
    const modAnswer = (a.modulos || '').toLowerCase();
    const modules: string[] = ['chat_ia'];
    if (modAnswer.includes('email') || modAnswer.includes('correo')) modules.push('email_simulado');
    if (modAnswer.includes('doc')) modules.push('documentos');
    if (modAnswer.includes('planilla') || modAnswer.includes('calc') || modAnswer.includes('hoja')) modules.push('hoja_calculo');
    if (modAnswer.includes('crisis')) modules.push('crisis_engine');
    if (modAnswer.includes('eval')) modules.push('evaluacion_auto');

    // Parse traits from personality
    const personalityText = a.personalidad || '';
    const traits: string[] = [];
    const traitKeywords = ['agresivo', 'formal', 'emocional', 'riguroso', 'defensivo', 'impaciente',
      'exigente', 'desconfiado', 'amable', 'nervioso', 'profesional', 'informal'];
    traitKeywords.forEach(t => { if (personalityText.toLowerCase().includes(t)) traits.push(t); });

    // Map rubro to family
    const rubro = (a.rubro || '').toLowerCase();
    let family = 'administracion';
    if (rubro.includes('rrhh') || rubro.includes('recurso') || rubro.includes('personal')) family = 'rrhh';
    else if (rubro.includes('venta') || rubro.includes('comercial')) family = 'ventas';
    else if (rubro.includes('contab') || rubro.includes('impuesto') || rubro.includes('afip')) family = 'contable';
    else if (rubro.includes('legal') || rubro.includes('derecho') || rubro.includes('laboral')) family = 'legal';
    else if (rubro.includes('tecno') || rubro.includes('sistema') || rubro.includes('it')) family = 'tecnologia';
    else if (rubro.includes('atencion') || rubro.includes('cliente')) family = 'ventas';

    const title = `Simulador de ${a.rubro ? a.rubro.charAt(0).toUpperCase() + a.rubro.slice(1) : 'Práctica Profesional'}`;

    return {
      code: `COURSE-${family.toUpperCase()}-${Date.now().toString().slice(-6)}`,
      title,
      family,
      description: a.objetivo || '',
      modules,
      ai_config: {
        base_role: `Eres ${a.personaje || 'un personaje del escenario'}. ${a.conflicto ? 'El conflicto central es: ' + a.conflicto : ''}`,
        course_context: `${a.conflicto || ''}\n\nObjetivo del alumno: ${a.objetivo || ''}`,
        personality_traits: traits.length > 0 ? traits : [personalityText.split(' ')[0]?.toLowerCase() || 'exigente'],
        knowledge_base_prompt: `Comportamiento de la IA: ${a.personalidad || ''}\n\nEl alumno debe lograr: ${a.objetivo || ''}. Si el alumno cumple ese objetivo, responde positivamente. Si no lo hace, mantené la presión del escenario.`,
      },
      eval_criteria: a.objetivo ? [a.objetivo] : [],
    };
  };

  const useGeneratedTemplate = () => {
    if (!generatedTemplate) return;
    setForm(generatedTemplate);
    setAiDialogOpen(false);
    setEditDialogOpen(true);
    setEditingId(null);
  };

  // ── Save template ─────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!form.title || !form.code) {
      toast.error('El código y título son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        id: form.code,
        course_id: form.code,
        course_code: form.code,
        title: form.title,
        family: form.family,
        description: form.description,
        version: '1.0',
        template_data: {
          modules: form.modules,
          ai_config: form.ai_config,
          eval_criteria: form.eval_criteria,
        },
      };
      if (editingId) {
        await apiClient.put(`/templates/flow/${editingId}`, payload);
      } else {
        await apiClient.post('/templates/flow', payload);
      }
      setEditDialogOpen(false);
      setEditingId(null);
      refresh();
    } catch { toast.error('Error al guardar la plantilla'); }
    finally { setSaving(false); }
  };

  const handleDelete = (id: string) => {
    toast.error('¿Eliminar esta plantilla?', {
      action: {
        label: 'Eliminar',
        onClick: async () => {
          try {
            await apiClient.delete(`/templates/flow/${id}`);
            refresh();
            toast.success('Plantilla eliminada');
          } catch { toast.error('Error al eliminar la plantilla'); }
        },
      },
      duration: 5000,
    });
  };

  const handleReactivate = async (id: string) => {
    try {
      await apiClient.put(`/templates/flow/${id}`, { is_active: true });
      refresh();
      toast.success('Plantilla reactivada');
    } catch { toast.error('Error al reactivar'); }
  };

  const handleDuplicate = async (t: Template) => {
    const data = typeof t.template_data === 'string' ? JSON.parse(t.template_data || '{}') : (t.template_data || {});
    await apiClient.post('/templates/flow', {
      id: t.course_code + '-COPIA-' + Date.now().toString().slice(-4),
      course_id: t.course_code + '-COPIA',
      course_code: t.course_code + '-COPIA',
      title: t.title + ' (Copia)',
      family: t.family,
      description: t.description,
      version: t.version,
      template_data: JSON.stringify(data),
    });
    refresh();
  };

  const handleEdit = (t: Template) => {
    const data = typeof t.template_data === 'string' ? JSON.parse(t.template_data) : t.template_data;
    setForm({
      code: t.course_code,
      title: t.title,
      family: t.family,
      description: t.description || '',
      modules: data?.modules || ['chat_ia'],
      ai_config: data?.ai_config || { base_role: '', course_context: '', personality_traits: [], knowledge_base_prompt: '' },
      eval_criteria: data?.eval_criteria || [],
    });
    setEditingId(t.id);
    setEditDialogOpen(true);
  };

  const toggleModule = (id: string) =>
    setForm(f => ({ ...f, modules: f.modules.includes(id) ? f.modules.filter(m => m !== id) : [...f.modules, id] }));

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Plantillas de Curso</h2>
          <p className="text-gray-600 mt-1">
            Las plantillas son configuraciones reutilizables de cursos (módulos + prompt de IA).
            Podés crear una desde cero o usar el <span className="text-purple-700 font-semibold">Asistente IA</span> para que te guíe.
          </p>
        </div>
{!readOnly && <div className="flex gap-2">
          <Button onClick={startWizard} className="bg-purple-600 hover:bg-purple-700">
            <Wand2 className="w-4 h-4 mr-2" /> Crear con IA
          </Button>
          <Button variant="outline" onClick={() => { setForm({ code: '', title: '', family: 'administracion', description: '', modules: ['chat_ia'], ai_config: { base_role: '', course_context: '', personality_traits: [], knowledge_base_prompt: '' }, eval_criteria: [] }); setEditingId(null); setEditDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Manual
          </Button>
        </div>}
      </div>

      {/* Lego explainer */}
      <Card className="p-4 bg-purple-50 border-purple-200">
        <p className="text-sm font-semibold text-purple-900 mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4" /> ¿Qué hace cada módulo (Lego)?
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {LEGO_MODULES.map(mod => (
            <div key={mod.id} className="flex gap-2 text-xs">
              <span className="text-lg shrink-0">{mod.label.split(' ')[0]}</span>
              <div>
                <p className="font-semibold text-purple-900">{mod.label.substring(2)}</p>
                <p className="text-purple-700">{mod.description}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Toggle active/inactive */}
      <div className="flex gap-2 mb-4">
        <Button variant={!showInactive ? 'default' : 'outline'} size="sm" onClick={() => { setShowInactive(false); loadTemplates(); }}>
          Activos ({templates.filter((t: any) => t.is_active !== false).length})
        </Button>
        <Button variant={showInactive ? 'default' : 'outline'} size="sm" onClick={() => { setShowInactive(true); loadTemplates(); }}>
          Inactivos ({templates.filter((t: any) => t.is_active === false).length})
        </Button>
      </div>

      {/* Template list */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Cargando plantillas...</div>
      ) : templates.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          <Wand2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No hay plantillas guardadas.</p>
          <p className="text-sm mt-1">Usá el <strong>Asistente IA</strong> para crear la primera en minutos.</p>
{!readOnly && <Button onClick={startWizard} className="mt-4 bg-purple-600 hover:bg-purple-700">
            <Wand2 className="w-4 h-4 mr-2" /> Crear con IA
          </Button>}
        </Card>
      ) : (
        <div className="grid gap-3">
          {templates.map(t => {
            const data = typeof t.template_data === 'string' ? JSON.parse(t.template_data || '{}') : (t.template_data || {});
            return (
              <Card key={t.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-2 mb-1">
                      <Badge variant="outline">{t.family}</Badge>
                      <Badge variant="secondary">v{t.version}</Badge>
                      {t.is_active === false && <Badge variant="secondary" className="text-xs bg-gray-400">Inactivo</Badge>}
                    </div>
                    <h3 className="font-semibold">{t.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{t.course_code}</p>
                    {t.description && <p className="text-sm text-gray-600 mt-1 line-clamp-1">{t.description}</p>}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(data?.modules || []).map((m: string) => (
                        <span key={m} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{m}</span>
                      ))}
                    </div>
                  </div>
<div className="flex gap-2 shrink-0">
                    {!readOnly && <Button size="sm" variant="outline" title="Duplicar" onClick={() => handleDuplicate(t)}>
                      <Copy className="w-4 h-4" />
                    </Button>}
                    {!readOnly && <Button size="sm" variant="outline" onClick={() => handleEdit(t)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>}
                    {!readOnly && t.is_active !== false && <Button size="sm" variant="outline" className="text-red-600" onClick={() => handleDelete(t.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>}
                    {!readOnly && t.is_active === false && <Button size="sm" variant="outline" className="text-green-600 border-green-300" onClick={() => handleReactivate(t.id)}>
                      <CheckCircle2 className="w-4 h-4" />
                    </Button>}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{total} plantilla{total !== 1 ? 's' : ''}</p>
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

      {/* ── AI Wizard Dialog ───────────────────────────────────────────────── */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-purple-600" />
              Asistente IA — Creador de Plantillas
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-gray-500 -mt-2">
            Respondé las preguntas del asistente y generará automáticamente la configuración del curso.
          </p>

          <div className="flex-1 overflow-y-auto space-y-3 py-3 min-h-0 max-h-96">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'ai' && <Bot className="w-6 h-6 text-purple-600 shrink-0 mt-1" />}
                <div
                  className={`max-w-sm px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-purple-600 text-white rounded-br-none'
                      : 'bg-gray-100 text-gray-800 rounded-bl-none'
                  }`}
                  dangerouslySetInnerHTML={{ __html: m.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>') }}
                />
              </div>
            ))}
            {generating && (
              <div className="flex gap-2">
                <Bot className="w-6 h-6 text-purple-600 shrink-0" />
                <div className="bg-gray-100 px-4 py-2 rounded-2xl">
                  <span className="text-sm text-gray-500">Generando plantilla</span>
                  <span className="ml-1 animate-pulse">...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input or Use Template button */}
          {generatedTemplate ? (
            <div className="border-t pt-3 flex gap-2">
              <Button onClick={useGeneratedTemplate} className="flex-1 bg-green-600 hover:bg-green-700">
                <ChevronRight className="w-4 h-4 mr-1" /> Revisar y Guardar Plantilla
              </Button>
              <Button variant="outline" onClick={startWizard}>
                <RefreshCw className="w-4 h-4 mr-1" /> Reiniciar
              </Button>
            </div>
          ) : (
            <div className="border-t pt-3 flex gap-2">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !generating && sendAnswer()}
                placeholder="Tu respuesta..."
                disabled={generating}
              />
              <Button onClick={sendAnswer} disabled={!input.trim() || generating}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Edit/Create Template Dialog ────────────────────────────────────── */}
      <Dialog open={editDialogOpen} onOpenChange={o => { setEditDialogOpen(o); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Editar Plantilla' : 'Nueva Plantilla'}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="basic" className="mt-2">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="basic">📋 Datos</TabsTrigger>
              <TabsTrigger value="modules">🧩 Módulos</TabsTrigger>
              <TabsTrigger value="ai">🤖 Prompt IA</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium block mb-1">Código *</label>
                  <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="COURSE-VENTAS-001" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Familia</label>
                  <Select value={form.family} onValueChange={v => setForm(f => ({ ...f, family: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['administracion', 'rrhh', 'ventas', 'contable', 'legal', 'tecnologia', 'general'].map(f =>
                        <SelectItem key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Título *</label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Simulador de Atención al Cliente e-commerce" />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Descripción</label>
                <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Para qué sirve este simulador..." rows={3} />
              </div>
            </TabsContent>

            <TabsContent value="modules" className="space-y-3 mt-4">
              <p className="text-sm text-gray-600">Seleccioná los módulos (Legos) que estarán activos en este simulador:</p>
              {LEGO_MODULES.map(mod => (
                <label key={mod.id} className={`flex gap-3 p-3 rounded-lg border cursor-pointer transition ${form.modules.includes(mod.id) ? 'border-purple-400 bg-purple-50' : 'hover:bg-gray-50'}`}>
                  <Switch checked={form.modules.includes(mod.id)} onCheckedChange={() => toggleModule(mod.id)} />
                  <div>
                    <p className="font-medium text-sm">{mod.label}</p>
                    <p className="text-xs text-gray-500">{mod.description}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Útil para: {mod.use_cases.slice(0, 2).join(', ')}</p>
                  </div>
                </label>
              ))}
            </TabsContent>

            <TabsContent value="ai" className="space-y-4 mt-4">
              <div>
                <label className="text-sm font-medium block mb-1">Rol Base (¿quién es la IA?)</label>
                <Textarea value={form.ai_config.base_role} onChange={e => setForm(f => ({ ...f, ai_config: { ...f.ai_config, base_role: e.target.value } }))} placeholder="Eres Julián, un cliente enojado que pagó y no recibió confirmación..." rows={3} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Contexto del Curso</label>
                <Textarea value={form.ai_config.course_context} onChange={e => setForm(f => ({ ...f, ai_config: { ...f.ai_config, course_context: e.target.value } }))} placeholder="Situación, trasfondo, datos relevantes..." rows={3} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Reglas de Comportamiento</label>
                <Textarea value={form.ai_config.knowledge_base_prompt} onChange={e => setForm(f => ({ ...f, ai_config: { ...f.ai_config, knowledge_base_prompt: e.target.value } }))} placeholder="Si el alumno hace X, la IA responde Y. Si no logra el objetivo, la IA escala..." rows={4} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Rasgos de Personalidad</label>
                <div className="flex gap-2 mb-2">
                  <Input value={newTrait} onChange={e => setNewTrait(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newTrait.trim()) { setForm(f => ({ ...f, ai_config: { ...f.ai_config, personality_traits: [...f.ai_config.personality_traits, newTrait.trim()] } })); setNewTrait(''); } }} placeholder="impaciente, formal, emocional..." />
                  <Button type="button" variant="outline" size="sm" onClick={() => { if (newTrait.trim()) { setForm(f => ({ ...f, ai_config: { ...f.ai_config, personality_traits: [...f.ai_config.personality_traits, newTrait.trim()] } })); setNewTrait(''); } }}>+</Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {form.ai_config.personality_traits.map((t, i) => (
                    <Badge key={i} variant="secondary" className="cursor-pointer" onClick={() => setForm(f => ({ ...f, ai_config: { ...f.ai_config, personality_traits: f.ai_config.personality_traits.filter((_, j) => j !== i) } }))}>{t} ×</Badge>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 pt-4 border-t mt-4">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700">
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Guardar Plantilla'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
