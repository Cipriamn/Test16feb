# AskTrim Requirements (DDD-Aligned)

**Document Version:** 1.0
**Last Updated:** 2026-02-17
**Derived From:** asktrim-user-stories.md (US-001 through US-055)

---

## Table of Contents

1. [Ubiquitous Language](#ubiquitous-language)
2. [Bounded Contexts](#bounded-contexts)
3. [Functional Requirements](#functional-requirements)
4. [Non-Functional Requirements](#non-functional-requirements)
5. [Assumptions](#assumptions)
6. [Exclusions](#exclusions)

---

## Ubiquitous Language

| Term | Definition | Synonyms to Avoid |
|------|-----------|-------------------|
| **User** | Individual who owns the account and authorizes Trim to access financial data | Customer, Client |
| **Account** | User's Trim account with profile, preferences, and authentication | Profile |
| **Financial Institution** | Bank, credit card provider, or other account where transactions occur | Bank, Provider |
| **Connection** | Authenticated link between Trim and a Financial Institution via Plaid | Integration, Link |
| **Transaction** | Single financial movement (charge, payment, refund) from a Financial Institution | Payment, Charge |
| **Subscription** | Recurring charge detected or manually added by User | Recurring Charge, Membership |
| **Detection** | Algorithmic identification of recurring patterns in Transactions | Discovery, Recognition |
| **Cancellation Request** | User-initiated action to terminate a Subscription (premium feature) | Cancellation, Cancel |
| **Cancellation Instructions** | Self-service guidance for Users to cancel Subscriptions independently (free feature) | DIY Cancellation |
| **Negotiation Request** | User-initiated request for Trim to negotiate bill reduction with provider | Bill Negotiation |
| **Success Fee** | 15% of annual savings charged upon successful Negotiation | Commission, Fee |
| **Alert** | Notification sent to User via push, email, or SMS | Notification, Reminder |
| **Renewal** | Scheduled recurring charge date for a Subscription | Billing Date |
| **Free Trial** | Promotional subscription period before paid conversion | Trial |
| **Price Increase** | Change in Subscription amount (upward) detected across billing cycles | Rate Hike |
| **Category** | Classification of Subscription (Entertainment, Utilities, Software, Health, etc.) | Type, Group |
| **Dashboard** | Summary view of financial metrics, Subscriptions, and insights | Overview, Home |
| **Spending Insight** | Aggregated analytics on Transaction patterns and Subscription trends | Report, Analytics |
| **Premium** | Paid tier ($10/month) offering enhanced features like assisted Cancellation | Pro, Paid |
| **Free Tier** | Base offering with Subscription tracking and self-service tools | Basic |
| **Aggregate** | DDD pattern: cluster of Entities/Value Objects treated as a unit | N/A |
| **Entity** | DDD pattern: object with unique identity and lifecycle | N/A |
| **Value Object** | DDD pattern: immutable object defined by attributes, not identity | N/A |
| **Repository** | DDD pattern: abstraction for persisting and retrieving Aggregates | N/A |
| **Domain Event** | DDD pattern: significant state change published for decoupled handling | Event |
| **Command** | DDD pattern: intent to change state (write operation) | Action |
| **Query** | DDD pattern: request for state (read operation) | Read |

---

## Bounded Contexts

### 1. Identity & Access Context
**Responsibilities:**
User registration, authentication, authorization, profile management, 2FA, session handling, account deletion.

**Key Concepts:**
User (Aggregate Root), Credential (Entity), AuthSession (Entity), Consent (Value Object)

**Inputs:**
Registration commands, login requests, password reset requests, 2FA setup

**Outputs:**
AuthTokens, User identity claims, AccountDeleted events

**Integrations:**
OAuth providers (Google, Facebook), email service, SMS service

---

### 2. Financial Connection Context
**Responsibilities:**
Manage connections to Financial Institutions via Plaid, sync Transactions, handle connection lifecycle (add, refresh, disconnect).

**Key Concepts:**
Connection (Aggregate Root), FinancialInstitution (Entity), SyncJob (Entity), Transaction (Entity)

**Inputs:**
ConnectAccount commands, RefreshAccount commands, DisconnectAccount commands

**Outputs:**
TransactionsSynced events, ConnectionFailed events, ConnectionDisconnected events

**Integrations:**
Plaid API, bank authentication flows

---

### 3. Subscription Management Context
**Responsibilities:**
Detect Subscriptions from Transactions, track Subscription lifecycle, categorize, support manual additions, handle inactive/archived Subscriptions.

**Key Concepts:**
Subscription (Aggregate Root), RecurringPattern (Value Object), Category (Value Object), SubscriptionHistory (Entity)

**Inputs:**
DetectSubscriptions commands, AddManualSubscription commands, CategorizeSubscription commands, MarkInactive commands

**Outputs:**
SubscriptionDetected events, SubscriptionCategorized events, SubscriptionMarkedInactive events

**Integrations:**
Financial Connection Context (Transactions), external merchant databases for logos/metadata

---

### 4. Cancellation Context
**Responsibilities:**
Process Cancellation Requests (premium), provide Cancellation Instructions (free), track status, generate confirmation documentation, detect post-cancellation charges.

**Key Concepts:**
CancellationRequest (Aggregate Root), CancellationStatus (Value Object), CancellationProof (Value Object), Dispute (Entity)

**Inputs:**
RequestCancellation commands, TrackCancellationStatus queries, DisputePostCancellationCharge commands

**Outputs:**
CancellationRequested events, CancellationCompleted events, CancellationFailed events, DisputeInitiated events

**Integrations:**
Subscription Management Context, human agents (for assisted cancellation), merchant APIs

---

### 5. Alerting & Notification Context
**Responsibilities:**
Send Alerts for renewals, price increases, new Subscriptions, large transactions, fees. Manage notification preferences and channels.

**Key Concepts:**
Alert (Entity), NotificationPreference (Value Object), AlertRule (Entity), DeliveryChannel (Value Object)

**Inputs:**
ConfigureNotificationPreferences commands, SendAlert commands, subscription/transaction domain events

**Outputs:**
AlertSent events, push notifications, emails, SMS messages

**Integrations:**
Push notification service, email service, SMS gateway, Subscription Management Context, Financial Connection Context

---

### 6. Analytics & Insights Context
**Responsibilities:**
Aggregate spending data, compute trends, generate Dashboard metrics, calculate savings, support budgeting, provide categorized spending breakdowns.

**Key Concepts:**
Dashboard (Read Model), SpendingTrend (Value Object), Budget (Entity), SavingsSummary (Value Object)

**Inputs:**
GetDashboard queries, SetBudget commands, ExportSpendingData commands

**Outputs:**
Dashboard views, spending reports (CSV, PDF), budget alerts

**Integrations:**
Subscription Management Context, Financial Connection Context, Cancellation Context

---

### 7. Bill Negotiation Context
**Responsibilities:**
Accept Negotiation Requests, track negotiation progress, calculate Success Fees, present results, handle payment of fees.

**Key Concepts:**
NegotiationRequest (Aggregate Root), BillDocument (Entity), NegotiationStatus (Value Object), SuccessFee (Value Object)

**Inputs:**
RequestNegotiation commands, UploadBill commands, PaySuccessFee commands

**Outputs:**
NegotiationRequested events, NegotiationCompleted events, FeePaymentReceived events

**Integrations:**
OCR service (for bill parsing), human agents, payment gateway, Analytics Context (for savings tracking)

---

### 8. Security & Audit Context
**Responsibilities:**
Log security events, detect suspicious activity, manage device sessions, enforce 2FA policies, provide activity audit trails.

**Key Concepts:**
SecurityEvent (Entity), DeviceSession (Entity), AuditLog (Entity), SuspiciousActivityAlert (Value Object)

**Inputs:**
LogSecurityEvent commands, GetActivityLog queries, LogoutAllDevices commands

**Outputs:**
SuspiciousActivityDetected events, audit reports

**Integrations:**
Identity & Access Context, geolocation services

---

## Functional Requirements

### Identity & Access Context

#### REQ-BE-001: User Registration
**Description:** System must allow Users to register via email/password, Google OAuth, or Facebook OAuth.
**Derived From:** US-001
**Acceptance Criteria:**
- Email/password registration with password strength validation
- OAuth integration with Google and Facebook
- Email confirmation required for email/password registration
- Registration completes in ≤5 steps
- User entity persisted with unique identifier

#### REQ-BE-002: User Authentication
**Description:** System must authenticate Users and issue secure session tokens.
**Derived From:** US-001
**Acceptance Criteria:**
- Support email/password and OAuth login
- Issue JWT or session token with expiration
- Enforce 2FA if enabled
- Log successful and failed login attempts

#### REQ-BE-003: Two-Factor Authentication
**Description:** System must support SMS and authenticator app-based 2FA.
**Derived From:** US-040
**Acceptance Criteria:**
- User can enable/disable 2FA
- Generate backup codes
- Require 2FA for sensitive operations (account deletion, connection management)
- Store 2FA secrets securely

#### REQ-BE-004: Password Management
**Description:** System must allow password changes and resets.
**Derived From:** US-041
**Acceptance Criteria:**
- Require current password for change
- Enforce password strength policy
- Send confirmation email after change
- Provide password reset via email link

#### REQ-BE-005: Account Deletion
**Description:** System must support permanent account deletion with 7-day grace period.
**Derived From:** US-045
**Acceptance Criteria:**
- Require password confirmation
- 7-day grace period before final deletion
- Revoke all Financial Institution connections
- Delete all user data from databases
- Send confirmation email

#### REQ-BE-006: Profile Management
**Description:** System must allow Users to update profile details.
**Derived From:** US-039
**Acceptance Criteria:**
- Edit name, email, phone, address, timezone
- Email verification for email changes
- Support profile photo upload

#### REQ-BE-007: Terms and Privacy Consent
**Description:** System must require explicit consent to Terms and Privacy Policy.
**Derived From:** US-003
**Acceptance Criteria:**
- Present terms before account activation
- Record consent timestamp
- Allow download of accepted terms

---

### Financial Connection Context

#### REQ-BE-008: Connect Financial Institution
**Description:** System must integrate with Plaid to connect bank and credit card accounts.
**Derived From:** US-004, US-006
**Acceptance Criteria:**
- Plaid Link integration
- Support for major banks and credit card providers
- Handle multi-factor authentication
- Store encrypted access tokens
- Display connection status

#### REQ-DB-001: Store Connection Metadata
**Description:** Database must persist Connection entities with institution, account identifiers, and sync timestamps.
**Derived From:** US-004, US-006
**Acceptance Criteria:**
- Connection table with unique ID, user_id, institution_id, access_token (encrypted), last_sync_at
- Foreign key to User

#### REQ-BE-009: Support Multiple Connections
**Description:** System must allow unlimited Financial Institution connections per User.
**Derived From:** US-005
**Acceptance Criteria:**
- No limit on connection count
- Independent sync status per connection
- Aggregate Subscriptions across all connections

#### REQ-BE-010: Refresh Connection
**Description:** System must support manual and automatic Transaction syncing.
**Derived From:** US-007
**Acceptance Criteria:**
- Manual refresh button per connection
- Automatic daily sync job
- Display last sync timestamp
- Handle sync failures gracefully

#### REQ-DB-002: Store Transactions
**Description:** Database must persist Transaction entities with amount, date, merchant, and connection reference.
**Derived From:** US-004, US-007
**Acceptance Criteria:**
- Transaction table with unique ID, connection_id, amount, date, merchant_name, description
- Indexed by connection_id and date
- Support for foreign currency

#### REQ-BE-011: Disconnect Financial Account
**Description:** System must allow Users to disconnect Financial Institutions.
**Derived From:** US-008
**Acceptance Criteria:**
- Confirmation dialog with warning
- Immediate disconnection
- Revoke Plaid access token
- Mark associated Subscriptions as unverified

#### REQ-BE-012: Handle Connection Failures
**Description:** System must provide troubleshooting guidance for failed connections.
**Derived From:** US-047
**Acceptance Criteria:**
- Clear error messages with failure reason
- Troubleshooting steps
- Retry option
- Support contact info

---

### Subscription Management Context

#### REQ-BE-013: Detect Subscriptions
**Description:** System must algorithmically detect recurring charges from Transactions.
**Derived From:** US-009
**Acceptance Criteria:**
- Identify monthly, annual, and irregular billing patterns
- Extract subscription name, amount, frequency, last charge date
- Support varying amounts (e.g., usage-based)
- Run detection after each sync

#### REQ-DB-003: Store Subscriptions
**Description:** Database must persist Subscription entities with metadata and status.
**Derived From:** US-009, US-010
**Acceptance Criteria:**
- Subscription table with unique ID, user_id, connection_id, name, amount, frequency, next_billing_date, status (active/inactive), category_id
- Indexed by user_id, status, next_billing_date

#### REQ-BE-014: Notify on New Subscription Detection
**Description:** System must alert Users when new Subscriptions are detected.
**Derived From:** US-023
**Acceptance Criteria:**
- Alert within 24 hours of detection
- Include merchant name, amount, date
- Options: confirm, mark suspicious, cancel

#### REQ-BE-015: List Subscriptions
**Description:** System must provide a queryable list of Subscriptions.
**Derived From:** US-010
**Acceptance Criteria:**
- Support sorting by amount, name, date added, next billing
- Calculate total monthly and annual cost
- Search and filter by name, category, status

#### REQ-BE-016: View Subscription Details
**Description:** System must provide detailed Subscription views with payment history.
**Derived From:** US-011
**Acceptance Criteria:**
- Display merchant, description, payment method, billing cycle
- List payment history
- Calculate total spent and average monthly cost

#### REQ-BE-017: Manually Add Subscription
**Description:** System must allow Users to add Subscriptions manually.
**Derived From:** US-012
**Acceptance Criteria:**
- Form with name, amount, frequency, payment method
- Optional category and notes
- Manual subscriptions displayed alongside detected ones

#### REQ-DB-004: Store Subscription Categories
**Description:** Database must persist Category entities and subscription-category mappings.
**Derived From:** US-013
**Acceptance Criteria:**
- Category table with unique ID, name, user_id (for custom categories)
- Subscription.category_id references Category

#### REQ-BE-018: Categorize Subscriptions
**Description:** System must auto-categorize Subscriptions and allow manual override.
**Derived From:** US-013
**Acceptance Criteria:**
- Default categories: Entertainment, Utilities, Software, Health
- Auto-categorization based on merchant type
- User can reassign category

#### REQ-BE-019: Mark Subscription Inactive
**Description:** System must allow Users to archive inactive Subscriptions.
**Derived From:** US-014
**Acceptance Criteria:**
- Mark subscription as inactive
- Move to archived list
- Exclude from monthly total
- Flag if charge reappears

#### REQ-BE-020: Detect Free Trial Conversions
**Description:** System must identify free trial sign-ups and alert before paid conversion.
**Derived From:** US-015
**Acceptance Criteria:**
- Detect trial patterns (e.g., $0 or $1 authorization)
- Alert 3, 5, or 7 days before trial end (configurable)
- Quick actions: cancel or set reminder

#### REQ-BE-021: Handle Duplicate Subscriptions
**Description:** System must detect and allow merging of duplicate Subscription entries.
**Derived From:** US-049
**Acceptance Criteria:**
- Auto-detect duplicates by merchant name and amount
- Require user confirmation before merge
- Preserve payment history from both

#### REQ-BE-022: Support Variable Pricing Subscriptions
**Description:** System must track Subscriptions with fluctuating amounts.
**Derived From:** US-051
**Acceptance Criteria:**
- Calculate average, min, max amounts
- Display trend and spike alerts

---

### Cancellation Context

#### REQ-BE-023: Request Subscription Cancellation (Premium)
**Description:** System must accept Cancellation Requests from Premium Users.
**Derived From:** US-016
**Acceptance Criteria:**
- One-click request submission
- Require user authorization
- Create CancellationRequest aggregate
- Publish CancellationRequested event

#### REQ-DB-005: Store Cancellation Requests
**Description:** Database must persist CancellationRequest entities with status and timeline.
**Derived From:** US-016, US-018
**Acceptance Criteria:**
- CancellationRequest table with unique ID, user_id, subscription_id, status (pending/in_progress/completed/failed), requested_at, completed_at
- Indexed by user_id and status

#### REQ-BE-024: Provide Cancellation Instructions (Free)
**Description:** System must display self-service Cancellation Instructions for Free Users.
**Derived From:** US-017
**Acceptance Criteria:**
- Contact info, step-by-step instructions, direct links
- Phone numbers and chat options
- User can self-mark as cancelled

#### REQ-BE-025: Track Cancellation Status
**Description:** System must provide real-time status updates for Cancellation Requests.
**Derived From:** US-018
**Acceptance Criteria:**
- Status stages: pending, in_progress, completed, failed
- Send alerts on status change
- Display estimated completion time

#### REQ-BE-026: Generate Cancellation Confirmation
**Description:** System must produce proof of cancellation.
**Derived From:** US-019
**Acceptance Criteria:**
- Confirmation document with date, subscription, reference number
- PDF download option
- Store in user history

#### REQ-BE-027: Detect Post-Cancellation Charges
**Description:** System must alert Users if cancelled Subscriptions charge again.
**Derived From:** US-020
**Acceptance Criteria:**
- Monitor Transactions from cancelled Subscriptions
- Immediate alert on detection
- One-click dispute option

#### REQ-DB-006: Store Dispute Records
**Description:** Database must persist Dispute entities for post-cancellation charges.
**Derived From:** US-020
**Acceptance Criteria:**
- Dispute table with unique ID, cancellation_request_id, transaction_id, status, created_at
- Indexed by cancellation_request_id

---

### Alerting & Notification Context

#### REQ-BE-028: Send Renewal Alerts
**Description:** System must alert Users before Subscription renewals.
**Derived From:** US-021
**Acceptance Criteria:**
- Configurable timing: 1, 3, 7 days before
- Channels: push, email, SMS
- Include subscription name, amount, renewal date
- Quick actions: dismiss, cancel, snooze

#### REQ-DB-007: Store Notification Preferences
**Description:** Database must persist User notification preferences.
**Derived From:** US-024
**Acceptance Criteria:**
- NotificationPreference table with user_id, alert_type, channels (push/email/SMS), timing, enabled
- Per-subscription overrides supported

#### REQ-BE-029: Send Price Increase Alerts
**Description:** System must detect and alert on Subscription price changes.
**Derived From:** US-022
**Acceptance Criteria:**
- Compare current charge to previous charges
- Alert with old/new price, percentage increase
- Display historical price trend

#### REQ-BE-030: Send Large Transaction Alerts
**Description:** System must alert on unusually large charges.
**Derived From:** US-025
**Acceptance Criteria:**
- Configurable threshold
- Immediate alert when exceeded
- Options: dismiss, dispute, investigate

#### REQ-BE-031: Send Fee Detection Alerts
**Description:** System must identify and alert on bank fees.
**Derived From:** US-026
**Acceptance Criteria:**
- Detect overdraft, ATM, service fees
- Monthly fee summary
- Tips for avoiding fees

#### REQ-BE-032: Configure Notification Preferences
**Description:** System must allow Users to customize alert settings.
**Derived From:** US-024
**Acceptance Criteria:**
- Toggle by alert type
- Choose channels
- Set quiet hours
- Frequency controls (immediate, daily digest, weekly)

---

### Analytics & Insights Context

#### REQ-BE-033: Generate Spending Dashboard
**Description:** System must compute and display Dashboard metrics.
**Derived From:** US-027
**Acceptance Criteria:**
- Total monthly and annual subscription cost
- Month-over-month trend
- Quick stats: count, highest cost, newest
- Category breakdown (pie/bar chart)

#### REQ-BE-034: Provide Category Spending Breakdown
**Description:** System must aggregate spending by Category.
**Derived From:** US-028
**Acceptance Criteria:**
- Category totals with percentages
- Drill-down to Subscriptions
- Trends over time per category

#### REQ-BE-035: Display Historical Spending Trends
**Description:** System must chart spending over time.
**Derived From:** US-029
**Acceptance Criteria:**
- Last 12 months monthly chart
- Highlight significant events (new subs, cancellations, price changes)
- Export as CSV or PDF

#### REQ-BE-036: Calculate Savings Summary
**Description:** System must track and display total savings.
**Derived From:** US-030
**Acceptance Criteria:**
- Lifetime savings total
- Breakdown: cancelled subs, negotiated bills, fee waivers
- Monthly/annual savings rate

#### REQ-BE-037: Support Subscription Budget
**Description:** System must allow Users to set and track budgets.
**Derived From:** US-031
**Acceptance Criteria:**
- Set monthly subscription budget
- Progress bar and alerts
- Suggestions for subscriptions to cut

#### REQ-BE-038: Export User Data
**Description:** System must support data export for GDPR/CCPA compliance.
**Derived From:** US-044
**Acceptance Criteria:**
- Export subscriptions, transactions, account info
- Formats: CSV, JSON, PDF

#### REQ-DB-008: Store Aggregated Metrics
**Description:** Database may use materialized views or read models for Dashboard queries.
**Derived From:** US-027, US-028
**Acceptance Criteria:**
- Optimized read models for Dashboard
- Updated on Subscription/Transaction changes

---

### Bill Negotiation Context

#### REQ-BE-039: Accept Negotiation Requests
**Description:** System must allow Users to request bill negotiation.
**Derived From:** US-033
**Acceptance Criteria:**
- Supported bill types listed (cable, internet, phone, utilities)
- Specify preferences (desired price, acceptable service changes)
- Explain 15% success fee
- Create NegotiationRequest aggregate

#### REQ-DB-009: Store Negotiation Requests
**Description:** Database must persist NegotiationRequest entities with status and documents.
**Derived From:** US-033, US-035
**Acceptance Criteria:**
- NegotiationRequest table with unique ID, user_id, bill_type, status (submitted/in_negotiation/completed/unsuccessful), original_amount, negotiated_amount, created_at, completed_at
- Indexed by user_id and status

#### REQ-BE-040: Upload and Parse Bills
**Description:** System must accept bill document uploads and extract key details via OCR.
**Derived From:** US-034
**Acceptance Criteria:**
- Support PDF and image formats
- OCR extraction of provider, amount, due date
- Manual entry fallback
- Secure document storage

#### REQ-BE-041: Track Negotiation Status
**Description:** System must provide real-time negotiation progress.
**Derived From:** US-035
**Acceptance Criteria:**
- Status stages: submitted, in negotiation, completed, unsuccessful
- Timeline and agent notes
- Estimated completion time

#### REQ-BE-042: Display Negotiation Results
**Description:** System must present negotiation outcomes with savings.
**Derived From:** US-036
**Acceptance Criteria:**
- Show original vs. new bill amount
- Annual savings projection
- Promotional rate duration (if applicable)
- Success fee calculation

#### REQ-BE-043: Process Success Fee Payment
**Description:** System must collect negotiation fees upon success.
**Derived From:** US-037
**Acceptance Criteria:**
- Fee calculated as 15% of annual savings
- Multiple payment methods
- Generate receipt/invoice

#### REQ-BE-044: List Supported Negotiation Providers
**Description:** System must display negotiable service providers.
**Derived From:** US-038
**Acceptance Criteria:**
- Searchable provider list
- Success rate statistics
- Request support for unlisted providers

---

### Security & Audit Context

#### REQ-BE-045: Log Security Events
**Description:** System must record login attempts and sensitive actions.
**Derived From:** US-046
**Acceptance Criteria:**
- Log successful/failed logins
- Record device and location
- Track password changes, connection modifications

#### REQ-DB-010: Store Security Audit Logs
**Description:** Database must persist SecurityEvent entities for compliance.
**Derived From:** US-046
**Acceptance Criteria:**
- SecurityEvent table with unique ID, user_id, event_type, device_info, ip_address, location, timestamp
- Indexed by user_id and timestamp

#### REQ-BE-046: Detect Suspicious Activity
**Description:** System must identify and alert on anomalous account behavior.
**Derived From:** US-046
**Acceptance Criteria:**
- Pattern analysis for unusual login locations/devices
- Alert user on suspicious activity
- Option to log out all devices

#### REQ-BE-047: Manage Device Sessions
**Description:** System must track and allow revocation of active sessions.
**Derived From:** US-046
**Acceptance Criteria:**
- List active device sessions
- Log out individual or all devices

---

### Cross-Cutting Requirements

#### REQ-MOB-001: Onboarding Tutorial
**Description:** Mobile app must provide interactive onboarding tutorial.
**Derived From:** US-002
**Acceptance Criteria:**
- Highlight key features with tooltips/overlays
- Skippable and re-accessible from settings
- Track completion

#### REQ-MOB-002: Offline Mode
**Description:** Mobile app must cache Subscriptions for offline access.
**Derived From:** US-054
**Acceptance Criteria:**
- Cached subscription list
- Offline indicator
- Queue actions for sync

#### REQ-BE-048: Handle Service Outages
**Description:** System must communicate service disruptions.
**Derived From:** US-055
**Acceptance Criteria:**
- In-app banner during outages
- Push notification for extended outages
- Link to status page

#### REQ-BE-049: Multi-Currency Support
**Description:** System must handle international Subscriptions with currency conversion.
**Derived From:** US-053
**Acceptance Criteria:**
- Auto-detect currency
- Convert to user's primary currency
- Display both original and converted amounts

---

## Non-Functional Requirements

### Performance

#### REQ-NFR-001: Transaction Sync Latency
**Description:** Transaction sync via Plaid must complete within 30 seconds under normal load.
**Justification:** User experience expectation for financial data freshness.

#### REQ-NFR-002: Dashboard Load Time
**Description:** Dashboard must render within 2 seconds on 4G mobile connection.
**Justification:** User engagement and retention.

#### REQ-NFR-003: Subscription Detection Speed
**Description:** Detection algorithm must process 1000 transactions in <5 seconds.
**Justification:** Scalability for users with high transaction volume.

### Security

#### REQ-NFR-004: Data Encryption at Rest
**Description:** All sensitive data (tokens, credentials, financial data) must be encrypted using AES-256.
**Justification:** Compliance with financial data protection standards.

#### REQ-NFR-005: Data Encryption in Transit
**Description:** All API communication must use TLS 1.3 or higher.
**Justification:** Prevent man-in-the-middle attacks.

#### REQ-NFR-006: Password Storage
**Description:** Passwords must be hashed using bcrypt with minimum 12 rounds.
**Justification:** Industry best practice for credential security.

#### REQ-NFR-007: Token Expiration
**Description:** Session tokens must expire after 24 hours; refresh tokens after 30 days.
**Justification:** Limit exposure window for compromised tokens.

### Scalability

#### REQ-NFR-008: Concurrent User Support
**Description:** System must support 100,000 concurrent users.
**Justification:** Growth projection for user base.

#### REQ-NFR-009: Database Scaling
**Description:** Database must support horizontal scaling for read-heavy workloads (Analytics/Dashboard queries).
**Justification:** Analytics queries can be offloaded to read replicas.

### Availability

#### REQ-NFR-010: System Uptime
**Description:** System must achieve 99.9% uptime (excluding planned maintenance).
**Justification:** Financial application reliability expectation.

#### REQ-NFR-011: Plaid Integration Resilience
**Description:** System must gracefully handle Plaid API failures with retries and fallback messaging.
**Justification:** Third-party dependency risk mitigation.

### Compliance

#### REQ-NFR-012: GDPR/CCPA Compliance
**Description:** System must support data export and deletion requests within regulatory timelines (30 days).
**Justification:** Legal requirement for data privacy.

#### REQ-NFR-013: Audit Trail Retention
**Description:** Security events must be retained for minimum 2 years.
**Justification:** Compliance and forensic analysis.

### Usability

#### REQ-NFR-014: Mobile Responsiveness
**Description:** Mobile app must support iOS 15+ and Android 10+ with native UI components.
**Justification:** Target device coverage.

#### REQ-NFR-015: Accessibility
**Description:** Mobile and web UIs must meet WCAG 2.1 Level AA standards.
**Justification:** Inclusive design for users with disabilities.

---

## Assumptions

1. **Plaid Integration:** Plaid API is the sole financial aggregation provider. Alternative providers (Yodlee, MX) are not in scope for v1.
2. **Premium Tier Pricing:** Premium subscription is fixed at $10/month USD. Multi-tier pricing not supported.
3. **Success Fee Calculation:** Negotiation success fee is universally 15% of annual savings, non-negotiable.
4. **Human Agent Involvement:** Assisted cancellation and bill negotiation require human agents; full automation is not assumed.
5. **Subscription Detection Accuracy:** Detection algorithm may have false positives/negatives; manual review/override is expected.
6. **Email as Primary Communication:** Email is the default notification channel; SMS requires opt-in due to cost.
7. **Single Currency per User:** Users have one primary currency; multi-currency portfolios within a single account are not supported.
8. **No Blockchain/Crypto:** Cryptocurrency transactions and wallets are out of scope.
9. **English Language Only:** v1 supports English (US); internationalization deferred to v2.
10. **Web App is Secondary:** Mobile app is primary interface; web app provides limited management/viewing capabilities.

---

## Exclusions

1. **Investment Tracking:** No support for investment accounts, portfolios, or stock tracking.
2. **Budgeting Beyond Subscriptions:** General expense budgeting (groceries, gas, etc.) is not included; only subscription-specific budgets.
3. **Peer-to-Peer Payments:** No integration with Venmo, Zelle, Cash App for payment detection.
4. **Tax Reporting:** No tax document generation or expense categorization for tax purposes.
5. **Credit Score Monitoring:** No credit report or score tracking features.
6. **Loan Management:** No mortgage, auto loan, or personal loan tracking.
7. **Merchant Loyalty Programs:** No integration with cashback or rewards programs.
8. **Household Budgeting (v1):** Multi-user household features deferred to future release (referenced in US-050 as Low priority).
9. **AI Chatbot Support:** No conversational AI for customer support; human support only.
10. **Blockchain/Decentralized Finance:** No Web3, crypto wallet, or DeFi integrations.

---

**End of Requirements Document**
