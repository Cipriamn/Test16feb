export interface JWTPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  sub: string;
  sessionId: string;
  iat: number;
  exp: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
}

export const JWT_EXPIRATION_HOURS = 24;
export const REFRESH_TOKEN_EXPIRATION_DAYS = 30;
