import { User } from '../../domain/entities/User';

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByOAuth(provider: 'google' | 'facebook', oauthId: string): Promise<User | null>;
  save(user: User): Promise<User>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
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

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.passwordHash = passwordHash;
      user.updatedAt = new Date();
    }
  }

  // Test helper
  clear(): void {
    this.users.clear();
  }
}
