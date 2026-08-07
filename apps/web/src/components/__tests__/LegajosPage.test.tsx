import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

// Mock dependencies
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', role: 'admin' }, loading: false, hasRole: () => true }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/legajos',
}));
vi.mock('@/services/ApiClient', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({
      data: [
        { id: 's1', name: 'Alice', email: 'a@test.com', role: 'student', total_simulations: 3, completed_simulations: 2, total_evaluations: 2, best_score: 85, avg_score: 80, last_activity: '2025-07-01' },
        { id: 's2', name: 'Bob', email: 'b@test.com', role: 'student', total_simulations: 1, completed_simulations: 0, total_evaluations: 0, best_score: null, avg_score: null, last_activity: null },
      ],
    }),
  },
}));

import LegajosPage from '@/views/LegajosPage';

describe('LegajosPage — layout and filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders students in a table (not grid layout)', async () => {
    render(<LegajosPage />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    // Should use a table element
    const table = screen.getByRole('table');
    expect(table).toBeInTheDocument();

    // Grid layout classes should NOT be present on the main container
    const gridContainer = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-3');
    expect(gridContainer).toBeNull();
  });

  it('renders course and teacher filter Selects', async () => {
    render(<LegajosPage />);

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    // Should have at least 2 selects (sort + course filter or teacher filter)
    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThanOrEqual(2);
  });
});
