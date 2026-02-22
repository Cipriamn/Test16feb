import { Request, Response, NextFunction } from 'express';
import { DeviceContext } from '../../application/services/AuthService';

export interface RequestWithDeviceContext extends Request {
  deviceContext: DeviceContext;
}

export function deviceContextMiddleware(req: RequestWithDeviceContext, res: Response, next: NextFunction): void {
  req.deviceContext = {
    deviceInfo: req.headers['user-agent'] || 'Unknown',
    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'Unknown',
    location: req.headers['x-geo-location'] as string | undefined
  };
  next();
}
