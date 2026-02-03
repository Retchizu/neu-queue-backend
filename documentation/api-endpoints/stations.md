# Stations API Endpoints

All station endpoints require Firebase Auth. Role requirements vary per endpoint.

---

## GET /stations/assigned

Get the station assigned to the authenticated cashier. **Roles:** cashier

**Response 200**
```json
{
  "stationId": "string"
}
```

Returns empty string if not assigned. **Errors:** 404 (cashier not found)

---

## POST /stations

Add a new station. **Roles:** admin, superAdmin

**Request Body**
```json
{
  "name": "string",
  "description": "string",
  "type": "payment" | "auditing" | "clinic" | "registrar"
}
```

**Response 201**
```json
{
  "message": "Station added successfully.",
  "station": {
    "id": "string",
    "name": "string",
    "description": "string",
    "type": "string"
  }
}
```

**Errors:** 400 (validation), 409 (station name already exists)

---

## GET /stations

List all stations (paginated). **Roles:** admin, superAdmin

**Query Parameters**
| Param  | Type   | Default | Description      |
|--------|--------|---------|------------------|
| limit  | number | 10      | Results per page |
| cursor | string | -       | Pagination cursor|

**Response 200**
```json
{
  "stations": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "type": "string",
      "createdAt": "timestamp",
      "updatedAt": "timestamp"
    }
  ],
  "nextCursor": "string | null"
}
```

---

## GET /stations/:stationId

Get a station by ID. **Roles:** admin, superAdmin, cashier

**Path Parameters**
| Param     | Type   | Description |
|-----------|--------|-------------|
| stationId | string | Station ID  |

**Response 200**
```json
{
  "station": {
    "id": "string",
    "name": "string",
    "description": "string",
    "type": "string",
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
}
```

**Errors:** 404 (station not found)

---

## PUT /stations/:stationId

Update a station. **Roles:** admin, superAdmin

**Path Parameters**
| Param     | Type   | Description |
|-----------|--------|-------------|
| stationId | string | Station ID  |

**Request Body**
```json
{
  "name": "string",
  "description": "string",
  "type": "payment" | "auditing" | "clinic" | "registrar"
}
```

All fields optional; only provided fields are updated.

**Response 200**
```json
{
  "station": {
    "id": "string",
    "name": "string",
    "description": "string",
    "type": "string",
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
}
```

**Errors:** 400 (validation), 404 (station not found), 409 (duplicate station name)

---

## DELETE /stations/:stationId

Delete a station. Cannot delete if any counter has an active cashier. **Roles:** admin, superAdmin

**Path Parameters**
| Param     | Type   | Description |
|-----------|--------|-------------|
| stationId | string | Station ID  |

**Response 200**
```json
{
  "message": "string"
}
```

**Errors:** 404 (station not found), 409 (active counters with assigned cashiers)
