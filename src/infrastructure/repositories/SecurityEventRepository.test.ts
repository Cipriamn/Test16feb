import { InMemorySecurityEventRepository } from './SecurityEventRepository';
import { createSecurityEvent } from '../../domain/entities/SecurityEvent';

describe('InMemorySecurityEventRepository', () => {
  let repository: InMemorySecurityEventRepository;

  beforeEach(() => {
    repository = new InMemorySecurityEventRepository();
  });

  describe('save', () => {
    it('should save security event', async () => {
      const event = createSecurityEvent({
        id: 'event-123',
        userId: 'user-456',
        eventType: 'login_success',
        deviceInfo: 'Chrome/100',
        ipAddress: '192.168.1.1'
      });

      const saved = await repository.save(event);

      expect(saved).toEqual(event);
    });
  });

  describe('findByUserId', () => {
    it('should find events for user', async () => {
      const event1 = createSecurityEvent({
        id: 'event-1',
        userId: 'user-123',
        eventType: 'login_success',
        deviceInfo: 'Chrome/100',
        ipAddress: '192.168.1.1'
      });

      const event2 = createSecurityEvent({
        id: 'event-2',
        userId: 'user-123',
        eventType: 'logout',
        deviceInfo: 'Chrome/100',
        ipAddress: '192.168.1.1'
      });

      const event3 = createSecurityEvent({
        id: 'event-3',
        userId: 'other-user',
        eventType: 'login_success',
        deviceInfo: 'Firefox/90',
        ipAddress: '192.168.1.2'
      });

      await repository.save(event1);
      await repository.save(event2);
      await repository.save(event3);

      const userEvents = await repository.findByUserId('user-123');

      expect(userEvents).toHaveLength(2);
      expect(userEvents.map(e => e.id).sort()).toEqual(['event-1', 'event-2']);
    });

    it('should return events sorted by createdAt descending', async () => {
      const event1 = createSecurityEvent({
        id: 'event-1',
        userId: 'user-123',
        eventType: 'login_success',
        deviceInfo: 'Chrome/100',
        ipAddress: '192.168.1.1'
      });
      event1.createdAt = new Date('2024-01-01');

      const event2 = createSecurityEvent({
        id: 'event-2',
        userId: 'user-123',
        eventType: 'logout',
        deviceInfo: 'Chrome/100',
        ipAddress: '192.168.1.1'
      });
      event2.createdAt = new Date('2024-01-03');

      const event3 = createSecurityEvent({
        id: 'event-3',
        userId: 'user-123',
        eventType: 'password_changed',
        deviceInfo: 'Chrome/100',
        ipAddress: '192.168.1.1'
      });
      event3.createdAt = new Date('2024-01-02');

      await repository.save(event1);
      await repository.save(event2);
      await repository.save(event3);

      const userEvents = await repository.findByUserId('user-123');

      expect(userEvents[0].id).toBe('event-2'); // Most recent
      expect(userEvents[1].id).toBe('event-3');
      expect(userEvents[2].id).toBe('event-1'); // Oldest
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        const event = createSecurityEvent({
          id: `event-${i}`,
          userId: 'user-123',
          eventType: 'login_success',
          deviceInfo: 'Chrome/100',
          ipAddress: '192.168.1.1'
        });
        await repository.save(event);
      }

      const events = await repository.findByUserId('user-123', 5);

      expect(events).toHaveLength(5);
    });
  });

  describe('clear', () => {
    it('should clear all events', async () => {
      const event = createSecurityEvent({
        id: 'event-123',
        userId: 'user-456',
        eventType: 'login_success',
        deviceInfo: 'Chrome/100',
        ipAddress: '192.168.1.1'
      });

      await repository.save(event);
      repository.clear();

      const events = await repository.findByUserId('user-456');
      expect(events).toHaveLength(0);
    });
  });
});
