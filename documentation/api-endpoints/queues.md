# Queues API Endpoints

Queue endpoints use different auth mechanisms: public, customer session (from `getQueueAccess`), or Firebase Auth (staff roles).

---

## Public / Session

### GET /queues/queue-access

Get queue access and session. Validates `initialQrId` from Redis (QR scan flow) and creates a customer session.

**Query Parameters**
| Param      | Type   | Required | Description                        |
|------------|--------|----------|------------------------------------|
| initialQrId| string | yes      | QR ID from staff-generated QR code |

**Response 200**
```json
{
  "path": "/form" | "/queue",
  "sessionId": "string"
}
```

- `path`: `/form` for initial flow (join form), `/queue` if already in queue
- `sessionId`: Use in subsequent customer requests (e.g. `sessionId` header or cookie per `verifyCustomerSession`)

**Errors:** 403 (invalid or expired QR template)

---

## Customer Routes (Customer Session Required)

Customer routes require a valid customer session from `getQueueAccess`. The session is typically passed via `verifyCustomerSession` middleware (check middleware for exact header/cookie name).

### POST /queues/join

Customer joins a queue.

**Request Body**
```json
{
  "email": "string",
  "purpose": "payment" | "auditing" | "clinic" | "registrar",
  "stationId": "string",
  "qrId": "string"
}
```

- `purpose`: Must match station type
- `qrId`: Session ID from `getQueueAccess`

**Response 200**
```json
{
  "message": "string",
  "queueNumber": "string",
  "position": "number",
  "estimatedWaitTime": "number"
}
```

**Errors:** 400 (purpose mismatch, validation), 404 (station not found), 409 (already in queue)

---

### GET /queues/queue

Get queue status for the current customer (by qrId/sessionId).

**Query Parameters**
| Param  | Type   | Required | Description        |
|--------|--------|----------|--------------------|
| qrId   | string | yes      | Session/QR ID      |
| status | string | no       | Filter by status   |

**Response 200**
```json
{
  "id": "string",
  "stationId": "string",
  "counterId": "string | null",
  "queueNumber": "string",
  "purpose": "string",
  "customerEmail": "string",
  "status": "waiting" | "serving" | "completed" | "cancelled" | "no_show",
  "position": "number",
  "estimatedWaitTime": "number",
  "qrId": "string",
  "createdAt": "timestamp",
  "servedAt": "timestamp | null",
  "servedBy": "string | null",
  "completedAt": "timestamp | null",
  "cancelledAt": "timestamp | null",
  "cancelledBy": "string | null"
}
```

**Errors:** 400 (qrId required), 404 (queue not found)

---

### GET /queues/counters/:counterId

Get counter details (customer view). **Auth:** Customer session (queue type)

**Path Parameters**
| Param     | Type   | Description |
|-----------|--------|-------------|
| counterId | string | Counter ID  |

**Response 200**
```json
{
  "id": "string",
  "number": "number",
  "stationId": "string",
  "cashierUid": "string | null",
  "createdAt": "timestamp",
  "updatedAt": "timestamp"
}
```

**Errors:** 404 (counter not found)

---

## Staff Routes (Firebase Auth)

### GET /queues/qrcode

Generate QR code for customer flow. **Roles:** cashier, admin, superAdmin, information

**Response 201**
```json
{
  "qrCodeDataUrl": "string",
  "qrId": "string"
}
```

- `qrCodeDataUrl`: Data URL for displaying QR image
- `qrId`: Expires in 5 minutes; used in `getQueueAccess`

---

### GET /queues/available-stations

List stations with at least one active counter (cashier present) for a given purpose. **Auth:** Customer session (form type)

**Query Parameters**
| Param   | Type   | Required | Description                                   |
|---------|--------|----------|-----------------------------------------------|
| purpose | string | yes      | One of: `payment`, `clinic`, `auditing`, `registrar` |

**Response 200**
```json
{
  "stations": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "type": "string",
      "estimatedWaitTime": "number"
    }
  ]
}
```

**Errors:** 400 (invalid or missing purpose)

---

### GET /queues/station/:stationId

Get queues for a station. **Roles:** cashier, admin, superAdmin

**Path Parameters**
| Param     | Type   | Description |
|-----------|--------|-------------|
| stationId | string | Station ID  |

**Query Parameters**
| Param  | Type   | Default | Description      |
|--------|--------|---------|------------------|
| status | string | -       | Filter by status |
| limit  | number | 10      | Results per page |
| cursor | string | -       | Pagination cursor|

