import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();

vi.mock('@/services/ApiClient', () => ({
  apiClient: {
    get: mockGet,
    post: mockPost,
    put: mockPut,
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('lucide-react', () => {
  const icon = (name: string) =>
    Object.assign(
      ({ className }: any) =>
        React.createElement('span', { 'data-testid': `icon-${name}`, className }),
      { displayName: name }
    );
  return { Plus: icon('Plus'), Trash2: icon('Trash2'), Pencil: icon('Pencil') };
});

const MOCK_COURSES = [{ id: 'c1', title: 'Course 1' }];

const MOCK_PRACTICES = [
  {
    id: 'p1',
    course_id: 'c1',
    title: 'Practice Alpha',
    description: 'Desc A',
    difficulty: 'medium',
    sequence_index: 1,
    agent_key: 'practica-1',
    is_active: true,
  },
  {
    id: 'p2',
    course_id: 'c1',
    title: 'Practice Beta',
    description: 'Desc B',
    difficulty: 'low',
    sequence_index: 2,
    agent_key: 'practica-2',
    is_active: true,
  },
];

function mockCoursesAndPractices(practices = MOCK_PRACTICES) {
  mockGet.mockImplementation((url: string) => {
    if (url === '/courses/dropdown/list' || url === '/courses') {
      return Promise.resolve({ data: MOCK_COURSES });
    }
    if (url.startsWith('/practices/course/')) {
      return Promise.resolve({
        data: { data: practices, total: practices.length, page: 1, limit: 20 },
      });
    }
    return Promise.resolve({ data: [] });
  });
}

describe('PracticesABM — edit mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('opens pre-filled edit form when Edit button is clicked', async () => {
    mockCoursesAndPractices();

    const { PracticesABM } = await import('@/components/PracticesABM');
    render(<PracticesABM />);

    await waitFor(() => {
      expect(screen.getByText(/Practice Alpha/)).toBeDefined();
    });

    const pencilIcons = screen.getAllByTestId('icon-Pencil');
    fireEvent.click(pencilIcons[0].closest('button')!);

    await waitFor(() => {
      const titleInput = screen.getByPlaceholderText('Título') as HTMLInputElement;
      expect(titleInput.value).toBe('Practice Alpha');
    });
  });

  it('saves via PUT /practices/:id and updates list on submit', async () => {
    const UPDATED_PRACTICES = [
      { ...MOCK_PRACTICES[0], title: 'Practice Alpha Updated' },
      MOCK_PRACTICES[1],
    ];

    mockCoursesAndPractices();
    mockPut.mockResolvedValueOnce({ data: {} });

    const { PracticesABM } = await import('@/components/PracticesABM');
    render(<PracticesABM />);

    await waitFor(() => {
      expect(screen.getByText(/Practice Alpha/)).toBeDefined();
    });

    // Open edit form
    const pencilIcons = screen.getAllByTestId('icon-Pencil');
    fireEvent.click(pencilIcons[0].closest('button')!);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Título')).toBeDefined();
    });

    // Change title
    const titleInput = screen.getByPlaceholderText('Título') as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'Practice Alpha Updated' } });

    // After PUT, return updated data
    mockPut.mockResolvedValueOnce({ data: {} });
    mockCoursesAndPractices(UPDATED_PRACTICES);

    // Submit
    const saveButton = screen.getByText('Guardar');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/practices/p1', expect.objectContaining({ title: 'Practice Alpha Updated' }));
    });

    await waitFor(() => {
      expect(screen.getByText(/Practice Alpha Updated/)).toBeDefined();
    });
  });

  it('cancel discards changes and closes edit form', async () => {
    mockCoursesAndPractices();

    const { PracticesABM } = await import('@/components/PracticesABM');
    render(<PracticesABM />);

    await waitFor(() => {
      expect(screen.getByText(/Practice Alpha/)).toBeDefined();
    });

    // Open edit form
    const pencilIcons = screen.getAllByTestId('icon-Pencil');
    fireEvent.click(pencilIcons[0].closest('button')!);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Título')).toBeDefined();
    });

    // Change title
    const titleInput = screen.getByPlaceholderText('Título') as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'Changed Title' } });

    // Cancel
    const cancelButton = screen.getByText('Cancelar');
    fireEvent.click(cancelButton);

    // PUT should NOT have been called
    expect(mockPut).not.toHaveBeenCalled();

    // Original card should still show
    expect(screen.getByText('practica-1 — Practice Alpha')).toBeDefined();
  });
});
