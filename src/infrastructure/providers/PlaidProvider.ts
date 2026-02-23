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

export interface LinkTokenCreateResponse {
  link_token: string;
  expiration: string;
  request_id: string;
}

export interface PublicTokenExchangeResponse {
  access_token: string;
  item_id: string;
  request_id: string;
}

export interface InstitutionInfo {
  institution_id: string;
  name: string;
}

export interface IPlaidProvider {
  createLinkToken(userId: string): Promise<LinkTokenCreateResponse>;
  exchangePublicToken(publicToken: string): Promise<PublicTokenExchangeResponse>;
  getInstitutionById(institutionId: string): Promise<InstitutionInfo>;
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
  private linkTokens: Map<string, { userId: string; expiration: Date }> = new Map();
  private publicTokens: Map<string, { accessToken: string; itemId: string; institutionId: string }> = new Map();
  private institutions: Map<string, string> = new Map([
    ['ins_1', 'Chase'],
    ['ins_2', 'Bank of America'],
    ['ins_3', 'Wells Fargo'],
    ['ins_4', 'Citi'],
    ['ins_5', 'Capital One']
  ]);

  async createLinkToken(userId: string): Promise<LinkTokenCreateResponse> {
    const linkToken = `link-token-${userId}-${Date.now()}`;
    const expiration = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    this.linkTokens.set(linkToken, { userId, expiration });
    console.log(`[Plaid Mock] Created link token for user ${userId}`);
    return {
      link_token: linkToken,
      expiration: expiration.toISOString(),
      request_id: `req-${Date.now()}`
    };
  }

  async exchangePublicToken(publicToken: string): Promise<PublicTokenExchangeResponse> {
    const tokenData = this.publicTokens.get(publicToken);
    if (!tokenData) {
      throw new Error('INVALID_PUBLIC_TOKEN: Public token not found or expired');
    }
    console.log(`[Plaid Mock] Exchanged public token for access token`);
    this.publicTokens.delete(publicToken);
    return {
      access_token: tokenData.accessToken,
      item_id: tokenData.itemId,
      request_id: `req-${Date.now()}`
    };
  }

  async getInstitutionById(institutionId: string): Promise<InstitutionInfo> {
    const name = this.institutions.get(institutionId) || 'Unknown Bank';
    return {
      institution_id: institutionId,
      name
    };
  }

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
    this.linkTokens.clear();
    this.publicTokens.clear();
  }

  // Test helper for simulating Plaid Link callback
  setMockPublicToken(publicToken: string, accessToken: string, itemId: string, institutionId: string): void {
    this.publicTokens.set(publicToken, { accessToken, itemId, institutionId });
  }

  // Test helper for adding custom institutions
  addInstitution(institutionId: string, name: string): void {
    this.institutions.set(institutionId, name);
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
