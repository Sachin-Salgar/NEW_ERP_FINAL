import type { Pool } from 'pg';

export interface PartitionAssessment {
  tableName: string;
  estimatedRows: number;
  totalBytes: number;
  tableBytes: number;
  indexBytes: number;
  recommendation: 'not-indicated' | 'review-candidate';
  reasons: string[];
}

/**
 * Evidence collection for ADR-0023. This class never changes table layout.
 * Partitioning remains a separately reviewed migration after workload evidence
 * proves a benefit and RLS/constraint compatibility is assessed.
 */
export class PostgresPartitionAssessment {
  constructor(private readonly pool: Pool) {}

  async assess(
    tableNames: readonly string[],
    options: { rowThreshold?: number; totalBytesThreshold?: number } = {},
  ): Promise<PartitionAssessment[]> {
    const rowThreshold = Math.max(1, options.rowThreshold ?? 10_000_000);
    const totalBytesThreshold = Math.max(1, options.totalBytesThreshold ?? 10 * 1024 * 1024 * 1024);
    const results: PartitionAssessment[] = [];

    for (const tableName of tableNames) {
      if (!/^[a-z_][a-z0-9_]*$/i.test(tableName)) {
        throw new Error(`Unsafe PostgreSQL table identifier: ${tableName}`);
      }
      const result = await this.pool.query<{
        estimated_rows: string | number;
        total_bytes: string | number;
        table_bytes: string | number;
        index_bytes: string | number;
      }>(
        `SELECT
           c.reltuples::bigint AS estimated_rows,
           pg_total_relation_size(c.oid) AS total_bytes,
           pg_relation_size(c.oid) AS table_bytes,
           pg_indexes_size(c.oid) AS index_bytes
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = $1 AND c.relkind = 'r'
         LIMIT 1`,
        [tableName],
      );
      const row = result.rows[0];
      if (!row) continue;

      const estimatedRows = Math.max(0, Number(row.estimated_rows));
      const totalBytes = Math.max(0, Number(row.total_bytes));
      const reasons: string[] = [];
      if (estimatedRows >= rowThreshold) reasons.push(`estimated row count >= ${rowThreshold}`);
      if (totalBytes >= totalBytesThreshold) reasons.push(`total relation bytes >= ${totalBytesThreshold}`);

      results.push({
        tableName,
        estimatedRows,
        totalBytes,
        tableBytes: Math.max(0, Number(row.table_bytes)),
        indexBytes: Math.max(0, Number(row.index_bytes)),
        recommendation: reasons.length > 0 ? 'review-candidate' : 'not-indicated',
        reasons,
      });
    }

    return results;
  }
}
