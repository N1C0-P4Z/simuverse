'use client'
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiClient } from '@/services/ApiClient';
import { BookOpen, GraduationCap, Plus, Search, Trash2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface GroupEntry {
  id: number;
  teacher_id: string;
  teacher_name: string;
  teacher_email: string;
  student_id: string;
  student_name: string;
  student_email: string;
  created_at: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export function TeacherGroupsABM() {
  const [groups, setGroups] = useState<GroupEntry[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeacher, setSelectedTeacher] = useState<string>('');
  const [addOpen, setAddOpen] = useState(false);
  const [addStudentId, setAddStudentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [groupsRes, usersRes] = await Promise.all([
        apiClient.get('/teacher-groups'),
        apiClient.get('/users/all'),
      ]);
      setGroups(groupsRes.data || []);
      const usersRaw = usersRes.data?.data ?? usersRes.data;
      const usersData = Array.isArray(usersRaw) ? usersRaw : [];
      setTeachers(usersData.filter((u: User) => u.role === 'teacher'));
      setStudents(usersData.filter((u: User) => u.role === 'student'));
      if (!selectedTeacher && usersData.filter((u: User) => u.role === 'teacher').length > 0) {
        setSelectedTeacher(usersData.filter((u: User) => u.role === 'teacher')[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const selectedTeacherGroups = groups.filter(g => g.teacher_id === selectedTeacher);
  const assignedStudentIds = new Set(selectedTeacherGroups.map(g => g.student_id));
  const availableStudents = students.filter(s => !assignedStudentIds.has(s.id));

  const handleAdd = async () => {
    if (!addStudentId || !selectedTeacher) return;
    setSaving(true);
    try {
      await apiClient.post('/teacher-groups', {
        teacher_id: selectedTeacher, student_id: addStudentId,
      });
      toast.success('Alumno asignado al docente');
      setAddOpen(false);
      setAddStudentId('');
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = (id: number, studentName: string) => {
    toast.error(`¿Quitar a ${studentName} del grupo de este docente?`, {
      action: {
        label: 'Quitar',
        onClick: async () => {
          try {
            await apiClient.delete(`/teacher-groups/${id}`);
            toast.success('Alumno removido del grupo');
            load();
          } catch {
            toast.error('Error al eliminar');
          }
        },
      },
      duration: 5000,
    });
  };

  const currentTeacher = teachers.find(t => t.id === selectedTeacher);

  const filteredGroups = selectedTeacherGroups.filter(g =>
    !search || g.student_name.toLowerCase().includes(search.toLowerCase()) || g.student_email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            Grupos Docente — Alumno
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Asigná alumnos a cada docente. El docente solo verá a sus alumnos asignados en Reportes.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Lista de docentes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Docentes ({teachers.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-96 overflow-y-auto">
              {loading ? (
                <div className="py-8 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" /></div>
              ) : teachers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sin docentes registrados.</p>
              ) : teachers.map(t => {
                const count = groups.filter(g => g.teacher_id === t.id).length;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTeacher(t.id)}
                    className={`w-full text-left px-4 py-3 transition-colors hover:bg-muted/50 ${selectedTeacher === t.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.email}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">{count} alumnos</Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Alumnos del docente seleccionado */}
        <div className="md:col-span-2 space-y-4">
          {selectedTeacher ? (
            <>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-green-600" />
                    Alumnos de <span className="text-blue-700">{currentTeacher?.name}</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{selectedTeacherGroups.length} alumnos asignados</p>
                </div>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Buscar alumno..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="pl-8 w-44 h-8 text-sm"
                    />
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setAddOpen(true)}
                    disabled={availableStudents.length === 0}
                    className="gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar alumno
                  </Button>
                </div>
              </div>

              {filteredGroups.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center py-12 text-center">
                    <GraduationCap className="w-10 h-10 text-muted-foreground opacity-40 mb-3" />
                    <p className="text-muted-foreground text-sm">
                      {search ? 'Sin coincidencias.' : 'Este docente aún no tiene alumnos asignados.'}
                    </p>
                    {!search && availableStudents.length > 0 && (
                      <Button className="mt-4 gap-1" size="sm" onClick={() => setAddOpen(true)}>
                        <Plus className="w-3.5 h-3.5" /> Asignar primer alumno
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredGroups.map(g => (
                    <Card key={g.id} className="group">
                      <CardContent className="pt-3 pb-3 flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0 text-green-700 font-bold text-sm">
                            {g.student_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{g.student_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{g.student_email}</p>
                            <p className="text-[10px] text-muted-foreground">Desde {new Date(g.created_at).toLocaleDateString('es-AR')}</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={() => handleRemove(g.id, g.student_name)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              <p className="text-sm">← Seleccioná un docente para ver sus alumnos</p>
            </div>
          )}
        </div>
      </div>

      {/* Dialog agregar alumno */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Agregar alumno al grupo de {currentTeacher?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Seleccionar alumno</label>
              <Select value={addStudentId} onValueChange={setAddStudentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Elegir alumno..." />
                </SelectTrigger>
                <SelectContent>
                  {availableStudents.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name} — {s.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableStudents.length === 0 && (
                <p className="text-xs text-muted-foreground">Todos los alumnos ya están asignados a este docente.</p>
              )}
            </div>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
              <Button onClick={handleAdd} disabled={!addStudentId || saving}>
                {saving ? 'Guardando...' : 'Agregar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
