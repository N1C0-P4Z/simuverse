'use client'
import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from 'react';

export interface SponsorItem {
  id: number;
  name: string;
  logo_url?: string;
  website?: string;
}

interface SponsorCarouselProps {
  sponsors: SponsorItem[];
  title?: string;
}

const BRAND_COLORS = [
  'bg-blue-500',
  'bg-purple-500',
  'bg-green-600',
  'bg-orange-500',
  'bg-rose-500',
  'bg-teal-600',
  'bg-indigo-500',
  'bg-amber-600',
];

const MARQUEE_SPEED = 0.5;
const DRAG_THRESHOLD = 5;

const getColor = (name: string) =>
  BRAND_COLORS[((name.charCodeAt(0) || 0) + (name.charCodeAt(1) || 0)) % BRAND_COLORS.length];

const getInitials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

function SponsorLogo({ sponsor }: { sponsor: SponsorItem }) {
  const [imgError, setImgError] = useState(false);

  if (sponsor.logo_url && !imgError) {
    const logoContent = (
      <div className="w-16 h-16 transition-all duration-300 flex items-center justify-center shrink-0">
        <img
          src={sponsor.logo_url}
          alt={sponsor.name}
          className="w-full h-full object-contain grayscale opacity-70 transition-all duration-300 hover:grayscale-0 hover:opacity-100"
          onError={() => setImgError(true)}
        />
      </div>
    );

    if (sponsor.website) {
      return (
        <a
          href={sponsor.website}
          target="_blank"
          rel="noopener noreferrer"
          title={sponsor.name}
          className="focus:outline-none focus:ring-2 focus:ring-slate-400 rounded-md"
        >
          {logoContent}
        </a>
      );
    }
    return logoContent;
  }

  const content = (
    <div className="flex items-center gap-2.5 px-4 py-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-full border border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:shadow-md hover:border-slate-300 hover:[&_span]:text-slate-900 dark:hover:[&_span]:text-white transition-all duration-200">
      <div
        className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 ${getColor(
          sponsor.name,
        )}`}
      >
        {getInitials(sponsor.name)}
      </div>
      <span className="text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors truncate max-w-[140px]">
        {sponsor.name}
      </span>
    </div>
  );

  if (sponsor.website) {
    return (
      <a
        href={sponsor.website}
        target="_blank"
        rel="noopener noreferrer"
        title={sponsor.name}
        className="focus:outline-none focus:ring-2 focus:ring-slate-400 rounded-full"
      >
        {content}
      </a>
    );
  }

  return content;
}

const MAX_REPEAT_FACTOR = 30;

export function SponsorCarousel({ sponsors, title = 'Patrocinadores y Aliados' }: SponsorCarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);
  const halfWidthRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const isDraggingRef = useRef(false);
  const pointerActiveRef = useRef(false);
  const startPointerXRef = useRef(0);
  const isHoveredRef = useRef(false);
  const prefersReducedMotionRef = useRef(false);
  const lastPointerXRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [repeatFactor, setRepeatFactor] = useState(1);

  const sponsorsKey = useMemo(
    () => sponsors?.map((s) => s.id).join(',') ?? '',
    [sponsors],
  );

  const baseItems = useMemo(() => {
    if (!sponsors?.length) return [];
    let items: SponsorItem[] = [];
    for (let i = 0; i < repeatFactor; i++) {
      items = [...items, ...sponsors];
    }
    return items;
  }, [sponsors, repeatFactor]);

  const measureHalfWidth = useCallback(() => {
    if (trackRef.current) {
      halfWidthRef.current = trackRef.current.scrollWidth / 2;
    }
  }, []);

  const normalizeOffset = useCallback((offset: number) => {
    const half = halfWidthRef.current;
    if (half <= 0) return offset;
    let o = offset;
    while (o >= half) o -= half;
    while (o < 0) o += half;
    return o;
  }, []);

  const applyTransform = useCallback(() => {
    if (trackRef.current) {
      trackRef.current.style.transform = `translateX(${-offsetRef.current}px)`;
    }
  }, []);

  const suppressClickAfterDrag = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const onClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      el.removeEventListener('click', onClick, true);
    };
    el.addEventListener('click', onClick, true);
  }, []);

  const endPointerSession = useCallback(
    (target: HTMLElement, pointerId: number) => {
      if (!pointerActiveRef.current) return;
      if (isDraggingRef.current) suppressClickAfterDrag();
      pointerActiveRef.current = false;
      isDraggingRef.current = false;
      setIsDragging(false);
      try {
        target.releasePointerCapture(pointerId);
      } catch {
        /* already released */
      }
    },
    [suppressClickAfterDrag],
  );

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    pointerActiveRef.current = true;
    startPointerXRef.current = e.clientX;
    lastPointerXRef.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!pointerActiveRef.current) return;

      if (!isDraggingRef.current) {
        if (Math.abs(e.clientX - startPointerXRef.current) <= DRAG_THRESHOLD) return;
        isDraggingRef.current = true;
        setIsDragging(true);
        lastPointerXRef.current = e.clientX;
        return;
      }

      const delta = e.clientX - lastPointerXRef.current;
      lastPointerXRef.current = e.clientX;
      offsetRef.current -= delta;
      offsetRef.current = normalizeOffset(offsetRef.current);
      applyTransform();
    },
    [normalizeOffset, applyTransform],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      endPointerSession(e.currentTarget, e.pointerId);
    },
    [endPointerSession],
  );

  const handlePointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      endPointerSession(e.currentTarget, e.pointerId);
    },
    [endPointerSession],
  );

  useEffect(() => {
    setRepeatFactor(1);
    offsetRef.current = 0;
  }, [sponsorsKey]);

  useLayoutEffect(() => {
    if (!sponsors?.length) return;

    const checkSegmentWidth = () => {
      measureHalfWidth();
      const container = containerRef.current;
      const track = trackRef.current;
      if (!container || !track) return;

      const halfWidth = track.scrollWidth / 2;
      const containerWidth = container.clientWidth;

      if (halfWidth > 0 && halfWidth < containerWidth && repeatFactor < MAX_REPEAT_FACTOR) {
        setRepeatFactor((f) => f + 1);
      }
    };

    checkSegmentWidth();

    const ro = new ResizeObserver(checkSegmentWidth);
    if (containerRef.current) ro.observe(containerRef.current);
    if (trackRef.current) ro.observe(trackRef.current);

    return () => ro.disconnect();
  }, [sponsorsKey, repeatFactor, measureHalfWidth, sponsors?.length]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotionRef.current = mq.matches;
    const onChange = (e: MediaQueryListEvent) => {
      prefersReducedMotionRef.current = e.matches;
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    measureHalfWidth();
    const ro = new ResizeObserver(measureHalfWidth);
    if (trackRef.current) ro.observe(trackRef.current);

    const tick = () => {
      if (!prefersReducedMotionRef.current && !isDraggingRef.current && !isHoveredRef.current) {
        offsetRef.current += MARQUEE_SPEED;
        if (halfWidthRef.current > 0 && offsetRef.current >= halfWidthRef.current) {
          offsetRef.current -= halfWidthRef.current;
        }
      }
      applyTransform();
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      ro.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [measureHalfWidth, applyTransform]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      const delta = e.deltaX !== 0 ? e.deltaX : e.shiftKey ? e.deltaY : 0;
      if (delta === 0) return;
      e.preventDefault();
      offsetRef.current += delta;
      offsetRef.current = normalizeOffset(offsetRef.current);
      applyTransform();
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [normalizeOffset, applyTransform]);

  if (!sponsors || sponsors.length === 0) return null;

  return (
    <div className="w-full py-4 space-y-3">
      {title && (
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 text-center">
          {title}
        </p>
      )}
      <div
        ref={containerRef}
        className={`w-full overflow-hidden touch-pan-y select-none ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onMouseEnter={() => {
          isHoveredRef.current = true;
        }}
        onMouseLeave={() => {
          isHoveredRef.current = false;
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div ref={trackRef} className="flex w-max items-center gap-4 py-2 will-change-transform">
          {baseItems.map((sponsor, index) => (
            <div key={`a-${index}-${sponsor.id}-${sponsor.name}`} className="shrink-0">
              <SponsorLogo sponsor={sponsor} />
            </div>
          ))}
          {baseItems.map((sponsor, index) => (
            <div key={`b-${index}-${sponsor.id}-${sponsor.name}`} className="shrink-0">
              <SponsorLogo sponsor={sponsor} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
