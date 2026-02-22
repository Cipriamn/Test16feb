export interface Alert {
  type: 'sync_failure' | 'connection_error' | 'system_error';
  userId: string;
  connectionId?: string;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface IAlertProvider {
  sendSyncFailureAlert(userId: string, connectionId: string, error: string): Promise<void>;
}

// Mock alert provider for MVP
export class MockAlertProvider implements IAlertProvider {
  private alerts: Alert[] = [];

  async sendSyncFailureAlert(userId: string, connectionId: string, error: string): Promise<void> {
    const alert: Alert = {
      type: 'sync_failure',
      userId,
      connectionId,
      message: `Connection sync failed: ${error}`,
      metadata: { connectionId, error },
      createdAt: new Date()
    };
    this.alerts.push(alert);
    console.log(`[Alert Mock] Sync failure alert for user ${userId}, connection ${connectionId}: ${error}`);
  }

  // Test helpers
  getAlerts(): Alert[] {
    return [...this.alerts];
  }

  getAlertsForUser(userId: string): Alert[] {
    return this.alerts.filter(a => a.userId === userId);
  }

  clear(): void {
    this.alerts = [];
  }
}
