'use client'
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogoField, useFilePreview } from '@/components/ui/logo-field';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Globe, Handshake, Plus, RotateCw, Settings, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { useAdmin } from '@/lib/admin-context';
import { apiClient } from '@/services/ApiClient';
import { usePagination } from '@/hooks/usePagination';

interface Sponsor {
  id: number;
  name: string;
  logo_url: string;
  website: string;
  is_active: boolean;
}

const BRAND_COLORS = ['bg-blue-500', 'bg-purple-500', 'bg-green-600', 'bg-orange-500', 'bg-rose-500', 'bg-teal-600', 'bg-indigo-500', 'bg-amber-600'];
const getColor = (name: string) => BRAND_COLORS[((name.charCodeAt(0) || 0) + (name.charCodeAt(1) || 0)) % BRAND_COLORS.length];
const getInitials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

const emptyForm = (): Omit<Sponsor, 'id' | 'is_active'> => ({ name: '', logo_url: '', website: '' });

function LogoDisplay({ name, logoUrl, size = 'md' }: { name: string; logoUrl?: string; size?: 'sm' | 'md' }) {
  const [imgErr, setImgErr] = useState(false);
  const sizeMap = { sm: 'w-9 h-9 text-xs', md: 'w-12 h-12 text-sm' };
  const cls = sizeMap[size];
  if (logoUrl && !imgErr) {
    return <img src={logoUrl} alt={name} className={`${cls} rounded-full object-cover border`} onError={() => setImgErr(true)} />;
  }
  return (
    <div className={`${cls} rounded-full flex items-center justify-center text-white font-bold shrink-0 ${getColor(name)}`}>
      {getInitials(name)}
    </div>
  );
}

export function SponsorsABM() {
  const { readOnly } = useAdmin();
  const { data: sponsors, total, page, totalPages, setPage, loading, error, refresh } = usePagination<Sponsor>({
    endpoint: '/sponsors',
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const filePreviewUrl = useFilePreview(logoFile);

  const buildPayload = (): FormData | typeof form => {
    if (!logoFile) return form;
    const fd = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (key === 'logo_url') return; // uploaded file wins over the pasted URL
      fd.append(key, value ?? '');
    });
    fd.append('logo_file', logoFile);
    return fd;
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (editingId) {
        await apiClient.put(`/sponsors/${editingId}`, payload);
      } else {
        await apiClient.post('/sponsors', payload);
      }
      toast.success(editingId ? 'Patrocinador actualizado' : 'Patrocinador creado');
      setDialogOpen(false);
      setForm(emptyForm());
      setLogoFile(null);
      setEditingId(null);
      refresh();
    } catch (e: any) { toast.error(e.message); }
    setSaving(false);
  };

  const handleEdit = (s: Sponsor) => {
    setForm({ name: s.name, logo_url: s.logo_url || '', website: s.website || '' });
    setLogoFile(null);
    setEditingId(s.id);
    setDialogOpen(true);
  };

  const handleDeactivate = (id: number) => {
    toast.error('¿Desactivar este patrocinador?', {
      action: {
        label: 'Desactivar',
        onClick: async () => {
          try {
            await apiClient.delete(`/sponsors/${id}`);
            toast.success('Patrocinador desactivado');
            refresh();
          } catch { toast.error('Error al desactivar'); }
        },
      },
      duration: 5000,
    });
  };

  const handleReactivate = async (id: number) => {
    try {
      await apiClient.put(`/sponsors/${id}/reactivate`);
      refresh();
      toast.success('Patrocinador reactivado');
    } catch { toast.error('Error al reactivar'); }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando...</div>;
  if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><Handshake className="w-6 h-6" /> Patrocinadores</h2>
          <p className="text-gray-600 mt-1">Marcas o empresas que patrocinan cursos. Se vinculan desde el formulario del curso.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) { setForm(emptyForm()); setLogoFile(null); setEditingId(null); } }}>
          {!readOnly && <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Nuevo Patrocinador</Button>
          </DialogTrigger>}
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Patrocinador' : 'Nuevo Patrocinador'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                {(filePreviewUrl || form.logo_url)
                  ? <img src={filePreviewUrl || form.logo_url} alt="logo" className="w-14 h-14 rounded-full object-cover border" onError={() => {}} />
                  : <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0 ${form.name ? getColor(form.name) : 'bg-gray-400'}`}>
                      {form.name ? getInitials(form.name) : '?'}
                    </div>
                }
                <p className="font-semibold">{form.name || 'Nombre del patrocinador'}</p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Nombre *</Label>
                  <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Acme Corp." />
                </div>
                <div className="space-y-1.5">
                  <Label>Sitio web</Label>
                  <Input value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} placeholder="https://acme.com" />
                </div>
                <div className="space-y-1.5">
                  <LogoField
                    urlValue={form.logo_url}
                    onUrlChange={v => setForm(p => ({ ...p, logo_url: v }))}
                    file={logoFile}
                    onFileChange={setLogoFile}
                  />
                </div>
              </div>

              <Button className="w-full" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear Patrocinador'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sponsors.map(s => (
          <Card key={s.id} className="overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <LogoDisplay name={s.name} logoUrl={s.logo_url} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm leading-tight truncate">{s.name}</p>
                  {s.is_active === false && <Badge variant="secondary" className="text-xs bg-gray-400 mt-1">Inactivo</Badge>}
                </div>
              </div>
              {s.website && <a href={s.website} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline block mb-3 truncate flex items-center gap-1"><Globe className="w-4 h-4 shrink-0" /> {s.website}</a>}
              <div className="flex justify-end gap-1">
                {!readOnly && <Button variant="outline" size="sm" onClick={() => handleEdit(s)}><Settings className="w-3 h-3" /></Button>}
                {!readOnly && s.is_active !== false && <Button variant="ghost" size="sm" onClick={() => handleDeactivate(s.id)} className="text-red-500 hover:bg-red-50"><Trash2 className="w-3 h-3" /></Button>}
                {!readOnly && s.is_active === false && <Button variant="ghost" size="sm" onClick={() => handleReactivate(s.id)} className="text-green-500 hover:bg-green-50"><RotateCw className="w-4 h-4" /></Button>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {total === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <Handshake className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p>No hay patrocinadores. Agregá el primero.</p>
        </div>
      )}

      {total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{total} sponsor{total !== 1 ? 's' : ''}</p>
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
    </div>
  );
}
