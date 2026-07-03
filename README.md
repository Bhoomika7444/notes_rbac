# 3D Notes Application — Backend Service

A secure, enterprise-grade MVC backend powering the 3D Notes Application. Built with **Node.js, Express.js, TypeScript, MongoDB/Mongoose**, and a robust local file-based database fallback for instant execution in sandboxed preview environments.

---

## 🌟 Highlights & Key Engineering Decisions

- **Hybrid Database Layer**: Automatically connects to **MongoDB Atlas** when `MONGO_URI` is present, but gracefully falls back to a synchronous, local file-based JSON database (`db.json`) if the URI is absent. This prevents dev container boot crashes.
- **Strict MVC & Repository-Service Architecture**: Isolates raw data transactions (Repositories) from business rules (Services) and request/response orchestration (Controllers).
- **Hardened Security Boundaries**:
  - Encapsulates authentication in HTTP-only, secure, SameSite=lax session cookies (hidden from JavaScript).
  - Enforces automatic 15-minute lockout thresholds upon 5 consecutive failed login attempts.
  - Mitigates brute-forcing using IP rate-limiting policies:
    - Auth endpoints limit: `10 requests per 15 minutes`
    - General API endpoints limit: `100 requests per 15 minutes`
  - Eliminates indirect object references (IDOR) on Notes CRUD by embedding owner-scoped controls inside the database queries.
  - Sanitizes inputs against NoSQL Injection (`express-mongo-sanitize`) and shields headers (`helmet`).

---

## 📂 Architecture Directory Tree

```text
├── backend/
│   ├── config/          # Central configuration (DB connections, Winston logger)
│   ├── controllers/     # Request handling, response mapping, status codes
│   ├── middlewares/     # Guards (auth, requireAdmin, error handles, rate limits)
│   ├── models/          # Mongoose data definitions (User, Note)
│   ├── repositories/    # Dual-mode database CRUD (MongoDB Atlas vs JSON fallback)
│   ├── routes/          # Express endpoint mapping and route declarations
│   ├── services/        # Business logic, state changes (Lockouts, validations)
│   ├── tests/           # Backend API and security tests
│   ├── validators/      # Input schema filters (express-validator definitions)
│   └── server.ts        # Entry point, Vite compile mode, graceful shutdown
├── frontend/
│   ├── index.html       # Vite HTML entry
│   └── src/             # React application source
├── db.json              # Local development database file (sandbox mode)
└── .env.example         # System configuration documentation template
```

---

## 🗄️ Database Schema Documentation

### User Schema (`backend/models/User.ts`)
- **`_id`**: String / ObjectId (Unique auto-generated identifier)
- **`email`**: String (Trimming, lowercase, unique, indexed)
- **`passwordHash`**: String (Bcrypt hashed - 10 salt rounds)
- **`role`**: String (`'user'` | `'admin'`, defaults to `'user'`, indexed)
- **`loginAttempts`**: Number (Increments on failed attempts, resets on success)
- **`lockUntil`**: Date / ISO-String (Calculated 15 minutes from lockout trigger)
- **`createdAt` / `updatedAt`**: Date (Automatic timestamps, indexed on `createdAt`)

### Note Schema (`backend/models/Note.ts`)
- **`_id`**: String / ObjectId
- **`userId`**: ObjectId (Refers to `User._id`, required, indexed)
- **`title`**: String (Title of note, defaults to empty)
- **`content`**: String (Content of note, defaults to empty)
- **`color`**: String (Defaults to `'clay'`; restricted to: `clay`, `sand`, `blue`, `sage`, `lavender`)
- **`pinned`**: Boolean (Defaults to `false`)
- **`isDeleted`**: Boolean (Soft-delete flag, defaults to `false`)
- **`createdAt` / `updatedAt`**: Date (Automatic timestamps)

---

## 🔌 API Route Reference & Response Envelopes

### 🔐 Authentication API

#### `POST /api/auth/register`
Creates a user account (default role `'user'`). Sets an HttpOnly `token` cookie on success.
- **Body**: `{ "name": "John Doe", "email": "john@3dnotes.com", "password": "UserPassword123" }`
- **Response (`201 Created`)**:
```json
{
  "success": true,
  "user": {
    "_id": "user-abc123xyz",
    "email": "john@3dnotes.com",
    "name": "John Doe",
    "role": "user"
  }
}
```

#### `POST /api/auth/login`
Authenticates a user. Enforces a 15-minute lock upon 5 failed attempts.
- **Body**: `{ "email": "john@3dnotes.com", "password": "UserPassword123" }`
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "user": {
    "_id": "user-abc123xyz",
    "email": "john@3dnotes.com",
    "name": "John Doe",
    "role": "user"
  }
}
```
- **Locked Account Response (`423 Locked`)**:
```json
{
  "success": false,
  "message": "Too many failed login attempts. Your account has been temporarily locked.",
  "lockUntil": "2026-07-03T08:35:05.123Z",
  "errors": []
}
```

#### `GET /api/auth/me`
Recovers active user context based on the cookie `token`.
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "user": {
    "_id": "user-abc123xyz",
    "email": "john@3dnotes.com",
    "name": "John Doe",
    "role": "user"
  }
}
```

