export interface User {
  id: string;
  email: string;
  passwordHash: string | null;
  oauthProvider: 'google' | 'facebook' | null;
  oauthId: string | null;
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
  smsPhoneNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function createUser(params: {
  id: string;
  email: string;
  passwordHash?: string | null;
  oauthProvider?: 'google' | 'facebook' | null;
  oauthId?: string | null;
  twoFactorEnabled?: boolean;
  twoFactorSecret?: string | null;
  smsPhoneNumber?: string | null;
}): User {
  return {
    id: params.id,
    email: params.email,
    passwordHash: params.passwordHash ?? null,
    oauthProvider: params.oauthProvider ?? null,
    oauthId: params.oauthId ?? null,
    twoFactorEnabled: params.twoFactorEnabled ?? false,
    twoFactorSecret: params.twoFactorSecret ?? null,
    smsPhoneNumber: params.smsPhoneNumber ?? null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}
