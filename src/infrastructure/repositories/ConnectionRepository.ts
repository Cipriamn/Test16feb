import { Connection } from '../../domain/entities/Connection';

export interface IConnectionRepository {
  save(connection: Connection): Promise<Connection>;
  findById(id: string): Promise<Connection | null>;
  findByUserId(userId: string): Promise<Connection[]>;
  findActiveConnections(): Promise<Connection[]>;
  update(connection: Connection): Promise<Connection>;
  delete(id: string): Promise<void>;
}

// In-memory implementation for MVP
export class InMemoryConnectionRepository implements IConnectionRepository {
  private connections: Map<string, Connection> = new Map();

  async save(connection: Connection): Promise<Connection> {
    this.connections.set(connection.id, { ...connection });
    return connection;
  }

  async findById(id: string): Promise<Connection | null> {
    return this.connections.get(id) || null;
  }

  async findByUserId(userId: string): Promise<Connection[]> {
    return Array.from(this.connections.values())
      .filter(c => c.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findActiveConnections(): Promise<Connection[]> {
    return Array.from(this.connections.values())
      .filter(c => c.status === 'active');
  }

  async update(connection: Connection): Promise<Connection> {
    connection.updatedAt = new Date();
    this.connections.set(connection.id, { ...connection });
    return connection;
  }

  async delete(id: string): Promise<void> {
    this.connections.delete(id);
  }

  // Test helpers
  clear(): void {
    this.connections.clear();
  }

  addConnection(connection: Connection): void {
    this.connections.set(connection.id, { ...connection });
  }
}
