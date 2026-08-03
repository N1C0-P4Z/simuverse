'use client'
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { API_BASE, authFetch } from '@/lib/api';
import { useAdmin } from '@/lib/admin-context';
import { apiClient } from '@/services/ApiClient';
import { ExternalLink, FileText, Paperclip, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ALLOWED_EXTENSIONS } from '@simuverse/shared';

interface Document {
  id: number;
  course_id: string;
  document_name: string;
  document_type: string;
  file_url: string | null;
  created_at: string;
  is_active?: boolean;
}

interface Course {
  id: string;
  title: string;
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function isValidHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isInternalFileUrl(url: string): boolean {
  return /^\/api\/files\/[^/]+\/download\/?$/.test(url.trim());
}

function isValidFileUrl(url: string): boolean {
  const trimmed = url.trim();
  return isValidHttpsUrl(trimmed) || isInternalFileUrl(trimmed);
}

const emptyForm = {
  course_id: '',
  document_name: '',
  file_url: '',
  file_name: '',
};

export function DocumentsABM() {
  const { readOnly } = useAdmin();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({ ...emptyForm });
  const [courseFilter, setCourseFilter] = useState('');

  useEffect(() => {
    fetchDocuments();
    fetchCourses();
  }, []);

  useEffect(() => {
    fetchDocuments(courseFilter);
  }, [courseFilter]);

  const fetchDocuments = async (courseId?: string) => {
    try {
      const params = courseId ? { course_id: courseId } : undefined;
      const response = await apiClient.get('/documents', { params });
      const data = response.data;
      setDocuments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const response = await apiClient.get('/courses');
      const data = response.data;
      setCourses(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching courses:', error);
      setCourses([]);
    }
  };

  const resetForm = () => {
    setFormData({ ...emptyForm });
    if (fileInputRef.current) fileInputRef.current.value = '';
    setEditingId(null);
    setFormOpen(false);
  };

  const handleNew = () => {
    setFormData({ ...emptyForm });
    if (fileInputRef.current) fileInputRef.current.value = '';
    setEditingId(null);
    setFormOpen(true);
  };

  const handleEdit = (doc: Document) => {
    setFormData({
      course_id: doc.course_id,
      document_name: doc.document_name,
      file_url: doc.file_url || '',
      file_name: '',
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
    setEditingId(doc.id);
    setFormOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = `.${file.name.split('.').pop()?.toLowerCase() || ''}`;
    if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
      toast.error('Tipo de archivo no permitido. Usá PDF, DOC, DOCX, XLS, XLSX o CSV.');
      e.target.value = '';
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`Archivo demasiado grande (${(file.size / (1024 * 1024)).toFixed(1)} MB). Máximo: 5 MB. Para archivos más grandes usá un link de Drive.`);
      e.target.value = '';
      return;
    }

    setFormData((prev) => ({
      ...prev,
      file_name: file.name,
      file_url: '',
      document_name: prev.document_name || file.name.replace(/\.[^.]+$/, ''),
    }));
  };

  const downloadDocument = async (fileUrl: string, documentName: string) => {
    try {
      if (isValidHttpsUrl(fileUrl)) {
        window.open(fileUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      const match = fileUrl.match(/\/files\/([^/]+)\/download/);
      if (!match?.[1]) {
        toast.error('URL de archivo inválida');
        return;
      }
      const res = await authFetch(`${API_BASE}/files/${match[1]}/download`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), {
        href: url,
        download: documentName || 'documento',
      });
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('No se pudo abrir el documento');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const hasFile = !!fileInputRef.current?.files?.[0];
    const pastedUrl = formData.file_url.trim();

    if (!formData.course_id || !formData.document_name.trim()) {
      toast.error('Curso y nombre del documento son obligatorios');
      return;
    }

    if (!hasFile && !pastedUrl) {
      toast.error('Subí un archivo o pegá un link HTTPS');
      return;
    }

    if (!hasFile && !isValidFileUrl(pastedUrl)) {
      toast.error('La URL debe ser HTTPS o un archivo ya subido');
      return;
    }

    setUploading(true);
    try {
      let fileUrl = pastedUrl;

      if (hasFile) {
        const file = fileInputRef.current!.files![0];
        const uploadForm = new FormData();
        uploadForm.append('file', file);
        uploadForm.append(
          'uploaded_by_id',
          JSON.parse(sessionStorage.getItem('user') || '{}').id || 'system',
        );
        uploadForm.append('upload_type', 'scenario_resource');
        uploadForm.append('course_id', formData.course_id);

        const uploadResponse = await authFetch(`${API_BASE}/files/upload`, {
          method: 'POST',
          body: uploadForm,
        });

        if (!uploadResponse.ok) {
          const error = await uploadResponse.json().catch(() => ({}));
          throw new Error(error.message || error.error || 'Error al subir archivo');
        }

        const uploadResult = await uploadResponse.json();
        fileUrl = uploadResult.file_url;
      }

      if (editingId) {
        await apiClient.put(`/documents/${editingId}`, {
          course_id: formData.course_id,
          document_name: formData.document_name.trim(),
          file_url: fileUrl,
        });
        toast.success('Documento actualizado');
      } else {
        await apiClient.post('/documents', {
          course_id: formData.course_id,
          document_name: formData.document_name.trim(),
          file_url: fileUrl,
          uploaded_by: sessionStorage.getItem('userId') || 'system',
        });
        toast.success('Documento guardado');
      }

      resetForm();
      await fetchDocuments();
    } catch (error) {
      console.error('Error saving document:', error);
      toast.error(error instanceof Error ? error.message : 'Error al guardar el documento');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (id: number) => {
    toast.error('¿Estás seguro de eliminar este documento?', {
      action: {
        label: 'Eliminar',
        onClick: async () => {
          try {
            await apiClient.delete(`/documents/${id}`);
            if (editingId === id) resetForm();
            await fetchDocuments();
            toast.success('Documento eliminado');
          } catch (error) {
            console.error('Error deleting document:', error);
            toast.error('Error al eliminar el documento');
          }
        },
      },
      duration: 5000,
    });
  };

  const handleReactivate = async (id: number) => {
    try {
      await apiClient.put(`/documents/${id}/reactivate`);
      await fetchDocuments();
      toast.success('Documento reactivado');
    } catch { toast.error('Error al reactivar'); }
  };

  if (loading) {
    return <div className="p-8 text-center">Cargando documentos...</div>;
  }

  const getCourseName = (courseId: string) => {
    const course = courses.find((c) => c.id === courseId);
    return course ? course.title : courseId;
  };

  const existingInternalFile = !formData.file_name && isInternalFileUrl(formData.file_url);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Gestión de Documentos</h2>
          <p className="text-gray-600 mt-1">
            Subí un archivo (hasta 5 MB) o registrá un enlace HTTPS (Drive, Dropbox, etc.)
          </p>
        </div>
        {!formOpen && !readOnly && (
          <Button onClick={handleNew} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Documento
          </Button>
        )}
      </div>

      {formOpen && (
        <Card className={`p-6 border ${editingId ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50'}`}>
          <h3 className="text-lg font-semibold mb-4">
            {editingId ? 'Editar Documento' : 'Nuevo Documento'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Curso</label>
              <select
                value={formData.course_id}
                onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
                className="w-full p-2 border rounded-md"
                required
              >
                <option value="">-- Selecciona un curso --</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Nombre del Documento</label>
              <Input
                type="text"
                value={formData.document_name}
                onChange={(e) => setFormData({ ...formData, document_name: e.target.value })}
                placeholder="ej: Contrato Marco 2024"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">
                {editingId ? 'Reemplazar archivo' : 'Archivo'}
              </label>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={ALLOWED_EXTENSIONS.join(',')}
                onChange={handleFileChange}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {editingId ? 'Subir nuevo archivo' : 'Seleccionar archivo'}
                </Button>
                {formData.file_name && (
                  <span className="text-sm text-green-700 flex items-center gap-1">
                    <Paperclip className="w-3 h-3" />
                    {formData.file_name}
                    <button
                      type="button"
                      className="ml-1 text-xs text-red-600 underline"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, file_name: '' }));
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    >
                      Quitar
                    </button>
                  </span>
                )}
                {existingInternalFile && (
                  <span className="text-sm text-blue-700 flex items-center gap-1">
                    <Paperclip className="w-3 h-3" />
                    Archivo actual adjunto (se mantiene si no subís otro)
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">Máximo 5 MB. {ALLOWED_EXTENSIONS.join(', ')}.</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                O URL del Documento {formData.file_name ? '(ignorada si hay archivo nuevo)' : ''}
              </label>
              <Input
                type="text"
                value={isInternalFileUrl(formData.file_url) && !formData.file_name ? '' : formData.file_url}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    file_url: e.target.value,
                    file_name: e.target.value ? '' : formData.file_name,
                  })
                }
                placeholder="https://drive.google.com/... o https://www.dropbox.com/..."
                disabled={!!formData.file_name}
              />
              {existingInternalFile && (
                <p className="text-xs text-blue-700 mt-1">
                  Hay un archivo subido. Pegá un link solo si querés reemplazarlo por una URL externa.
                </p>
              )}
              {!existingInternalFile && (
                <p className="text-xs text-gray-500 mt-1">
                  Alternativa: enlace de Google Drive, Dropbox u otro recurso HTTPS
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={uploading}>
                {uploading ? 'Guardando...' : editingId ? 'Actualizar Documento' : 'Guardar Documento'}
              </Button>
              <Button type="button" onClick={resetForm} variant="outline" disabled={uploading}>
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4">
        {documents.map((doc) => (
          <Card key={doc.id} className="p-4 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <div>
                    <h4 className="font-semibold text-lg">{doc.document_name}</h4>
                    <div className="flex gap-3 mt-1 text-sm">
                      <span className="text-gray-600">Curso: {getCourseName(doc.course_id)}</span>
        </div>
        {!formOpen && (
          <Select value={courseFilter} onValueChange={v => setCourseFilter(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-52 shrink-0">
              <SelectValue placeholder="Todos los cursos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos los cursos</SelectItem>
              {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>
                </div>
                {doc.file_url && (
                  <button
                    type="button"
                    onClick={() => void downloadDocument(doc.file_url!, doc.document_name)}
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-3"
                  >
                    <ExternalLink className="w-4 h-4" />
                    {isInternalFileUrl(doc.file_url) ? 'Ver / descargar archivo' : doc.file_url}
                  </button>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  Creado: {new Date(doc.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2 ml-4">
                {!readOnly && doc.is_active !== false && (
                  <Button
                    onClick={() => handleEdit(doc)}
                    size="sm"
                    variant="outline"
                    className="text-blue-600"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                )}
                {!readOnly && doc.is_active !== false && (
                  <Button
                    onClick={() => handleDelete(doc.id)}
                    size="sm"
                    variant="outline"
                    className="text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
                {!readOnly && doc.is_active === false && (
                  <Button
                    onClick={() => handleReactivate(doc.id)}
                    size="sm"
                    variant="outline"
                    className="text-green-600 border-green-300"
                  >
                    🔄
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {documents.length === 0 && !formOpen && (
        <Card className="p-8 text-center">
          <p className="text-gray-600">No hay documentos. Subí un archivo o agregá un enlace para empezar.</p>
        </Card>
      )}
    </div>
  );
}
