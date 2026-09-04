import { FastifyPluginAsync } from 'fastify';

const getPoolSnapshot = (pool?: { totalCount?: number; idleCount?: number; waitingCount?: number }) => ({
  total: pool?.totalCount ?? 0,
  idle: pool?.idleCount ?? 0,
  waiting: pool?.waitingCount ?? 0,
});

const getHealthReport = async (fastify: Parameters<FastifyPluginAsync>[0]) => {
  const startedAt = Date.now();
  const pool = fastify.dbPool;

  if (!pool) {
    return {
      status: 'degraded',
      database: {
        connected: false,
        latencyMs: 0,
        error: 'Database pool is not configured.',
        pool: getPoolSnapshot(),
      },
      uptime: Math.floor(process.uptime()),
      memory: process.memoryUsage(),
    };
  }

  try {
    const result = await pool.query('SELECT 1 AS ok');
    const latencyMs = Date.now() - startedAt;
    const connected = result.rows.length === 1 && result.rows[0]?.ok === 1;

    return {
      status: connected ? 'ok' : 'degraded',
      database: {
        connected,
        latencyMs,
        pool: getPoolSnapshot(pool),
      },
      uptime: Math.floor(process.uptime()),
      memory: process.memoryUsage(),
    };
  } catch (error) {
    return {
      status: 'degraded',
      database: {
        connected: false,
        latencyMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : 'Unknown database error',
        pool: getPoolSnapshot(pool),
      },
      uptime: Math.floor(process.uptime()),
      memory: process.memoryUsage(),
    };
  }
};

const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async (_request, reply) => {
    const report = await getHealthReport(fastify);
    reply.code(report.database.connected ? 200 : 503);

    return {
      status: report.status,
      service: 'new-erp-final',
      timestamp: new Date().toISOString(),
      uptime: report.uptime,
      memory: {
        rss: report.memory.rss,
        heapUsed: report.memory.heapUsed,
        heapTotal: report.memory.heapTotal,
        external: report.memory.external,
      },
      database: report.database,
    };
  });

  fastify.get('/health/live', async () => ({
    status: 'alive',
    service: 'new-erp-final',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  }));

  fastify.get('/health/ready', async (_request, reply) => {
    const report = await getHealthReport(fastify);
    reply.code(report.database.connected ? 200 : 503);

    return {
      status: report.database.connected ? 'ready' : 'not-ready',
      service: 'new-erp-final',
      timestamp: new Date().toISOString(),
      uptime: report.uptime,
      database: report.database,
    };
  });

  fastify.get('/ready', async (_request, reply) => {
    const report = await getHealthReport(fastify);
    reply.code(report.database.connected ? 200 : 503);

    return {
      status: report.database.connected ? 'ready' : 'not-ready',
      service: 'new-erp-final',
      timestamp: new Date().toISOString(),
      uptime: report.uptime,
      database: report.database,
    };
  });
};

export default healthRoutes;
