'use client'
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAdmin } from '@/lib/admin-context';
import { apiClient } from '@/services/ApiClient';
import { BotMessageSquare, ChevronDown, ChevronUp, GraduationCap, Pencil, Save, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface Course {
  id: string;
  title: string;
  course_id?: string;
  is_active?: boolean;
}

interface TechSheet {
  id: number;
  name: string;
  course_id: string | null;
  processed: boolean;
  pipeline_status?: string | null;
}

interface CoursePromptBundle {
  course: Course;
  sheet: TechSheet;
  system_prompt: string;
  coaching_prompt: string;
  base_role: string;
  course_context: string;
  knowledge_base_prompt: string;
  has_prompts: boolean;
}

type PromptForm = {
  system_prompt: string;
  coaching_prompt: string;
  base_role: string;
  course_context: string;
  knowledge_base_prompt: string;
};

function previewText(value: string, max = 140) {
  const t = (value || '').trim().replace(/\s+/g, ' ');
  if (!t) return 'Sin contenido';
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export function PromptTemplatesABM() {
  const { readOnly } = useAdmin();
  const [bundles, setBundles] = useState<CoursePromptBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PromptForm>({
    system_prompt: '',
    coaching_prompt: '',
    base_role: '',
    course_context: '',
    knowledge_base_prompt: '',
  });

  useEffect(() => {
    void loadBundles();
  }, []);

  const loadBundles = async () => {
    setLoading(true);
    try {
      const [coursesRes, sheetsRes] = await Promise.all([
        apiClient.get('/courses'),
        apiClient.get('/tech-sheets/dropdown/list'),
      ]);
      const courses: Course[] = Array.isArray(coursesRes.data) ? coursesRes.data : [];
      const sheets: TechSheet[] = Array.isArray(sheetsRes.data) ? sheetsRes.data : [];

      const courseById = new Map(courses.map((c) => [c.id, c]));
      const analyzedSheets = sheets.filter(
        (s) => s.course_id && (s.processed || s.pipeline_status === 'completed'),
      );

      // Prefer one sheet per course (latest / first analyzed)
      const sheetByCourse = new Map<string, TechSheet>();
      for (const sheet of analyzedSheets) {
        if (!sheet.course_id) continue;
        if (!sheetByCourse.has(sheet.course_id)) {
          sheetByCourse.set(sheet.course_id, sheet);
        }
      }

      const next: CoursePromptBundle[] = [];
      for (const [courseId, sheet] of sheetByCourse) {
        const course = courseById.get(courseId);
        if (!course) continue;

        let system_prompt = '';
        let coaching_prompt = '';
        let base_role = '';
        let course_context = '';
        let knowledge_base_prompt = '';

        try {
          const [configRes, promptConfigRes] = await Promise.all([
            apiClient.get(`/tech-sheets/${sheet.id}/config`),
            apiClient.get(`/prompt-config/${courseId}`).catch(() => ({ data: null })),
          ]);
          system_prompt = configRes.data?.prompts?.system_prompt || '';
          coaching_prompt = configRes.data?.prompts?.coaching_prompt || '';
          base_role = promptConfigRes.data?.base_role || '';
          course_context = promptConfigRes.data?.course_context || '';
          knowledge_base_prompt = promptConfigRes.data?.knowledge_base_prompt || '';
        } catch {
          // keep empty prompts
        }

        next.push({
          course,
          sheet,
          system_prompt,
          coaching_prompt,
          base_role,
          course_context,
          knowledge_base_prompt,
          has_prompts: !!(system_prompt || coaching_prompt || base_role || knowledge_base_prompt),
        });
      }

      next.sort((a, b) => a.course.title.localeCompare(b.course.title, 'es'));
      setBundles(next);
    } catch (error) {
      console.error('Error loading course prompts:', error);
      toast.error('Error al cargar prompts por curso');
      setBundles([]);
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (bundle: CoursePromptBundle) => {
    setEditingCourseId(bundle.course.id);
    setExpandedId(bundle.course.id);
    setForm({
      system_prompt: bundle.system_prompt,
      coaching_prompt: bundle.coaching_prompt,
      base_role: bundle.base_role,
      course_context: bundle.course_context,
      knowledge_base_prompt: bundle.knowledge_base_prompt,
    });
  };

  const cancelEdit = () => {
    setEditingCourseId(null);
    setForm({
      system_prompt: '',
      coaching_prompt: '',
      base_role: '',
      course_context: '',
      knowledge_base_prompt: '',
    });
  };

  const handleSave = async (bundle: CoursePromptBundle) => {
    setSaving(true);
    try {
      await apiClient.put(`/tech-sheets/${bundle.sheet.id}/prompts`, {
        system_prompt: form.system_prompt,
        coaching_prompt: form.coaching_prompt,
        base_role: form.base_role,
        course_context: form.course_context,
        knowledge_base_prompt: form.knowledge_base_prompt,
      });
      toast.success('Prompts actualizados');
      cancelEdit();
      await loadBundles();
    } catch (error: any) {
      console.error('Error saving prompts:', error);
      toast.error(error?.response?.data?.message || error?.message || 'Error al guardar prompts');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Cargando prompts por curso...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Prompts por curso</h2>
        <p className="text-gray-600 mt-1">
          Prompts generados por el análisis de fichas técnicas. Editá el prompt de sistema, coaching y la configuración que usa la simulación.
        </p>
      </div>

      {bundles.length === 0 ? (
        <Card className="p-8 text-center">
          <BotMessageSquare className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-gray-600">
            No hay cursos con ficha técnica analizada. Analizá una ficha en{' '}
            <span className="font-medium">Fichas Técnicas</span> para generar prompts.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {bundles.map((bundle) => {
            const isExpanded = expandedId === bundle.course.id;
            const isEditing = editingCourseId === bundle.course.id;

            return (
              <Card key={bundle.course.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    className="flex-1 text-left"
                    onClick={() =>
                      setExpandedId((prev) => (prev === bundle.course.id ? null : bundle.course.id))
                    }
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <GraduationCap className="w-5 h-5 text-violet-600 shrink-0" />
                      <h3 className="font-semibold text-lg">{bundle.course.title}</h3>
                      {bundle.has_prompts ? (
                        <Badge variant="outline" className="border-green-300 text-green-700">
                          Con prompts
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-300 text-amber-700">
                          Sin prompts
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Ficha: {bundle.sheet.name}
                    </p>
                    {!isExpanded && (
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                        {previewText(bundle.system_prompt || bundle.base_role || bundle.knowledge_base_prompt)}
                      </p>
                    )}
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    {!readOnly && !isEditing && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-blue-600"
                        onClick={() => startEdit(bundle)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setExpandedId((prev) => (prev === bundle.course.id ? null : bundle.course.id))
                      }
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 space-y-4 border-t pt-4">
                    {isEditing ? (
                      <>
                        <div className="space-y-2">
                          <Label>Prompt de sistema (ficha técnica)</Label>
                          <Textarea
                            rows={8}
                            value={form.system_prompt}
                            onChange={(e) => setForm((p) => ({ ...p, system_prompt: e.target.value }))}
                            placeholder="Prompt principal de la simulación..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Prompt de coaching</Label>
                          <Textarea
                            rows={5}
                            value={form.coaching_prompt}
                            onChange={(e) => setForm((p) => ({ ...p, coaching_prompt: e.target.value }))}
                            placeholder="Indicaciones de mentoría / práctica..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Rol base (simulación)</Label>
                          <Textarea
                            rows={3}
                            value={form.base_role}
                            onChange={(e) => setForm((p) => ({ ...p, base_role: e.target.value }))}
                            placeholder="Rol del alumno / personaje en la simulación..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Contexto del curso</Label>
                          <Textarea
                            rows={4}
                            value={form.course_context}
                            onChange={(e) => setForm((p) => ({ ...p, course_context: e.target.value }))}
                            placeholder="Empresa simulada, situación, objetivos..."
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Base de conocimiento / mentor</Label>
                          <Textarea
                            rows={4}
                            value={form.knowledge_base_prompt}
                            onChange={(e) =>
                              setForm((p) => ({ ...p, knowledge_base_prompt: e.target.value }))
                            }
                            placeholder="Cómo debe comportarse la IA durante la práctica..."
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            className="bg-green-600 hover:bg-green-700"
                            disabled={saving}
                            onClick={() => void handleSave(bundle)}
                          >
                            <Save className="w-4 h-4 mr-2" />
                            {saving ? 'Guardando...' : 'Guardar cambios'}
                          </Button>
                          <Button variant="outline" disabled={saving} onClick={cancelEdit}>
                            <X className="w-4 h-4 mr-2" />
                            Cancelar
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <PromptPreview label="Prompt de sistema" value={bundle.system_prompt} />
                        <PromptPreview label="Prompt de coaching" value={bundle.coaching_prompt} />
                        <PromptPreview label="Rol base" value={bundle.base_role} />
                        <PromptPreview label="Contexto del curso" value={bundle.course_context} />
                        <PromptPreview label="Base de conocimiento" value={bundle.knowledge_base_prompt} />
                        {!readOnly && (
                          <Button variant="outline" onClick={() => startEdit(bundle)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Editar prompts
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PromptPreview({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
        {value?.trim() ? value : <span className="text-muted-foreground italic">Vacío</span>}
      </div>
    </div>
  );
}

// Keep named export for AdminPanel / tests
export default PromptTemplatesABM;
