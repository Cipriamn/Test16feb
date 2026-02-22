import { User } from '../../domain/entities/User';

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByOAuth(provider: 'google' | 'facebook', oauthId: string): Promise<User | null>;
  save(user: User): Promise<User>;
  update(user: User): Promise<User>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
  softDelete(userId: string): Promise<void>;
  restore(userId: string): Promise<void>;
  hardDelete(userId: string): Promise<void>;
  findUsersScheduledForDeletion(beforeDate: Date): Promise<User[]>;
}

// In-memory implementation for MVP
export class InMemoryUserRepository implements IUserRepository {
  private users: Map<string, User> = new Map();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return null;
  }

  async findByOAuth(provider: 'google' | 'facebook', oauthId: string): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.oauthProvider === provider && user.oauthId === oauthId) return user;
    }
    return null;
  }

  async save(user: User): Promise<User> {
    this.users.set(user.id, user);
    return user;
  }

  async update(user: User): Promise<User> {
    const existing = this.users.get(user.id);
    if (!existing) {
      throw new Error('User not found');
    }
    user.updatedAt = new Date();
    this.users.set(user.id, user);
    return user;
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.passwordHash = passwordHash;
      user.updatedAt = new Date();
    }
  }

  async softDelete(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      const now = new Date();
      user.deletedAt = now;
      user.deletionScheduledAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
      user.updatedAt = now;
    }
  }

  async restore(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.deletedAt = null;
      user.deletionScheduledAt = null;
      user.updatedAt = new Date();
    }
  }

  async hardDelete(userId: string): Promise<void> {
    this.users.delete(userId);
  }

  async findUsersScheduledForDeletion(beforeDate: Date): Promise<User[]> {
    const result: User[] = [];
    for (const user of this.users.values()) {
      if (user.deletionScheduledAt && user.deletionScheduledAt <= beforeDate) {
        result.push(user);
      }
    }
    return result;
  }

  // Test helper
  clear(): void {
    this.users.clear();
  }
}
