import { ConnectionService } from '../../application/services/ConnectionService';

export interface IAutoSyncScheduler {
  start(): void;
  stop(): void;
  isRunning(): boolean;
  triggerManualSync(): Promise<void>;
}

// Simple interval-based scheduler for MVP
// In production, use node-cron or similar for more precise scheduling
export class AutoSyncScheduler implements IAutoSyncScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private running: boolean = false;
  private readonly intervalMs: number;

  constructor(
    private connectionService: ConnectionService,
    intervalHours: number = 24
  ) {
    this.intervalMs = intervalHours * 60 * 60 * 1000;
  }

  start(): void {
    if (this.running) {
      console.log('[AutoSyncScheduler] Already running');
      return;
    }

    console.log(`[AutoSyncScheduler] Starting with ${this.intervalMs / 1000 / 60 / 60}h interval`);
    this.running = true;

    // Run immediately on start
    this.runSync();

    // Then schedule periodic runs
    this.intervalId = setInterval(() => {
      this.runSync();
    }, this.intervalMs);
  }

  stop(): void {
    if (!this.running) {
      console.log('[AutoSyncScheduler] Not running');
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.running = false;
    console.log('[AutoSyncScheduler] Stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  async triggerManualSync(): Promise<void> {
    await this.runSync();
  }

  private async runSync(): Promise<void> {
    console.log('[AutoSyncScheduler] Running daily auto-sync...');
    try {
      const result = await this.connectionService.runDailyAutoSync();
      console.log(`[AutoSyncScheduler] Sync complete: ${result.synced} synced, ${result.failed} failed`);
    } catch (error) {
      console.error('[AutoSyncScheduler] Sync failed:', error);
    }
  }
}

// Mock scheduler for testing
export class MockAutoSyncScheduler implements IAutoSyncScheduler {
  private running: boolean = false;
  private syncCount: number = 0;

  constructor(private connectionService: ConnectionService) {}

  start(): void {
    this.running = true;
  }

  stop(): void {
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  async triggerManualSync(): Promise<void> {
    this.syncCount++;
    await this.connectionService.runDailyAutoSync();
  }

  // Test helper
  getSyncCount(): number {
    return this.syncCount;
  }

  reset(): void {
    this.running = false;
    this.syncCount = 0;
  }
}
