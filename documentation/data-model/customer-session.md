# Customer Session

A **Customer Session** document represents a short-lived session created when a customer scans a QR code or otherwise obtains a session ID. The document ID is the session identifier (`qrId` / `sessionId`). Used to gate access to the form or queue flow and to track whether the session has been used (e.g. after completing or cancelling a queue entry).

## Firestore

- **Collection**: `customer-sessions`
- **Document ID**: Session ID (e.g. UUID), used as `qrId` in queue and in API (query/body).

## Data Model

| Field      | Type     | Required | Description                                      |
|------------|----------|----------|--------------------------------------------------|
| `type`     | `SessionType` | Yes | Current phase: `"form"` \| `"queue"` \| `"completed"`. |
| `issuedAt`| `number` | Yes      | When the session was created (e.g. `Date.now()`). |
| `expiresAt`| `number`| Yes      | When the session expires (e.g. 8 hours later).   |
| `used`     | `boolean?` | No     | Set to `true` when queue entry is completed/cancelled/no-show. |
| `status`   | `string?` | No       | Set to `"completed"` when session is consumed.   |

### SessionType

Defined in `functions/src/types/token-type.ts`:

- `"form"` — Initial state after QR scan; customer can fill form / proceed to queue.
- `"queue"` — Customer has joined a queue (updated from `form` in `joinQueue`).
- `"completed"` — Session has been used (e.g. queue completed/cancelled/no-show).

## Lifecycle

1. **Create**: In `getQueueAccess`, after validating the Redis QR payload, a new document is created with `type: data.type` (typically `"form"`), `issuedAt: Date.now()`, `expiresAt` (e.g. 8 hours). Document ID = new UUID (`sessionId`).
2. **Form → Queue**: When the customer joins the queue (`joinQueue`), the document is updated to `type: "queue"`.
3. **Consume**: When the queue entry is completed, cancelled, or marked no-show, the document is updated with `used: true` and `status: "completed"` so the session cannot be reused.

## Business Rules

- **Verification** (middleware `verifyCustomerSession`): Requires `qrId` in body or query. Document must exist; `type` must match the required session type for the route; `expiresAt` must be in the future; `used` must not be true (otherwise “Session has already been used”).
- **Expiry**: Stored as numeric timestamp (milliseconds). No TTL in Firestore; expiry is checked in code.

## Relations

- **Queue**: Queue documents may store `qrId` (this document’s ID). When the queue entry is completed/cancelled/no-show, the corresponding customer-session document is updated.

There is no dedicated TypeScript type file for Customer Session; the shape is inferred from `queueControllers.ts` and `verifyCustomerSession.ts`.
