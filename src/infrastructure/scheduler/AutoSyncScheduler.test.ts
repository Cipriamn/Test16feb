import { createApp } from '../../index';
import { createConnection } from '../../domain/entities/Connection';
import { MockAutoSyncScheduler } from './AutoSyncScheduler';

describe('AutoSyncScheduler', () => {
  let repos: ReturnType<typeof createApp>['repositories'];
  let providers: ReturnType<typeof createApp>['providers'];
  let services: ReturnType<typeof createApp>['services'];
  let scheduler: MockAutoSyncScheduler;

  beforeEach(() => {
    const appSetup = createApp();
    repos = appSetup.repositories;
    providers = appSetup.providers;
    services = appSetup.services;
    scheduler = new MockAutoSyncScheduler(services.connectionService);
  });

  afterEach(() => {
    repos.userRepository.clear();
    repos.connectionRepository.clear();
    providers.plaidProvider.clear();
    providers.alertProvider.clear();
    scheduler.reset();
  });

  it('should start and stop correctly', () => {
    expect(scheduler.isRunning()).toBe(false);
    scheduler.start();
    expect(scheduler.isRunning()).toBe(true);
    scheduler.stop();
    expect(scheduler.isRunning()).toBe(false);
  });

  it('should trigger manual sync', async () => {
    const connection = createConnection({
      id: 'conn-1',
      userId: 'user-1',
      plaidAccessToken: 'token-1',
      institutionId: 'ins-1',
      institutionName: 'Test Bank'
    });
    await repos.connectionRepository.save(connection);

    await scheduler.triggerManualSync();

    expect(scheduler.getSyncCount()).toBe(1);

    // Verify connection was synced
    const updated = await repos.connectionRepository.findById('conn-1');
    expect(updated?.lastSyncAt).toBeDefined();
  });

  it('should sync multiple connections', async () => {
    const conn1 = createConnection({
      id: 'conn-1',
      userId: 'user-1',
      plaidAccessToken: 'token-1',
      institutionId: 'ins-1',
      institutionName: 'Bank One'
    });
    const conn2 = createConnection({
      id: 'conn-2',
      userId: 'user-2',
      plaidAccessToken: 'token-2',
      institutionId: 'ins-2',
      institutionName: 'Bank Two'
    });

    await repos.connectionRepository.save(conn1);
    await repos.connectionRepository.save(conn2);

    await scheduler.triggerManualSync();

    const updated1 = await repos.connectionRepository.findById('conn-1');
    const updated2 = await repos.connectionRepository.findById('conn-2');

    expect(updated1?.lastSyncAt).toBeDefined();
    expect(updated2?.lastSyncAt).toBeDefined();
  });

  it('should handle sync failures gracefully', async () => {
    const connection = createConnection({
      id: 'conn-1',
      userId: 'user-1',
      plaidAccessToken: 'token-1',
      institutionId: 'ins-1',
      institutionName: 'Test Bank'
    });
    await repos.connectionRepository.save(connection);

    providers.plaidProvider.setSyncFailure('token-1', true);

    await scheduler.triggerManualSync();

    const updated = await repos.connectionRepository.findById('conn-1');
    expect(updated?.status).toBe('failed');
    expect(updated?.lastSyncError).toBeDefined();

    // Should have sent alert
    const alerts = providers.alertProvider.getAlertsForUser('user-1');
    expect(alerts).toHaveLength(1);
  });
});
