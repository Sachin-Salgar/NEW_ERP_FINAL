import { ValidationError } from '../../domain/errors.js';

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

export function paginate<T>(
  items: T[],
  query: PaginationQuery,
  options: {
    searchable?: Array<(item: T) => unknown>;
    sortable?: Record<string, (item: T) => unknown>;
  } = {},
): { data: T[]; metadata: PaginationMeta } {
  let filtered = items;

  if (query.search && options.searchable?.length) {
    const needle = query.search.toLowerCase();
    filtered = filtered.filter((item) =>
      options.searchable!.some((getValue) =>
        String(getValue(item) ?? '')
          .toLowerCase()
          .includes(needle),
      ),
    );
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

export function paginateListResponse(
  routePath: string,
  payload: Record<string, unknown>,
  queryValue: unknown,
): Record<string, unknown> {
  const queryObject =
    queryValue && typeof queryValue === 'object' && !Array.isArray(queryValue)
      ? (queryValue as Record<string, unknown>)
      : {};

  const hasPaginationParameter = ['page', 'page_size', 'sort', 'order', 'search'].some(
    (key) => queryObject[key] !== undefined,
  );
  if (!hasPaginationParameter) return payload;

  const config = getListConfig(routePath);
  if (!config) return payload;

  const items = payload[config.key];
  if (!Array.isArray(items)) return payload;

  const result = paginate(items, parsePaginationQuery(queryValue), {
    searchable: config.searchable,
    sortable: config.sortable,
  });

  return {
    ...payload,
    [config.key]: result.data,
    metadata: result.metadata,
  };
}

function getListConfig(routePath: string):
  | {
      key: string;
      searchable: Array<(item: any) => unknown>;
      sortable: Record<string, (item: any) => unknown>;
    }
  | undefined {
  const normalized = routePath.split('?')[0].replace(/\/$/, '');
  if (/\/rbac\/roles$/.test(normalized)) {
    return {
      key: 'roles',
      searchable: [(item) => item.code, (item) => item.name, (item) => item.description],
      sortable: {
        code: (item) => item.code,
        name: (item) => item.name,
        sortOrder: (item) => item.sortOrder,
        createdAt: (item) => item.createdAt,
      },
    };
  }
  if (/\/rbac\/permissions$/.test(normalized)) {
    return {
      key: 'permissions',
      searchable: [
        (item) => item.permissionKey,
        (item) => item.displayName,
        (item) => item.moduleCode,
        (item) => item.resource,
        (item) => item.action,
      ],
      sortable: {
        permissionKey: (item) => item.permissionKey,
        displayName: (item) => item.displayName,
        moduleCode: (item) => item.moduleCode,
        resource: (item) => item.resource,
        action: (item) => item.action,
      },
    };
  }
  if (/\/organizations$/.test(normalized)) {
    return {
      key: 'organizations',
      searchable: [(item) => item.code, (item) => item.name, (item) => item.legalName],
      sortable: {
        code: (item) => item.code,
        name: (item) => item.name,
        status: (item) => item.status,
        createdAt: (item) => item.createdAt,
      },
    };
  }
  if (/\/organizations\/[^/]+\/branches$|\/branches$/.test(normalized)) {
    return {
      key: 'branches',
      searchable: [(item) => item.code, (item) => item.name, (item) => item.city, (item) => item.state],
      sortable: {
        code: (item) => item.code,
        name: (item) => item.name,
        city: (item) => item.city,
        createdAt: (item) => item.createdAt,
      },
    };
  }
  if (/\/locations$/.test(normalized)) {
    return {
      key: 'locations',
      searchable: [(item) => item.code, (item) => item.name, (item) => item.city, (item) => item.state],
      sortable: {
        code: (item) => item.code,
        name: (item) => item.name,
        city: (item) => item.city,
        createdAt: (item) => item.createdAt,
      },
    };
  }
  if (/\/users$/.test(normalized)) {
    return {
      key: 'users',
      searchable: [(item) => item.username, (item) => item.email, (item) => item.status],
      sortable: {
        username: (item) => item.username,
        email: (item) => item.email,
        status: (item) => item.status,
        createdAt: (item) => item.createdAt,
      },
    };
  }
  if (/\/auth\/modules$/.test(normalized)) {
    return {
      key: 'modules',
      searchable: [(item) => item.code, (item) => item.name, (item) => item.moduleGroup],
      sortable: { code: (item) => item.code, name: (item) => item.name, sortOrder: (item) => item.sortOrder },
    };
  }
  return undefined;
}

function compareValues(left: unknown, right: unknown, order: 'asc' | 'desc'): number {
  const a = String(left ?? '').toLowerCase();
  const b = String(right ?? '').toLowerCase();
  const result = a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  return order === 'asc' ? result : -result;
}
