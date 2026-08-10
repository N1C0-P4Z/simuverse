'use client'
import { useState } from 'react';
import { usePathname } from 'next/navigation';

interface FooterProps {
  className?: string;
}

export function Footer({ className = '' }: FooterProps) {
  const pathname = usePathname();
  const [imgError, setImgError] = useState(false);

  if (pathname?.startsWith('/auth')) {
    return null;
  }

  return (
    <footer className={`w-full bg-slate-900 text-slate-300 border-t border-slate-800 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 py-8">
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
