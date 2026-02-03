# Cashiers

A **Cashiers** document represents an employee with the **cashier** role and their current station assignment. Document ID is the user’s Firebase Auth UID. Created when an admin assigns the role “cashier”; updated when the cashier is assigned to or unassigned from a station.

## Firestore

- **Collection**: `cashiers`
- **Document ID**: Firebase Auth UID of the user (same as `uid`).

## Data Model

| Field        | Type        | Required | Description                                      |
|--------------|-------------|----------|--------------------------------------------------|
| `uid`        | `string`    | Yes      | Firebase Auth UID (same as document ID).         |
| `email`      | `string`    | Yes      | User email (from Auth at creation).              |
| `displayName`| `string?`   | No       | User display name (from Auth at creation).       |
| `stationId`  | `string \| null` | Yes  | Assigned station ID, or `null` if unassigned.    |
| `createdAt`  | `Timestamp` | Yes     | When the cashier document was created.           |
| `updatedAt`  | `Timestamp` | Yes     | Last update (e.g. assign/unassign station).      |

**Note**: Code sometimes reads `station` as an alias for `stationId` (e.g. `cashierData?.stationId \|\| cashierData?.station`).

## Validation (Zod)

- **Assign cashier**: `assignCashierSchema` in `functions/src/zod-schemas/assign-cashier-schema.ts`
  - `userId`: non-empty string
  - `stationId`: non-empty string
- **Unassign**: `userId` required in body (no dedicated Zod schema in the snippet).

## Business Rules

- **Role**: User must have custom claim `role === "cashier"` to have a document in `cashiers`. Document is created when role is set to `"cashier"`; deleted when role is changed from `"cashier"` to something else (after unassigning from station if needed).
- **Assign**: User must already have role `cashier` and a document in `cashiers`; station must exist. Updates `stationId` and `updatedAt`.
- **Unassign**: Sets `stationId` to `null`. Cashier must currently be assigned to a station.
- **Role change**: Before changing a user’s role away from `cashier`, they must be unassigned from any station; otherwise the API returns 409. When changing to `cashier`, a document is created if it doesn’t exist.

## Relations

- **Station**: `stations/{cashier.stationId}` when assigned.
- **Counters**: A cashier “enters” a counter (counter has `cashierUid`). Counters are queried by `stationId`; the cashier’s assigned station determines which counters they can use.
- **Firebase Auth**: Document ID and `uid` match the Auth user; `email` and `displayName` are denormalized from Auth at creation.

## Usage

- **getAssignedStation** (stationControllers): Reads `cashiers/{req.user.uid}` to return the cashier’s `stationId`.
- **getCashiersByStation**: Queries `cashiers` where `stationId == stationId`, then enriches with Auth user data.
- **getAvailableCashierEmployees**: Lists users with role `cashier` and filters by those present in `cashiers` collection.
- **assignCashier / unassignCashier**: Update `stationId` and `updatedAt`.

There is no dedicated TypeScript type file for Cashier; the shape is inferred from `adminController.ts` and related code.
