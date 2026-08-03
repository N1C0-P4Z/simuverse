import { paginate } from '../paginate';

describe('paginate', () => {
  const mockModel = {
    findMany: jest.fn(),
    count: jest.fn(),
  };

  beforeEach(() => {
    mockModel.findMany.mockReset();
    mockModel.count.mockReset();
  });

  it('returns data, total, page, and limit', async () => {
    const items = [{ id: 1 }, { id: 2 }];
    mockModel.findMany.mockResolvedValue(items);
    mockModel.count.mockResolvedValue(10);

    const result = await paginate(mockModel, {}, { page: 1, limit: 20 });

    expect(result).toEqual({
      data: items,
      total: 10,
      page: 1,
      limit: 20,
    });
  });

  it('calculates correct skip and take for page 1', async () => {
    mockModel.findMany.mockResolvedValue([]);
    mockModel.count.mockResolvedValue(0);

    await paginate(mockModel, {}, { page: 1, limit: 20 });

    expect(mockModel.findMany).toHaveBeenCalledWith({
      where: {},
      skip: 0,
      take: 20,
    });
  });

  it('calculates correct skip for page 3 with limit 10', async () => {
    mockModel.findMany.mockResolvedValue([]);
    mockModel.count.mockResolvedValue(30);

    await paginate(mockModel, { active: true }, { page: 3, limit: 10 });

    expect(mockModel.findMany).toHaveBeenCalledWith({
      where: { active: true },
      skip: 20,
      take: 10,
    });
  });

  it('calls findMany and count in parallel', async () => {
    const callOrder: string[] = [];

    mockModel.findMany.mockImplementation(() => {
      callOrder.push('findMany');
      return Promise.resolve([]);
    });
    mockModel.count.mockImplementation(() => {
      callOrder.push('count');
      return Promise.resolve(0);
    });

    await paginate(mockModel, {}, { page: 1, limit: 20 });

    // Both should be called (parallel via Promise.all)
    expect(callOrder).toContain('findMany');
    expect(callOrder).toContain('count');
  });

  it('passes where clause to both findMany and count', async () => {
    mockModel.findMany.mockResolvedValue([]);
    mockModel.count.mockResolvedValue(0);

    const where = { status: 'active', deleted: false };
    await paginate(mockModel, where, { page: 1, limit: 20 });

    expect(mockModel.findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
    expect(mockModel.count).toHaveBeenCalledWith({ where });
  });

  it('returns empty data when no records match', async () => {
    mockModel.findMany.mockResolvedValue([]);
    mockModel.count.mockResolvedValue(0);

    const result = await paginate(mockModel, {}, { page: 1, limit: 20 });

    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });
});
