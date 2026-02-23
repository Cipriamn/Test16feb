export type SecurityEventType =
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'password_changed'
  | 'password_reset_requested'
  | 'password_reset_completed'
  | 'two_factor_enabled'
  | 'two_factor_disabled'
  | 'session_revoked'
  | 'connection_added'
  | 'connection_removed';

export interface SecurityEvent {
  id: string;
  userId: string;
  eventType: SecurityEventType;
  deviceInfo: string;
  ipAddress: string;
  location: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export function createSecurityEvent(params: {
  id: string;
  userId: string;
  eventType: SecurityEventType;
  deviceInfo: string;
  ipAddress: string;
  location?: string | null;
  metadata?: Record<string, unknown>;
}): SecurityEvent {
  return {
    id: params.id,
    userId: params.userId,
    eventType: params.eventType,
    deviceInfo: params.deviceInfo,
    ipAddress: params.ipAddress,
    location: params.location ?? null,
    metadata: params.metadata ?? {},
    createdAt: new Date()
  };
}
