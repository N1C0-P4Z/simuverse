'use client'
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/services/ApiClient';
import { ArrowLeft, BarChart3, BookOpen, Bot, CheckCircle2, ChevronDown, ChevronUp, ExternalLink, FileText, Loader, Lock, Mail, MessageSquare, Paperclip, Pencil, Send, User } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { API_BASE, authFetch } from '@/lib/api';

const MAX_PRACTICE_UPLOAD_BYTES = 5 * 1024 * 1024;

// Format a spreadsheet cell value according to its unit, instead of always
// prefixing "$". Money → "$1.000"; percentages → "50%"; hours → "8 h"; anything
// else → the plain number (the unit is shown in its own column).
const MONEY_UNITS = ['$', 'ars', 'usd', 'eur', 'peso', 'pesos', 'dólar', 'dolar', 'dólares', 'dolares', 'moneda'];
function formatSpreadsheetValue(value: unknown, unit?: string): string {
  if (value === null || value === undefined || value === '') return '';
  const num = typeof value === 'number' ? value : Number(value);
  const formatted = Number.isFinite(num) ? num.toLocaleString() : String(value);
  const u = (unit || '').trim().toLowerCase();
  if (!u) return formatted;
  if (MONEY_UNITS.includes(u)) return `$${formatted}`;
  if (u === '%' || u.includes('porcentaje')) return `${formatted}%`;
  if (u === 'h' || u.startsWith('hora')) return `${formatted} h`;
  return formatted;
}

interface Email {
  id: string;
  from: string;
  subject: string;
  body: string;
  timestamp: Date;
  unread: boolean;
}

interface Document {
  id: string;
  name: string;
  type: string;
  url?: string;
}

interface PracticeProgress {
  id: string;
  title: string;
  description?: string;
  agent_key: string;
  sequence_index: number;
  difficulty_label: string;
  status: 'locked' | 'available' | 'in_progress' | 'completed';
  unlocked: boolean;
  instance_id?: string;
}

