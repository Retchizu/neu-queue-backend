# Counters API Endpoints

All counter endpoints require Firebase Auth unless noted. Role requirements vary per endpoint.

---

## POST /counters

Add a new counter to a station. **Roles:** admin, superAdmin

**Request Body**
```json
{
  "stationId": "string",
  "number": "number"
}
```

- `number`: Positive integer (counter display number)

**Response 201**
```json
{
  "message": "Counter added Successfully",
  "counter": {
    "id": "string",
    "number": "number",
    "stationId": "string",
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
}
```

**Errors:** 400 (validation), 404 (station not found), 409 (counter number already exists)

---

## GET /counters

List counters. Requires `stationId` in query. **Roles:** admin, superAdmin

**Query Parameters**
| Param     | Type   | Required | Default | Description      |
|-----------|--------|----------|---------|------------------|
| stationId | string | yes      | -       | Filter by station|
| limit     | number | no       | 10      | Results per page |
| cursor    | string | no       | -       | Pagination cursor|

**Response 200**
```json
{
  "counters": [
    {
      "id": "string",
      "number": "number",
      "stationId": "string",
      "cashierUid": "string | null",
      "createdAt": "timestamp",
      "updatedAt": "timestamp"
    }
  ],
  "nextCursor": "string | null"
}
```

**Errors:** 404 (station not found - note: controller returns 404 for missing stationId)

---

## POST /counters/assigned

Get counter(s) assigned to the authenticated user (by `cashierUid`). **Roles:** Any authenticated user

**Request Body**
```json
{
  "uid": "string"
}
```

**Response 200**
```json
{
  "counters": [
    {
      "id": "string",
      "number": "number",
      "stationId": "string",
      "cashierUid": "string",
      "createdAt": "timestamp",
      "updatedAt": "timestamp"
    }
  ]
}
```

---

## GET /counters/:stationId

List counters for a specific station. **Roles:** admin, superAdmin, cashier

**Path Parameters**
| Param     | Type   | Description |
|-----------|--------|-------------|
| stationId | string | Station ID  |

**Query Parameters**
| Param  | Type   | Default | Description      |
|--------|--------|---------|------------------|
| limit  | number | 10      | Results per page |
| cursor | string | -       | Pagination cursor|

**Response 200**
```json
{
  "counters": [
    {
      "id": "string",
      "number": "number",
      "stationId": "string",
      "cashierUid": "string | null",
      "createdAt": "timestamp",
      "updatedAt": "timestamp"
    }
  ],
  "nextCursor": "string | null"
}
```

**Errors:** 400 (stationId required), 404 (station not found)

---

## DELETE /counters/:counterId

Delete a counter. Counter must not have an active cashier. **Roles:** admin, superAdmin

**Path Parameters**
| Param     | Type   | Description |
|-----------|--------|-------------|
| counterId | string | Counter ID  |

**Query Parameters**
| Param     | Type   | Required | Description                    |
|-----------|--------|----------|--------------------------------|
| stationId | string | no       | Used if counter doc lacks it   |

**Response 200**
```json
{
  "message": "<number> has been removed"
}
```

**Errors:** 400 (missing counterId), 404 (counter not found), 409 (counter is active)

---

## PUT /counters/:counterId

Update a counter (e.g. number). Cannot update if cashier is active. **Roles:** admin, superAdmin

**Path Parameters**
| Param     | Type   | Description |
|-----------|--------|-------------|
| counterId | string | Counter ID  |

**Request Body**
```json
{
  "stationId": "string",
  "number": "number",
  "cashierUid": "string (optional, ignored)"
}
```

- `cashierUid` in body returns 409 (cannot update active counter)

**Response 200**
```json
{
  "message": "<oldNumber> has been updated to <newNumber>",
  "counter": {
    "id": "string",
    "number": "number",
    "stationId": "string",
    "cashierUid": "string | null",
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
}
```

**Errors:** 400 (validation, station/counter mismatch), 404 (station/counter not found), 409 (active counter)

---

## POST /counters/:counterId/enter

Cashier enters/occupies a counter. **Roles:** cashier

**Path Parameters**
| Param     | Type   | Description |
|-----------|--------|-------------|
| counterId | string | Counter ID  |

**Response 200**
```json
{
  "message": "Successfully entered counter <number>",
  "counter": {
    "id": "string",
    "number": "number",
    "stationId": "string",
    "cashierUid": "string",
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
}
```

**Errors:** 400 (missing counterId), 404 (counter not found), 409 (counter already occupied by another cashier)

---

## POST /counters/:counterId/exit

Cashier exits a counter. Cannot exit if customers are still queued (waiting/serving) at the station. **Roles:** cashier

**Path Parameters**
| Param     | Type   | Description |
|-----------|--------|-------------|
| counterId | string | Counter ID  |

**Response 200**
```json
{
  "message": "Successfully exited counter <number>",
  "counter": {
    "id": "string",
    "number": "number",
    "stationId": "string",
    "cashierUid": null,
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
}
```

**Errors:** 400 (counter not occupied), 403 (not assigned to this counter), 404 (counter not found), 409 (customers still queued)
