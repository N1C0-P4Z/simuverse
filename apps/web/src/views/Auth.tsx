'use client'
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { authChangeEvent } from '@/hooks/useAuth';
import { useRecaptcha } from '@/hooks/useRecaptcha';
import {
  firebaseEmailLogin,
  firebaseGoogleLogin,
  getFirebaseIdToken,
  isFirebaseConfigured,
} from '@/lib/firebase';
import { apiClient } from '@/services/ApiClient';
import { Bot, Eye, EyeOff, GraduationCap, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type TermsInfo = { id: number; version: string; title: string; content: string } | null;

const Auth = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [showSignupPwd, setShowSignupPwd] = useState(false);
  const [terms, setTerms] = useState<TermsInfo>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const loginCaptcha = useRecaptcha();
  const signupCaptcha = useRecaptcha();

  useEffect(() => {
    apiClient
      .get('/auth/terms/current')
      .then((r) => setTerms(r.data || null))
      .catch(() => setTerms(null));
  }, []);

  const persistSession = async (user: any, token: string) => {
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('user', JSON.stringify(user));
    sessionStorage.removeItem('refreshToken');
    authChangeEvent.dispatchEvent(new Event('authChange'));
    toast.success('Sesión iniciada exitosamente');
    setTimeout(() => {
      router.replace(
        user.role === 'ministerio'
          ? '/ministerio'
          : user.role === 'admin'
            ? '/admin/mis-cursos'
            : user.role === 'teacher' || user.role === 'supervisor'
              ? '/profesor/cursos'
              : '/estudiante/cursos',
      );
    }, 150);
  };

  const loadProfileWithToken = async (token: string) => {
    sessionStorage.setItem('token', token);
    const profile = await apiClient.get('/auth/me');
    const user = {
      id: profile.data.id,
      email: profile.data.email,
      name: profile.data.name,
      role: profile.data.role,
      terms_accepted: profile.data.terms_accepted,
    };
    if (profile.data.terms_accepted === false && profile.data.current_terms) {
      sessionStorage.setItem('user', JSON.stringify(user));
      sessionStorage.setItem('pending_terms', JSON.stringify(profile.data.current_terms));
      authChangeEvent.dispatchEvent(new Event('authChange'));
      router.replace('/auth/terms');
      return;
    }
    await persistSession(user, token);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginCaptcha.enabled && !loginCaptcha.token) {
      toast.error('Completá el reCAPTCHA');
      return;
    }
    setLoading(true);
    try {
      if (isFirebaseConfigured) {
        await firebaseEmailLogin(email, password);
        const token = await getFirebaseIdToken(true);
        if (!token) throw new Error('No se pudo obtener el token de Firebase');
        await loadProfileWithToken(token);
      } else {
        const response = await apiClient.post('/auth/login', {
          email,
          password,
          recaptchaToken: loginCaptcha.token,
        });
        const { token, user, refreshToken } = response.data;
        if (refreshToken) sessionStorage.setItem('refreshToken', refreshToken);
        await persistSession(user, token);
      }
    } catch (error: any) {
      let errorMsg =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Error al iniciar sesión';
      if (errorMsg === 'Unauthorized' || error.response?.status === 401) {
        errorMsg = 'Credenciales incorrectas';
      }
      toast.error(errorMsg);
      loginCaptcha.reset();
    }
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error('Por favor ingrese su nombre completo');
      return;
    }
    if (terms && !acceptTerms) {
      toast.error('Debés aceptar los términos y condiciones');
      return;
    }
    if (signupCaptcha.enabled && !signupCaptcha.token) {
      toast.error('Completá el reCAPTCHA');
      return;
    }
    setLoading(true);
    try {
      const response = await apiClient.post('/auth/register', {
        email,
        password,
        name: fullName,
        recaptchaToken: signupCaptcha.token,
        acceptTerms: terms ? acceptTerms : true,
        termsVersionId: terms?.id,
      });

      if (isFirebaseConfigured && response.data.requiresFirebaseSignIn) {
        await firebaseEmailLogin(email, password);
        const token = await getFirebaseIdToken(true);
        if (!token) throw new Error('No se pudo obtener el token de Firebase');
        await loadProfileWithToken(token);
      } else {
        const { token, user, refreshToken } = response.data;
        if (refreshToken) sessionStorage.setItem('refreshToken', refreshToken);
        await persistSession(user, token);
      }
    } catch (error: any) {
      let errorMsg =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Error al crear cuenta';
      if (error.response?.status === 400) {
        errorMsg = error.response?.data?.message || 'Faltan datos o el formato es inválido';
      }
      toast.error(errorMsg);
      signupCaptcha.reset();
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    if (signupCaptcha.enabled && !signupCaptcha.token && !loginCaptcha.token) {
      toast.error('Completá el reCAPTCHA antes de continuar con Google');
      return;
    }
    setLoading(true);
    try {
      if (!isFirebaseConfigured) {
        toast.error('Firebase no está configurado');
        return;
      }
      await firebaseGoogleLogin();
      const token = await getFirebaseIdToken(true);
      if (!token) throw new Error('No se pudo obtener el token de Firebase');
      // Ensure local user + optional terms acceptance for brand-new Google users
      sessionStorage.setItem('token', token);
      if (terms && acceptTerms) {
        try {
          await apiClient.post('/auth/accept-terms', { termsVersionId: terms.id });
        } catch {
          // profile gate will force acceptance if needed
        }
      }
      await loadProfileWithToken(token);
    } catch (error: any) {
      toast.error(error.message || 'Error con Google Sign-In');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <Button
        variant="ghost"
        className="absolute top-4 left-4 gap-2 text-muted-foreground hover:text-foreground hover:bg-muted"
        onClick={() => router.push('/')}
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="hidden sm:inline">Volver al inicio</span>
        <span className="sm:hidden">Volver</span>
      </Button>
      <div className="w-full max-w-md fade-in">
        <header className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4">
            <img src="/logos/fundacion-logo.svg" alt="SimuVerse" className="w-8 h-8 object-contain" />
          </div>
          <h1 className="text-3xl font-bold">SimuVerse</h1>
          <p className="text-muted-foreground mt-1">Motor de Simulación Modular</p>
        </header>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-xl">Acceder al Sistema</CardTitle>
            <CardDescription>Ingrese sus credenciales para continuar</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
                <TabsTrigger value="signup">Registrarse</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="alumno@ejemplo.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Contraseña</Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        type={showLoginPwd ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowLoginPwd((v) => !v)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground transition"
                        aria-label={showLoginPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      >
                        {showLoginPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div ref={loginCaptcha.containerRef} className="flex justify-center min-h-[78px]" />
                  {!loginCaptcha.enabled && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Bot className="w-3 h-3" />
                      reCAPTCHA no configurado (modo desarrollo)
                    </div>
                  )}

                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Ingresando...' : 'Iniciar Sesión'}
                  </Button>
                  {isFirebaseConfigured && (
                    <Button type="button" variant="outline" className="w-full" onClick={handleGoogle} disabled={loading}>
                      Continuar con Google
                    </Button>
                  )}
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Nombre Completo</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      placeholder="Juan Pérez"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="alumno@ejemplo.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Contraseña</Label>
                    <div className="relative">
                      <Input
                        id="signup-password"
                        type={showSignupPwd ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        placeholder="Mínimo 6 caracteres"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowSignupPwd((v) => !v)}
                        className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground transition"
                        aria-label={showSignupPwd ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      >
                        {showSignupPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {terms && (
                    <div className="space-y-2 rounded-lg border p-3">
                      <div className="flex items-start gap-2">
                        <Checkbox
                          id="accept-terms"
                          checked={acceptTerms}
                          onCheckedChange={(v) => setAcceptTerms(!!v)}
                        />
                        <label htmlFor="accept-terms" className="text-sm leading-snug cursor-pointer">
                          Acepto los{' '}
                          <button
                            type="button"
                            className="underline text-primary"
                            onClick={() => setShowTerms((s) => !s)}
                          >
                            términos y condiciones
                          </button>{' '}
                          (v{terms.version})
                        </label>
                      </div>
                      {showTerms && (
                        <div className="max-h-40 overflow-y-auto text-xs text-muted-foreground whitespace-pre-wrap border-t pt-2">
                          <strong>{terms.title}</strong>
                          {'\n\n'}
                          {terms.content}
                        </div>
                      )}
                    </div>
                  )}

                  <div ref={signupCaptcha.containerRef} className="flex justify-center min-h-[78px]" />

                  <Button type="submit" className="w-full" disabled={loading}>
                    <GraduationCap className="w-4 h-4 mr-2" />
                    {loading ? 'Registrando...' : 'Crear Cuenta'}
                  </Button>
                  {isFirebaseConfigured && (
                    <Button type="button" variant="outline" className="w-full" onClick={handleGoogle} disabled={loading}>
                      Registrarse con Google
                    </Button>
                  )}
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
