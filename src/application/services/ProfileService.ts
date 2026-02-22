import { v4 as uuidv4 } from 'uuid';
import { User, UserProfile, toUserProfile } from '../../domain/entities/User';
import { IUserRepository } from '../../infrastructure/repositories/UserRepository';
import { IEmailProvider } from '../../infrastructure/providers/EmailProvider';
import { IPlaidProvider } from '../../infrastructure/providers/PlaidProvider';
import { ISessionRepository } from '../../infrastructure/repositories/SessionRepository';

export interface UpdateProfileRequest {
  name?: string;
  phone?: string;
  address?: string;
  timezone?: string;
  photoUrl?: string;
  email?: string;
}

export interface ProfileResult {
  success: boolean;
  profile?: UserProfile;
  error?: string;
  emailVerificationSent?: boolean;
}

export interface DeletionResult {
  success: boolean;
  error?: string;
  scheduledDeletionDate?: Date;
  connectionsRevoked?: number;
}

export interface UndeleteResult {
  success: boolean;
  error?: string;
}

export class ProfileService {
  constructor(
    private userRepository: IUserRepository,
    private sessionRepository: ISessionRepository,
    private emailProvider: IEmailProvider,
    private plaidProvider: IPlaidProvider
  ) {}

  async getProfile(userId: string): Promise<ProfileResult> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (user.deletedAt) {
      return { success: false, error: 'Account is scheduled for deletion' };
    }

    return { success: true, profile: toUserProfile(user) };
  }

  async updateProfile(userId: string, request: UpdateProfileRequest): Promise<ProfileResult> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (user.deletedAt) {
      return { success: false, error: 'Account is scheduled for deletion' };
    }

    let emailVerificationSent = false;

    // Handle email change - requires verification
    if (request.email && request.email !== user.email) {
      // Check if email is already in use
      const existingUser = await this.userRepository.findByEmail(request.email);
      if (existingUser && existingUser.id !== userId) {
        return { success: false, error: 'Email already in use' };
      }

      // Generate verification token
      const verificationToken = uuidv4();
      const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      user.pendingEmail = request.email;
      user.emailVerificationToken = verificationToken;
      user.emailVerificationExpiry = verificationExpiry;

      // Send verification email
      await this.emailProvider.sendEmailVerificationEmail(request.email, verificationToken);
      emailVerificationSent = true;
    }

    // Update other profile fields
    if (request.name !== undefined) user.name = request.name;
    if (request.phone !== undefined) user.phone = request.phone;
    if (request.address !== undefined) user.address = request.address;
    if (request.timezone !== undefined) user.timezone = request.timezone;
    if (request.photoUrl !== undefined) user.photoUrl = request.photoUrl;

    await this.userRepository.update(user);

    return {
      success: true,
      profile: toUserProfile(user),
      emailVerificationSent
    };
  }

  async verifyEmailChange(userId: string, token: string): Promise<ProfileResult> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (!user.pendingEmail || !user.emailVerificationToken) {
      return { success: false, error: 'No pending email change' };
    }

    if (user.emailVerificationToken !== token) {
      return { success: false, error: 'Invalid verification token' };
    }

    if (user.emailVerificationExpiry && user.emailVerificationExpiry < new Date()) {
      return { success: false, error: 'Verification token expired' };
    }

    // Apply the email change
    user.email = user.pendingEmail;
    user.pendingEmail = null;
    user.emailVerificationToken = null;
    user.emailVerificationExpiry = null;

    await this.userRepository.update(user);

    return { success: true, profile: toUserProfile(user) };
  }

  async initiateAccountDeletion(userId: string): Promise<DeletionResult> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (user.deletedAt) {
      return { success: false, error: 'Account is already scheduled for deletion' };
    }

    // Revoke all Plaid connections
    const connectionsRevoked = await this.plaidProvider.revokeAllConnections(userId);

    // Soft delete the user with 7-day grace period
    await this.userRepository.softDelete(userId);

    // Revoke all sessions
    await this.sessionRepository.revokeAllUserSessions(userId);

    const updatedUser = await this.userRepository.findById(userId);
    const scheduledDeletionDate = updatedUser?.deletionScheduledAt || undefined;

    // Generate cancellation link
    const cancellationToken = uuidv4();
    const cancellationLink = `/api/v1/users/me/undelete?token=${cancellationToken}`;

    // Send deletion confirmation email
    await this.emailProvider.sendAccountDeletionEmail(user.email, cancellationLink);

    return {
      success: true,
      scheduledDeletionDate,
      connectionsRevoked
    };
  }

  async cancelAccountDeletion(userId: string): Promise<UndeleteResult> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (!user.deletedAt) {
      return { success: false, error: 'Account is not scheduled for deletion' };
    }

    // Check if still within grace period
    if (user.deletionScheduledAt && user.deletionScheduledAt < new Date()) {
      return { success: false, error: 'Grace period has expired' };
    }

    // Restore the user
    await this.userRepository.restore(userId);

    // Send restoration confirmation email
    await this.emailProvider.sendAccountRestoredEmail(user.email);

    return { success: true };
  }

  async processScheduledDeletions(): Promise<number> {
    const now = new Date();
    const usersToDelete = await this.userRepository.findUsersScheduledForDeletion(now);

    let deletedCount = 0;
    for (const user of usersToDelete) {
      await this.userRepository.hardDelete(user.id);
      deletedCount++;
      console.log(`[ProfileService] Hard deleted user ${user.id}`);
    }

    return deletedCount;
  }
}
