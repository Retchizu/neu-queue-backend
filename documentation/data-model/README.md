# Data Model

This folder documents the core data models for the NEU Queue backend, derived from the `functions` codebase (Firestore collections, TypeScript types, and Zod schemas).

## Overview

The system models a **queue management** flow:

1. **Stations** — Service points (e.g. Tuition Payment, Clinic) with a purpose type.
2. **Counters** — Physical/service windows belonging to a station; cashiers “enter” and “exit” counters.
3. **Queue** — Customer queue entries per station; they move from waiting → serving (at a counter) → completed/cancelled/no_show.

## Entity Relationship

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  Station    │ 1   n │  Counter    │ 1   n │   Queue     │
│             │───────│             │───────│             │
│ id          │       │ stationId   │       │ stationId   │
│ name        │       │ number      │       │ counterId?  │
│ type        │       │ cashierUid? │       │ queueNumber │
│ description │       │             │       │ status      │
└─────────────┘       └─────────────┘       └─────────────┘
```

- **Station** → **Counter**: One station has many counters (`counters.stationId`).
- **Counter** → **Queue**: When a customer is “serving”, the queue document has `counterId`; a counter can serve one queue at a time.
- **Queue** always belongs to a **Station** (`stationId`); `counterId` is set only when status is `serving`.

## Firestore Collections

| Collection              | Description                                      |
|-------------------------|--------------------------------------------------|
| `stations`              | Service stations (name, type, description).      |
| `counters`              | Counters per station; optional `cashierUid`.     |
| `queue`                 | Queue entries (customer, station, status, etc.). |
| `queue-number-counters` | Per-station sequence for queue numbers (e.g. PAY-001). |
| `blacklist`             | Blocked customer emails (email, reason, blockedBy). |
| `cashiers`              | Cashier employees and station assignment (doc ID = uid). |
| `customer-sessions`     | Short-lived QR/session (type, issuedAt, expiresAt, used). |
| `activity-log`          | Audit log entries (uid, action, timestamp, details). |

## Documents in This Folder

### Core queue flow
- **[Station](./station.md)** — Fields, validation, and usage.
- **[Counter](./counter.md)** — Fields, validation, enter/exit, and relations.
- **[Queue](./queue.md)** — Fields, status lifecycle, and relations.
- **[queue-number-counters](./queue-number-counters.md)** — Per-station queue number sequence.

### Admin & users
- **[Blacklist](./blacklist.md)** — Blocked emails and reasons.
- **[Cashiers](./cashiers.md)** — Cashier role and station assignment.
- **[Activity Log](./activity-log.md)** — Audit log (ActionType, timestamp, details).

### Customer flow
- **[Customer Session](./customer-session.md)** — QR/session (form → queue → completed).

## Source of Truth

- **Types**: `functions/src/types/station.ts`, `counter.ts`, `queue.ts`, `queue-status.ts`, `purpose.ts`, `blacklist.ts`, `activity-log.ts`, `token-type.ts`, `qrcode.ts`
- **Validation**: `functions/src/zod-schemas/station-schema.ts`, `counter-schema.ts`, `join-queue-schema.ts`, `blockEmail.ts`, `assign-cashier-schema.ts`, etc.
- **Controllers**: `functions/src/controllers/stationControllers.ts`, `counterControllers.ts`, `queueControllers.ts`, `adminController.ts`
- **Utils**: `functions/src/utils/recordLog.ts` (activity-log)
