import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { usePagination } from '../usePagination';

vi.mock('@/services/ApiClient', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from '@/services/ApiClient';
const mockGet = vi.mocked(apiClient.get);

describe('usePagination', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('fetches data on mount with default page=1 and limit=20', async () => {
    mockGet.mockResolvedValue({
      data: { data: [{ id: 1 }], total: 50, page: 1, limit: 20 },
    });

    const { result } = renderHook(() =>
      usePagination({ endpoint: '/items' }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith('/items', {
      params: { page: 1, limit: 20 },
    });
    expect(result.current.data).toEqual([{ id: 1 }]);
    expect(result.current.total).toBe(50);
    expect(result.current.page).toBe(1);
    expect(result.current.totalPages).toBe(3);
  });

  it('calculates totalPages correctly', async () => {
    mockGet.mockResolvedValue({
      data: { data: [], total: 45, page: 1, limit: 20 },
    });

    const { result } = renderHook(() =>
      usePagination({ endpoint: '/items' }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.totalPages).toBe(3); // ceil(45/20)
  });

  it('navigates to next page and refetches', async () => {
    mockGet
      .mockResolvedValueOnce({
        data: { data: [{ id: 1 }], total: 50, page: 1, limit: 20 },
      })
      .mockResolvedValueOnce({
        data: { data: [{ id: 2 }], total: 50, page: 2, limit: 20 },
      });

    const { result } = renderHook(() =>
      usePagination({ endpoint: '/items' }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setPage(2);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith('/items', {
      params: { page: 2, limit: 20 },
    });
    expect(result.current.data).toEqual([{ id: 2 }]);
    expect(result.current.page).toBe(2);
  });

  it('sets error on API failure', async () => {
    mockGet.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() =>
      usePagination({ endpoint: '/items' }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Network error');
    expect(result.current.data).toEqual([]);
  });

  it('sends extraParams with the request', async () => {
    mockGet.mockResolvedValue({
      data: { data: [], total: 0, page: 1, limit: 20 },
    });

    const { result } = renderHook(() =>
      usePagination({ endpoint: '/items', extraParams: { status: 'active' } }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith('/items', {
      params: { page: 1, limit: 20, status: 'active' },
    });
  });

  it('setExtraParams replaces params and resets page to 1', async () => {
    mockGet
      .mockResolvedValueOnce({
        data: { data: [{ id: 1 }], total: 50, page: 3, limit: 20 },
      })
      .mockResolvedValueOnce({
        data: { data: [{ id: 99 }], total: 5, page: 1, limit: 20 },
      });

    const { result } = renderHook(() =>
      usePagination({ endpoint: '/items' }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Navigate to page 3 first
    act(() => {
      result.current.setPage(3);
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Now change extraParams — should reset to page 1
    act(() => {
      result.current.setExtraParams({ status: 'inactive' });
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGet).toHaveBeenLastCalledWith('/items', {
      params: { page: 1, limit: 20, status: 'inactive' },
    });
    expect(result.current.page).toBe(1);
  });

  it('respects custom limit', async () => {
    mockGet.mockResolvedValue({
      data: { data: [], total: 100, page: 1, limit: 50 },
    });

    const { result } = renderHook(() =>
      usePagination({ endpoint: '/items', limit: 50 }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith('/items', {
      params: { page: 1, limit: 50 },
    });
  });
});
