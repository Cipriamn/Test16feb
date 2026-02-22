# AskTrim Implementation Issues (Team-Scoped)

**Document Version:** 1.0
**Last Updated:** 2026-02-17
**Derived From:** requirements.md
**Team Structure:** DB (Dev→Tester), Backend (Dev→Tester), Mobile (Dev→Tester)

---

## Table of Contents

1. [Issue Dependency Graph](#issue-dependency-graph)
2. [DB Team Issues](#db-team-issues)
3. [Backend Team Issues](#backend-team-issues)
4. [Mobile Team Issues](#mobile-team-issues)

---

## Issue Dependency Graph

```
DB-001 (User Schema) ──┬──> BE-001 (User Registration)
                       ├──> BE-002 (Authentication)
                       └──> BE-003 (Profile Management)

DB-002 (Connection Schema) ──┬──> BE-004 (Plaid Integration)
                             └──> BE-005 (Connection Lifecycle)

DB-003 (Transaction Schema) ──> BE-006 (Transaction Sync)

DB-004 (Subscription Schema) ──┬──> BE-007 (Subscription Detection) ──> MOB-001 (Dashboard UI)
                               ├──> BE-008 (Subscription CRUD) ──> MOB-002 (Subscription List)
                               └──> BE-009 (Categorization)

DB-005 (Cancellation Schema) ──┬──> BE-010 (Cancellation Requests) ──> MOB-003 (Cancellation UI)
                               └──> BE-011 (Cancellation Tracking)

DB-006 (Notification Schema) ──┬──> BE-012 (Alert Engine) ──> MOB-004 (Push Notifications)
                               └──> BE-013 (Notification Preferences)

DB-007 (Analytics Schema) ──> BE-014 (Dashboard Aggregation) ──> MOB-005 (Insights UI)

DB-008 (Negotiation Schema) ──┬──> BE-015 (Negotiation Requests) ──> MOB-006 (Bill Upload UI)
                              └──> BE-016 (Negotiation Tracking)

DB-009 (Security Schema) ──> BE-017 (Audit Logging) ──> MOB-007 (Security Activity UI)

BE-002 (Authentication) ──> MOB-008 (Login/OAuth UI)
BE-003 (Profile Management) ──> MOB-009 (Settings UI)
```

---

## DB Team Issues

### DB-001: User and Identity Schema
**Assignee:** DB Dev
**Requirements:** REQ-BE-001, REQ-BE-002, REQ-BE-003, REQ-BE-004, REQ-BE-005, REQ-BE-006, REQ-BE-007, REQ-DB-001 (implicit)
**Priority:** Critical
**Estimate:** 5 story points

**Context:**
Foundation for all user-related operations. Must support authentication, profile, consents, and 2FA.

**Description:**
Design and implement database schema for User, Credential, Consent, TwoFactorAuth, and AuthSession entities.

**Acceptance Criteria:**
- `users` table with: `id` (UUID), `email` (unique, indexed), `name`, `phone`, `address`, `timezone`, `profile_photo_url`, `created_at`, `updated_at`
- `credentials` table with: `id`, `user_id` (FK), `provider` (email/google/facebook), `password_hash` (bcrypt), `oauth_provider_id`, `created_at`
- `consents` table with: `id`, `user_id` (FK), `terms_version`, `accepted_at`
- `two_factor_auth` table with: `id`, `user_id` (FK), `method` (sms/totp), `secret` (encrypted), `backup_codes` (encrypted), `enabled`, `created_at`
- `auth_sessions` table with: `id`, `user_id` (FK), `token_hash`, `device_info`, `ip_address`, `location`, `expires_at`, `created_at`
- All foreign keys enforce ON DELETE CASCADE for user deletion
- Indexes: `users.email`, `credentials.user_id`, `auth_sessions.user_id + expires_at`
- Migration scripts with rollback support

**Test Criteria (DB-TEST-001):**
- Verify all constraints (NOT NULL, UNIQUE, FK)
- Test cascade deletes remove credentials, consents, 2FA, sessions
- Validate indexes exist and improve query performance
- Check encryption is enforced for sensitive columns (password_hash, 2FA secret)
- Load test: insert 10,000 users and query by email in <100ms
- Test report documenting validation results
- Performance benchmark results logged
- Sign-off on DB-001 completion

**Definition of Done:**
- Schema migration files created and tested
- Seed data for testing (5+ users)
- Documentation of constraints and indexes
- Reviewed by DB Tester
- All test criteria passed
**Blocking:** None
**Blocked By:** None

---

### DB-002: Financial Connection Schema
**Assignee:** DB Dev
**Requirements:** REQ-DB-001 (Connection), REQ-BE-008, REQ-BE-009, REQ-BE-011
**Priority:** Critical
**Estimate:** 3 story points

**Context:**
Stores Plaid connection metadata and account identifiers.

**Description:**
Design and implement schema for Connection and linked FinancialAccount entities.

**Acceptance Criteria:**
- `connections` table with: `id`, `user_id` (FK), `institution_id`, `institution_name`, `access_token` (encrypted AES-256), `status` (active/failed/disconnected), `last_sync_at`, `created_at`, `updated_at`
- `financial_accounts` table with: `id`, `connection_id` (FK), `account_id` (Plaid), `account_type` (checking/savings/credit), `mask`, `name`, `created_at`
- Indexes: `connections.user_id + status`, `financial_accounts.connection_id`
- Constraints: `access_token` must be encrypted before storage
- Migration with rollback

**Test Criteria (DB-TEST-002):**
- Verify `access_token` encryption
- Test cascade delete: disconnecting connection removes financial_accounts
- Validate user can have unlimited connections
- Test query performance: fetch all connections for user in <50ms
- Test report with validation results
- Encryption verification documented
- Sign-off on DB-002 completion

**Definition of Done:**
- Schema migration files created
- Seed data for testing (multiple connections per user)
- Documentation of encryption strategy
- Reviewed by DB Tester
- All test criteria passed
**Blocking:** None
**Blocked By:** None

---

### DB-003: Transaction Schema
**Assignee:** DB Dev
**Requirements:** REQ-DB-002, REQ-BE-010
**Priority:** Critical
**Estimate:** 4 story points

**Context:**
Stores raw transaction data from Plaid for subscription detection and analytics.

**Description:**
Design and implement schema for Transaction entities with support for large datasets and foreign currencies.

**Acceptance Criteria:**
- `transactions` table with: `id`, `connection_id` (FK), `account_id` (FK to financial_accounts), `transaction_id` (Plaid), `amount`, `currency` (ISO 4217), `date`, `merchant_name`, `description`, `category` (Plaid category), `pending`, `created_at`
- Composite index: `connection_id + date DESC`
- Unique constraint: `transaction_id` (Plaid ID)
- Partition by `date` (monthly partitions for scalability)
- Migration with rollback

**Test Criteria (DB-TEST-003):**
- Verify composite index improves date range queries
- Test bulk insert: 10,000 transactions in <5 seconds
- Validate partitioning: queries restricted to single partition execute in <100ms
- Test foreign currency handling (non-USD amounts)
- Test report with performance benchmarks
- Partitioning validation documented
- Sign-off on DB-003 completion

**Definition of Done:**
- Schema migration files created
- Seed data for testing (1000+ transactions across multiple accounts)
- Documentation of partitioning strategy
- Reviewed by DB Tester
- All test criteria passed
**Blocking:** None
**Blocked By:** None

---

### DB-004: Subscription Schema
**Assignee:** DB Dev
**Requirements:** REQ-DB-003, REQ-DB-004, REQ-BE-013, REQ-BE-015, REQ-BE-017, REQ-BE-018, REQ-BE-019
**Priority:** High
**Estimate:** 5 story points

**Context:**
Core domain model for Subscription aggregate with categorization and status tracking.

**Description:**
Design and implement schema for Subscription, Category, and SubscriptionHistory entities.

**Acceptance Criteria:**
- `subscriptions` table with: `id`, `user_id` (FK), `connection_id` (FK), `account_id` (FK), `name`, `merchant_name`, `amount`, `currency`, `frequency` (monthly/annual/custom), `next_billing_date`, `status` (active/inactive/cancelled), `category_id` (FK), `is_manual`, `created_at`, `updated_at`
- `categories` table with: `id`, `name`, `user_id` (FK, nullable for default categories), `is_default`, `created_at`
- `subscription_history` table with: `id`, `subscription_id` (FK), `transaction_id` (FK), `amount`, `charged_at`
- Indexes: `subscriptions.user_id + status`, `subscriptions.next_billing_date`, `subscription_history.subscription_id`
- Seed default categories: Entertainment, Utilities, Software, Health, Other
- Migration with rollback

**Test Criteria (DB-TEST-004):**
- Verify user can create custom categories
- Test cascade delete: user deletion removes custom categories and subscriptions
- Validate subscription history links to transactions
- Test aggregation: calculate monthly total for user in <200ms
- Test query: fetch active subscriptions with next_billing_date in next 7 days in <100ms
- Test report with query performance benchmarks
- Category relationship validation documented
- Sign-off on DB-004 completion

**Definition of Done:**
- Schema migration files created
- Seed data: default categories and 20+ test subscriptions
- Documentation of frequency enum and status lifecycle
- Reviewed by DB Tester
- All test criteria passed
**Blocking:** None
**Blocked By:** None

---

### DB-005: Cancellation Schema
**Assignee:** DB Dev
**Requirements:** REQ-DB-005, REQ-DB-006, REQ-BE-023, REQ-BE-025, REQ-BE-027
**Priority:** High
**Estimate:** 3 story points

**Context:**
Tracks cancellation requests, status transitions, and post-cancellation disputes.

**Description:**
Design and implement schema for CancellationRequest and Dispute entities.

**Acceptance Criteria:**
- `cancellation_requests` table with: `id`, `user_id` (FK), `subscription_id` (FK), `status` (pending/in_progress/completed/failed), `requested_at`, `completed_at`, `confirmation_number`, `notes`
- `disputes` table with: `id`, `cancellation_request_id` (FK), `transaction_id` (FK), `status` (submitted/investigating/resolved/rejected), `created_at`, `resolved_at`
- Indexes: `cancellation_requests.user_id + status`, `disputes.cancellation_request_id`
- Migration with rollback

**Test Criteria (DB-TEST-005):**
- Verify cancellation_request.status transitions are valid
- Test dispute linkage to transactions
- Validate query: fetch all pending cancellations for user in <50ms
- Test report with validation results
- Status transition matrix documented
- Sign-off on DB-005 completion

**Definition of Done:**
- Schema migration files created
- Seed data for testing (various statuses)
- Documentation of status transitions
- Reviewed by DB Tester
- All test criteria passed
**Blocking:** None
**Blocked By:** None

---

### DB-006: Notification Schema
**Assignee:** DB Dev
**Requirements:** REQ-DB-007, REQ-BE-028, REQ-BE-032
**Priority:** Medium
**Estimate:** 3 story points

**Context:**
Stores user notification preferences and alert delivery tracking.

**Description:**
Design and implement schema for NotificationPreference and Alert entities.

**Acceptance Criteria:**
- `notification_preferences` table with: `id`, `user_id` (FK), `alert_type` (renewal/price_increase/new_subscription/large_transaction/fee), `channels` (JSON: {push, email, sms}), `enabled`, `timing` (days_before for renewals), `quiet_hours_start`, `quiet_hours_end`, `created_at`, `updated_at`
- `alerts` table with: `id`, `user_id` (FK), `alert_type`, `subscription_id` (FK, nullable), `transaction_id` (FK, nullable), `message`, `sent_at`, `channels_sent` (JSON), `status` (sent/failed/dismissed)
- Unique constraint: `user_id + alert_type` (one preference per type)
- Index: `alerts.user_id + sent_at DESC`
- Migration with rollback

**Test Criteria (DB-TEST-006):**
- Verify unique constraint on user_id + alert_type
- Test JSON channels field stores and queries correctly
- Validate query: fetch all sent alerts for user in last 30 days in <100ms
- Test report with validation results
- JSON schema examples documented
- Sign-off on DB-006 completion

**Definition of Done:**
- Schema migration files created
- Seed data: default notification preferences for test users
- Documentation of alert_type enum and channel JSON structure
- Reviewed by DB Tester
- All test criteria passed
**Blocking:** None
**Blocked By:** None

---

### DB-007: Analytics Read Models
**Assignee:** DB Dev
**Requirements:** REQ-DB-008, REQ-BE-033, REQ-BE-034, REQ-BE-035
**Priority:** Medium
**Estimate:** 4 story points

**Context:**
Materialized views for optimizing Dashboard and analytics queries (CQRS read models).

**Description:**
Design and implement materialized views or denormalized tables for dashboard aggregations.

**Acceptance Criteria:**
- Materialized view `dashboard_metrics` with: `user_id`, `total_monthly_cost`, `total_annual_cost`, `active_subscription_count`, `highest_cost_subscription_id`, `newest_subscription_id`, `last_calculated_at`
- Materialized view `category_spending` with: `user_id`, `category_id`, `month`, `total_amount`, `subscription_count`
- Refresh strategy: trigger-based or scheduled (every 5 minutes)
- Indexes: `dashboard_metrics.user_id`, `category_spending.user_id + month`
- Migration with rollback

**Test Criteria (DB-TEST-007):**
- Verify dashboard_metrics accurately sums subscription amounts
- Test refresh: views update within 1 minute of subscription change
- Validate query: fetch dashboard for user in <50ms
- Test category_spending: monthly totals match raw subscription data
- Test report with accuracy and performance results
- Refresh timing benchmarks documented
- Sign-off on DB-007 completion

**Definition of Done:**
- Materialized views created with refresh logic
- Seed data populated
- Documentation of refresh strategy
- Reviewed by DB Tester
- All test criteria passed
**Blocking:** None
**Blocked By:** DB-004 (depends on subscriptions table)

---

### DB-008: Negotiation Schema
**Assignee:** DB Dev
**Requirements:** REQ-DB-009, REQ-BE-039, REQ-BE-040, REQ-BE-041, REQ-BE-042
**Priority:** Medium
**Estimate:** 3 story points

**Context:**
Tracks bill negotiation requests, uploaded documents, and outcomes.

**Description:**
Design and implement schema for NegotiationRequest and BillDocument entities.

**Acceptance Criteria:**
- `negotiation_requests` table with: `id`, `user_id` (FK), `bill_type` (cable/internet/phone/utilities), `provider_name`, `status` (submitted/in_negotiation/completed/unsuccessful), `original_amount`, `negotiated_amount`, `annual_savings`, `success_fee`, `promotional_duration_months`, `requested_at`, `completed_at`, `notes`
- `bill_documents` table with: `id`, `negotiation_request_id` (FK), `file_url` (S3), `file_type` (pdf/image), `ocr_data` (JSON), `uploaded_at`
- Indexes: `negotiation_requests.user_id + status`, `bill_documents.negotiation_request_id`
- Migration with rollback

**Test Criteria (DB-TEST-008):**
- Verify OCR JSON field stores extracted bill data
- Test cascade delete: negotiation_request deletion removes bill_documents
- Validate query: fetch all completed negotiations for user in <100ms
- Test success_fee calculation: 15% of annual_savings
- Test report with validation results
- OCR JSON schema examples documented
- Sign-off on DB-008 completion

**Definition of Done:**
- Schema migration files created
- Seed data for testing (various statuses and bill types)
- Documentation of bill_type enum and OCR JSON structure
- Reviewed by DB Tester
- All test criteria passed
**Blocking:** None
**Blocked By:** None

---

### DB-009: Security Audit Schema
**Assignee:** DB Dev
**Requirements:** REQ-DB-010, REQ-BE-045, REQ-BE-046
**Priority:** Medium
**Estimate:** 2 story points

**Context:**
Stores security events for compliance and anomaly detection.

**Description:**
Design and implement schema for SecurityEvent entities with long-term retention.

**Acceptance Criteria:**
- `security_events` table with: `id`, `user_id` (FK), `event_type` (login_success/login_failed/password_changed/connection_added/connection_removed/2fa_enabled/2fa_disabled), `device_info` (JSON), `ip_address`, `location` (JSON: {city, country}), `created_at`
- Partition by `created_at` (monthly partitions)
- Index: `user_id + created_at DESC`
- Retention policy: 2 years minimum
- Migration with rollback

**Test Criteria (DB-TEST-009):**
- Verify partitioning improves query performance for date ranges
- Test bulk insert: 1000 security events in <2 seconds
- Validate query: fetch user's login history (last 30 days) in <100ms
- Test retention: events older than 2 years can be archived/deleted
- Test report with performance benchmarks
- Partitioning and retention validation documented
- Sign-off on DB-009 completion

**Definition of Done:**
- Schema migration files created
- Seed data for testing (multiple event types)
- Documentation of event_type enum and retention policy
- Reviewed by DB Tester
- All test criteria passed
**Blocking:** None
**Blocked By:** None

---

### BE-002: Authentication Service
**Assignee:** Backend Dev
**Requirements:** REQ-BE-002, REQ-BE-003, REQ-BE-004
**Priority:** Critical
**Estimate:** 5 story points

**Context:**
Implement login, 2FA enforcement, password management, and session handling.

**Description:**
Build authentication service with JWT-based sessions and 2FA support.

**Acceptance Criteria:**
- REST endpoint: `POST /api/v1/auth/login`
- Request body: `{email, password?, oauth_token?, totp_code?}`
- Verify credentials (bcrypt compare or OAuth token)
- If 2FA enabled, require `totp_code` or SMS code
- Issue JWT (24h expiration) and refresh token (30d expiration)
- Create AuthSession entity with device info and location
- Log SecurityEvent (login_success/login_failed)
- Return 401 for invalid credentials
- REST endpoint: `POST /api/v1/auth/logout` (revoke session)
- REST endpoint: `POST /api/v1/auth/refresh` (renew JWT from refresh token)
- REST endpoint: `POST /api/v1/auth/password/change` (require current password)
- REST endpoint: `POST /api/v1/auth/password/reset` (send email reset link)

**Test Criteria (BE-TEST-002):**
- Test email/password login success
- Test invalid password returns 401
- Test 2FA required if enabled
- Test invalid TOTP code rejected
- Test JWT expiration after 24h
- Test refresh token renews JWT
- Test password change requires current password
- Test password reset email sent
- Test logout revokes session
- Load test: 500 concurrent logins
- Test suite executed with 100% pass rate
- Test report documenting token lifecycle and 2FA scenarios
- Sign-off on BE-002 completion

**Definition of Done:**
- Unit tests: 90%+ coverage
- Integration tests with DB and 2FA mocks
- API documentation (OpenAPI)
- Reviewed by Backend Tester
- All test criteria passed
**Blocking:** None
**Blocked By:** DB-TEST-001

---

### BE-003: Profile Management Service
**Assignee:** Backend Dev
**Requirements:** REQ-BE-006, REQ-BE-005
**Priority:** High
**Estimate:** 3 story points

**Context:**
Implement profile CRUD operations and account deletion.

**Description:**
Build profile management service supporting updates and account deletion with grace period.

**Acceptance Criteria:**
- REST endpoint: `GET /api/v1/users/me` (fetch profile)
- REST endpoint: `PATCH /api/v1/users/me` (update name, phone, address, timezone, photo)
- Email changes require verification (send confirmation email)
- REST endpoint: `DELETE /api/v1/users/me` (initiate account deletion)
- Deletion creates 7-day grace period (soft delete)
- Revoke all Financial Institution connections via Plaid
- Send confirmation email with cancellation link
- REST endpoint: `POST /api/v1/users/me/undelete` (cancel deletion during grace period)
- After 7 days, hard delete User and cascade all data

**Test Criteria (BE-TEST-003):**
- Test profile fetch returns correct data
- Test profile update succeeds
- Test email change sends verification
- Test account deletion creates 7-day grace period
- Test undelete restores account within grace period
- Test hard delete after 7 days removes all data
- Test Plaid connections revoked on deletion
- Test suite executed with 100% pass rate
- Test report documenting deletion lifecycle
- Sign-off on BE-003 completion

**Definition of Done:**
- Unit tests: 90%+ coverage
- Integration tests with DB
- API documentation (OpenAPI)
- Reviewed by Backend Tester
- All test criteria passed
**Blocking:** None
**Blocked By:** DB-TEST-001

---

### BE-004: Plaid Integration Service
**Assignee:** Backend Dev
**Requirements:** REQ-BE-008, REQ-BE-012
**Priority:** Critical
**Estimate:** 8 story points

**Context:**
Integrate with Plaid API for bank/card connections and transaction syncing.

**Description:**
Build Plaid integration service supporting Link, account connections, and error handling.

**Acceptance Criteria:**
- REST endpoint: `POST /api/v1/connections/plaid/link-token` (generate Plaid Link token)
- REST endpoint: `POST /api/v1/connections/plaid/exchange` (exchange public_token for access_token)
- Create Connection entity with encrypted access_token
- Fetch and store FinancialAccount entities from Plaid
- Handle Plaid webhook: `ITEM_LOGIN_REQUIRED` (mark connection as failed)
- REST endpoint: `POST /api/v1/connections/{id}/reconnect` (re-auth via Plaid Link)
- Implement retry logic for transient Plaid failures (3 retries with exponential backoff)
- Log SecurityEvent for connection_added
- Emit ConnectionEstablished domain event
- Error handling: display user-friendly messages for Plaid error codes

**Test Criteria (BE-TEST-004):**
- Test Link token generation succeeds
- Test public_token exchange creates Connection
- Test access_token encrypted in DB
- Test FinancialAccount entities created
- Test webhook handling for ITEM_LOGIN_REQUIRED
- Test reconnect flow
- Test retry logic for transient failures
- Test user-friendly error messages for Plaid errors
- Test suite executed with 100% pass rate (Plaid Sandbox)
- Test report documenting error scenarios
- Sign-off on BE-004 completion

**Definition of Done:**
- Unit tests: 90%+ coverage (with Plaid mocks)
- Integration tests with Plaid Sandbox
- API documentation (OpenAPI)
- Reviewed by Backend Tester
- All test criteria passed
**Blocking:** None
**Blocked By:** DB-TEST-002

---

### BE-005: Connection Lifecycle Service
**Assignee:** Backend Dev
**Requirements:** REQ-BE-009, REQ-BE-010, REQ-BE-011
**Priority:** High
**Estimate:** 4 story points

**Context:**
Manage connection refresh, multi-connection support, and disconnection.

**Description:**
Build service for connection management and status tracking.

**Acceptance Criteria:**
- REST endpoint: `GET /api/v1/connections` (list all connections for user)
- REST endpoint: `POST /api/v1/connections/{id}/refresh` (manual sync)
- Scheduled job: daily auto-sync for all active connections
- Update Connection.last_sync_at after successful sync
- Handle sync failures: update status to 'failed', send alert
- REST endpoint: `DELETE /api/v1/connections/{id}` (disconnect)
- Confirmation required (request body: `{confirmed: true}`)
- Revoke Plaid access_token
- Emit ConnectionDisconnected domain event
- Mark associated Subscriptions as 'unverified'
- Log SecurityEvent for connection_removed

**Test Criteria (BE-TEST-005):**
- Test list connections returns all user connections
- Test manual refresh updates last_sync_at
- Test auto-sync job runs daily
- Test sync failure updates status and sends alert
- Test disconnect requires confirmation
- Test disconnect revokes Plaid token
- Test subscriptions marked unverified after disconnect
- Test suite executed with 100% pass rate
- Test report documenting multi-connection scenarios
- Sign-off on BE-005 completion

**Definition of Done:**
- Unit tests: 90%+ coverage
- Integration tests with DB and scheduler
- API documentation (OpenAPI)
- Reviewed by Backend Tester
- All test criteria passed
**Blocking:** None
**Blocked By:** DB-TEST-002

---

### BE-006: Transaction Sync Service
**Assignee:** Backend Dev
**Requirements:** REQ-BE-010, REQ-DB-002
**Priority:** Critical
**Estimate:** 5 story points

**Context:**
Fetch and persist transactions from Plaid for subscription detection.

**Description:**
Build transaction sync service with bulk insert optimization.

**Acceptance Criteria:**
- Fetch transactions from Plaid API (last 90 days on initial sync, incremental daily)
- Create Transaction entities (bulk insert for performance)
- Handle pagination for large transaction sets
- Deduplicate by Plaid transaction_id
- Emit TransactionsSynced domain event with transaction_ids
- Handle foreign currency: store original currency and amount
- Error handling: log failures, retry transient errors
- Performance target: sync 1000 transactions in <5 seconds

**Test Criteria (BE-TEST-006):**
- Test initial sync fetches 90 days of transactions
- Test incremental sync fetches only new transactions
- Test deduplication prevents duplicate inserts
- Test pagination handles >500 transactions
- Test foreign currency transactions stored correctly
- Test bulk insert performance: 1000 transactions in <5 seconds
- Test TransactionsSynced event emitted
- Test suite executed with 100% pass rate
- Performance benchmarks meet target
- Test report documenting deduplication and pagination
- Sign-off on BE-006 completion

**Definition of Done:**
- Unit tests: 90%+ coverage (with Plaid mocks)
- Integration tests with DB
- Performance benchmarks documented
- API documentation (OpenAPI)
- Reviewed by Backend Tester
- All test criteria passed
**Blocking:** None
**Blocked By:** DB-TEST-003

---

### BE-007: Subscription Detection Service
**Assignee:** Backend Dev
**Requirements:** REQ-BE-013, REQ-BE-014, REQ-BE-020, REQ-BE-021, REQ-BE-022
**Priority:** Critical
**Estimate:** 8 story points

**Context:**
Core domain logic: detect recurring charges from transaction patterns.

**Description:**
Build subscription detection algorithm and notification service.

**Acceptance Criteria:**
- Event handler: listen to TransactionsSynced events
- Algorithm: identify recurring charges (monthly, annual, custom intervals)
- Support variable amounts (calculate average, min, max)
- Extract merchant name from transaction description
- Create Subscription entity for each detected pattern
- Auto-categorize using merchant database or heuristics
- Detect free trials: identify $0 or $1 authorization + upcoming charge
- Emit SubscriptionDetected domain event
- Send alert within 24h of detection (via Alerting service)
- Duplicate detection: merge if merchant + amount match existing subscription
- Performance target: process 1000 transactions in <5 seconds

**Test Criteria (BE-TEST-007):**
- Test monthly subscription detection (same amount, 28-31 day intervals)
- Test annual subscription detection
- Test variable amount subscriptions (usage-based)
- Test free trial detection
- Test duplicate subscription merging
- Test edge case: irregular billing cycles
- Test edge case: merchant name variations
- Measure accuracy: >90% precision, >85% recall on test dataset
- Test performance: 1000 transactions processed in <5 seconds
- Test suite executed with 100% pass rate
- Accuracy metrics documented
- Test report with edge cases and false positive analysis
- Sign-off on BE-007 completion

**Definition of Done:**
- Unit tests: 90%+ coverage
- Integration tests with real transaction patterns
- Algorithm accuracy metrics documented (precision/recall)
- API documentation (OpenAPI)
- Reviewed by Backend Tester
- All test criteria passed
**Blocking:** None
**Blocked By:** BE-TEST-006

---

### BE-008: Subscription CRUD Service
**Assignee:** Backend Dev
**Requirements:** REQ-BE-015, REQ-BE-016, REQ-BE-017, REQ-BE-018, REQ-BE-019
**Priority:** High
**Estimate:** 5 story points

**Context:**
Manage subscription lifecycle: list, view, add manually, categorize, archive.

**Description:**
Build subscription management service with query and command endpoints.

**Acceptance Criteria:**
- REST endpoint: `GET /api/v1/subscriptions` (list with filters, sorting, search)
- Query params: `?status=active|inactive`, `?category_id=X`, `?sort=amount|name|next_billing`
- Calculate total monthly and annual cost in response
- REST endpoint: `GET /api/v1/subscriptions/{id}` (detail view with payment history)
- REST endpoint: `POST /api/v1/subscriptions` (manually add subscription)
- Request body: `{name, amount, frequency, payment_method, category_id?, notes?}`
- REST endpoint: `PATCH /api/v1/subscriptions/{id}` (update category, notes)
- REST endpoint: `PATCH /api/v1/subscriptions/{id}/archive` (mark inactive)
- Emit SubscriptionArchived domain event
- REST endpoint: `PATCH /api/v1/subscriptions/{id}/reactivate` (unarchive)

**Test Criteria (BE-TEST-008):**
- Test list subscriptions with filters and sorting
- Test total cost calculations
- Test subscription detail view includes payment history
- Test manually add subscription
- Test update category
- Test archive subscription (status changes to inactive)
- Test reactivate subscription
- Test edge case: archive already inactive subscription
- Test suite executed with 100% pass rate
- Test report documenting query performance
- Sign-off on BE-008 completion

**Definition of Done:**
- Unit tests: 90%+ coverage
- Integration tests with DB
- API documentation (OpenAPI)
- Reviewed by Backend Tester
- All test criteria passed
**Blocking:** None
**Blocked By:** BE-TEST-007

---

### BE-009: Subscription Categorization Service
**Assignee:** Backend Dev
**Requirements:** REQ-BE-018, REQ-DB-004
**Priority:** Medium
**Estimate:** 3 story points

**Context:**
Auto-categorization and custom category management.

**Description:**
Build categorization service with merchant database integration.

**Acceptance Criteria:**
- Seed default categories: Entertainment, Utilities, Software, Health, Other
- Auto-categorization logic: match merchant name to known categories
- Use external merchant database API (e.g., Clearbit, BuiltWith) for enrichment
- Fallback: assign 'Other' if no match
- REST endpoint: `GET /api/v1/categories` (list all categories)
- REST endpoint: `POST /api/v1/categories` (create custom category)
- REST endpoint: `PATCH /api/v1/subscriptions/{id}/categorize` (override category)
- Emit SubscriptionCategorized domain event

**Test Criteria (BE-TEST-009):**
- Test default categories seeded
- Test auto-categorization for known merchants (Netflix→Entertainment, etc.)
- Test fallback to 'Other' for unknown merchants
- Test create custom category
- Test override subscription category
- Test categorization accuracy: >80% on test dataset
- Test suite executed with 100% pass rate
- Accuracy metrics documented
- Sign-off on BE-009 completion

**Definition of Done:**
- Unit tests: 90%+ coverage
- Integration tests with merchant API mock
- Categorization accuracy: >80% on test dataset
- API documentation (OpenAPI)
- Reviewed by Backend Tester
- All test criteria passed
**Blocking:** None
**Blocked By:** DB-TEST-004

---

### BE-010: Cancellation Request Service
**Assignee:** Backend Dev
**Requirements:** REQ-BE-023, REQ-BE-024, REQ-DB-005
**Priority:** High
**Estimate:** 5 story points

**Context:**
Accept and route cancellation requests (premium vs. free tier).

**Description:**
Build cancellation service with premium assisted flow and free DIY instructions.

**Acceptance Criteria:**
- REST endpoint: `POST /api/v1/cancellations` (create cancellation request)
- Request body: `{subscription_id}`
- Check user tier: Premium → create CancellationRequest (status: pending), Free → return cancellation instructions
- For Premium: emit CancellationRequested domain event (consumed by human agent queue)
- For Free: fetch merchant contact info, cancellation URL, instructions from knowledge base
- REST endpoint: `GET /api/v1/subscriptions/{id}/cancellation-instructions` (DIY instructions)
- REST endpoint: `PATCH /api/v1/subscriptions/{id}/mark-cancelled` (user self-reports cancellation)

**Test Criteria (BE-TEST-010):**
- Test premium user creates CancellationRequest
- Test free user receives DIY instructions
- Test cancellation instructions include contact info and URL
- Test user can self-mark subscription as cancelled
- Test CancellationRequested event emitted for premium requests
- Test suite executed with 100% pass rate
- Test report documenting tier-based logic
- Sign-off on BE-010 completion

**Definition of Done:**
- Unit tests: 90%+ coverage
- Integration tests with DB
- API documentation (OpenAPI)
- Reviewed by Backend Tester
- All test criteria passed
**Blocking:** None
**Blocked By:** DB-TEST-005

---

### BE-011: Cancellation Tracking Service
**Assignee:** Backend Dev
**Requirements:** REQ-BE-025, REQ-BE-026, REQ-BE-027, REQ-DB-006
**Priority:** High
**Estimate:** 5 story points

**Context:**
Track cancellation status, generate confirmations, detect post-cancellation charges.

**Description:**
Build cancellation tracking service with status updates and dispute handling.

**Acceptance Criteria:**
- REST endpoint: `GET /api/v1/cancellations` (list user's cancellation requests)
- REST endpoint: `GET /api/v1/cancellations/{id}` (detail view with timeline)
- Status update API (internal): `PATCH /api/v1/internal/cancellations/{id}/status`
- Emit CancellationStatusChanged domain event (trigger alerts)
- On status=completed: generate confirmation document (PDF), store in S3, send email
- Confirmation includes: date, subscription name, reference number
- Monitor transactions: if cancelled subscription charges again, emit PostCancellationChargeDetected event
- REST endpoint: `POST /api/v1/cancellations/{id}/dispute` (create dispute)
- Create Dispute entity

**Test Criteria (BE-TEST-011):**
- Test list cancellations
- Test detail view shows timeline
- Test status update triggers alert
- Test confirmation PDF generated on completion
- Test post-cancellation charge detection
- Test dispute creation
- Test suite executed with 100% pass rate
- Test report documenting status lifecycle
- Sign-off on BE-011 completion

**Definition of Done:**
- Unit tests: 90%+ coverage
- Integration tests with DB and S3 mock
- API documentation (OpenAPI)
- Reviewed by Backend Tester
- All test criteria passed
**Blocking:** None
**Blocked By:** DB-TEST-005

---

### BE-012: Alert Engine Service
**Assignee:** Backend Dev
**Requirements:** REQ-BE-028, REQ-BE-029, REQ-BE-030, REQ-BE-031, REQ-DB-007
**Priority:** High
**Estimate:** 8 story points

**Context:**
Core alert logic: renewal reminders, price increases, large transactions, fees.

**Description:**
Build alert engine with rule evaluation and multi-channel delivery.

**Acceptance Criteria:**
- Event handlers: listen to SubscriptionDetected, SubscriptionPriceChanged, TransactionsSynced, etc.
- Alert types: renewal (configurable 1/3/7 days before), price_increase, new_subscription, large_transaction, fee
- Fetch NotificationPreference for user and alert type
- Evaluate timing: skip if outside user's preference window or in quiet hours
- Create Alert entity
- Deliver via enabled channels: push (FCM/APNS), email (SendGrid/SES), SMS (Twilio)
- Mark Alert.status as sent or failed
- REST endpoint: `POST /api/v1/alerts/{id}/dismiss` (user dismisses alert)
- Scheduled job: daily check for upcoming renewals (next_billing_date within preference window)

**Test Criteria (BE-TEST-012):**
- Test renewal alert sent 3 days before (user preference)
- Test alert skipped during quiet hours
- Test price increase alert sent on detection
- Test large transaction alert sent when threshold exceeded
- Test fee detection alert
- Test multi-channel delivery (push + email)
- Test alert dismissed by user
- Test scheduled job triggers renewal alerts daily
- Test suite executed with 100% pass rate
- Test report documenting alert timing and delivery
- Sign-off on BE-012 completion

**Definition of Done:**
- Unit tests: 90%+ coverage
- Integration tests with channel mocks (push, email, SMS)
- API documentation (OpenAPI)
- Reviewed by Backend Tester
- All test criteria passed
**Blocking:** None
**Blocked By:** DB-TEST-006

---

### BE-013: Notification Preferences Service
**Assignee:** Backend Dev
**Requirements:** REQ-BE-032, REQ-DB-007
**Priority:** Medium
**Estimate:** 3 story points

**Context:**
Manage user notification preferences with per-type and per-subscription overrides.

**Description:**
Build preference management service with defaults and customization.

**Acceptance Criteria:**
- Seed default preferences on user creation (all alert types enabled, push + email, 3 days before renewal)
- REST endpoint: `GET /api/v1/preferences/notifications` (fetch all preferences)
- REST endpoint: `PATCH /api/v1/preferences/notifications/{alert_type}` (update preference)
- Request body: `{enabled, channels: [push, email, sms], timing?, quiet_hours_start?, quiet_hours_end?}`
- REST endpoint: `PATCH /api/v1/subscriptions/{id}/notification-override` (per-subscription override)
- Emit NotificationPreferenceChanged domain event

**Test Criteria (BE-TEST-013):**
- Test default preferences seeded on user creation
- Test fetch preferences
- Test update alert type preference (enable/disable, channels, timing)
- Test per-subscription override
- Test quiet hours enforced by alert engine
- Test suite executed with 100% pass rate
- Test report documenting override logic
- Sign-off on BE-013 completion

**Definition of Done:**
- Unit tests: 90%+ coverage
- Integration tests with DB
- API documentation (OpenAPI)
- Reviewed by Backend Tester
- All test criteria passed
**Blocking:** None
**Blocked By:** DB-TEST-006

---

### BE-014: Dashboard Aggregation Service
**Assignee:** Backend Dev
**Requirements:** REQ-BE-033, REQ-BE-034, REQ-BE-035, REQ-BE-036, REQ-DB-008
**Priority:** High
**Estimate:** 5 story points

**Context:**
Compute and serve dashboard metrics and spending insights.

**Description:**
Build dashboard service using materialized views for performance.

**Acceptance Criteria:**
- REST endpoint: `GET /api/v1/dashboard` (fetch metrics)
- Response: `{total_monthly_cost, total_annual_cost, subscription_count, highest_cost_subscription, newest_subscription, month_over_month_trend, category_breakdown: [{category, amount, percentage}]}`
- REST endpoint: `GET /api/v1/dashboard/category/{id}` (drill-down to subscriptions in category)
- REST endpoint: `GET /api/v1/dashboard/trends` (last 12 months chart)
- Query params: `?format=json|csv|pdf` (export)
- REST endpoint: `GET /api/v1/dashboard/savings` (lifetime savings summary)
- Breakdown: cancelled_subscriptions_savings, negotiated_bills_savings, fee_waivers_savings
- Performance target: dashboard loads in <2 seconds (mobile 4G)

**Test Criteria (BE-TEST-014):**
- Test dashboard metrics match raw subscription data
- Test category breakdown sums to total
- Test drill-down returns correct subscriptions
- Test trends chart covers last 12 months
- Test CSV export
- Test PDF export
- Test savings summary accuracy
- Test performance: dashboard loads in <2 seconds
- Test suite executed with 100% pass rate
- Performance benchmarks meet target
- Test report documenting accuracy and export formats
- Sign-off on BE-014 completion

**Definition of Done:**
- Unit tests: 90%+ coverage
- Integration tests with materialized views
- Performance benchmarks documented
- API documentation (OpenAPI)
- Reviewed by Backend Tester
- All test criteria passed
**Blocking:** None
**Blocked By:** DB-TEST-007

---

### BE-015: Negotiation Request Service
**Assignee:** Backend Dev
**Requirements:** REQ-BE-039, REQ-BE-040, REQ-BE-044, REQ-DB-009
**Priority:** Medium
**Estimate:** 5 story points

**Context:**
Accept negotiation requests, process bill uploads with OCR, list supported providers.

**Description:**
Build negotiation request service with document handling.

**Acceptance Criteria:**
- REST endpoint: `POST /api/v1/negotiations` (create request)
- Request body: `{bill_type, provider_name, original_amount, preferences: {desired_price?, acceptable_changes?}}`
- Create NegotiationRequest entity (status: submitted)
- Emit NegotiationRequested domain event (consumed by human agent queue)
- REST endpoint: `POST /api/v1/negotiations/{id}/upload` (upload bill document)
- Support PDF and image formats
- Store in S3
- Trigger OCR extraction (AWS Textract or similar)
- Parse OCR JSON for provider, amount, due date
- Create BillDocument entity with ocr_data
- REST endpoint: `GET /api/v1/negotiations/providers` (list supported providers with success rates)

**Test Criteria (BE-TEST-015):**
- Test create negotiation request
- Test upload PDF bill document
- Test upload image bill document
- Test OCR extraction populates ocr_data
- Test manual entry fallback if OCR fails
- Test list supported providers
- Test suite executed with 100% pass rate
- Test report documenting OCR accuracy
- Sign-off on BE-015 completion

**Definition of Done:**
- Unit tests: 90%+ coverage
- Integration tests with S3 and OCR mocks
- API documentation (OpenAPI)
- Reviewed by Backend Tester
- All test criteria passed
**Blocking:** None
**Blocked By:** DB-TEST-008

---

### BE-016: Negotiation Tracking Service
**Assignee:** Backend Dev
**Requirements:** REQ-BE-041, REQ-BE-042, REQ-BE-043, REQ-DB-009
**Priority:** Medium
**Estimate:** 5 story points

**Context:**
Track negotiation progress, display results, process success fees.

**Description:**
Build negotiation tracking service with payment integration.

**Acceptance Criteria:**
- REST endpoint: `GET /api/v1/negotiations` (list user's requests)
- REST endpoint: `GET /api/v1/negotiations/{id}` (detail view with timeline and agent notes)
- Status update API (internal): `PATCH /api/v1/internal/negotiations/{id}/status`
- Emit NegotiationStatusChanged domain event (trigger alerts)
- On status=completed: calculate success_fee (15% of annual_savings)
- REST endpoint: `GET /api/v1/negotiations/{id}/result` (show original vs. new amount, savings)
- REST endpoint: `POST /api/v1/negotiations/{id}/pay-fee` (process payment via Stripe/PayPal)
- Mark fee as paid
- Emit FeePaymentReceived domain event

**Test Criteria (BE-TEST-016):**
- Test list negotiations
- Test detail view shows timeline
- Test status update triggers alert
- Test result shows savings calculation
- Test success fee calculated correctly (15% of annual savings)
- Test fee payment processed via Stripe
- Test fee payment failed handling
- Test suite executed with 100% pass rate
- Test report documenting payment flow
- Sign-off on BE-016 completion

**Definition of Done:**
- Unit tests: 90%+ coverage
- Integration tests with payment gateway mock
- API documentation (OpenAPI)
- Reviewed by Backend Tester
- All test criteria passed
**Blocking:** None
**Blocked By:** DB-TEST-008

---

### BE-017: Security Audit Logging Service
**Assignee:** Backend Dev
**Requirements:** REQ-BE-045, REQ-BE-046, REQ-BE-047, REQ-DB-010
**Priority:** Medium
**Estimate:** 4 story points

**Context:**
Log security events, detect anomalies, provide audit trail.

**Description:**
Build audit logging service with anomaly detection.

**Acceptance Criteria:**
- Log security events: login_success, login_failed, password_changed, connection_added, connection_removed, 2fa_enabled, 2fa_disabled
- Extract device_info (user-agent, OS), ip_address, location (GeoIP lookup)
- Create SecurityEvent entity
- REST endpoint: `GET /api/v1/security/activity` (fetch user's activity log, paginated)
- Anomaly detection: flag login from new location or device
- Emit SuspiciousActivityDetected domain event (trigger alert)
- REST endpoint: `POST /api/v1/security/logout-all` (revoke all sessions)
- REST endpoint: `POST /api/v1/security/sessions/{id}/revoke` (revoke specific session)

**Test Criteria (BE-TEST-017):**
- Test login event logged with device and location
- Test password change event logged
- Test anomaly detection: new location triggers alert
- Test anomaly detection: new device triggers alert
- Test fetch activity log
- Test logout all sessions revokes tokens
- Test revoke specific session
- Test suite executed with 100% pass rate
- Test report documenting anomaly detection logic
- Sign-off on BE-017 completion

**Definition of Done:**
- Unit tests: 90%+ coverage
- Integration tests with GeoIP mock
- API documentation (OpenAPI)
- Reviewed by Backend Tester
- All test criteria passed
**Blocking:** None
**Blocked By:** DB-TEST-009

---

### MOB-002: Subscription List UI
**Assignee:** Mobile Dev
**Requirements:** REQ-BE-015, REQ-BE-016, REQ-BE-017
**Priority:** High
**Estimate:** 5 story points

**Context:**
List and detail views for subscriptions with search, filter, sort.

**Description:**
Build subscription list screen and detail screen.

**Acceptance Criteria:**
- Fetch subscriptions from `GET /api/v1/subscriptions`
- List view: display logo/icon, name, amount, frequency, next billing date
- Search by name
- Filter by status (active/inactive) and category
- Sort by amount, name, next billing date
- Display total monthly cost at top
- Tap subscription → navigate to detail screen
- Detail screen: fetch from `GET /api/v1/subscriptions/{id}`
- Display merchant, description, payment method, billing cycle
- Display payment history (scrollable list)
- Display total spent and average monthly cost
- Quick actions: cancel, categorize, archive
- Pull-to-refresh
- Offline mode: show cached list

**Test Criteria (MOB-TEST-002):**
- Test list renders subscriptions
- Test search filters by name
- Test filter by status
- Test sort by amount (ascending/descending)
- Test tap navigates to detail
- Test detail shows payment history
- Test quick actions (cancel, categorize, archive)
- Test offline mode shows cached list
- Test accessibility: screen reader, voiceover
- Test suite executed with 100% pass rate
- Test report documenting filter/sort scenarios
- Sign-off on MOB-002 completion

**Definition of Done:**
- UI implemented for iOS and Android
- Unit tests: 80%+ coverage
- UI tests: list, filter, sort, detail navigation
- Accessibility: WCAG 2.1 Level AA
- Reviewed by Mobile Tester
- All test criteria passed
**Blocking:** None
**Blocked By:** BE-TEST-007, BE-TEST-008

---

### MOB-003: Cancellation UI
**Assignee:** Mobile Dev
**Requirements:** REQ-BE-023, REQ-BE-024, REQ-BE-025
**Priority:** High
**Estimate:** 4 story points

**Context:**
Subscription cancellation flows for premium and free tiers.

**Description:**
Build cancellation request and tracking screens.

**Acceptance Criteria:**
- From subscription detail: tap "Cancel" button
- Check user tier: Premium → show "Request Cancellation" flow, Free → show DIY instructions
- Premium flow: confirmation dialog → `POST /api/v1/cancellations` → show success message
- Free flow: fetch instructions from `GET /api/v1/subscriptions/{id}/cancellation-instructions` → display contact info, URL, steps → button "Mark as Cancelled" → `PATCH /api/v1/subscriptions/{id}/mark-cancelled`
- Cancellation list screen: fetch from `GET /api/v1/cancellations` → display status (pending/in_progress/completed/failed)
- Tap cancellation → detail screen with timeline
- Push notifications for status changes
- Loading states and error handling

**Test Criteria (MOB-TEST-003):**
- Test premium user sees "Request Cancellation" flow
- Test free user sees DIY instructions
- Test cancellation request created
- Test cancellation list displays statuses
- Test detail screen shows timeline
- Test push notification received on status change
- Test mark as cancelled (free tier)
- Test error handling (API failure)
- Test suite executed with 100% pass rate
- Test report documenting tier-based flows
- Sign-off on MOB-003 completion

**Definition of Done:**
- UI implemented for iOS and Android
- Unit tests: 80%+ coverage
- UI tests: premium and free flows
- Accessibility: WCAG 2.1 Level AA
- Reviewed by Mobile Tester
- All test criteria passed
**Blocking:** None
**Blocked By:** BE-TEST-010, BE-TEST-011

---

### MOB-004: Push Notification Integration
**Assignee:** Mobile Dev
**Requirements:** REQ-BE-028, REQ-BE-029, REQ-BE-030, REQ-BE-031, MOB-002
**Priority:** High
**Estimate:** 5 story points

**Context:**
Integrate FCM (Android) and APNS (iOS) for alert delivery.

**Description:**
Build push notification infrastructure and handling.

**Acceptance Criteria:**
- Register device token on app launch
- Send token to backend: `POST /api/v1/devices` with `{device_token, platform: ios|android}`
- Listen for push notifications (background and foreground)
- Display notification with subscription name, amount, action buttons (dismiss, view)
- Tap notification → navigate to relevant screen (subscription detail, cancellation, etc.)
- Handle deep links from notifications
- Notification permission request on first launch
- Respect notification preferences (fetch from backend)
- Badge count: unread alerts

**Test Criteria (MOB-TEST-004):**
- Test device token registered on launch
- Test notification displayed (foreground and background)
- Test tap notification navigates to correct screen
- Test action buttons (dismiss, view)
- Test deep links work
- Test badge count updates
- Test notification permission request
- Test notifications respect user preferences
- Test suite executed with 100% pass rate
- Test report documenting notification scenarios
- Sign-off on MOB-004 completion

**Definition of Done:**
- Push notifications working on iOS and Android
- Unit tests: 80%+ coverage (notification handling logic)
- Integration tests with FCM/APNS test environments
- Reviewed by Mobile Tester
- All test criteria passed
**Blocking:** None
**Blocked By:** BE-TEST-012

---

### MOB-005: Insights UI
**Assignee:** Mobile Dev
**Requirements:** REQ-BE-034, REQ-BE-035, REQ-BE-037
**Priority:** Medium
**Estimate:** 4 story points

**Context:**
Spending insights: category breakdown, trends, budgets.

**Description:**
Build insights screen with charts and budget tracking.

**Acceptance Criteria:**
- Fetch category spending from `GET /api/v1/dashboard/category/{id}` (drill-down from dashboard)
- Display category subscriptions list
- Fetch trends from `GET /api/v1/dashboard/trends`
- Display last 12 months line/bar chart
- Highlight significant events (new subs, cancellations, price changes)
- Export options: CSV, PDF
- Budget screen: display current vs. budget (progress bar)
- Alert when approaching/exceeding budget
- Set budget: `POST /api/v1/budgets` with `{monthly_amount}`
- Suggestions: subscriptions to cut (sorted by cost)

**Test Criteria (MOB-TEST-005):**
- Test category drill-down displays subscriptions
- Test trends chart renders last 12 months
- Test event highlights on chart
- Test CSV export downloads
- Test PDF export downloads
- Test budget progress bar
- Test set budget
- Test budget alert displayed when exceeded
- Test suggestions list
- Test suite executed with 100% pass rate
- Test report documenting chart rendering and export
- Sign-off on MOB-005 completion

**Definition of Done:**
- UI implemented for iOS and Android
- Unit tests: 80%+ coverage
- UI tests: charts render, export works
- Accessibility: WCAG 2.1 Level AA
- Reviewed by Mobile Tester
- All test criteria passed
**Blocking:** None
**Blocked By:** BE-TEST-014

---

### MOB-006: Bill Negotiation UI
**Assignee:** Mobile Dev
**Requirements:** REQ-BE-039, REQ-BE-040, REQ-BE-041, REQ-BE-042
**Priority:** Medium
**Estimate:** 5 story points

**Context:**
Bill negotiation request flow with document upload and tracking.

**Description:**
Build negotiation request and tracking screens.

**Acceptance Criteria:**
- Negotiation request screen: select bill type, provider, enter current amount, preferences
- Submit: `POST /api/v1/negotiations`
- Upload bill: camera or file picker → `POST /api/v1/negotiations/{id}/upload`
- Display OCR extraction results, allow manual correction
- Negotiation list screen: fetch from `GET /api/v1/negotiations` → display status
- Tap negotiation → detail screen with timeline, agent notes
- Result screen: show original vs. new amount, annual savings, success fee
- Pay fee button: `POST /api/v1/negotiations/{id}/pay-fee` → Stripe payment sheet
- Push notifications for status changes

**Test Criteria (MOB-TEST-006):**
- Test create negotiation request
- Test upload bill (camera and file picker)
- Test OCR results displayed
- Test manual correction
- Test negotiation list displays statuses
- Test detail screen shows timeline
- Test result screen shows savings
- Test pay fee initiates Stripe payment
- Test payment success/failure handling
- Test suite executed with 100% pass rate
- Test report documenting upload and payment flows
- Sign-off on MOB-006 completion

**Definition of Done:**
- UI implemented for iOS and Android
- Unit tests: 80%+ coverage
- UI tests: request flow, upload, payment
- Accessibility: WCAG 2.1 Level AA
- Reviewed by Mobile Tester
- All test criteria passed
**Blocking:** None
**Blocked By:** BE-TEST-015, BE-TEST-016

---

### MOB-007: Security Activity UI
**Assignee:** Mobile Dev
**Requirements:** REQ-BE-045, REQ-BE-046, REQ-BE-047
**Priority:** Medium
**Estimate:** 3 story points

**Context:**
Security activity log and session management.

**Description:**
Build security activity screen with event log and session controls.

**Acceptance Criteria:**
- Fetch activity log from `GET /api/v1/security/activity` (paginated)
- Display event type, device, location, timestamp
- Highlight suspicious activity (new location/device)
- Tap "Logout All Devices" → `POST /api/v1/security/logout-all` → confirmation dialog
- List active sessions with device info
- Tap session → "Revoke" button → `POST /api/v1/security/sessions/{id}/revoke`
- Push notification for suspicious activity

**Test Criteria (MOB-TEST-007):**
- Test activity log displays events
- Test suspicious activity highlighted
- Test logout all devices
- Test session list displays active sessions
- Test revoke session
- Test push notification for suspicious activity
- Test suite executed with 100% pass rate
- Test report documenting session management
- Sign-off on MOB-007 completion

**Definition of Done:**
- UI implemented for iOS and Android
- Unit tests: 80%+ coverage
- UI tests: log display, session revocation
- Accessibility: WCAG 2.1 Level AA
- Reviewed by Mobile Tester
- All test criteria passed
**Blocking:** None
**Blocked By:** BE-TEST-017

---

### MOB-008: Login and OAuth UI
**Assignee:** Mobile Dev
**Requirements:** REQ-BE-001, REQ-BE-002
**Priority:** Critical
**Estimate:** 5 story points

**Context:**
User registration and login flows with email/password and OAuth.

**Description:**
Build login, registration, and OAuth integration screens.

**Acceptance Criteria:**
- Login screen: email, password fields, "Login" button, "Forgot password?" link
- Submit: `POST /api/v1/auth/login` → store JWT and refresh token
- Registration screen: email, password, confirm password, "Sign Up" button
- Submit: `POST /api/v1/auth/register` → email confirmation message
- OAuth buttons: "Continue with Google", "Continue with Facebook"
- Google OAuth: integrate Google Sign-In SDK → `POST /api/v1/auth/register` with oauth_token
- Facebook OAuth: integrate Facebook Login SDK → `POST /api/v1/auth/register` with oauth_token
- 2FA screen: TOTP input if required
- Password reset screen: email input → `POST /api/v1/auth/password/reset` → success message
- Onboarding tutorial: tooltips/overlays (skippable, re-accessible from settings)
- Terms and Privacy consent: checkboxes before registration

**Test Criteria (MOB-TEST-008):**
- Test email/password login success
- Test invalid credentials show error
- Test registration creates account
- Test password mismatch error
- Test Google OAuth login
- Test Facebook OAuth login
- Test 2FA required screen
- Test password reset email sent
- Test onboarding tutorial (skip and complete)
- Test terms consent required
- Test suite executed with 100% pass rate
- Test report documenting OAuth and 2FA flows
- Sign-off on MOB-008 completion

**Definition of Done:**
- UI implemented for iOS and Android
- Unit tests: 80%+ coverage
- UI tests: login, registration, OAuth, 2FA
- Accessibility: WCAG 2.1 Level AA
- Reviewed by Mobile Tester
- All test criteria passed
**Blocking:** None
**Blocked By:** BE-TEST-001, BE-TEST-002

---

### MOB-009: Settings UI
**Assignee:** Mobile Dev
**Requirements:** REQ-BE-003, REQ-BE-006, REQ-BE-013, REQ-BE-032, REQ-BE-038, REQ-BE-043
**Priority:** Medium
**Estimate:** 5 story points

**Context:**
User settings: profile, password, 2FA, notifications, connected accounts, premium, data export.

**Description:**
Build comprehensive settings screen with nested sections.

**Acceptance Criteria:**
- Profile section: display name, email, phone → tap to edit → `PATCH /api/v1/users/me`
- Password section: change password → `POST /api/v1/auth/password/change`
- 2FA section: enable/disable toggle → `POST /api/v1/auth/2fa/enable|disable` → display backup codes
- Notification preferences section: list alert types → toggle enabled, select channels → `PATCH /api/v1/preferences/notifications/{alert_type}`
- Connected accounts section: list connections → tap to disconnect → `DELETE /api/v1/connections/{id}`
- Premium subscription section: display current plan, features comparison → "Upgrade" button (Stripe payment sheet)
- Data export section: "Download My Data" → `GET /api/v1/export` → download CSV/JSON/PDF
- Account deletion section: "Delete Account" → confirmation dialog → `DELETE /api/v1/users/me` → logout

**Test Criteria (MOB-TEST-009):**
- Test profile edit updates data
- Test password change succeeds
- Test 2FA enable displays backup codes
- Test notification preferences update
- Test connected accounts list and disconnect
- Test premium upgrade flow (Stripe)
- Test data export downloads
- Test account deletion (with grace period)
- Test suite executed with 100% pass rate
- Test report documenting settings interactions
- Sign-off on MOB-009 completion

**Definition of Done:**
- UI implemented for iOS and Android
- Unit tests: 80%+ coverage
- UI tests: all settings sections
- Accessibility: WCAG 2.1 Level AA
- Reviewed by Mobile Tester
- All test criteria passed
**Blocking:** None
**Blocked By:** BE-TEST-003, BE-TEST-013
