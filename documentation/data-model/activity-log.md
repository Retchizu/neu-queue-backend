# Activity Log

An **Activity Log** document records an action performed by a user (e.g. login, assign role, add station, block email). Used for auditing and admin activity logs. Written by `recordLog`; queried by date range in the admin API.

## Firestore

- **Collection**: `activity-log`
- **Document ID**: Auto-generated (not significant; logs are queried by `timestamp`).

## Data Model

| Field      | Type         | Required | Description                                      |
|------------|--------------|----------|--------------------------------------------------|
| `uid`      | `string`     | Yes      | Firebase Auth UID of the user who performed the action. |
| `action`   | `ActionType` | Yes      | Kind of action (see below).                      |
| `timestamp`| `number`     | Yes      | When the action occurred (e.g. `Date.now()`).    |
| `details`  | `string?`    | No       | Human-readable description (e.g. “Added station Tuition”). |

### ActionType

Defined in `functions/src/types/activity-log.ts` (enum):

| Value                | Description                          |
|----------------------|--------------------------------------|
| `LOG_IN`             | User logged in.                      |
| `LOG_OUT`            | User logged out.                     |
| `SERVE_CUSTOMER`     | Serving a customer.                 |
| `SKIP_CUSTOMER`      | Skipping a customer.                |
| `COMPLETE_TRANSACTION` | Transaction completed.            |
| `ASSIGN_ROLE`        | User role assigned.                 |
| `ASSIGN_CASHIER`     | Cashier assigned to station.        |
| `UNASSIGN_CASHIER`   | Cashier unassigned from station.    |
| `ADD_STATION`        | Station added.                      |
| `EDIT_STATION`       | Station edited.                     |
| `DELETE_STATION`     | Station deleted.                    |
| `ADD_COUNTER`        | Counter added.                      |
| `EDIT_COUNTER`       | Counter edited.                     |
| `DELETE_COUNTER`     | Counter deleted.                    |
| `JOIN_QUEUE`         | Customer joined queue.              |
| `LEAVE_QUEUE`        | Customer left queue.                |
| `BLOCK_EMAIL`        | Email blacklisted.                  |
| `UNBLOCK_EMAIL`      | Email removed from blacklist.       |

**Note**: The TypeScript type uses `userId`; the actual field written by `recordLog` is `uid`.

## Writing Logs

- **Utility**: `recordLog(uid, action, details?)` in `functions/src/utils/recordLog.ts`.
- **Storage**: `uid`, `action`, `timestamp: Date.now()`, `details` (optional).

## Querying

- **getActivityLogs** (admin): Query params `startDate`, `endDate` (ISO date strings). Query: `timestamp >= startTimestamp`, `timestamp <= endTimestamp`, ordered by `timestamp` descending. Returns `{ id, ...data }` for each document.

## Relations

- **Users**: `uid` is a Firebase Auth UID. No separate users collection in Firestore; role/display name come from Auth when needed.

## TypeScript

```ts
// functions/src/types/activity-log.ts
enum ActionType { ... }

type ActivityLog = {
  userId: string;   // stored as uid in Firestore
  action: ActionType;
  timestamp: number;
  details?: string;
};
```
