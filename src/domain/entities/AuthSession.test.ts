import { createAuthSession, isSessionValid, AuthSession } from './AuthSession';

describe('AuthSession', () => {
  describe('createAuthSession', () => {
    it('should create session with all required fields', () => {
      const session = createAuthSession({
        id: 'session-123',
        userId: 'user-456',
        refreshToken: 'token-789',
        deviceInfo: 'Chrome/100',
        ipAddress: '192.168.1.1',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      expect(session.id).toBe('session-123');
      expect(session.userId).toBe('user-456');
      expect(session.refreshToken).toBe('token-789');
      expect(session.deviceInfo).toBe('Chrome/100');
      expect(session.ipAddress).toBe('192.168.1.1');
      expect(session.location).toBeNull();
      expect(session.revokedAt).toBeNull();
      expect(session.createdAt).toBeInstanceOf(Date);
    });

    it('should set optional location', () => {
      const session = createAuthSession({
        id: 'session-123',
        userId: 'user-456',
        refreshToken: 'token-789',
        deviceInfo: 'Chrome/100',
        ipAddress: '192.168.1.1',
        location: 'New York, USA',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      expect(session.location).toBe('New York, USA');
    });
  });

  describe('isSessionValid', () => {
    it('should return true for valid session', () => {
      const session = createAuthSession({
        id: 'session-123',
        userId: 'user-456',
        refreshToken: 'token-789',
        deviceInfo: 'Chrome/100',
        ipAddress: '192.168.1.1',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      expect(isSessionValid(session)).toBe(true);
    });

    it('should return false for revoked session', () => {
      const session = createAuthSession({
        id: 'session-123',
        userId: 'user-456',
        refreshToken: 'token-789',
        deviceInfo: 'Chrome/100',
        ipAddress: '192.168.1.1',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
      session.revokedAt = new Date();

      expect(isSessionValid(session)).toBe(false);
    });

    it('should return false for expired session', () => {
      const session = createAuthSession({
        id: 'session-123',
        userId: 'user-456',
        refreshToken: 'token-789',
        deviceInfo: 'Chrome/100',
        ipAddress: '192.168.1.1',
        expiresAt: new Date(Date.now() - 1000) // Expired 1 second ago
      });

      expect(isSessionValid(session)).toBe(false);
    });
  });
});
