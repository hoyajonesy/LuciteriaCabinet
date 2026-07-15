# Luciteria Collector Cabinet — Production Roadmap

## What the Prototype Proves

### Phase 1 (Complete ✅)
1. ✅ Collection tracking UX works for element collectors
2. ✅ Assignment engine logic prevents duplicates across 5 modes
3. ✅ Admin operations dashboard provides full visibility
4. ✅ Customer preference system is expressive yet simple
5. ✅ Edge cases (complete collection, empty collection, low stock) are handled
6. ✅ Brand voice integrates naturally into UI microcopy

### Phase 2 (Complete ✅)
7. ✅ Interactive periodic table (118 elements, standard layout, click-to-detail)
8. ✅ Collection type system (5 types, onboarding, per-customer tracking)
9. ✅ Enhanced assignment engine (collection type filtering, precious metal exclusion, discount tracking, sequence preview, OOS shifting)
10. ✅ Billing system (dual billing model, 5-day edge case, grandfathering with pause clock)
11. ✅ Discount monitoring (>20% admin alerts, per-shipment tracking)
12. ✅ White/light theme (Luciteria branding, mobile responsive)
13. ✅ Notification stubs (8 event types, console/DB logging)
14. ✅ Expanded data (35 products, 6 customers, all collection types)
15. ✅ Forward-compatible schema for multi-collection support

## What Needs to Change for Production

### Phase 3: Shopify Integration (2-3 weeks)

#### Authentication & App Bridge
- [ ] Register app in Shopify Partners dashboard
- [ ] Implement OAuth flow with `@shopify/shopify-app-remix`
- [ ] Configure App Bridge for embedded admin experience
- [ ] Set up session management and token storage

#### Shopify API Integration
- [ ] Replace mock product data with Shopify GraphQL Admin API
- [ ] Sync products via `products` query with metafields
- [ ] Map Shopify customers to internal Customer records
- [ ] Listen to order webhooks to auto-populate CollectionRecords
- [ ] Use Shopify's inventory API for real-time stock levels

