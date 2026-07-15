# Shopify Integration Guide — Luciteria Collector Cabinet

## Overview

The Luciteria Collector Cabinet is a Shopify Remix app that manages element collection subscriptions. This guide documents every integration point a developer needs to connect the prototype to the live Shopify store.

**Current State:** Prototype uses mock data + real SKU mapping CSV.
**Target State:** Full Shopify API integration with PostgreSQL database.

---

## Quick Start for Developers

1. Copy `.env.example` to `.env`
2. Set `APP_MODE=production`
3. Fill in all `SHOPIFY_*` credentials
4. Switch Prisma to PostgreSQL (see Database section)
5. Run `npx prisma migrate deploy`
6. Follow the integration checklist in `DEVELOPER_INTEGRATION_CHECKLIST.md`

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Remix App (Routes)                     │
│  /app/routes/app.cabinet.*    /app/routes/app.admin.*    │
├─────────────────────────────────────────────────────────┤
│                   Data Access Layer                       │
│  /app/data/mock-db.server.js (prototype)                │
│  /app/lib/data-access.server.js (production/Prisma)     │
├─────────────────────────────────────────────────────────┤
│              Shopify Integration Layer                    │
│  /app/integrations/shopify/                              │
│    shopify-client.server.js    (API client)              │
│    shopify-products.server.js  (Product sync)            │
│    shopify-customers.server.js (Customer sync)           │
│    shopify-subscriptions.server.js (Contracts)           │
│    shopify-orders.server.js    (Order management)        │
│    shopify-metafields.server.js (Custom data)            │
│    shopify-webhooks.server.js  (Event handling)          │
├─────────────────────────────────────────────────────────┤
│                  Business Logic                           │
│  /app/lib/assignment-engine.server.js                    │
│  /app/lib/billing.server.js                              │
│  /app/lib/notifications.server.js                        │
├─────────────────────────────────────────────────────────┤
│                    Database                               │
│  Prisma ORM → PostgreSQL                                 │
│  /prisma/schema.prisma                                   │
└─────────────────────────────────────────────────────────┘
```

---

## Required OAuth Scopes

```
read_products, write_products
read_customers, write_customers
read_orders, write_orders
read_draft_orders, write_draft_orders
read_inventory, write_inventory
read_own_subscription_contracts, write_own_subscription_contracts
```

---

## API Endpoints Needed

### Products
| Operation | Endpoint | Method |
|-----------|----------|--------|
| List products | `/admin/api/2024-10/products.json` | GET |
| Get product | `/admin/api/2024-10/products/{id}.json` | GET |
| Get variants | `/admin/api/2024-10/products/{id}/variants.json` | GET |
| Get inventory | `/admin/api/2024-10/inventory_levels.json` | GET |
| Adjust inventory | `/admin/api/2024-10/inventory_levels/adjust.json` | POST |

### Customers
| Operation | Endpoint | Method |
|-----------|----------|--------|
| List customers | `/admin/api/2024-10/customers.json` | GET |
| Search customers | `/admin/api/2024-10/customers/search.json` | GET |
| Get customer | `/admin/api/2024-10/customers/{id}.json` | GET |
| Get metafields | `/admin/api/2024-10/customers/{id}/metafields.json` | GET |
| Set metafield | `/admin/api/2024-10/customers/{id}/metafields.json` | POST |

### Orders
| Operation | Endpoint | Method |
|-----------|----------|--------|
| Create draft order | `/admin/api/2024-10/draft_orders.json` | POST |
| Complete draft | `/admin/api/2024-10/draft_orders/{id}/complete.json` | PUT |
| Add fulfillment | `/admin/api/2024-10/orders/{id}/fulfillments.json` | POST |
| List orders | `/admin/api/2024-10/orders.json` | GET |

### Subscriptions (GraphQL only)
| Operation | Mutation/Query |
|-----------|---------------|
| Create contract | `subscriptionDraftCreate` → `subscriptionDraftCommit` |
| Update contract | `subscriptionContractUpdate` |
| Get contract | `subscriptionContract(id:)` |
| Billing attempt | `subscriptionContractAttemptBilling` |

---

## Webhook Configuration

### Required Webhook Topics

| Topic | Handler | Purpose |
|-------|---------|---------|
| `products/update` | Update local product data | Price, status, tag changes |
| `products/delete` | Archive product locally | Remove from subscription pool |
| `inventory_levels/update` | Update stock levels | Trigger OOS shifting if needed |
| `customers/create` | Create local customer | Onboarding flow trigger |
| `customers/update` | Sync customer data | Email, name changes |
| `customers/delete` | Archive customer | Cancel subscription, cleanup |
| `orders/create` | Track subscription order | Link order to shipment |
| `orders/paid` | Confirm payment | Trigger fulfillment |
| `orders/fulfilled` | Update tracking | Notify customer, update collection |
| `subscription_contracts/create` | New subscription | Run initial assignment |
| `subscription_contracts/update` | Status changes | Handle pause/cancel |
| `app/uninstalled` | Cleanup | Remove sessions, mark inactive |

### Webhook Validation
All webhooks must be HMAC-SHA256 validated using `SHOPIFY_WEBHOOK_SECRET`.
See `shopify-webhooks.server.js` for implementation pattern.

---

## Metafield Structure

### Customer Metafields (namespace: `luciteria_collection`)

| Key | Type | Example | Purpose |
|-----|------|---------|---------|
| `collection_type` | `single_line_text_field` | `"lucite"` | Active collection type |
| `owned_elements` | `json` | `["Sr","Na","Ce"]` | Element symbols owned |
| `wishlist_skus` | `json` | `["Sr2x2","Na2x2"]` | Wishlisted product SKUs |
| `preferences` | `json` | `{duplicateHandling:"never"}` | Assignment preferences |
| `display_name` | `single_line_text_field` | `"The Completionist"` | Custom display name |
| `onboarded_at` | `single_line_text_field` | `"2025-01-15T00:00:00Z"` | When they selected type |
| `grandfather_locked` | `single_line_text_field` | ISO date | Price lock date |
| `grandfather_expires` | `single_line_text_field` | ISO date | Price lock expiry |

### Product Metafields (namespace: `luciteria_collection`)

| Key | Type | Example | Purpose |
|-----|------|---------|---------|
| `element_symbol` | `single_line_text_field` | `"Sr"` | Chemical symbol |
| `atomic_number` | `number_integer` | `38` | Atomic number |
| `subscription_cost` | `number_decimal` | `42.00` | Cost basis |
| `subscription_eligible` | `boolean` | `true` | Can be sent via sub |
| `rarity_tier` | `single_line_text_field` | `"uncommon"` | Rarity classification |

---

## Data Sync Strategy

### Initial Sync (App Installation)
1. Fetch all products from Shopify → populate Product table
2. Fetch all customers with subscriber tag → populate Customer table
3. Load metafields for each customer → populate collection/preference data
4. Register all webhooks

### Ongoing Sync
- **Webhooks** handle real-time updates (products, inventory, orders)
- **Polling** job runs every 15 minutes as a safety net
- **Manual sync** button in admin dashboard for force-refresh

### Conflict Resolution
- Shopify is the source of truth for: price, inventory, customer email
- Cabinet is the source of truth for: collection type, owned elements, preferences
- Write collection data back to Shopify via metafields

---

## Error Handling

### API Rate Limits
- Shopify REST: 40 requests per app per store per minute (bucket with leak)
- Shopify GraphQL: 1000 cost points per second
- Use exponential backoff with `withRetry()` from `error-handling.server.js`

### Graceful Degradation
- If Shopify API is down, use cached local data
- Assignment engine operates on local database, not live API
- Log all API failures to `WebhookEventLog`

---

## SKU Mapping

The real product catalog is loaded from `data/sku-mapping-master.csv`.
This file was generated from the Shopify Products export.

### Collection Type Mapping
| CSV Collection Type | App Type | Description |
|-------------------|----------|-------------|
| Lucite 50mm | `lucite` | 50mm acrylic cubes with embedded samples |
| 10mm Cube | `10mm` | 10mm solid metal cubes |
| 25.4mm Cube | `25.4mm` | 1-inch solid metal cubes |
| 50mm Cube | `50mm` | 50mm solid metal cubes |
| Ampoule | `ampoules` | Sealed glass ampoules |

### SKU Naming Convention
- `{Symbol}{Format}` — e.g. `Sr2x2` (Strontium 50mm), `Fe10.1mm` (Iron 10mm)
- `_film` suffix = film/representation (synthetic elements)
- `_amp` suffix = ampoule format
- `_mp` suffix = mirror polish variant

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `app/config/environment.server.js` | Environment config + feature flags |
| `app/config/constants.server.js` | Business rule constants |
| `app/data/mock-db.server.js` | Prototype data layer (replace in prod) |
| `app/data/product-catalog.server.js` | Real SKU catalog loader |
| `app/data/elements.server.js` | 118-element periodic table data |
| `app/lib/assignment-engine.server.js` | Core assignment logic |
| `app/lib/billing.server.js` | Billing calculations |
| `app/lib/error-handling.server.js` | Error classes + logging |
| `app/lib/data-access.server.js` | Prisma queries (production) |
| `app/integrations/shopify/*.server.js` | Shopify API stubs |
| `prisma/schema.prisma` | Database schema |

---

## Testing

### Prototype Mode Testing
```bash
APP_MODE=prototype npx remix vite:dev --port 3000
```
All routes work with mock data + real SKU catalog.

### Production Mode Testing
1. Set up a Shopify development store
2. Install the app via OAuth
3. Run initial data sync
4. Verify all routes work with real API data
5. Test webhook handling with Shopify CLI
