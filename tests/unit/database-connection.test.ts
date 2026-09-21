import { describe, expect, it } from 'vitest';

import { createDatabaseClientOptions, getDatabaseSslOptions } from '../../src/infrastructure/database/connection.js';

describe('database connection policy', () => {
  it('requires TLS without requiring certificate verification for PostgreSQL require mode', () => {
    expect(getDatabaseSslOptions('require')).toEqual({ rejectUnauthorized: false });
    expect(getDatabaseSslOptions('require', '-----BEGIN CERTIFICATE-----')).toEqual({ rejectUnauthorized: false });
    expect(getDatabaseSslOptions('disable')).toBeUndefined();
  });

  it('applies the selected transport policy to client options', () => {
    expect(createDatabaseClientOptions('postgresql://db.example/app', 'require')).toEqual({
      connectionString: 'postgresql://db.example/app',
      ssl: { rejectUnauthorized: false },
    });
    expect(createDatabaseClientOptions('postgresql://db.internal/app', 'disable')).toEqual({
      connectionString: 'postgresql://db.internal/app',
      ssl: undefined,
    });
    expect(createDatabaseClientOptions('postgresql://db.render/app', 'require', 'render-ca')).toEqual({
      connectionString: 'postgresql://db.render/app',
      ssl: { rejectUnauthorized: false },
    });
  });
});
