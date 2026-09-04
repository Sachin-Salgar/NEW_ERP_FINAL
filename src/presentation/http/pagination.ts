import { ValidationError } from '../../../domain/errors.js';

export interface PaginationQuery {
  page: number;
  pageSize: number;
  sort?: string;
  order: 'asc' | 'desc';
  search?: string;
}

export interface PaginationMeta {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
  sort?: string;
  order: 'asc' | 'desc';
  search?: string;
}

export function parsePaginationQuery(value: unknown): PaginationQuery {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { page: 1, pageSize: 20, order: 'asc' };
  }

  const query = value as Record<string, unknown>;
  const page = parsePositiveInteger(query.page, 'page', 1);
  const pageSize = parsePositiveInteger(query.page_size, 'page_size', 20);
  if (pageSize > 100) {
    throw new ValidationError('page_size must be between 1 and 100.');
  }

  const order = query.order === undefined ? 'asc' : String(query.order).toLowerCase();
  if (order !== 'asc' && order !== 'desc') {
    throw new ValidationError('order must be either asc or desc.');
  }

  const sort = query.sort === undefined ? undefined : String(query.sort).trim();
  const search = query.search === undefined ? undefined : String(query.search).trim() || undefined;

  return { page, pageSize, sort: sort || undefined, order, search };
}

function parsePositiveInteger(value: unknown, field: string, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ValidationError(`${field} must be a positive integer.`);
  }
  return parsed;
}

export function paginate<T>(items: T[], query: PaginationQuery, options: {
  searchable?: Array<(item: T) => unknown>;
  sortable?: Record<string, (item: T) => unknown>;
} = {}): { data: T[]; metadata: PaginationMeta } {
  let filtered = items;

  if (query.search && options.searchable?.length) {
    const needle = query.search.toLowerCase();
    filtered = filtered.filter((item) => options.searchable!.some((getValue) => String(getValue(item) ?? '').toLowerCase().includes(needle)));
  }

  if (query.sort) {
    const getValue = options.sortable?.[query.sort];
    if (!getValue) {
      throw new ValidationError(`Unsupported sort field: ${query.sort}.`);
    }

    filtered = [...filtered].sort((left, right) => compareValues(getValue(left), getValue(right), query.order));
  }

  const total = filtered.length;
  const start = (query.page - 1) * query.pageSize;
  const data = filtered.slice(start, start + query.pageSize);

  return {
    data,
    metadata: {
      page: query.page,
      page_size: query.pageSize,
      total,
      total_pages: Math.ceil(total / query.pageSize),
      ...(query.sort ? { sort: query.sort } : {}),
      order: query.order,
      ...(query.search ? { search: query.search } : {}),
    },
  };
}

function compareValues(left: unknown, right: unknown, order: 'asc' | 'desc'): number {
  const a = String(left ?? '').toLowerCase();
  const b = String(right ?? '').toLowerCase();
  const result = a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  return order === 'asc' ? result : -result;
}
