'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAdmin } from '@/lib/admin-context';
import { apiClient } from '@/services/ApiClient';
import { Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

interface RubricLevelForm {
  id?: string;
  value: number;
  label: string;
  description?: string;
  sort_order: number;
  active: boolean;
}

interface RubricCriterionForm {
  id?: string;
  code: string;
  label: string;
  description?: string;
  sort_order: number;
  active: boolean;
  descriptors: Record<number, string>;
}

interface CourseRubricABMProps {
  courseId: string;
  courseTitle?: string;
}

const DEFAULT_LEVELS: RubricLevelForm[] = [
  { value: 1, label: 'No logrado', sort_order: 1, active: true },
  { value: 2, label: 'Parcialmente logrado', sort_order: 2, active: true },
  { value: 3, label: 'Logrado', sort_order: 3, active: true },
  { value: 4, label: 'Sobresaliente', sort_order: 4, active: true },
];

function emptyCriterion(sortOrder: number, levelValues: number[]): RubricCriterionForm {
  return {
    code: `CRITERIO_${sortOrder}`,
    label: '',
    sort_order: sortOrder,
    active: true,
    descriptors: Object.fromEntries(levelValues.map((v) => [v, ''])),
  };
}

export function CourseRubricABM({ courseId, courseTitle }: CourseRubricABMProps) {
  const { readOnly } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [passThreshold, setPassThreshold] = useState(24);
  const [levels, setLevels] = useState<RubricLevelForm[]>([]);
  const [criteria, setCriteria] = useState<RubricCriterionForm[]>([]);
  const [noRubricYet, setNoRubricYet] = useState(false);

  const activeLevels = useMemo(
    () => levels.filter((l) => l.active).sort((a, b) => a.sort_order - b.sort_order),
    [levels],
  );
  const activeCriteria = useMemo(
    () => criteria.filter((c) => c.active).sort((a, b) => a.sort_order - b.sort_order),
    [criteria],
  );

  const maxScore = useMemo(() => {
    if (!activeLevels.length || !activeCriteria.length) return 0;
    const maxLevel = Math.max(...activeLevels.map((l) => l.value));
    return activeCriteria.length * maxLevel;
  }, [activeLevels, activeCriteria]);

  const loadRubric = useCallback(async () => {
    setLoading(true);
    setNoRubricYet(false);
    try {
      const res = await apiClient.get(`/courses/${courseId}/rubric`);
      const rubric = res.data;
      setName(rubric.name ?? '');
      setPassThreshold(rubric.pass_threshold ?? 24);
      setLevels(
        (rubric.levels ?? []).map((l: any) => ({
          id: l.id,
          value: l.value,
          label: l.label,
          description: l.description ?? undefined,
          sort_order: l.sort_order,
          active: true,
        })),
      );
      setCriteria(
        (rubric.criteria ?? []).map((c: any) => ({
          id: c.id,
          code: c.code,
          label: c.label,
          description: c.description ?? undefined,
          sort_order: c.sort_order,
          active: true,
          descriptors: Object.fromEntries(
            (rubric.levels ?? []).map((l: any) => [
              l.value,
              c.descriptors?.[String(l.value)] ?? '',
            ]),
          ),
        })),
      );
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setNoRubricYet(true);
        setName('Rubrica Base');
        setPassThreshold(24);
        setLevels(DEFAULT_LEVELS.map((l) => ({ ...l })));
        setCriteria(
          [
            'COMPRENSION',
            'PERTINENCIA',
            'APLICACION',
            'DECISIONES',
            'RESOLUCION',
            'ARGUMENTACION',
            'CUMPLIMIENTO',
            'AUTONOMIA',
          ].map((code, i) => ({
            code,
            label: code.charAt(0) + code.slice(1).toLowerCase(),
            sort_order: i + 1,
            active: true,
            descriptors: Object.fromEntries(DEFAULT_LEVELS.map((l) => [l.value, ''])),
          })),
        );
      } else {
        toast.error('No se pudo cargar la rúbrica del curso');
      }
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    loadRubric();
  }, [loadRubric]);

  const updateLevel = (index: number, patch: Partial<RubricLevelForm>) => {
    setLevels((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const updateCriterion = (index: number, patch: Partial<RubricCriterionForm>) => {
    setCriteria((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const updateDescriptor = (criterionIndex: number, levelValue: number, descriptor: string) => {
    setCriteria((prev) =>
      prev.map((c, i) =>
        i === criterionIndex
          ? { ...c, descriptors: { ...c.descriptors, [levelValue]: descriptor } }
          : c,
      ),
    );
  };

  const addLevel = () => {
    const nextValue = Math.max(0, ...levels.map((l) => l.value)) + 1;
    const nextOrder = Math.max(0, ...levels.map((l) => l.sort_order)) + 1;
    setLevels((prev) => [
      ...prev,
      { value: nextValue, label: `Nivel ${nextValue}`, sort_order: nextOrder, active: true },
    ]);
    setCriteria((prev) =>
      prev.map((c) => ({
        ...c,
        descriptors: { ...c.descriptors, [nextValue]: c.descriptors[nextValue] ?? '' },
      })),
    );
  };

  const removeLevel = (index: number) => {
    const level = levels[index];
    if (!level) return;
    if (activeLevels.length <= 1) {
      toast.error('Debe haber al menos un nivel activo');
      return;
    }
    updateLevel(index, { active: false });
  };

  const addCriterion = () => {
    const nextOrder = Math.max(0, ...criteria.map((c) => c.sort_order)) + 1;
    setCriteria((prev) => [
      ...prev,
      emptyCriterion(
        nextOrder,
        activeLevels.map((l) => l.value),
      ),
    ]);
  };

  const removeCriterion = (index: number) => {
    if (activeCriteria.length <= 1) {
      toast.error('Debe haber al menos un criterio activo');
      return;
    }
    updateCriterion(index, { active: false });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('El nombre de la rúbrica es obligatorio');
      return;
    }
    if (!activeLevels.length || !activeCriteria.length) {
      toast.error('Debe haber al menos un nivel y un criterio activos');
      return;
    }

    const payload = {
      name: name.trim(),
      pass_threshold: passThreshold,
      levels: levels.map((l) => ({
        id: l.id,
        value: l.value,
        label: l.label,
        description: l.description,
        sort_order: l.sort_order,
        active: l.active,
      })),
      criteria: criteria.map((c) => ({
        id: c.id,
        code: c.code,
        label: c.label,
        description: c.description,
        sort_order: c.sort_order,
        active: c.active,
        descriptors: activeLevels.map((l) => ({
          level_value: l.value,
          descriptor: (c.descriptors[l.value] ?? '').trim(),
        })),
      })),
    };

    setSaving(true);
    try {
      await apiClient.put(`/courses/${courseId}/rubric`, payload);
      toast.success('Rúbrica guardada correctamente');
      setNoRubricYet(false);
      await loadRubric();
    } catch (err: any) {
      const msg = err?.response?.data?.message;
      toast.error(typeof msg === 'string' ? msg : 'Error al guardar la rúbrica');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        Cargando rúbrica...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1">
      {courseTitle && (
        <p className="text-sm text-muted-foreground">
          Curso: <span className="font-medium text-foreground">{courseTitle}</span>
        </p>
      )}
      {noRubricYet && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          Este curso no tiene rúbrica activa. Guarde para crearla desde la plantilla base.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="rubric-name">Nombre</Label>
          <Input
            id="rubric-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={readOnly}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rubric-threshold">
            Umbral de aprobación (1–{maxScore || '?'})
          </Label>
          <Input
            id="rubric-threshold"
            type="number"
            min={1}
            max={maxScore || undefined}
            value={passThreshold}
            onChange={(e) => setPassThreshold(Number(e.target.value))}
            disabled={readOnly}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">Niveles</h4>
          {!readOnly && (
            <Button type="button" variant="outline" size="sm" onClick={addLevel}>
              <Plus className="w-4 h-4 mr-1" />
              Nivel
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {levels.map((level, index) =>
            level.active ? (
              <div key={level.id ?? `level-${index}`} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-2">
                  <Label className="text-xs">Valor</Label>
                  <Input
                    type="number"
                    min={1}
                    value={level.value}
                    onChange={(e) => updateLevel(index, { value: Number(e.target.value) })}
                    disabled={readOnly}
                  />
                </div>
                <div className="col-span-7">
                  <Label className="text-xs">Etiqueta</Label>
                  <Input
                    value={level.label}
                    onChange={(e) => updateLevel(index, { label: e.target.value })}
                    disabled={readOnly}
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Orden</Label>
                  <Input
                    type="number"
                    value={level.sort_order}
                    onChange={(e) => updateLevel(index, { sort_order: Number(e.target.value) })}
                    disabled={readOnly}
                  />
                </div>
                {!readOnly && (
                  <div className="col-span-1 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-red-600"
                      onClick={() => removeLevel(index)}
                      title="Desactivar nivel"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            ) : null,
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium">Criterios y descriptores</h4>
          {!readOnly && (
            <Button type="button" variant="outline" size="sm" onClick={addCriterion}>
              <Plus className="w-4 h-4 mr-1" />
              Criterio
            </Button>
          )}
        </div>

        {criteria.map((criterion, cIndex) =>
          criterion.active ? (
            <div
              key={criterion.id ?? `crit-${cIndex}`}
              className="border rounded-lg p-4 space-y-3 bg-muted/20"
            >
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                <div className="md:col-span-3">
                  <Label className="text-xs">Código</Label>
                  <Input
                    value={criterion.code}
                    onChange={(e) =>
                      updateCriterion(cIndex, { code: e.target.value.toUpperCase() })
                    }
                    disabled={readOnly || Boolean(criterion.id)}
                  />
                </div>
                <div className="md:col-span-6">
                  <Label className="text-xs">Etiqueta</Label>
                  <Input
                    value={criterion.label}
                    onChange={(e) => updateCriterion(cIndex, { label: e.target.value })}
                    disabled={readOnly}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Orden</Label>
                  <Input
                    type="number"
                    value={criterion.sort_order}
                    onChange={(e) =>
                      updateCriterion(cIndex, { sort_order: Number(e.target.value) })
                    }
                    disabled={readOnly}
                  />
                </div>
                {!readOnly && (
                  <div className="md:col-span-1 flex items-end justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-red-600"
                      onClick={() => removeCriterion(cIndex)}
                      title="Desactivar criterio"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left p-2 border-b w-40">Nivel</th>
                      {activeLevels.map((level) => (
                        <th key={level.value} className="text-left p-2 border-b min-w-[180px]">
                          {level.label} ({level.value})
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-2 align-top font-medium text-muted-foreground">Descriptor</td>
                      {activeLevels.map((level) => (
                        <td key={level.value} className="p-2 align-top">
                          <Textarea
                            rows={3}
                            value={criterion.descriptors[level.value] ?? ''}
                            onChange={(e) =>
                              updateDescriptor(cIndex, level.value, e.target.value)
                            }
                            disabled={readOnly}
                            placeholder={`Descriptor para ${level.label}`}
                          />
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : null,
        )}
      </div>

      {!readOnly && (
        <div className="flex justify-end pt-2 border-t">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Guardar rúbrica
          </Button>
        </div>
      )}
    </div>
  );
}
