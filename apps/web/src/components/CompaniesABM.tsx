'use client'
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { LogoField, useFilePreview } from '@/components/ui/logo-field';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Building2, Plus, RotateCw, Settings, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { useAdmin } from '@/lib/admin-context';
import { apiClient } from '@/services/ApiClient';
import { usePagination } from '@/hooks/usePagination';

interface SimulatedCompany {
  id: number;
  name: string;
  short_name: string;
  description: string;
  industry: string;
  logo_url: string;
  is_fictional: boolean;
  city: string;
  country: string;
  website: string;
}

const BRAND_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-green-600', 'bg-orange-500',
  'bg-red-500', 'bg-teal-600', 'bg-indigo-500', 'bg-pink-500',
];

const getInitials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

const getBrandColor = (name: string) =>
  BRAND_COLORS[(name.charCodeAt(0) + (name.charCodeAt(1) || 0)) % BRAND_COLORS.length];

const emptyCompany = (): Omit<SimulatedCompany, 'id'> => ({
  name: '',
  short_name: '',
  description: '',
  industry: '',
  logo_url: '',
  is_fictional: false,
  city: 'Rosario',
  country: 'Argentina',
  website: '',
});

export function CompaniesABM() {
  const { readOnly } = useAdmin();
  const { data: companies, total, page, totalPages, setPage, loading, error, refresh } = usePagination<SimulatedCompany>({
    endpoint: '/simulated-companies',
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyCompany());
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const filePreviewUrl = useFilePreview(logoFile);

  const buildPayload = (): FormData | typeof form => {
    if (!logoFile) return form;
    const fd = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (key === 'logo_url') return; // uploaded file wins over the pasted URL
      fd.append(key, typeof value === 'boolean' ? String(value) : (value ?? ''));
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
        await apiClient.put(`/simulated-companies/${editingId}`, payload);
      } else {
        await apiClient.post('/simulated-companies', payload);
      }
      toast.success(editingId ? 'Empresa actualizada' : 'Empresa creada');
      setDialogOpen(false);
      setForm(emptyCompany());
      setLogoFile(null);
      setEditingId(null);
      refresh();
    } catch (e: any) { 
      const msg = e.response?.data?.message;
      toast.error(msg ? (Array.isArray(msg) ? msg.join(', ') : msg) : e.message); 
    }
    setSaving(false);
  };

  const handleEdit = (c: SimulatedCompany) => {
    setForm({
      name: c.name, short_name: c.short_name || '', description: c.description || '',
      industry: c.industry || '', logo_url: c.logo_url || '', is_fictional: !!c.is_fictional,
      city: c.city || '', country: c.country || 'Argentina', website: c.website || '',
    });
    setLogoFile(null);
    setLogoError(false);
    setEditingId(c.id);
    setDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    toast.error('¿Eliminar esta empresa? Se desvinculará de los cursos asociados.', {
      action: {
        label: 'Eliminar',
        onClick: async () => {
          try {
            await apiClient.delete(`/simulated-companies/${id}`);
            toast.success('Empresa eliminada');
            refresh();
          } catch { toast.error('Error al eliminar'); }
        },
      },
      duration: 5000,
    });
  };

  const handleReactivate = async (id: number) => {
    try {
      await apiClient.put(`/simulated-companies/${id}/reactivate`);
      refresh();
      toast.success('Empresa reactivada');
    } catch { toast.error('Error al reactivar'); }
  };

  const LogoDisplay = ({ name, logoUrl, size = 'md' }: { name: string; logoUrl?: string; size?: 'sm' | 'md' | 'lg' }) => {
    const [imgErr, setImgErr] = useState(false);
    const sizeMap = { sm: 'w-8 h-8 text-xs', md: 'w-12 h-12 text-sm', lg: 'w-16 h-16 text-xl' };
    const cls = sizeMap[size];
    if (logoUrl && !imgErr) {
      return <img src={logoUrl} alt={name} className={`${cls} rounded-full object-cover border`} onError={() => setImgErr(true)} />;
    }
    return (
      <div className={`${cls} rounded-full flex items-center justify-center text-white font-bold shrink-0 ${getBrandColor(name)}`}>
        {getInitials(name)}
      </div>
    );
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando empresas...</div>;
  if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><Building2 className="w-6 h-6" /> Empresas Simuladas</h2>
          <p className="text-gray-600 mt-1">Empresas reales o ficticias que se simulan en los cursos. Si no hay logo, se muestran las iniciales.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) { setForm(emptyCompany()); setLogoFile(null); setEditingId(null); setLogoError(false); } }}>
          {!readOnly && <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Nueva Empresa</Button>
          </DialogTrigger>}
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Empresa' : 'Nueva Empresa Simulada'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {/* Preview */}
              <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl border">
                {(filePreviewUrl || form.logo_url) && !logoError
                  ? <img src={filePreviewUrl || form.logo_url} alt="preview" className="w-16 h-16 rounded-full object-cover border" onError={() => setLogoError(true)} />
                  : <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl shrink-0 ${form.name ? getBrandColor(form.name) : 'bg-gray-400'}`}>
                      {form.name ? getInitials(form.name) : '?'}
                    </div>
                }
                <div>
                  <p className="font-semibold text-lg">{form.name || 'Nombre de la empresa'}</p>
                  <p className="text-sm text-gray-500">{form.industry || form.city || 'Industria / Ciudad'}</p>
                  {form.is_fictional && <Badge variant="outline" className="text-xs mt-1 border-orange-300 text-orange-700">Ficticia</Badge>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>Nombre * <span className="text-xs text-gray-400">(aparece en simulaciones y certificados)</span></Label>
                  <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="MercadoSolutions S.A." />
                </div>
                <div className="space-y-1.5">
                  <Label>Sigla / Nombre corto</Label>
                  <Input value={form.short_name} onChange={e => setForm(p => ({ ...p, short_name: e.target.value }))} placeholder="MSA" />
                </div>
                <div className="space-y-1.5">
                  <Label>Industria / Rubro</Label>
                  <Input value={form.industry} onChange={e => setForm(p => ({ ...p, industry: e.target.value }))} placeholder="E-commerce / Retail" />
                </div>
                <div className="space-y-1.5">
                  <Label>Ciudad</Label>
                  <Input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} placeholder="Rosario" />
                </div>
                <div className="space-y-1.5">
                  <Label>País</Label>
                  <Input value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))} placeholder="Argentina" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Sitio web (opcional)</Label>
                  <Input value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} placeholder="https://empresa.com.ar" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <LogoField
                    label="Logo (si no hay, se usan las iniciales)"
                    urlValue={form.logo_url}
                    onUrlChange={v => { setLogoError(false); setForm(p => ({ ...p, logo_url: v })); }}
                    file={logoFile}
                    onFileChange={f => { setLogoError(false); setLogoFile(f); }}
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Descripción breve</Label>
                  <Textarea
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Empresa líder en gestión de tiendas online en el Cono Sur..."
                    rows={2}
                  />
                </div>
                <div className="col-span-2 flex items-center justify-between p-3 border rounded-lg bg-orange-50/50">
                  <div>
                    <Label className="text-orange-800">Empresa Ficticia</Label>
                    <p className="text-xs text-orange-600">Marca si la empresa fue inventada para la simulación</p>
                  </div>
                  <Switch checked={form.is_fictional} onCheckedChange={v => setForm(p => ({ ...p, is_fictional: v }))} />
                </div>
              </div>

              <Button className="w-full" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : editingId ? 'Actualizar Empresa' : 'Crear Empresa'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {companies.map(c => (
          <Card key={c.id} className="overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <LogoDisplay name={c.name} logoUrl={c.logo_url} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{c.name}</p>
                  <p className="text-xs text-gray-500 truncate">{c.industry || '—'}{c.city ? ` · ${c.city}` : ''}</p>
                </div>
              </div>
              {c.description && <p className="text-xs text-gray-600 mb-3 line-clamp-2">{c.description}</p>}
              {c.website && (
                <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline mb-2 block truncate">{c.website}</a>
              )}
              <div className="flex items-center justify-between mt-2">
                <div className="flex gap-1 flex-wrap">
                  {c.is_fictional && <Badge variant="outline" className="text-xs border-orange-300 text-orange-700">Ficticia</Badge>}
                  {c.short_name && <Badge variant="secondary" className="text-xs">{c.short_name}</Badge>}
                  {(c as any).is_active === false && <Badge variant="secondary" className="text-xs bg-gray-400">Inactiva</Badge>}
                </div>
                <div className="flex gap-1">
                  {!readOnly && <Button variant="outline" size="sm" onClick={() => handleEdit(c)}><Settings className="w-3.5 h-3.5" /></Button>}
                  {!readOnly && (c as any).is_active !== false && <Button variant="destructive" size="sm" onClick={() => handleDelete(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>}
                  {!readOnly && (c as any).is_active === false && <Button variant="outline" size="sm" className="text-green-600 border-green-300" onClick={() => handleReactivate(c.id)}><RotateCw className="w-4 h-4" /></Button>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {total === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="font-medium">No hay empresas configuradas.</p>
          <p className="text-sm mt-1">Creá la empresa que se simula en cada curso (puede ser ficticia o real).</p>
        </div>
      )}

      {total > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">{total} empresa{total !== 1 ? 's' : ''}</p>
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
