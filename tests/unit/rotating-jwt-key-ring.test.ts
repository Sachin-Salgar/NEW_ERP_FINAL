import { generateKeyPairSync } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { RotatingJwtTokenService } from '../../src/infrastructure/security/rotating-jwt-key-ring.js';

function rsaPair() {
  const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return {
    privateKeyPem: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
  };
}

describe('RotatingJwtTokenService', () => {
  it('signs with the active RS256 key and publishes only public JWKS values', () => {
    const active = rsaPair();
    const service = new RotatingJwtTokenService({
      issuer: 'erp-test',
      keys: [{ kid: 'key-active', state: 'active', ...active }],
    });

    const token = service.createAccessToken({
      userId: '11111111-1111-4111-8111-111111111111',
      tenantId: '22222222-2222-4222-8222-222222222222',
      sessionId: '33333333-3333-4333-8333-333333333333',
      expiresInSeconds: 60,
    });
    const claims = service.verifyAccessToken(token);
    const jwks = service.getJwks();

    expect(claims.tokenType).toBe('access');
    expect(jwks.keys).toHaveLength(1);
    expect(jwks.keys[0]).toMatchObject({ kid: 'key-active', kty: 'RSA', alg: 'RS256', use: 'sig' });
    expect(jwks.keys[0]).not.toHaveProperty('d');
  });

  it('accepts verification-only overlap keys and excludes retired keys', () => {
    const oldKey = rsaPair();
    const newKey = rsaPair();
    const oldSigner = new RotatingJwtTokenService({
      issuer: 'erp-test',
      keys: [{ kid: 'old', state: 'active', ...oldKey }],
    });
    const oldToken = oldSigner.createRefreshToken({
      userId: '11111111-1111-4111-8111-111111111111',
      tenantId: '22222222-2222-4222-8222-222222222222',
      sessionId: '33333333-3333-4333-8333-333333333333',
      expiresInSeconds: 60,
    });

    const rotated = new RotatingJwtTokenService({
      issuer: 'erp-test',
      keys: [
        { kid: 'new', state: 'active', ...newKey },
        { kid: 'old', state: 'verification-only', publicKeyPem: oldKey.publicKeyPem },
      ],
    });

    expect(rotated.verifyRefreshToken(oldToken).tokenType).toBe('refresh');
    expect(rotated.getJwks().keys.map((key) => key.kid)).toEqual(['new', 'old']);

    const retired = new RotatingJwtTokenService({
      issuer: 'erp-test',
      keys: [
        { kid: 'new', state: 'active', ...newKey },
        { kid: 'old', state: 'retired', publicKeyPem: oldKey.publicKeyPem },
      ],
    });
    expect(() => retired.verifyRefreshToken(oldToken)).toThrow('unknown or retired');
    expect(retired.getJwks().keys.map((key) => key.kid)).toEqual(['new']);
  });

  it('requires exactly one active key with private material', () => {
    const pair = rsaPair();
    expect(() => new RotatingJwtTokenService({ issuer: 'erp-test', keys: [] })).toThrow('Exactly one');
    expect(
      () =>
        new RotatingJwtTokenService({
          issuer: 'erp-test',
          keys: [{ kid: 'verify-only', state: 'active', publicKeyPem: pair.publicKeyPem }],
        }),
    ).toThrow('private key');
  });
});
