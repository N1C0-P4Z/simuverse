'use client'
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { LogoField, useFilePreview } from '@/components/ui/logo-field';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { ClipboardList, GraduationCap, Globe, Mail, MapPin, Phone, Plus, RotateCw, Settings } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { useAdmin } from '@/lib/admin-context';
import { apiClient } from '@/services/ApiClient';
import { usePagination } from '@/hooks/usePagination';
interface FoundationConfig {
  id: number;
  name: string;
  short_name: string;
  logo_url: string;
  address: string;
  city: string;
  province: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  description: string;
  is_active: boolean;
}

const BRAND_COLORS = ['bg-blue-600', 'bg-green-700', 'bg-purple-600', 'bg-teal-600', 'bg-indigo-600'];
const getColor = (name: string) => BRAND_COLORS[(name.charCodeAt(0) || 0) % BRAND_COLORS.length];
const getInitials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

const emptyForm = (): Omit<FoundationConfig, 'id' | 'is_active'> => ({
  name: '',
  short_name: '',
  logo_url: '',
  address: '',
  city: 'Rosario',
  province: 'Santa Fe',
  country: 'Argentina',
  phone: '',
  email: '',
  website: '',
  description: '',
});

export function FoundationABM() {
  const { readOnly } = useAdmin();
  const { data: foundations, total, page, totalPages, setPage, loading, error } = usePagination<FoundationConfig>({
    endpoint: '/foundation-config',
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
        await apiClient.put(`/foundation-config/${editingId}`, payload);
      } else {
        await apiClient.post('/foundation-config', payload);
      }
      toast.success(editingId ? 'Institución actualizada' : 'Institución creada');
      setDialogOpen(false);
      setForm(emptyForm());
      setLogoFile(null);
      setEditingId(null);
      setPage(page); // trigger re-fetch
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Error al guardar'); }
    setSaving(false);
  };

  const handleEdit = (f: FoundationConfig) => {
    setForm({
      name: f.name, short_name: f.short_name || '', logo_url: f.logo_url || '',
      address: f.address || '', city: f.city || 'Rosario', province: f.province || 'Santa Fe',
      country: f.country || 'Argentina', phone: f.phone || '', email: f.email || '',
      website: f.website || '', description: f.description || '',
    });
    setLogoFile(null);
    setEditingId(f.id);
    setDialogOpen(true);
  };

  const handleDeactivate = async (id: number) => {
    try {
      await apiClient.delete(`/foundation-config/${id}`);
      setPage(page); // trigger re-fetch
      toast.success('Institución desactivada');
    } catch { toast.error('Error al desactivar'); }
  };

  const handleReactivate = async (id: number) => {
    try {
      await apiClient.put(`/foundation-config/${id}/reactivate`);
      setPage(page); // trigger re-fetch
      toast.success('Institución reactivada');
    } catch { toast.error('Error al reactivar'); }
  };

  const LogoDisplay = ({ name, logoUrl, size = 'md' }: { name: string; logoUrl?: string; size?: 'sm' | 'md' | 'lg' }) => {
    const [imgErr, setImgErr] = useState(false);
    const sizeMap = { sm: 'w-10 h-10 text-xs', md: 'w-14 h-14 text-sm', lg: 'w-20 h-20 text-2xl' };
    const cls = sizeMap[size];
    if (logoUrl && !imgErr) {
      return <img src={logoUrl} alt={name} className={`${cls} rounded-full object-cover border-2 border-white shadow`} onError={() => setImgErr(true)} />;
    }
    return (
      <div className={`${cls} rounded-full flex items-center justify-center text-white font-bold shrink-0 ${getColor(name)} shadow`}>
        {getInitials(name)}
      </div>
    );
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando...</div>;
  if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><GraduationCap className="w-6 h-6" /> Fundación / Institución Educativa</h2>
          <p className="text-gray-600 mt-1">Datos de la institución que avala y emite los certificados. Su logo aparece en los certificados.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) { setForm(emptyForm()); setLogoFile(null); setEditingId(null); } }}>
{!readOnly && <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> Nueva Institución</Button>
            </DialogTrigger>}
          <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Institución' : 'Nueva Institución Educativa'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {/* Preview */}
              <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
                {(filePreviewUrl || form.logo_url)
                  ? <img src={filePreviewUrl || form.logo_url} alt="logo" className="w-16 h-16 rounded-full object-cover border-2 border-white shadow" onError={() => {}} />
                  : <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl shrink-0 ${form.name ? getColor(form.name) : 'bg-gray-400'} shadow`}>
                      {form.name ? getInitials(form.name) : '?'}
                    </div>
                }
                <div>
                  <p className="font-bold text-blue-900">{form.name || 'Nombre de la institución'}</p>
                  {form.short_name && <p className="text-sm text-blue-700">{form.short_name}</p>}
                  <p className="text-xs text-blue-600">{[form.city, form.province, form.country].filter(Boolean).join(', ')}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>Nombre completo *</Label>
                  <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="FUNDACIÓN EDUCATIVA PARA EL EMPLEO..." />
                </div>
                <div className="space-y-1.5">
                  <Label>Sigla / Nombre corto</Label>
                  <Input value={form.short_name} onChange={e => setForm(p => ({ ...p, short_name: e.target.value }))} placeholder="FEPEI" />
                </div>
                <div className="space-y-1.5">
                  <Label>Email institucional</Label>
                  <Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="info@fundacion.org" type="email" />
                </div>
                <div className="space-y-1.5">
                  <Label>Teléfono</Label>
                  <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="3414827203" />
                </div>
                <div className="space-y-1.5">
                  <Label>Ciudad</Label>
                  <Input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} placeholder="Rosario" />
                </div>
                <div className="space-y-1.5">
                  <Label>Provincia</Label>
                  <Input value={form.province} onChange={e => setForm(p => ({ ...p, province: e.target.value }))} placeholder="Santa Fe" />
                </div>
                <div className="space-y-1.5">
                  <Label>País</Label>
                  <Input value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} placeholder="Argentina" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Domicilio legal</Label>
                  <Input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="BVRD 27 DE FEBRERO 1718" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Sitio web</Label>
                  <Input value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} placeholder="https://fundacion.org.ar" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <LogoField
                    label="Logo institucional"
                    urlValue={form.logo_url}
                    onUrlChange={v => setForm(p => ({ ...p, logo_url: v }))}
                    file={logoFile}
                    onFileChange={setLogoFile}
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Descripción</Label>
                  <Textarea
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Ministerio de Educación de la Provincia de Santa Fe — Dirección de Educación Técnica, Producción y Trabajo"
                    rows={2}
                  />
                </div>
              </div>

              <Button className="w-full" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : editingId ? 'Actualizar Institución' : 'Crear Institución'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Cards de instituciones */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {foundations.map(f => (
          <Card key={f.id} className="overflow-hidden hover:shadow-md transition-shadow">
            <CardHeader className="pb-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
              <div className="flex items-center gap-4">
                <LogoDisplay name={f.name} logoUrl={f.logo_url} size="lg" />
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base leading-tight text-blue-900">{f.name}</CardTitle>
                  {f.short_name && <Badge className="mt-1 bg-blue-600 text-white text-xs">{f.short_name}</Badge>}
                {f.is_active === false && <Badge className="mt-1 bg-gray-400 text-white text-xs">Inactiva</Badge>}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-2 text-sm">
              {f.address && <p className="text-gray-600 flex items-center gap-1"><MapPin className="w-4 h-4 shrink-0" /> {f.address}, {f.city}, {f.province}</p>}
              {f.phone && <p className="text-gray-600 flex items-center gap-1"><Phone className="w-4 h-4 shrink-0" /> {f.phone}</p>}
              {f.email && <p className="text-gray-600 flex items-center gap-1"><Mail className="w-4 h-4 shrink-0" /> {f.email}</p>}
              {f.website && <a href={f.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline block truncate flex items-center gap-1"><Globe className="w-4 h-4 shrink-0" /> {f.website}</a>}
              {f.description && (
                <div className="mt-2 p-2 bg-purple-50 rounded border border-purple-200">
                  <p className="text-xs text-purple-700 font-medium flex items-center gap-1"><ClipboardList className="w-3.5 h-3.5" /> Descripción:</p>
                  <p className="text-xs text-purple-600 mt-0.5">{f.description}</p>
                </div>
              )}
              <div className="flex justify-end mt-3 gap-2">
                {!readOnly && f.is_active !== false && <Button variant="outline" size="sm" onClick={() => handleEdit(f)}>
                  <Settings className="w-3.5 h-3.5 mr-1" /> Editar
                </Button>}
                {!readOnly && f.is_active !== false && <Button variant="outline" size="sm" className="text-red-600" onClick={() => handleDeactivate(f.id)}>
                  Desactivar
                </Button>}
                {!readOnly && f.is_active === false && <Button variant="outline" size="sm" className="text-green-600 border-green-300" onClick={() => handleReactivate(f.id)}>
                  <RotateCw className="w-4 h-4 mr-1" /> Reactivar
                </Button>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {total === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium">No hay instituciones configuradas.</p>
          <p className="text-sm mt-1">La institución educativa aparece en los certificados emitidos.</p>
        </div>
      )}

      {total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{total} institución{total !== 1 ? 'es' : ''}</p>
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
