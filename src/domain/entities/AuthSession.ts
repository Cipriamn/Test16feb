export interface AuthSession {
  id: string;
  userId: string;
  refreshToken: string;
  deviceInfo: string;
  ipAddress: string;
  location: string | null;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

export function createAuthSession(params: {
  id: string;
  userId: string;
  refreshToken: string;
  deviceInfo: string;
  ipAddress: string;
  location?: string | null;
  expiresAt: Date;
}): AuthSession {
  return {
    id: params.id,
    userId: params.userId,
    refreshToken: params.refreshToken,
    deviceInfo: params.deviceInfo,
    ipAddress: params.ipAddress,
    location: params.location ?? null,
    createdAt: new Date(),
    expiresAt: params.expiresAt,
    revokedAt: null
  };
}

export function isSessionValid(session: AuthSession): boolean {
  return session.revokedAt === null && session.expiresAt > new Date();
}
