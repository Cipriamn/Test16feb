import { Subscription } from '../../domain/entities/Subscription';

export interface ISubscriptionRepository {
  save(subscription: Subscription): Promise<Subscription>;
  findById(id: string): Promise<Subscription | null>;
  findByUserId(userId: string): Promise<Subscription[]>;
  findByConnectionId(connectionId: string): Promise<Subscription[]>;
  update(subscription: Subscription): Promise<Subscription>;
  markUnverifiedByConnectionId(connectionId: string): Promise<number>;
  delete(id: string): Promise<void>;
}

// In-memory implementation for MVP
export class InMemorySubscriptionRepository implements ISubscriptionRepository {
  private subscriptions: Map<string, Subscription> = new Map();

  async save(subscription: Subscription): Promise<Subscription> {
    this.subscriptions.set(subscription.id, { ...subscription });
    return subscription;
  }

  async findById(id: string): Promise<Subscription | null> {
    return this.subscriptions.get(id) || null;
  }

  async findByUserId(userId: string): Promise<Subscription[]> {
    return Array.from(this.subscriptions.values())
      .filter(s => s.userId === userId);
  }

  async findByConnectionId(connectionId: string): Promise<Subscription[]> {
    return Array.from(this.subscriptions.values())
      .filter(s => s.connectionId === connectionId);
  }

  async update(subscription: Subscription): Promise<Subscription> {
    subscription.updatedAt = new Date();
    this.subscriptions.set(subscription.id, { ...subscription });
    return subscription;
  }

  async markUnverifiedByConnectionId(connectionId: string): Promise<number> {
    let count = 0;
    for (const [id, sub] of this.subscriptions) {
      if (sub.connectionId === connectionId && sub.status !== 'unverified') {
        sub.status = 'unverified';
        sub.updatedAt = new Date();
        this.subscriptions.set(id, sub);
        count++;
      }
    }
    return count;
  }

  async delete(id: string): Promise<void> {
    this.subscriptions.delete(id);
  }

  // Test helpers
  clear(): void {
    this.subscriptions.clear();
  }

  addSubscription(subscription: Subscription): void {
    this.subscriptions.set(subscription.id, { ...subscription });
  }
}
