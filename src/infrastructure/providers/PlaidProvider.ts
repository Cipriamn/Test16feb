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
  getConnections(userId: string): Promise<PlaidConnection[]>;
}

// Mock Plaid provider for MVP
export class MockPlaidProvider implements IPlaidProvider {
  private connections: Map<string, PlaidConnection[]> = new Map();
  private revokedConnections: Map<string, PlaidConnection[]> = new Map();

  async revokeAllConnections(userId: string): Promise<number> {
    const userConnections = this.connections.get(userId) || [];
    const count = userConnections.length;

    if (count > 0) {
      console.log(`[Plaid Mock] Revoking ${count} connections for user ${userId}`);
      this.revokedConnections.set(userId, [...userConnections]);
      this.connections.delete(userId);
    }

    return count;
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

  clear(): void {
    this.connections.clear();
    this.revokedConnections.clear();
  }
}
