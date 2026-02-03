# Analytics API Endpoints

All analytics endpoints require Firebase Auth with `admin` or `superAdmin` role.

---

## GET /analytics/average-wait-time

Returns average actual wait time (createdAt → servedAt) per station. Uses served queue entries (status: `completed` or `serving`).

**Query Parameters**
| Param     | Type   | Required | Description                    |
|-----------|--------|----------|--------------------------------|
| startDate | string | no       | ISO date string (filter range) |
| endDate   | string | no       | ISO date string (filter range) |

If both `startDate` and `endDate` are provided, filters by `servedAt` within range. Otherwise uses last ~50 served entries per station.

**Response 200**
```json
{
  "<stationId>": {
    "stationName": "string",
    "averageWaitTimeMinutes": "number",
    "sampleCount": "number"
  }
}
```

**Errors:** 400 (invalid date format)

---

## GET /analytics/completed-throughput

Returns number of completed services per station within a date range. Uses `completedAt` for filtering.

**Query Parameters**
| Param     | Type   | Required | Description               |
|-----------|--------|----------|---------------------------|
| startDate | string | yes      | ISO date string           |
| endDate   | string | yes      | ISO date string           |

**Response 200**
```json
{
  "<stationId>": {
    "stationName": "string",
    "completedCount": "number"
  }
}
```

**Errors:** 400 (missing or invalid date params)
