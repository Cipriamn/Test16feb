import express, { Express, NextFunction, Response } from 'express';
import request from 'supertest';
import { createTransactionRoutes, AuthenticatedRequest } from './transactions';
import { TransactionSyncService } from '../../application/services/TransactionSyncService';
import { InMemoryTransactionRepository } from '../../infrastructure/repositories/TransactionRepository';
import { InMemoryConnectionRepository } from '../../infrastructure/repositories/ConnectionRepository';
import { MockPlaidProvider } from '../../infrastructure/providers/PlaidProvider';
import { InMemoryDomainEventEmitter } from '../../domain/events/DomainEvents';
import { createConnection } from '../../domain/entities/Connection';
import { createTransaction } from '../../domain/entities/Transaction';

describe('Transaction Routes Integration Tests', () => {
  let app: Express;
  let transactionRepository: InMemoryTransactionRepository;
  let connectionRepository: InMemoryConnectionRepository;
  let plaidProvider: MockPlaidProvider;
  let eventEmitter: InMemoryDomainEventEmitter;
  let syncService: TransactionSyncService;

  const userId = 'user-123';
  const connectionId = 'conn-123';
  const accessToken = 'access-token-123';

  // Mock auth middleware
  const mockAuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    req.userId = userId;
    next();
  };

  beforeEach(() => {
    transactionRepository = new InMemoryTransactionRepository();
    connectionRepository = new InMemoryConnectionRepository();
    plaidProvider = new MockPlaidProvider();
    eventEmitter = new InMemoryDomainEventEmitter();

    syncService = new TransactionSyncService(
      transactionRepository,
      connectionRepository,
      plaidProvider,
      eventEmitter,
      { retryDelayMs: 10 } // Fast retries for tests
    );

    // Setup connection
    const connection = createConnection({
      id: connectionId,
      userId,
      plaidAccessToken: accessToken,
      institutionId: 'inst-123',
      institutionName: 'Test Bank',
      status: 'active'
    });
    connectionRepository.addConnection(connection);

    app = express();
    app.use(express.json());
    app.use(mockAuthMiddleware);
    app.use('/api/v1/transactions', createTransactionRoutes(syncService, transactionRepository));
  });

  afterEach(() => {
    transactionRepository.clear();
    connectionRepository.clear();
    plaidProvider.clear();
    eventEmitter.clear();
  });

  describe('POST /api/v1/transactions/sync', () => {
    it('should trigger sync and return result', async () => {
      plaidProvider.generateMockTransactions(accessToken, 25, new Date());

      const response = await request(app)
        .post('/api/v1/transactions/sync')
        .send({ connectionId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.syncType).toBe('initial');
      expect(response.body.transactionsInserted).toBe(25);
    });

    it('should return 400 when connectionId missing', async () => {
      const response = await request(app)
        .post('/api/v1/transactions/sync')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('connectionId is required');
    });

    it('should return 400 when sync fails', async () => {
      plaidProvider.setTransientErrorCount(accessToken, 10);

      const response = await request(app)
        .post('/api/v1/transactions/sync')
        .send({ connectionId })
        .expect(400);

      expect(response.body.error).toContain('PLAID_TRANSIENT_ERROR');
    });

    it('should emit TransactionsSynced event on success', async () => {
      plaidProvider.generateMockTransactions(accessToken, 10, new Date());

      await request(app)
        .post('/api/v1/transactions/sync')
        .send({ connectionId })
        .expect(200);

      const events = eventEmitter.getTransactionsSyncedEvents();
      expect(events.length).toBe(1);
      expect(events[0].data.connectionId).toBe(connectionId);
    });
  });

  describe('GET /api/v1/transactions', () => {
    beforeEach(async () => {
      // Add some transactions
      for (let i = 0; i < 5; i++) {
        const txn = createTransaction({
          id: `txn-${i}`,
          userId,
          connectionId,
          plaidTransactionId: `plaid-${i}`,
          accountId: 'acc-1',
          name: `Transaction ${i}`,
          amount: (i + 1) * 10,
          currencyCode: 'USD',
          date: new Date()
        });
        transactionRepository.addTransaction(txn);
      }
    });

    it('should return paginated transactions', async () => {
      const response = await request(app)
        .get('/api/v1/transactions')
        .query({ limit: 3, offset: 0 })
        .expect(200);

      expect(response.body.transactions.length).toBe(3);
      expect(response.body.total).toBe(5);
      expect(response.body.limit).toBe(3);
      expect(response.body.offset).toBe(0);
    });

    it('should return all transactions with default pagination', async () => {
      const response = await request(app)
        .get('/api/v1/transactions')
        .expect(200);

      expect(response.body.transactions.length).toBe(5);
      expect(response.body.total).toBe(5);
    });
  });

  describe('GET /api/v1/transactions/:id', () => {
    it('should return single transaction', async () => {
      const txn = createTransaction({
        id: 'txn-single',
        userId,
        connectionId,
        plaidTransactionId: 'plaid-single',
        accountId: 'acc-1',
        merchantName: 'Test Merchant',
        name: 'Test Transaction',
        amount: 99.99,
        currencyCode: 'USD',
        date: new Date()
      });
      transactionRepository.addTransaction(txn);

      const response = await request(app)
        .get('/api/v1/transactions/txn-single')
        .expect(200);

      expect(response.body.id).toBe('txn-single');
      expect(response.body.merchantName).toBe('Test Merchant');
      expect(response.body.amount).toBe(99.99);
    });

    it('should return 404 for non-existent transaction', async () => {
      const response = await request(app)
        .get('/api/v1/transactions/non-existent')
        .expect(404);

      expect(response.body.error).toBe('Transaction not found');
    });

    it('should return 404 for transaction owned by different user', async () => {
      const txn = createTransaction({
        id: 'txn-other',
        userId: 'other-user',
        connectionId: 'other-conn',
        plaidTransactionId: 'plaid-other',
        accountId: 'acc-1',
        name: 'Other User Transaction',
        amount: 50,
        currencyCode: 'USD',
        date: new Date()
      });
      transactionRepository.addTransaction(txn);

      const response = await request(app)
        .get('/api/v1/transactions/txn-other')
        .expect(404);

      expect(response.body.error).toBe('Transaction not found');
    });
  });

  describe('Performance Benchmark Integration', () => {
    it('should sync 1000 transactions end-to-end in under 5 seconds', async () => {
      plaidProvider.generateMockTransactions(accessToken, 1000, new Date());

      const startTime = Date.now();

      const response = await request(app)
        .post('/api/v1/transactions/sync')
        .send({ connectionId })
        .expect(200);

      const duration = Date.now() - startTime;

      expect(response.body.success).toBe(true);
      expect(response.body.transactionsInserted).toBe(1000);
      expect(duration).toBeLessThan(5000);

      console.log(`Integration benchmark: 1000 transactions synced in ${duration}ms`);
    });

    it('should handle pagination correctly for >500 transactions', async () => {
      plaidProvider.generateMockTransactions(accessToken, 750, new Date());

      const response = await request(app)
        .post('/api/v1/transactions/sync')
        .send({ connectionId })
        .expect(200);

      expect(response.body.transactionsInserted).toBe(750);
      expect(response.body.totalFetched).toBe(750);
    });
  });

  describe('Foreign Currency Handling', () => {
    it('should correctly store foreign currency transactions', async () => {
      const startDate = new Date();
      plaidProvider.setMockTransactions(accessToken, [{
        transaction_id: 'forex_int_1',
        account_id: 'acc_1',
        merchant_name: 'EUR Merchant',
        name: 'Euro Purchase',
        amount: 115.00, // USD
        iso_currency_code: 'USD',
        unofficial_currency_code: null,
        original_amount: 100.00,
        original_currency_code: 'EUR',
        category: ['Shopping'],
        date: startDate.toISOString().split('T')[0],
        authorized_date: null,
        pending: false
      }]);

      await request(app)
        .post('/api/v1/transactions/sync')
        .send({ connectionId })
        .expect(200);

      // Verify stored transaction
      const txns = await transactionRepository.findByConnectionId(connectionId);
      expect(txns.length).toBe(1);
      expect(txns[0].currencyCode).toBe('USD');
      expect(txns[0].originalCurrencyCode).toBe('EUR');
      expect(txns[0].originalAmount).toBe(100.00);
    });
  });

  describe('Deduplication', () => {
    it('should skip duplicate transactions on repeated sync', async () => {
      plaidProvider.generateMockTransactions(accessToken, 20, new Date());

      // First sync
      const response1 = await request(app)
        .post('/api/v1/transactions/sync')
        .send({ connectionId })
        .expect(200);

      expect(response1.body.transactionsInserted).toBe(20);

      // Second sync (same transactions)
      const response2 = await request(app)
        .post('/api/v1/transactions/sync')
        .send({ connectionId })
        .expect(200);

      // All should be skipped (incremental sync with no new data)
      expect(response2.body.syncType).toBe('incremental');
    });
  });

  describe('Retry Logic', () => {
    it('should retry on transient errors and succeed', async () => {
      plaidProvider.generateMockTransactions(accessToken, 10, new Date());
      plaidProvider.setTransientErrorCount(accessToken, 2);

      const response = await request(app)
        .post('/api/v1/transactions/sync')
        .send({ connectionId })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.transactionsInserted).toBe(10);
    });
  });
});
