'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Textarea } from '@/components/ui/textarea';
import { usePagination } from '@/hooks/usePagination';
import { apiClient } from '@/services/ApiClient';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface Practice {
  id: string;
  course_id: string;
  title: string;
  description?: string;
  difficulty: string;
  sequence_index: number;
  agent_key?: string;
  is_active: boolean;
}

interface Course {
  id: string;
  title: string;
}

const DIFFICULTIES = [
  { value: 'very_low', label: 'Muy baja' },
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
];

export function PracticesABM() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState('');
  const {
    data: practices,
    total,
    page,
    totalPages,
    setPage,
    loading,
    refresh,
  } = usePagination<Practice>({
    endpoint: `/practices/course/${courseId}`,
    enabled: Boolean(courseId),
  });
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    difficulty: 'medium' as 'very_low' | 'low' | 'medium',
  });
  const [editMode, setEditMode] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    difficulty: 'medium' as 'very_low' | 'low' | 'medium',
  });

  useEffect(() => {
    apiClient.get('/courses/dropdown/list').then((r) => {
      const data = Array.isArray(r.data) ? r.data : [];
      setCourses(data);
      if (data[0]) setCourseId(data[0].id);
    });
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Título obligatorio');
      return;
    }
    try {
      await apiClient.post(`/practices/course/${courseId}`, form);
      toast.success('Práctica creada');
      setForm({ title: '', description: '', difficulty: 'medium' });
      setAdding(false);
      refresh();
    } catch {
      toast.error('No se pudo crear la práctica');
    }
  };

  const deactivate = async (id: string) => {
    try {
      await apiClient.put(`/practices/${id}`, { is_active: false });
      toast.success('Práctica desactivada');
      refresh();
    } catch {
      toast.error('Error al desactivar');
    }
  };

  const startEdit = (p: Practice) => {
    setEditForm({
      title: p.title,
      description: p.description || '',
      difficulty: p.difficulty as 'very_low' | 'low' | 'medium',
    });
    setEditMode(p.id);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.title.trim()) {
      toast.error('Título obligatorio');
      return;
    }
    try {
      await apiClient.put(`/practices/${editMode}`, editForm);
      toast.success('Práctica actualizada');
      setEditMode(null);
      refresh();
    } catch {
      toast.error('No se pudo actualizar la práctica');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Prácticas</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Creá prácticas secuenciales (practica-1, practica-2, …) con dificultad.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            className="border rounded-md p-2"
            value={courseId}
            onChange={(e) => {
              setCourseId(e.target.value);
              setPage(1);
            }}
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          {!adding && (
            <Button onClick={() => setAdding(true)}>
              <Plus className="w-4 h-4 mr-1" /> Nueva práctica
            </Button>
          )}
        </div>
      </div>

      {adding && (
        <Card className="p-4 space-y-3">
          <form onSubmit={create} className="space-y-3">
            <Input
              placeholder="Título"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
            <Textarea
              placeholder="Descripción / consignas"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
            />
            <select
              className="w-full border rounded-md p-2"
              value={form.difficulty}
              onChange={(e) =>
                setForm({
                  ...form,
                  difficulty: e.target.value as 'very_low' | 'low' | 'medium',
                })
              }
            >
              {DIFFICULTIES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <Button type="submit">Crear</Button>
              <Button type="button" variant="outline" onClick={() => setAdding(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {editMode && (
        <Card className="p-4 space-y-3">
          <form onSubmit={saveEdit} className="space-y-3">
            <Input
              placeholder="Título"
              value={editForm.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              required
            />
            <Textarea
              placeholder="Descripción / consignas"
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              rows={3}
            />
            <select
              className="w-full border rounded-md p-2"
              value={editForm.difficulty}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  difficulty: e.target.value as 'very_low' | 'low' | 'medium',
                })
              }
            >
              {DIFFICULTIES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <Button type="submit">Guardar</Button>
              <Button type="button" variant="outline" onClick={() => setEditMode(null)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <div className="space-y-2">
          {practices.map((p) => (
            <Card key={p.id} className="p-4 flex justify-between items-start gap-3">
              <div>
                <div className="font-semibold">
                  {p.agent_key || `practica-${p.sequence_index}`} — {p.title}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Dificultad:{' '}
                  {DIFFICULTIES.find((d) => d.value === p.difficulty)?.label ||
                    p.difficulty}{' '}
                  · Orden: {p.sequence_index}
                </div>
                {p.description && (
                  <p className="text-sm mt-2 line-clamp-2">{p.description}</p>
                )}
              </div>
              {p.is_active !== false && (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => startEdit(p)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600"
                    onClick={() => deactivate(p.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </Card>
          ))}
          {total === 0 && (
            <Card className="p-6 text-center text-muted-foreground">
              No hay prácticas. Creá la primera (practica-1).
            </Card>
          )}

          {total > 0 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-gray-500">
                {total} práctica{total !== 1 ? 's' : ''}
              </p>
              {totalPages > 1 && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => page > 1 && setPage(page - 1)}
                        className={page <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
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
        </div>
      )}
    </div>
  );
}
