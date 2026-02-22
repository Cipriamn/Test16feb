import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { createApp } from '../../index';
import { createUser } from '../../domain/entities/User';
import { AuthService } from '../../application/services/AuthService';

describe('Auth API Integration Tests', () => {
  let app: ReturnType<typeof createApp>['app'];
  let repositories: ReturnType<typeof createApp>['repositories'];
  let providers: ReturnType<typeof createApp>['providers'];

  beforeEach(() => {
    const appInstance = createApp();
    app = appInstance.app;
    repositories = appInstance.repositories;
    providers = appInstance.providers;

    // Clear all repositories
    repositories.userRepository.clear();
    repositories.sessionRepository.clear();
    repositories.securityEventRepository.clear();
    providers.emailProvider.clear();
    providers.smsProvider.clear();
    AuthService.clearPendingChallenges();
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const passwordHash = await providers.passwordProvider.hash('ValidPass123!');
      const user = createUser({
        id: uuidv4(),
        email: 'test@example.com',
        passwordHash
      });
      await repositories.userRepository.save(user);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'ValidPass123!' });

      expect(response.status).toBe(200);
      expect(response.body.access_token).toBeDefined();
      expect(response.body.refresh_token).toBeDefined();
      expect(response.body.token_type).toBe('Bearer');
      expect(response.body.expires_in).toBe(86400);
      expect(response.body.session_id).toBeDefined();
    });

    it('should return 401 for invalid credentials', async () => {
      const passwordHash = await providers.passwordProvider.hash('ValidPass123!');
      const user = createUser({
        id: uuidv4(),
        email: 'test@example.com',
        passwordHash
      });
      await repositories.userRepository.save(user);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'WrongPassword!' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid credentials');
    });

    it('should return 400 when email is missing', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ password: 'SomePass123!' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email is required');
    });

    it('should return 400 when password and oauth_token are both missing', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Password or OAuth token is required');
    });

    it('should indicate 2FA required when user has TOTP enabled', async () => {
      const secret = providers.twoFactorProvider.generateSecret('test@example.com');
      const passwordHash = await providers.passwordProvider.hash('ValidPass123!');
      const user = createUser({
        id: uuidv4(),
        email: 'test@example.com',
        passwordHash,
        twoFactorEnabled: true,
        twoFactorSecret: secret.secret
      });
      await repositories.userRepository.save(user);

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'ValidPass123!' });

      expect(response.status).toBe(200);
      expect(response.body.requires_two_factor).toBe(true);
      expect(response.body.two_factor_method).toBe('totp');
    });

    it('should reject invalid TOTP code', async () => {
      const secret = providers.twoFactorProvider.generateSecret('test@example.com');
      const passwordHash = await providers.passwordProvider.hash('ValidPass123!');
      const user = createUser({
        id: uuidv4(),
        email: 'test@example.com',
        passwordHash,
        twoFactorEnabled: true,
        twoFactorSecret: secret.secret
      });
      await repositories.userRepository.save(user);

      // First trigger 2FA
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'ValidPass123!' });

      // Then try with invalid code
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'ValidPass123!', totp_code: '000000' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid two-factor authentication code');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should logout successfully', async () => {
      const passwordHash = await providers.passwordProvider.hash('ValidPass123!');
      const user = createUser({
        id: uuidv4(),
        email: 'test@example.com',
        passwordHash
      });
      await repositories.userRepository.save(user);

      // Login first
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'ValidPass123!' });

      const { access_token, session_id } = loginResponse.body;

      // Logout
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${access_token}`)
        .send({ session_id });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logged out successfully');
    });

    it('should return 401 without authorization header', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .send({ session_id: 'some-session-id' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authorization header required');
    });

    it('should return 400 without session_id', async () => {
      const passwordHash = await providers.passwordProvider.hash('ValidPass123!');
      const user = createUser({
        id: uuidv4(),
        email: 'test@example.com',
        passwordHash
      });
      await repositories.userRepository.save(user);

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'ValidPass123!' });

      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${loginResponse.body.access_token}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Session ID is required');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should refresh tokens successfully', async () => {
      const passwordHash = await providers.passwordProvider.hash('ValidPass123!');
      const user = createUser({
        id: uuidv4(),
        email: 'test@example.com',
        passwordHash
      });
      await repositories.userRepository.save(user);

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'ValidPass123!' });

      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refresh_token: loginResponse.body.refresh_token });

      expect(response.status).toBe(200);
      expect(response.body.access_token).toBeDefined();
      expect(response.body.refresh_token).toBeDefined();
      // New session ID should be different, proving refresh created new session
      expect(response.body.session_id).not.toBe(loginResponse.body.session_id);
      // New refresh token should be different (different session ID embedded)
      expect(response.body.refresh_token).not.toBe(loginResponse.body.refresh_token);
    });

    it('should return 400 without refresh_token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Refresh token is required');
    });

    it('should return 401 for invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refresh_token: 'invalid-token' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid refresh token');
    });
  });

  describe('POST /api/v1/auth/password/change', () => {
    it('should change password successfully', async () => {
      const passwordHash = await providers.passwordProvider.hash('OldPass123!');
      const user = createUser({
        id: uuidv4(),
        email: 'test@example.com',
        passwordHash
      });
      await repositories.userRepository.save(user);

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'OldPass123!' });

      const response = await request(app)
        .post('/api/v1/auth/password/change')
        .set('Authorization', `Bearer ${loginResponse.body.access_token}`)
        .send({ current_password: 'OldPass123!', new_password: 'NewPass456!' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Password changed successfully');

      // Verify new password works
      const newLoginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'NewPass456!' });

      expect(newLoginResponse.status).toBe(200);
    });

    it('should return 400 for incorrect current password', async () => {
      const passwordHash = await providers.passwordProvider.hash('OldPass123!');
      const user = createUser({
        id: uuidv4(),
        email: 'test@example.com',
        passwordHash
      });
      await repositories.userRepository.save(user);

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'OldPass123!' });

      const response = await request(app)
        .post('/api/v1/auth/password/change')
        .set('Authorization', `Bearer ${loginResponse.body.access_token}`)
        .send({ current_password: 'WrongPassword!', new_password: 'NewPass456!' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Current password is incorrect');
    });

    it('should return 401 without authorization', async () => {
      const response = await request(app)
        .post('/api/v1/auth/password/change')
        .send({ current_password: 'OldPass123!', new_password: 'NewPass456!' });

      expect(response.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/password/change')
        .set('Authorization', 'Bearer invalid-token-here')
        .send({ current_password: 'OldPass123!', new_password: 'NewPass456!' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Invalid or expired token');
    });

    it('should return 400 when passwords are missing', async () => {
      const passwordHash = await providers.passwordProvider.hash('OldPass123!');
      const user = createUser({
        id: uuidv4(),
        email: 'test@example.com',
        passwordHash
      });
      await repositories.userRepository.save(user);

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'OldPass123!' });

      const response = await request(app)
        .post('/api/v1/auth/password/change')
        .set('Authorization', `Bearer ${loginResponse.body.access_token}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Current password and new password are required');
    });
  });

  describe('POST /api/v1/auth/password/reset', () => {
    it('should send password reset email', async () => {
      const user = createUser({
        id: uuidv4(),
        email: 'test@example.com',
        passwordHash: 'somehash'
      });
      await repositories.userRepository.save(user);

      const response = await request(app)
        .post('/api/v1/auth/password/reset')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('If the email exists, a reset link has been sent');

      const emails = providers.emailProvider.getSentEmails();
      expect(emails.length).toBe(1);
      expect(emails[0].type).toBe('password_reset');
    });

    it('should return success for non-existent email (prevent enumeration)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/password/reset')
        .send({ email: 'nonexistent@example.com' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('If the email exists, a reset link has been sent');
    });

    it('should return 400 when email is missing', async () => {
      const response = await request(app)
        .post('/api/v1/auth/password/reset')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email is required');
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
      expect(response.body.timestamp).toBeDefined();
    });
  });
});
