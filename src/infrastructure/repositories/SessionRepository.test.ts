import { InMemorySessionRepository } from './SessionRepository';
import { createAuthSession } from '../../domain/entities/AuthSession';

describe('InMemorySessionRepository', () => {
  let repository: InMemorySessionRepository;

  beforeEach(() => {
    repository = new InMemorySessionRepository();
  });

  describe('save and findById', () => {
    it('should save and retrieve session by ID', async () => {
      const session = createAuthSession({
        id: 'session-123',
        userId: 'user-456',
        refreshToken: 'token-789',
        deviceInfo: 'Chrome/100',
        ipAddress: '192.168.1.1',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      await repository.save(session);
      const found = await repository.findById('session-123');

      expect(found).toEqual(session);
    });

    it('should return null for non-existent ID', async () => {
      const found = await repository.findById('non-existent');
      expect(found).toBeNull();
    });
  });

  describe('findByRefreshToken', () => {
    it('should find session by refresh token', async () => {
      const session = createAuthSession({
        id: 'session-123',
        userId: 'user-456',
        refreshToken: 'unique-refresh-token',
        deviceInfo: 'Chrome/100',
        ipAddress: '192.168.1.1',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      await repository.save(session);
      const found = await repository.findByRefreshToken('unique-refresh-token');

      expect(found).toEqual(session);
    });

    it('should return null for non-existent refresh token', async () => {
      const found = await repository.findByRefreshToken('non-existent');
      expect(found).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('should find all sessions for user', async () => {
      const session1 = createAuthSession({
        id: 'session-1',
        userId: 'user-123',
        refreshToken: 'token-1',
        deviceInfo: 'Chrome/100',
        ipAddress: '192.168.1.1',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      const session2 = createAuthSession({
        id: 'session-2',
        userId: 'user-123',
        refreshToken: 'token-2',
        deviceInfo: 'Firefox/90',
        ipAddress: '192.168.1.2',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      const session3 = createAuthSession({
        id: 'session-3',
        userId: 'other-user',
        refreshToken: 'token-3',
        deviceInfo: 'Safari/15',
        ipAddress: '192.168.1.3',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      await repository.save(session1);
      await repository.save(session2);
      await repository.save(session3);

      const userSessions = await repository.findByUserId('user-123');

      expect(userSessions).toHaveLength(2);
      expect(userSessions.map(s => s.id).sort()).toEqual(['session-1', 'session-2']);
    });
  });

  describe('revoke', () => {
    it('should revoke session', async () => {
      const session = createAuthSession({
        id: 'session-123',
        userId: 'user-456',
        refreshToken: 'token-789',
        deviceInfo: 'Chrome/100',
        ipAddress: '192.168.1.1',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      await repository.save(session);
      await repository.revoke('session-123');

      const found = await repository.findById('session-123');
      expect(found!.revokedAt).not.toBeNull();
    });

    it('should do nothing for non-existent session', async () => {
      // Should not throw when session doesn't exist
      await expect(repository.revoke('non-existent')).resolves.not.toThrow();
    });
  });

  describe('revokeAllForUser', () => {
    it('should revoke all sessions for user', async () => {
      const session1 = createAuthSession({
        id: 'session-1',
        userId: 'user-123',
        refreshToken: 'token-1',
        deviceInfo: 'Chrome/100',
        ipAddress: '192.168.1.1',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      const session2 = createAuthSession({
        id: 'session-2',
        userId: 'user-123',
        refreshToken: 'token-2',
        deviceInfo: 'Firefox/90',
        ipAddress: '192.168.1.2',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      await repository.save(session1);
      await repository.save(session2);
      await repository.revokeAllForUser('user-123');

      const sessions = await repository.findByUserId('user-123');
      expect(sessions.every(s => s.revokedAt !== null)).toBe(true);
    });

    it('should not revoke already revoked sessions', async () => {
      const session = createAuthSession({
        id: 'session-1',
        userId: 'user-123',
        refreshToken: 'token-1',
        deviceInfo: 'Chrome/100',
        ipAddress: '192.168.1.1',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
      session.revokedAt = new Date('2024-01-01');

      await repository.save(session);
      await repository.revokeAllForUser('user-123');

      const found = await repository.findById('session-1');
      // Should keep original revokedAt, not update it
      expect(found!.revokedAt!.toISOString()).toContain('2024-01-01');
    });
  });

  describe('clear', () => {
    it('should clear all sessions', async () => {
      const session = createAuthSession({
        id: 'session-123',
        userId: 'user-456',
        refreshToken: 'token-789',
        deviceInfo: 'Chrome/100',
        ipAddress: '192.168.1.1',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      await repository.save(session);
      repository.clear();

      expect(await repository.findById('session-123')).toBeNull();
    });
  });
});
