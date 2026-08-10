'use client'
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Textarea } from '@/components/ui/textarea';
import { usePagination } from '@/hooks/usePagination';
import { useAdmin } from '@/lib/admin-context';
import { apiClient } from '@/services/ApiClient';
import { Edit2, EyeOff, Eye, Plus, RefreshCw, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'sonner';

interface Category {
  id: number;
  name: string;
  code: string;
  description: string;
  created_at: string;
  is_active?: boolean;
}

export function CategoriesABM() {
  const { readOnly } = useAdmin();
  const { data: categories, total, page, totalPages, setPage, loading, refresh } = usePagination<Category>({
    endpoint: '/categories',
  });
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [hardDeleteCategory, setHardDeleteCategory] = useState<Category | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.code) {
      toast.error('Nombre y código son obligatorios');
      return;
    }

    try {
      if (editingId) {
        await apiClient.put(`/categories/${editingId}`, formData);
      } else {
        await apiClient.post('/categories', formData);
      }

      // Reset form
      setFormData({ name: '', code: '', description: '' });
      setEditingId(null);
      setIsAddingNew(false);

      // Refresh list
      refresh();
    } catch (error) {
      console.error('Error saving category:', error);
      toast.error('Error al guardar la categoría');
    }
  };

  const handleDelete = (category: Category) => {
    setDeletingCategory(category);
  };

  const confirmDelete = async () => {
    if (!deletingCategory) return;
    try {
      await apiClient.delete(`/categories/${deletingCategory.id}`);
      refresh();
      toast.success('Categoría desactivada');
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Error al desactivar la categoría');
    } finally {
      setDeletingCategory(null);
    }
  };

  const handleReactivate = async (id: number) => {
    try {
      await apiClient.put(`/categories/${id}/reactivate`);
      refresh();
      toast.success('Categoría reactivada');
    } catch { toast.error('Error al reactivar'); }
  };

  const handleEdit = (category: Category) => {
    setEditingId(category.id);
    setFormData({
      name: category.name,
      code: category.code,
      description: category.description || '',
    });
    setIsAddingNew(true);
  };

  const handleCancel = () => {
    setFormData({ name: '', code: '', description: '' });
    setEditingId(null);
    setIsAddingNew(false);
  };

  if (loading) {
    return <div className="p-8 text-center">Cargando categorías...</div>;
  }

  const filtered = categories.filter(c => showInactive ? true : c.is_active !== false);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Gestión de Categorías</h2>
          <p className="text-gray-600 mt-1">Crea y administra familias de cursos</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowInactive(v => !v)}
            title={showInactive ? 'Ocultar inactivos' : 'Mostrar inactivos'}
          >
            {showInactive ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
            {showInactive ? 'Ocultar inactivos' : 'Mostrar inactivos'}
          </Button>
          {!isAddingNew && !readOnly && (
            <Button
              onClick={() => setIsAddingNew(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nueva Categoría
            </Button>
          )}
        </div>
      </div>

      {/* Form para agregar/editar */}
      {isAddingNew && (
        <Card className="p-6 border border-blue-200 bg-blue-50">
          <h3 className="text-lg font-semibold mb-4">
            {editingId ? 'Editar Categoría' : 'Nueva Categoría'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Nombre</label>
              <Input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="ej: Recursos Humanos"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Código</label>
              <Input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="ej: RRHH"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Descripción</label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción de la categoría..."
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <Button type="submit" className="bg-green-600 hover:bg-green-700">
                {editingId ? 'Actualizar' : 'Crear'} Categoría
              </Button>
              <Button type="button" onClick={handleCancel} variant="outline">
                Cancelar
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Lista de categorías */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((category) => (
          <Card key={category.id} className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-lg">{category.name}</h4>
                  {category.is_active === false && <Badge variant="secondary" className="text-xs bg-gray-400">Inactivo</Badge>}
                </div>
                <p className="text-sm text-gray-500">Código: {category.code}</p>
                {category.description && (
                  <p className="text-sm mt-2 text-gray-600">{category.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  Creado: {new Date(category.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                {!readOnly && (
                  <Button
                    onClick={() => handleEdit(category)}
                    size="sm"
                    variant="outline"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                )}
                {!readOnly && category.is_active !== false && (
                  <Button
                    onClick={() => handleDelete(category)}
                    size="sm"
                    variant="outline"
                    className="text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
                {!readOnly && category.is_active === false && (
                  <Button
                    onClick={() => handleReactivate(category.id)}
                    size="sm"
                    variant="outline"
                    className="text-green-600 border-green-300"
                  ><RefreshCw className="w-4 h-4" /></Button>
                )}
                {!readOnly && category.is_active === false && (
                  <Button
                    onClick={() => setHardDeleteCategory(category)}
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && !isAddingNew && (
        <Card className="p-8 text-center">
          <p className="text-gray-600">No hay categorías. ¡Crea una para empezar!</p>
        </Card>
      )}

      {total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{total} categoría{total !== 1 ? 's' : ''}</p>
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

      {/* Soft-delete confirmation */}
      <AlertDialog open={!!deletingCategory} onOpenChange={o => { if (!o) setDeletingCategory(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desactivar categoría?</AlertDialogTitle>
            <AlertDialogDescription>
              Se desactivará la categoría &quot;{deletingCategory?.name}&quot;. No se mostrará en los listados pero se conservan sus datos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hard-delete confirmation */}
      <AlertDialog open={!!hardDeleteCategory} onOpenChange={o => { if (!o) setHardDeleteCategory(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">Eliminar categoría permanentemente</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción es irreversible. Se eliminará la categoría &quot;{hardDeleteCategory?.name}&quot;.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-800 hover:bg-red-900"
              onClick={async () => {
                if (!hardDeleteCategory) return;
                try {
                  await apiClient.delete(`/categories/${hardDeleteCategory.id}/hard`);
                  toast.success('Categoría eliminada permanentemente');
                  setHardDeleteCategory(null);
                  refresh();
                } catch { toast.error('Error al eliminar'); }
              }}>
              Sí, eliminar permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
