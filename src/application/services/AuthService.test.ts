import { v4 as uuidv4 } from 'uuid';
import { AuthService, DeviceContext } from './AuthService';
import { createUser, User } from '../../domain/entities/User';
import { InMemoryUserRepository } from '../../infrastructure/repositories/UserRepository';
import { InMemorySessionRepository } from '../../infrastructure/repositories/SessionRepository';
import { InMemorySecurityEventRepository } from '../../infrastructure/repositories/SecurityEventRepository';
import { JWTTokenProvider } from '../../infrastructure/providers/TokenProvider';
import { BcryptPasswordProvider } from '../../infrastructure/providers/PasswordProvider';
import { SpeakeasyTwoFactorProvider, MockSMSProvider } from '../../infrastructure/providers/TwoFactorProvider';
import { MockEmailProvider } from '../../infrastructure/providers/EmailProvider';

describe('AuthService', () => {
  let authService: AuthService;
  let userRepository: InMemoryUserRepository;
  let sessionRepository: InMemorySessionRepository;
  let securityEventRepository: InMemorySecurityEventRepository;
  let tokenProvider: JWTTokenProvider;
  let passwordProvider: BcryptPasswordProvider;
  let twoFactorProvider: SpeakeasyTwoFactorProvider;
  let smsProvider: MockSMSProvider;
  let emailProvider: MockEmailProvider;
  let deviceContext: DeviceContext;

  beforeEach(() => {
    userRepository = new InMemoryUserRepository();
    sessionRepository = new InMemorySessionRepository();
    securityEventRepository = new InMemorySecurityEventRepository();
    tokenProvider = new JWTTokenProvider('test-access-secret', 'test-refresh-secret');
    passwordProvider = new BcryptPasswordProvider();
    twoFactorProvider = new SpeakeasyTwoFactorProvider();
    smsProvider = new MockSMSProvider();
    emailProvider = new MockEmailProvider();

    authService = new AuthService(
      userRepository,
      sessionRepository,
      securityEventRepository,
      tokenProvider,
      passwordProvider,
      twoFactorProvider,
      smsProvider,
      emailProvider
    );

    deviceContext = {
      deviceInfo: 'Test Browser/1.0',
      ipAddress: '127.0.0.1',
      location: 'Test Location'
    };

    AuthService.clearPendingChallenges();
  });

  describe('login', () => {
    it('should successfully login with valid email and password', async () => {
      const passwordHash = await passwordProvider.hash('ValidPass123!');
      const user = createUser({
        id: uuidv4(),
        email: 'test@example.com',
        passwordHash
      });
      await userRepository.save(user);

      const result = await authService.login(
        { email: 'test@example.com', password: 'ValidPass123!' },
        deviceContext
      );

      expect(result.success).toBe(true);
      expect(result.tokens).toBeDefined();
      expect(result.tokens!.accessToken).toBeTruthy();
      expect(result.tokens!.refreshToken).toBeTruthy();
      expect(result.sessionId).toBeDefined();
    });

    it('should return 401 for invalid password', async () => {
      const passwordHash = await passwordProvider.hash('ValidPass123!');
      const user = createUser({
        id: uuidv4(),
        email: 'test@example.com',
        passwordHash
      });
      await userRepository.save(user);

      const result = await authService.login(
        { email: 'test@example.com', password: 'WrongPassword!' },
        deviceContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    it('should return 401 for non-existent user', async () => {
      const result = await authService.login(
        { email: 'nonexistent@example.com', password: 'SomePass123!' },
        deviceContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    it('should require 2FA when user has 2FA enabled with TOTP', async () => {
      const secret = twoFactorProvider.generateSecret('test@example.com');
      const passwordHash = await passwordProvider.hash('ValidPass123!');
      const user = createUser({
        id: uuidv4(),
        email: 'test@example.com',
        passwordHash,
        twoFactorEnabled: true,
        twoFactorSecret: secret.secret
      });
      await userRepository.save(user);

      const result = await authService.login(
        { email: 'test@example.com', password: 'ValidPass123!' },
        deviceContext
      );

      expect(result.success).toBe(false);
      expect(result.requiresTwoFactor).toBe(true);
      expect(result.twoFactorMethod).toBe('totp');
    });

    it('should reject invalid TOTP code', async () => {
      const secret = twoFactorProvider.generateSecret('test@example.com');
      const passwordHash = await passwordProvider.hash('ValidPass123!');
      const user = createUser({
        id: uuidv4(),
        email: 'test@example.com',
        passwordHash,
        twoFactorEnabled: true,
        twoFactorSecret: secret.secret
      });
      await userRepository.save(user);

      // First login to trigger 2FA challenge
      await authService.login(
        { email: 'test@example.com', password: 'ValidPass123!' },
        deviceContext
      );

      // Try with invalid TOTP code
      const result = await authService.login(
        { email: 'test@example.com', password: 'ValidPass123!', totpCode: '000000' },
        deviceContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid two-factor authentication code');
    });

    it('should log security event on successful login', async () => {
      const passwordHash = await passwordProvider.hash('ValidPass123!');
      const user = createUser({
        id: uuidv4(),
        email: 'test@example.com',
        passwordHash
      });
      await userRepository.save(user);

      await authService.login(
        { email: 'test@example.com', password: 'ValidPass123!' },
        deviceContext
      );

      const events = await securityEventRepository.findByUserId(user.id);
      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe('login_success');
    });

    it('should log security event on failed login', async () => {
      const passwordHash = await passwordProvider.hash('ValidPass123!');
      const user = createUser({
        id: uuidv4(),
        email: 'test@example.com',
        passwordHash
      });
      await userRepository.save(user);

      await authService.login(
        { email: 'test@example.com', password: 'WrongPassword!' },
        deviceContext
      );

      const events = await securityEventRepository.findByUserId(user.id);
      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe('login_failed');
    });

    it('should create AuthSession with device info on login', async () => {
      const passwordHash = await passwordProvider.hash('ValidPass123!');
      const user = createUser({
        id: uuidv4(),
        email: 'test@example.com',
        passwordHash
      });
      await userRepository.save(user);

      const result = await authService.login(
        { email: 'test@example.com', password: 'ValidPass123!' },
        deviceContext
      );

      const session = await sessionRepository.findById(result.sessionId!);
      expect(session).toBeDefined();
      expect(session!.deviceInfo).toBe('Test Browser/1.0');
      expect(session!.ipAddress).toBe('127.0.0.1');
      expect(session!.location).toBe('Test Location');
    });

    it('should support OAuth login', async () => {
      const user = createUser({
        id: uuidv4(),
        email: 'oauth@example.com',
        oauthProvider: 'google',
        oauthId: 'google-oauth-id-123'
      });
      await userRepository.save(user);

      const result = await authService.login(
        { email: 'oauth@example.com', oauthToken: 'valid-oauth-token-12345' },
        deviceContext
      );

      expect(result.success).toBe(true);
      expect(result.tokens).toBeDefined();
    });

    it('should require 2FA via SMS when user has SMS 2FA enabled', async () => {
      const passwordHash = await passwordProvider.hash('ValidPass123!');
      const user = createUser({
        id: uuidv4(),
        email: 'test@example.com',
        passwordHash,
        twoFactorEnabled: true,
        smsPhoneNumber: '+1234567890'
      });
      await userRepository.save(user);

      const result = await authService.login(
        { email: 'test@example.com', password: 'ValidPass123!' },
        deviceContext
      );

      expect(result.success).toBe(false);
      expect(result.requiresTwoFactor).toBe(true);
      expect(result.twoFactorMethod).toBe('sms');
    });
  });

  describe('logout', () => {
    it('should successfully revoke session', async () => {
      const passwordHash = await passwordProvider.hash('ValidPass123!');
      const user = createUser({
        id: uuidv4(),
        email: 'test@example.com',
        passwordHash
      });
      await userRepository.save(user);

      const loginResult = await authService.login(
        { email: 'test@example.com', password: 'ValidPass123!' },
        deviceContext
      );

      const logoutResult = await authService.logout(loginResult.sessionId!, deviceContext);

      expect(logoutResult).toBe(true);

      const session = await sessionRepository.findById(loginResult.sessionId!);
      expect(session!.revokedAt).not.toBeNull();
    });

    it('should return false for invalid session', async () => {
      const result = await authService.logout('non-existent-session-id', deviceContext);
      expect(result).toBe(false);
    });

    it('should log logout security event', async () => {
      const passwordHash = await passwordProvider.hash('ValidPass123!');
      const user = createUser({
        id: uuidv4(),
        email: 'test@example.com',
        passwordHash
      });
      await userRepository.save(user);

      const loginResult = await authService.login(
        { email: 'test@example.com', password: 'ValidPass123!' },
        deviceContext
      );

      await authService.logout(loginResult.sessionId!, deviceContext);

      const events = await securityEventRepository.findByUserId(user.id);
      const logoutEvent = events.find(e => e.eventType === 'logout');
      expect(logoutEvent).toBeDefined();
    });
  });

  describe('refreshTokens', () => {
    it('should successfully renew JWT from valid refresh token', async () => {
      const passwordHash = await passwordProvider.hash('ValidPass123!');
      const user = createUser({
        id: uuidv4(),
        email: 'test@example.com',
        passwordHash
      });
      await userRepository.save(user);

      const loginResult = await authService.login(
        { email: 'test@example.com', password: 'ValidPass123!' },
        deviceContext
      );

      const refreshResult = await authService.refreshTokens(
        loginResult.tokens!.refreshToken,
        deviceContext
      );

      expect(refreshResult.success).toBe(true);
      expect(refreshResult.tokens).toBeDefined();
      // New session ID should be different, proving refresh created new session
      expect(refreshResult.sessionId).not.toBe(loginResult.sessionId);
      // New refresh token should be different (different session ID embedded)
      expect(refreshResult.tokens!.refreshToken).not.toBe(loginResult.tokens!.refreshToken);
    });

    it('should fail with invalid refresh token', async () => {
      const result = await authService.refreshTokens('invalid-token', deviceContext);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid refresh token');
    });

    it('should fail with expired/revoked session', async () => {
      const passwordHash = await passwordProvider.hash('ValidPass123!');
      const user = createUser({
        id: uuidv4(),
        email: 'test@example.com',
        passwordHash
      });
      await userRepository.save(user);

      const loginResult = await authService.login(
        { email: 'test@example.com', password: 'ValidPass123!' },
        deviceContext
      );

      // Revoke the session
      await sessionRepository.revoke(loginResult.sessionId!);

      const refreshResult = await authService.refreshTokens(
        loginResult.tokens!.refreshToken,
        deviceContext
      );

      expect(refreshResult.success).toBe(false);
      expect(refreshResult.error).toBe('Session expired or invalid');
    });
  });

  describe('changePassword', () => {
    it('should successfully change password with valid current password', async () => {
      const passwordHash = await passwordProvider.hash('OldPass123!');
      const user = createUser({
        id: uuidv4(),
        email: 'test@example.com',
        passwordHash
      });
      await userRepository.save(user);

      const result = await authService.changePassword(
        {
          userId: user.id,
          currentPassword: 'OldPass123!',
          newPassword: 'NewPass456!'
        },
        deviceContext
      );

      expect(result.success).toBe(true);

      // Verify new password works
      const loginResult = await authService.login(
        { email: 'test@example.com', password: 'NewPass456!' },
        deviceContext
      );
      expect(loginResult.success).toBe(true);
    });

    it('should fail when current password is incorrect', async () => {
      const passwordHash = await passwordProvider.hash('OldPass123!');
      const user = createUser({
        id: uuidv4(),
        email: 'test@example.com',
        passwordHash
      });
      await userRepository.save(user);

      const result = await authService.changePassword(
        {
          userId: user.id,
          currentPassword: 'WrongPassword!',
          newPassword: 'NewPass456!'
        },
        deviceContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Current password is incorrect');
    });

    it('should fail when new password does not meet strength requirements', async () => {
      const passwordHash = await passwordProvider.hash('OldPass123!');
      const user = createUser({
        id: uuidv4(),
        email: 'test@example.com',
        passwordHash
      });
      await userRepository.save(user);

      const result = await authService.changePassword(
        {
          userId: user.id,
          currentPassword: 'OldPass123!',
          newPassword: 'weak'
        },
        deviceContext
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Password must');
    });

    it('should send password changed email', async () => {
      const passwordHash = await passwordProvider.hash('OldPass123!');
      const user = createUser({
        id: uuidv4(),
        email: 'test@example.com',
        passwordHash
      });
      await userRepository.save(user);

      await authService.changePassword(
        {
          userId: user.id,
          currentPassword: 'OldPass123!',
          newPassword: 'NewPass456!'
        },
        deviceContext
      );

      const emails = emailProvider.getSentEmails();
      expect(emails.length).toBe(1);
      expect(emails[0].type).toBe('password_changed');
      expect(emails[0].to).toBe('test@example.com');
    });

    it('should revoke all other sessions after password change', async () => {
      const passwordHash = await passwordProvider.hash('OldPass123!');
      const user = createUser({
        id: uuidv4(),
        email: 'test@example.com',
        passwordHash
      });
      await userRepository.save(user);

      // Create multiple sessions
      await authService.login({ email: 'test@example.com', password: 'OldPass123!' }, deviceContext);
      await authService.login({ email: 'test@example.com', password: 'OldPass123!' }, { ...deviceContext, ipAddress: '192.168.1.1' });

      await authService.changePassword(
        {
          userId: user.id,
          currentPassword: 'OldPass123!',
          newPassword: 'NewPass456!'
        },
        deviceContext
      );

      const sessions = await sessionRepository.findByUserId(user.id);
      const activeSessions = sessions.filter(s => s.revokedAt === null);
      expect(activeSessions.length).toBe(0);
    });
  });

  describe('requestPasswordReset', () => {
    it('should send password reset email for existing user', async () => {
      const user = createUser({
        id: uuidv4(),
        email: 'test@example.com',
        passwordHash: 'somehash'
      });
      await userRepository.save(user);

      const result = await authService.requestPasswordReset(
        { email: 'test@example.com' },
        deviceContext
      );

      expect(result.success).toBe(true);

      const emails = emailProvider.getSentEmails();
      expect(emails.length).toBe(1);
      expect(emails[0].type).toBe('password_reset');
    });

    it('should return success even for non-existent email (prevent enumeration)', async () => {
      const result = await authService.requestPasswordReset(
        { email: 'nonexistent@example.com' },
        deviceContext
      );

      expect(result.success).toBe(true);

      // But no email should be sent
      const emails = emailProvider.getSentEmails();
      expect(emails.length).toBe(0);
    });

    it('should log password reset requested security event', async () => {
      const user = createUser({
        id: uuidv4(),
        email: 'test@example.com',
        passwordHash: 'somehash'
      });
      await userRepository.save(user);

      await authService.requestPasswordReset(
        { email: 'test@example.com' },
        deviceContext
      );

      const events = await securityEventRepository.findByUserId(user.id);
      const resetEvent = events.find(e => e.eventType === 'password_reset_requested');
      expect(resetEvent).toBeDefined();
    });
  });
});
