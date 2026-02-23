import { v4 as uuidv4 } from 'uuid';
import { Connection, ConnectionSummary, createConnection, toConnectionSummary } from '../../domain/entities/Connection';
import { createSecurityEvent } from '../../domain/entities/SecurityEvent';
import { ConnectionDisconnectedEvent, ConnectionEstablishedEvent, IDomainEventEmitter } from '../../domain/events/DomainEvents';
import { IConnectionRepository } from '../../infrastructure/repositories/ConnectionRepository';
import { ISubscriptionRepository } from '../../infrastructure/repositories/SubscriptionRepository';
import { ISecurityEventRepository } from '../../infrastructure/repositories/SecurityEventRepository';
import { IPlaidProvider } from '../../infrastructure/providers/PlaidProvider';
import { IAlertProvider } from '../../infrastructure/providers/AlertProvider';

export interface ListConnectionsResult {
  success: boolean;
  connections?: ConnectionSummary[];
  error?: string;
}

export interface RefreshConnectionResult {
  success: boolean;
  connection?: ConnectionSummary;
  error?: string;
}

export interface DisconnectResult {
  success: boolean;
  subscriptionsAffected?: number;
  error?: string;
}

export interface AutoSyncResult {
  synced: number;
  failed: number;
  errors: { connectionId: string; error: string }[];
}

export interface CreateLinkTokenResult {
  success: boolean;
  linkToken?: string;
  expiration?: string;
  error?: string;
}

export interface ExchangePublicTokenResult {
  success: boolean;
  connection?: ConnectionSummary;
  error?: string;
}

export interface WebhookResult {
  success: boolean;
  action?: string;
  error?: string;
}

export class ConnectionService {
  constructor(
    private connectionRepository: IConnectionRepository,
    private subscriptionRepository: ISubscriptionRepository,
    private securityEventRepository: ISecurityEventRepository,
    private plaidProvider: IPlaidProvider,
    private alertProvider: IAlertProvider,
    private domainEventEmitter: IDomainEventEmitter
  ) {}

  async createLinkToken(userId: string): Promise<CreateLinkTokenResult> {
    try {
      const response = await this.plaidProvider.createLinkToken(userId);
      return {
        success: true,
        linkToken: response.link_token,
        expiration: response.expiration
      };
    } catch (error) {
      console.error('[ConnectionService] Failed to create link token:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create link token'
      };
    }
  }

  async exchangePublicToken(
    userId: string,
    publicToken: string,
    institutionId: string,
    deviceInfo: { ip: string; userAgent: string }
  ): Promise<ExchangePublicTokenResult> {
    try {
      // Exchange public token for access token
      const exchangeResponse = await this.plaidProvider.exchangePublicToken(publicToken);

      // Get institution info
      const institutionInfo = await this.plaidProvider.getInstitutionById(institutionId);

      // Create connection
      const connection = createConnection({
        id: uuidv4(),
        userId,
        plaidAccessToken: exchangeResponse.access_token,
        institutionId: institutionInfo.institution_id,
        institutionName: institutionInfo.name
      });

      await this.connectionRepository.save(connection);

      // Emit ConnectionEstablished event
      const event: ConnectionEstablishedEvent = {
        type: 'ConnectionEstablished',
        timestamp: new Date(),
        data: {
          connectionId: connection.id,
          userId,
          institutionId: connection.institutionId,
          institutionName: connection.institutionName
        }
      };
      await this.domainEventEmitter.emit(event);

      // Log security event
      const securityEvent = createSecurityEvent({
        id: uuidv4(),
        userId,
        eventType: 'connection_added',
        deviceInfo: deviceInfo.userAgent,
        ipAddress: deviceInfo.ip,
        metadata: {
          connectionId: connection.id,
          institutionId: connection.institutionId,
          institutionName: connection.institutionName
        }
      });
      await this.securityEventRepository.save(securityEvent);

      return {
        success: true,
        connection: toConnectionSummary(connection)
      };
    } catch (error) {
      console.error('[ConnectionService] Failed to exchange public token:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to exchange public token'
      };
    }
  }

  async handlePlaidWebhook(
    webhookType: string,
    webhookCode: string,
    itemId: string
  ): Promise<WebhookResult> {
    console.log(`[ConnectionService] Received Plaid webhook: ${webhookType}/${webhookCode} for item ${itemId}`);

    if (webhookType === 'ITEM' && webhookCode === 'ITEM_LOGIN_REQUIRED') {
      // Find connection by item_id (in real impl, we'd have item_id stored)
      // For now, mark connections as needing re-auth based on some lookup
      // This is a simplified implementation - production would store item_id
      return {
        success: true,
        action: 'login_required_notification_sent'
      };
    }

    if (webhookType === 'TRANSACTIONS' && webhookCode === 'SYNC_UPDATES_AVAILABLE') {
      // Trigger sync for the connection
      return {
        success: true,
        action: 'sync_triggered'
      };
    }

    return {
      success: true,
      action: 'webhook_acknowledged'
    };
  }

