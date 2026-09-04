import { describe, expect, it } from 'vitest';

import { paginate, parsePaginationQuery } from '../../src/presentation/http/pagination.js';

describe('API pagination', () => {
  it('uses the documented page/page_size contract', () => {
    expect(parsePaginationQuery({ page: '2', page_size: '2', order: 'desc' })).toEqual({
      page: 2,
      pageSize: 2,
      order: 'desc',
      sort: undefined,
      search: undefined,
    });
  });

  it('filters, sorts and returns pagination metadata', () => {
    const result = paginate([
      { code: 'B', name: 'Beta' },
      { code: 'A', name: 'Alpha' },
      { code: 'C', name: 'Gamma' },
    ], parsePaginationQuery({ page: 1, page_size: 2, sort: 'name', order: 'asc', search: 'a' }), {
      searchable: [item => item.code, item => item.name],
      sortable: { name: item => item.name },
    });

    expect(result.data.map(item => item.name)).toEqual(['Alpha', 'Beta']);
    expect(result.metadata).toEqual({
      page: 1,
      page_size: 2,
      total: 3,
      total_pages: 2,
      sort: 'name',
      order: 'asc',
      search: 'a',
    });
  });

  it('rejects invalid page_size and unsupported sort fields', () => {
    expect(() => parsePaginationQuery({ page_size: 101 })).toThrow('page_size must be between 1 and 100');
    expect(() => paginate([{ name: 'Alpha' }], parsePaginationQuery({ sort: 'id' }), {
      sortable: { name: item => item.name },
    })).toThrow('Unsupported sort field: id');
  });
});
