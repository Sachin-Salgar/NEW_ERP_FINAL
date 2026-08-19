import { describe, expect, it } from 'vitest';

import { UuidV7Generator } from '../../src/infrastructure/uuid/uuid-generator.js';

describe('UuidV7Generator', () => {
  it('creates valid UUID v7 identifiers', () => {
    const generator = new UuidV7Generator();
    const id = generator.generate();

    expect(generator.isValid(id)).toBe(true);
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);
  });
});
