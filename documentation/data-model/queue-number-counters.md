# Queue Number Counters

**Queue Number Counters** is an internal collection used to generate unique, per-station queue numbers (e.g. PAY-001, CLI-002). One document per station holds the last issued sequence number; it is incremented in a transaction when a customer joins the queue.

## Firestore

- **Collection**: `queue-number-counters`
- **Document ID**: Station ID (`stationId`). One document per station.

## Data Model

| Field       | Type     | Required | Description                                      |
|-------------|----------|----------|--------------------------------------------------|
| `lastNumber`| `number` | Yes      | Last sequence number used for this station.     |

There is no dedicated TypeScript type; the document is used only inside queue logic.

## Usage

- **Read/write**: In `joinQueue` (queueControllers), when creating a new queue entry:
  1. Get `queue-number-counters/{stationId}`.
  2. In a transaction: read `lastNumber` (default 0), compute `next = lastNumber + 1`, write `{ lastNumber: next }` (merge).
  3. Use `next` to build `queueNumber` (e.g. `PAY-` + padded number).

- **Queue number format**: Prefix by purpose (PAY, CLI, AUD, REG) + 3-digit zero-padded number (e.g. `PAY-001`, `CLI-002`). The prefix comes from the customer’s `purpose`; the number comes from this counter.

## Business Rules

- **Per-station**: Each station has its own sequence. Counters are not shared across stations.
- **Transaction**: Increment is done in a Firestore transaction to avoid duplicate queue numbers under concurrent joins.
- **Creation**: The document is created on first join for a station via `set(..., { merge: true })` (or equivalent) so no separate “create counter” step is required.

## Relations

- **Station**: Document ID is `stationId`; the station must exist (validated earlier in `joinQueue`).
- **Queue**: The resulting `queueNumber` is stored on the new queue document.
