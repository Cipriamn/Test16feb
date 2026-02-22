export interface User {
  id: string;
  email: string;
  passwordHash: string | null;
  oauthProvider: 'google' | 'facebook' | null;
  oauthId: string | null;
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
  smsPhoneNumber: string | null;
  // Profile fields
  name: string | null;
  phone: string | null;
  address: string | null;
  timezone: string | null;
  photoUrl: string | null;
  // Email verification
  pendingEmail: string | null;
  emailVerificationToken: string | null;
  emailVerificationExpiry: Date | null;
  // Account deletion
  deletedAt: Date | null;
  deletionScheduledAt: Date | null;
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
  name?: string | null;
  phone?: string | null;
  address?: string | null;
  timezone?: string | null;
  photoUrl?: string | null;
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
    name: params.name ?? null,
    phone: params.phone ?? null,
    address: params.address ?? null,
    timezone: params.timezone ?? null,
    photoUrl: params.photoUrl ?? null,
    pendingEmail: null,
    emailVerificationToken: null,
    emailVerificationExpiry: null,
    deletedAt: null,
    deletionScheduledAt: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  address: string | null;
  timezone: string | null;
  photoUrl: string | null;
  pendingEmail: string | null;
  twoFactorEnabled: boolean;
  createdAt: Date;
}

export function toUserProfile(user: User): UserProfile {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    address: user.address,
    timezone: user.timezone,
    photoUrl: user.photoUrl,
    pendingEmail: user.pendingEmail,
    twoFactorEnabled: user.twoFactorEnabled,
    createdAt: user.createdAt
  };
}
