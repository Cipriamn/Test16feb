import { Router, Request, Response } from 'express';
import { ConnectionService } from '../../application/services/ConnectionService';

export function createWebhookRoutes(
  connectionService: ConnectionService
): Router {
  const router = Router();

  // POST /api/v1/webhooks/plaid - Handle Plaid webhooks
  router.post(
    '/plaid',
    async (req: Request, res: Response) => {
      const {
        webhook_type,
        webhook_code,
        item_id,
        error
      } = req.body as {
        webhook_type?: string;
        webhook_code?: string;
        item_id?: string;
        error?: { error_code: string; error_message: string };
      };

      if (!webhook_type || !webhook_code) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['webhook_type', 'webhook_code']
        });
      }

      console.log(`[Webhook] Received Plaid webhook: ${webhook_type}/${webhook_code}`);

      // Handle specific webhook types
      if (webhook_type === 'ITEM' && webhook_code === 'ITEM_LOGIN_REQUIRED') {
        // User needs to re-authenticate their bank connection
        const result = await connectionService.handlePlaidWebhook(
          webhook_type,
          webhook_code,
          item_id || ''
        );

        return res.json({
          received: true,
          action: result.action
        });
      }

      if (webhook_type === 'TRANSACTIONS') {
        // Transaction updates available
        const result = await connectionService.handlePlaidWebhook(
          webhook_type,
          webhook_code,
          item_id || ''
        );

        return res.json({
          received: true,
          action: result.action
        });
      }

      // Acknowledge all other webhooks
      return res.json({
        received: true,
        action: 'acknowledged'
      });
    }
  );

  return router;
}
