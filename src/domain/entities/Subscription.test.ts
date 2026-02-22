import { createSubscription } from './Subscription';

describe('Subscription', () => {
  describe('createSubscription', () => {
    it('should create a subscription with defaults', () => {
      const sub = createSubscription({
        id: 'sub-1',
        userId: 'user-1',
        connectionId: 'conn-1',
        name: 'Netflix',
        amount: 15.99
      });

      expect(sub.id).toBe('sub-1');
      expect(sub.userId).toBe('user-1');
      expect(sub.connectionId).toBe('conn-1');
      expect(sub.name).toBe('Netflix');
      expect(sub.amount).toBe(15.99);
      expect(sub.currency).toBe('USD');
      expect(sub.billingCycle).toBe('monthly');
      expect(sub.status).toBe('verified');
      expect(sub.nextBillingDate).toBeNull();
    });

    it('should create a subscription with custom values', () => {
      const nextBilling = new Date('2024-02-01');
      const sub = createSubscription({
        id: 'sub-1',
        userId: 'user-1',
        connectionId: 'conn-1',
        name: 'Spotify',
        amount: 9.99,
        currency: 'EUR',
        billingCycle: 'yearly',
        nextBillingDate: nextBilling,
        status: 'unverified'
      });

      expect(sub.currency).toBe('EUR');
      expect(sub.billingCycle).toBe('yearly');
      expect(sub.status).toBe('unverified');
      expect(sub.nextBillingDate).toEqual(nextBilling);
    });
  });
});