const SimulationPage: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const { user, isAuthenticated, loading } = useAuth();
  const router = useRouter();

  // State
  const [course, setCourse] = useState<any>(null);
  const [simId, setSimId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('chat');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'ai'; message: string; timestamp: Date }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [sentReplies, setSentReplies] = useState<Record<string, string>>({});
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [editedReplyText, setEditedReplyText] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [spreadsheet, setSpreadsheet] = useState<any>(null);
  const [loadingChat, setLoadingChat] = useState(false);
  const [practiceProgress, setPracticeProgress] = useState<PracticeProgress[]>([]);
  const [currentPractice, setCurrentPractice] = useState<PracticeProgress | null>(null);
  const [completingPractice, setCompletingPractice] = useState(false);
  const [pageState, setPageState] = useState<'loading' | 'ready' | 'no_practices'>('loading');
  const [sessionFiles, setSessionFiles] = useState<Array<{ id: string; file_name: string; file_size_bytes: string | number; created_at?: string }>>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [practicesExpanded, setPracticesExpanded] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initStartedRef = useRef(false);

  const handleDownloadExcel = () => {
    if (!spreadsheet?.data) {
      toast.error("No hay datos en la planilla para descargar.");
      return;
    }
    try {
      const ws = XLSX.utils.json_to_sheet(spreadsheet.data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Planilla");
      XLSX.writeFile(wb, `${spreadsheet.name || 'planilla'}.xlsx`);
      toast.success("Excel descargado correctamente.");
    } catch (error) {
      console.error(error);
      toast.error("Error al generar el archivo Excel.");
    }
  };

  // Auto-scroll al final cuando llegan mensajes nuevos
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  // Load course and initialize simulation
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/auth');
      return;
    }
    if (!courseId) {
      router.push('/auth');
      return;
    }

    const init = async () => {
      setPageState('loading');
      try {
        // Get course details
        const courseRes = await apiClient.get(`/courses/${courseId}`);
        setCourse(courseRes.data);

        // Load sequential practice progress (locked / available / completed)
        let progressList: PracticeProgress[] = [];
        try {
          const progressRes = await apiClient.get(`/practices/course/${courseId}/progress`);
          progressList = progressRes.data?.practices || [];
          setPracticeProgress(progressList);
        } catch {
          setPracticeProgress([]);
        }

        if (progressList.length === 0) {
          setPageState('no_practices');
          return;
        }

        // Start next unlocked practice (or resume in-progress)
        let simRes;
        try {
          simRes = await apiClient.post('/simulations/start', {
            course_id: courseId,
          });
        } catch (startError: unknown) {
          const err = startError as { response?: { status?: number; data?: { message?: string | string[] } } };
          const msg = err.response?.data?.message;
          const msgText = Array.isArray(msg) ? msg.join(' ') : msg || '';
          if (
            err.response?.status === 400 &&
            msgText.toLowerCase().includes('prácticas')
          ) {
            setPageState('no_practices');
            toast.error('Este curso aún no tiene prácticas configuradas.');
          } else {
            setPageState('no_practices');
            toast.error('No se pudo iniciar la práctica. Intentá nuevamente más tarde.');
          }
          return;
        }

        const sessionId = simRes.data.session_id || simRes.data.id;
        const practiceMeta = simRes.data.practice;
        setSimId(sessionId);

        const activePractice =
          progressList.find((p) => p.instance_id === sessionId) ||
          progressList.find((p) => p.id === simRes.data.scenario_id) ||
          (practiceMeta
            ? {
                id: practiceMeta.id,
                title: practiceMeta.title,
                description: undefined,
                agent_key: practiceMeta.agent_key,
                sequence_index: practiceMeta.sequence_index,
                difficulty_label:
                  practiceMeta.difficulty === 'very_low'
                    ? 'Muy baja'
                    : practiceMeta.difficulty === 'low'
                      ? 'Baja'
                      : 'Media',
                status: 'in_progress' as const,
                unlocked: true,
              }
            : null);
        setCurrentPractice(activePractice);

        // Check for existing messages
        try {
          const msgRes = await apiClient.get(`/simulations/${sessionId}/messages`);
          const turns = msgRes.data?.messages || [];
          if (turns.length > 0) {
            setChatMessages(
              turns.map((t: { speaker: string; message: string; created_at?: string }) => ({
                role: t.speaker === 'student' ? ('user' as const) : ('ai' as const),
                message: t.message,
                timestamp: t.created_at ? new Date(t.created_at) : new Date(),
              })),
            );
          } else {
            // Trigger AI initial greeting if session is empty
            if (!initStartedRef.current) {
              initStartedRef.current = true;
              setChatMessages([{ role: 'ai', message: 'Iniciando simulación...', timestamp: new Date() }]);
              try {
                const initRes = await apiClient.post(`/simulations/${sessionId}/message`, {
                  message: '[INICIO_SIMULACION]',
                  conversationHistory: [],
                });
                setChatMessages([{ role: 'ai', message: initRes.data.response, timestamp: new Date() }]);
              } catch (err) {
                setChatMessages([{ role: 'ai', message: 'Error al iniciar simulación. Recargá la página.', timestamp: new Date() }]);
              }
            }
          }
        } catch {
          // If we fail to fetch, just leave empty for now
        }

        try {
          const filesRes = await apiClient.get(`/files?simulation_instance_id=${sessionId}`);
          setSessionFiles(Array.isArray(filesRes.data) ? filesRes.data : []);
        } catch {
          setSessionFiles([]);
        }

        // Load modules
        loadModules(sessionId);
        setPageState('ready');
      } catch (error) {
        setPageState('no_practices');
        toast.error('No se pudo cargar la simulación. Verificá tu conexión e intentá de nuevo.');
      }
    };

    if (user) init();
  }, [courseId, user, loading, isAuthenticated, router]);

  const handlePracticeFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !simId) return;

    if (file.size > MAX_PRACTICE_UPLOAD_BYTES) {
      const driveUrl = course?.drive_folder_url;
      if (driveUrl) {
        toast.error(
          `El archivo supera 5 MB. Subilo al Drive del curso y avisale al asesor.`,
          {
            action: {
              label: 'Abrir Drive',
              onClick: () => window.open(driveUrl, '_blank', 'noopener,noreferrer'),
            },
            duration: 8000,
          },
        );
      } else {
        toast.error(
          'El archivo supera 5 MB. Pedile a tu docente el link de Drive del curso para archivos grandes.',
        );
      }
      return;
    }

    setUploadingFile(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('upload_type', 'student_submission');
      form.append('simulation_instance_id', simId);
      if (course?.id) form.append('course_id', course.id);
      form.append('description', `Entrega de práctica ${currentPractice?.agent_key || ''}`.trim());

      const uploadResponse = await authFetch(`${API_BASE}/files/upload`, {
        method: 'POST',
        body: form,
      });
      if (!uploadResponse.ok) {
        const err = await uploadResponse.json().catch(() => ({}));
        throw new Error(err.message || 'Error al subir el archivo');
      }
      const uploaded = await uploadResponse.json();
                      setSessionFiles((prev) => [uploaded, ...prev]);
      toast.success(`Archivo subido: ${file.name}`);
    } catch (err: any) {
      toast.error(err?.message || 'No se pudo subir el archivo');
    } finally {
      setUploadingFile(false);
    }
  };

  // Checkpoint every 2 minutes + on unload / unmount
  useEffect(() => {
    if (!simId) return;

    const flush = () => {
      try {
        apiClient.post(`/simulations/${simId}/checkpoint`).catch(() => undefined);
      } catch {
        /* ignore */
      }
    };

    const timer = setInterval(flush, 2 * 60 * 1000);

    const onUnload = () => {
      const token = sessionStorage.getItem('token');
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      if (token) {
        fetch(`${base}/simulations/${simId}/checkpoint`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: '{}',
          keepalive: true,
        }).catch(() => undefined);
      } else {
        flush();
      }
    };

    window.addEventListener('beforeunload', onUnload);
    return () => {
      clearInterval(timer);
      window.removeEventListener('beforeunload', onUnload);
      flush();
    };
  }, [simId]);

  const loadModules = async (simId: string) => {
    try {
      const [emailsRes, docsRes, spreadRes] = await Promise.all([
        apiClient.get(`/simulations/${simId}/emails`),
        apiClient.get(`/simulations/${simId}/documents`),
        apiClient.get(`/simulations/${simId}/spreadsheet`),
      ]);

      setEmails(emailsRes.data);
      setDocuments(docsRes.data);
      setSpreadsheet(spreadRes.data);
    } catch (error) {
      console.error('Error loading modules:', error);
    }
  };

  const completePractice = async () => {
    if (!simId) return;
    setCompletingPractice(true);
    try {
      const res = await apiClient.put(`/simulations/${simId}/complete`);
      if (res.data?.all_completed) {
        toast.success('¡Felicitaciones! Completaste todas las prácticas del curso.');
        // Redirect to courses view after a brief delay
        setTimeout(() => {
          if (user?.role === 'admin') router.push('/admin/mis-cursos');
          else if (user?.role === 'teacher') router.push('/profesor/cursos');
          else router.push('/estudiante/cursos');
        }, 2000);
      } else {
        toast.success('Práctica completada. Cargando la siguiente...');
        window.location.reload();
      }
    } catch {
      toast.error('No se pudo completar la práctica');
      setCompletingPractice(false);
    }
  };

  const sendMessage = async () => {
    if (!chatInput.trim()) return;

    // Add user message
    const userMsg = { role: 'user' as const, message: chatInput, timestamp: new Date() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setLoadingChat(true);

    try {
      const res = await apiClient.post(`/simulations/${simId}/message`, {
        message: chatInput,
        conversationHistory: chatMessages.map(m => ({ role: m.role === 'ai' ? 'model' : 'user', content: m.message }))
      });
      const aiMsg = { role: 'ai' as const, message: res.data.response, timestamp: new Date() };
      setChatMessages(prev => [...prev, aiMsg]);
      if (res.data?.response?.includes('[NUEVO EMAIL GENERADO]')) {
        loadModules(simId);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Respuesta en-rol cuando el backend no responde — el alumno no ve el error técnico
      const fallbacks = [
        'Entiendo. Tomá un momento para revisar la situación y decime cuál es tu análisis.',
        'Interesante planteo. ¿Podés desarrollar más tu razonamiento?',
        'Seguimos. ¿Qué pasos concretos tenés en mente para avanzar?',
        'Bien. ¿Qué información adicional necesitás para tomar esa decisión?',
      ];
      const inRoleMsg = fallbacks[Math.floor(Date.now() / 1000) % fallbacks.length];
      const errMsg = { role: 'ai' as const, message: inRoleMsg, timestamp: new Date() };
      setChatMessages(prev => [...prev, errMsg]);
    } finally {
      setLoadingChat(false);
    }
  };

  // Reply to the selected email — routes the reply through the same AI message
  // channel (the backend builds the in-role persona) and surfaces it in the chat.
  const sendEmailReply = async () => {
    if (!selectedEmail || !replyText.trim()) return;
    const composed = `[Respuesta al correo de ${selectedEmail.from} — "${selectedEmail.subject}"]\n\n${replyText.trim()}`;
    setSendingReply(true);
    const userMsg = { role: 'user' as const, message: composed, timestamp: new Date() };
    setChatMessages(prev => [...prev, userMsg]);
    try {
      const res = await apiClient.post(`/simulations/${simId}/message`, {
        message: composed,
        conversationHistory: chatMessages.map(m => ({ role: m.role === 'ai' ? 'model' : 'user', content: m.message })),
      });
      const aiMsg = { role: 'ai' as const, message: res.data.response, timestamp: new Date() };
      setChatMessages(prev => [...prev, aiMsg]);
      setEmails(prev => prev.map(e => (e.id === selectedEmail.id ? { ...e, unread: false } : e)));
      setSentReplies(prev => ({ ...prev, [selectedEmail.id]: replyText.trim() }));
      setReplyText('');
      setReplyOpen(false);
      setActiveTab('chat');
      toast.success('Respuesta enviada');
    } catch (error) {
      console.error('Error sending email reply:', error);
      toast.error('No se pudo enviar la respuesta. Intentá de nuevo.');
    } finally {
      setSendingReply(false);
    }
  };

  const sendEditedEmailReply = async () => {
    if (!selectedEmail || !editedReplyText.trim()) return;
    const composed = `[Corrección de respuesta al correo de ${selectedEmail.from} — "${selectedEmail.subject}"]\n\n${editedReplyText.trim()}`;
    setSendingReply(true);
    const userMsg = { role: 'user' as const, message: composed, timestamp: new Date() };
    setChatMessages(prev => [...prev, userMsg]);
    try {
      const res = await apiClient.post(`/simulations/${simId}/message`, {
        message: composed,
        conversationHistory: chatMessages.map(m => ({ role: m.role === 'ai' ? 'model' : 'user', content: m.message })),
      });
      const aiMsg = { role: 'ai' as const, message: res.data.response, timestamp: new Date() };
      setChatMessages(prev => [...prev, aiMsg]);
      setSentReplies(prev => ({ ...prev, [selectedEmail.id]: editedReplyText.trim() }));
      setEditingEmailId(null);
      setEditedReplyText('');
      setActiveTab('chat');
      toast.success('Corrección enviada');
    } catch (error) {
      console.error('Error sending edited email reply:', error);
      toast.error('No se pudo enviar la corrección. Intentá de nuevo.');
    } finally {
      setSendingReply(false);
    }
  };

  if (loading || pageState === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <Loader className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Cargando simulación...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !courseId) {
    return null;
  }

  if (pageState === 'no_practices') {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b bg-card sticky top-0 z-50">
          <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (user?.role === 'admin') router.push('/admin/mis-cursos');
                else if (user?.role === 'teacher') router.push('/profesor/cursos');
                else if (user?.role === 'ministerio') router.push('/ministerio');
                else router.push('/estudiante/cursos');
              }}
              className="gap-1 shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Volver</span>
            </Button>
            <div className="text-center min-w-0 flex-1">
              <h1 className="text-base sm:text-xl font-bold truncate">{course?.title || 'Simulación'}</h1>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1 shrink-0 text-xs sm:text-sm"
              onClick={() => router.push(`/curso/${courseId}`)}
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">Info del curso</span>
            </Button>
          </div>
        </div>
        <main className="container mx-auto px-4 py-12 max-w-lg">
          <Card>
            <CardHeader>
              <CardTitle>Sin prácticas disponibles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Este curso aún no tiene prácticas configuradas. Contactá a tu docente o
                administrador para que configuren las prácticas del curso.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  if (user?.role === 'admin') router.push('/admin/mis-cursos');
                  else if (user?.role === 'teacher') router.push('/profesor/cursos');
                  else router.push('/estudiante/cursos');
                }}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver a mis cursos
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card sticky top-0 z-50">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (user?.role === 'admin') router.push('/admin/mis-cursos');
              else if (user?.role === 'teacher') router.push('/profesor/cursos');
              else if (user?.role === 'ministerio') router.push('/ministerio');
              else router.push('/estudiante/cursos');
            }}
            className="gap-1 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Volver</span>
          </Button>
          <div className="text-center min-w-0 flex-1">
            <h1 className="text-base sm:text-xl md:text-2xl font-bold truncate">{course?.title || 'Simulación'}</h1>
            <p className="hidden sm:block text-xs sm:text-sm text-muted-foreground truncate">{course?.description}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 shrink-0 text-xs sm:text-sm"
            onClick={() => router.push(`/curso/${courseId}`)}
          >
            <BookOpen className="w-4 h-4" />
            <span className="hidden sm:inline">Info del curso</span>
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {practiceProgress.length > 0 && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 text-left"
                onClick={() => setPracticesExpanded((v) => !v)}
                aria-expanded={practicesExpanded}
              >
                <div className="min-w-0">
                  <CardTitle className="text-lg">Prácticas del curso</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {currentPractice
                      ? `Actual: ${currentPractice.agent_key} — ${currentPractice.title}`
                      : 'Completá cada práctica en orden para desbloquear la siguiente.'}
                    {' · '}
                    {practiceProgress.filter((p) => p.status === 'completed').length}/{practiceProgress.length} completadas
                  </p>
                </div>
                <span className="shrink-0 rounded-md border p-1.5 text-muted-foreground">
                  {practicesExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </span>
              </button>
            </CardHeader>
            {practicesExpanded && (
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {practiceProgress.map((p) => {
                    const isCurrent = currentPractice?.id === p.id;
                    const locked = p.status === 'locked';
                    const completed = p.status === 'completed';
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                          isCurrent
                            ? 'border-primary bg-primary/5'
                            : locked
                              ? 'opacity-50 bg-muted/40'
                              : completed
                                ? 'border-green-300 bg-green-50/50'
                                : ''
                        }`}
                      >
                        {locked ? (
                          <Lock className="w-4 h-4 text-muted-foreground" />
                        ) : completed ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        ) : null}
                        <span className="font-medium">{p.agent_key}</span>
                        <span className="text-muted-foreground hidden sm:inline">
                          {p.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({p.difficulty_label})
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            )}
            {currentPractice && currentPractice.status !== 'completed' && (
              <CardContent className={practicesExpanded ? 'pt-0' : undefined}>
                <div className="flex justify-end">
                  <Button
                    onClick={completePractice}
                    disabled={completingPractice || !simId}
                    variant="default"
                  >
                    {completingPractice ? (
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                    )}
                    Completar práctica
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Dynamic tabs driven by course.modules */}
        {(() => {
          const mods: string[] = Array.isArray(course?.modules) ? course.modules.map((m: string) => m.toLowerCase()) : [];
          const hasChatIA    = mods.includes('chat_ia') || mods.includes('chat') || true; // Siempre mostrar chat por ahora
          const hasEmail     = mods.includes('email_simulado') || mods.includes('email');
          const hasDocs = true; // siempre disponible para materiales y entregas de la práctica
          const hasCalc      = mods.includes('hoja_calculo') || mods.includes('calculator') || mods.includes('excel');
          const defaultTab   = hasChatIA ? 'chat' : hasEmail ? 'email' : hasDocs ? 'docs' : 'sheet';
          const colCount     = [hasChatIA, hasEmail, hasDocs, hasCalc].filter(Boolean).length || 1;

          return (
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
              <div className="flex justify-center w-full mb-6">
                <TabsList className="flex flex-wrap h-auto gap-1">
                {hasChatIA && (
                  <TabsTrigger value="chat" className="gap-2">
                    <MessageSquare className="w-4 h-4" />
                    <span className="hidden sm:inline">Chat IA</span>
                  </TabsTrigger>
                )}
                {hasEmail && (
                  <TabsTrigger value="email" className="gap-2">
                    <Mail className="w-4 h-4" />
                    <span className="hidden sm:inline">Correo</span>
                  </TabsTrigger>
                )}
                {hasDocs && (
                  <TabsTrigger value="docs" className="gap-2">
                    <FileText className="w-4 h-4" />
                    <span className="hidden sm:inline">Documentos</span>
                  </TabsTrigger>
                )}
                {hasCalc && (
                  <TabsTrigger value="sheet" className="gap-2">
                    <BarChart3 className="w-4 h-4" />
                    <span className="hidden sm:inline">Planilla</span>
                  </TabsTrigger>
                )}
              </TabsList>
              </div>

              {/* Chat IA Tab */}
              {hasChatIA && (
              <TabsContent value="chat">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-primary" />
                      {course?.title || 'Chat con Asesor IA'}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Interactuá con tu asesor para resolver la práctica. Si te pide un archivo, subilo en la pestaña Documentos.
                    </p>
                    <p className="text-[11px] text-muted-foreground/80 mt-1">
                      La IA puede cometer errores. Verificá la información importante.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-4">
                      {/* Chat Messages */}
                      <div ref={chatContainerRef} className="rounded-lg border bg-background p-4 h-[calc(100vh-22rem)] min-h-[400px] overflow-y-auto space-y-3 mb-2 scroll-smooth">
                        {chatMessages.map((msg, idx) => {
                          const isAi = msg.role === 'ai';
                          return (
                            <div
                              key={idx}
                              className={`flex gap-2 ${isAi ? '' : 'flex-row-reverse'}`}
                            >
                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                                  isAi ? 'bg-violet-100' : 'bg-sky-100'
                                }`}
                              >
                                {isAi ? (
                                  <Bot className="w-3.5 h-3.5 text-violet-700" />
                                ) : (
                                  <User className="w-3.5 h-3.5 text-sky-700" />
                                )}
                              </div>
                              <div
                                className={`max-w-[80%] text-sm rounded-lg px-3 py-2 ${
                                  isAi ? 'bg-muted' : 'bg-sky-50'
                                }`}
                              >
                                <p className="whitespace-pre-wrap">{msg.message}</p>
                                <div className="text-[10px] text-muted-foreground mt-1">
                                  {new Date(msg.timestamp).toLocaleTimeString('es-AR', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {loadingChat && (
                          <div className="flex gap-2 items-center">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center bg-violet-100 shrink-0">
                              <Bot className="w-3.5 h-3.5 text-violet-700" />
                            </div>
                            <div className="bg-muted rounded-lg px-3 py-2 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                            </div>
                          </div>
                        )}
                        <div ref={chatEndRef} />
                      </div>

                      {/* Input */}
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={e => setChatInput(e.target.value)}
                          onKeyPress={e => e.key === 'Enter' && sendMessage()}
                          placeholder="Escribe tu mensaje..."
                          className="flex-1 px-4 py-2 border rounded-lg"
                        />
                        <Button
                          onClick={sendMessage}
                          disabled={!chatInput.trim() || loadingChat}
                          className="gap-2"
                        >
                          <Send className="w-4 h-4" />
                          Enviar
                        </Button>
                      </div>
                      <p className="text-[11px] text-center text-muted-foreground">
                        La IA puede cometer errores. Verificá la información importante.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              )}

              {/* Email Tab */}
              {hasEmail && (
              <TabsContent value="email">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <Card className="lg:col-span-1">
                    <CardHeader>
                      <CardTitle className="text-lg">Bandeja ({emails.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {emails.length === 0 && <p className="text-sm text-muted-foreground">No hay correos.</p>}
                        {emails.map(email => (
                          <button
                            key={email.id}
                            onClick={() => { setSelectedEmail(email); setReplyOpen(false); setReplyText(''); setEditingEmailId(null); setEditedReplyText(''); }}
                            className={`w-full text-left p-3 rounded-lg border transition ${
                              selectedEmail?.id === email.id
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'hover:bg-muted'
                            }`}
                          >
                            <p className={`text-sm font-semibold ${email.unread ? 'font-bold' : ''}`}>
                              {email.from}
                            </p>
                            <p className="text-xs truncate opacity-75">{email.subject}</p>
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle>
                        {selectedEmail ? selectedEmail.subject : 'Selecciona un correo'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {selectedEmail ? (
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm text-muted-foreground">De:</p>
                            <p className="font-semibold">{selectedEmail.from}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Mensaje:</p>
                            <p className="mt-2">{selectedEmail.body}</p>
                          </div>
                          {editingEmailId === selectedEmail.id ? (
                            <div className="space-y-2 border-t pt-4">
                              <p className="text-sm text-muted-foreground">
                                Editando respuesta a <span className="font-semibold">{selectedEmail.from}</span>
                              </p>
                              <Textarea
                                value={editedReplyText}
                                onChange={e => setEditedReplyText(e.target.value)}
                                placeholder="Escribí tu corrección..."
                                rows={5}
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <Button
                                  className="gap-2"
                                  onClick={sendEditedEmailReply}
                                  disabled={!editedReplyText.trim() || sendingReply}
                                >
                                  <Send className="w-4 h-4" />
                                  {sendingReply ? 'Guardando...' : 'Guardar corrección'}
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => { setEditingEmailId(null); setEditedReplyText(''); }}
                                  disabled={sendingReply}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          ) : sentReplies[selectedEmail.id] ? (
                            <div className="space-y-2 border-t pt-4">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-semibold text-muted-foreground">Tu respuesta:</p>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1.5"
                                  onClick={() => {
                                    setEditingEmailId(selectedEmail.id);
                                    setEditedReplyText(sentReplies[selectedEmail.id]);
                                  }}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  Editar
                                </Button>
                              </div>
                              <p className="text-sm bg-muted/50 p-3 rounded-md whitespace-pre-wrap">
                                {sentReplies[selectedEmail.id]}
                              </p>
                            </div>
                          ) : !replyOpen ? (
                            <Button
                              className="w-full gap-2"
                              onClick={() => { setReplyOpen(true); setReplyText(''); }}
                            >
                              <Mail className="w-4 h-4" />
                              Responder
                            </Button>
                          ) : (
                            <div className="space-y-2 border-t pt-4">
                              <p className="text-sm text-muted-foreground">
                                Respondiendo a <span className="font-semibold">{selectedEmail.from}</span>
                              </p>
                              <Textarea
                                value={replyText}
                                onChange={e => setReplyText(e.target.value)}
                                placeholder="Escribí tu respuesta..."
                                rows={5}
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <Button
                                  className="gap-2"
                                  onClick={sendEmailReply}
                                  disabled={!replyText.trim() || sendingReply}
                                >
                                  <Send className="w-4 h-4" />
                                  {sendingReply ? 'Enviando...' : 'Enviar respuesta'}
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => { setReplyOpen(false); setReplyText(''); }}
                                  disabled={sendingReply}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-8">
                          Selecciona un correo de la bandeja
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
              )}

              {/* Documents Tab */}
              {hasDocs && (
              <TabsContent value="docs">
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Paperclip className="w-5 h-5" />
                        Tus entregas
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Subí acá los archivos que te pida el asesor (máx. 5 MB por archivo). El docente los verá en tu sesión.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={handlePracticeFileSelect}
                      />
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          type="button"
                          disabled={!simId || uploadingFile}
                          onClick={() => fileInputRef.current?.click()}
                          className="gap-2"
                        >
                          {uploadingFile ? (
                            <Loader className="w-4 h-4 animate-spin" />
                          ) : (
                            <Paperclip className="w-4 h-4" />
                          )}
                          {uploadingFile ? 'Subiendo...' : 'Subir archivo'}
                        </Button>
                        {course?.drive_folder_url && (
                          <a
                            href={course.drive_folder_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Archivos &gt; 5 MB: Drive del curso
                          </a>
                        )}
                      </div>

                      {sessionFiles.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Todavía no subiste archivos en esta práctica.</p>
                      ) : (
                        <ul className="space-y-2">
                          {sessionFiles.map((f) => (
                            <li key={f.id}>
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted"
                                onClick={async () => {
                                  try {
                                    const res = await authFetch(`${API_BASE}/files/${f.id}/download`);
                                    if (!res.ok) throw new Error('Download failed');
                                    const blob = await res.blob();
                                    const url = URL.createObjectURL(blob);
                                    const a = Object.assign(document.createElement('a'), {
                                      href: url,
                                      download: f.file_name,
                                    });
                                    a.click();
                                    URL.revokeObjectURL(url);
                                  } catch {
                                    toast.error('No se pudo descargar el archivo');
                                  }
                                }}
                              >
                                <FileText className="w-4 h-4 shrink-0 text-primary" />
                                <span className="flex-1 truncate">{f.file_name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {Math.round(Number(f.file_size_bytes) / 1024)} KB
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                  </Card>

                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">Material del curso</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {documents.length === 0 && (
                        <p className="text-muted-foreground text-sm">No hay documentos de material disponibles.</p>
                      )}
                      {documents.map(doc => (
                        <Card key={doc.id} className="cursor-pointer hover:shadow-lg transition">
                          <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                              <FileText className="w-5 h-5" />
                              {doc.name}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            {doc.url ? (
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline break-all"
                              >
                                {doc.url}
                              </a>
                            ) : (
                              <p className="text-sm text-muted-foreground">Sin enlace disponible</p>
                            )}
                            {doc.url && (
                              <Button
                                className="w-full mt-4"
                                variant="outline"
                                onClick={() => setSelectedDoc(doc)}
                              >
                                Abrir Documento
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>
              )}

              {/* Spreadsheet Tab */}
              {hasCalc && (
              <TabsContent value="sheet">
                <Card>
                  <CardHeader>
                    <CardTitle>{spreadsheet?.name || 'Planilla de Cálculos'}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b bg-muted">
                            <th className="text-left p-3 font-semibold">Item</th>
                            <th className="text-right p-3 font-semibold">Valor</th>
                            <th className="text-right p-3 font-semibold">Moneda</th>
                          </tr>
                        </thead>
                        <tbody>
                          {spreadsheet?.data?.map((row: any, idx: number) => (
                            <tr key={idx} className="border-b hover:bg-muted/50">
                              <td className="p-3">{row.item}</td>
                              <td className="text-right p-3 font-semibold">{formatSpreadsheetValue(row.value, row.currency)}</td>
                              <td className="text-right p-3 text-muted-foreground">{row.currency}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {spreadsheet?.formulas && (
                      <div className="mt-6 p-4 bg-muted rounded">
                        <h4 className="font-semibold mb-2">Fórmulas Utilizadas:</h4>
                        {Object.entries(spreadsheet.formulas).map(([key, formula]) => (
                          <p key={key} className="text-sm font-mono">
                            <span className="text-primary">{key}:</span> {formula as string}
                          </p>
                        ))}
                      </div>
                    )}

                    <Button 
                      className="w-full mt-6" 
                      variant="outline"
                      onClick={handleDownloadExcel}
                    >
                      📥 Descargar Planilla (Excel)
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
              )}
            </Tabs>
          );
        })()}
      </main>

      {/* Document Modal */}
      <Dialog open={!!selectedDoc} onOpenChange={(open) => !open && setSelectedDoc(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <FileText className="w-5 h-5 text-primary" />
              {selectedDoc?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedDoc?.type ? `Documento tipo: ${selectedDoc.type}` : 'Documento de la simulación'}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 p-6 bg-muted/30 border rounded-lg text-sm leading-relaxed">
            {selectedDoc?.url ? (
              <a
                href={selectedDoc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline break-all"
              >
                {selectedDoc.url}
              </a>
            ) : (
              <p className="text-muted-foreground">Sin enlace disponible para este documento.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SimulationPage;
