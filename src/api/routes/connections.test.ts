import request from 'supertest';
import { createApp } from '../../index';
import { createUser } from '../../domain/entities/User';
import { createAuthSession } from '../../domain/entities/AuthSession';
import { createConnection } from '../../domain/entities/Connection';
import { createSubscription } from '../../domain/entities/Subscription';

describe('Connection Routes', () => {
  let app: ReturnType<typeof createApp>['app'];
  let repos: ReturnType<typeof createApp>['repositories'];
  let providers: ReturnType<typeof createApp>['providers'];

  beforeEach(() => {
    const appSetup = createApp();
    app = appSetup.app;
    repos = appSetup.repositories;
    providers = appSetup.providers;
  });

  afterEach(() => {
    repos.userRepository.clear();
    repos.sessionRepository.clear();
    repos.connectionRepository.clear();
    repos.subscriptionRepository.clear();
    repos.securityEventRepository.clear();
    providers.plaidProvider.clear();
    providers.alertProvider.clear();
    providers.domainEventEmitter.clear();
  });

  async function createTestUserAndToken(
    overrides: Partial<Parameters<typeof createUser>[0]> = {}
  ): Promise<{ user: ReturnType<typeof createUser>; accessToken: string }> {
    const user = createUser({
      id: 'test-user-id',
      email: 'test@example.com',
      passwordHash: 'hashed',
      name: 'Test User',
      ...overrides
    });
    await repos.userRepository.save(user);

    const tokens = providers.tokenProvider.generateTokenPair(
      user.id,
      user.email,
      'session-id'
    );

    const session = createAuthSession({
      id: 'session-id',
      userId: user.id,
      refreshToken: tokens.refreshToken,
      deviceInfo: 'test-agent',
      ipAddress: '127.0.0.1',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
    await repos.sessionRepository.save(session);

    return { user, accessToken: tokens.accessToken };
  }

  describe('GET /api/v1/connections', () => {
    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .get('/api/v1/connections')
        .expect(401);

      expect(response.body.error).toBe('Authorization header required');
    });

    it('should return empty array when no connections', async () => {
      const { accessToken } = await createTestUserAndToken();

      const response = await request(app)
        .get('/api/v1/connections')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.connections).toEqual([]);
    });

    it('should return all user connections', async () => {
      const { accessToken, user } = await createTestUserAndToken();

      const conn1 = createConnection({
        id: 'conn-1',
        userId: user.id,
        plaidAccessToken: 'token-1',
        institutionId: 'inst-1',
        institutionName: 'Bank One'
      });
      const conn2 = createConnection({
        id: 'conn-2',
        userId: user.id,
        plaidAccessToken: 'token-2',
        institutionId: 'inst-2',
        institutionName: 'Bank Two'
      });

      await repos.connectionRepository.save(conn1);
      await repos.connectionRepository.save(conn2);

      const response = await request(app)
        .get('/api/v1/connections')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.connections).toHaveLength(2);
      expect(response.body.connections.map((c: { institutionName: string }) => c.institutionName)).toContain('Bank One');
      expect(response.body.connections.map((c: { institutionName: string }) => c.institutionName)).toContain('Bank Two');
    });

    it('should not include other users connections', async () => {
      const { accessToken, user } = await createTestUserAndToken();

      const myConn = createConnection({
        id: 'conn-1',
        userId: user.id,
        plaidAccessToken: 'token-1',
        institutionId: 'inst-1',
        institutionName: 'My Bank'
      });
      const otherConn = createConnection({
        id: 'conn-2',
        userId: 'other-user',
        plaidAccessToken: 'token-2',
        institutionId: 'inst-2',
        institutionName: 'Other Bank'
      });

      await repos.connectionRepository.save(myConn);
      await repos.connectionRepository.save(otherConn);

      const response = await request(app)
        .get('/api/v1/connections')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.connections).toHaveLength(1);
      expect(response.body.connections[0].institutionName).toBe('My Bank');
    });
  });

  describe('POST /api/v1/connections/:id/refresh', () => {
    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .post('/api/v1/connections/conn-1/refresh')
        .expect(401);

      expect(response.body.error).toBe('Authorization header required');
    });

    it('should return 404 for non-existent connection', async () => {
      const { accessToken } = await createTestUserAndToken();

      const response = await request(app)
        .post('/api/v1/connections/non-existent/refresh')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.error).toBe('Connection not found');
    });

    it('should update last_sync_at on successful sync', async () => {
      const { accessToken, user } = await createTestUserAndToken();

      const connection = createConnection({
        id: 'conn-1',
        userId: user.id,
        plaidAccessToken: 'token-1',
        institutionId: 'inst-1',
        institutionName: 'Test Bank'
      });
      await repos.connectionRepository.save(connection);

      const response = await request(app)
        .post('/api/v1/connections/conn-1/refresh')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.connection).toBeDefined();
      expect(response.body.connection.status).toBe('active');

      const updated = await repos.connectionRepository.findById('conn-1');
      expect(updated?.lastSyncAt).toBeDefined();
    });

    it('should return 200 with error info on sync failure', async () => {
      const { accessToken, user } = await createTestUserAndToken();

      const connection = createConnection({
        id: 'conn-1',
        userId: user.id,
        plaidAccessToken: 'token-1',
        institutionId: 'inst-1',
        institutionName: 'Test Bank'
      });
      await repos.connectionRepository.save(connection);

      providers.plaidProvider.setSyncFailure('token-1', true);

      const response = await request(app)
        .post('/api/v1/connections/conn-1/refresh')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.connection.status).toBe('failed');

      const alerts = providers.alertProvider.getAlertsForUser(user.id);
      expect(alerts).toHaveLength(1);
    });

    it('should return 400 for disconnected connection', async () => {
      const { accessToken, user } = await createTestUserAndToken();

      const connection = createConnection({
        id: 'conn-1',
        userId: user.id,
        plaidAccessToken: 'token-1',
        institutionId: 'inst-1',
        institutionName: 'Test Bank',
        status: 'disconnected'
      });
      await repos.connectionRepository.save(connection);

      const response = await request(app)
        .post('/api/v1/connections/conn-1/refresh')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);

      expect(response.body.error).toBe('Connection is disconnected');
    });
  });

  describe('DELETE /api/v1/connections/:id', () => {
    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .delete('/api/v1/connections/conn-1')
        .send({ confirmed: true })
        .expect(401);

      expect(response.body.error).toBe('Authorization header required');
    });

    it('should return 400 without confirmation', async () => {
      const { accessToken, user } = await createTestUserAndToken();

      const connection = createConnection({
        id: 'conn-1',
        userId: user.id,
        plaidAccessToken: 'token-1',
        institutionId: 'inst-1',
        institutionName: 'Test Bank'
      });
      await repos.connectionRepository.save(connection);

      const response = await request(app)
        .delete('/api/v1/connections/conn-1')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Confirmation required');
      expect(response.body.message).toContain('confirmed: true');
    });

    it('should return 400 with confirmed=false', async () => {
      const { accessToken, user } = await createTestUserAndToken();

      const connection = createConnection({
        id: 'conn-1',
        userId: user.id,
        plaidAccessToken: 'token-1',
        institutionId: 'inst-1',
        institutionName: 'Test Bank'
      });
      await repos.connectionRepository.save(connection);

      const response = await request(app)
        .delete('/api/v1/connections/conn-1')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ confirmed: false })
        .expect(400);

      expect(response.body.error).toBe('Confirmation required');
    });

    it('should return 404 for non-existent connection', async () => {
      const { accessToken } = await createTestUserAndToken();

      const response = await request(app)
        .delete('/api/v1/connections/non-existent')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ confirmed: true })
        .expect(404);

      expect(response.body.error).toBe('Connection not found');
    });

    it('should disconnect and revoke Plaid token', async () => {
      const { accessToken, user } = await createTestUserAndToken();

      const connection = createConnection({
        id: 'conn-1',
        userId: user.id,
        plaidAccessToken: 'token-1',
        institutionId: 'inst-1',
        institutionName: 'Test Bank'
      });
      await repos.connectionRepository.save(connection);

      const response = await request(app)
        .delete('/api/v1/connections/conn-1')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ confirmed: true })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(providers.plaidProvider.isTokenRevoked('token-1')).toBe(true);
    });

    it('should mark subscriptions as unverified', async () => {
      const { accessToken, user } = await createTestUserAndToken();

      const connection = createConnection({
        id: 'conn-1',
        userId: user.id,
        plaidAccessToken: 'token-1',
        institutionId: 'inst-1',
        institutionName: 'Test Bank'
      });
      await repos.connectionRepository.save(connection);

      const sub = createSubscription({
        id: 'sub-1',
        userId: user.id,
        connectionId: 'conn-1',
        name: 'Netflix',
        amount: 15.99
      });
      await repos.subscriptionRepository.save(sub);

      const response = await request(app)
        .delete('/api/v1/connections/conn-1')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ confirmed: true })
        .expect(200);

      expect(response.body.subscriptionsAffected).toBe(1);

      const updatedSub = await repos.subscriptionRepository.findById('sub-1');
      expect(updatedSub?.status).toBe('unverified');
    });

    it('should emit ConnectionDisconnected event', async () => {
      const { accessToken, user } = await createTestUserAndToken();

      const connection = createConnection({
        id: 'conn-1',
        userId: user.id,
        plaidAccessToken: 'token-1',
        institutionId: 'inst-1',
        institutionName: 'Test Bank'
      });
      await repos.connectionRepository.save(connection);

      await request(app)
        .delete('/api/v1/connections/conn-1')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ confirmed: true })
        .expect(200);

      const events = providers.domainEventEmitter.getConnectionDisconnectedEvents();
      expect(events).toHaveLength(1);
      expect(events[0].data.connectionId).toBe('conn-1');
    });

    it('should log SecurityEvent for connection_removed', async () => {
      const { accessToken, user } = await createTestUserAndToken();

      const connection = createConnection({
        id: 'conn-1',
        userId: user.id,
        plaidAccessToken: 'token-1',
        institutionId: 'inst-1',
        institutionName: 'Test Bank'
      });
      await repos.connectionRepository.save(connection);

      await request(app)
        .delete('/api/v1/connections/conn-1')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ confirmed: true })
        .expect(200);

      const events = await repos.securityEventRepository.findByUserId(user.id);
      const connectionRemovedEvent = events.find(e => e.eventType === 'connection_removed');
      expect(connectionRemovedEvent).toBeDefined();
      expect(connectionRemovedEvent?.metadata).toMatchObject({
        connectionId: 'conn-1',
        institutionId: 'inst-1'
      });
    });

    it('should delete the connection', async () => {
      const { accessToken, user } = await createTestUserAndToken();

      const connection = createConnection({
        id: 'conn-1',
        userId: user.id,
        plaidAccessToken: 'token-1',
        institutionId: 'inst-1',
        institutionName: 'Test Bank'
      });
      await repos.connectionRepository.save(connection);

      await request(app)
        .delete('/api/v1/connections/conn-1')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ confirmed: true })
        .expect(200);

      const deleted = await repos.connectionRepository.findById('conn-1');
      expect(deleted).toBeNull();
    });
  });
});
