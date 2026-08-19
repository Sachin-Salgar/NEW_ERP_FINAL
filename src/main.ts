import { loadConfig } from './config/index.js';
import { createDatabasePool, closeDatabasePool, pingDatabase } from './infrastructure/database/connection.js';
import { createApplication } from './presentation/http/app.js';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const pool = createDatabasePool(config);

  try {
    await pingDatabase(pool);
  } catch (error) {
    console.warn('Database not reachable at startup; continuing until readiness checks fail', error);
  }

  const app = await createApplication(config);

  const shutdown = async () => {
    await app.close();
    await closeDatabasePool(pool);
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown();
  });

  process.on('SIGTERM', () => {
    void shutdown();
  });

  await app.listen({
    host: config.HOST,
    port: config.PORT,
  });

  app.log.info({ url: `http://${config.HOST}:${config.PORT}${config.API_PREFIX}` }, 'API server started');
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to bootstrap application', error);
  process.exitCode = 1;
});
