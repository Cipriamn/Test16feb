import { createConnection, toConnectionSummary } from './Connection';

describe('Connection', () => {
  describe('createConnection', () => {
    it('should create a connection with defaults', () => {
      const connection = createConnection({
        id: 'conn-1',
        userId: 'user-1',
        plaidAccessToken: 'token-1',
        institutionId: 'inst-1',
        institutionName: 'Test Bank'
      });

      expect(connection.id).toBe('conn-1');
      expect(connection.userId).toBe('user-1');
      expect(connection.status).toBe('active');
      expect(connection.lastSyncAt).toBeNull();
      expect(connection.lastSyncError).toBeNull();
    });

    it('should create a connection with custom status', () => {
      const connection = createConnection({
        id: 'conn-1',
        userId: 'user-1',
        plaidAccessToken: 'token-1',
        institutionId: 'inst-1',
        institutionName: 'Test Bank',
        status: 'failed'
      });

      expect(connection.status).toBe('failed');
    });
  });

  describe('toConnectionSummary', () => {
    it('should convert connection to summary', () => {
      const connection = createConnection({
        id: 'conn-1',
        userId: 'user-1',
        plaidAccessToken: 'token-1',
        institutionId: 'inst-1',
        institutionName: 'Test Bank'
      });
      connection.lastSyncAt = new Date('2024-01-01');

      const summary = toConnectionSummary(connection);

      expect(summary.id).toBe('conn-1');
      expect(summary.institutionId).toBe('inst-1');
      expect(summary.institutionName).toBe('Test Bank');
      expect(summary.status).toBe('active');
      expect(summary.lastSyncAt).toEqual(new Date('2024-01-01'));
      // Should not include sensitive fields
      expect((summary as unknown as { plaidAccessToken?: string }).plaidAccessToken).toBeUndefined();
      expect((summary as unknown as { userId?: string }).userId).toBeUndefined();
    });
  });
});
