import type { Pool } from 'pg';

export interface QueryPerformanceSample {
  queryId: string;
  calls: number;
  totalExecMs: number;
  meanExecMs: number;
  rows: number;
}

export type QueryPerformanceUnavailableReason =
  | 'extension-not-installed'
  | 'insufficient-permission'
  | 'database-error';

export interface QueryPerformanceSnapshot {
  available: boolean;
  collectedAt: Date;
  samples: QueryPerformanceSample[];
  unavailableReason?: QueryPerformanceUnavailableReason;
}

interface AvailabilityResult {
  available: boolean;
  reason?: QueryPerformanceUnavailableReason;
}

/**
 * Reads aggregate pg_stat_statements metrics without exposing SQL text or raw
 * parameter values. Managed PostgreSQL deployments that do not expose the
 * extension fail closed to `available: false` rather than weakening database
 * permissions or requiring a privileged application role.
 */
export class PostgresQueryPerformanceMonitor {
  constructor(private readonly pool: Pool) {}

  async snapshot(options: { minimumMeanExecMs?: number; limit?: number } = {}): Promise<QueryPerformanceSnapshot> {
    const availability = await this.getAvailability();
    if (!availability.available) {
      return {
        available: false,
        unavailableReason: availability.reason,
        collectedAt: new Date(),
        samples: [],
      };
    }

    const minimumMeanExecMs = Math.max(0, options.minimumMeanExecMs ?? 100);
    const limit = Math.max(1, Math.min(options.limit ?? 50, 200));

    try {
      const result = await this.pool.query<{
        queryid: string | number;
        calls: string | number;
        total_exec_time: string | number;
        mean_exec_time: string | number;
        rows: string | number;
      }>(
        `SELECT queryid, calls, total_exec_time, mean_exec_time, rows
         FROM pg_stat_statements
         WHERE mean_exec_time >= $1
         ORDER BY total_exec_time DESC
         LIMIT $2`,
        [minimumMeanExecMs, limit],
      );

      return {
        available: true,
        collectedAt: new Date(),
        samples: result.rows.map((row) => ({
          queryId: String(row.queryid),
          calls: Number(row.calls),
          totalExecMs: Number(row.total_exec_time),
          meanExecMs: Number(row.mean_exec_time),
          rows: Number(row.rows),
        })),
      };
    } catch (error) {
      return {
        available: false,
        unavailableReason: this.classifyDatabaseError(error),
        collectedAt: new Date(),
        samples: [],
      };
    }
  }

  private async getAvailability(): Promise<AvailabilityResult> {
    try {
      const result = await this.pool.query<{ installed: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
         ) AS installed`,
      );
      const installed = result.rows[0]?.installed ?? false;
      return installed ? { available: true } : { available: false, reason: 'extension-not-installed' };
    } catch (error) {
      return { available: false, reason: this.classifyDatabaseError(error) };
    }
  }

  private classifyDatabaseError(error: unknown): QueryPerformanceUnavailableReason {
    const code = (error as { code?: unknown } | null)?.code;
    if (code === '42501') return 'insufficient-permission';
    return 'database-error';
  }
}
