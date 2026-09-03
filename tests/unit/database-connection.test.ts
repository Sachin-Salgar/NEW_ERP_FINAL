import { describe, expect, it } from 'vitest';

import { createDatabaseClientOptions, getDatabaseSslOptions } from '../../src/infrastructure/database/connection.js';

describe('database connection policy', () => {
  it('validates certificates whenever TLS is required', () => {
    expect(getDatabaseSslOptions('require')).toEqual({ rejectUnauthorized: true });
    expect(getDatabaseSslOptions('disable')).toBeUndefined();
  });

  it('applies the selected transport policy to client options', () => {
    expect(createDatabaseClientOptions('postgresql://db.example/app', 'require')).toEqual({
      connectionString: 'postgresql://db.example/app',
      ssl: { rejectUnauthorized: true },
    });
    expect(createDatabaseClientOptions('postgresql://db.internal/app', 'disable')).toEqual({
      connectionString: 'postgresql://db.internal/app',
      ssl: undefined,
    });
  });
});
