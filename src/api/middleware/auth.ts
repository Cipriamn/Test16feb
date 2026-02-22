import { Request, Response, NextFunction } from 'express';
import { ITokenProvider } from '../../infrastructure/providers/TokenProvider';
import { JWTPayload } from '../../domain/value-objects/Tokens';

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

export function createAuthMiddleware(tokenProvider: ITokenProvider) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authorization header required' });
      return;
    }

    const token = authHeader.substring(7);
    const payload = tokenProvider.verifyAccessToken(token);

    if (!payload) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    req.user = payload;
    next();
  };
}
