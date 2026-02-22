import { JWTTokenProvider } from './TokenProvider';
import { JWT_EXPIRATION_HOURS, REFRESH_TOKEN_EXPIRATION_DAYS } from '../../domain/value-objects/Tokens';

describe('JWTTokenProvider', () => {
  let tokenProvider: JWTTokenProvider;

  beforeEach(() => {
    tokenProvider = new JWTTokenProvider('test-access-secret', 'test-refresh-secret');
  });

  describe('generateTokenPair', () => {
    it('should generate access and refresh tokens', () => {
      const tokens = tokenProvider.generateTokenPair('user-123', 'test@example.com', 'session-456');

      expect(tokens.accessToken).toBeTruthy();
      expect(tokens.refreshToken).toBeTruthy();
      expect(tokens.accessToken).not.toBe(tokens.refreshToken);
    });

    it('should set correct expiration times', () => {
      // JWT uses seconds, so truncate to seconds for comparison
      const nowSec = Math.floor(Date.now() / 1000);
      const tokens = tokenProvider.generateTokenPair('user-123', 'test@example.com', 'session-456');

      // Access token expires in 24 hours (with 1 second tolerance)
      const expectedAccessExpSec = nowSec + JWT_EXPIRATION_HOURS * 60 * 60;
      const actualAccessExpSec = Math.floor(tokens.accessTokenExpiresAt.getTime() / 1000);
      expect(actualAccessExpSec).toBeGreaterThanOrEqual(expectedAccessExpSec - 1);
      expect(actualAccessExpSec).toBeLessThanOrEqual(expectedAccessExpSec + 1);

      // Refresh token expires in 30 days (with 1 second tolerance)
      const expectedRefreshExpSec = nowSec + REFRESH_TOKEN_EXPIRATION_DAYS * 24 * 60 * 60;
      const actualRefreshExpSec = Math.floor(tokens.refreshTokenExpiresAt.getTime() / 1000);
      expect(actualRefreshExpSec).toBeGreaterThanOrEqual(expectedRefreshExpSec - 1);
      expect(actualRefreshExpSec).toBeLessThanOrEqual(expectedRefreshExpSec + 1);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', () => {
      const tokens = tokenProvider.generateTokenPair('user-123', 'test@example.com', 'session-456');
      const payload = tokenProvider.verifyAccessToken(tokens.accessToken);

      expect(payload).not.toBeNull();
      expect(payload!.sub).toBe('user-123');
      expect(payload!.email).toBe('test@example.com');
    });

    it('should return null for invalid access token', () => {
      const payload = tokenProvider.verifyAccessToken('invalid-token');
      expect(payload).toBeNull();
    });

    it('should return null for token signed with wrong secret', () => {
      const otherProvider = new JWTTokenProvider('other-secret', 'other-refresh');
      const tokens = otherProvider.generateTokenPair('user-123', 'test@example.com', 'session-456');

      const payload = tokenProvider.verifyAccessToken(tokens.accessToken);
      expect(payload).toBeNull();
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', () => {
      const tokens = tokenProvider.generateTokenPair('user-123', 'test@example.com', 'session-456');
      const payload = tokenProvider.verifyRefreshToken(tokens.refreshToken);

      expect(payload).not.toBeNull();
      expect(payload!.sub).toBe('user-123');
      expect(payload!.sessionId).toBe('session-456');
    });

    it('should return null for invalid refresh token', () => {
      const payload = tokenProvider.verifyRefreshToken('invalid-token');
      expect(payload).toBeNull();
    });

    it('should not accept access token as refresh token', () => {
      const tokens = tokenProvider.generateTokenPair('user-123', 'test@example.com', 'session-456');
      const payload = tokenProvider.verifyRefreshToken(tokens.accessToken);
      expect(payload).toBeNull();
    });
  });
});
