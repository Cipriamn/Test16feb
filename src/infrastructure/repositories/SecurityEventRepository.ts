import { SecurityEvent } from '../../domain/entities/SecurityEvent';

export interface ISecurityEventRepository {
  save(event: SecurityEvent): Promise<SecurityEvent>;
  findByUserId(userId: string, limit?: number): Promise<SecurityEvent[]>;
}

// In-memory implementation for MVP
export class InMemorySecurityEventRepository implements ISecurityEventRepository {
  private events: SecurityEvent[] = [];

  async save(event: SecurityEvent): Promise<SecurityEvent> {
    this.events.push(event);
    return event;
  }

  async findByUserId(userId: string, limit = 100): Promise<SecurityEvent[]> {
    return this.events
      .filter(e => e.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  // Test helper
  clear(): void {
    this.events = [];
  }
}
