import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock('@/lib/admin-context', () => ({ useAdmin: () => ({ readOnly: false }) }));
vi.mock('@/lib/api', () => ({ API_BASE: 'http://localhost:5001/api', authFetch: vi.fn() }));
vi.mock('@/services/ApiClient', () => ({
  apiClient: {
    get: mockGet,
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { DocumentsABM } from '@/components/DocumentsABM';

describe('DocumentsABM — course filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockImplementation((url: string, _opts?: any) => {
      if (url === '/documents') return Promise.resolve({ data: [{ id: 1, course_id: 'c1', document_name: 'Doc A', file_url: 'https://x.com/a.pdf', created_at: '2025-01-01', is_active: true }] });
      if (url === '/courses') return Promise.resolve({ data: [{ id: 'c1', title: 'Course 1' }, { id: 'c2', title: 'Course 2' }] });
      return Promise.resolve({ data: [] });
    });
  });

  it('renders a course filter dropdown with "Todos los cursos" text', async () => {
    render(<DocumentsABM />);

    await waitFor(() => {
      expect(screen.getByText('Doc A')).toBeInTheDocument();
    });

    // The filter dropdown should show "Todos los cursos"
    expect(screen.getByText('Todos los cursos')).toBeInTheDocument();
  });

  it('fetches documents on mount without course_id', async () => {
    render(<DocumentsABM />);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/documents', expect.anything());
    });

    // The first /documents call should have no course_id filter
    const documentsCalls = mockGet.mock.calls.filter((c: any[]) => c[0] === '/documents');
    expect(documentsCalls.length).toBeGreaterThanOrEqual(1);
    // First call should have undefined params (no filter)
    expect(documentsCalls[0][1]).toEqual({ params: undefined });
  });

  it('fetches courses for the filter dropdown', async () => {
    render(<DocumentsABM />);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/courses');
    });
  });
});
