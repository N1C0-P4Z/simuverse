export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export async function paginate<T>(
  model: {
    findMany: (args: any) => Promise<T[]>;
    count: (args: any) => Promise<number>;
  },
  where: Record<string, unknown>,
  options: PaginationOptions,
): Promise<PaginatedResult<T>> {
  const { page, limit } = options;
  const skip = (page - 1) * limit;

  const [data, total] = await Promise.all([
    model.findMany({ where, skip, take: limit }),
    model.count({ where }),
  ]);

  return { data, total, page, limit };
}