#### Data Model Migration
- [ ] Move from SQLite to PostgreSQL (or Shopify's built-in storage)
- [ ] Add Shopify metafield mappings for element metadata
- [ ] Create product metafields: `elementSymbol`, `atomicNumber`, `rarityTier`, `collectionType`
- [ ] Customer metafields: `collectorProfile`, `subscriptionPreferences`, `collectionType`

### Phase 4: Subscription & Billing Production (2-3 weeks)

#### Shopify Subscriptions API
- [ ] Integrate with Shopify Subscription APIs (selling plans)
- [ ] Create subscription selling plans per collection type
- [ ] Handle subscription lifecycle events (create, pause, cancel, skip)
- [ ] Billing integration via Shopify Billing API
- [ ] Implement production dual billing model (replace stubs)
- [ ] Implement grandfathering with real payment provider

#### Assignment Automation
- [ ] Move assignment engine to a scheduled job (cron / Shopify Flow)
- [ ] Run assignments X days before billing date
- [ ] Auto-create draft orders for approved assignments
- [ ] Send assignment preview emails to customers
- [ ] Implement inter-subscriber conflict resolution for low-stock items

### Phase 5: Customer Experience (1-2 weeks)

#### Storefront Integration
- [ ] Build customer-facing pages using Shopify Customer Account Extensions
- [ ] Or: create a standalone portal accessible from customer account
- [ ] Add "My Collection" link to Shopify theme navigation
- [ ] Implement real add-to-cart for wishlist items
- [ ] Real-time inventory display

#### Notifications (Replace Stubs)
- [ ] Email templates (SendGrid/Postmark) for all 8 notification types
- [ ] SMS integration (optional, via preferences)
- [ ] Shopify Flow triggers for collection milestones
- [ ] Webhook integrations for external systems

#### Multi-Collection Support
- [ ] Allow customers to subscribe to multiple collection types simultaneously
- [ ] Separate billing/assignment per collection type
- [ ] Combined dashboard view across all collections
- [ ] Collection type switching with proper billing adjustments

### Phase 6: Admin & Operations Hardening (1-2 weeks)

#### Admin Hardening
- [ ] Role-based access control (replace session-based prototype auth)
- [ ] Audit log for all admin actions (assignments, overrides, notes)
- [ ] Bulk operations (assign multiple, skip multiple)
- [ ] Export reports (CSV of assignments, collection status, discount analysis)

#### Assignment Engine Production Features
- [ ] Multi-subscriber conflict detection (shared low-stock items)
- [ ] Machine learning recommendations (predictive preferences)
- [ ] A/B testing different assignment strategies per cohort
- [ ] Production discount alerting (email to admin, not just UI badge)

### Phase 7: Polish & Launch (1-2 weeks)

#### UI/UX
- [ ] Replace inline styles with proper CSS modules
- [ ] Add loading states, skeleton screens, error boundaries
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Product image integration from Shopify CDN
- [ ] Periodic table performance optimization for mobile

#### Performance
- [ ] Database query optimization and indexing
- [ ] Caching for product catalog and inventory
- [ ] Rate limiting for API calls
- [ ] Background job processing for assignments

#### Testing
- [ ] Unit tests for assignment engine (all strategies, all modes, all collection types)
- [ ] Integration tests for Shopify API interactions
- [ ] End-to-end tests for customer flows
- [ ] Load testing for assignment engine at scale
- [ ] Billing edge case regression tests

## Production Architecture

```
┌────────────────────────────────────────┐
│          Shopify App (Remix)           │
│   Hosted on: Railway / Fly.io / AWS   │
│                                        │
│  ┌──────────┐  ┌──────────────────┐   │
│  │   Admin   │  │    Customer     │   │
│  │   Pages   │  │    Account      │   │
│  └──────────┘  │    Extension     │   │
│                 └──────────────────┘   │
│  ┌──────────────────────────────────┐  │
│  │     Assignment Engine            │  │
│  │  (Scheduled Job / Shopify Flow)  │  │
│  │  + Collection Type Filtering     │  │
│  │  + Discount Monitoring           │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │     Billing Engine               │  │
│  │  (Dual billing, Grandfathering)  │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │     Notification Service         │  │
│  │  (SendGrid + Shopify Webhooks)   │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │    PostgreSQL Database           │  │
│  │    (Railway / Supabase / RDS)    │  │
│  └──────────────────────────────────┘  │
└────────────────┬───────────────────────┘
                 │
    ┌────────────┴────────────┐
    │  Shopify GraphQL API    │
    │  - Products             │
    │  - Customers            │
    │  - Orders               │
    │  - Inventory            │
    │  - Subscriptions        │
    │  - Webhooks             │
    └─────────────────────────┘
```

## Estimated Timeline

| Phase | Duration | Dependencies |
|---|---|---|
| Phase 1: Core Prototype | ✅ Complete | — |
| Phase 2: Enhanced Prototype | ✅ Complete | — |
| Phase 3: Shopify Integration | 2-3 weeks | Shopify Partners account, API keys |
| Phase 4: Subscription & Billing | 2-3 weeks | Phase 3 complete |
| Phase 5: Customer Experience | 1-2 weeks | Phase 3 complete |
| Phase 6: Admin Hardening | 1-2 weeks | Phase 4 complete |
| Phase 7: Polish & Launch | 1-2 weeks | All phases complete |
| **Total remaining** | **7-12 weeks** | |

## Cost Estimates

| Service | Monthly Cost |
|---|---|
| Hosting (Railway/Fly.io) | $20-50 |
| PostgreSQL (managed) | $15-30 |
| Shopify App (custom) | $0 (own store) |
| Email service (SendGrid/Postmark) | $0-20 |
| Monitoring (Sentry) | $0-26 |
| **Total** | **$35-126/mo** |
