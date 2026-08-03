import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock dependencies before import
vi.mock('@/lib/admin-context', () => ({ useAdmin: () => ({ readOnly: false }) }));
vi.mock('@/services/ApiClient', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({
      data: [{ id: 1, name: 'RRHH', code: 'RRHH', description: '', created_at: '2025-01-01', is_active: true }],
    }),
    delete: vi.fn().mockResolvedValue({}),
  },
}));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

import { CategoriesABM } from '@/components/CategoriesABM';
import { apiClient } from '@/services/ApiClient';

describe('CategoriesABM — delete confirmation via AlertDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows AlertDialog when delete is clicked (not immediate sonner action)', async () => {
    render(<CategoriesABM />);

    // Wait for categories to load
    await waitFor(() => {
      expect(screen.getByText('RRHH')).toBeInTheDocument();
    });

    // Find the delete button (text-red-600 class, Trash2 icon)
    const deleteButtons = screen.getAllByRole('button');
    const trashBtn = deleteButtons.find(btn =>
      btn.className.includes('text-red-600'),
    );
    expect(trashBtn).toBeDefined();

    fireEvent.click(trashBtn!);

    // An AlertDialog should open — it renders a "Confirmar" or similar button
    // The current sonner approach does NOT open a dialog, so this should fail in RED
    await waitFor(() => {
      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toBeInTheDocument();
    });
  });

  it('does NOT call apiClient.delete until user confirms in AlertDialog', async () => {
    render(<CategoriesABM />);

    await waitFor(() => {
      expect(screen.getByText('RRHH')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole('button');
    const trashBtn = deleteButtons.find(btn =>
      btn.className.includes('text-red-600'),
    );
    fireEvent.click(trashBtn!);

    // Wait for dialog
    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    });

    // API should not be called yet
    expect(apiClient.delete).not.toHaveBeenCalled();

    // Click confirm — find by text content
    const confirmBtn = screen.getByText('Confirmar');
    fireEvent.click(confirmBtn);

    // NOW the API should be called
    await waitFor(() => {
      expect(apiClient.delete).toHaveBeenCalledWith('/categories/1');
    });
  });
});
