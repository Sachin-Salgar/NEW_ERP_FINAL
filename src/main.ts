import { loadConfig } from './config/index.js';
import { resolvePlatformDatabaseUrl } from './config/schema.js';
import {
  createDatabasePool,
  createDatabasePoolFromUrl,
  closeDatabasePool,
  pingDatabase,
} from './infrastructure/database/connection.js';
import { createApplication } from './presentation/http/app.js';
import { verifyPlatformSecurity } from './infrastructure/database/platform-security.js';

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const platformDatabaseUrl = resolvePlatformDatabaseUrl(process.env, { required: config.isProduction }) ?? config.DATABASE_URL;
  const pool = createDatabasePool(config);
  const platformPool = createDatabasePoolFromUrl(platformDatabaseUrl, {
    min: config.DATABASE_POOL_MIN,
    max: config.DATABASE_POOL_MAX,
    applicationName: `${config.APP_NAME}-platform-executor`,
    sslMode: config.DATABASE_SSL_MODE,
  });

  try {
    await pingDatabase(pool);
    await pingDatabase(platformPool);
    await verifyPlatformSecurity(platformPool, { requireErp: config.isProduction });
  } catch (error) {
    await platformPool.end().catch(() => undefined);
    const configuredDbName = new URL(config.DATABASE_URL).pathname.replace(/^\//, '') || '<unknown>';
    const configuredUser = new URL(config.DATABASE_URL).username || '<unknown>';

    throw new Error(
      `Unable to connect to the configured PostgreSQL database. Configured database: ${configuredDbName}. Configured user: ${configuredUser}. No alternate database or PostgreSQL user will be created automatically. Check .env.local and the existing PostgreSQL installation.`,
      { cause: error },
    );
  }

  const app = await createApplication(config);
  app.decorate('platformDbPool', platformPool);

  const shutdown = async () => {
    await app.close();
    await closeDatabasePool(pool);
    await closeDatabasePool(platformPool);
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
