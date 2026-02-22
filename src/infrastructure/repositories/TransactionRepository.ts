import { Transaction } from '../../domain/entities/Transaction';

export interface BulkInsertResult {
  inserted: number;
  duplicatesSkipped: number;
  transactionIds: string[];
}

export interface ITransactionRepository {
  save(transaction: Transaction): Promise<Transaction>;
  bulkInsert(transactions: Transaction[]): Promise<BulkInsertResult>;
  findById(id: string): Promise<Transaction | null>;
  findByUserId(userId: string, limit?: number, offset?: number): Promise<Transaction[]>;
  findByConnectionId(connectionId: string): Promise<Transaction[]>;
  findByPlaidTransactionId(plaidTransactionId: string): Promise<Transaction | null>;
  findByPlaidTransactionIds(plaidTransactionIds: string[]): Promise<Transaction[]>;
  getLatestTransactionDate(connectionId: string): Promise<Date | null>;
  countByUserId(userId: string): Promise<number>;
  deleteByUserId(userId: string): Promise<number>;
  deleteByConnectionId(connectionId: string): Promise<number>;
}

// In-memory implementation for MVP with bulk insert optimization
export class InMemoryTransactionRepository implements ITransactionRepository {
  private transactions: Map<string, Transaction> = new Map();
  private plaidIdIndex: Map<string, string> = new Map(); // plaidTransactionId -> id

  async save(transaction: Transaction): Promise<Transaction> {
    // Check for duplicate by plaid transaction ID
    const existingId = this.plaidIdIndex.get(transaction.plaidTransactionId);
    if (existingId && existingId !== transaction.id) {
      throw new Error(`Duplicate transaction with plaid_transaction_id: ${transaction.plaidTransactionId}`);
    }

    this.transactions.set(transaction.id, { ...transaction });
    this.plaidIdIndex.set(transaction.plaidTransactionId, transaction.id);
    return transaction;
  }

  async bulkInsert(transactions: Transaction[]): Promise<BulkInsertResult> {
    const result: BulkInsertResult = {
      inserted: 0,
      duplicatesSkipped: 0,
      transactionIds: []
    };

    // Batch processing for performance
    const batchSize = 100;
    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);

      for (const txn of batch) {
        // Check for duplicate by plaid transaction ID
        if (this.plaidIdIndex.has(txn.plaidTransactionId)) {
          result.duplicatesSkipped++;
          continue;
        }

        this.transactions.set(txn.id, { ...txn });
        this.plaidIdIndex.set(txn.plaidTransactionId, txn.id);
        result.inserted++;
        result.transactionIds.push(txn.id);
      }
    }

    return result;
  }

  async findById(id: string): Promise<Transaction | null> {
    return this.transactions.get(id) || null;
  }

  async findByUserId(userId: string, limit?: number, offset?: number): Promise<Transaction[]> {
    const userTxns = Array.from(this.transactions.values())
      .filter(t => t.userId === userId)
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    if (offset !== undefined && limit !== undefined) {
      return userTxns.slice(offset, offset + limit);
    }
    if (limit !== undefined) {
      return userTxns.slice(0, limit);
    }
    return userTxns;
  }

  async findByConnectionId(connectionId: string): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .filter(t => t.connectionId === connectionId)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  async findByPlaidTransactionId(plaidTransactionId: string): Promise<Transaction | null> {
    const id = this.plaidIdIndex.get(plaidTransactionId);
    if (!id) return null;
    return this.transactions.get(id) || null;
  }

  async findByPlaidTransactionIds(plaidTransactionIds: string[]): Promise<Transaction[]> {
    const results: Transaction[] = [];
    for (const plaidId of plaidTransactionIds) {
      const id = this.plaidIdIndex.get(plaidId);
      if (id) {
        const txn = this.transactions.get(id);
        if (txn) results.push(txn);
      }
    }
    return results;
  }

  async getLatestTransactionDate(connectionId: string): Promise<Date | null> {
    const txns = Array.from(this.transactions.values())
      .filter(t => t.connectionId === connectionId);

    if (txns.length === 0) return null;

    return txns.reduce((latest, txn) =>
      txn.date > latest ? txn.date : latest, txns[0].date);
  }

  async countByUserId(userId: string): Promise<number> {
    return Array.from(this.transactions.values())
      .filter(t => t.userId === userId).length;
  }

  async deleteByUserId(userId: string): Promise<number> {
    let deleted = 0;
    for (const [id, txn] of this.transactions.entries()) {
      if (txn.userId === userId) {
        this.plaidIdIndex.delete(txn.plaidTransactionId);
        this.transactions.delete(id);
        deleted++;
      }
    }
    return deleted;
  }

  async deleteByConnectionId(connectionId: string): Promise<number> {
    let deleted = 0;
    for (const [id, txn] of this.transactions.entries()) {
      if (txn.connectionId === connectionId) {
        this.plaidIdIndex.delete(txn.plaidTransactionId);
        this.transactions.delete(id);
        deleted++;
      }
    }
    return deleted;
  }

  // Test helpers
  clear(): void {
    this.transactions.clear();
    this.plaidIdIndex.clear();
  }

  addTransaction(transaction: Transaction): void {
    this.transactions.set(transaction.id, { ...transaction });
    this.plaidIdIndex.set(transaction.plaidTransactionId, transaction.id);
  }

  getAll(): Transaction[] {
    return Array.from(this.transactions.values());
  }
}