---

### 📝 Notes API

#### `GET /api/notes`
Retrieves non-deleted notes. Returns them sorted pinned notes first, then by date descending.
- **Response (`200 OK`)**:
```json
[
  {
    "_id": "note-9988",
    "userId": "user-abc123xyz",
    "title": "Welcome! 🚀",
    "content": "Hover over this card to feel its depth.",
    "color": "clay",
    "pinned": true,
    "isDeleted": false,
    "createdAt": "2026-07-03T08:16:00.000Z",
    "updatedAt": "2026-07-03T08:16:00.000Z"
  }
]
```

#### `POST /api/notes`
Creates a note. Enforces that at least `title` or `content` is provided.
- **Body**: `{ "title": "Buy milk", "content": "Organic only", "color": "blue" }`
- **Response (`201 Created`)**:
```json
{
  "_id": "note-12345",
  "userId": "user-abc123xyz",
  "title": "Buy milk",
  "content": "Organic only",
  "color": "blue",
  "pinned": false,
  "isDeleted": false,
  "createdAt": "2026-07-03T08:20:00.000Z",
  "updatedAt": "2026-07-03T08:20:00.000Z"
}
```

#### `PUT /api/notes/:id`
Updates a user-owned note card. Returns `404` if the note belongs to another user.
- **Body**: `{ "pinned": true }`
- **Response (`200 OK`)**: Matches Note Object.

---

### 🛠️ Administrative API

#### `GET /api/admin/users`
Performs composite paginated queries on users.
- **Query Params**: `?search=john&sort=name&order=asc&page=1&limit=8&role=user`
- **Response (`200 OK`)**:
```json
{
  "totalRecords": 1,
  "totalPages": 1,
  "currentPage": 1,
  "pageSize": 8,
  "hasNextPage": false,
  "hasPreviousPage": false,
  "users": [
    {
      "_id": "user-abc123xyz",
      "email": "john@3dnotes.com",
      "name": "John Doe",
      "role": "user",
      "loginAttempts": 0,
      "lockUntil": null,
      "createdAt": "2026-07-03T08:16:00.000Z"
    }
  ]
}
```

#### `DELETE /api/admin/users/:id`
Purges a user and their notes. Restricts self-deletion and last-admin deletion.
- **Blocked Response (`400 Bad Request`)**:
```json
{
  "success": false,
  "message": "You cannot delete the last remaining administrator account on this server.",
  "errors": []
}
```

---

## 📁 Postman Collection JSON

Copy the snippet below and import it directly into Postman:

```json
{
  "info": {
    "name": "3D Notes Backend Suite",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Register User",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Content-Type", "value": "application/json" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"name\": \"Studio Creator\",\n  \"email\": \"user@3dnotes.com\",\n  \"password\": \"UserPassword123\"\n}"
        },
        "url": { "raw": "http://localhost:3000/api/auth/register" }
      }
    },
    {
      "name": "Login User",
      "request": {
        "method": "POST",
        "header": [
          { "key": "Content-Type", "value": "application/json" }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"email\": \"user@3dnotes.com\",\n  \"password\": \"UserPassword123\"\n}"
        },
        "url": { "raw": "http://localhost:3000/api/auth/login" }
      }
    },
    {
      "name": "Get My Profile",
      "request": {
        "method": "GET",
        "url": { "raw": "http://localhost:3000/api/auth/me" }
      }
    },
    {
      "name": "Get My Notes",
      "request": {
        "method": "GET",
        "url": { "raw": "http://localhost:3000/api/notes" }
      }
    }
  ]
}
```

---

## 🛠️ Setup & Running

1. **Install Dependencies**:
   ```bash
   npm install
   ```
2. **Start Dev Server**:
   ```bash
   npm run dev
   ```
   For separate frontend/backend terminals, run:
   ```bash
   npm run dev:backend
   npm run dev:frontend
   ```
3. **Compile and Build Production**:
   ```bash
   npm run build
   ```
4. **Boot Deployed Instance**:
   ```bash
   npm run start
   ```

## Deployment Environment

For a split deployment, set `VITE_API_URL` in Vercel to your Render backend URL plus `/api`, and set `FRONTEND_URL` in Render to your Vercel frontend URL. Add any extra frontend domains to `CORS_ORIGINS` as a comma-separated list.

Render must also define `MONGO_URI`, `JWT_SECRET`, and the first-boot admin seed values: `ADMIN_EMAIL`, `ADMIN_NAME`, and `ADMIN_PASSWORD`. The admin password is hashed before storage and is never written to logs.
#   n o t e s - r b a c  
 