export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  orderBy?: Record<string, string>;
  select?: Record<string, unknown>;
  include?: Record<string, unknown>;
}

export async function paginate<T>(
  model: {
    findMany: (args: any) => Promise<T[]>;
    count: (args: any) => Promise<number>;
  },
  where: Record<string, unknown>,
  options: PaginationOptions,
): Promise<PaginatedResult<T>> {
  const { page, limit, orderBy, select, include } = options;
  const skip = (page - 1) * limit;

  const findArgs: Record<string, unknown> = { where, skip, take: limit };
  if (orderBy) findArgs.orderBy = orderBy;
  if (select) findArgs.select = select;
  if (include) findArgs.include = include;

  const [data, total] = await Promise.all([
    model.findMany(findArgs),
    model.count({ where }),
  ]);

  return { data, total, page, limit };
}
