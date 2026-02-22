import { v4 as uuidv4 } from 'uuid';
import { User } from '../../domain/entities/User';
import { AuthSession, createAuthSession, isSessionValid } from '../../domain/entities/AuthSession';
import { SecurityEvent, createSecurityEvent, SecurityEventType } from '../../domain/entities/SecurityEvent';
import { TokenPair } from '../../domain/value-objects/Tokens';
import { IUserRepository } from '../../infrastructure/repositories/UserRepository';
import { ISessionRepository } from '../../infrastructure/repositories/SessionRepository';
import { ISecurityEventRepository } from '../../infrastructure/repositories/SecurityEventRepository';
import { ITokenProvider } from '../../infrastructure/providers/TokenProvider';
import { IPasswordProvider } from '../../infrastructure/providers/PasswordProvider';
import { ITwoFactorProvider, ISMSProvider, generateSMSCode } from '../../infrastructure/providers/TwoFactorProvider';
import { IEmailProvider } from '../../infrastructure/providers/EmailProvider';
import { REFRESH_TOKEN_EXPIRATION_DAYS } from '../../domain/value-objects/Tokens';

export interface LoginRequest {
  email: string;
  password?: string;
  oauthToken?: string;
  totpCode?: string;
  smsCode?: string;
}

export interface DeviceContext {
  deviceInfo: string;
  ipAddress: string;
  location?: string;
}

export interface LoginResult {
  success: boolean;
  tokens?: TokenPair;
  sessionId?: string;
  requiresTwoFactor?: boolean;
  twoFactorMethod?: 'totp' | 'sms';
  error?: string;
}

