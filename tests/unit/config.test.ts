import { describe, expect, it } from 'vitest';

import { isCorsOriginAllowed, parseAppConfig, resolveDatabaseUrl } from '../../src/config/schema.js';

describe('parseAppConfig', () => {
  it('loads valid development defaults', () => {
    const config = parseAppConfig({
      NODE_ENV: 'development',
      APP_NAME: 'new-erp-final',
      HOST: '0.0.0.0',
      PORT: '3000',
      DATABASE_URL: 'postgresql://postgres:password@localhost:5432/newerp',
      JWT_SECRET: 'development-jwt-secret-change-me',
    });

    expect(config.PORT).toBe(3000);
    expect(config.NODE_ENV).toBe('development');
    expect(config.isDevelopment).toBe(true);
    expect(config.API_PREFIX).toBe('/api/v1');
  });

  it('requires DATABASE_URL from the configured local environment', () => {
    expect(() =>
      parseAppConfig({
        NODE_ENV: 'development',
        APP_NAME: 'new-erp-final',
        HOST: '0.0.0.0',
        PORT: '3000',
        JWT_SECRET: 'development-jwt-secret-change-me',
      }),
    ).toThrow('DATABASE_URL is not configured. Set DATABASE_URL in .env.local.');
  });

  it('requires TEST_DATABASE_URL for integration tests and never falls back to another database', () => {
    expect(() => resolveDatabaseUrl({ NODE_ENV: 'test' }, { forTest: true })).toThrow(
      'TEST_DATABASE_URL is not configured. Set TEST_DATABASE_URL in .env.local.',
    );
  });

  it('allows ephemeral localhost origins in development', () => {
    const config = parseAppConfig({
      NODE_ENV: 'development',
      APP_NAME: 'new-erp-final',
      HOST: '0.0.0.0',
      PORT: '3000',
      DATABASE_URL: 'postgresql://postgres:password@localhost:5432/newerp',
      JWT_SECRET: 'development-jwt-secret-change-me',
    });

    expect(isCorsOriginAllowed(config, 'http://localhost:50990')).toBe(true);
    expect(isCorsOriginAllowed(config, 'http://127.0.0.1:49152')).toBe(true);
    expect(isCorsOriginAllowed(config, 'https://localhost:50990')).toBe(false);
    expect(isCorsOriginAllowed(config, 'https://evil.example')).toBe(false);
  });

  it('keeps production origins restricted to the explicit allowlist', () => {
    const config = parseAppConfig({
      NODE_ENV: 'production',
      APP_NAME: 'new-erp-final',
      HOST: '0.0.0.0',
      PORT: '3000',
      DATABASE_URL: 'postgresql://postgres:password@localhost:5432/newerp',
      JWT_SECRET: 'a'.repeat(32),
      CORS_ALLOWED_ORIGINS: 'https://erp.example.com,https://admin.example.com',
    });

    expect(isCorsOriginAllowed(config, 'https://erp.example.com')).toBe(true);
    expect(isCorsOriginAllowed(config, 'http://localhost:50990')).toBe(false);
    expect(isCorsOriginAllowed(config, 'https://evil.example')).toBe(false);
  });

  it('rejects production configuration when JWT secret is not configured', () => {
    expect(() =>
      parseAppConfig({
        NODE_ENV: 'production',
        APP_NAME: 'new-erp-final',
        HOST: '0.0.0.0',
        PORT: '3000',
        DATABASE_URL: 'postgresql://postgres:password@localhost:5432/newerp',
        JWT_SECRET: 'development-jwt-secret-change-me',
      }),
    ).toThrow('JWT_SECRET must be configured for production deployments.');
  });
});
