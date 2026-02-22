import { ConnectionService } from './ConnectionService';
import { InMemoryConnectionRepository } from '../../infrastructure/repositories/ConnectionRepository';
import { InMemorySubscriptionRepository } from '../../infrastructure/repositories/SubscriptionRepository';
import { InMemorySecurityEventRepository } from '../../infrastructure/repositories/SecurityEventRepository';
import { MockPlaidProvider } from '../../infrastructure/providers/PlaidProvider';
import { MockAlertProvider } from '../../infrastructure/providers/AlertProvider';
import { InMemoryDomainEventEmitter } from '../../domain/events/DomainEvents';
import { createConnection, Connection } from '../../domain/entities/Connection';
import { createSubscription } from '../../domain/entities/Subscription';

describe('ConnectionService', () => {
  let connectionService: ConnectionService;
  let connectionRepository: InMemoryConnectionRepository;
  let subscriptionRepository: InMemorySubscriptionRepository;
  let securityEventRepository: InMemorySecurityEventRepository;
  let plaidProvider: MockPlaidProvider;
  let alertProvider: MockAlertProvider;
  let domainEventEmitter: InMemoryDomainEventEmitter;

  const userId = 'user-123';
  const deviceInfo = { ip: '192.168.1.1', userAgent: 'TestBrowser/1.0' };

  beforeEach(() => {
    connectionRepository = new InMemoryConnectionRepository();
    subscriptionRepository = new InMemorySubscriptionRepository();
    securityEventRepository = new InMemorySecurityEventRepository();
    plaidProvider = new MockPlaidProvider();
    alertProvider = new MockAlertProvider();
    domainEventEmitter = new InMemoryDomainEventEmitter();

    connectionService = new ConnectionService(
      connectionRepository,
      subscriptionRepository,
      securityEventRepository,
      plaidProvider,
      alertProvider,
      domainEventEmitter
    );
  });

  describe('listConnections', () => {
    it('should return empty array when user has no connections', async () => {
      const result = await connectionService.listConnections(userId);

      expect(result.success).toBe(true);
      expect(result.connections).toEqual([]);
    });

    it('should return all connections for user', async () => {
      const connection1 = createConnection({
        id: 'conn-1',
        userId,
        plaidAccessToken: 'token-1',
        institutionId: 'inst-1',
        institutionName: 'Bank One'
      });
      const connection2 = createConnection({
        id: 'conn-2',
        userId,
        plaidAccessToken: 'token-2',
        institutionId: 'inst-2',
        institutionName: 'Bank Two'
      });

      await connectionRepository.save(connection1);
      await connectionRepository.save(connection2);

      const result = await connectionService.listConnections(userId);

      expect(result.success).toBe(true);
      expect(result.connections).toHaveLength(2);
      expect(result.connections?.map(c => c.institutionName)).toContain('Bank One');
      expect(result.connections?.map(c => c.institutionName)).toContain('Bank Two');
    });

    it('should not include connections from other users', async () => {
      const ownConnection = createConnection({
        id: 'conn-1',
        userId,
        plaidAccessToken: 'token-1',
        institutionId: 'inst-1',
        institutionName: 'My Bank'
      });
      const otherConnection = createConnection({
        id: 'conn-2',
        userId: 'other-user',
        plaidAccessToken: 'token-2',
        institutionId: 'inst-2',
        institutionName: 'Other Bank'
      });

      await connectionRepository.save(ownConnection);
      await connectionRepository.save(otherConnection);

      const result = await connectionService.listConnections(userId);

      expect(result.success).toBe(true);
      expect(result.connections).toHaveLength(1);
      expect(result.connections?.[0].institutionName).toBe('My Bank');
    });
  });

  describe('refreshConnection', () => {
    let connection: Connection;

    beforeEach(async () => {
      connection = createConnection({
        id: 'conn-1',
        userId,
        plaidAccessToken: 'token-1',
        institutionId: 'inst-1',
        institutionName: 'Test Bank'
      });
      await connectionRepository.save(connection);
    });

    it('should return error when connection not found', async () => {
      const result = await connectionService.refreshConnection(
        userId,
        'non-existent',
        deviceInfo
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection not found');
    });

    it('should return error when connection belongs to different user', async () => {
      const result = await connectionService.refreshConnection(
        'different-user',
        connection.id,
        deviceInfo
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection not found');
    });

    it('should return error when connection is disconnected', async () => {
      connection.status = 'disconnected';
      await connectionRepository.update(connection);

      const result = await connectionService.refreshConnection(
        userId,
        connection.id,
        deviceInfo
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection is disconnected');
    });

    it('should update last_sync_at on successful sync', async () => {
      const beforeSync = new Date();

      const result = await connectionService.refreshConnection(
        userId,
        connection.id,
        deviceInfo
      );

      expect(result.success).toBe(true);
      expect(result.connection).toBeDefined();
      expect(result.connection?.status).toBe('active');

      const updated = await connectionRepository.findById(connection.id);
      expect(updated?.lastSyncAt).toBeDefined();
      expect(updated?.lastSyncAt!.getTime()).toBeGreaterThanOrEqual(beforeSync.getTime());
      expect(updated?.lastSyncError).toBeNull();
    });

    it('should update status to failed and send alert on sync failure', async () => {
      plaidProvider.setSyncFailure(connection.plaidAccessToken, true);

      const result = await connectionService.refreshConnection(
        userId,
        connection.id,
        deviceInfo
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('sync failed');
      expect(result.connection?.status).toBe('failed');

      const updated = await connectionRepository.findById(connection.id);
      expect(updated?.status).toBe('failed');
      expect(updated?.lastSyncError).toBeDefined();

      const alerts = alertProvider.getAlertsForUser(userId);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('sync_failure');
    });

    it('should recover from failed status on successful sync', async () => {
      connection.status = 'failed';
      connection.lastSyncError = 'Previous error';
      await connectionRepository.update(connection);

      const result = await connectionService.refreshConnection(
        userId,
        connection.id,
        deviceInfo
      );

      expect(result.success).toBe(true);
      expect(result.connection?.status).toBe('active');

      const updated = await connectionRepository.findById(connection.id);
      expect(updated?.status).toBe('active');
      expect(updated?.lastSyncError).toBeNull();
    });
  });

  describe('disconnectConnection', () => {
    let connection: Connection;

    beforeEach(async () => {
      connection = createConnection({
        id: 'conn-1',
        userId,
        plaidAccessToken: 'token-1',
        institutionId: 'inst-1',
        institutionName: 'Test Bank'
      });
      await connectionRepository.save(connection);
    });

    it('should require confirmation', async () => {
      const result = await connectionService.disconnectConnection(
        userId,
        connection.id,
        false,
        deviceInfo
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Confirmation required');
    });

    it('should return error when connection not found', async () => {
      const result = await connectionService.disconnectConnection(
        userId,
        'non-existent',
        true,
        deviceInfo
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection not found');
    });

    it('should return error when connection belongs to different user', async () => {
      const result = await connectionService.disconnectConnection(
        'different-user',
        connection.id,
        true,
        deviceInfo
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection not found');
    });

    it('should revoke Plaid access token', async () => {
      await connectionService.disconnectConnection(
        userId,
        connection.id,
        true,
        deviceInfo
      );

      expect(plaidProvider.isTokenRevoked(connection.plaidAccessToken)).toBe(true);
    });

    it('should mark associated subscriptions as unverified', async () => {
      const sub1 = createSubscription({
        id: 'sub-1',
        userId,
        connectionId: connection.id,
        name: 'Netflix',
        amount: 15.99
      });
      const sub2 = createSubscription({
        id: 'sub-2',
        userId,
        connectionId: connection.id,
        name: 'Spotify',
        amount: 9.99
      });
      const sub3 = createSubscription({
        id: 'sub-3',
        userId,
        connectionId: 'other-conn',
        name: 'HBO',
        amount: 14.99
      });

      await subscriptionRepository.save(sub1);
      await subscriptionRepository.save(sub2);
      await subscriptionRepository.save(sub3);

      const result = await connectionService.disconnectConnection(
        userId,
        connection.id,
        true,
        deviceInfo
      );

      expect(result.success).toBe(true);
      expect(result.subscriptionsAffected).toBe(2);

      const updatedSub1 = await subscriptionRepository.findById('sub-1');
      const updatedSub2 = await subscriptionRepository.findById('sub-2');
      const updatedSub3 = await subscriptionRepository.findById('sub-3');

      expect(updatedSub1?.status).toBe('unverified');
      expect(updatedSub2?.status).toBe('unverified');
      expect(updatedSub3?.status).toBe('verified'); // Not affected
    });

    it('should emit ConnectionDisconnected domain event', async () => {
      const sub1 = createSubscription({
        id: 'sub-1',
        userId,
        connectionId: connection.id,
        name: 'Netflix',
        amount: 15.99
      });
      await subscriptionRepository.save(sub1);

      await connectionService.disconnectConnection(
        userId,
        connection.id,
        true,
        deviceInfo
      );

      const events = domainEventEmitter.getConnectionDisconnectedEvents();
      expect(events).toHaveLength(1);
      expect(events[0].data.connectionId).toBe(connection.id);
      expect(events[0].data.userId).toBe(userId);
      expect(events[0].data.institutionId).toBe('inst-1');
      expect(events[0].data.institutionName).toBe('Test Bank');
      expect(events[0].data.subscriptionsAffected).toBe(1);
    });

    it('should log SecurityEvent for connection_removed', async () => {
      await connectionService.disconnectConnection(
        userId,
        connection.id,
        true,
        deviceInfo
      );

      const events = await securityEventRepository.findByUserId(userId);
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('connection_removed');
      expect(events[0].deviceInfo).toBe(deviceInfo.userAgent);
      expect(events[0].ipAddress).toBe(deviceInfo.ip);
      expect(events[0].metadata).toMatchObject({
        connectionId: connection.id,
        institutionId: 'inst-1',
        institutionName: 'Test Bank'
      });
    });

    it('should delete the connection', async () => {
      await connectionService.disconnectConnection(
        userId,
        connection.id,
        true,
        deviceInfo
      );

      const deleted = await connectionRepository.findById(connection.id);
      expect(deleted).toBeNull();
    });
  });

  describe('runDailyAutoSync', () => {
    it('should sync all active connections', async () => {
      const conn1 = createConnection({
        id: 'conn-1',
        userId: 'user-1',
        plaidAccessToken: 'token-1',
        institutionId: 'inst-1',
        institutionName: 'Bank One'
      });
      const conn2 = createConnection({
        id: 'conn-2',
        userId: 'user-2',
        plaidAccessToken: 'token-2',
        institutionId: 'inst-2',
        institutionName: 'Bank Two'
      });

      await connectionRepository.save(conn1);
      await connectionRepository.save(conn2);

      const result = await connectionService.runDailyAutoSync();

      expect(result.synced).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);

      const updated1 = await connectionRepository.findById('conn-1');
      const updated2 = await connectionRepository.findById('conn-2');

      expect(updated1?.lastSyncAt).toBeDefined();
      expect(updated2?.lastSyncAt).toBeDefined();
    });

    it('should not sync disconnected connections', async () => {
      const activeConn = createConnection({
        id: 'conn-1',
        userId: 'user-1',
        plaidAccessToken: 'token-1',
        institutionId: 'inst-1',
        institutionName: 'Bank One'
      });
      const disconnectedConn = createConnection({
        id: 'conn-2',
        userId: 'user-2',
        plaidAccessToken: 'token-2',
        institutionId: 'inst-2',
        institutionName: 'Bank Two',
        status: 'disconnected'
      });

      await connectionRepository.save(activeConn);
      await connectionRepository.save(disconnectedConn);

      const result = await connectionService.runDailyAutoSync();

      expect(result.synced).toBe(1);
    });

    it('should handle sync failures and send alerts', async () => {
      const conn1 = createConnection({
        id: 'conn-1',
        userId: 'user-1',
        plaidAccessToken: 'token-1',
        institutionId: 'inst-1',
        institutionName: 'Bank One'
      });
      const conn2 = createConnection({
        id: 'conn-2',
        userId: 'user-2',
        plaidAccessToken: 'token-2',
        institutionId: 'inst-2',
        institutionName: 'Bank Two'
      });

      await connectionRepository.save(conn1);
      await connectionRepository.save(conn2);

      plaidProvider.setSyncFailure('token-2', true);

      const result = await connectionService.runDailyAutoSync();

      expect(result.synced).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].connectionId).toBe('conn-2');

      const updated2 = await connectionRepository.findById('conn-2');
      expect(updated2?.status).toBe('failed');
      expect(updated2?.lastSyncError).toBeDefined();

      const alerts = alertProvider.getAlertsForUser('user-2');
      expect(alerts).toHaveLength(1);
    });

    it('should return empty results when no active connections', async () => {
      const result = await connectionService.runDailyAutoSync();

      expect(result.synced).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });
});
