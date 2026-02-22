import { Router, Request, Response, NextFunction } from 'express';
import { AuthService, LoginRequest } from '../../application/services/AuthService';
import { AuthenticatedRequest, createAuthMiddleware } from '../middleware/auth';
import { RequestWithDeviceContext, deviceContextMiddleware } from '../middleware/deviceContext';
import { ITokenProvider } from '../../infrastructure/providers/TokenProvider';

interface AuthRequest extends RequestWithDeviceContext, AuthenticatedRequest {}

export function createAuthRouter(authService: AuthService, tokenProvider: ITokenProvider): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware(tokenProvider);

  // Apply device context middleware to all routes
  router.use(deviceContextMiddleware as (req: Request, res: Response, next: NextFunction) => void);

  // POST /api/v1/auth/login
  router.post('/login', async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthRequest;
    try {
      const loginRequest: LoginRequest = {
        email: req.body.email,
        password: req.body.password,
        oauthToken: req.body.oauth_token,
        totpCode: req.body.totp_code,
        smsCode: req.body.sms_code
      };

      if (!loginRequest.email) {
        res.status(400).json({ error: 'Email is required' });
        return;
      }

      if (!loginRequest.password && !loginRequest.oauthToken) {
        res.status(400).json({ error: 'Password or OAuth token is required' });
        return;
      }

      const result = await authService.login(loginRequest, authReq.deviceContext);

      if (result.requiresTwoFactor) {
        res.status(200).json({
          requires_two_factor: true,
          two_factor_method: result.twoFactorMethod
        });
        return;
      }

      if (!result.success) {
        res.status(401).json({ error: result.error });
        return;
      }

      res.status(200).json({
        access_token: result.tokens!.accessToken,
        refresh_token: result.tokens!.refreshToken,
        token_type: 'Bearer',
        expires_in: 86400, // 24 hours in seconds
        session_id: result.sessionId
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/v1/auth/logout
  router.post('/logout', authMiddleware as (req: Request, res: Response, next: NextFunction) => void, async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthRequest;
    try {
      const sessionId = req.body.session_id;

      if (!sessionId) {
        res.status(400).json({ error: 'Session ID is required' });
        return;
      }

      const success = await authService.logout(sessionId, authReq.deviceContext);

      if (!success) {
        res.status(400).json({ error: 'Invalid session' });
        return;
      }

      res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/v1/auth/refresh
  router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthRequest;
    try {
      const refreshToken = req.body.refresh_token;

      if (!refreshToken) {
        res.status(400).json({ error: 'Refresh token is required' });
        return;
      }

      const result = await authService.refreshTokens(refreshToken, authReq.deviceContext);

      if (!result.success) {
        res.status(401).json({ error: result.error });
        return;
      }

      res.status(200).json({
        access_token: result.tokens!.accessToken,
        refresh_token: result.tokens!.refreshToken,
        token_type: 'Bearer',
        expires_in: 86400,
        session_id: result.sessionId
      });
    } catch (error) {
      console.error('Refresh error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/v1/auth/password/change
  router.post('/password/change', authMiddleware as (req: Request, res: Response, next: NextFunction) => void, async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthRequest;
    try {
      const { current_password, new_password } = req.body;

      if (!current_password || !new_password) {
        res.status(400).json({ error: 'Current password and new password are required' });
        return;
      }

      const result = await authService.changePassword(
        {
          userId: authReq.user!.sub,
          currentPassword: current_password,
          newPassword: new_password
        },
        authReq.deviceContext
      );

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.status(200).json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Password change error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/v1/auth/password/reset
  router.post('/password/reset', async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthRequest;
    try {
      const { email } = req.body;

      if (!email) {
        res.status(400).json({ error: 'Email is required' });
        return;
      }

      await authService.requestPasswordReset({ email }, authReq.deviceContext);

      // Always return success to prevent email enumeration
      res.status(200).json({ message: 'If the email exists, a reset link has been sent' });
    } catch (error) {
      console.error('Password reset error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
