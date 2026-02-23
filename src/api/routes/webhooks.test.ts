import request from 'supertest';
import { createApp } from '../../index';

describe('Webhook Routes', () => {
  let app: ReturnType<typeof createApp>['app'];
  let repos: ReturnType<typeof createApp>['repositories'];
  let providers: ReturnType<typeof createApp>['providers'];

  beforeEach(() => {
    const appSetup = createApp();
    app = appSetup.app;
    repos = appSetup.repositories;
    providers = appSetup.providers;
  });

  afterEach(() => {
    repos.userRepository.clear();
    repos.sessionRepository.clear();
    repos.connectionRepository.clear();
    repos.subscriptionRepository.clear();
    repos.securityEventRepository.clear();
    providers.plaidProvider.clear();
    providers.alertProvider.clear();
    providers.domainEventEmitter.clear();
  });

  describe('POST /api/v1/webhooks/plaid', () => {
    it('should return 400 without webhook_type', async () => {
      const response = await request(app)
        .post('/api/v1/webhooks/plaid')
        .send({ webhook_code: 'TEST' })
        .expect(400);

      expect(response.body.error).toBe('Missing required fields');
    });

    it('should return 400 without webhook_code', async () => {
      const response = await request(app)
        .post('/api/v1/webhooks/plaid')
        .send({ webhook_type: 'ITEM' })
        .expect(400);

      expect(response.body.error).toBe('Missing required fields');
    });

    it('should handle ITEM_LOGIN_REQUIRED webhook', async () => {
      const response = await request(app)
        .post('/api/v1/webhooks/plaid')
        .send({
          webhook_type: 'ITEM',
          webhook_code: 'ITEM_LOGIN_REQUIRED',
          item_id: 'item-123'
        })
        .expect(200);

      expect(response.body.received).toBe(true);
      expect(response.body.action).toBe('login_required_notification_sent');
    });

    it('should handle TRANSACTIONS SYNC_UPDATES_AVAILABLE webhook', async () => {
      const response = await request(app)
        .post('/api/v1/webhooks/plaid')
        .send({
          webhook_type: 'TRANSACTIONS',
          webhook_code: 'SYNC_UPDATES_AVAILABLE',
          item_id: 'item-123'
        })
        .expect(200);

      expect(response.body.received).toBe(true);
      expect(response.body.action).toBe('sync_triggered');
    });

    it('should acknowledge unknown webhook types', async () => {
      const response = await request(app)
        .post('/api/v1/webhooks/plaid')
        .send({
          webhook_type: 'UNKNOWN',
          webhook_code: 'SOME_CODE',
          item_id: 'item-123'
        })
        .expect(200);

      expect(response.body.received).toBe(true);
      expect(response.body.action).toBe('acknowledged');
    });
  });
});
