export type TransactionStatus = 'pending' | 'posted' | 'cancelled';

export interface Transaction {
  id: string;
  userId: string;
  connectionId: string;
  plaidTransactionId: string;
  accountId: string;
  merchantName: string | null;
  name: string;
  amount: number;
  currencyCode: string;
  originalAmount: number | null;
  originalCurrencyCode: string | null;
  category: string[];
  date: Date;
  authorizedDate: Date | null;
  status: TransactionStatus;
  pending: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTransactionParams {
  id: string;
  userId: string;
  connectionId: string;
  plaidTransactionId: string;
  accountId: string;
  merchantName?: string | null;
  name: string;
  amount: number;
  currencyCode: string;
  originalAmount?: number | null;
  originalCurrencyCode?: string | null;
  category?: string[];
  date: Date;
  authorizedDate?: Date | null;
  status?: TransactionStatus;
  pending?: boolean;
}

export function createTransaction(params: CreateTransactionParams): Transaction {
  const isForeignCurrency = params.originalCurrencyCode &&
    params.originalCurrencyCode !== params.currencyCode;

  return {
    id: params.id,
    userId: params.userId,
    connectionId: params.connectionId,
    plaidTransactionId: params.plaidTransactionId,
    accountId: params.accountId,
    merchantName: params.merchantName ?? null,
    name: params.name,
    amount: params.amount,
    currencyCode: params.currencyCode,
    originalAmount: isForeignCurrency ? (params.originalAmount ?? null) : null,
    originalCurrencyCode: isForeignCurrency ? (params.originalCurrencyCode ?? null) : null,
    category: params.category ?? [],
    date: params.date,
    authorizedDate: params.authorizedDate ?? null,
    status: params.status ?? 'posted',
    pending: params.pending ?? false,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

export interface TransactionSummary {
  id: string;
  merchantName: string | null;
  name: string;
  amount: number;
  currencyCode: string;
  originalAmount: number | null;
  originalCurrencyCode: string | null;
  category: string[];
  date: Date;
  pending: boolean;
}

export function toTransactionSummary(txn: Transaction): TransactionSummary {
  return {
    id: txn.id,
    merchantName: txn.merchantName,
    name: txn.name,
    amount: txn.amount,
    currencyCode: txn.currencyCode,
    originalAmount: txn.originalAmount,
    originalCurrencyCode: txn.originalCurrencyCode,
    category: txn.category,
    date: txn.date,
    pending: txn.pending
  };
}
