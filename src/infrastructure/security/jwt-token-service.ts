import { createHash } from 'crypto';
import jwt, { type JwtPayload } from 'jsonwebtoken';

import type { AppConfig } from '../../config/schema.js';
import type { AccessTokenClaims, RefreshTokenClaims } from '../../domain/contracts/authentication.js';
import { UnauthorizedError } from '../../domain/errors.js';
import type { TokenService } from '../../application/contracts/security.js';

export class JwtTokenService implements TokenService {
  constructor(private readonly config: Pick<AppConfig, 'JWT_SECRET' | 'JWT_ISSUER'>) {}

  createAccessToken(input: { userId: string; tenantId: string; sessionId: string; expiresInSeconds?: number }): string {
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

  createRefreshToken(input: { userId: string; tenantId: string; sessionId: string; expiresInSeconds?: number }): string {
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
    return this.verifyToken(token, 'access');
  }

  verifyRefreshToken(token: string): RefreshTokenClaims {
    return this.verifyToken(token, 'refresh');
  }

  hashTokenValue(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private verifyToken<T extends AccessTokenClaims | RefreshTokenClaims>(token: string, expectedType: 'access' | 'refresh'): T {
    let decoded: string | JwtPayload | null;

    try {
      decoded = jwt.verify(token, this.config.JWT_SECRET, {
        issuer: this.config.JWT_ISSUER,
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedError('Invalid or expired authentication token.');
    }

    if (typeof decoded === 'string' || !decoded || !decoded.sub || !decoded.tenantId || !decoded.sessionId) {
      throw new UnauthorizedError('Malformed authentication token.');
    }

    const tokenType = decoded.tokenType;
    if (tokenType !== expectedType) {
      throw new UnauthorizedError('Unexpected token type.');
    }

    const claims = {
      sub: String(decoded.sub),
      tenantId: String(decoded.tenantId),
      sessionId: String(decoded.sessionId),
      tokenType: decoded.tokenType as 'access' | 'refresh',
      iss: String(decoded.iss ?? ''),
      iat: Number(decoded.iat ?? 0),
      exp: Number(decoded.exp ?? 0),
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
