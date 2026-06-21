# Shopify Listing Agent

AI agent (ASI:One + Agentverse) that **auto-posts real products to Shopify** via the Admin GraphQL API.

## Is Shopify free?

| Use case | Cost |
|----------|------|
| **Hackathon / dev testing** | **Free** — create unlimited [Partner dev stores](https://shopify.dev/docs/api/development-stores) |
| **Live store for real sales** | **Paid** — from ~$29–39/mo (Basic plan). No permanent free plan. |
| **Listing products** | **Unlimited products** on all paid plans — no per-listing fee |
| **Transaction fees** | ~2.9% + $0.30 per online sale (lower on higher plans) |

**For your demo:** use a free Shopify Partners dev store. Products you create via the API are real and visible in Shopify Admin + your storefront.

## Architecture

```
User → ASI:One Chat → Agentverse Agent (agent/agent.py)
                              ↓
                    Next.js API (/api/listings)
                              ↓
                    Shopify Admin GraphQL API (productCreate)
                              ↓
                    Live product on your Shopify store
```

## Quick start

### 1. Create a free Shopify dev store

1. Sign up at [partners.shopify.com](https://partners.shopify.com)
2. **Dev stores** → **Add dev store** → create store (free, unlimited)
3. Note your store URL: `your-store.myshopify.com`

### 2. Create a custom app & get API token

1. In Shopify Admin → **Settings** → **Apps and sales channels** → **Develop apps**
2. **Create an app** → configure **Admin API scopes**:
   - `write_products`
   - `read_products`
3. **Install app** → copy the **Admin API access token** (`shpat_...`)

### 3. Configure `.env.local`

```bash
cp .env.example .env.local
```

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
LISTINGS_API_SECRET=your-secret-here
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_xxxxxxxx
SHOPIFY_API_VERSION=2025-01
```

### 4. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and try: *"Sell my desk for $80"* → confirm with *"yes"*.

The product will appear in **Shopify Admin → Products** and on your storefront.

## Deploy Agentverse agent

1. Paste `agent/agent.py` into Agentverse **Build** tab
2. Paste `agent/AGENTVERSE_README.md` into **README** tab
3. Add secrets: `ASI_API_KEY`, `MARKETPLACE_API_URL`, `LISTINGS_API_SECRET`
4. Deploy Next.js (Vercel) with the same Shopify env vars on the server

## API

### `POST /api/listings`

Creates a product on Shopify. Requires:

```
Authorization: Bearer <LISTINGS_API_SECRET>
```

```json
{
  "title": "Road Bike",
  "description": "Lightweight frame, great condition",
  "price": 450,
  "category": "Sports"
}
```

Response:

```json
{
  "shopifyUrl": "https://your-store.myshopify.com/products/road-bike",
  "shopifyAdminUrl": "https://your-store.myshopify.com/admin/products/123",
  "publishedToShopify": true
}
```

## Docs

- [Shopify dev stores (free)](https://shopify.dev/docs/api/development-stores)
- [productCreate mutation](https://shopify.dev/docs/api/admin-graphql/latest/mutations/productCreate)
- [ASI:One compatible agent](https://agentverse.ai/docs/uAgents/asimini-agent)