export interface PasswordChangeRequest {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

export interface PasswordResetRequest {
  email: string;
}

// Store for pending 2FA challenges
const pendingTwoFactorChallenges = new Map<string, { userId: string; expiresAt: Date; smsCode?: string }>();

export class AuthService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly sessionRepository: ISessionRepository,
    private readonly securityEventRepository: ISecurityEventRepository,
    private readonly tokenProvider: ITokenProvider,
    private readonly passwordProvider: IPasswordProvider,
    private readonly twoFactorProvider: ITwoFactorProvider,
    private readonly smsProvider: ISMSProvider,
    private readonly emailProvider: IEmailProvider
  ) {}

  async login(request: LoginRequest, context: DeviceContext): Promise<LoginResult> {
    // Find user by email
    const user = await this.userRepository.findByEmail(request.email);
    if (!user) {
      await this.logSecurityEvent(uuidv4(), 'login_failed', context, { reason: 'user_not_found', email: request.email });
      return { success: false, error: 'Invalid credentials' };
    }

    // Verify credentials
    const credentialsValid = await this.verifyCredentials(user, request);
    if (!credentialsValid) {
      await this.logSecurityEvent(user.id, 'login_failed', context, { reason: 'invalid_credentials' });
      return { success: false, error: 'Invalid credentials' };
    }

    // Check if 2FA is required
    if (user.twoFactorEnabled) {
      // Check if we already have a pending challenge
      const challengeId = `${user.id}:${context.ipAddress}`;
      const existingChallenge = pendingTwoFactorChallenges.get(challengeId);

      if (!request.totpCode && !request.smsCode) {
        // No 2FA code provided, initiate 2FA challenge
        const twoFactorMethod = user.twoFactorSecret ? 'totp' : 'sms';

        if (twoFactorMethod === 'sms' && user.smsPhoneNumber) {
          const smsCode = generateSMSCode();
          await this.smsProvider.sendCode(user.smsPhoneNumber, smsCode);
          pendingTwoFactorChallenges.set(challengeId, {
            userId: user.id,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
            smsCode
          });
        } else {
          pendingTwoFactorChallenges.set(challengeId, {
            userId: user.id,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000)
          });
        }

        return {
          success: false,
          requiresTwoFactor: true,
          twoFactorMethod
        };
      }

      // Verify 2FA code
      const twoFactorValid = await this.verifyTwoFactor(user, request, existingChallenge?.smsCode);
      if (!twoFactorValid) {
        await this.logSecurityEvent(user.id, 'login_failed', context, { reason: 'invalid_2fa_code' });
        return { success: false, error: 'Invalid two-factor authentication code' };
      }

      // Clear the challenge
      pendingTwoFactorChallenges.delete(challengeId);
    }

    // Create session and tokens
    const sessionId = uuidv4();
    const tokens = this.tokenProvider.generateTokenPair(user.id, user.email, sessionId);

    const session = createAuthSession({
      id: sessionId,
      userId: user.id,
      refreshToken: tokens.refreshToken,
      deviceInfo: context.deviceInfo,
      ipAddress: context.ipAddress,
      location: context.location,
      expiresAt: tokens.refreshTokenExpiresAt
    });

    await this.sessionRepository.save(session);
    await this.logSecurityEvent(user.id, 'login_success', context);

    return {
      success: true,
      tokens,
      sessionId
    };
  }

  async logout(sessionId: string, context: DeviceContext): Promise<boolean> {
    const session = await this.sessionRepository.findById(sessionId);
    if (!session || session.revokedAt !== null) {
      return false;
    }

    await this.sessionRepository.revoke(sessionId);
    await this.logSecurityEvent(session.userId, 'logout', context, { sessionId });

    return true;
  }

  async refreshTokens(refreshToken: string, context: DeviceContext): Promise<LoginResult> {
    const payload = this.tokenProvider.verifyRefreshToken(refreshToken);
    if (!payload) {
      return { success: false, error: 'Invalid refresh token' };
    }

    const session = await this.sessionRepository.findById(payload.sessionId);
    if (!session || !isSessionValid(session) || session.refreshToken !== refreshToken) {
      return { success: false, error: 'Session expired or invalid' };
    }

    const user = await this.userRepository.findById(payload.sub);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Revoke old session and create new one
    await this.sessionRepository.revoke(session.id);

    const newSessionId = uuidv4();
    const tokens = this.tokenProvider.generateTokenPair(user.id, user.email, newSessionId);

    const newSession = createAuthSession({
      id: newSessionId,
      userId: user.id,
      refreshToken: tokens.refreshToken,
      deviceInfo: context.deviceInfo,
      ipAddress: context.ipAddress,
      location: context.location,
      expiresAt: tokens.refreshTokenExpiresAt
    });

    await this.sessionRepository.save(newSession);

    return {
      success: true,
      tokens,
      sessionId: newSessionId
    };
  }

  async changePassword(request: PasswordChangeRequest, context: DeviceContext): Promise<{ success: boolean; error?: string }> {
    const user = await this.userRepository.findById(request.userId);
    if (!user || !user.passwordHash) {
      return { success: false, error: 'User not found' };
    }

    // Verify current password
    const currentPasswordValid = await this.passwordProvider.compare(request.currentPassword, user.passwordHash);
    if (!currentPasswordValid) {
      return { success: false, error: 'Current password is incorrect' };
    }

    // Validate new password strength
    const strengthValidation = this.passwordProvider.validateStrength(request.newPassword);
    if (!strengthValidation.valid) {
      return { success: false, error: strengthValidation.errors.join('. ') };
    }

    // Hash and save new password
    const newHash = await this.passwordProvider.hash(request.newPassword);
    await this.userRepository.updatePassword(user.id, newHash);

    // Revoke all other sessions
    await this.sessionRepository.revokeAllForUser(user.id);

    // Log event and send email
    await this.logSecurityEvent(user.id, 'password_changed', context);
    await this.emailProvider.sendPasswordChangedEmail(user.email);

    return { success: true };
  }

  async requestPasswordReset(request: PasswordResetRequest, context: DeviceContext): Promise<{ success: boolean }> {
    const user = await this.userRepository.findByEmail(request.email);

    // Always return success to prevent email enumeration
    if (!user) {
      return { success: true };
    }

    const resetToken = uuidv4();
    // In a real implementation, store the reset token with expiration

    await this.emailProvider.sendPasswordResetEmail(user.email, resetToken);
    await this.logSecurityEvent(user.id, 'password_reset_requested', context);

    return { success: true };
  }

  private async verifyCredentials(user: User, request: LoginRequest): Promise<boolean> {
    // Email/password authentication
    if (request.password && user.passwordHash) {
      return this.passwordProvider.compare(request.password, user.passwordHash);
    }

    // OAuth authentication (simplified for MVP)
    if (request.oauthToken && user.oauthProvider) {
      // In a real implementation, validate the OAuth token with the provider
      // For MVP, we assume the token is valid if it matches the expected format
      return request.oauthToken.length > 10;
    }

    return false;
  }

  private async verifyTwoFactor(user: User, request: LoginRequest, expectedSmsCode?: string): Promise<boolean> {
    // TOTP verification
    if (request.totpCode && user.twoFactorSecret) {
      return this.twoFactorProvider.verifyTOTP(user.twoFactorSecret, request.totpCode);
    }

    // SMS verification
    if (request.smsCode && expectedSmsCode) {
      return request.smsCode === expectedSmsCode;
    }

    return false;
  }

  private async logSecurityEvent(
    userId: string,
    eventType: SecurityEventType,
    context: DeviceContext,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    const event = createSecurityEvent({
      id: uuidv4(),
      userId,
      eventType,
      deviceInfo: context.deviceInfo,
      ipAddress: context.ipAddress,
      location: context.location,
      metadata
    });
    await this.securityEventRepository.save(event);
  }

  // For testing: clear pending challenges
  static clearPendingChallenges(): void {
    pendingTwoFactorChallenges.clear();
  }
}
