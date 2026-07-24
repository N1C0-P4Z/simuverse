'use client'
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { SponsorCarousel, SponsorItem } from '@/components/SponsorCarousel';
import { apiClient } from '@/services/ApiClient';
import { Code2 } from 'lucide-react';

interface FooterProps {
  sponsors?: SponsorItem[];
  courseId?: string;
  className?: string;
}

export function Footer({ sponsors: initialSponsors, courseId: propCourseId, className = '' }: FooterProps) {
  const pathname = usePathname();


  const match = pathname?.match(/^\/(?:simulation|courses)\/([a-zA-Z0-9-]+)/);
  const courseId = propCourseId || (match ? match[1] : undefined);

  const [sponsors, setSponsors] = useState<SponsorItem[]>(initialSponsors || []);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (initialSponsors) {
      setSponsors(initialSponsors);
      return;
    }

    let isMounted = true;
    const fetchSponsors = async () => {
      try {
        const endpoint = courseId ? `/courses/${courseId}/sponsors` : '/sponsors';
        const res = await apiClient.get(endpoint);
        const data = Array.isArray(res.data) ? res.data : [];
        if (isMounted) {
          setSponsors(data.filter((s: any) => s && s.is_active !== false));
        }
      } catch {
        if (isMounted) setSponsors([]);
      }
    };

    fetchSponsors();
    return () => {
      isMounted = false;
    };
  }, [courseId, initialSponsors]);

  if (pathname?.startsWith('/auth')) {
    return null;
  }

  return (
    <footer className={`w-full bg-slate-900 text-slate-300 border-t border-slate-800 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Sponsors Carousel */}
        {sponsors.length > 0 && (
          <div className="border-b border-slate-800 pb-6">
            <SponsorCarousel sponsors={sponsors} title="Sponsors" />
          </div>
        )}

        {/* LambdaWorks Footer Info */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-400">
          <a
            href="https://lambdaworks.ar/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 group"
          >
            <span className="font-medium text-slate-300 group-hover:text-white transition-colors">Desarrollado por</span>
            {!imgError ? (
              <img
                src="/lambda-icon.png"
                alt="LambdaWorks"
                className="w-6 h-6 object-contain"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-6 h-6 rounded bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
                λ
              </div>
            )}
            <span className="font-semibold text-indigo-400">LambdaWorks</span>
          </a>

          <p className="text-xs">© {new Date().getFullYear()} Simuverse Engine. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
