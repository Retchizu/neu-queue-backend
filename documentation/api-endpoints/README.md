# NEU Queue API Endpoints

API documentation for the NEU Queue backend. The API is served via Firebase Cloud Functions.

## Base URL

The API base URL depends on your Firebase deployment (e.g. `https://<region>-<project>.cloudfunctions.net/neu`).

## Authentication

Most endpoints require one of:

| Auth Type | Description |
|-----------|-------------|
| **Firebase Auth** | Bearer token via `Authorization` header for admin/cashier/information roles |
| **Customer Session** | Session ID from `getQueueAccess` for customer queue flow |

Role hierarchy: `superAdmin` > `admin` > `cashier` | `information` > `pending`

---

## Endpoint Index

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/` | Welcome message | Public |
| **Admin** | | | |
| GET | `/admin/pending-users` | List pending users | admin, superAdmin |
| GET | `/admin/employees` | List employees (paginated) | admin, superAdmin |
| POST | `/admin/assign-role` | Assign role to user | admin, superAdmin |
| POST | `/admin/assign-cashier` | Assign cashier to station | admin, superAdmin |
| POST | `/admin/unassign-cashier` | Unassign cashier from station | admin, superAdmin |
| GET | `/admin/users/:userId` | Get user details | admin, superAdmin |
| GET | `/admin/available-cashiers` | List cashiers not assigned to stations | admin, superAdmin |
| GET | `/admin/stations/:stationId/cashiers` | Get cashiers by station | admin, superAdmin |
| GET | `/admin/activity-logs` | Get activity logs (date range) | admin, superAdmin |
| GET | `/admin/blacklist` | List blacklisted emails | admin, superAdmin |
| POST | `/admin/blacklist` | Block customer email | admin, superAdmin |
| DELETE | `/admin/blacklist/:email` | Remove email from blacklist | admin, superAdmin |
| **Analytics** | | | |
| GET | `/analytics/average-wait-time` | Average wait time per station | admin, superAdmin |
| GET | `/analytics/completed-throughput` | Completed services per station | admin, superAdmin |
| **Counters** | | | |
| POST | `/counters` | Add counter | admin, superAdmin |
| GET | `/counters` | List counters (by station) | admin, superAdmin |
| POST | `/counters/assigned` | Get assigned counter for user | Authenticated |
| GET | `/counters/:stationId` | List counters by station | admin, superAdmin, cashier |
| DELETE | `/counters/:counterId` | Delete counter | admin, superAdmin |
| PUT | `/counters/:counterId` | Update counter | admin, superAdmin |
| POST | `/counters/:counterId/enter` | Cashier enter counter | cashier |
| POST | `/counters/:counterId/exit` | Cashier exit counter | cashier |
| **Queues** | | | |
| GET | `/queues/queue-access` | Get queue access (session) | Public (query param) |
| POST | `/queues/join` | Join queue | Customer session |
| GET | `/queues/queue` | Get queue by qrId | Customer session |
| GET | `/queues/counters/:counterId` | Get counter info | Customer session |
| GET | `/queues/qrcode` | Generate QR code | cashier, admin, superAdmin, information |
| GET | `/queues/available-stations` | List stations by purpose | Customer session |
| GET | `/queues/station/:stationId` | Get queues by station | cashier, admin, superAdmin |
| GET | `/queues/counter/:counterId` | Get queues by counter | cashier, admin, superAdmin |
| GET | `/queues/counter/:counterId/current-serving` | Get current serving customer | cashier, admin, superAdmin |
| POST | `/queues/:queueId/start-service` | Start serving customer | cashier, admin, superAdmin |
| POST | `/queues/:queueId/complete` | Complete service | cashier, admin, superAdmin |
| POST | `/queues/:queueId/cancel` | Cancel queue (customer) | Customer session |
| POST | `/queues/:queueId/mark-no-show` | Mark customer as no-show | cashier, admin, superAdmin |
| **Stations** | | | |
| GET | `/stations/assigned` | Get cashier's assigned station | cashier |
| POST | `/stations` | Add station | admin, superAdmin |
| GET | `/stations` | List stations | admin, superAdmin |
| GET | `/stations/:stationId` | Get station by ID | admin, superAdmin, cashier |
| DELETE | `/stations/:stationId` | Delete station | admin, superAdmin |
| PUT | `/stations/:stationId` | Update station | admin, superAdmin |
| **Auth** | | | |
| GET | `/auth/admin/me` | Get admin auth details | admin, superAdmin |
| GET | `/auth/cashier/me` | Get cashier auth details | cashier |
| GET | `/auth/information/me` | Get information staff auth details | information, admin, superAdmin |

---

## Detailed Documentation

- [Admin](./admin.md)
- [Analytics](./analytics.md)
- [Counters](./counters.md)
- [Queues](./queues.md)
- [Stations](./stations.md)
- [Auth](./auth.md)
