# Blacklist

A **Blacklist** document represents a blocked customer email. Blacklisted emails cannot join the queue (enforcement is typically done at join-queue or registration). Admins add and remove entries.

## Firestore

- **Collection**: `blacklist`
- **Document ID**: Auto-generated (not used as a natural key; lookups are by `email`).

## Data Model

| Field      | Type        | Required | Description                                      |
|------------|-------------|----------|--------------------------------------------------|
| `id`       | `string`    | No (set from doc id) | Document ID.                        |
| `email`    | `string`    | Yes      | Blocked email address (stored lowercase).       |
| `reason`   | `string`    | Yes      | Reason for blocking.                             |
| `blockedAt`| `Timestamp?`| No       | When the email was blocked (server timestamp).  |
| `blockedBy`| `string?`   | No       | UID of the admin who blocked the email.          |

## Validation (Zod)

- **Schema**: `blockEmailSchema` in `functions/src/zod-schemas/blockEmail.ts`
- **Rules**:
  - `email`: valid email format
  - `reason`: non-empty string

## Business Rules

- **Email uniqueness**: Same email (case-insensitive) cannot be blacklisted twice; add fails with 409 if already present.
- **Lookup**: By `email` (e.g. `where("email", "==", email.toLowerCase())`). Delete uses email from path and finds the document by email.

## Relations

- **Users**: `blockedBy` references Firebase Auth UID (admin). No direct link to a users collection.

## TypeScript

```ts
// functions/src/types/blacklist.ts
import { Timestamp } from "firebase-admin/firestore";

export type Blacklist = {
  id?: string;
  email: string;
  reason: string;
  blockedAt?: Timestamp;
  blockedBy?: string;
};
```
