import { createHash, createPublicKey } from 'node:crypto';
import jwt, { decode, type JwtPayload } from 'jsonwebtoken';

import type { TokenService } from '../../application/contracts/security.js';
import type { AccessTokenClaims, RefreshTokenClaims } from '../../domain/contracts/authentication.js';
import { UnauthorizedError } from '../../domain/errors.js';

export type JwtSigningKeyState = 'active' | 'verification-only' | 'retired';

export interface RsaJwtSigningKey {
  kid: string;
  state: JwtSigningKeyState;
  publicKeyPem: string;
  privateKeyPem?: string;
}

export interface RotatingJwtKeyRingOptions {
  issuer: string;
  keys: readonly RsaJwtSigningKey[];
}

export interface JsonWebKeySet {
  keys: Array<{
    kty: 'RSA';
    use: 'sig';
    alg: 'RS256';
    kid: string;
    n: string;
    e: string;
  }>;
}

export class RotatingJwtTokenService implements TokenService {
  private readonly activeKey: RsaJwtSigningKey;
  private readonly trustedKeys: Map<string, RsaJwtSigningKey>;

  constructor(private readonly options: RotatingJwtKeyRingOptions) {
    const activeKeys = options.keys.filter((key) => key.state === 'active');
    if (activeKeys.length !== 1) {
      throw new Error('Exactly one JWT signing key must be active');
    }
    if (!activeKeys[0]!.privateKeyPem) {
      throw new Error('The active JWT signing key requires private key material');
    }

    const duplicateKids = options.keys.filter(
      (key, index, keys) => keys.findIndex((candidate) => candidate.kid === key.kid) !== index,
    );
    if (duplicateKids.length > 0) {
      throw new Error('JWT signing key identifiers must be unique');
    }

    this.activeKey = activeKeys[0]!;
    this.trustedKeys = new Map(
      options.keys
        .filter((key) => key.state !== 'retired')
        .map((key) => [key.kid, key]),
    );
  }

  createAccessToken(input: { userId: string; tenantId: string; sessionId: string; expiresInSeconds?: number }): string {
    return this.signToken('access', input);
  }

  createRefreshToken(input: { userId: string; tenantId: string; sessionId: string; expiresInSeconds?: number }): string {
    return this.signToken('refresh', input);
  }

  verifyAccessToken(token: string): AccessTokenClaims {
    return this.verifyToken(token, 'access');
  }

  verifyRefreshToken(token: string): RefreshTokenClaims {
    return this.verifyToken(token, 'refresh');
  }

  hashTokenValue(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  getJwks(): JsonWebKeySet {
    return {
      keys: [...this.trustedKeys.values()].map((key) => {
        const jwk = createPublicKey(key.publicKeyPem).export({ format: 'jwk' });
        if (jwk.kty !== 'RSA' || !jwk.n || !jwk.e) {
          throw new Error(`Configured JWT public key ${key.kid} is not a valid RSA public key`);
        }
        return {
          kty: 'RSA',
          use: 'sig',
          alg: 'RS256',
          kid: key.kid,
          n: jwk.n,
          e: jwk.e,
        };
      }),
    };
  }

  private signToken(
    tokenType: 'access' | 'refresh',
    input: { userId: string; tenantId: string; sessionId: string; expiresInSeconds?: number },
  ): string {
    const expiresInSeconds = input.expiresInSeconds ?? (tokenType === 'access' ? 60 * 60 : 60 * 60 * 24 * 14);
    return jwt.sign(
      {
        sub: input.userId,
        tenantId: input.tenantId,
        sessionId: input.sessionId,
        tokenType,
        iss: this.options.issuer,
      },
      this.activeKey.privateKeyPem!,
      {
        algorithm: 'RS256',
        keyid: this.activeKey.kid,
        expiresIn: expiresInSeconds,
      },
    );
  }

  private verifyToken<T extends AccessTokenClaims | RefreshTokenClaims>(
    token: string,
    expectedType: 'access' | 'refresh',
  ): T {
    const unverified = decode(token, { complete: true });
    if (!unverified || typeof unverified === 'string') {
      throw new UnauthorizedError('Malformed authentication token.');
    }

    const header = unverified.header;
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || header.kid.length === 0) {
      throw new UnauthorizedError('Authentication token signing key is invalid.');
    }

    const key = this.trustedKeys.get(header.kid);
    if (!key) {
      throw new UnauthorizedError('Authentication token signing key is unknown or retired.');
    }

    let decodedPayload: string | JwtPayload;
    try {
      decodedPayload = jwt.verify(token, key.publicKeyPem, {
        algorithms: ['RS256'],
        issuer: this.options.issuer,
      });
    } catch {
      throw new UnauthorizedError('Invalid or expired authentication token.');
    }

    if (
      typeof decodedPayload === 'string' ||
      !decodedPayload.sub ||
      !decodedPayload.tenantId ||
      !decodedPayload.sessionId ||
      decodedPayload.tokenType !== expectedType
    ) {
      throw new UnauthorizedError('Malformed authentication token.');
    }

    return {
      sub: String(decodedPayload.sub),
      tenantId: String(decodedPayload.tenantId),
      sessionId: String(decodedPayload.sessionId),
      tokenType: expectedType,
      iss: String(decodedPayload.iss ?? ''),
      iat: Number(decodedPayload.iat ?? 0),
      exp: Number(decodedPayload.exp ?? 0),
    } as T;
  }
}
