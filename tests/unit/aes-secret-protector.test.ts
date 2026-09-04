import { describe, expect, it } from 'vitest';

import { AesGcmSecretProtector } from '../../src/infrastructure/security/aes-secret-protector.js';

describe('AesGcmSecretProtector', () => {
  it('encrypts and decrypts MFA secrets without exposing plaintext in ciphertext', () => {
    const protector = new AesGcmSecretProtector('a'.repeat(32));
    const encrypted = protector.encrypt('JBSWY3DPEHPK3PXP');

    expect(encrypted).toMatch(/^v1\.[^.]+\.[^.]+\.[^.]+$/);
    expect(encrypted).not.toContain('JBSWY3DPEHPK3PXP');
    expect(protector.decrypt(encrypted)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('fails closed for invalid key material and wrong keys', () => {
    expect(() => new AesGcmSecretProtector('short')).toThrow(/at least 32 characters/);

    const encrypted = new AesGcmSecretProtector('a'.repeat(32)).encrypt('secret');
    expect(() => new AesGcmSecretProtector('b'.repeat(32)).decrypt(encrypted)).toThrow();
    expect(() => new AesGcmSecretProtector('a'.repeat(32)).decrypt('v2.invalid.value.secret')).toThrow(
      /Invalid encrypted MFA secret format/,
    );
  });
});
