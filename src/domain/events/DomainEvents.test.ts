import { InMemoryDomainEventEmitter, ConnectionDisconnectedEvent } from './DomainEvents';

describe('DomainEvents', () => {
  describe('InMemoryDomainEventEmitter', () => {
    let emitter: InMemoryDomainEventEmitter;

    beforeEach(() => {
      emitter = new InMemoryDomainEventEmitter();
    });

    afterEach(() => {
      emitter.clear();
    });

    it('should emit and store events', async () => {
      const event: ConnectionDisconnectedEvent = {
        type: 'ConnectionDisconnected',
        timestamp: new Date(),
        data: {
          connectionId: 'conn-1',
          userId: 'user-1',
          institutionId: 'inst-1',
          institutionName: 'Test Bank',
          subscriptionsAffected: 2
        }
      };

      await emitter.emit(event);

      const events = emitter.getEmittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(event);
    });

    it('should call registered handlers for ConnectionDisconnected', async () => {
      const handler = jest.fn();
      emitter.onConnectionDisconnected(handler);

      const event: ConnectionDisconnectedEvent = {
        type: 'ConnectionDisconnected',
        timestamp: new Date(),
        data: {
          connectionId: 'conn-1',
          userId: 'user-1',
          institutionId: 'inst-1',
          institutionName: 'Test Bank',
          subscriptionsAffected: 0
        }
      };

      await emitter.emit(event);

      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should filter ConnectionDisconnected events', async () => {
      const event1: ConnectionDisconnectedEvent = {
        type: 'ConnectionDisconnected',
        timestamp: new Date(),
        data: {
          connectionId: 'conn-1',
          userId: 'user-1',
          institutionId: 'inst-1',
          institutionName: 'Bank 1',
          subscriptionsAffected: 1
        }
      };

      const event2: ConnectionDisconnectedEvent = {
        type: 'ConnectionDisconnected',
        timestamp: new Date(),
        data: {
          connectionId: 'conn-2',
          userId: 'user-2',
          institutionId: 'inst-2',
          institutionName: 'Bank 2',
          subscriptionsAffected: 3
        }
      };

      await emitter.emit(event1);
      await emitter.emit(event2);

      const disconnectEvents = emitter.getConnectionDisconnectedEvents();
      expect(disconnectEvents).toHaveLength(2);
    });

    it('should clear all events and handlers', async () => {
      const handler = jest.fn();
      emitter.onConnectionDisconnected(handler);

      const event: ConnectionDisconnectedEvent = {
        type: 'ConnectionDisconnected',
        timestamp: new Date(),
        data: {
          connectionId: 'conn-1',
          userId: 'user-1',
          institutionId: 'inst-1',
          institutionName: 'Test Bank',
          subscriptionsAffected: 0
        }
      };

      await emitter.emit(event);
      emitter.clear();

      expect(emitter.getEmittedEvents()).toHaveLength(0);

      // After clear, handler should no longer be called
      await emitter.emit(event);
      expect(handler).toHaveBeenCalledTimes(1); // Only from before clear
    });
  });
});