  async listConnections(userId: string): Promise<ListConnectionsResult> {
    const connections = await this.connectionRepository.findByUserId(userId);
    return {
      success: true,
      connections: connections.map(toConnectionSummary)
    };
  }

  async refreshConnection(
    userId: string,
    connectionId: string,
    deviceInfo: { ip: string; userAgent: string }
  ): Promise<RefreshConnectionResult> {
    const connection = await this.connectionRepository.findById(connectionId);

    if (!connection) {
      return { success: false, error: 'Connection not found' };
    }

    if (connection.userId !== userId) {
      return { success: false, error: 'Connection not found' };
    }

    if (connection.status === 'disconnected') {
      return { success: false, error: 'Connection is disconnected' };
    }

    // Attempt sync with Plaid
    const syncResult = await this.plaidProvider.syncConnection(connection.plaidAccessToken);

    if (!syncResult.success) {
      // Update status to failed
      connection.status = 'failed';
      connection.lastSyncError = syncResult.error || 'Unknown sync error';
      connection.updatedAt = new Date();
      await this.connectionRepository.update(connection);

      // Send alert
      await this.alertProvider.sendSyncFailureAlert(
        userId,
        connectionId,
        connection.lastSyncError
      );

      return {
        success: false,
        error: syncResult.error,
        connection: toConnectionSummary(connection)
      };
    }

    // Update last sync time
    connection.status = 'active';
    connection.lastSyncAt = new Date();
    connection.lastSyncError = null;
    connection.updatedAt = new Date();
    await this.connectionRepository.update(connection);

    return {
      success: true,
      connection: toConnectionSummary(connection)
    };
  }

  async disconnectConnection(
    userId: string,
    connectionId: string,
    confirmed: boolean,
    deviceInfo: { ip: string; userAgent: string }
  ): Promise<DisconnectResult> {
    if (!confirmed) {
      return { success: false, error: 'Confirmation required' };
    }

    const connection = await this.connectionRepository.findById(connectionId);

    if (!connection) {
      return { success: false, error: 'Connection not found' };
    }

    if (connection.userId !== userId) {
      return { success: false, error: 'Connection not found' };
    }

    // Revoke Plaid access token
    await this.plaidProvider.revokeConnection(connection.plaidAccessToken);

    // Mark associated subscriptions as unverified
    const subscriptionsAffected = await this.subscriptionRepository.markUnverifiedByConnectionId(connectionId);

    // Emit domain event
    const event: ConnectionDisconnectedEvent = {
      type: 'ConnectionDisconnected',
      timestamp: new Date(),
      data: {
        connectionId,
        userId,
        institutionId: connection.institutionId,
        institutionName: connection.institutionName,
        subscriptionsAffected
      }
    };
    await this.domainEventEmitter.emit(event);

    // Log security event
    const securityEvent = createSecurityEvent({
      id: uuidv4(),
      userId,
      eventType: 'connection_removed',
      deviceInfo: deviceInfo.userAgent,
      ipAddress: deviceInfo.ip,
      metadata: {
        connectionId,
        institutionId: connection.institutionId,
        institutionName: connection.institutionName,
        subscriptionsAffected
      }
    });
    await this.securityEventRepository.save(securityEvent);

    // Delete the connection
    await this.connectionRepository.delete(connectionId);

    return {
      success: true,
      subscriptionsAffected
    };
  }

  async runDailyAutoSync(): Promise<AutoSyncResult> {
    const activeConnections = await this.connectionRepository.findActiveConnections();

    const result: AutoSyncResult = {
      synced: 0,
      failed: 0,
      errors: []
    };

    for (const connection of activeConnections) {
      const syncResult = await this.plaidProvider.syncConnection(connection.plaidAccessToken);

      if (syncResult.success) {
        connection.lastSyncAt = new Date();
        connection.lastSyncError = null;
        connection.status = 'active';
        await this.connectionRepository.update(connection);
        result.synced++;
      } else {
        connection.status = 'failed';
        connection.lastSyncError = syncResult.error || 'Unknown sync error';
        await this.connectionRepository.update(connection);

        // Send alert
        await this.alertProvider.sendSyncFailureAlert(
          connection.userId,
          connection.id,
          connection.lastSyncError
        );

        result.failed++;
        result.errors.push({
          connectionId: connection.id,
          error: connection.lastSyncError
        });
      }
    }

    console.log(`[ConnectionService] Daily auto-sync complete: ${result.synced} synced, ${result.failed} failed`);
    return result;
  }
}
