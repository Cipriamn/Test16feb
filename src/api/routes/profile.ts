import { Router, Request, Response, NextFunction } from 'express';
import { ProfileService, UpdateProfileRequest } from '../../application/services/ProfileService';
import { AuthenticatedRequest, createAuthMiddleware } from '../middleware/auth';
import { ITokenProvider } from '../../infrastructure/providers/TokenProvider';

export function createProfileRouter(profileService: ProfileService, tokenProvider: ITokenProvider): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware(tokenProvider);

  // GET /api/v1/users/me - Fetch user profile
  router.get('/me', authMiddleware as (req: Request, res: Response, next: NextFunction) => void, async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    try {
      const result = await profileService.getProfile(authReq.user!.sub);

      if (!result.success) {
        res.status(404).json({ error: result.error });
        return;
      }

      res.status(200).json(result.profile);
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // PATCH /api/v1/users/me - Update user profile
  router.patch('/me', authMiddleware as (req: Request, res: Response, next: NextFunction) => void, async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    try {
      const updateRequest: UpdateProfileRequest = {
        name: req.body.name,
        phone: req.body.phone,
        address: req.body.address,
        timezone: req.body.timezone,
        photoUrl: req.body.photo_url,
        email: req.body.email
      };

      // Remove undefined values
      Object.keys(updateRequest).forEach(key => {
        if ((updateRequest as Record<string, unknown>)[key] === undefined) {
          delete (updateRequest as Record<string, unknown>)[key];
        }
      });

      const result = await profileService.updateProfile(authReq.user!.sub, updateRequest);

      if (!result.success) {
        if (result.error === 'Email already in use') {
          res.status(409).json({ error: result.error });
          return;
        }
        res.status(400).json({ error: result.error });
        return;
      }

      const response: Record<string, unknown> = { ...result.profile };
      if (result.emailVerificationSent) {
        response.email_verification_sent = true;
        response.message = 'Profile updated. Please verify your new email address.';
      }

      res.status(200).json(response);
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/v1/users/me/verify-email - Verify email change
  router.post('/me/verify-email', authMiddleware as (req: Request, res: Response, next: NextFunction) => void, async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    try {
      const { token } = req.body;

      if (!token) {
        res.status(400).json({ error: 'Verification token is required' });
        return;
      }

      const result = await profileService.verifyEmailChange(authReq.user!.sub, token);

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.status(200).json({
        message: 'Email updated successfully',
        profile: result.profile
      });
    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // DELETE /api/v1/users/me - Initiate account deletion
  router.delete('/me', authMiddleware as (req: Request, res: Response, next: NextFunction) => void, async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    try {
      const result = await profileService.initiateAccountDeletion(authReq.user!.sub);

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.status(200).json({
        message: 'Account deletion initiated',
        scheduled_deletion_date: result.scheduledDeletionDate?.toISOString(),
        connections_revoked: result.connectionsRevoked,
        grace_period_days: 7
      });
    } catch (error) {
      console.error('Account deletion error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // POST /api/v1/users/me/undelete - Cancel account deletion
  router.post('/me/undelete', authMiddleware as (req: Request, res: Response, next: NextFunction) => void, async (req: Request, res: Response): Promise<void> => {
    const authReq = req as AuthenticatedRequest;
    try {
      const result = await profileService.cancelAccountDeletion(authReq.user!.sub);

      if (!result.success) {
        if (result.error === 'Grace period has expired') {
          res.status(410).json({ error: result.error });
          return;
        }
        res.status(400).json({ error: result.error });
        return;
      }

      res.status(200).json({
        message: 'Account deletion cancelled. Your account has been restored.'
      });
    } catch (error) {
      console.error('Account undelete error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
