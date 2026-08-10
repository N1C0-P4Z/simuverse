'use client'
import { PartnersStrip } from '@/components/PartnersStrip';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { ArrowRight, BarChart3, BookOpen, Settings, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';

const Index = () => {
  const { loading } = useAuth();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-3xl text-center fade-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-6">
            <img src="/logos/fundacion-logo.svg" alt="SimuVerse" className="w-10 h-10 object-contain" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-4">
            SimuVerse
          </h1>
          <p className="text-xl text-primary font-medium mb-3">Motor de Simulación Modular</p>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
            Plataforma educativa inmersiva con IA. Simulaciones adaptables para prácticas profesionalizantes.
          </p>
          <PartnersStrip includeEndorsers className="mb-8" />
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" onClick={() => router.push('/auth')} className="gap-2" disabled={loading}>
              {loading ? 'Cargando...' : 'Comenzar'} <ArrowRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16">
            {[
              { icon: <Zap className="w-5 h-5" />, title: 'IA Adaptativa', desc: 'Personajes con personalidad dinámica' },
              { icon: <BookOpen className="w-5 h-5" />, title: 'Modular', desc: 'Configurable sin programar' },
              { icon: <BarChart3 className="w-5 h-5" />, title: 'Telemetría', desc: 'Evaluación automática por KPIs' },
              { icon: <Settings className="w-5 h-5" />, title: 'Escalable', desc: 'De 1 a N cursos con JSON' },
            ].map((f, i) => (
              <div key={i} className="p-4 rounded-xl bg-card border text-center">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary mb-2">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-sm">{f.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t py-4">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          MSM — Motor de Simulación Modular © {new Date().getFullYear()} ·{' '}
          <a href="/terminos" className="underline hover:text-foreground">
            Términos
          </a>
        </div>
      </footer>
    </div>
  );
};

export default Index;
