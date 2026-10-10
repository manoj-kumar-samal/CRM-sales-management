# CRM Sales Management System – Backend API

A RESTful backend that manages a company's whole sales process:

**Lead generation → Lead qualification → Customer conversion → Deal management → Deal closure**

Built with Node.js, Express and MongoDB. No frontend – use the included Postman collection.

- **Deployed link:** 
- **Live API:** https://crm-sales-management-d8ou.onrender.com
- **Health check:** https://crm-sales-management-d8ou.onrender.com/health
- **Base URL:** https://crm-sales-management-d8ou.onrender.com/api/v1
- **Note:** hosted on a free tier, so the first request after idle can take up to a minute.

- **API documentation:** [`docs/CRM-Sales-API.postman_collection.json`](docs/CRM-Sales-API.postman_collection.json) (import into Postman) + the endpoint tables and samples below

---

## 1. Technologies used

| Purpose | Library |
|---|---|
| Server / routing | Node.js 18+, Express 4 |
| Database | MongoDB + Mongoose 8 (transactions for lead conversion) |
| Auth | JWT (access + refresh), bcryptjs, httpOnly cookies |
| Validation | Zod |
| Security | helmet, cors, express-rate-limit |
| Logging | morgan (method / url / status only) |

## 2. Project structure

```
src/
├── config/        env loading, DB connection, constants (roles, enums, state machines)
├── models/        User, Lead, Customer, Deal, Activity, Timeline
├── validators/    Zod schemas (one file per resource)
├── middleware/    auth (protect/authorize), validate, rateLimiter, errorHandler
├── controllers/   thin: read request -> call service -> send response
├── services/      ALL business logic (access rules, state machines, transactions, analytics)
├── routes/        route -> middleware -> controller wiring
├── utils/         AppError, asyncHandler, apiResponse, query helpers, tokens
├── app.js         express app (security middleware, routes, error handling)
└── server.js      DB connect + listen
scripts/seed.js    demo users
docs/              Postman collection
```

## 3. Installation & setup

```bash
git clone <your-repo>
cd backend
npm install
cp .env.example .env      
npm run seed              
npm run dev               
```

### Environment variables (`.env.example`)

| Variable | Description |
|---|---|
| `NODE_ENV` | `development` or `production` (production hides error details, enables secure cookies) |
| `PORT` | Server port (default 5000) |
| `MONGO_URI` | MongoDB connection string – **must be a replica set** (see below) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Two different long random strings |
| `BCRYPT_ROUNDS` | Password hashing cost (default 12) |
| `CLIENT_ORIGINS` | Comma-separated list of allowed CORS origins |
| `COOKIE_SAME_SITE` | `strict` (default), `lax` or `none` |
| `RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_MAX` | Requests per 15 min (general / login-register-refresh) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Admin created by `npm run seed` |

### Database setup (important: replica set)

MongoDB **transactions only work on a replica set**, and lead conversion uses one. Two easy options:

1. **MongoDB Atlas** (free tier) – every Atlas cluster is a replica set. Paste its connection string into `MONGO_URI`.
2. **Local Docker replica set**
   ```bash
   docker run -d --name mongo-rs -p 27017:27017 mongo:7 --replSet rs0 --bind_ip_all
   docker exec mongo-rs mongosh --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'localhost:27017'}]})"
   # MONGO_URI=mongodb://localhost:27017/crm_sales?replicaSet=rs0
   ```

`npm run seed` creates (and syncs indexes for):

