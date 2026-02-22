import { ProfileService } from './ProfileService';
import { InMemoryUserRepository } from '../../infrastructure/repositories/UserRepository';
import { InMemorySessionRepository } from '../../infrastructure/repositories/SessionRepository';
import { MockEmailProvider } from '../../infrastructure/providers/EmailProvider';
import { MockPlaidProvider } from '../../infrastructure/providers/PlaidProvider';
import { createUser } from '../../domain/entities/User';

describe('ProfileService', () => {
  let profileService: ProfileService;
  let userRepository: InMemoryUserRepository;
  let sessionRepository: InMemorySessionRepository;
  let emailProvider: MockEmailProvider;
  let plaidProvider: MockPlaidProvider;

  beforeEach(() => {
    userRepository = new InMemoryUserRepository();
    sessionRepository = new InMemorySessionRepository();
    emailProvider = new MockEmailProvider();
    plaidProvider = new MockPlaidProvider();
    profileService = new ProfileService(
      userRepository,
      sessionRepository,
      emailProvider,
      plaidProvider
    );
  });

  afterEach(() => {
    userRepository.clear();
    sessionRepository.clear();
    emailProvider.clear();
    plaidProvider.clear();
  });

  describe('getProfile', () => {
    it('should return user profile for valid user', async () => {
      const user = createUser({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        phone: '+1234567890',
        timezone: 'America/New_York'
      });
      await userRepository.save(user);

      const result = await profileService.getProfile('user-1');

      expect(result.success).toBe(true);
      expect(result.profile).toBeDefined();
      expect(result.profile!.email).toBe('test@example.com');
      expect(result.profile!.name).toBe('Test User');
      expect(result.profile!.phone).toBe('+1234567890');
      expect(result.profile!.timezone).toBe('America/New_York');
    });

    it('should return error for non-existent user', async () => {
      const result = await profileService.getProfile('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });

    it('should return error for deleted user', async () => {
      const user = createUser({
        id: 'user-1',
        email: 'test@example.com'
      });
      await userRepository.save(user);
      await userRepository.softDelete('user-1');

      const result = await profileService.getProfile('user-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Account is scheduled for deletion');
    });
  });

  describe('updateProfile', () => {
    it('should update profile fields successfully', async () => {
      const user = createUser({
        id: 'user-1',
        email: 'test@example.com'
      });
      await userRepository.save(user);

      const result = await profileService.updateProfile('user-1', {
        name: 'Updated Name',
        phone: '+9876543210',
        address: '123 Main St',
        timezone: 'Europe/London',
        photoUrl: 'https://example.com/photo.jpg'
      });

      expect(result.success).toBe(true);
      expect(result.profile!.name).toBe('Updated Name');
      expect(result.profile!.phone).toBe('+9876543210');
      expect(result.profile!.address).toBe('123 Main St');
      expect(result.profile!.timezone).toBe('Europe/London');
      expect(result.profile!.photoUrl).toBe('https://example.com/photo.jpg');
    });

    it('should send verification email for email change', async () => {
      const user = createUser({
        id: 'user-1',
        email: 'old@example.com'
      });
      await userRepository.save(user);

      const result = await profileService.updateProfile('user-1', {
        email: 'new@example.com'
      });

      expect(result.success).toBe(true);
      expect(result.emailVerificationSent).toBe(true);
      expect(result.profile!.email).toBe('old@example.com'); // Still old email
      expect(result.profile!.pendingEmail).toBe('new@example.com');

      const sentEmails = emailProvider.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].type).toBe('email_verification');
      expect(sentEmails[0].to).toBe('new@example.com');
    });

    it('should reject email change if email already in use', async () => {
      const user1 = createUser({ id: 'user-1', email: 'user1@example.com' });
      const user2 = createUser({ id: 'user-2', email: 'user2@example.com' });
      await userRepository.save(user1);
      await userRepository.save(user2);

      const result = await profileService.updateProfile('user-1', {
        email: 'user2@example.com'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email already in use');
    });

    it('should return error for non-existent user', async () => {
      const result = await profileService.updateProfile('non-existent', {
        name: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });

    it('should return error for deleted user', async () => {
      const user = createUser({ id: 'user-1', email: 'test@example.com' });
      await userRepository.save(user);
      await userRepository.softDelete('user-1');

      const result = await profileService.updateProfile('user-1', {
        name: 'Test'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Account is scheduled for deletion');
    });

    it('should allow same email without verification', async () => {
      const user = createUser({
        id: 'user-1',
        email: 'test@example.com'
      });
      await userRepository.save(user);

      const result = await profileService.updateProfile('user-1', {
        email: 'test@example.com',
        name: 'New Name'
      });

      expect(result.success).toBe(true);
      expect(result.emailVerificationSent).toBeFalsy();
      expect(result.profile!.name).toBe('New Name');
    });
  });

  describe('verifyEmailChange', () => {
    it('should complete email change with valid token', async () => {
      const user = createUser({ id: 'user-1', email: 'old@example.com' });
      await userRepository.save(user);

      // Initiate email change
      await profileService.updateProfile('user-1', { email: 'new@example.com' });

      // Get the token from the updated user
      const updatedUser = await userRepository.findById('user-1');
      const token = updatedUser!.emailVerificationToken!;

      const result = await profileService.verifyEmailChange('user-1', token);

      expect(result.success).toBe(true);
      expect(result.profile!.email).toBe('new@example.com');
      expect(result.profile!.pendingEmail).toBeNull();
    });

    it('should reject invalid token', async () => {
      const user = createUser({ id: 'user-1', email: 'old@example.com' });
      await userRepository.save(user);
      await profileService.updateProfile('user-1', { email: 'new@example.com' });

      const result = await profileService.verifyEmailChange('user-1', 'invalid-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid verification token');
    });

    it('should reject when no pending email change', async () => {
      const user = createUser({ id: 'user-1', email: 'test@example.com' });
      await userRepository.save(user);

      const result = await profileService.verifyEmailChange('user-1', 'any-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No pending email change');
    });

    it('should reject expired token', async () => {
      const user = createUser({ id: 'user-1', email: 'old@example.com' });
      user.pendingEmail = 'new@example.com';
      user.emailVerificationToken = 'valid-token';
      user.emailVerificationExpiry = new Date(Date.now() - 1000); // Expired
      await userRepository.save(user);

      const result = await profileService.verifyEmailChange('user-1', 'valid-token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Verification token expired');
    });

    it('should return error for non-existent user', async () => {
      const result = await profileService.verifyEmailChange('non-existent', 'token');

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });
  });

  describe('initiateAccountDeletion', () => {
    it('should soft delete user with 7-day grace period', async () => {
      const user = createUser({ id: 'user-1', email: 'test@example.com' });
      await userRepository.save(user);

      const result = await profileService.initiateAccountDeletion('user-1');

      expect(result.success).toBe(true);
      expect(result.scheduledDeletionDate).toBeDefined();

      const deletedUser = await userRepository.findById('user-1');
      expect(deletedUser!.deletedAt).toBeDefined();
      expect(deletedUser!.deletionScheduledAt).toBeDefined();

      // Verify 7-day grace period
      const gracePeriod = deletedUser!.deletionScheduledAt!.getTime() - deletedUser!.deletedAt!.getTime();
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      expect(gracePeriod).toBe(sevenDays);
    });

    it('should revoke all Plaid connections', async () => {
      const user = createUser({ id: 'user-1', email: 'test@example.com' });
      await userRepository.save(user);

      plaidProvider.addConnection('user-1', {
        id: 'conn-1',
        institutionId: 'inst-1',
        institutionName: 'Test Bank',
        accessToken: 'token-1',
        createdAt: new Date()
      });
      plaidProvider.addConnection('user-1', {
        id: 'conn-2',
        institutionId: 'inst-2',
        institutionName: 'Another Bank',
        accessToken: 'token-2',
        createdAt: new Date()
      });

      const result = await profileService.initiateAccountDeletion('user-1');

      expect(result.success).toBe(true);
      expect(result.connectionsRevoked).toBe(2);

      const connections = await plaidProvider.getConnections('user-1');
      expect(connections).toHaveLength(0);

      const revokedConnections = plaidProvider.getRevokedConnections('user-1');
      expect(revokedConnections).toHaveLength(2);
    });

    it('should send deletion confirmation email', async () => {
      const user = createUser({ id: 'user-1', email: 'test@example.com' });
      await userRepository.save(user);

      await profileService.initiateAccountDeletion('user-1');

      const sentEmails = emailProvider.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].type).toBe('account_deletion');
      expect(sentEmails[0].to).toBe('test@example.com');
    });

    it('should return error for non-existent user', async () => {
      const result = await profileService.initiateAccountDeletion('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });

    it('should return error if already deleted', async () => {
      const user = createUser({ id: 'user-1', email: 'test@example.com' });
      await userRepository.save(user);
      await userRepository.softDelete('user-1');

      const result = await profileService.initiateAccountDeletion('user-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Account is already scheduled for deletion');
    });
  });

  describe('cancelAccountDeletion', () => {
    it('should restore account within grace period', async () => {
      const user = createUser({ id: 'user-1', email: 'test@example.com' });
      await userRepository.save(user);
      await userRepository.softDelete('user-1');

      const result = await profileService.cancelAccountDeletion('user-1');

      expect(result.success).toBe(true);

      const restoredUser = await userRepository.findById('user-1');
      expect(restoredUser!.deletedAt).toBeNull();
      expect(restoredUser!.deletionScheduledAt).toBeNull();
    });

    it('should send account restored email', async () => {
      const user = createUser({ id: 'user-1', email: 'test@example.com' });
      await userRepository.save(user);
      await userRepository.softDelete('user-1');

      await profileService.cancelAccountDeletion('user-1');

      const sentEmails = emailProvider.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0].type).toBe('account_restored');
      expect(sentEmails[0].to).toBe('test@example.com');
    });

    it('should return error for non-existent user', async () => {
      const result = await profileService.cancelAccountDeletion('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });

    it('should return error if not scheduled for deletion', async () => {
      const user = createUser({ id: 'user-1', email: 'test@example.com' });
      await userRepository.save(user);

      const result = await profileService.cancelAccountDeletion('user-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Account is not scheduled for deletion');
    });

    it('should return error if grace period expired', async () => {
      const user = createUser({ id: 'user-1', email: 'test@example.com' });
      user.deletedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000); // 8 days ago
      user.deletionScheduledAt = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
      await userRepository.save(user);

      const result = await profileService.cancelAccountDeletion('user-1');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Grace period has expired');
    });
  });

  describe('processScheduledDeletions', () => {
    it('should hard delete users past grace period', async () => {
      // User 1: deletion scheduled for yesterday (should be deleted)
      const user1 = createUser({ id: 'user-1', email: 'user1@example.com' });
      user1.deletedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      user1.deletionScheduledAt = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      await userRepository.save(user1);

      // User 2: deletion scheduled for tomorrow (should NOT be deleted)
      const user2 = createUser({ id: 'user-2', email: 'user2@example.com' });
      user2.deletedAt = new Date();
      user2.deletionScheduledAt = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
      await userRepository.save(user2);

      // User 3: not scheduled for deletion
      const user3 = createUser({ id: 'user-3', email: 'user3@example.com' });
      await userRepository.save(user3);

      const deletedCount = await profileService.processScheduledDeletions();

      expect(deletedCount).toBe(1);
      expect(await userRepository.findById('user-1')).toBeNull();
      expect(await userRepository.findById('user-2')).not.toBeNull();
      expect(await userRepository.findById('user-3')).not.toBeNull();
    });

    it('should return 0 when no users to delete', async () => {
      const user = createUser({ id: 'user-1', email: 'test@example.com' });
      await userRepository.save(user);

      const deletedCount = await profileService.processScheduledDeletions();

      expect(deletedCount).toBe(0);
    });
  });
});
