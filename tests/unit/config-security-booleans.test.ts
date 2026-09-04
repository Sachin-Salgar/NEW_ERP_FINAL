import { describe, expect, it } from 'vitest';

import { appConfigSchema } from '../../src/config/schema.js';

describe('security boolean environment parsing', () => {
  it('parses explicit false strings as false instead of JavaScript truthiness', () => {
    const config = appConfigSchema.parse({
      DATABASE_URL: 'postgresql://user:pass@localhost:5432/test',
      JWT_ACCEPT_LEGACY_HS256: 'false',
      AUTH_PASSWORD_REQUIRE_UPPERCASE: 'false',
      AUTH_PASSWORD_REQUIRE_LOWERCASE: 'false',
      AUTH_PASSWORD_REQUIRE_NUMBER: 'false',
      AUTH_PASSWORD_REQUIRE_SYMBOL: 'false',
    });

    expect(config.JWT_ACCEPT_LEGACY_HS256).toBe(false);
    expect(config.AUTH_PASSWORD_REQUIRE_UPPERCASE).toBe(false);
    expect(config.AUTH_PASSWORD_REQUIRE_LOWERCASE).toBe(false);
    expect(config.AUTH_PASSWORD_REQUIRE_NUMBER).toBe(false);
    expect(config.AUTH_PASSWORD_REQUIRE_SYMBOL).toBe(false);
  });

  it('parses explicit true strings as true and rejects ambiguous values', () => {
    expect(
      appConfigSchema.parse({
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/test',
        JWT_ACCEPT_LEGACY_HS256: 'true',
      }).JWT_ACCEPT_LEGACY_HS256,
    ).toBe(true);

    expect(() =>
      appConfigSchema.parse({
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/test',
        JWT_ACCEPT_LEGACY_HS256: 'yes',
      }),
    ).toThrow();
  });
});
