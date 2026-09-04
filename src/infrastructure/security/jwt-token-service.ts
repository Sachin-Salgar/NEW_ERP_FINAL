import { createHash } from 'crypto';
import jwt, { decode, type JwtPayload } from 'jsonwebtoken';

import type { AppConfig } from '../../config/schema.js';
import type { AccessTokenClaims, RefreshTokenClaims } from '../../domain/contracts/authentication.js';
import { UnauthorizedError } from '../../domain/errors.js';
import type { TokenService } from '../../application/contracts/security.js';
import { RotatingJwtTokenService, type JsonWebKeySet, type RsaJwtSigningKey } from './rotating-jwt-key-ring.js';

type JwtConfig = Pick<AppConfig, 'JWT_SECRET' | 'JWT_ISSUER'> &
  Partial<Pick<AppConfig, 'JWT_SIGNING_ALGORITHM' | 'JWT_RS256_KEYS_JSON' | 'JWT_ACCEPT_LEGACY_HS256'>>;

export class JwtTokenService implements TokenService {
  private readonly asymmetricDelegate: RotatingJwtTokenService | null;

  constructor(private readonly config: JwtConfig) {
    if ((config.JWT_SIGNING_ALGORITHM ?? 'HS256') === 'RS256') {
      const keys = parseRsaKeys(config.JWT_RS256_KEYS_JSON ?? '[]');
      this.asymmetricDelegate = new RotatingJwtTokenService({
        issuer: config.JWT_ISSUER,
        keys,
      });
    } else {
      this.asymmetricDelegate = null;
    }
  }

  createAccessToken(input: { userId: string; tenantId: string; sessionId: string; expiresInSeconds?: number }): string {
    if (this.asymmetricDelegate) return this.asymmetricDelegate.createAccessToken(input);

    const expiresInSeconds = input.expiresInSeconds ?? 60 * 60;
    const payload: Omit<AccessTokenClaims, 'iat' | 'exp'> & { iat?: number; exp?: number } = {
      sub: input.userId,
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      tokenType: 'access',
      iss: this.config.JWT_ISSUER,
    };

    return jwt.sign(payload, this.config.JWT_SECRET, {
      expiresIn: expiresInSeconds,
      algorithm: 'HS256',
    });
  }

  createRefreshToken(input: {
    userId: string;
    tenantId: string;
    sessionId: string;
    expiresInSeconds?: number;
  }): string {
    if (this.asymmetricDelegate) return this.asymmetricDelegate.createRefreshToken(input);

    const expiresInSeconds = input.expiresInSeconds ?? 60 * 60 * 24 * 14;
    const payload: Omit<RefreshTokenClaims, 'iat' | 'exp'> & { iat?: number; exp?: number } = {
      sub: input.userId,
      tenantId: input.tenantId,
      sessionId: input.sessionId,
      tokenType: 'refresh',
      iss: this.config.JWT_ISSUER,
    };

    return jwt.sign(payload, this.config.JWT_SECRET, {
      expiresIn: expiresInSeconds,
      algorithm: 'HS256',
    });
  }

  verifyAccessToken(token: string): AccessTokenClaims {
    if (this.asymmetricDelegate && !this.shouldVerifyLegacyHs256(token)) {
      return this.asymmetricDelegate.verifyAccessToken(token);
    }
    return this.verifyHs256Token(token, 'access');
  }

  verifyRefreshToken(token: string): RefreshTokenClaims {
    if (this.asymmetricDelegate && !this.shouldVerifyLegacyHs256(token)) {
      return this.asymmetricDelegate.verifyRefreshToken(token);
    }
    return this.verifyHs256Token(token, 'refresh');
  }

  hashTokenValue(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  getJwks(): JsonWebKeySet | null {
    return this.asymmetricDelegate?.getJwks() ?? null;
  }

  usesAsymmetricSigning(): boolean {
    return this.asymmetricDelegate !== null;
  }

  private shouldVerifyLegacyHs256(token: string): boolean {
    if (!this.asymmetricDelegate || !this.config.JWT_ACCEPT_LEGACY_HS256) return false;
    const decoded = decode(token, { complete: true });
    return Boolean(decoded && typeof decoded !== 'string' && decoded.header.alg === 'HS256');
  }

  private verifyHs256Token<T extends AccessTokenClaims | RefreshTokenClaims>(
    token: string,
    expectedType: 'access' | 'refresh',
  ): T {
    if (this.asymmetricDelegate && !this.config.JWT_ACCEPT_LEGACY_HS256) {
      throw new UnauthorizedError('Legacy authentication token algorithm is no longer accepted.');
    }

    let decodedPayload: string | JwtPayload | null;

    try {
      decodedPayload = jwt.verify(token, this.config.JWT_SECRET, {
        issuer: this.config.JWT_ISSUER,
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedError('Invalid or expired authentication token.');
    }

    if (
      typeof decodedPayload === 'string' ||
      !decodedPayload ||
      !decodedPayload.sub ||
      !decodedPayload.tenantId ||
      !decodedPayload.sessionId
    ) {
      throw new UnauthorizedError('Malformed authentication token.');
    }

    const tokenType = decodedPayload.tokenType;
    if (tokenType !== expectedType) {
      throw new UnauthorizedError('Unexpected token type.');
    }

    const claims = {
      sub: String(decodedPayload.sub),
      tenantId: String(decodedPayload.tenantId),
      sessionId: String(decodedPayload.sessionId),
      tokenType: decodedPayload.tokenType as 'access' | 'refresh',
      iss: String(decodedPayload.iss ?? ''),
      iat: Number(decodedPayload.iat ?? 0),
      exp: Number(decodedPayload.exp ?? 0),
    };

    if (claims.iss !== this.config.JWT_ISSUER) {
      throw new UnauthorizedError('Token issuer is invalid.');
    }

    if (claims.exp <= Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedError('Authentication token has expired.');
    }

    return claims as T;
  }
}

function parseRsaKeys(serialized: string): RsaJwtSigningKey[] {
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    throw new Error('JWT_RS256_KEYS_JSON is not valid JSON');
  }

  if (!Array.isArray(value)) {
    throw new Error('JWT_RS256_KEYS_JSON must be an array');
  }

  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`JWT RS256 key at index ${index} must be an object`);
    }
    const key = entry as Record<string, unknown>;
    const state = key.state;
    if (state !== 'active' && state !== 'verification-only' && state !== 'retired') {
      throw new Error(`JWT RS256 key at index ${index} has an invalid state`);
    }
    if (typeof key.kid !== 'string' || !key.kid.trim()) {
      throw new Error(`JWT RS256 key at index ${index} requires kid`);
    }
    if (typeof key.publicKeyPem !== 'string' || !key.publicKeyPem.trim()) {
      throw new Error(`JWT RS256 key at index ${index} requires publicKeyPem`);
    }
    if (key.privateKeyPem !== undefined && typeof key.privateKeyPem !== 'string') {
      throw new Error(`JWT RS256 key at index ${index} has invalid privateKeyPem`);
    }

    return {
      kid: key.kid,
      state,
      publicKeyPem: key.publicKeyPem,
      privateKeyPem: typeof key.privateKeyPem === 'string' ? key.privateKeyPem : undefined,
    };
  });
}
