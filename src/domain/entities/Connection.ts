export type ConnectionStatus = 'active' | 'failed' | 'disconnected';

export interface Connection {
  id: string;
  userId: string;
  plaidAccessToken: string;
  institutionId: string;
  institutionName: string;
  status: ConnectionStatus;
  lastSyncAt: Date | null;
  lastSyncError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function createConnection(params: {
  id: string;
  userId: string;
  plaidAccessToken: string;
  institutionId: string;
  institutionName: string;
  status?: ConnectionStatus;
}): Connection {
  return {
    id: params.id,
    userId: params.userId,
    plaidAccessToken: params.plaidAccessToken,
    institutionId: params.institutionId,
    institutionName: params.institutionName,
    status: params.status ?? 'active',
    lastSyncAt: null,
    lastSyncError: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

export interface ConnectionSummary {
  id: string;
  institutionId: string;
  institutionName: string;
  status: ConnectionStatus;
  lastSyncAt: Date | null;
  createdAt: Date;
}

export function toConnectionSummary(conn: Connection): ConnectionSummary {
  return {
    id: conn.id,
    institutionId: conn.institutionId,
    institutionName: conn.institutionName,
    status: conn.status,
    lastSyncAt: conn.lastSyncAt,
    createdAt: conn.createdAt
  };
}
