# Subscription Schema Documentation

## Overview

The subscription schema consists of three core tables: `categories`, `subscriptions`, and `subscription_history`. These tables support both auto-detected subscriptions (via Plaid transaction analysis) and manually-created subscriptions.

## Tables

### categories

Stores subscription categories, both system defaults and user-created custom categories.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | VARCHAR(100) | Category name |
| user_id | UUID (nullable) | NULL for defaults, FK to users for custom |
| is_default | BOOLEAN | TRUE for system defaults |
| created_at | TIMESTAMPTZ | Creation timestamp |

**Default Categories:**
- Entertainment
- Utilities
- Software
- Health
- Other

**Custom Categories:**
Users can create custom categories by inserting with their `user_id`. Custom categories are deleted when the user is deleted (CASCADE).

### subscriptions

Core subscription tracking table.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | FK to users (CASCADE) |
| connection_id | UUID (nullable) | FK to connections, NULL for manual |
| account_id | UUID (nullable) | FK to financial_accounts, NULL for manual |
| name | VARCHAR(255) | Display name |
| merchant_name | VARCHAR(255) | Merchant identifier |
| amount | DECIMAL(15,4) | Subscription cost |
| currency | CHAR(3) | ISO 4217 code (USD, EUR, GBP, etc.) |
| frequency | ENUM | monthly, annual, custom |
| next_billing_date | DATE (nullable) | Predicted next charge date |
| status | ENUM | active, inactive, cancelled |
| category_id | UUID (nullable) | FK to categories |
| is_manual | BOOLEAN | TRUE if user-created |
| created_at | TIMESTAMPTZ | Creation timestamp |
| updated_at | TIMESTAMPTZ | Last update timestamp |

### subscription_history

Links subscriptions to their transaction history.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| subscription_id | UUID | FK to subscriptions (CASCADE) |
| transaction_id | UUID (nullable) | Reference to transactions |
| transaction_date | DATE | For partition-aware joins |
| amount | DECIMAL(15,4) | Actual charged amount |
| charged_at | TIMESTAMPTZ | Charge timestamp |

## Frequency Enum

```sql
CREATE TYPE subscription_frequency AS ENUM ('monthly', 'annual', 'custom');
```

| Value | Description | Billing Calculation |
|-------|-------------|---------------------|
| monthly | Monthly billing | next_billing_date + 1 month |
| annual | Yearly billing | next_billing_date + 1 year |
| custom | Irregular/custom cycle | Manual update required |

**Usage Notes:**
- Default is `monthly` as most subscriptions are monthly
- Use `custom` for quarterly, semi-annual, or irregular billing
- The application layer is responsible for calculating next billing dates

## Status Lifecycle

```sql
CREATE TYPE subscription_status AS ENUM ('active', 'inactive', 'cancelled');
```

```
┌─────────────────────────────────────────────────────────────┐
│                    Status Transitions                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────┐    pause    ┌──────────┐   cancel  ┌─────────┐
│   │  ACTIVE │────────────▶│ INACTIVE │──────────▶│CANCELLED│
│   └─────────┘             └──────────┘           └─────────┘
│        │                       │                      │
│        │       resume          │                      │
│        │◀──────────────────────┘                      │
│        │                                              │
│        │              cancel                          │
│        └──────────────────────────────────────────────┘
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

| Status | Description | Behavior |
|--------|-------------|----------|
| active | Currently active subscription | Included in totals, generates reminders |
| inactive | Temporarily paused | Excluded from billing, no reminders |
| cancelled | Permanently ended | Historical record only |

**Transition Rules:**
- `active → inactive`: User pauses subscription
- `inactive → active`: User resumes subscription
- `active → cancelled`: User cancels (irreversible in app)
- `inactive → cancelled`: User cancels paused subscription

## Indexes

### subscriptions

| Index | Columns | Purpose |
|-------|---------|---------|
| idx_subscriptions_user_status | (user_id, status) | User dashboard queries |
| idx_subscriptions_next_billing_date | (next_billing_date) | Upcoming billing/reminders |
| idx_subscriptions_category_id | (category_id) | Category filtering |
| idx_subscriptions_connection_id | (connection_id) | Detection linkage |

### subscription_history

| Index | Columns | Purpose |
|-------|---------|---------|
| idx_subscription_history_subscription_id | (subscription_id) | History lookups |
| idx_subscription_history_charged_at | (charged_at DESC) | Time-based queries |
| idx_subscription_history_transaction_id | (transaction_id) | Transaction correlation |

## Common Queries

### Monthly Total for User

```sql
SELECT SUM(
    CASE
        WHEN frequency = 'annual' THEN amount / 12
        ELSE amount
    END
) as monthly_total
FROM subscriptions
WHERE user_id = $1
  AND status = 'active';
```

**Expected Performance:** <200ms with user_status index

### Active Subscriptions Due in 7 Days

```sql
SELECT s.*, c.name as category_name
FROM subscriptions s
LEFT JOIN categories c ON s.category_id = c.id
WHERE s.status = 'active'
  AND s.next_billing_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
ORDER BY s.next_billing_date;
```

**Expected Performance:** <100ms with next_billing_date index

### User Categories (Default + Custom)

```sql
SELECT * FROM categories
WHERE user_id IS NULL OR user_id = $1
ORDER BY is_default DESC, name;
```

## Foreign Key Behavior

| Relationship | ON DELETE | Rationale |
|--------------|-----------|-----------|
| subscriptions.user_id → users | CASCADE | User deletion removes all subscriptions |
| subscriptions.connection_id → connections | SET NULL | Connection removal keeps manual-like state |
| subscriptions.account_id → financial_accounts | SET NULL | Account removal keeps subscription |
| subscriptions.category_id → categories | SET NULL | Category removal uncategorizes |
| subscription_history.subscription_id → subscriptions | CASCADE | History removed with subscription |
| categories.user_id → users | CASCADE | User deletion removes custom categories |

## Cascade Delete Behavior

When a user is deleted:
1. All custom categories (user_id = user.id) are deleted
2. All subscriptions (user_id = user.id) are deleted
3. All subscription_history records linked to those subscriptions are deleted

Default categories (user_id = NULL) are never deleted by cascade.
