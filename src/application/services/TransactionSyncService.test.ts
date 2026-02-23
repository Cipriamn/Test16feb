import { TransactionSyncService } from './TransactionSyncService';
import { InMemoryTransactionRepository } from '../../infrastructure/repositories/TransactionRepository';
import { InMemoryConnectionRepository } from '../../infrastructure/repositories/ConnectionRepository';
import { MockPlaidProvider } from '../../infrastructure/providers/PlaidProvider';
import { InMemoryDomainEventEmitter } from '../../domain/events/DomainEvents';
import { createConnection } from '../../domain/entities/Connection';

describe('TransactionSyncService', () => {
  let service: TransactionSyncService;
  let transactionRepository: InMemoryTransactionRepository;
  let connectionRepository: InMemoryConnectionRepository;
  let plaidProvider: MockPlaidProvider;
  let eventEmitter: InMemoryDomainEventEmitter;

  const userId = 'user-123';
  const connectionId = 'conn-123';
  const accessToken = 'access-token-123';

  beforeEach(() => {
    transactionRepository = new InMemoryTransactionRepository();
    connectionRepository = new InMemoryConnectionRepository();
    plaidProvider = new MockPlaidProvider();
    eventEmitter = new InMemoryDomainEventEmitter();

    service = new TransactionSyncService(
      transactionRepository,
      connectionRepository,
      plaidProvider,
      eventEmitter,
      { retryDelayMs: 10 } // Fast retries for tests
    );

    // Setup a test connection
    const connection = createConnection({
      id: connectionId,
      userId,
      plaidAccessToken: accessToken,
      institutionId: 'inst-123',
      institutionName: 'Test Bank',
      status: 'active'
    });
    connectionRepository.addConnection(connection);
  });

  afterEach(() => {
    transactionRepository.clear();
    connectionRepository.clear();
    plaidProvider.clear();
    eventEmitter.clear();
  });

  describe('syncConnection', () => {
    it('should perform initial sync fetching 90 days of transactions', async () => {
      // Setup mock transactions - use today as start so transactions go backwards within 90-day window
      const startDate = new Date();
      plaidProvider.generateMockTransactions(accessToken, 50, startDate);

      const result = await service.syncConnection(connectionId);

      expect(result.success).toBe(true);
      expect(result.syncType).toBe('initial');
      expect(result.transactionsInserted).toBe(50);
      expect(result.duplicatesSkipped).toBe(0);
      expect(result.transactionIds.length).toBe(50);
    });

    it('should perform incremental sync fetching only new transactions', async () => {
      // First sync
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      plaidProvider.generateMockTransactions(accessToken, 30, startDate);

      await service.syncConnection(connectionId);

      // Add new transactions
      const newDate = new Date();
      plaidProvider.addMockTransaction(accessToken, {
        transaction_id: 'new_txn_1',
        account_id: 'acc_1',
        merchant_name: 'New Merchant',
        name: 'New Transaction',
        amount: 100,
        iso_currency_code: 'USD',
        unofficial_currency_code: null,
        original_amount: null,
        original_currency_code: null,
        category: ['Shopping'],
        date: newDate.toISOString().split('T')[0],
        authorized_date: null,
        pending: false
      });

      // Second sync (incremental)
      const result = await service.syncConnection(connectionId);

      expect(result.success).toBe(true);
      expect(result.syncType).toBe('incremental');
    });

    it('should return error when connection not found', async () => {
      const result = await service.syncConnection('non-existent-conn');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection not found');
    });

    it('should return error when connection is disconnected', async () => {
      const disconnectedConn = createConnection({
        id: 'disc-conn',
        userId,
        plaidAccessToken: 'disc-token',
        institutionId: 'inst-456',
        institutionName: 'Disconnected Bank',
        status: 'disconnected'
      });
      connectionRepository.addConnection(disconnectedConn);

      const result = await service.syncConnection('disc-conn');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection is disconnected');
    });

    it('should deduplicate transactions by Plaid transaction_id', async () => {
      const startDate = new Date();
      plaidProvider.generateMockTransactions(accessToken, 20, startDate);

      // First sync
      await service.syncConnection(connectionId);

      // Sync again with same transactions
      const result = await service.syncConnection(connectionId);

      // All should be skipped as duplicates on incremental
      expect(result.success).toBe(true);
    });

    it('should emit TransactionsSynced event after successful sync', async () => {
      const startDate = new Date();
      plaidProvider.generateMockTransactions(accessToken, 10, startDate);

      await service.syncConnection(connectionId);

      const events = eventEmitter.getTransactionsSyncedEvents();
      expect(events.length).toBe(1);
      expect(events[0].data.connectionId).toBe(connectionId);
      expect(events[0].data.userId).toBe(userId);
      expect(events[0].data.syncType).toBe('initial');
      expect(events[0].data.transactionsInserted).toBe(10);
    });

    it('should update connection lastSyncAt after successful sync', async () => {
      const startDate = new Date();
      plaidProvider.generateMockTransactions(accessToken, 5, startDate);

      const beforeSync = new Date();
      await service.syncConnection(connectionId);

      const connection = await connectionRepository.findById(connectionId);
      expect(connection?.lastSyncAt).toBeDefined();
      expect(connection?.lastSyncAt!.getTime()).toBeGreaterThanOrEqual(beforeSync.getTime());
    });

    it('should handle foreign currency transactions correctly', async () => {
      const startDate = new Date();
      plaidProvider.setMockTransactions(accessToken, [{
        transaction_id: 'forex_txn_1',
        account_id: 'acc_1',
        merchant_name: 'Foreign Merchant',
        name: 'Foreign Transaction',
        amount: 100, // USD equivalent
        iso_currency_code: 'USD',
        unofficial_currency_code: null,
        original_amount: 85.50,
        original_currency_code: 'EUR',
        category: ['Travel'],
        date: startDate.toISOString().split('T')[0],
        authorized_date: null,
        pending: false
      }]);

      const result = await service.syncConnection(connectionId);

      expect(result.success).toBe(true);
      expect(result.transactionsInserted).toBe(1);

      const transactions = await transactionRepository.findByConnectionId(connectionId);
      expect(transactions[0].originalAmount).toBe(85.50);
      expect(transactions[0].originalCurrencyCode).toBe('EUR');
      expect(transactions[0].currencyCode).toBe('USD');
    });

    it('should handle pagination for large transaction sets (>500)', async () => {
      const startDate = new Date();
      plaidProvider.generateMockTransactions(accessToken, 750, startDate);

      const result = await service.syncConnection(connectionId);

      expect(result.success).toBe(true);
      expect(result.transactionsInserted).toBe(750);
      expect(result.totalFetched).toBe(750);
    });

    it('should retry on transient errors', async () => {
      const startDate = new Date();
      plaidProvider.generateMockTransactions(accessToken, 10, startDate);

      // Set 2 transient failures before success
      plaidProvider.setTransientErrorCount(accessToken, 2);

      const result = await service.syncConnection(connectionId);

      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(2);
    });

    it('should fail after max retries exceeded', async () => {
      const startDate = new Date();
      plaidProvider.generateMockTransactions(accessToken, 10, startDate);

      // Set more failures than max retries
      plaidProvider.setTransientErrorCount(accessToken, 10);

      const result = await service.syncConnection(connectionId);

      expect(result.success).toBe(false);
      expect(result.error).toContain('PLAID_TRANSIENT_ERROR');
    });

    it('should update connection status to failed on sync error', async () => {
      plaidProvider.setTransientErrorCount(accessToken, 10); // More than max retries

      await service.syncConnection(connectionId);

      const connection = await connectionRepository.findById(connectionId);
      expect(connection?.status).toBe('failed');
      expect(connection?.lastSyncError).toContain('PLAID_TRANSIENT_ERROR');
    });
  });

  describe('syncAllConnections', () => {
    it('should sync all active connections', async () => {
      // Add second connection
      const connection2 = createConnection({
        id: 'conn-456',
        userId: 'user-456',
        plaidAccessToken: 'access-token-456',
        institutionId: 'inst-456',
        institutionName: 'Bank Two',
        status: 'active'
      });
      connectionRepository.addConnection(connection2);

      // Setup transactions for both
      plaidProvider.generateMockTransactions(accessToken, 20, new Date());
      plaidProvider.generateMockTransactions('access-token-456', 15, new Date());

      const result = await service.syncAllConnections();

      expect(result.synced.length).toBe(2);
      expect(result.failed.length).toBe(0);
      expect(result.totalInserted).toBe(35);
    });

    it('should report failures separately from successes', async () => {
      // Add failing connection
      const failingConn = createConnection({
        id: 'conn-fail',
        userId: 'user-fail',
        plaidAccessToken: 'fail-token',
        institutionId: 'inst-fail',
        institutionName: 'Failing Bank',
        status: 'active'
      });
      connectionRepository.addConnection(failingConn);

      plaidProvider.generateMockTransactions(accessToken, 10, new Date());
      plaidProvider.setTransientErrorCount('fail-token', 10);

      const result = await service.syncAllConnections();

      expect(result.synced.length).toBe(1);
      expect(result.failed.length).toBe(1);
      expect(result.failed[0].connectionId).toBe('conn-fail');
    });

    it('should skip disconnected connections', async () => {
      // Change connection to disconnected
      const conn = await connectionRepository.findById(connectionId);
      if (conn) {
        conn.status = 'disconnected';
        await connectionRepository.update(conn);
      }

      plaidProvider.generateMockTransactions(accessToken, 10, new Date());

      const result = await service.syncAllConnections();

      expect(result.synced.length).toBe(0);
      expect(result.failed.length).toBe(0);
    });
  });

  describe('performance', () => {
    it('should sync 1000 transactions in under 5 seconds', async () => {
      const startDate = new Date();
      plaidProvider.generateMockTransactions(accessToken, 1000, startDate);

      const startTime = Date.now();
      const result = await service.syncConnection(connectionId);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.transactionsInserted).toBe(1000);
      expect(duration).toBeLessThan(5000); // Under 5 seconds

      console.log(`Performance: 1000 transactions synced in ${duration}ms`);
    });

    it('should handle bulk insert efficiently', async () => {
      const startDate = new Date();
      plaidProvider.generateMockTransactions(accessToken, 2000, startDate);

      const startTime = Date.now();
      const result = await service.syncConnection(connectionId);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.transactionsInserted).toBe(2000);
      expect(duration).toBeLessThan(10000); // Under 10 seconds for 2000

      console.log(`Performance: 2000 transactions synced in ${duration}ms`);
    });
  });
});

