import { AuthSession } from '../../domain/entities/AuthSession';

export interface ISessionRepository {
  findById(id: string): Promise<AuthSession | null>;
  findByRefreshToken(refreshToken: string): Promise<AuthSession | null>;
  findByUserId(userId: string): Promise<AuthSession[]>;
  save(session: AuthSession): Promise<AuthSession>;
  revoke(sessionId: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}

// In-memory implementation for MVP
export class InMemorySessionRepository implements ISessionRepository {
  private sessions: Map<string, AuthSession> = new Map();

  async findById(id: string): Promise<AuthSession | null> {
    return this.sessions.get(id) ?? null;
  }

  async findByRefreshToken(refreshToken: string): Promise<AuthSession | null> {
    for (const session of this.sessions.values()) {
      if (session.refreshToken === refreshToken) return session;
    }
    return null;
  }

  async findByUserId(userId: string): Promise<AuthSession[]> {
    const userSessions: AuthSession[] = [];
    for (const session of this.sessions.values()) {
      if (session.userId === userId) userSessions.push(session);
    }
    return userSessions;
  }

  async save(session: AuthSession): Promise<AuthSession> {
    this.sessions.set(session.id, session);
    return session;
  }

  async revoke(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.revokedAt = new Date();
    }
  }

  async revokeAllForUser(userId: string): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.userId === userId && session.revokedAt === null) {
        session.revokedAt = new Date();
      }
    }
  }

  // Test helper
  clear(): void {
    this.sessions.clear();
  }
}
