import { describe, expect, it } from 'vitest';

import { Rfc6238TotpProvider, generateTotp } from '../../src/infrastructure/security/totp.js';

const RFC_6238_SHA1_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

describe('RFC 6238 TOTP', () => {
  it('matches the RFC 6238 SHA-1 test vector at 59 seconds', () => {
    expect(generateTotp(RFC_6238_SHA1_SECRET, 1, 8)).toBe('94287082');
  });

  it('accepts the current step and configured adjacent window only', () => {
    const provider = new Rfc6238TotpProvider({ digits: 6, periodSeconds: 30, window: 1 });
    const at = new Date(59_000);
    const current = generateTotp(RFC_6238_SHA1_SECRET, 1, 6);
    const adjacent = generateTotp(RFC_6238_SHA1_SECRET, 2, 6);
    const outsideWindow = generateTotp(RFC_6238_SHA1_SECRET, 3, 6);

    expect(provider.verify(RFC_6238_SHA1_SECRET, current, at)).toBe(true);
    expect(provider.verify(RFC_6238_SHA1_SECRET, adjacent, at)).toBe(true);
    expect(provider.verify(RFC_6238_SHA1_SECRET, outsideWindow, at)).toBe(false);
  });

  it('rejects malformed tokens', () => {
    const provider = new Rfc6238TotpProvider();
    expect(provider.verify(RFC_6238_SHA1_SECRET, 'abcdef')).toBe(false);
    expect(provider.verify(RFC_6238_SHA1_SECRET, '12345')).toBe(false);
  });
});
