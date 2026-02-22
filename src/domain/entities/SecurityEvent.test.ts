import { createSecurityEvent } from './SecurityEvent';

describe('SecurityEvent', () => {
  describe('createSecurityEvent', () => {
    it('should create event with all required fields', () => {
      const event = createSecurityEvent({
        id: 'event-123',
        userId: 'user-456',
        eventType: 'login_success',
        deviceInfo: 'Chrome/100',
        ipAddress: '192.168.1.1'
      });

      expect(event.id).toBe('event-123');
      expect(event.userId).toBe('user-456');
      expect(event.eventType).toBe('login_success');
      expect(event.deviceInfo).toBe('Chrome/100');
      expect(event.ipAddress).toBe('192.168.1.1');
      expect(event.location).toBeNull();
      expect(event.metadata).toEqual({});
      expect(event.createdAt).toBeInstanceOf(Date);
    });

    it('should set optional location', () => {
      const event = createSecurityEvent({
        id: 'event-123',
        userId: 'user-456',
        eventType: 'login_failed',
        deviceInfo: 'Chrome/100',
        ipAddress: '192.168.1.1',
        location: 'San Francisco, CA'
      });

      expect(event.location).toBe('San Francisco, CA');
    });

    it('should set optional metadata', () => {
      const event = createSecurityEvent({
        id: 'event-123',
        userId: 'user-456',
        eventType: 'login_failed',
        deviceInfo: 'Chrome/100',
        ipAddress: '192.168.1.1',
        metadata: { reason: 'invalid_password', attempts: 3 }
      });

      expect(event.metadata).toEqual({ reason: 'invalid_password', attempts: 3 });
    });

    it('should support all event types', () => {
      const eventTypes = [
        'login_success',
        'login_failed',
        'logout',
        'password_changed',
        'password_reset_requested',
        'password_reset_completed',
        'two_factor_enabled',
        'two_factor_disabled',
        'session_revoked'
      ] as const;

      eventTypes.forEach(eventType => {
        const event = createSecurityEvent({
          id: `event-${eventType}`,
          userId: 'user-456',
          eventType,
          deviceInfo: 'Chrome/100',
          ipAddress: '192.168.1.1'
        });

        expect(event.eventType).toBe(eventType);
      });
    });
  });
});
