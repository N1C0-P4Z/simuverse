'use client'
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { PipelineOutput, PipelineStatus, useAnalysisProgress } from '@/hooks/useAnalysisProgress';
import { API_BASE, authFetch } from '@/lib/api';
import { apiClient } from '@/services/ApiClient';
import { usePagination } from '@/hooks/usePagination';
import { Plus } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ConfigureTechSheetModal } from './ConfigureTechSheetModal';
import { TechSheetCard, TechSheet } from './TechSheetCard';
import { TechSheetForm } from './TechSheetForm';

interface Course {
  id: string;
  course_id: string;
  title: string;
}

export function TechSheetsABM() {
  const { data: sheets, total, page, totalPages, setPage, loading, refresh } = usePagination<TechSheet>({
    endpoint: '/tech-sheets',
  });
  const [courses, setCourses] = useState<Course[]>([]);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configSheetId, setConfigSheetId] = useState<number | null>(null);
  const [configCourseId, setConfigCourseId] = useState<string | null>(null);
  const [editingSheetId, setEditingSheetId] = useState<number | null>(null);
  const [editingCompetencies, setEditingCompetencies] = useState<string>('');
  const [editingKpis, setEditingKpis] = useState<string>('');

  const [analyzingSheetId, setAnalyzingSheetId] = useState<number | null>(null);
  const { status: pollStatus, output: pollOutput, isLoading: pollLoading, error: pollError } =
    useAnalysisProgress(analyzingSheetId, analyzingSheetId !== null);

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    if (pollStatus === 'completed') {
      refresh();
      setAnalyzingSheetId(null);
      toast.success('Analisis completado exitosamente');
    } else if (pollStatus === 'failed' || pollStatus === 'validation_rejected') {
      setAnalyzingSheetId(null);
    }
  }, [pollStatus]);

  const fetchCourses = async () => {
    try {
      const response = await apiClient.get('/courses/dropdown/list');
      setCourses(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  const downloadAttachedFile = async (fileUrl: string, fileName?: string) => {
    try {
      if (/^https?:\/\//i.test(fileUrl)) {
        window.open(fileUrl, '_blank', 'noopener,noreferrer');
        return;
      }
      const match = fileUrl.match(/\/files\/([^/]+)\/download/);
      if (!match?.[1]) {
        toast.error('URL de archivo invalida');
        return;
      }
      const res = await authFetch(`${API_BASE}/files/${match[1]}/download`);
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), {
        href: url,
        download: fileName || 'archivo-adjunto',
      });
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('No se pudo descargar el archivo adjunto');
    }
  };

  const handleAnalyze = async (id: number) => {
    const sheet = sheets.find(s => s.id === id);
    if (!sheet) return;

    if (!sheet.course_id) {
      toast.error('Error: Debes asociar la ficha tecnica a un curso antes de analizarla.');
      return;
    }

    const hasContent = sheet.file_url || sheet.description;
    if (!hasContent) {
      toast.error('Error: La ficha tecnica debe tener al menos uno de estos elementos: Archivo adjunto, URL, o Descripcion.');
      return;
    }

    try {
      const response = await authFetch(`${API_BASE}/tech-sheets/${id}/analyze`, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const error = await response.json();
        const message = error.message || error.error || 'Error al analizar';
        throw new Error(message);
      }

      setAnalyzingSheetId(id);
    } catch (error) {
      console.error('Error analyzing tech sheet:', error);
      toast.error(`Error al analizar la ficha tecnica: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      setAnalyzingSheetId(null);
    }
  };

  const handleDelete = (id: number) => {
    toast.error('Estas seguro de eliminar esta ficha tecnica?', {
      action: {
        label: 'Eliminar',
            onClick: async () => {
          try {
            await authFetch(`${API_BASE}/tech-sheets/${id}`, {
              method: 'DELETE',
            });
            refresh();
            toast.success('Ficha tecnica eliminada');
          } catch (error) {
            console.error('Error deleting tech sheet:', error);
            toast.error('Error al eliminar la ficha tecnica');
          }
        },
      },
      duration: 5000,
    });
  };

  const handleCompleteSheet = async (id: number) => {
    const sheet = sheets.find(s => s.id === id);
    if (!sheet) return;

    let competencies: string[] = [];
    let kpis: string[] = [];

    if (editingCompetencies.trim()) {
      competencies = editingCompetencies
        .split(',')
        .map(c => c.trim())
        .filter(c => c.length > 0);
    }

    if (editingKpis.trim()) {
      kpis = editingKpis
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);
    }

    if (competencies.length === 0 && kpis.length === 0) {
      toast.error('Debes agregar al menos una competencia o un KPI');
      return;
    }

    try {
      const updatedSheet = {
        name: sheet.name,
        description: sheet.description || undefined,
        ministry_code: sheet.ministry_code || undefined,
        context_scenario: (sheet as any).context_scenario || undefined,
        competencies: competencies.length > 0 ? competencies : sheet.competencies,
        kpi_requirements: kpis.length > 0 ? kpis : sheet.kpi_requirements,
      };

      const response = await authFetch(`${API_BASE}/tech-sheets/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updatedSheet),
      });

      if (!response.ok) {
        const error = await response.json();
        const message = error.message || error.error || 'Error al actualizar';
        throw new Error(message);
      }

      setEditingSheetId(null);
      setEditingCompetencies('');
      setEditingKpis('');
      refresh();
      toast.success('Ficha tecnica completada exitosamente.');
    } catch (error) {
      console.error('Error updating tech sheet:', error);
      toast.error(`Error al completar la ficha: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Cargando fichas tecnicas...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Fichas Tecnicas (Ministerio)</h2>
          <p className="text-gray-600 mt-1">Sube fichas del ministerio. El sistema las analiza automaticamente con IA</p>
        </div>
      </div>

      <Card className="p-4 bg-purple-50 border border-purple-200">
        <div className="flex gap-3">
          <div className="text-sm">
            <p className="font-semibold text-purple-900">Procesamiento Automatico</p>
            <p className="text-purple-800 mt-1">Cuando subes una ficha tecnica, el sistema:</p>
            <ul className="text-purple-800 mt-2 ml-4 space-y-1">
              <li>Analiza competencias requeridas</li>
              <li>Extrae criterios de evaluacion (KPIs)</li>
              <li>Genera preguntas de simulacion</li>
              <li>Crea prompts para el Chat IA</li>
            </ul>
          </div>
        </div>
      </Card>

      <TechSheetForm courses={courses} onSubmit={refresh} />

      <div className="grid grid-cols-1 gap-4">
        {sheets.map((sheet) => (
          <TechSheetCard
            key={sheet.id}
            sheet={sheet}
            courses={courses}
            isAnalyzing={analyzingSheetId === sheet.id}
            analyzingSheetId={analyzingSheetId}
            pollStatus={pollStatus}
            pollOutput={pollOutput}
            pollError={pollError}
            onEdit={(s) => {
              setEditingSheetId(s.id);
              setEditingCompetencies('');
              setEditingKpis('');
            }}
            onAnalyze={handleAnalyze}
            onDelete={handleDelete}
            onConfig={(id, courseId) => {
              setConfigSheetId(id);
              setConfigCourseId(courseId);
              setConfigModalOpen(true);
            }}
            onDownloadFile={downloadAttachedFile}
          />
        ))}
      </div>

      {sheets.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-gray-600">No hay fichas tecnicas. Sube una ficha del ministerio para empezar.</p>
        </Card>
      )}

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{total} ficha{total !== 1 ? 's' : ''} técnica{total !== 1 ? 's' : ''}</p>
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

      {editingSheetId && (
        <Card className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-xl w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">Completar Ficha Tecnica</h3>
              <button
                onClick={() => {
                  setEditingSheetId(null);
                  setEditingCompetencies('');
                  setEditingKpis('');
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                x
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Competencias (separadas por coma)
                </label>
                <textarea
                  value={editingCompetencies}
                  onChange={(e) => setEditingCompetencies(e.target.value)}
                  placeholder="Ej: Comunicacion, Trabajo en equipo, Pensamiento critico"
                  rows={3}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Criterios de Evaluacion / KPIs (separados por coma)
                </label>
                <textarea
                  value={editingKpis}
                  onChange={(e) => setEditingKpis(e.target.value)}
                  placeholder="Ej: Participacion activa (80%), Entregas a tiempo (90%)"
                  rows={3}
                  className="w-full border rounded px-3 py-2"
                />
              </div>

              <p className="text-xs text-orange-600 font-medium">
                Al menos uno de los dos campos debe tener contenido.
              </p>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t">
              <Button
                onClick={() => handleCompleteSheet(editingSheetId)}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Guardar
              </Button>
              <Button
                onClick={() => {
                  setEditingSheetId(null);
                  setEditingCompetencies('');
                  setEditingKpis('');
                }}
                variant="outline"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </Card>
      )}

      {configSheetId && configCourseId && (
        <ConfigureTechSheetModal
          techSheetId={configSheetId}
          courseId={configCourseId}
          isOpen={configModalOpen}
          onClose={() => {
            setConfigModalOpen(false);
            setConfigSheetId(null);
            setConfigCourseId(null);
          }}
        />
      )}
    </div>
  );
}
