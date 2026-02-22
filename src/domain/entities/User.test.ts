import { createUser } from './User';

describe('User', () => {
  describe('createUser', () => {
    it('should create user with required fields', () => {
      const user = createUser({
        id: 'user-123',
        email: 'test@example.com'
      });

      expect(user.id).toBe('user-123');
      expect(user.email).toBe('test@example.com');
      expect(user.passwordHash).toBeNull();
      expect(user.oauthProvider).toBeNull();
      expect(user.oauthId).toBeNull();
      expect(user.twoFactorEnabled).toBe(false);
      expect(user.twoFactorSecret).toBeNull();
      expect(user.smsPhoneNumber).toBeNull();
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
    });

    it('should create user with password', () => {
      const user = createUser({
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed-password-123'
      });

      expect(user.passwordHash).toBe('hashed-password-123');
    });

    it('should create user with OAuth credentials', () => {
      const user = createUser({
        id: 'user-123',
        email: 'test@example.com',
        oauthProvider: 'google',
        oauthId: 'google-oauth-id'
      });

      expect(user.oauthProvider).toBe('google');
      expect(user.oauthId).toBe('google-oauth-id');
    });

    it('should create user with 2FA enabled', () => {
      const user = createUser({
        id: 'user-123',
        email: 'test@example.com',
        twoFactorEnabled: true,
        twoFactorSecret: 'JBSWY3DPEHPK3PXP'
      });

      expect(user.twoFactorEnabled).toBe(true);
      expect(user.twoFactorSecret).toBe('JBSWY3DPEHPK3PXP');
    });

    it('should create user with SMS phone number', () => {
      const user = createUser({
        id: 'user-123',
        email: 'test@example.com',
        smsPhoneNumber: '+1234567890'
      });

      expect(user.smsPhoneNumber).toBe('+1234567890');
    });
  });
});