**Response 200**
```json
{
  "queues": [
    {
      "id": "string",
      "stationId": "string",
      "counterId": "string | null",
      "queueNumber": "string",
      "purpose": "string",
      "customerEmail": "string",
      "status": "string",
      "position": "number",
      "estimatedWaitTime": "number",
      "qrId": "string",
      "createdAt": "timestamp",
      "servedAt": "timestamp | null",
      "servedBy": "string | null",
      "completedAt": "timestamp | null",
      "cancelledAt": "timestamp | null",
      "cancelledBy": "string | null"
    }
  ],
  "nextCursor": "string | null"
}
```

**Errors:** 400 (stationId required), 404 (station not found)

---

### GET /queues/counter/:counterId

Get queues for a counter. **Roles:** cashier, admin, superAdmin

**Path Parameters**
| Param     | Type   | Description |
|-----------|--------|-------------|
| counterId | string | Counter ID  |

**Query Parameters**
| Param  | Type   | Default | Description      |
|--------|--------|---------|------------------|
| status | string | -       | Filter by status |
| limit  | number | 10      | Results per page |
| cursor | string | -       | Pagination cursor|

**Response 200**
```json
{
  "queues": [...],
  "nextCursor": "string | null"
}
```

**Errors:** 400 (counterId required), 404 (counter not found)

---

### GET /queues/counter/:counterId/current-serving

Get the customer currently being served at a counter. **Roles:** cashier, admin, superAdmin

**Path Parameters**
| Param     | Type   | Description |
|-----------|--------|-------------|
| counterId | string | Counter ID  |

**Response 200**
```json
{
  "currentServing": {
    "id": "string",
    "stationId": "string",
    "counterId": "string",
    "queueNumber": "string",
    "purpose": "string",
    "customerEmail": "string",
    "status": "serving",
    "position": "number",
    "estimatedWaitTime": "number",
    "qrId": "string",
    "createdAt": "timestamp",
    "servedAt": "timestamp",
    "servedBy": "string",
    "completedAt": "null",
    "cancelledAt": "null",
    "cancelledBy": "null"
  }
}
```
or `"currentServing": null` if no one is being served.

**Errors:** 400 (counterId required), 404 (counter not found)

---

### POST /queues/:queueId/start-service

Start serving a customer at a counter. Queue must be `waiting`. **Roles:** cashier, admin, superAdmin

**Path Parameters**
| Param   | Type   | Description |
|---------|--------|-------------|
| queueId | string | Queue ID    |

**Request Body**
```json
{
  "counterId": "string"
}
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "queueId": "string",
    "queueNumber": "string",
    "status": "serving",
    "counterId": "string",
    "servedAt": "timestamp",
    "servedBy": "string"
  }
}
```

**Errors:** 400 (queue not waiting, validation), 404 (queue/counter not found)

---

### POST /queues/:queueId/complete

Complete service for a customer. Queue must be `serving`. **Roles:** cashier, admin, superAdmin

**Path Parameters**
| Param   | Type   | Description |
|---------|--------|-------------|
| queueId | string | Queue ID    |

**Request Body**
```json
{
  "notes": "string (optional)"
}
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "queueId": "string",
    "queueNumber": "string",
    "status": "completed",
    "completedAt": "timestamp"
  }
}
```

**Errors:** 400 (queue not serving), 404 (queue not found)

---

### POST /queues/:queueId/cancel

Customer cancels their own queue. Queue must be `waiting` or `serving`. **Auth:** Customer session (queue type)

**Path Parameters**
| Param   | Type   | Description |
|---------|--------|-------------|
| queueId | string | Queue ID    |

**Request Body**
```json
{
  "reason": "string (optional)"
}
```

**Response 200**
```json
{
  "success": true,
  "data": {
    "queueId": "string",
    "queueNumber": "string",
    "status": "cancelled",
    "cancelledAt": "timestamp"
  }
}
```

**Errors:** 400 (invalid status), 404 (queue not found)

---

### POST /queues/:queueId/mark-no-show

Mark customer as no-show. Queue must be `waiting` or `serving`. Recalculates positions for remaining queues. **Roles:** cashier, admin, superAdmin

**Path Parameters**
| Param   | Type   | Description |
|---------|--------|-------------|
| queueId | string | Queue ID    |

**Response 200**
```json
{
  "success": true,
  "data": {
    "queueId": "string",
    "queueNumber": "string",
    "status": "no_show",
    "cancelledAt": "timestamp"
  }
}
```

**Errors:** 400 (invalid status), 404 (queue not found)
