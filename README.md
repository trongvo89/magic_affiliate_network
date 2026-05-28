# Magic Affiliate Network

Mobile app affiliate network platform. Connects publishers (traffic sources) with app advertisers via AppsFlyer and Adjust MMP postbacks.

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Fastify + TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Deploy**: Railway

## Local Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### 1. Clone & Install

```bash
git clone <repo>
cd magic_affiliate_network

# Install API deps
cd api && npm install

# Install Web deps
cd ../web && npm install
```

### 2. Configure Environment

```bash
# API
cp api/.env.example api/.env
# Edit api/.env — set DATABASE_URL and JWT_SECRET

# Web
cp web/.env.example web/.env.local
# Edit web/.env.local — set NEXT_PUBLIC_API_URL=http://localhost:4000
```

### 3. Database Setup

```bash
cd api
npx prisma migrate dev --name init
npx prisma generate
npm run db:seed
```

### 4. Run Dev Servers

```bash
# Terminal 1 — API (port 4000)
cd api && npm run dev

# Terminal 2 — Web (port 3000)
cd web && npm run dev
```

Open http://localhost:3000

**Demo accounts:**
- Admin: `admin@test.com` / `Admin123!`
- Publisher: `pub1@test.com` / `Pub123!`

---

## MMP Integration

### AppsFlyer Postback URL

Configure in your AppsFlyer dashboard under **Partner Postbacks → Custom**:

```
https://YOUR_API_DOMAIN/postback/appsflyer?af_tranid={af_tranid}&app_id={app_id}&event_name={event_name}&event_revenue={event_revenue}&event_revenue_currency={event_revenue_currency}&af_sub1=PUBLISHER_ID
```

Replace `PUBLISHER_ID` with the publisher's system ID (shown in admin panel).

**Required parameters from AppsFlyer:**
| Macro | Description |
|-------|-------------|
| `{af_tranid}` | Unique transaction ID (dedup key) |
| `{app_id}` | App identifier — must match Offer's App ID field |
| `{event_name}` | Event name: `install`, `purchase`, etc. |
| `{event_revenue}` | Revenue amount |
| `{event_revenue_currency}` | Revenue currency |
| `af_sub1` | Publisher ID (set manually per publisher) |

### Adjust Postback URL

Configure in Adjust dashboard under **Partner Setup → Custom**:

```
https://YOUR_API_DOMAIN/postback/adjust?transaction_id={transaction_id}&app_token={app_token}&event_token={event_token}&revenue={revenue}&currency={currency}&created_at={created_at}&partner_parameter_1=PUBLISHER_ID
```

**Required parameters from Adjust:**
| Macro | Description |
|-------|-------------|
| `{transaction_id}` | Unique transaction ID (dedup key) |
| `{app_token}` | App token — must match Offer's App ID field |
| `{event_token}` | Event token identifier |
| `{revenue}` | Revenue amount |
| `{currency}` | Revenue currency |
| `{created_at}` | Event timestamp |
| `partner_parameter_1` | Publisher ID (set manually per publisher) |

### Testing Postbacks

```bash
# AppsFlyer install
curl "http://localhost:4000/postback/appsflyer?af_tranid=test123&app_id=com.shopee.vn&event_name=install&event_revenue=0&af_sub1=PUBLISHER_ID"

# Adjust purchase
curl "http://localhost:4000/postback/adjust?transaction_id=adj456&app_token=com.gojek.app&event_token=purchase&revenue=25.00&currency=USD&partner_parameter_1=PUBLISHER_ID"
```

---

## Railway Deployment

### API Service

1. Create new Railway project
2. Add service → GitHub repo → set root directory to `api/`
3. Add PostgreSQL database service
4. Set environment variables:
   ```
   DATABASE_URL=<from Railway PostgreSQL>
   JWT_SECRET=<generate: openssl rand -hex 32>
   PORT=4000
   HOST=0.0.0.0
   CORS_ORIGIN=https://your-web-domain.railway.app
   NODE_ENV=production
   ```
5. Deploy — Railway runs `npx prisma migrate deploy && node dist/index.js`

### Web Service

1. Add service → GitHub repo → set root directory to `web/`
2. Set environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://your-api-domain.railway.app
   ```
3. Deploy

### Run Seed Data (one-time)

In Railway API service shell:
```bash
npx ts-node prisma/seed.ts
```

---

## Architecture

```
Publisher Traffic
       ↓
  MMP (AppsFlyer/Adjust)
       ↓ HTTP postback
  /postback/:source (Fastify)
       ↓
  Dedup check → Store conversion → Calculate commission
       ↓
  Outbound postback → Publisher tracker
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET/POST | `/postback/:source` | None | MMP postback receiver |
| POST | `/auth/login` | None | Login |
| POST | `/auth/register` | None | Publisher registration |
| GET | `/admin/stats` | Admin | Dashboard stats |
| GET | `/admin/conversions` | Admin | All conversions |
| GET/POST | `/admin/offers` | Admin | Offer management |
| PUT | `/admin/offers/:id` | Admin | Edit offer |
| GET | `/admin/publishers` | Admin | Publisher list |
| PUT | `/admin/publishers/:id` | Admin | Approve/suspend |
| GET | `/publisher/stats` | Publisher | My stats |
| GET | `/publisher/conversions` | Publisher | My conversions |
| GET/PUT | `/publisher/profile` | Publisher | Profile settings |
| GET | `/health` | None | Health check |
