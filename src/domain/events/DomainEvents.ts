export interface DomainEvent {
  type: string;
  timestamp: Date;
  data: Record<string, unknown>;
}

export interface ConnectionEstablishedEvent extends DomainEvent {
  type: 'ConnectionEstablished';
  data: {
    connectionId: string;
    userId: string;
    institutionId: string;
    institutionName: string;
  };
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

export interface TransactionsSyncedEvent extends DomainEvent {
  type: 'TransactionsSynced';
  data: {
    connectionId: string;
    userId: string;
    transactionIds: string[];
    syncType: 'initial' | 'incremental';
    transactionsInserted: number;
    duplicatesSkipped: number;
  };
}

export interface IDomainEventEmitter {
  emit(event: DomainEvent): Promise<void>;
  onConnectionEstablished(handler: (event: ConnectionEstablishedEvent) => void): void;
  onConnectionDisconnected(handler: (event: ConnectionDisconnectedEvent) => void): void;
  onTransactionsSynced(handler: (event: TransactionsSyncedEvent) => void): void;
}

// In-memory event emitter for MVP
export class InMemoryDomainEventEmitter implements IDomainEventEmitter {
  private events: DomainEvent[] = [];
  private connectionEstablishedHandlers: ((event: ConnectionEstablishedEvent) => void)[] = [];
  private connectionDisconnectedHandlers: ((event: ConnectionDisconnectedEvent) => void)[] = [];
  private transactionsSyncedHandlers: ((event: TransactionsSyncedEvent) => void)[] = [];

  async emit(event: DomainEvent): Promise<void> {
    this.events.push(event);
    console.log(`[DomainEvent] Emitted: ${event.type}`, event.data);

    if (event.type === 'ConnectionEstablished') {
      for (const handler of this.connectionEstablishedHandlers) {
        handler(event as ConnectionEstablishedEvent);
      }
    }

    if (event.type === 'ConnectionDisconnected') {
      for (const handler of this.connectionDisconnectedHandlers) {
        handler(event as ConnectionDisconnectedEvent);
      }
    }

    if (event.type === 'TransactionsSynced') {
      for (const handler of this.transactionsSyncedHandlers) {
        handler(event as TransactionsSyncedEvent);
      }
    }
  }

  onConnectionEstablished(handler: (event: ConnectionEstablishedEvent) => void): void {
    this.connectionEstablishedHandlers.push(handler);
  }

  onConnectionDisconnected(handler: (event: ConnectionDisconnectedEvent) => void): void {
    this.connectionDisconnectedHandlers.push(handler);
  }

  onTransactionsSynced(handler: (event: TransactionsSyncedEvent) => void): void {
    this.transactionsSyncedHandlers.push(handler);
  }

  // Test helpers
  getEmittedEvents(): DomainEvent[] {
    return [...this.events];
  }

  getConnectionEstablishedEvents(): ConnectionEstablishedEvent[] {
    return this.events.filter(e => e.type === 'ConnectionEstablished') as ConnectionEstablishedEvent[];
  }

  getConnectionDisconnectedEvents(): ConnectionDisconnectedEvent[] {
    return this.events.filter(e => e.type === 'ConnectionDisconnected') as ConnectionDisconnectedEvent[];
  }

  getTransactionsSyncedEvents(): TransactionsSyncedEvent[] {
    return this.events.filter(e => e.type === 'TransactionsSynced') as TransactionsSyncedEvent[];
  }

  clear(): void {
    this.events = [];
    this.connectionEstablishedHandlers = [];
    this.connectionDisconnectedHandlers = [];
    this.transactionsSyncedHandlers = [];
  }
}
