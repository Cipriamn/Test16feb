export interface PlaidConnection {
  id: string;
  userId: string;
  institutionId: string;
  institutionName: string;
  accessToken: string;
  createdAt: Date;
}

export interface IPlaidProvider {
  revokeAllConnections(userId: string): Promise<number>;
  revokeConnection(accessToken: string): Promise<boolean>;
  syncConnection(accessToken: string): Promise<{ success: boolean; error?: string }>;
  getConnections(userId: string): Promise<PlaidConnection[]>;
}

// Mock Plaid provider for MVP
export class MockPlaidProvider implements IPlaidProvider {
  private connections: Map<string, PlaidConnection[]> = new Map();
  private revokedConnections: Map<string, PlaidConnection[]> = new Map();
  private revokedTokens: Set<string> = new Set();
  private syncFailures: Set<string> = new Set();

  async revokeAllConnections(userId: string): Promise<number> {
    const userConnections = this.connections.get(userId) || [];
    const count = userConnections.length;

    if (count > 0) {
      console.log(`[Plaid Mock] Revoking ${count} connections for user ${userId}`);
      this.revokedConnections.set(userId, [...userConnections]);
      for (const conn of userConnections) {
        this.revokedTokens.add(conn.accessToken);
      }
      this.connections.delete(userId);
    }

    return count;
  }

  async revokeConnection(accessToken: string): Promise<boolean> {
    console.log(`[Plaid Mock] Revoking connection with token ${accessToken}`);
    this.revokedTokens.add(accessToken);
    return true;
  }

  async syncConnection(accessToken: string): Promise<{ success: boolean; error?: string }> {
    if (this.syncFailures.has(accessToken)) {
      console.log(`[Plaid Mock] Sync failed for token ${accessToken}`);
      return { success: false, error: 'Connection sync failed: institution temporarily unavailable' };
    }
    console.log(`[Plaid Mock] Sync successful for token ${accessToken}`);
    return { success: true };
  }

  async getConnections(userId: string): Promise<PlaidConnection[]> {
    return this.connections.get(userId) || [];
  }

  // Test helpers
  addConnection(userId: string, connection: Omit<PlaidConnection, 'userId'>): void {
    const existing = this.connections.get(userId) || [];
    existing.push({ ...connection, userId });
    this.connections.set(userId, existing);
  }

  getRevokedConnections(userId: string): PlaidConnection[] {
    return this.revokedConnections.get(userId) || [];
  }

  isTokenRevoked(accessToken: string): boolean {
    return this.revokedTokens.has(accessToken);
  }

  setSyncFailure(accessToken: string, shouldFail: boolean): void {
    if (shouldFail) {
      this.syncFailures.add(accessToken);
    } else {
      this.syncFailures.delete(accessToken);
    }
  }

  clear(): void {
    this.connections.clear();
    this.revokedConnections.clear();
    this.revokedTokens.clear();
    this.syncFailures.clear();
  }
}
