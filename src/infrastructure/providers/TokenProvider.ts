import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import {
  JWTPayload,
  RefreshTokenPayload,
  TokenPair,
  JWT_EXPIRATION_HOURS,
  REFRESH_TOKEN_EXPIRATION_DAYS
} from '../../domain/value-objects/Tokens';

export interface ITokenProvider {
  generateTokenPair(userId: string, email: string, sessionId: string): TokenPair;
  verifyAccessToken(token: string): JWTPayload | null;
  verifyRefreshToken(token: string): RefreshTokenPayload | null;
}

export class JWTTokenProvider implements ITokenProvider {
  constructor(
    private readonly accessTokenSecret: string,
    private readonly refreshTokenSecret: string
  ) {}

  generateTokenPair(userId: string, email: string, sessionId: string): TokenPair {
    const now = Math.floor(Date.now() / 1000);
    const accessTokenExp = now + JWT_EXPIRATION_HOURS * 60 * 60;
    const refreshTokenExp = now + REFRESH_TOKEN_EXPIRATION_DAYS * 24 * 60 * 60;

    const accessTokenPayload: JWTPayload = {
      sub: userId,
      email,
      iat: now,
      exp: accessTokenExp
    };

    const refreshTokenPayload: RefreshTokenPayload = {
      sub: userId,
      sessionId,
      iat: now,
      exp: refreshTokenExp
    };

    const accessToken = jwt.sign(accessTokenPayload, this.accessTokenSecret);
    const refreshToken = jwt.sign(refreshTokenPayload, this.refreshTokenSecret);

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresAt: new Date(accessTokenExp * 1000),
      refreshTokenExpiresAt: new Date(refreshTokenExp * 1000)
    };
  }

  verifyAccessToken(token: string): JWTPayload | null {
    try {
      const payload = jwt.verify(token, this.accessTokenSecret) as JWTPayload;
      return payload;
    } catch {
      return null;
    }
  }

  verifyRefreshToken(token: string): RefreshTokenPayload | null {
    try {
      const payload = jwt.verify(token, this.refreshTokenSecret) as RefreshTokenPayload;
      return payload;
    } catch {
      return null;
    }
  }
}
