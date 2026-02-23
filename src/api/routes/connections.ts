import { Router, Request, Response, NextFunction } from 'express';
import { ConnectionService } from '../../application/services/ConnectionService';
import { AuthenticatedRequest, createAuthMiddleware } from '../middleware/auth';
import { ITokenProvider } from '../../infrastructure/providers/TokenProvider';

export function createConnectionRoutes(
  connectionService: ConnectionService,
  tokenProvider: ITokenProvider
): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware(tokenProvider);

  // POST /api/v1/connections/plaid/link-token - Create Plaid Link token
  router.post(
    '/plaid/link-token',
    authMiddleware as (req: Request, res: Response, next: NextFunction) => void,
    async (req: Request, res: Response) => {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?.sub;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const result = await connectionService.createLinkToken(userId);

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      return res.json({
        link_token: result.linkToken,
        expiration: result.expiration
      });
    }
  );

  // POST /api/v1/connections/plaid/exchange - Exchange public token for access token
  router.post(
    '/plaid/exchange',
    authMiddleware as (req: Request, res: Response, next: NextFunction) => void,
    async (req: Request, res: Response) => {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?.sub;
      const { public_token, institution_id } = req.body as {
        public_token?: string;
        institution_id?: string;
      };

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!public_token || !institution_id) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['public_token', 'institution_id']
        });
      }

      const userAgent = req.headers['user-agent'];
      const deviceInfo = {
        ip: String(req.ip || 'unknown'),
        userAgent: Array.isArray(userAgent) ? userAgent[0] : (userAgent || 'unknown')
      };

      const result = await connectionService.exchangePublicToken(
        userId,
        public_token,
        institution_id,
        deviceInfo
      );

      if (!result.success) {
        if (result.error?.includes('INVALID_PUBLIC_TOKEN')) {
          return res.status(400).json({ error: 'Invalid public token' });
        }
        return res.status(500).json({ error: result.error });
      }

      return res.status(201).json({
        success: true,
        connection: result.connection
      });
    }
  );

  // GET /api/v1/connections - List all connections for user
  router.get(
    '/',
    authMiddleware as (req: Request, res: Response, next: NextFunction) => void,
    async (req: Request, res: Response) => {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?.sub;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const result = await connectionService.listConnections(userId);

      if (!result.success) {
        return res.status(500).json({ error: result.error });
      }

      return res.json({ connections: result.connections });
    }
  );

  // POST /api/v1/connections/:id/refresh - Manual sync
  router.post(
    '/:id/refresh',
    authMiddleware as (req: Request, res: Response, next: NextFunction) => void,
    async (req: Request, res: Response) => {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?.sub;
      const paramId = req.params.id;
      const connectionId = Array.isArray(paramId) ? paramId[0] : paramId;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userAgent = req.headers['user-agent'];
      const deviceInfo = {
        ip: String(req.ip || 'unknown'),
        userAgent: Array.isArray(userAgent) ? userAgent[0] : (userAgent || 'unknown')
      };

      const result = await connectionService.refreshConnection(
        userId,
        connectionId,
        deviceInfo
      );

      if (!result.success) {
        if (result.error === 'Connection not found') {
          return res.status(404).json({ error: result.error });
        }
        if (result.error === 'Connection is disconnected') {
          return res.status(400).json({ error: result.error });
        }
        // Sync failure - return 200 with error info and updated connection
        return res.status(200).json({
          success: false,
          error: result.error,
          connection: result.connection
        });
      }

      return res.json({
        success: true,
        connection: result.connection
      });
    }
  );

  // DELETE /api/v1/connections/:id - Disconnect
  router.delete(
    '/:id',
    authMiddleware as (req: Request, res: Response, next: NextFunction) => void,
    async (req: Request, res: Response) => {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?.sub;
      const paramId = req.params.id;
      const connectionId = Array.isArray(paramId) ? paramId[0] : paramId;
      const { confirmed } = req.body as { confirmed?: boolean };

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userAgent = req.headers['user-agent'];
      const deviceInfo = {
        ip: String(req.ip || 'unknown'),
        userAgent: Array.isArray(userAgent) ? userAgent[0] : (userAgent || 'unknown')
      };

      const result = await connectionService.disconnectConnection(
        userId,
        connectionId,
        confirmed === true,
        deviceInfo
      );

      if (!result.success) {
        if (result.error === 'Connection not found') {
          return res.status(404).json({ error: result.error });
        }
        if (result.error === 'Confirmation required') {
          return res.status(400).json({
            error: result.error,
            message: 'Request body must include { confirmed: true }'
          });
        }
        return res.status(500).json({ error: result.error });
      }

      return res.json({
        success: true,
        subscriptionsAffected: result.subscriptionsAffected
      });
    }
  );

  return router;
}
