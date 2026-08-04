'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function EstudianteCursoLandingRedirect() {
  const { courseId } = useParams<{ courseId: string }>();
  const router = useRouter();

  useEffect(() => {
    if (courseId) router.replace(`/curso/${courseId}`);
  }, [courseId, router]);

  return null;
}
