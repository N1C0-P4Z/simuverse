'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/services/ApiClient';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface UsePaginationOptions {
  endpoint: string;
  limit?: number;
  extraParams?: Record<string, unknown>;
}

export interface UsePaginationReturn<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
  setPage: (page: number) => void;
  setExtraParams: (params: Record<string, unknown>) => void;
}

export function usePagination<T>({
  endpoint,
  limit = 20,
  extraParams = {},
}: UsePaginationOptions): UsePaginationReturn<T> {
  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPageState] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState(extraParams);

  const totalPages = total > 0 ? Math.ceil(total / limit) : 0;

  const fetchData = useCallback(
    async (currentPage: number, currentParams: Record<string, unknown>) => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiClient.get<PaginatedResponse<T>>(endpoint, {
          params: { page: currentPage, limit, ...currentParams },
        });

        const result = response.data;
        setData(result.data);
        setTotal(result.total);
        setPageState(result.page);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        setData([]);
      } finally {
        setLoading(false);
      }
    },
    [endpoint, limit],
  );

  useEffect(() => {
    fetchData(page, params);
  }, [fetchData, page, params]);

  const setPage = useCallback(
    (newPage: number) => {
      setPageState(newPage);
    },
    [],
  );

  const setExtraParams = useCallback(
    (newParams: Record<string, unknown>) => {
      setParams(newParams);
      setPageState(1);
    },
    [],
  );

  return { data, total, page, totalPages, loading, error, setPage, setExtraParams };
}