describe('Transaction Entity', () => {
  it('should create transaction with required fields', async () => {
    const { createTransaction } = await import('../../domain/entities/Transaction');

    const txn = createTransaction({
      id: 'txn-1',
      userId: 'user-1',
      connectionId: 'conn-1',
      plaidTransactionId: 'plaid-txn-1',
      accountId: 'acc-1',
      name: 'Test Transaction',
      amount: 50.00,
      currencyCode: 'USD',
      date: new Date()
    });

    expect(txn.id).toBe('txn-1');
    expect(txn.merchantName).toBeNull();
    expect(txn.status).toBe('posted');
    expect(txn.pending).toBe(false);
  });

  it('should handle foreign currency', async () => {
    const { createTransaction } = await import('../../domain/entities/Transaction');

    const txn = createTransaction({
      id: 'txn-1',
      userId: 'user-1',
      connectionId: 'conn-1',
      plaidTransactionId: 'plaid-txn-1',
      accountId: 'acc-1',
      name: 'Foreign Transaction',
      amount: 100.00,
      currencyCode: 'USD',
      originalAmount: 85.50,
      originalCurrencyCode: 'EUR',
      date: new Date()
    });

    expect(txn.originalAmount).toBe(85.50);
    expect(txn.originalCurrencyCode).toBe('EUR');
  });
});

