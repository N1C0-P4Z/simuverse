'use client'
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { usePagination } from '@/hooks/usePagination';
import { apiClient } from '@/services/ApiClient';
import { Pencil, Plus, Send, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface Assignment {
  id: number;
  simulation_id: string;
  student_id: string;
  course_id: string;
  assigned_by: string;
  start_date: string;
  end_date: string;
  max_attempts: number;
  status: string;
  attempts_used: number;
  created_at: string;
}

interface Scenario {
  id: string;
  course_id: string;
  title: string;
  scenario_type: string;
  difficulty: string;
  categories?: string[];
}

interface Course {
  id: string;
  title: string;
  category?: string;
  categories?: string[];
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export function AssignmentsABM() {
  const { data: assignments, total, page, totalPages, setPage, loading: assignmentsLoading } = usePagination<Assignment>({
    endpoint: '/assignments',
  });
  const [courses, setCourses] = useState<Course[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [dropdownLoading, setDropdownLoading] = useState(true);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editMaxAttempts, setEditMaxAttempts] = useState(1);
  const [editStatus, setEditStatus] = useState('');

  // Formulario con multi-selección de escenarios y alumnos
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([]);  // ← MÚLTIPLES
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);    // ← MÚLTIPLES
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showAllScenarios, setShowAllScenarios] = useState(false);

  const courseCategories = courses.find(c => c.id === selectedCourse)?.categories ||
    (courses.find(c => c.id === selectedCourse)?.category ? [courses.find(c => c.id === selectedCourse)!.category!] : []);

  const filteredScenarios = showAllScenarios
    ? scenarios
    : scenarios.filter(s => {
        if (!courseCategories.length || !s.categories?.length) return true;
        return s.categories.some(cat => courseCategories.includes(cat));
      });

  const toggleScenario = (id: string) =>
    setSelectedScenarios(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  const toggleStudent = (id: string) =>
    setSelectedStudents(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  const toggleAllStudents = () =>
    setSelectedStudents(prev => prev.length === users.length ? [] : users.map(u => u.id));
  const toggleAllScenarios = () =>
    setSelectedScenarios(prev => prev.length === filteredScenarios.length ? [] : filteredScenarios.map(s => s.id));

  // Load scenarios when course changes
  useEffect(() => {
    setSelectedScenarios([]);
    if (selectedCourse) {
      apiClient.get(`/scenarios/dropdown/list?course_id=${selectedCourse}`)
        .then(r => setScenarios(Array.isArray(r.data) ? r.data : []))
        .catch(() => setScenarios([]));
    } else {
      setScenarios([]);
    }
  }, [selectedCourse]);

  useEffect(() => {
    Promise.all([fetchCourses(), fetchStudents()]).then(() => setDropdownLoading(false));
  }, []);

  const fetchCourses = async () => {
    try {
      const response = await apiClient.get('/courses/dropdown/list');
      setCourses(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching courses:', error);
      setCourses([]);
    }
  };

  const fetchStudents = async () => {
    try {
      const response = await apiClient.get('/users?role=student');
      const raw = response.data?.data ?? response.data;
      setUsers(Array.isArray(raw) ? raw : []);
    } catch (error) {
      console.error('Error fetching students:', error);
      setUsers([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCourse || selectedScenarios.length === 0 || selectedStudents.length === 0) {
      toast.error('Seleccioná un curso, al menos un escenario y al menos un alumno');
      return;
    }

    setSaving(true);
    let created = 0;
    let errors = 0;

    // Crear N × M asignaciones (un escenario × un alumno)
    const pairs = selectedScenarios.flatMap(scenId =>
      selectedStudents.map(studId => ({ simulation_id: scenId, student_id: studId }))
    );

    for (const pair of pairs) {
      try {
        const res = await apiClient.post('/assignments', {
            simulation_id: pair.simulation_id,
            student_id: pair.student_id,
            course_id: selectedCourse,
            max_attempts: maxAttempts,
            start_date: startDate || null,
            end_date: endDate || null,
            assigned_by: sessionStorage.getItem('userId') || 'system',
        });
        if (res) created++;
        else errors++;
      } catch { errors++; }
    }

    setSaving(false);
    setPage(page);

    if (errors === 0) {
      toast.success(`✅ ${created} asignación${created !== 1 ? 'es' : ''} creada${created !== 1 ? 's' : ''} correctamente`);
    } else {
      toast.warning(`${created} creadas, ${errors} con error (pueden ser duplicados)`);
    }

    // Reset
    setSelectedCourse('');
    setSelectedScenarios([]);
    setSelectedStudents([]);
    setMaxAttempts(1);
    setStartDate('');
    setEndDate('');
    setIsAddingNew(false);
  };

  const handleCancel = () => {
    setSelectedCourse('');
    setSelectedScenarios([]);
    setSelectedStudents([]);
    setMaxAttempts(1);
    setStartDate('');
    setEndDate('');
    setIsAddingNew(false);
  };

  const getCourseName = (courseId: string) => courses.find(c => c.id === courseId)?.title || courseId;
  const getStudentName = (studentId: string) => users.find(u => u.id === studentId)?.name || studentId;
  const getScenarioTitle = (simId: string) => {
    // simId puede ser el escenario id o el simulation_id de la asignación
    return simId?.substring(0, 8) + '...';
  };

  const handleDelete = (id: number) => {
    toast.error('¿Eliminar esta asignación?', {
      action: {
        label: 'Eliminar',
        onClick: async () => {
          try {
            await apiClient.delete(`/assignments/${id}`);
            setPage(page);
            toast.success('Asignación eliminada');
          } catch { toast.error('Error al eliminar'); }
        },
      },
      duration: 5000,
    });
  };

  const handleEditOpen = (a: Assignment) => {
    setEditingAssignment(a);
    setEditStartDate(a.start_date ? a.start_date.split('T')[0] : '');
    setEditEndDate(a.end_date ? a.end_date.split('T')[0] : '');
    setEditMaxAttempts(a.max_attempts);
    setEditStatus(a.status);
  };

  const handleEditSave = async () => {
    if (!editingAssignment) return;
    try {
      await apiClient.put(`/assignments/${editingAssignment.id}`, {
        start_date: editStartDate || undefined,
        end_date: editEndDate || undefined,
        max_attempts: editMaxAttempts,
        status: editStatus,
      });
      toast.success('Asignación actualizada');
      setEditingAssignment(null);
      setPage(page);
    } catch {
      toast.error('Error al actualizar la asignación');
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-900',
      in_progress: 'bg-blue-100 text-blue-900',
      completed: 'bg-green-100 text-green-900',
      expired: 'bg-red-100 text-red-900',
    };
    return colors[status] || 'bg-gray-100 text-gray-900';
  };

  if (dropdownLoading) {
    return <div className="p-8 text-center">Cargando asignaciones...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Asignación de Simulaciones</h2>
          <p className="text-gray-600 mt-1">Asigna simulaciones a estudiantes para que las realicen</p>
        </div>
        {!isAddingNew && (
          <Button
            onClick={() => setIsAddingNew(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nueva Asignación
          </Button>
        )}
      </div>

      {/* Form para agregar */}
      {isAddingNew && (
        <Card className="p-6 border border-blue-200 bg-blue-50">
          <h3 className="text-lg font-semibold mb-4">Nueva Asignación</h3>
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Curso */}
            <div>
              <label className="block text-sm font-medium mb-2">Curso</label>
              <select
                value={selectedCourse}
                onChange={e => setSelectedCourse(e.target.value)}
                className="w-full p-2 border rounded-md bg-white"
                required
              >
                <option value="">-- Selecciona un curso --</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>

            {/* Escenarios (MULTI-SELECT con checkboxes) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">
                  Escenarios a asignar
                  {selectedScenarios.length > 0 && (
                    <Badge className="ml-2 bg-blue-600 text-white text-xs">{selectedScenarios.length} seleccionados</Badge>
                  )}
                  {!showAllScenarios && filteredScenarios.length < scenarios.length && (
                    <Badge className="ml-2 bg-purple-100 text-purple-800 text-xs">🎯 {filteredScenarios.length}/{scenarios.length} por categoría</Badge>
                  )}
                </label>
                <div className="flex items-center gap-2">
                  {scenarios.length !== filteredScenarios.length && (
                    <button type="button" onClick={() => setShowAllScenarios(v => !v)} className="text-xs text-purple-600 underline">
                      {showAllScenarios ? 'Solo coincidentes' : 'Mostrar todos'}
                    </button>
                  )}
                  {filteredScenarios.length > 0 && (
                    <button type="button" onClick={toggleAllScenarios} className="text-xs text-blue-600 underline">
                      {selectedScenarios.length === filteredScenarios.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                    </button>
                  )}
                </div>
              </div>
              {!selectedCourse ? (
                <p className="text-xs text-gray-500 italic">Primero seleccioná un curso</p>
              ) : scenarios.length === 0 ? (
                <p className="text-xs text-orange-600">⚠️ Este curso no tiene escenarios. Creá uno en la tab "Escenarios".</p>
              ) : (
                <div className="space-y-1 max-h-52 overflow-y-auto border rounded-md p-3 bg-white">
                  {filteredScenarios.map(s => {
                    const checked = selectedScenarios.includes(s.id);
                    const isEval = s.scenario_type === 'evaluation';
                    return (
                      <label key={s.id} className={`flex items-start gap-2 p-2 rounded cursor-pointer transition-colors ${checked ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleScenario(s.id)} className="mt-0.5 w-4 h-4" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium">{s.title}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${isEval ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                              {isEval ? '🎯 SIMULACIÓN' : '📚 PRÁCTICA'}
                            </span>
                            <span className="text-xs text-gray-400">{s.difficulty}</span>
                            {s.categories && s.categories.length > 0 && s.categories.map(cat => (
                              <span key={cat} className="text-xs bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded capitalize">{cat}</span>
                            ))}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Alumnos (MULTI-SELECT con checkboxes) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">
                  Estudiantes
                  {selectedStudents.length > 0 && (
                    <Badge className="ml-2 bg-green-600 text-white text-xs">{selectedStudents.length} seleccionados</Badge>
                  )}
                </label>
                <button type="button" onClick={toggleAllStudents} className="text-xs text-blue-600 underline">
                  {selectedStudents.length === users.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </button>
              </div>
              <div className="space-y-1 max-h-48 overflow-y-auto border rounded-md p-3 bg-white">
                {users.map(u => {
                  const checked = selectedStudents.includes(u.id);
                  return (
                    <label key={u.id} className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${checked ? 'bg-green-50 border border-green-200' : 'hover:bg-gray-50'}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleStudent(u.id)} className="w-4 h-4" />
                      <span className="text-sm">{u.name}</span>
                      <span className="text-xs text-gray-400">{u.email}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Configuración de la asignación */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Intentos Máximos</label>
                <input
                  type="number"
                  value={maxAttempts}
                  onChange={e => setMaxAttempts(parseInt(e.target.value))}
                  min="1" max="10"
                  className="w-full p-2 border rounded-md bg-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Fecha de Inicio (opcional)</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 border rounded-md bg-white" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Fecha de Vencimiento (opcional)</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 border rounded-md bg-white" />
              </div>
            </div>

            {/* Resumen */}
            {selectedScenarios.length > 0 && selectedStudents.length > 0 && (
              <div className="bg-blue-100 border border-blue-300 rounded-lg p-3 text-sm text-blue-800">
                📋 Se crearán <strong>{selectedScenarios.length * selectedStudents.length}</strong> asignaciones:
                {' '}<strong>{selectedScenarios.length}</strong> escenario{selectedScenarios.length !== 1 ? 's' : ''} &times; <strong>{selectedStudents.length}</strong> alumno{selectedStudents.length !== 1 ? 's' : ''}
              </div>
            )}

            <div className="flex gap-3">
              <Button type="submit" disabled={saving || selectedScenarios.length === 0 || selectedStudents.length === 0} className="bg-green-600 hover:bg-green-700">
                <Send className="w-4 h-4 mr-2" />
                {saving ? 'Asignando...' : 'Asignar Simulaciones'}
              </Button>
              <Button type="button" onClick={handleCancel} variant="outline">Cancelar</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Lista de asignaciones */}
      {assignmentsLoading ? (
        <div className="p-8 text-center text-gray-500">Cargando asignaciones...</div>
      ) : (
      <>
      <div className="grid grid-cols-1 gap-4">
        {assignments.map((assignment) => (
          <Card key={assignment.id} className="p-4 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-start gap-3">
                  <div>
                    <h4 className="font-semibold text-lg">{getStudentName(assignment.student_id)}</h4>
                    <p className="text-sm text-gray-600">{getCourseName(assignment.course_id)}</p>
                    <div className="mt-2 flex gap-2 items-center">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(assignment.status)}`}>
                        {assignment.status.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-500">
                        {assignment.attempts_used}/{assignment.max_attempts} intentos
                      </span>
                    </div>
                  </div>
                </div>

                {assignment.start_date || assignment.end_date ? (
                  <div className="mt-2 text-xs text-gray-500">
                    {assignment.start_date && <p>Inicio: {new Date(assignment.start_date).toLocaleDateString()}</p>}
                    {assignment.end_date && <p>Vencimiento: {new Date(assignment.end_date).toLocaleDateString()}</p>}
                  </div>
                ) : null}

                <p className="text-xs text-gray-400 mt-2">
                  Asignado: {new Date(assignment.created_at).toLocaleDateString()}
                </p>
              </div>

              <div className="flex gap-2 ml-4">
                <Button onClick={() => handleEditOpen(assignment)} size="sm" variant="outline">
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => handleDelete(assignment.id)}
                  size="sm"
                  variant="outline"
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {assignments.length === 0 && !isAddingNew && (
        <Card className="p-8 text-center">
          <p className="text-gray-600">No hay asignaciones. Crea una nueva asignación para empezar.</p>
        </Card>
      )}

      {total > 0 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-gray-500">{total} resultado{total !== 1 ? 's' : ''}</p>
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
      </>
      )}

      {/* Edit Dialog */}
      {editingAssignment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditingAssignment(null)}>
          <Card className="p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Editar Asignación</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">
                  {getStudentName(editingAssignment.student_id)} — {getCourseName(editingAssignment.course_id)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Inicio</label>
                  <input type="date" value={editStartDate} onChange={e => setEditStartDate(e.target.value)} className="w-full p-2 border rounded-md" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Vencimiento</label>
                  <input type="date" value={editEndDate} onChange={e => setEditEndDate(e.target.value)} className="w-full p-2 border rounded-md" />
                </div>
              </div>
                            <div>
                <label className="block text-sm font-medium mb-1">Intentos máx.</label>
                <input type="number" value={editMaxAttempts} onChange={e => setEditMaxAttempts(Number(e.target.value))} min={1} max={10} className="w-full p-2 border rounded-md" />
              </div>
              <div className="flex gap-3 justify-end">



                <Button variant="outline" onClick={() => setEditingAssignment(null)}>Cancelar</Button>
                <Button onClick={handleEditSave}>Guardar</Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
