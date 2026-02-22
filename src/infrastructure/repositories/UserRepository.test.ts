import { InMemoryUserRepository } from './UserRepository';
import { createUser } from '../../domain/entities/User';

describe('InMemoryUserRepository', () => {
  let repository: InMemoryUserRepository;

  beforeEach(() => {
    repository = new InMemoryUserRepository();
  });

  describe('save and findById', () => {
    it('should save and retrieve user by ID', async () => {
      const user = createUser({
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hash'
      });

      await repository.save(user);
      const found = await repository.findById('user-123');

      expect(found).toEqual(user);
    });

    it('should return null for non-existent ID', async () => {
      const found = await repository.findById('non-existent');
      expect(found).toBeNull();
    });
  });

  describe('findByEmail', () => {
    it('should find user by email', async () => {
      const user = createUser({
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hash'
      });

      await repository.save(user);
      const found = await repository.findByEmail('test@example.com');

      expect(found).toEqual(user);
    });

    it('should return null for non-existent email', async () => {
      const found = await repository.findByEmail('nonexistent@example.com');
      expect(found).toBeNull();
    });
  });

  describe('findByOAuth', () => {
    it('should find user by OAuth credentials', async () => {
      const user = createUser({
        id: 'user-123',
        email: 'test@example.com',
        oauthProvider: 'google',
        oauthId: 'google-id-123'
      });

      await repository.save(user);
      const found = await repository.findByOAuth('google', 'google-id-123');

      expect(found).toEqual(user);
    });

    it('should return null for non-existent OAuth credentials', async () => {
      const found = await repository.findByOAuth('google', 'non-existent');
      expect(found).toBeNull();
    });

    it('should not find user with different provider', async () => {
      const user = createUser({
        id: 'user-123',
        email: 'test@example.com',
        oauthProvider: 'google',
        oauthId: 'google-id-123'
      });

      await repository.save(user);
      const found = await repository.findByOAuth('facebook', 'google-id-123');

      expect(found).toBeNull();
    });
  });

  describe('updatePassword', () => {
    it('should update user password', async () => {
      const user = createUser({
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'old-hash'
      });

      await repository.save(user);
      await repository.updatePassword('user-123', 'new-hash');

      const found = await repository.findById('user-123');
      expect(found!.passwordHash).toBe('new-hash');
    });

    it('should update updatedAt timestamp', async () => {
      const user = createUser({
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'old-hash'
      });
      const originalUpdatedAt = user.updatedAt;

      await repository.save(user);

      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));

      await repository.updatePassword('user-123', 'new-hash');

      const found = await repository.findById('user-123');
      expect(found!.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });

    it('should do nothing for non-existent user', async () => {
      // Should not throw when user doesn't exist
      await expect(repository.updatePassword('non-existent', 'new-hash')).resolves.not.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all users', async () => {
      const user1 = createUser({ id: 'user-1', email: 'test1@example.com' });
      const user2 = createUser({ id: 'user-2', email: 'test2@example.com' });

      await repository.save(user1);
      await repository.save(user2);
      repository.clear();

      expect(await repository.findById('user-1')).toBeNull();
      expect(await repository.findById('user-2')).toBeNull();
    });
  });
});