describe('TransactionRepository', () => {
  let repository: InMemoryTransactionRepository;

  beforeEach(() => {
    repository = new InMemoryTransactionRepository();
  });

  afterEach(() => {
    repository.clear();
  });

  it('should deduplicate by plaid transaction ID on bulk insert', async () => {
    const { createTransaction } = await import('../../domain/entities/Transaction');

    const txns = [
      createTransaction({
        id: 'txn-1',
        userId: 'user-1',
        connectionId: 'conn-1',
        plaidTransactionId: 'plaid-1',
        accountId: 'acc-1',
        name: 'Transaction 1',
        amount: 50,
        currencyCode: 'USD',
        date: new Date()
      }),
      createTransaction({
        id: 'txn-2',
        userId: 'user-1',
        connectionId: 'conn-1',
        plaidTransactionId: 'plaid-1', // Duplicate
        accountId: 'acc-1',
        name: 'Transaction 1 Duplicate',
        amount: 50,
        currencyCode: 'USD',
        date: new Date()
      }),
      createTransaction({
        id: 'txn-3',
        userId: 'user-1',
        connectionId: 'conn-1',
        plaidTransactionId: 'plaid-2',
        accountId: 'acc-1',
        name: 'Transaction 2',
        amount: 75,
        currencyCode: 'USD',
        date: new Date()
      })
    ];

    const result = await repository.bulkInsert(txns);

    expect(result.inserted).toBe(2);
    expect(result.duplicatesSkipped).toBe(1);
  });

  it('should find by plaid transaction ID', async () => {
    const { createTransaction } = await import('../../domain/entities/Transaction');

    const txn = createTransaction({
      id: 'txn-1',
      userId: 'user-1',
      connectionId: 'conn-1',
      plaidTransactionId: 'plaid-unique-id',
      accountId: 'acc-1',
      name: 'Test',
      amount: 100,
      currencyCode: 'USD',
      date: new Date()
    });

    await repository.save(txn);

    const found = await repository.findByPlaidTransactionId('plaid-unique-id');
    expect(found).not.toBeNull();
    expect(found?.id).toBe('txn-1');
  });

  it('should get latest transaction date for connection', async () => {
    const { createTransaction } = await import('../../domain/entities/Transaction');

    const oldDate = new Date('2024-01-01');
    const newDate = new Date('2024-03-15');

    await repository.save(createTransaction({
      id: 'txn-1',
      userId: 'user-1',
      connectionId: 'conn-1',
      plaidTransactionId: 'plaid-1',
      accountId: 'acc-1',
      name: 'Old',
      amount: 50,
      currencyCode: 'USD',
      date: oldDate
    }));

    await repository.save(createTransaction({
      id: 'txn-2',
      userId: 'user-1',
      connectionId: 'conn-1',
      plaidTransactionId: 'plaid-2',
      accountId: 'acc-1',
      name: 'New',
      amount: 75,
      currencyCode: 'USD',
      date: newDate
    }));

    const latestDate = await repository.getLatestTransactionDate('conn-1');
    expect(latestDate).toEqual(newDate);
  });

  it('should throw error on duplicate plaid transaction ID when saving', async () => {
    const { createTransaction } = await import('../../domain/entities/Transaction');

    const txn1 = createTransaction({
      id: 'txn-1',
      userId: 'user-1',
      connectionId: 'conn-1',
      plaidTransactionId: 'plaid-dup',
      accountId: 'acc-1',
      name: 'First',
      amount: 50,
      currencyCode: 'USD',
      date: new Date()
    });

    const txn2 = createTransaction({
      id: 'txn-2',
      userId: 'user-1',
      connectionId: 'conn-1',
      plaidTransactionId: 'plaid-dup', // Same plaid ID, different internal ID
      accountId: 'acc-1',
      name: 'Duplicate',
      amount: 75,
      currencyCode: 'USD',
      date: new Date()
    });

    await repository.save(txn1);
    await expect(repository.save(txn2)).rejects.toThrow('Duplicate transaction');
  });

  it('should find transactions by userId with pagination', async () => {
    const { createTransaction } = await import('../../domain/entities/Transaction');

    for (let i = 0; i < 10; i++) {
      await repository.save(createTransaction({
        id: `txn-${i}`,
        userId: 'user-1',
        connectionId: 'conn-1',
        plaidTransactionId: `plaid-${i}`,
        accountId: 'acc-1',
        name: `Transaction ${i}`,
        amount: i * 10,
        currencyCode: 'USD',
        date: new Date(2024, 0, i + 1)
      }));
    }

    // With limit only
    const limited = await repository.findByUserId('user-1', 3);
    expect(limited.length).toBe(3);

    // With limit and offset
    const paged = await repository.findByUserId('user-1', 3, 2);
    expect(paged.length).toBe(3);

    // Without pagination
    const all = await repository.findByUserId('user-1');
    expect(all.length).toBe(10);
  });

  it('should find by multiple plaid transaction IDs', async () => {
    const { createTransaction } = await import('../../domain/entities/Transaction');

    await repository.save(createTransaction({
      id: 'txn-1',
      userId: 'user-1',
      connectionId: 'conn-1',
      plaidTransactionId: 'plaid-1',
      accountId: 'acc-1',
      name: 'Txn 1',
      amount: 50,
      currencyCode: 'USD',
      date: new Date()
    }));

    await repository.save(createTransaction({
      id: 'txn-2',
      userId: 'user-1',
      connectionId: 'conn-1',
      plaidTransactionId: 'plaid-2',
      accountId: 'acc-1',
      name: 'Txn 2',
      amount: 75,
      currencyCode: 'USD',
      date: new Date()
    }));

    const found = await repository.findByPlaidTransactionIds(['plaid-1', 'plaid-2', 'plaid-3']);
    expect(found.length).toBe(2);
  });

  it('should return null for non-existent latest transaction date', async () => {
    const latestDate = await repository.getLatestTransactionDate('non-existent-conn');
    expect(latestDate).toBeNull();
  });

  it('should count transactions by userId', async () => {
    const { createTransaction } = await import('../../domain/entities/Transaction');

    for (let i = 0; i < 5; i++) {
      await repository.save(createTransaction({
        id: `txn-${i}`,
        userId: 'user-1',
        connectionId: 'conn-1',
        plaidTransactionId: `plaid-${i}`,
        accountId: 'acc-1',
        name: `Txn ${i}`,
        amount: i * 10,
        currencyCode: 'USD',
        date: new Date()
      }));
    }

    const count = await repository.countByUserId('user-1');
    expect(count).toBe(5);
  });

  it('should delete transactions by userId', async () => {
    const { createTransaction } = await import('../../domain/entities/Transaction');

    for (let i = 0; i < 3; i++) {
      await repository.save(createTransaction({
        id: `txn-${i}`,
        userId: 'user-1',
        connectionId: 'conn-1',
        plaidTransactionId: `plaid-${i}`,
        accountId: 'acc-1',
        name: `Txn ${i}`,
        amount: i * 10,
        currencyCode: 'USD',
        date: new Date()
      }));
    }

    const deleted = await repository.deleteByUserId('user-1');
    expect(deleted).toBe(3);

    const remaining = await repository.findByUserId('user-1');
    expect(remaining.length).toBe(0);
  });

  it('should delete transactions by connectionId', async () => {
    const { createTransaction } = await import('../../domain/entities/Transaction');

    for (let i = 0; i < 4; i++) {
      await repository.save(createTransaction({
        id: `txn-${i}`,
        userId: 'user-1',
        connectionId: 'conn-1',
        plaidTransactionId: `plaid-${i}`,
        accountId: 'acc-1',
        name: `Txn ${i}`,
        amount: i * 10,
        currencyCode: 'USD',
        date: new Date()
      }));
    }

    const deleted = await repository.deleteByConnectionId('conn-1');
    expect(deleted).toBe(4);

    const remaining = await repository.findByConnectionId('conn-1');
    expect(remaining.length).toBe(0);
  });

  it('should return null when finding non-existent plaid transaction', async () => {
    const found = await repository.findByPlaidTransactionId('non-existent');
    expect(found).toBeNull();
  });

  it('should return null when finding non-existent transaction by id', async () => {
    const found = await repository.findById('non-existent');
    expect(found).toBeNull();
  });

  it('should return empty array when no transactions match plaid IDs', async () => {
    const found = await repository.findByPlaidTransactionIds(['non-1', 'non-2']);
    expect(found).toEqual([]);
  });

  it('should handle getAll helper', async () => {
    const { createTransaction } = await import('../../domain/entities/Transaction');

    repository.addTransaction(createTransaction({
      id: 'txn-1',
      userId: 'user-1',
      connectionId: 'conn-1',
      plaidTransactionId: 'plaid-1',
      accountId: 'acc-1',
      name: 'Txn 1',
      amount: 50,
      currencyCode: 'USD',
      date: new Date()
    }));

    const all = repository.getAll();
    expect(all.length).toBe(1);
  });
});
