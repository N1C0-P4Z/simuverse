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
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAdmin } from '@/lib/admin-context';
import { apiClient } from '@/services/ApiClient';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface Category {
  id: number;
  name: string;
  code: string;
  description: string;
  created_at: string;
}

export function CategoriesABM() {
  const { readOnly } = useAdmin();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
  });

  // Fetch categories
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await apiClient.get('/categories');
      const data = response.data;
      setCategories(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

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
      await fetchCategories();
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
      await fetchCategories();
      toast.success('Categoría eliminada');
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('Error al eliminar la categoría');
    } finally {
      setDeletingCategory(null);
    }
  };

  const handleReactivate = async (id: number) => {
    try {
      await apiClient.put(`/categories/${id}/reactivate`);
      await fetchCategories();
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Gestión de Categorías</h2>
          <p className="text-gray-600 mt-1">Crea y administra familias de cursos</p>
        </div>
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
        {categories.map((category) => (
          <Card key={category.id} className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h4 className="font-semibold text-lg">{category.name}</h4>
                <p className="text-sm text-gray-500">Código: {category.code}</p>
                {category.description && (
                  <p className="text-sm mt-2 text-gray-600">{category.description}</p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  Creado: {new Date(category.created_at).toLocaleDateString()}
                </p>
              </div>
<div className="flex gap-2">
                {!readOnly && <Button
                  onClick={() => handleEdit(category)}
                  size="sm"
                  variant="outline"
                >
                  <Edit2 className="w-4 h-4" />
                </Button>}
                {!readOnly && (category as any).is_active !== false && <Button
                  onClick={() => handleDelete(category)}
                  size="sm"
                  variant="outline"
                  className="text-red-600"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>}
                {!readOnly && (category as any).is_active === false && <Button
                  onClick={() => handleReactivate(category.id)}
                  size="sm"
                  variant="outline"
                  className="text-green-600 border-green-300"
                >🔄</Button>}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {categories.length === 0 && !isAddingNew && (
        <Card className="p-8 text-center">
          <p className="text-gray-600">No hay categorías. ¡Crea una para empezar!</p>
        </Card>
      )}

      <AlertDialog open={!!deletingCategory} onOpenChange={o => { if (!o) setDeletingCategory(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar categoría?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la categoría &quot;{deletingCategory?.name}&quot;. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
