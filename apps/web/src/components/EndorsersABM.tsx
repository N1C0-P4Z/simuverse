'use client'
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { LogoField, useFilePreview } from '@/components/ui/logo-field';
import { ClipboardList, Globe, Handshake, Landmark, Plus, RotateCw, Scale, Settings, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { useAdmin } from '@/lib/admin-context';
import { apiClient } from '@/services/ApiClient';

interface Endorser {
  id: number;
  name: string;
  short_name: string;
  logo_url: string;
  description: string;
  endorsement_type: string;
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

const ENDORSEMENT_TYPES = [
  { value: 'institution', label: 'Institución educativa' },
  { value: 'ministry', label: 'Ministerio / Ente gubernamental' },
  { value: 'company', label: 'Empresa privada' },
  { value: 'professional_chamber', label: 'Colegio / Cámara profesional' },
  { value: 'ngo', label: 'ONG / Asociación civil' },
];

const ENDORSEMENT_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  institution: Landmark,
  ministry: ClipboardList,
  company: Handshake,
  professional_chamber: Scale,
  ngo: Handshake,
};

function EndorsementTypeIcon({ type, className }: { type: string; className?: string }) {
  const Icon = ENDORSEMENT_ICON_MAP[type] || Handshake;
  return <Icon className={className} />;
}

const emptyForm = (): Omit<Endorser, 'id' | 'is_active'> => ({
  name: '', short_name: '', logo_url: '', description: '', endorsement_type: 'institution', website: '',
});

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

export function EndorsersABM() {
  const { readOnly } = useAdmin();
  const [endorsers, setEndorsers] = useState<Endorser[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const filePreviewUrl = useFilePreview(logoFile);

  const fetchAll = async () => {
    try {
      const eRes = await apiClient.get('/endorsers').then(r => r.data);
      setEndorsers(Array.isArray(eRes) ? eRes : []);
    } catch { setEndorsers([]); }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

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
        await apiClient.put(`/endorsers/${editingId}`, payload);
      } else {
        await apiClient.post('/endorsers', payload);
      }
      toast.success(editingId ? 'Auspiciante actualizado' : 'Auspiciante creado');
      setDialogOpen(false);
      setForm(emptyForm());
      setLogoFile(null);
      setEditingId(null);
      fetchAll();
    } catch (e: any) { toast.error(e.message); }
    setSaving(false);
  };

  const handleEdit = (e: Endorser) => {
    setForm({ name: e.name, short_name: e.short_name || '', logo_url: e.logo_url || '', description: e.description || '', endorsement_type: e.endorsement_type || 'institution', website: e.website || '' });
    setLogoFile(null);
    setEditingId(e.id);
    setDialogOpen(true);
  };

  const handleDeactivate = (id: number) => {
    toast.error('¿Desactivar este auspiciante?', {
      action: {
        label: 'Desactivar',
        onClick: async () => {
          try {
            await apiClient.delete(`/endorsers/${id}`);
            toast.success('Auspiciante desactivado');
            fetchAll();
          } catch { toast.error('Error al desactivar'); }
        },
      },
      duration: 5000,
    });
  };

  const handleReactivate = async (id: number) => {
    try {
      await apiClient.put(`/endorsers/${id}/reactivate`);
      fetchAll();
      toast.success('Auspiciante reactivado');
    } catch { toast.error('Error al reactivar'); }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando...</div>;

  return (
    <div className="space-y-8">
      {/* Header + Add */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><Handshake className="w-6 h-6" /> Auspiciantes</h2>
          <p className="text-gray-600 mt-1">Organizaciones o instituciones que auspician las simulaciones. Se pueden vincular a cursos específicos.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) { setForm(emptyForm()); setLogoFile(null); setEditingId(null); } }}>
{!readOnly && <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> Nuevo Auspiciante</Button>
            </DialogTrigger>}
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Auspiciante' : 'Nuevo Auspiciante'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {/* Preview */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border">
                {(filePreviewUrl || form.logo_url)
                  ? <img src={filePreviewUrl || form.logo_url} alt="logo" className="w-14 h-14 rounded-full object-cover border" onError={() => {}} />
                  : <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0 ${form.name ? getColor(form.name) : 'bg-gray-400'}`}>
                      {form.name ? getInitials(form.name) : '?'}
                    </div>
                }
                <div>
                  <p className="font-semibold">{form.name || 'Nombre del auspiciante'}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1"><EndorsementTypeIcon type={form.endorsement_type} className="w-3.5 h-3.5" /> {ENDORSEMENT_TYPES.find(t => t.value === form.endorsement_type)?.label || ''}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label>Nombre *</Label>
                  <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ministerio de Producción..." />
                </div>
                <div className="space-y-1.5">
                  <Label>Sigla / Nombre corto</Label>
                  <Input value={form.short_name} onChange={e => setForm(p => ({ ...p, short_name: e.target.value }))} placeholder="MinProd" />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo de auspiciante</Label>
                  <Select value={form.endorsement_type} onValueChange={v => setForm(p => ({ ...p, endorsement_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ENDORSEMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}><span className="flex items-center gap-1.5"><EndorsementTypeIcon type={t.value} className="w-4 h-4" />{t.label}</span></SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Sitio web</Label>
                  <Input value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} placeholder="https://ministerio.gob.ar" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <LogoField
                    urlValue={form.logo_url}
                    onUrlChange={v => setForm(p => ({ ...p, logo_url: v }))}
                    file={logoFile}
                    onFileChange={setLogoFile}
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label>Descripción breve</Label>
                  <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Organismo responsable de..." rows={2} />
                </div>
              </div>

              <Button className="w-full" onClick={handleSave} disabled={saving}>
                {saving ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear Auspiciante'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Grid de auspiciantes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {endorsers.map(e => (
          <Card key={e.id} className="overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <LogoDisplay name={e.name} logoUrl={e.logo_url} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm leading-tight truncate">{e.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1"><EndorsementTypeIcon type={e.endorsement_type} className="w-3.5 h-3.5" /> {ENDORSEMENT_TYPES.find(t => t.value === e.endorsement_type)?.label || e.endorsement_type}</p>
                  {e.is_active === false && <Badge variant="secondary" className="text-xs bg-gray-400 mt-1">Inactivo</Badge>}
                </div>
              </div>
              {e.description && <p className="text-xs text-gray-600 mb-3 line-clamp-2">{e.description}</p>}
              {e.website && <a href={e.website} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline block mb-3 truncate flex items-center gap-1"><Globe className="w-4 h-4 shrink-0" /> {e.website}</a>}
              <div className="flex justify-end gap-1">
                {!readOnly && <Button variant="outline" size="sm" onClick={() => handleEdit(e)}><Settings className="w-3 h-3" /></Button>}
                {!readOnly && e.is_active !== false && <Button variant="ghost" size="sm" onClick={() => handleDeactivate(e.id)} className="text-red-500 hover:bg-red-50"><Trash2 className="w-3 h-3" /></Button>}
                {!readOnly && e.is_active === false && <Button variant="ghost" size="sm" onClick={() => handleReactivate(e.id)} className="text-green-500 hover:bg-green-50"><RotateCw className="w-4 h-4" /></Button>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {endorsers.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <Handshake className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p>No hay auspiciantes. Agregá el primero.</p>
        </div>
      )}
    </div>
  );
}
