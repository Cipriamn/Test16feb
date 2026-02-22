export interface DomainEvent {
  type: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

export interface ConnectionDisconnectedEvent extends DomainEvent {
  type: 'ConnectionDisconnected';
  data: {
    connectionId: string;
    userId: string;
    institutionId: string;
    institutionName: string;
    subscriptionsAffected: number;
  };
}

export interface IDomainEventEmitter {
  emit(event: DomainEvent): Promise<void>;
  onConnectionDisconnected(handler: (event: ConnectionDisconnectedEvent) => void): void;
}

// In-memory event emitter for MVP
export class InMemoryDomainEventEmitter implements IDomainEventEmitter {
  private events: DomainEvent[] = [];
  private connectionDisconnectedHandlers: ((event: ConnectionDisconnectedEvent) => void)[] = [];

  async emit(event: DomainEvent): Promise<void> {
    this.events.push(event);
    console.log(`[DomainEvent] Emitted: ${event.type}`, event.data);

    if (event.type === 'ConnectionDisconnected') {
      for (const handler of this.connectionDisconnectedHandlers) {
        handler(event as ConnectionDisconnectedEvent);
      }
    }
  }

  onConnectionDisconnected(handler: (event: ConnectionDisconnectedEvent) => void): void {
    this.connectionDisconnectedHandlers.push(handler);
  }

  // Test helpers
  getEmittedEvents(): DomainEvent[] {
    return [...this.events];
  }

  getConnectionDisconnectedEvents(): ConnectionDisconnectedEvent[] {
    return this.events.filter(e => e.type === 'ConnectionDisconnected') as ConnectionDisconnectedEvent[];
  }

  clear(): void {
    this.events = [];
    this.connectionDisconnectedHandlers = [];
  }
}
