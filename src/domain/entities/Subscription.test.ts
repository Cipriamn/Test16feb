import { createSubscription } from './Subscription';
import { InMemorySubscriptionRepository } from '../../infrastructure/repositories/SubscriptionRepository';

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

describe('SubscriptionRepository', () => {
  let repository: InMemorySubscriptionRepository;

  beforeEach(() => {
    repository = new InMemorySubscriptionRepository();
  });

  afterEach(() => {
    repository.clear();
  });

  it('should save and find subscription by id', async () => {
    const sub = createSubscription({
      id: 'sub-1',
      userId: 'user-1',
      connectionId: 'conn-1',
      name: 'Netflix',
      amount: 15.99
    });

    await repository.save(sub);
    const found = await repository.findById('sub-1');

    expect(found).not.toBeNull();
    expect(found?.id).toBe('sub-1');
  });

  it('should return null for non-existent subscription', async () => {
    const found = await repository.findById('non-existent');
    expect(found).toBeNull();
  });

  it('should find subscriptions by userId', async () => {
    const sub1 = createSubscription({
      id: 'sub-1',
      userId: 'user-1',
      connectionId: 'conn-1',
      name: 'Netflix',
      amount: 15.99
    });
    const sub2 = createSubscription({
      id: 'sub-2',
      userId: 'user-1',
      connectionId: 'conn-1',
      name: 'Spotify',
      amount: 9.99
    });
    const sub3 = createSubscription({
      id: 'sub-3',
      userId: 'user-2',
      connectionId: 'conn-2',
      name: 'HBO',
      amount: 14.99
    });

    await repository.save(sub1);
    await repository.save(sub2);
    await repository.save(sub3);

    const userSubs = await repository.findByUserId('user-1');
    expect(userSubs.length).toBe(2);
  });

  it('should find subscriptions by connectionId', async () => {
    const sub1 = createSubscription({
      id: 'sub-1',
      userId: 'user-1',
      connectionId: 'conn-1',
      name: 'Netflix',
      amount: 15.99
    });
    const sub2 = createSubscription({
      id: 'sub-2',
      userId: 'user-1',
      connectionId: 'conn-2',
      name: 'Spotify',
      amount: 9.99
    });

    await repository.save(sub1);
    await repository.save(sub2);

    const connSubs = await repository.findByConnectionId('conn-1');
    expect(connSubs.length).toBe(1);
    expect(connSubs[0].name).toBe('Netflix');
  });

  it('should update subscription', async () => {
    const sub = createSubscription({
      id: 'sub-1',
      userId: 'user-1',
      connectionId: 'conn-1',
      name: 'Netflix',
      amount: 15.99
    });

    await repository.save(sub);

    sub.amount = 19.99;
    const updated = await repository.update(sub);

    expect(updated.amount).toBe(19.99);
    expect(updated.updatedAt).toBeDefined();
  });

  it('should mark subscriptions as unverified by connectionId', async () => {
    const sub1 = createSubscription({
      id: 'sub-1',
      userId: 'user-1',
      connectionId: 'conn-1',
      name: 'Netflix',
      amount: 15.99,
      status: 'verified'
    });
    const sub2 = createSubscription({
      id: 'sub-2',
      userId: 'user-1',
      connectionId: 'conn-1',
      name: 'Spotify',
      amount: 9.99,
      status: 'verified'
    });
    const sub3 = createSubscription({
      id: 'sub-3',
      userId: 'user-1',
      connectionId: 'conn-1',
      name: 'HBO',
      amount: 14.99,
      status: 'unverified' // Already unverified
    });

    await repository.save(sub1);
    await repository.save(sub2);
    await repository.save(sub3);

    const count = await repository.markUnverifiedByConnectionId('conn-1');

    expect(count).toBe(2); // Only 2 were verified

    const allSubs = await repository.findByConnectionId('conn-1');
    expect(allSubs.every(s => s.status === 'unverified')).toBe(true);
  });

  it('should delete subscription', async () => {
    const sub = createSubscription({
      id: 'sub-1',
      userId: 'user-1',
      connectionId: 'conn-1',
      name: 'Netflix',
      amount: 15.99
    });

    await repository.save(sub);
    await repository.delete('sub-1');

    const found = await repository.findById('sub-1');
    expect(found).toBeNull();
  });

  it('should add subscription using helper', () => {
    const sub = createSubscription({
      id: 'sub-1',
      userId: 'user-1',
      connectionId: 'conn-1',
      name: 'Netflix',
      amount: 15.99
    });

    repository.addSubscription(sub);
  });
});
