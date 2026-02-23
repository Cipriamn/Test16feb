# DB-005: Cancellation Status Transitions

## Overview

This document defines the valid status transitions for `cancellation_requests` and `disputes` tables.

---

## Cancellation Request Status Lifecycle

### States

| Status | Description |
|--------|-------------|
| `pending` | Initial state - cancellation requested but not yet started |
| `in_progress` | Cancellation process has begun (contacting vendor, etc.) |
| `completed` | Cancellation successfully processed |
| `failed` | Cancellation could not be completed |

### Transition Matrix

```
┌─────────────┬──────────────────────────────────────────────┐
│ From State  │           Allowed Transitions To             │
├─────────────┼──────────────────────────────────────────────┤
│ pending     │ in_progress, completed, failed               │
│ in_progress │ completed, failed, pending (retry)           │
│ completed   │ (terminal state - no transitions allowed)    │
│ failed      │ pending (retry), in_progress                 │
└─────────────┴──────────────────────────────────────────────┘
```

### State Diagram

```
                 ┌─────────────┐
                 │   pending   │◄──────────────┐
                 └──────┬──────┘               │
                        │                      │ retry
          ┌─────────────┼─────────────┐        │
          │             │             │        │
          ▼             │             ▼        │
   ┌─────────────┐      │      ┌─────────────┐ │
   │ in_progress │──────┼─────►│   failed    │─┘
   └──────┬──────┘      │      └─────────────┘
          │             │
          │             │
          ▼             ▼
   ┌─────────────────────────┐
   │       completed         │
   └─────────────────────────┘
```

### Transition Rules

1. **pending → in_progress**: When cancellation process begins
2. **pending → completed**: Direct completion (e.g., self-service cancellation confirmed)
3. **pending → failed**: Immediate failure (e.g., subscription already cancelled)
4. **in_progress → completed**: Vendor confirms cancellation
5. **in_progress → failed**: Vendor rejects or process cannot continue
6. **in_progress → pending**: Reset for retry (rare)
7. **failed → pending**: User initiates retry
8. **failed → in_progress**: Resume with different approach

### Constraints

- `completed_at` is **required** when status = `completed` or `failed`
- `completed_at` must be **NULL** when status = `pending` or `in_progress`
- `confirmation_number` is typically set only for `completed` status

---

## Dispute Status Lifecycle

### States

| Status | Description |
|--------|-------------|
| `submitted` | Initial state - dispute filed with bank/vendor |
| `investigating` | Bank/vendor reviewing the dispute |
| `resolved` | Dispute resolved in user's favor (refund issued) |
| `rejected` | Dispute rejected (no refund) |

### Transition Matrix

```
┌───────────────┬──────────────────────────────────────────┐
│ From State    │           Allowed Transitions To         │
├───────────────┼──────────────────────────────────────────┤
│ submitted     │ investigating, resolved, rejected        │
│ investigating │ resolved, rejected, submitted (escalate) │
│ resolved      │ (terminal state - no transitions)        │
│ rejected      │ submitted (re-dispute with new evidence) │
└───────────────┴──────────────────────────────────────────┘
```

### State Diagram

```
                 ┌─────────────┐
                 │  submitted  │◄──────────────┐
                 └──────┬──────┘               │
                        │                      │ re-dispute
          ┌─────────────┼─────────────┐        │
          │             │             │        │
          ▼             │             ▼        │
   ┌──────────────┐     │      ┌─────────────┐ │
   │ investigating│─────┼─────►│  rejected   │─┘
   └──────┬───────┘     │      └─────────────┘
          │             │
          │             │
          ▼             ▼
   ┌─────────────────────────┐
   │        resolved         │
   └─────────────────────────┘
```

### Transition Rules

1. **submitted → investigating**: Bank begins review
2. **submitted → resolved**: Quick resolution (obvious case)
3. **submitted → rejected**: Immediate rejection (invalid dispute)
4. **investigating → resolved**: Investigation concludes favorably
5. **investigating → rejected**: Investigation concludes unfavorably
6. **investigating → submitted**: Escalation to higher review
7. **rejected → submitted**: Re-dispute with new evidence

### Constraints

- `resolved_at` is **required** when status = `resolved` or `rejected`
- `resolved_at` must be **NULL** when status = `submitted` or `investigating`
- A dispute links to exactly one `cancellation_request` and one `transaction`

---

## Database Enforcement

Status transitions are validated at the application layer. The database enforces:

1. **ENUM types**: Only valid status values are accepted
2. **CHECK constraints**: `completed_at`/`resolved_at` consistency with terminal states
3. **Foreign keys**: Valid references to users, subscriptions, cancellation_requests, transactions

---

## Query Examples

### Fetch pending cancellations for user (< 50ms target)

```sql
SELECT cr.*, s.name as subscription_name
FROM cancellation_requests cr
JOIN subscriptions s ON cr.subscription_id = s.id
WHERE cr.user_id = $1 AND cr.status = 'pending'
ORDER BY cr.requested_at DESC;
```

Uses index: `idx_cancellation_requests_user_status (user_id, status)`

### Get all disputes for a cancellation request

```sql
SELECT d.*, t.amount, t.merchant_name
FROM disputes d
JOIN transactions t ON d.transaction_id = t.id AND d.transaction_date = t.date
WHERE d.cancellation_request_id = $1
ORDER BY d.created_at DESC;
```

Uses index: `idx_disputes_cancellation_request (cancellation_request_id)`
