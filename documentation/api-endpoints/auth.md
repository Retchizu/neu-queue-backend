# Auth API Endpoints

Endpoints for fetching current user details based on role. Each requires Firebase Auth with the appropriate role.

---

## GET /auth/admin/me

Get current admin user details. **Roles:** admin, superAdmin

**Response 200**
```json
{
  "user": {
    "uid": "string",
    "displayName": "string | null",
    "email": "string | null",
    "displayPicture": "string | null",
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
}
```

---

## GET /auth/cashier/me

Get current cashier user details including station assignment. **Roles:** cashier

**Response 200**
```json
{
  "user": {
    "uid": "string",
    "displayName": "string | null",
    "email": "string | null",
    "displayPicture": "string | null",
    "stationId": "string | null",
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
}
```

---

## GET /auth/information/me

Get current information staff user details. **Roles:** information, admin, superAdmin

**Response 200**
```json
{
  "user": {
    "uid": "string",
    "displayName": "string | null",
    "email": "string | null",
    "displayPicture": "string | null",
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
}
```

**Errors:** 401 (unauthorized), 500 (server error)
