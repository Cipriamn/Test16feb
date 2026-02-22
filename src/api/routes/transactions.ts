import { Router, Request, Response } from 'express';
import { TransactionSyncService } from '../../application/services/TransactionSyncService';
import { ITransactionRepository } from '../../infrastructure/repositories/TransactionRepository';
import { toTransactionSummary } from '../../domain/entities/Transaction';

export interface AuthenticatedRequest extends Request {
  userId?: string;
}

export function createTransactionRoutes(
  transactionSyncService: TransactionSyncService,
  transactionRepository: ITransactionRepository
): Router {
  const router = Router();

  /**
   * POST /api/v1/transactions/sync
   * Trigger manual sync for a connection
   */
  router.post('/sync', async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.userId;
    const { connectionId } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!connectionId) {
      return res.status(400).json({ error: 'connectionId is required' });
    }

    const result = await transactionSyncService.syncConnection(connectionId);

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        syncType: result.syncType,
        transactionsInserted: result.transactionsInserted,
        duplicatesSkipped: result.duplicatesSkipped
      });
    }

    return res.status(200).json({
      success: true,
      connectionId: result.connectionId,
      syncType: result.syncType,
      transactionsInserted: result.transactionsInserted,
      duplicatesSkipped: result.duplicatesSkipped,
      totalFetched: result.totalFetched,
      transactionIds: result.transactionIds
    });
  });

  /**
   * GET /api/v1/transactions
   * List transactions for authenticated user
   */
  router.get('/', async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.userId;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const transactions = await transactionRepository.findByUserId(userId, limit, offset);
    const total = await transactionRepository.countByUserId(userId);

    return res.status(200).json({
      transactions: transactions.map(toTransactionSummary),
      total,
      limit,
      offset
    });
  });

  /**
   * GET /api/v1/transactions/:id
   * Get single transaction by ID
   */
  router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.userId;
    const id = req.params.id as string;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const transaction = await transactionRepository.findById(id);

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (transaction.userId !== userId) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    return res.status(200).json(toTransactionSummary(transaction));
  });

  return router;
}
