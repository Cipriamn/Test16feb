import { v4 as uuidv4 } from 'uuid';
import { createTransaction, Transaction } from '../../domain/entities/Transaction';
import { Connection } from '../../domain/entities/Connection';
import { TransactionsSyncedEvent, IDomainEventEmitter } from '../../domain/events/DomainEvents';
import { ITransactionRepository, BulkInsertResult } from '../../infrastructure/repositories/TransactionRepository';
import { IConnectionRepository } from '../../infrastructure/repositories/ConnectionRepository';
import { IPlaidProvider, PlaidTransaction } from '../../infrastructure/providers/PlaidProvider';

export interface SyncResult {
  success: boolean;
  connectionId: string;
  syncType: 'initial' | 'incremental';
  transactionsInserted: number;
  duplicatesSkipped: number;
  totalFetched: number;
  transactionIds: string[];
  error?: string;
  retryCount?: number;
}

export interface BatchSyncResult {
  synced: SyncResult[];
  failed: SyncResult[];
  totalInserted: number;
  totalDuplicatesSkipped: number;
}

const INITIAL_SYNC_DAYS = 90;
const MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 1000;

export interface TransactionSyncServiceOptions {
  retryDelayMs?: number;
}

export class TransactionSyncService {
  private retryDelayMs: number;

  constructor(
    private transactionRepository: ITransactionRepository,
    private connectionRepository: IConnectionRepository,
    private plaidProvider: IPlaidProvider,
    private domainEventEmitter: IDomainEventEmitter,
    options?: TransactionSyncServiceOptions
  ) {
    this.retryDelayMs = options?.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  }

  /**
   * Sync transactions for a single connection
   * - Initial sync: fetches last 90 days
   * - Incremental sync: fetches from last sync date
   */
  async syncConnection(connectionId: string): Promise<SyncResult> {
    const connection = await this.connectionRepository.findById(connectionId);

    if (!connection) {
      return {
        success: false,
        connectionId,
        syncType: 'initial',
        transactionsInserted: 0,
        duplicatesSkipped: 0,
        totalFetched: 0,
        transactionIds: [],
        error: 'Connection not found'
      };
    }

    if (connection.status === 'disconnected') {
      return {
        success: false,
        connectionId,
        syncType: 'initial',
        transactionsInserted: 0,
        duplicatesSkipped: 0,
        totalFetched: 0,
        transactionIds: [],
        error: 'Connection is disconnected'
      };
    }

    // Determine sync type and date range
    const latestTxnDate = await this.transactionRepository.getLatestTransactionDate(connectionId);
    const isInitialSync = latestTxnDate === null;
    const syncType = isInitialSync ? 'initial' : 'incremental';

    const endDate = new Date();
    let startDate: Date;

    if (isInitialSync) {
      // Initial sync: last 90 days
      startDate = new Date();
      startDate.setDate(startDate.getDate() - INITIAL_SYNC_DAYS);
    } else {
      // Incremental sync: from day after last transaction
      startDate = new Date(latestTxnDate);
      startDate.setDate(startDate.getDate() + 1);
    }

    // Fetch and insert with retry logic
    return await this.fetchAndInsertTransactions(
      connection,
      startDate,
      endDate,
      syncType
    );
  }

  /**
   * Sync all active connections
   */
  async syncAllConnections(): Promise<BatchSyncResult> {
    const activeConnections = await this.connectionRepository.findActiveConnections();

    const result: BatchSyncResult = {
      synced: [],
      failed: [],
      totalInserted: 0,
      totalDuplicatesSkipped: 0
    };

    for (const connection of activeConnections) {
      const syncResult = await this.syncConnection(connection.id);

      if (syncResult.success) {
        result.synced.push(syncResult);
        result.totalInserted += syncResult.transactionsInserted;
        result.totalDuplicatesSkipped += syncResult.duplicatesSkipped;
      } else {
        result.failed.push(syncResult);
      }
    }

    console.log(`[TransactionSyncService] Batch sync complete: ${result.synced.length} succeeded, ${result.failed.length} failed`);
    return result;
  }

