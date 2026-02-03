# Queue

A **Queue** document represents one customer’s place in line for a **Station**. It moves through statuses: `waiting` → `serving` (optionally linked to a **Counter**) → `completed`, or to `cancelled` / `no_show`.

## Firestore

- **Collection**: `queue`
- **Document ID**: Auto-generated (used as `queueId` in API).

## Data Model

| Field             | Type        | Required | Description                                      |
|-------------------|-------------|----------|--------------------------------------------------|
| `id`              | `string`    | Yes      | Document ID.                                     |
| `stationId`       | `string`    | Yes      | Reference to `stations/{stationId}`.             |
| `counterId`       | `string?`   | No       | Set when status is `serving`; reference to `counters/{counterId}`. |
| `queueNumber`     | `string`    | Yes      | Display number (e.g. PAY-001, CLI-002).           |
| `purpose`         | `Purpose`   | Yes      | Same as station type: payment, clinic, auditing, registrar. |
| `customerEmail`   | `string`    | Yes      | Customer email (stored lowercase).               |
| `status`          | `QueueStatus` | Yes    | Current status (see below).                      |
| `position`        | `number`    | Yes      | 1-based position in queue for the station.       |
| `estimatedWaitTime` | `number?` | No       | Estimated wait time in minutes.                  |
| `qrId`            | `string?`   | No       | Short-lived customer session ID (e.g. from QR).  |
| `createdAt`       | `Timestamp` | Yes     | When the customer joined the queue.              |
| `servedAt`        | `Timestamp?`| No       | When service started (status → serving).         |
| `servedBy`        | `string?`   | No       | UID of cashier who started service.              |
| `completedAt`     | `Timestamp?`| No       | When service completed.                          |
| `cancelledAt`     | `Timestamp?`| No       | When entry was cancelled or marked no-show.      |
| `cancelledBy`     | `string?`   | No       | UID of user who cancelled (or marked no-show).   |
| `reason`          | `string?`   | No       | Optional reason when status is `cancelled`.      |

### QueueStatus

Defined in `functions/src/types/queue-status.ts`:

| Value       | Description                                      |
|-------------|--------------------------------------------------|
| `waiting`   | In queue, not yet called.                        |
| `serving`   | Currently being served at a counter.             |
| `completed` | Service finished.                                |
| `cancelled` | Cancelled by customer or cashier.                |
| `no_show`   | Marked as no-show by cashier.                    |

### Queue Number Format

- Prefix by purpose: PAY, CLI, AUD, REG.
- Sequence from `queue-number-counters/{stationId}` (e.g. `lastNumber`).
- Example: `PAY-001`, `CLI-002`.

## Validation (Zod)

- **Join queue**: `joinQueueSchema` — `purpose`, `email`, `stationId`, `qrId` (all required; purpose enum, email format).
- **Start service**: `startServiceSchema` — `counterId` required.
- **Complete service**: `completeServiceSchema` — body validated but no extra required fields.
- **Cancel queue**: `cancelQueueSchema` — `reason` optional string.

## Lifecycle

1. **Join**: Customer provides email, purpose, stationId, qrId. New document: `status: "waiting"`, `position` set, `queueNumber` from station sequence. No `counterId` yet.
2. **Start service**: Cashier assigns a counter → `status: "serving"`, `counterId`, `servedAt`, `servedBy` set. Queue must be `waiting`.
3. **Complete**: Cashier completes → `status: "completed"`, `completedAt` set. Queue must be `serving`.
4. **Cancel**: Customer or cashier cancels → `status: "cancelled"`, `cancelledAt`, optional `reason`; `cancelledBy` set when done by cashier. Allowed from `waiting` or `serving`.
5. **No-show**: Cashier marks no-show → `status: "no_show"`, `cancelledAt`, `cancelledBy`. Remaining `waiting`/`serving` entries at same station may have `position` renumbered.

## Business Rules

- **One active queue per customer per station**: No duplicate `(stationId, customerEmail)` with status in `["waiting", "serving"]`.
- **Purpose match**: On join, `purpose` must equal the station’s `type`.
- **Position**: 1-based; can be recalculated when an entry is marked `no_show`.
- **Estimated wait time**: Computed (e.g. from station history) and can be refreshed when queue changes (e.g. after complete/cancel).

## Relations

- **Station**: `stations/{queue.stationId}`.
- **Counter**: Only when `status === "serving"` → `counters/{queue.counterId}`.
- **Customer session**: Optional link via `qrId` to customer session / QR flow.

## TypeScript

```ts
// functions/src/types/queue.ts
import Purpose from "./purpose";
import { Timestamp } from "firebase-admin/firestore";
import { QueueStatus } from "./queue-status";

export type Queue = {
  id: string;
  stationId: string;
  counterId?: string;
  queueNumber: string;
  purpose: Purpose;
  customerEmail: string;
  status: QueueStatus;
  position: number;
  estimatedWaitTime?: number;
  qrId?: string;
  createdAt: Timestamp;
  servedAt?: Timestamp;
  servedBy?: string;
  completedAt?: Timestamp;
  cancelledAt?: Timestamp;
  cancelledBy?: string;
};
```

Note: `reason` is written by the cancel endpoint but may not be declared on the type; it exists on the document when status is `cancelled`.
