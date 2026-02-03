# Station

A **Station** is a service point (e.g. Tuition Payment, Clinic) that has a purpose type and contains multiple counters. Customers join the queue for a station; cashiers serve from counters that belong to that station.

## Firestore

- **Collection**: `stations`
- **Document ID**: Auto-generated (used as `stationId` in counters and queue).

## Data Model

| Field         | Type      | Required | Description                                      |
|---------------|-----------|----------|--------------------------------------------------|
| `id`          | `string`  | No (set by client from doc id) | Document ID.       |
| `name`        | `string`  | Yes      | Station name (e.g. "Tuition Payment"). Unique.   |
| `type`        | `Purpose` | Yes      | Purpose of the station (see Purpose below).      |
| `description` | `string`  | Yes      | Description of the station.                     |
| `createdAt`   | `Timestamp` | Yes    | Creation time (server timestamp).                |
| `updatedAt`   | `Timestamp` | Yes    | Last update time (server timestamp).             |

### Purpose (Station Type)

`type` is one of:

- `"payment"`
- `"clinic"`
- `"auditing"`
- `"registrar"`

Defined in `functions/src/types/purpose.ts`. Used to filter stations for customers (e.g. “available stations for payment”) and to validate that a customer’s `purpose` matches the station’s `type` when joining the queue.

## Validation (Zod)

- **Schema**: `stationSchema` in `functions/src/zod-schemas/station-schema.ts`
- **Rules**:
  - `name`: non-empty string
  - `description`: non-empty string
  - `type`: enum `["payment", "auditing", "clinic", "registrar"]`, default `"payment"`

## Business Rules

- Station **names** must be unique (case-insensitive) across the `stations` collection.
- A station **cannot be deleted** if any of its counters have an assigned cashier (`cashierUid` set).
- List endpoints support **pagination** via `limit` and `cursor` (document ID); default `limit` is 10.

## Relations

- **Counters**: `counters` where `stationId == station.id`.
- **Queue**: `queue` where `stationId == station.id`.
- **Queue numbers**: Sequence stored in `queue-number-counters/{stationId}` (e.g. `lastNumber` for PAY-001, PAY-002).

## TypeScript

```ts
// functions/src/types/station.ts
import { Timestamp } from "firebase-admin/firestore";
import Purpose from "./purpose";

type Station = {
  id?: string;
  name: string;
  type: Purpose;
  description: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};
```
