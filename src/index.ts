import express from 'express';
import { loadConfig } from './config';
import { createAuthRouter } from './api/routes/auth';
import { createProfileRouter } from './api/routes/profile';
import { createConnectionRoutes } from './api/routes/connections';
import { AuthService } from './application/services/AuthService';
import { ProfileService } from './application/services/ProfileService';
import { ConnectionService } from './application/services/ConnectionService';
import { InMemoryUserRepository } from './infrastructure/repositories/UserRepository';
import { InMemorySessionRepository } from './infrastructure/repositories/SessionRepository';
import { InMemorySecurityEventRepository } from './infrastructure/repositories/SecurityEventRepository';
import { InMemoryConnectionRepository } from './infrastructure/repositories/ConnectionRepository';
import { InMemorySubscriptionRepository } from './infrastructure/repositories/SubscriptionRepository';
import { JWTTokenProvider } from './infrastructure/providers/TokenProvider';
import { BcryptPasswordProvider } from './infrastructure/providers/PasswordProvider';
import { SpeakeasyTwoFactorProvider, MockSMSProvider } from './infrastructure/providers/TwoFactorProvider';
import { MockEmailProvider } from './infrastructure/providers/EmailProvider';
import { MockPlaidProvider } from './infrastructure/providers/PlaidProvider';
import { MockAlertProvider } from './infrastructure/providers/AlertProvider';
import { InMemoryDomainEventEmitter } from './domain/events/DomainEvents';

export function createApp() {
  const config = loadConfig();
  const app = express();

  // Middleware
  app.use(express.json());

  // Initialize repositories
  const userRepository = new InMemoryUserRepository();
  const sessionRepository = new InMemorySessionRepository();
  const securityEventRepository = new InMemorySecurityEventRepository();
  const connectionRepository = new InMemoryConnectionRepository();
  const subscriptionRepository = new InMemorySubscriptionRepository();

  // Initialize providers
  const tokenProvider = new JWTTokenProvider(config.accessTokenSecret, config.refreshTokenSecret);
  const passwordProvider = new BcryptPasswordProvider();
  const twoFactorProvider = new SpeakeasyTwoFactorProvider();
  const smsProvider = new MockSMSProvider();
  const emailProvider = new MockEmailProvider();
  const plaidProvider = new MockPlaidProvider();
  const alertProvider = new MockAlertProvider();
  const domainEventEmitter = new InMemoryDomainEventEmitter();

  // Initialize services
  const authService = new AuthService(
    userRepository,
    sessionRepository,
    securityEventRepository,
    tokenProvider,
    passwordProvider,
    twoFactorProvider,
    smsProvider,
    emailProvider
  );

  const profileService = new ProfileService(
    userRepository,
    sessionRepository,
    emailProvider,
    plaidProvider
  );

  const connectionService = new ConnectionService(
    connectionRepository,
    subscriptionRepository,
    securityEventRepository,
    plaidProvider,
    alertProvider,
    domainEventEmitter
  );

  // Routes
  const authRouter = createAuthRouter(authService, tokenProvider);
  const profileRouter = createProfileRouter(profileService, tokenProvider);
  const connectionRouter = createConnectionRoutes(connectionService, tokenProvider);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/users', profileRouter);
  app.use('/api/v1/connections', connectionRouter);

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return {
    app,
    repositories: { userRepository, sessionRepository, securityEventRepository, connectionRepository, subscriptionRepository },
    providers: { tokenProvider, passwordProvider, twoFactorProvider, smsProvider, emailProvider, plaidProvider, alertProvider, domainEventEmitter },
    services: { authService, profileService, connectionService }
  };
}

// Only start server if this is the main module
if (require.main === module) {
  const config = loadConfig();
  const { app } = createApp();

  app.listen(config.port, () => {
    console.log(`Auth service running on port ${config.port}`);
  });
}
