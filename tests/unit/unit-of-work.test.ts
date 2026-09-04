import { describe, expect, it, vi } from 'vitest';

import { UnitOfWork } from '../../src/infrastructure/database/unit-of-work.js';

function createMockPool() {
  const query = vi.fn();
  const release = vi.fn();
  const client = { query, release };
  const connect = vi.fn(async () => client);
  return { pool: { connect } as never, client, query, release, connect };
}

describe('UnitOfWork', () => {
  it('commits a successful transaction and releases the client', async () => {
    const mock = createMockPool();
    const uow = new UnitOfWork(mock.pool);
    const result = await uow.runInTransaction(async (client) => {
      expect(client).toBe(mock.client);
      return 'done';
    });

    expect(result).toBe('done');
    expect(mock.query).toHaveBeenCalledWith('BEGIN');
    expect(mock.query).toHaveBeenCalledWith('COMMIT');
    expect(mock.query).not.toHaveBeenCalledWith('ROLLBACK');
    expect(mock.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back when the transaction callback fails', async () => {
    const mock = createMockPool();
    const uow = new UnitOfWork(mock.pool);
    const failure = new Error('operation failed');

    await expect(uow.runInTransaction(async () => {
      throw failure;
    })).rejects.toBe(failure);

    expect(mock.query).toHaveBeenCalledWith('BEGIN');
    expect(mock.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mock.query).not.toHaveBeenCalledWith('COMMIT');
    expect(mock.release).toHaveBeenCalledTimes(1);
  });

  it('does not leak a client when BEGIN fails', async () => {
    const mock = createMockPool();
    mock.query.mockRejectedValueOnce(new Error('begin failed'));
    const uow = new UnitOfWork(mock.pool);

    await expect(uow.begin()).rejects.toThrow('begin failed');
    expect(mock.release).toHaveBeenCalledTimes(1);
  });

  it('rejects a second begin on the same unit of work', async () => {
    const mock = createMockPool();
    const uow = new UnitOfWork(mock.pool);

    await uow.begin();
    await expect(uow.begin()).rejects.toThrow('transaction has already begun');
    await uow.rollback();
  });

  it('rejects access to a client after completion', async () => {
    const mock = createMockPool();
    const uow = new UnitOfWork(mock.pool);

    await uow.begin();
    await uow.commit();

    expect(() => uow.getClient()).toThrow('no active transaction');
  });
});
