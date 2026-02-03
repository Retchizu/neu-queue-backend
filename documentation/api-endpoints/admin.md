# Admin API Endpoints

All admin endpoints require Firebase Auth with `admin` or `superAdmin` role.

---

## User Management

### GET /admin/pending-users

Get list of users with `pending` role awaiting approval.

**Response 200**
```json
{
  "pendingUsers": [
    {
      "id": "string",
      "uid": "string",
      "email": "string",
      "name": "string",
      "role": "pending",
      "createdAt": "string"
    }
  ]
}
```

---

### GET /admin/employees

Get paginated list of employees (excluding self). SuperAdmin can fetch admin, cashier, information; Admin can fetch cashier, information only.

**Query Parameters**
| Param  | Type   | Default | Description      |
|--------|--------|---------|------------------|
| limit  | number | 10      | Results per page |
| cursor | string | -       | Pagination cursor|

**Response 200**
```json
{
  "employees": [
    {
      "id": "string",
      "uid": "string",
      "email": "string",
      "name": "string",
      "role": "string",
      "createdAt": "string"
    }
  ],
  "nextCursor": "string | null"
}
```

---

### POST /admin/assign-role

Assign a role to a user.

**Request Body**
```json
{
  "userId": "string",
  "role": "admin" | "cashier" | "information" | "superAdmin" | "pending"
}
```

**Constraints**
- Admin can assign: `cashier`, `information`, `pending`
- SuperAdmin can assign: `admin`, `cashier`, `information`, `superAdmin`, `pending`
- Cashier must be unassigned from station before changing to non-cashier role

**Response 200**
```json
{
  "data": {
    "userId": "string",
    "role": "string",
    "updatedAt": "string"
  }
}
```

**Errors:** 400 (validation), 403 (unauthorized role), 404 (user not found), 409 (cashier still assigned to station)

---

### POST /admin/assign-cashier

Assign a cashier to a station.

**Request Body**
```json
{
  "userId": "string",
  "stationId": "string"
}
```

**Response 200**
```json
{
  "data": {
    "userId": "string",
    "stationId": "string",
    "updatedAt": "string"
  }
}
```

**Errors:** 400 (user must have cashier role), 404 (user/station/cashier not found)

---

### POST /admin/unassign-cashier

Remove cashier from their assigned station.

**Request Body**
```json
{
  "userId": "string"
}
```

**Response 200**
```json
{
  "data": {
    "userId": "string"
  }
}
```

**Errors:** 400 (user must have cashier role, not assigned), 404 (user/cashier not found)

---

### GET /admin/users/:userId

Get detailed user data including station and counter assignment.

**Response 200**
```json
{
  "user": {
    "id": "string",
    "uid": "string",
    "email": "string",
    "displayName": "string",
    "role": "string",
    "assignedStationId": "string | null",
    "assignedCounterId": "string | null",
    "createdAt": "string",
    "lastSignInTime": "string | null"
  }
}
```

**Errors:** 404 (user not found)

---

### GET /admin/available-cashiers

Get cashiers not assigned to any station.

**Response 200**
```json
{
  "availableCashiers": [
    {
      "id": "string",
      "uid": "string",
      "email": "string",
      "name": "string",
      "role": "cashier",
      "stationId": null,
      "createdAt": "string"
    }
  ]
}
```

---

### GET /admin/stations/:stationId/cashiers

Get cashiers assigned to a station.

**Response 200**
```json
{
  "cashiers": [
    {
      "id": "string",
      "uid": "string",
      "email": "string",
      "name": "string",
      "role": "string",
      "stationId": "string | null",
      "counterId": "string | null",
      "createdAt": "string",
      "lastSignInTime": "string | null"
    }
  ]
}
```

**Errors:** 400 (stationId required), 404 (station not found)

---

## Activity Logs

### GET /admin/activity-logs

Get activity logs within a date range.

**Query Parameters**
| Param     | Type   | Required | Description          |
|-----------|--------|----------|----------------------|
| startDate | string | yes      | ISO date string      |
| endDate   | string | yes      | ISO date string      |

**Response 200**
```json
{
  "activityLogs": [
    {
      "id": "string",
      "timestamp": "number",
      "actorId": "string",
      "action": "string",
      "message": "string"
    }
  ]
}
```

**Errors:** 400 (missing or invalid date params)

---

## Blacklist Management

### GET /admin/blacklist

List all blacklisted emails.

**Response 200**
```json
{
  "blacklistedEmails": [
    {
      "id": "string",
      "email": "string",
      "reason": "string",
      "blockedAt": "string",
      "blockedBy": "string"
    }
  ]
}
```

---

### POST /admin/blacklist

Block a customer email.

**Request Body**
```json
{
  "email": "string",
  "reason": "string"
}
```

**Response 200**
```json
{
  "message": "Email successfully blacklisted."
}
```

**Errors:** 400 (validation), 409 (already blacklisted)

---

### DELETE /admin/blacklist/:email

Remove an email from the blacklist. Use the raw email (URL-encoded if needed).

**Response 200**
```json
{
  "message": "Email removed from blacklist."
}
```

**Errors:** 400 (email required), 404 (email not in blacklist)
