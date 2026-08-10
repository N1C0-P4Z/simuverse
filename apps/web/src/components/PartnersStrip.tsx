'use client'
import { useEffect, useState } from 'react';
import { SponsorCarousel, SponsorItem } from '@/components/SponsorCarousel';
import { apiClient } from '@/services/ApiClient';

function normalizeList(raw: unknown): SponsorItem[] {
  const data = Array.isArray(raw) ? raw : [];
  return data
    .filter((item: { is_active?: boolean }) => item && item.is_active !== false)
    .map(({ id, name, logo_url, website }) => ({ id, name, logo_url, website }));
}

interface PartnersStripProps {
  courseId?: string;
  includeEndorsers?: boolean;
  className?: string;
  initialSponsors?: SponsorItem[];
  initialEndorsers?: SponsorItem[];
}

export function PartnersStrip({
  courseId,
  includeEndorsers = false,
  className = '',
  initialSponsors,
  initialEndorsers,
}: PartnersStripProps) {
  const [partners, setPartners] = useState<SponsorItem[]>([]);

  useEffect(() => {
    let isMounted = true;

    const fetchPartners = async () => {
      let sponsors: SponsorItem[] = [];

      if (initialSponsors) {
        sponsors = initialSponsors;
      } else {
        try {
          const endpoint = courseId
            ? `/courses/${courseId}/sponsors`
            : '/sponsors?limit=100';
          const res = await apiClient.get(endpoint);
          const raw = res.data?.data ?? res.data;
          sponsors = normalizeList(raw);
        } catch {
          sponsors = [];
        }
      }

      let endorsers: SponsorItem[] = [];

      if (includeEndorsers) {
        if (initialEndorsers) {
          endorsers = initialEndorsers;
        } else {
          try {
            const res = await apiClient.get('/endorsers/active');
            const raw = res.data?.data ?? res.data;
            endorsers = normalizeList(raw);
          } catch {
            endorsers = [];
          }
        }
      }

      if (isMounted) setPartners([...sponsors, ...endorsers]);
    };

    void fetchPartners();

    return () => {
      isMounted = false;
    };
  }, [courseId, includeEndorsers, initialSponsors, initialEndorsers]);

  if (partners.length === 0) return null;

  return (
    <section className={`w-full ${className}`}>
      <SponsorCarousel sponsors={partners} title="Patrocinadores y Auspiciantes" />
    </section>
  );
}
