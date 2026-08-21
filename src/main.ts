import { loadConfig } from './config/index.js';
import { createDatabasePool, closeDatabasePool, pingDatabase } from './infrastructure/database/connection.js';
import { createApplication } from './presentation/http/app.js';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const pool = createDatabasePool(config);

  try {
    await pingDatabase(pool);
  } catch (error) {
    const configuredDbName = new URL(config.DATABASE_URL).pathname.replace(/^\//, '') || '<unknown>';
    const configuredUser = new URL(config.DATABASE_URL).username || '<unknown>';

    throw new Error(
      `Unable to connect to the configured PostgreSQL database. Configured database: ${configuredDbName}. Configured user: ${configuredUser}. No alternate database or PostgreSQL user will be created automatically. Check .env.local and the existing PostgreSQL installation.`,
      { cause: error },
    );
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
