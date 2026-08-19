import { describe, expect, it } from 'vitest';
import { v7 } from 'uuid';

import { parseAppConfig } from '../../src/config/schema.js';

describe('parseAppConfig', () => {
  it('loads valid development defaults', () => {
    const config = parseAppConfig({
      NODE_ENV: 'development',
      APP_NAME: 'new-erp-final',
      HOST: '0.0.0.0',
      PORT: '3000',
      JWT_SECRET: 'development-jwt-secret-change-me',
    });

    expect(config.PORT).toBe(3000);
    expect(config.NODE_ENV).toBe('development');
    expect(config.isDevelopment).toBe(true);
    expect(config.API_PREFIX).toBe('/api/v1');
  });

  it('rejects production configuration when JWT secret is not configured', () => {
    expect(() =>
      parseAppConfig({
        NODE_ENV: 'production',
        APP_NAME: 'new-erp-final',
        HOST: '0.0.0.0',
        PORT: '3000',
        JWT_SECRET: 'development-jwt-secret-change-me',
      }),
    ).toThrow('JWT_SECRET must be configured for production deployments.');
  });
});