  /**
   * Fetch transactions from Plaid with pagination and insert with retry logic
   */
  private async fetchAndInsertTransactions(
    connection: Connection,
    startDate: Date,
    endDate: Date,
    syncType: 'initial' | 'incremental'
  ): Promise<SyncResult> {
    const allTransactions: Transaction[] = [];
    let cursor: string | undefined;
    let hasMore = true;
    let totalFetched = 0;
    let retryCount = 0;

    // Fetch all pages with pagination
    while (hasMore) {
      try {
        const response = await this.fetchWithRetry(
          connection.plaidAccessToken,
          startDate,
          endDate,
          cursor
        );

        retryCount = response.retryCount;

        // Convert Plaid transactions to domain entities
        const transactions = response.transactions.map(plaidTxn =>
          this.convertPlaidTransaction(plaidTxn, connection)
        );

        allTransactions.push(...transactions);
        totalFetched += response.transactions.length;
        hasMore = response.hasMore;
        cursor = response.nextCursor;

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[TransactionSyncService] Failed to fetch transactions for connection ${connection.id}: ${errorMessage}`);

        // Update connection status to failed
        connection.status = 'failed';
        connection.lastSyncError = errorMessage;
        await this.connectionRepository.update(connection);

        return {
          success: false,
          connectionId: connection.id,
          syncType,
          transactionsInserted: 0,
          duplicatesSkipped: 0,
          totalFetched,
          transactionIds: [],
          error: errorMessage,
          retryCount
        };
      }
    }

    // Bulk insert with deduplication
    let bulkResult: BulkInsertResult;
    try {
      bulkResult = await this.transactionRepository.bulkInsert(allTransactions);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[TransactionSyncService] Failed to insert transactions: ${errorMessage}`);

      return {
        success: false,
        connectionId: connection.id,
        syncType,
        transactionsInserted: 0,
        duplicatesSkipped: 0,
        totalFetched,
        transactionIds: [],
        error: `Failed to insert transactions: ${errorMessage}`,
        retryCount
      };
    }

    // Update connection sync status
    connection.lastSyncAt = new Date();
    connection.lastSyncError = null;
    connection.status = 'active';
    await this.connectionRepository.update(connection);

    // Emit domain event
    const event: TransactionsSyncedEvent = {
      type: 'TransactionsSynced',
      timestamp: new Date(),
      data: {
        connectionId: connection.id,
        userId: connection.userId,
        transactionIds: bulkResult.transactionIds,
        syncType,
        transactionsInserted: bulkResult.inserted,
        duplicatesSkipped: bulkResult.duplicatesSkipped
      }
    };
    await this.domainEventEmitter.emit(event);

    console.log(`[TransactionSyncService] Sync complete for connection ${connection.id}: ${bulkResult.inserted} inserted, ${bulkResult.duplicatesSkipped} duplicates skipped`);

    return {
      success: true,
      connectionId: connection.id,
      syncType,
      transactionsInserted: bulkResult.inserted,
      duplicatesSkipped: bulkResult.duplicatesSkipped,
      totalFetched,
      transactionIds: bulkResult.transactionIds,
      retryCount
    };
  }

  /**
   * Fetch transactions with retry logic for transient errors
   */
  private async fetchWithRetry(
    accessToken: string,
    startDate: Date,
    endDate: Date,
    cursor?: string
  ): Promise<{
    transactions: PlaidTransaction[];
    hasMore: boolean;
    nextCursor?: string;
    retryCount: number;
  }> {
    let lastError: Error | null = null;
    let retryCount = 0;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await this.plaidProvider.getTransactions(
          accessToken,
          startDate,
          endDate,
          cursor
        );

        return {
          transactions: response.transactions,
          hasMore: response.has_more,
          nextCursor: response.next_cursor,
          retryCount
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Only retry on transient errors
        if (this.isTransientError(lastError) && attempt < MAX_RETRIES) {
          retryCount++;
          console.log(`[TransactionSyncService] Transient error, retrying (attempt ${attempt + 1}/${MAX_RETRIES}): ${lastError.message}`);
          await this.delay(this.retryDelayMs * (attempt + 1)); // Exponential backoff
          continue;
        }

        throw lastError;
      }
    }

    throw lastError || new Error('Max retries exceeded');
  }

  /**
   * Check if error is transient (can be retried)
   */
  private isTransientError(error: Error): boolean {
    const transientPatterns = [
      'PLAID_TRANSIENT_ERROR',
      'ETIMEDOUT',
      'ECONNRESET',
      'ECONNREFUSED',
      'temporarily unavailable',
      'rate limit'
    ];

    return transientPatterns.some(pattern =>
      error.message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Convert Plaid transaction to domain Transaction entity
   */
  private convertPlaidTransaction(
    plaidTxn: PlaidTransaction,
    connection: Connection
  ): Transaction {
    // Handle foreign currency
    const currencyCode = plaidTxn.iso_currency_code || plaidTxn.unofficial_currency_code || 'USD';
    const hasOriginalCurrency = plaidTxn.original_currency_code !== null &&
                                plaidTxn.original_currency_code !== currencyCode;

    return createTransaction({
      id: uuidv4(),
      userId: connection.userId,
      connectionId: connection.id,
      plaidTransactionId: plaidTxn.transaction_id,
      accountId: plaidTxn.account_id,
      merchantName: plaidTxn.merchant_name,
      name: plaidTxn.name,
      amount: plaidTxn.amount,
      currencyCode,
      originalAmount: hasOriginalCurrency ? plaidTxn.original_amount : null,
      originalCurrencyCode: hasOriginalCurrency ? plaidTxn.original_currency_code : null,
      category: plaidTxn.category,
      date: new Date(plaidTxn.date),
      authorizedDate: plaidTxn.authorized_date ? new Date(plaidTxn.authorized_date) : null,
      status: plaidTxn.pending ? 'pending' : 'posted',
      pending: plaidTxn.pending
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
