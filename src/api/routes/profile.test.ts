import request from 'supertest';
import { createApp } from '../../index';
import { createUser } from '../../domain/entities/User';
import { createAuthSession } from '../../domain/entities/AuthSession';

describe('Profile Routes', () => {
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
    repos.securityEventRepository.clear();
    providers.emailProvider.clear();
    (providers.plaidProvider as any).clear();
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

  describe('GET /api/v1/users/me', () => {
    it('should return user profile', async () => {
      const { accessToken } = await createTestUserAndToken({
        name: 'Test User',
        phone: '+1234567890',
        address: '123 Main St',
        timezone: 'America/New_York',
        photoUrl: 'https://example.com/photo.jpg'
      });

      const response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.email).toBe('test@example.com');
      expect(response.body.name).toBe('Test User');
      expect(response.body.phone).toBe('+1234567890');
      expect(response.body.address).toBe('123 Main St');
      expect(response.body.timezone).toBe('America/New_York');
      expect(response.body.photoUrl).toBe('https://example.com/photo.jpg');
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app).get('/api/v1/users/me');

      expect(response.status).toBe(401);
    });

    it('should return 404 for deleted user', async () => {
      const { accessToken } = await createTestUserAndToken();
      await repos.userRepository.softDelete('test-user-id');

      const response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Account is scheduled for deletion');
    });
  });

  describe('PATCH /api/v1/users/me', () => {
    it('should update profile fields', async () => {
      const { accessToken } = await createTestUserAndToken();

      const response = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Updated Name',
          phone: '+9876543210',
          address: '456 Oak Ave',
          timezone: 'Europe/London',
          photo_url: 'https://example.com/new-photo.jpg'
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Name');
      expect(response.body.phone).toBe('+9876543210');
      expect(response.body.address).toBe('456 Oak Ave');
      expect(response.body.timezone).toBe('Europe/London');
      expect(response.body.photoUrl).toBe('https://example.com/new-photo.jpg');
    });

    it('should send verification email for email change', async () => {
      const { accessToken } = await createTestUserAndToken();

      const response = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: 'new@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.email_verification_sent).toBe(true);
      expect(response.body.email).toBe('test@example.com'); // Still old email
      expect(response.body.pendingEmail).toBe('new@example.com');

      const sentEmails = providers.emailProvider.getSentEmails();
      expect(sentEmails.some(e => e.type === 'email_verification')).toBe(true);
    });

    it('should return 409 for email already in use', async () => {
      const { accessToken } = await createTestUserAndToken();
      const otherUser = createUser({
        id: 'other-user',
        email: 'existing@example.com'
      });
      await repos.userRepository.save(otherUser);

      const response = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: 'existing@example.com' });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('Email already in use');
    });

    it('should return 401 without auth token', async () => {
      const response = await request(app)
        .patch('/api/v1/users/me')
        .send({ name: 'Test' });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/v1/users/me/verify-email', () => {
    it('should complete email change with valid token', async () => {
      const { accessToken } = await createTestUserAndToken();

      // Initiate email change
      await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: 'new@example.com' });

      // Get token from repository
      const user = await repos.userRepository.findById('test-user-id');
      const token = user!.emailVerificationToken!;

      const response = await request(app)
        .post('/api/v1/users/me/verify-email')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token });

      expect(response.status).toBe(200);
      expect(response.body.profile.email).toBe('new@example.com');
    });

    it('should return 400 for invalid token', async () => {
      const { accessToken } = await createTestUserAndToken();

      await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ email: 'new@example.com' });

      const response = await request(app)
        .post('/api/v1/users/me/verify-email')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token: 'wrong-token' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid verification token');
    });

    it('should return 400 without token', async () => {
      const { accessToken } = await createTestUserAndToken();

      const response = await request(app)
        .post('/api/v1/users/me/verify-email')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Verification token is required');
    });
  });

  describe('DELETE /api/v1/users/me', () => {
    it('should initiate account deletion with 7-day grace period', async () => {
      const { accessToken } = await createTestUserAndToken();

      const response = await request(app)
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Account deletion initiated');
      expect(response.body.grace_period_days).toBe(7);
      expect(response.body.scheduled_deletion_date).toBeDefined();

      // Verify user is soft deleted
      const user = await repos.userRepository.findById('test-user-id');
      expect(user!.deletedAt).toBeDefined();
    });

    it('should revoke Plaid connections on deletion', async () => {
      const { accessToken } = await createTestUserAndToken();

      (providers.plaidProvider as any).addConnection('test-user-id', {
        id: 'conn-1',
        institutionId: 'inst-1',
        institutionName: 'Test Bank',
        accessToken: 'token-1',
        createdAt: new Date()
      });

      const response = await request(app)
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.connections_revoked).toBe(1);
    });

    it('should send deletion confirmation email', async () => {
      const { accessToken } = await createTestUserAndToken();

      await request(app)
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`);

      const sentEmails = providers.emailProvider.getSentEmails();
      expect(sentEmails.some(e => e.type === 'account_deletion')).toBe(true);
    });

    it('should return 400 if already deleted', async () => {
      const { accessToken } = await createTestUserAndToken();
      await repos.userRepository.softDelete('test-user-id');

      const response = await request(app)
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Account is already scheduled for deletion');
    });
  });

  describe('POST /api/v1/users/me/undelete', () => {
    it('should restore account within grace period', async () => {
      const { accessToken } = await createTestUserAndToken();

      // Delete account first
      await request(app)
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`);

      // Clear emails from deletion
      providers.emailProvider.clear();

      const response = await request(app)
        .post('/api/v1/users/me/undelete')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Account deletion cancelled');

      // Verify user is restored
      const user = await repos.userRepository.findById('test-user-id');
      expect(user!.deletedAt).toBeNull();
      expect(user!.deletionScheduledAt).toBeNull();
    });

    it('should send account restored email', async () => {
      const { accessToken } = await createTestUserAndToken();
      await repos.userRepository.softDelete('test-user-id');

      await request(app)
        .post('/api/v1/users/me/undelete')
        .set('Authorization', `Bearer ${accessToken}`);

      const sentEmails = providers.emailProvider.getSentEmails();
      expect(sentEmails.some(e => e.type === 'account_restored')).toBe(true);
    });

    it('should return 400 if not scheduled for deletion', async () => {
      const { accessToken } = await createTestUserAndToken();

      const response = await request(app)
        .post('/api/v1/users/me/undelete')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Account is not scheduled for deletion');
    });

    it('should return 410 if grace period expired', async () => {
      const { accessToken, user } = await createTestUserAndToken();

      // Set deletion dates in the past
      user.deletedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      user.deletionScheduledAt = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      await repos.userRepository.save(user);

      const response = await request(app)
        .post('/api/v1/users/me/undelete')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(410);
      expect(response.body.error).toBe('Grace period has expired');
    });
  });
});
