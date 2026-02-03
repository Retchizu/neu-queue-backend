# Counter

A **Counter** is a service window (e.g. “Counter 1”) that belongs to a **Station**. Cashiers “enter” and “exit” counters; when serving, a **Queue** entry is linked to a counter via `counterId`.

## Firestore

- **Collection**: `counters`
- **Document ID**: Auto-generated (used as `counterId` in queue when status is `serving`).

## Data Model

| Field        | Type        | Required | Description                                      |
|--------------|-------------|----------|--------------------------------------------------|
| `id`         | `string`    | No (set from doc id) | Document ID.                        |
| `number`     | `number`    | Yes      | Counter number (e.g. 1, 2). Unique per station.  |
| `stationId`  | `string`    | Yes      | Reference to `stations/{stationId}`.             |
| `cashierUid` | `string?`   | No       | Firebase Auth UID of cashier currently at counter; null when no one is assigned. |
| `createdAt`  | `Timestamp` | Yes     | Creation time (server timestamp).                |
| `updatedAt`  | `Timestamp` | Yes     | Last update time (server timestamp).             |

## Validation (Zod)

- **Schema**: `counterSchema` in `functions/src/zod-schemas/counter-schema.ts`
- **Rules**:
  - `stationId`: non-empty string
  - `number`: positive integer
  - `cashierUid`: optional string (used when assigning; not sent on create)

## Business Rules

- **Counter number** must be unique within the same station (`stationId` + `number`).
- **Create**: Counter is created with no `cashierUid`; cashier is assigned via “enter counter”.
- **Update**: Counter can be updated (e.g. `number`) only when **no cashier is assigned** (`cashierUid` null/undefined).
- **Delete**: Counter can be deleted only when **no cashier is assigned**.
- **Enter counter**: Sets `cashierUid` to the requesting user; fails if another cashier is already assigned (unless same user re-entering).
- **Exit counter**: Clears `cashierUid`; fails if there are still queue entries for that station with status `waiting` or `serving`.

## Relations

- **Station**: `stations/{counter.stationId}`.
- **Queue**: When a customer is being served, `queue.counterId == counter.id` and `queue.status === "serving"`. At most one such queue document per counter at a time.

## TypeScript

```ts
// functions/src/types/counter.ts
import { Timestamp } from "firebase-admin/firestore";

type Counter = {
  id?: string;
  number: number;
  stationId: string;
  cashierUid?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
```