| Email | Password | Role |
|---|---|---|
| admin@crm.com (from `.env`) | Admin@12345 (from `.env`) | Admin |
| manager@crm.com | Password@123 | Sales Manager |
| ethan@crm.com, priya@crm.com | Password@123 | Sales Executives (in the manager's team) |

> Change or remove the demo accounts before a real deployment.

### Run it
`npm run dev` → API at `http://localhost:5000/api/v1`. Quick check: `curl http://localhost:5000/health`

### Using Postman
Import `docs/CRM-Sales-API.postman_collection.json` → run **Auth › Login** (token is saved automatically) → copy a manager id and executive id from **Users › List users** into the `managerId` / `executiveId` collection variables → walk the folders in order. IDs of created records are saved automatically.

---

## 4. Authentication

- **Register** (`POST /auth/register`) – public, **always creates a sales executive** (nobody can self-register as admin). Admins create other roles through `POST /users`.
- **Login** returns a short-lived **access token** (JWT, 15 min) in the response body and sets two **httpOnly cookies**: `accessToken` and `refreshToken` (7 days, only sent to `/api/v1/auth`).
- The access token is accepted as `Authorization: Bearer <token>` **or** the cookie.
- **Refresh** (`POST /auth/refresh`) rotates the refresh token. Only a **SHA-256 hash** of the refresh token is stored in the DB, so a DB leak does not leak usable tokens.
- **Logout** deletes the stored refresh token and clears cookies.
- Passwords are hashed with **bcrypt**; `password` and `refreshTokenHash` are `select: false` and stripped in `toJSON`, so they never appear in responses.
- The auth middleware re-loads the user on every request, so **deactivating a user locks them out immediately**.
- Login returns the same error for unknown email and wrong password (no user enumeration).

## 5. User roles & permissions

| Capability | Admin | Sales Manager | Sales Executive |
|---|:-:|:-:|:-:|
| Manage users (CRUD, activate/deactivate) | ✅ | ❌ | ❌ |
| See leads / customers / deals / activities | All | Own team | Own only |
| Create / update leads | ✅ | ✅ (team scope) | ✅ (auto-assigned to self) |
| Assign / reassign leads, customers, deals | ✅ any executive | ✅ own team's executives | ❌ |
| Delete lead | ✅ | ✅ (team scope) | ❌ |
| Convert qualified lead | ✅ | ✅ | ✅ (own leads) |
| Create / update customers & deals, move deal stages | ✅ | ✅ (team scope) | ✅ (own) |
| Delete customer | ✅ | ❌ | ❌ |
| Create notes, activities, follow-ups | ✅ | ✅ | ✅ (own scope) |
| Dashboard stats & pipeline | Company-wide | Team | Own |
| Team performance | ✅ | ✅ (own team) | ❌ |

**How "team" works:** each sales executive has a `manager` field pointing to a sales manager. A manager's scope = themselves + executives where `manager == manager._id` (+ unassigned leads, so they can assign them).

**How it is enforced:** routes use `authorize(...roles)` for role checks; every service loads the record and runs an ownership check (`canAccessOwner`) so a user can never read or change a record outside their scope (**403**), even by guessing an ID.

---

## 6. API overview

Base URL: `/api/v1` – all routes except register/login/refresh need authentication.

**Auth** — `POST /auth/register` · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me` · `PATCH /auth/me`

**Users (admin)** — `POST /users` · `GET /users` (search, role, isActive, sort, paginate) · `GET /users/assignable` (admin/manager) · `GET|PATCH|DELETE /users/:id` · `PATCH /users/:id/status`

**Leads** — `POST /leads` · `GET /leads` · `GET|PATCH /leads/:id` · `DELETE /leads/:id` (admin/manager) · `PATCH /leads/:id/status` · `PATCH /leads/:id/assign` (admin/manager) · `POST /leads/:id/convert` · `GET /leads/:id/timeline`

**Customers** — `POST /customers` · `GET /customers` · `GET|PATCH /customers/:id` · `DELETE /customers/:id` (admin) · `PATCH /customers/:id/assign` (admin/manager) · `GET /customers/:id/timeline`

**Deals** — `POST /deals` · `GET /deals` · `GET|PATCH /deals/:id` · `PATCH /deals/:id/stage` · `PATCH /deals/:id/assign` (admin/manager) · `GET /deals/:id/timeline`

**Activities** — `POST /activities` · `GET /activities` · `GET|PATCH|DELETE /activities/:id` · `PATCH /activities/:id/complete`

**Dashboard** — `GET /dashboard/stats` · `GET /dashboard/pipeline` · `GET /dashboard/team-performance` (admin/manager)

### List endpoints: pagination, search, sort, filters

Every list endpoint returns paginated data (`page` default 1, `limit` default 10, max 100), plus `search`, `sortBy`, `order=asc|desc`. Filters can be combined freely.

| Resource | Filters |
|---|---|
| Leads | `status`, `priority`, `source`, `assignedTo`, `unassigned=true`, `createdFrom`, `createdTo`, `search` (name/email/company/phone) |
| Customers | `status`, `assignedTo`, `createdFrom`, `createdTo`, `search` |
| Deals | `stage`, `status` (Open/Won/Lost), `assignedTo`, `customer`, `minAmount`, `maxAmount`, `closingFrom`, `closingTo`, `search` |
| Activities | `type`, `status` (Pending/Completed/Overdue), `assignedTo`, `relatedModel`, `relatedTo`, `dueFrom`, `dueTo`, `search` |
| Users | `role`, `isActive`, `search` (name/email) |

Example: `GET /leads?status=Qualified&priority=High&source=Website&createdFrom=2026-01-01&search=acme&sortBy=createdAt&order=desc&page=2&limit=20`

### Response format

```jsonc
// success
{ "success": true, "message": "Lead fetched successfully", "data": { } }

// success (list)
{ "success": true, "message": "Leads fetched successfully", "data": [ ],
  "pagination": { "currentPage": 1, "pageSize": 10, "totalRecords": 42, "totalPages": 5 } }

// error
{ "success": false, "message": "Lead not found" }

// validation error
{ "success": false, "message": "Validation failed",
  "errors": [ { "field": "body.email", "message": "Invalid email address" } ] }
```

| Status | Meaning |
|---|---|
| 400 | Validation failed / business rule violated |
| 401 | Not logged in, bad or expired token |
| 403 | Role or ownership does not allow it |
| 404 | Resource not found |
| 409 | Conflict (duplicate email, already converted, closed deal…) |
| 429 | Rate limited |
| 500 | Unexpected error (details hidden in production) |

### Sample requests & responses

**Login** – `POST /auth/login`
```json
{ "email": "manager@crm.com", "password": "Password@123" }
```
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { "_id": "66f1...", "name": "Maya Manager", "email": "manager@crm.com", "role": "sales_manager", "isActive": true },
    "accessToken": "eyJhbGciOi..."
  }
}
```

**Create lead** – `POST /leads` (as executive → auto-assigned to self)
```json
{ "name": "Anita Sharma", "email": "anita@acme.com", "phone": "+91 99999 88888", "company": "Acme Corp", "source": "Website", "priority": "High" }
```
```json
{
  "success": true,
  "message": "Lead created successfully",
  "data": { "_id": "66f2...", "name": "Anita Sharma", "email": "anita@acme.com", "company": "Acme Corp", "source": "Website",
            "status": "New", "priority": "High", "assignedTo": "66f1...", "isConverted": false, "createdAt": "2026-10-08T10:15:00.000Z" }
}
```

**Convert lead** – `POST /leads/:id/convert`
```json
{ "deal": { "dealName": "Acme Enterprise Plan", "value": 50000, "probability": 20, "expectedClosingDate": "2026-12-31" } }
```
```json
{
  "success": true,
  "message": "Lead converted to customer and deal successfully",
  "data": {
    "lead":     { "_id": "66f2...", "status": "Converted", "isConverted": true, "customer": "66f3...", "deal": "66f4..." },
    "customer": { "_id": "66f3...", "name": "Anita Sharma", "lead": "66f2...", "status": "Active" },
    "deal":     { "_id": "66f4...", "dealName": "Acme Enterprise Plan", "lead": "66f2...", "customer": "66f3...",
                  "value": 50000, "probability": 20, "expectedRevenue": 10000, "stage": "Qualification", "status": "Open" }
  }
}
```
Converting again → `409 { "success": false, "message": "Lead has already been converted" }`

**Invalid stage change** – `PATCH /deals/:id/stage` `{ "stage": "Won" }` on a deal in Qualification
```json
{ "success": false, "message": "Cannot move a deal from Qualification to Won. Allowed: Discovery, Lost" }
```

**Sales pipeline** – `GET /dashboard/pipeline`
```json
{
  "success": true,
  "message": "Sales pipeline fetched successfully",
  "data": [
    { "stage": "Qualification", "count": 10, "totalValue": 250000, "expectedRevenue": 25000 },
    { "stage": "Discovery",     "count": 8,  "totalValue": 180000, "expectedRevenue": 45000 },
    { "stage": "Proposal",      "count": 6,  "totalValue": 150000, "expectedRevenue": 75000 },
    { "stage": "Negotiation",   "count": 4,  "totalValue": 120000, "expectedRevenue": 90000 },
    { "stage": "Won",           "count": 12, "totalValue": 400000, "expectedRevenue": 400000 },
    { "stage": "Lost",          "count": 5,  "totalValue": 60000,  "expectedRevenue": 0 }
  ]
}
```

**Sales stats** – `GET /dashboard/stats`
```json
{
  "success": true,
  "message": "Sales statistics fetched successfully",
  "data": {
    "leads": { "total": 120, "new": 30, "qualified": 22, "converted": 18 },
    "customers": { "total": 18 },
    "deals": { "total": 45, "open": 28, "won": 12, "lost": 5 },
    "revenue": { "total": 400000, "expected": 235000 },
    "conversionRate": 15,
    "activities": { "pending": 14, "overdue": 3 }
  }
}
```

---

## 7. Important business rules

**Leads**
- Status flow is a state machine: `New → Contacted → Qualified`; `Unqualified` / `Lost` branches; `Lost → New` to reopen. Invalid jumps → 400 listing the allowed next statuses.
- `Converted` can **only** be reached through `/convert`, never through the status endpoint.
- Converted leads are read-only (no edit, status change, reassignment or delete).
- Only **active sales executives** can be assigned; managers can only assign inside their team.

**Lead conversion** (`POST /leads/:id/convert`)
- Allowed only for leads that are `Qualified`, assigned, and not already converted.
- Customer + Deal + lead update + 3 timeline entries are written in **one MongoDB transaction** – all or nothing.
- A conditional update (`isConverted: false, status: 'Qualified'`) plus a unique sparse index on `Customer.lead` protect against two people converting the same lead at the same time.
- Result chain: `Lead → Customer (customer.lead)` and `Deal (deal.lead + deal.customer)`.

**Deals**
- `value > 0`, `probability` 0–100 (validated by Zod **and** the Mongoose schema).
- `expectedRevenue = value × probability / 100` is **always calculated by the server** (schema hook) – a client value is ignored. `status` (Open/Won/Lost) is derived from `stage` the same way.
- Expected closing date cannot be in the past (on create / when changed) or more than 5 years ahead.
- Stage flow: `Qualification → Discovery → Proposal → Negotiation → Won`; open stages can step back one stage; any open stage → `Lost`.
- `Won` and `Lost` are **final** – a closed deal can't change stage, be edited or be reassigned.
- `Won` is only possible from `Negotiation` (probability forced to 100). `Lost` **requires** a reason (probability forced to 0).
- If the client doesn't send a probability when moving stages, a default per stage is used (10 / 25 / 50 / 75).

**Customers** – unique email; a customer created from a lead conversion can't be deleted (set it `Inactive`), and customers with deals can't be deleted.

**Activities**
- Types: Call, Email, Meeting, Demo, Follow-up, Reminder, Note. Related to a Lead, Customer, Deal or User; the related record must exist **and** be accessible to the caller.
- Stored status is only `Pending` / `Completed`. **Overdue is calculated** by the backend (`Pending` + `dueDate` in the past), both in responses and in the `status=Overdue` filter and dashboard counts – no cron job needed.
- Notes need no due date and are saved as completed. Due dates cannot be in the past. Completed activities can't be edited.

**Timeline / audit log** – append-only collection written by the services for: lead created / updated / assigned / reassigned / status changed / priority changed / converted / deleted, note added, follow-up created / completed, customer created / updated / assigned, deal created / updated / stage changed / assigned / won / lost. Each entry stores action, entity type + id, performer, previous value, new value and timestamp. Retrieve it with `GET /leads|customers|deals/:id/timeline`.

**Users** – can't deactivate / delete / change the role of yourself; a user who owns CRM records can't be deleted (deactivate instead); demoting a manager detaches their team.

---

## 8. Database design

Six collections with references (ObjectIds). Timeline entries and activities are separate collections because they grow without limit and are queried per entity, so embedding them would bloat the parent documents.

```
User ──┬─< Lead.assignedTo / createdBy         User.manager ──> User (executive → manager)
       ├─< Customer.assignedTo
       ├─< Deal.assignedTo
       └─< Activity.assignedTo / createdBy

Lead ──> Customer  (lead.customer, customer.lead)       Lead ──> Deal (lead.deal, deal.lead)
Customer ─< Deal   (deal.customer)
Activity ──> Lead | Customer | Deal | User   (relatedModel + relatedTo, Mongoose refPath)
Timeline ──> Lead | Customer | Deal          (entityType + entityId)
```

Small value objects (the customer `address`) are **embedded**; everything with its own lifecycle is **referenced**.

### Indexes

| Collection | Index | Why |
|---|---|---|
| User | `email` (unique) | login, duplicate check |
| User | `{role, isActive}`, `{manager}`, `{name}` | user filters, team lookup |
| Lead | `{assignedTo, status}` | an executive's "my leads" + status filter (most common query) |
| Lead | `{status}`, `{source}`, `{priority}`, `{email}`, `{createdAt:-1}` | list filters, default sort |
| Customer | `email` (unique) | duplicate check |
| Customer | `{lead}` (unique, sparse) | one customer per lead – DB-level guard against double conversion |
| Customer | `{assignedTo, status}`, `{createdAt:-1}` | scoped lists |
| Deal | `{assignedTo, stage}`, `{stage}` | scoped lists, pipeline |
| Deal | `{customer}`, `{lead}`, `{expectedClosingDate}`, `{value}`, `{createdAt:-1}` | relations, range filters |
| Activity | `{assignedTo, status, dueDate}` | pending / overdue queries |
| Activity | `{relatedModel, relatedTo}`, `{dueDate}`, `{createdAt:-1}` | activities of an entity |
| Timeline | `{entityType, entityId, createdAt:-1}` | timeline of a lead / customer / deal |

Query efficiency: list endpoints run `find` + `countDocuments` in parallel, use `.lean()` where no model transform is needed, populate only `name`/`email`, and never return unpaginated data. The dashboard uses `$group` aggregations (one query per metric group, run in parallel) instead of loading documents.

---

## 9. Security

- bcrypt password hashing; JWT access/refresh with refresh rotation; httpOnly + `secure` (production) + `SameSite` cookies
- `helmet` security headers; CORS allow-list (`CLIENT_ORIGINS`) with credentials
- Rate limiting: general (100 / 15 min) and stricter on login / register / refresh (20 / 15 min)
- Zod validation on params, query and body of every route; unknown body fields are stripped (no mass assignment – e.g. a client can't set `role`, `status`, `expectedRevenue`); query values are parsed to strict types, so operator-injection payloads like `?status[$ne]=x` are rejected
- Search input is regex-escaped; sort fields are whitelisted; JSON body limited to 10 kb
- Centralised error handler: no stack traces or DB details in production; logs never include request bodies, passwords or tokens
- Ownership checks on every record (see section 5)

## 10. Assumptions

1. Team structure is modelled with `User.manager`; "team" = executives whose `manager` is that manager. Managers also see unassigned leads so they can assign them.
2. Leads can only be assigned to sales executives (not to managers/admins).
3. Public registration only creates executives; the first admin comes from `npm run seed`.
4. Customers and deals created by an admin/manager default to that user as owner unless an executive is given. A deal created for a customer defaults to the customer's owner. Reassigning a deal doesn't move its customer.
5. Overdue is derived at read time rather than stored, so it is always accurate.
6. Deal "reopen" is intentionally impossible – a closed deal is final.
7. A lead whose email already belongs to an existing customer can't be converted (customer email is unique) – the API returns 409.
8. Lists use case-insensitive regex search (fine for the expected data size); a MongoDB text index or Atlas Search would be the next step for large collections.
9. `priority` sorts alphabetically (High, Low, Medium) since it is stored as a string.
10. Dates in filters are inclusive of the whole "to" day (UTC).

## 11. Deployment (Render + MongoDB Atlas)

1. Create a free Atlas cluster, add a DB user, allow the Render IP (or `0.0.0.0/0` for the assignment), copy the connection string.
2. Push the repo to GitHub → Render → **New Web Service** → build `npm install`, start `npm start`.
3. Add the environment variables from `.env.example` (`NODE_ENV=production`, `MONGO_URI`, both JWT secrets, `CLIENT_ORIGINS`, and `COOKIE_SAME_SITE=none` only if a frontend on another domain must use cookies; otherwise keep `strict` and use the Bearer token).
4. Run the seed once from your machine with the production `MONGO_URI` (`npm run seed`) – it also builds the indexes.
5. Put the URL at the top of this README and set Postman's `baseUrl` to `https://crm-sales-management-d8ou.onrender.com/api/v1`.


