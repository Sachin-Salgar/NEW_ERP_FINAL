import { describe, expect, it, vi } from 'vitest';

import { PostgresQueryPerformanceMonitor } from '../../src/infrastructure/database/query-performance-monitor.js';

describe('PostgresQueryPerformanceMonitor', () => {
  it('fails closed when pg_stat_statements is not installed', async () => {
    const pool = {
      query: vi.fn(async () => ({ rows: [{ installed: false }] })),
    };
    const monitor = new PostgresQueryPerformanceMonitor(pool as never);

    const snapshot = await monitor.snapshot();

    expect(snapshot.available).toBe(false);
    expect(snapshot.unavailableReason).toBe('extension-not-installed');
    expect(snapshot.samples).toEqual([]);
  });

  it('returns aggregate metrics without selecting query text', async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ installed: true }] })
      .mockResolvedValueOnce({
        rows: [
          {
            queryid: '1234',
            calls: '10',
            total_exec_time: '2500.5',
            mean_exec_time: '250.05',
            rows: '30',
          },
        ],
      });
    const monitor = new PostgresQueryPerformanceMonitor({ query } as never);

    const snapshot = await monitor.snapshot({ minimumMeanExecMs: 200, limit: 10 });

    expect(snapshot.available).toBe(true);
    expect(snapshot.samples).toEqual([
      {
        queryId: '1234',
        calls: 10,
        totalExecMs: 2500.5,
        meanExecMs: 250.05,
        rows: 30,
      },
    ]);
    const aggregateSql = String(query.mock.calls[1]?.[0] ?? '');
    expect(aggregateSql.toLowerCase()).not.toContain('select query,');
    expect(aggregateSql.toLowerCase()).not.toContain('querytext');
  });

  it('reports insufficient permission without throwing', async () => {
    const error = Object.assign(new Error('permission denied'), { code: '42501' });
    const pool = { query: vi.fn(async () => Promise.reject(error)) };
    const monitor = new PostgresQueryPerformanceMonitor(pool as never);

    const snapshot = await monitor.snapshot();

    expect(snapshot.available).toBe(false);
    expect(snapshot.unavailableReason).toBe('insufficient-permission');
  });
});
