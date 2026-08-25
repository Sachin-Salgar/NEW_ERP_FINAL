import pino from 'pino';

import type { AppConfig } from '../../config/schema.js';

export function createLogger(config: AppConfig) {
  return {
    level: config.LOG_LEVEL,
    base: {
      service: config.APP_NAME,
      env: config.NODE_ENV,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    transport:
      config.NODE_ENV === 'production'
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            },
          },
    redact: ['JWT_SECRET', 'DATABASE_URL'],
  };
}
