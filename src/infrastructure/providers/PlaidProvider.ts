export interface PlaidConnection {
  id: string;
  userId: string;
  institutionId: string;
  institutionName: string;
  accessToken: string;
  createdAt: Date;
}

export interface PlaidTransaction {
  transaction_id: string;
  account_id: string;
  merchant_name: string | null;
  name: string;
  amount: number;
  iso_currency_code: string | null;
  unofficial_currency_code: string | null;
  original_amount: number | null;
  original_currency_code: string | null;
  category: string[];
  date: string;
  authorized_date: string | null;
  pending: boolean;
}

export interface TransactionsGetResponse {
  accounts: { account_id: string; name: string }[];
  transactions: PlaidTransaction[];
  total_transactions: number;
  has_more: boolean;
  next_cursor?: string;
}

export interface IPlaidProvider {
  revokeAllConnections(userId: string): Promise<number>;
  revokeConnection(accessToken: string): Promise<boolean>;
  syncConnection(accessToken: string): Promise<{ success: boolean; error?: string }>;
  getConnections(userId: string): Promise<PlaidConnection[]>;
  getTransactions(
    accessToken: string,
    startDate: Date,
    endDate: Date,
    cursor?: string
  ): Promise<TransactionsGetResponse>;
}

// Mock Plaid provider for MVP
export class MockPlaidProvider implements IPlaidProvider {
  private connections: Map<string, PlaidConnection[]> = new Map();
  private revokedConnections: Map<string, PlaidConnection[]> = new Map();
  private revokedTokens: Set<string> = new Set();
  private syncFailures: Set<string> = new Set();
  private mockTransactions: Map<string, PlaidTransaction[]> = new Map();
  private transientErrors: Map<string, number> = new Map(); // accessToken -> remaining failures

  async revokeAllConnections(userId: string): Promise<number> {
    const userConnections = this.connections.get(userId) || [];
    const count = userConnections.length;

    if (count > 0) {
      console.log(`[Plaid Mock] Revoking ${count} connections for user ${userId}`);
      this.revokedConnections.set(userId, [...userConnections]);
      for (const conn of userConnections) {
        this.revokedTokens.add(conn.accessToken);
      }
      this.connections.delete(userId);
    }

    return count;
  }

  async revokeConnection(accessToken: string): Promise<boolean> {
    console.log(`[Plaid Mock] Revoking connection with token ${accessToken}`);
    this.revokedTokens.add(accessToken);
    return true;
  }

  async syncConnection(accessToken: string): Promise<{ success: boolean; error?: string }> {
    if (this.syncFailures.has(accessToken)) {
      console.log(`[Plaid Mock] Sync failed for token ${accessToken}`);
      return { success: false, error: 'Connection sync failed: institution temporarily unavailable' };
    }
    console.log(`[Plaid Mock] Sync successful for token ${accessToken}`);
    return { success: true };
  }

  async getConnections(userId: string): Promise<PlaidConnection[]> {
    return this.connections.get(userId) || [];
  }

  async getTransactions(
    accessToken: string,
    startDate: Date,
    endDate: Date,
    cursor?: string
  ): Promise<TransactionsGetResponse> {
    // Check for transient errors (simulates network issues that can be retried)
    const remainingFailures = this.transientErrors.get(accessToken) || 0;
    if (remainingFailures > 0) {
      this.transientErrors.set(accessToken, remainingFailures - 1);
      throw new Error('PLAID_TRANSIENT_ERROR: Connection temporarily unavailable');
    }

    const allTransactions = this.mockTransactions.get(accessToken) || [];

    // Filter by date range
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    const filteredTransactions = allTransactions.filter(txn => {
      return txn.date >= startStr && txn.date <= endStr;
    });

    // Handle pagination (500 per page)
    const pageSize = 500;
    const cursorIndex = cursor ? parseInt(cursor, 10) : 0;
    const paginatedTransactions = filteredTransactions.slice(cursorIndex, cursorIndex + pageSize);
    const hasMore = cursorIndex + pageSize < filteredTransactions.length;

    console.log(`[Plaid Mock] getTransactions: ${paginatedTransactions.length} transactions (page starting at ${cursorIndex})`);

    return {
      accounts: [{ account_id: 'acc_1', name: 'Checking' }],
      transactions: paginatedTransactions,
      total_transactions: filteredTransactions.length,
      has_more: hasMore,
      next_cursor: hasMore ? String(cursorIndex + pageSize) : undefined
    };
  }

  // Test helpers
  addConnection(userId: string, connection: Omit<PlaidConnection, 'userId'>): void {
    const existing = this.connections.get(userId) || [];
    existing.push({ ...connection, userId });
    this.connections.set(userId, existing);
  }

  getRevokedConnections(userId: string): PlaidConnection[] {
    return this.revokedConnections.get(userId) || [];
  }

  isTokenRevoked(accessToken: string): boolean {
    return this.revokedTokens.has(accessToken);
  }

  setSyncFailure(accessToken: string, shouldFail: boolean): void {
    if (shouldFail) {
      this.syncFailures.add(accessToken);
    } else {
      this.syncFailures.delete(accessToken);
    }
  }

  clear(): void {
    this.connections.clear();
    this.revokedConnections.clear();
    this.revokedTokens.clear();
    this.syncFailures.clear();
    this.mockTransactions.clear();
    this.transientErrors.clear();
  }

  // Transaction test helpers
  setMockTransactions(accessToken: string, transactions: PlaidTransaction[]): void {
    this.mockTransactions.set(accessToken, transactions);
  }

  addMockTransaction(accessToken: string, transaction: PlaidTransaction): void {
    const existing = this.mockTransactions.get(accessToken) || [];
    existing.push(transaction);
    this.mockTransactions.set(accessToken, existing);
  }

  setTransientErrorCount(accessToken: string, errorCount: number): void {
    this.transientErrors.set(accessToken, errorCount);
  }

  generateMockTransactions(accessToken: string, count: number, startDate: Date): void {
    const transactions: PlaidTransaction[] = [];
    const currencies = ['USD', 'EUR', 'GBP', 'CAD'];

    // Spread transactions across 85 days max (within 90-day sync window)
    const daysSpread = Math.min(85, Math.ceil(count / 15));
    const txnsPerDay = Math.ceil(count / daysSpread);

    for (let i = 0; i < count; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() - Math.floor(i / txnsPerDay));

      const isForex = i % 10 === 0; // 10% are foreign currency
      const baseCurrency = 'USD';
      const foreignCurrency = currencies[Math.floor(Math.random() * currencies.length)];

      transactions.push({
        transaction_id: `plaid_txn_${accessToken}_${i}`,
        account_id: `acc_${(i % 3) + 1}`,
        merchant_name: `Merchant ${i % 20}`,
        name: `Transaction ${i}`,
        amount: Math.round((Math.random() * 500 + 1) * 100) / 100,
        iso_currency_code: baseCurrency,
        unofficial_currency_code: null,
        original_amount: isForex ? Math.round(Math.random() * 400 * 100) / 100 : null,
        original_currency_code: isForex ? foreignCurrency : null,
        category: ['Shopping', i % 2 === 0 ? 'Online' : 'Retail'],
        date: date.toISOString().split('T')[0],
        authorized_date: date.toISOString().split('T')[0],
        pending: i % 20 === 0 // 5% pending
      });
    }

    this.mockTransactions.set(accessToken, transactions);
  }
}
