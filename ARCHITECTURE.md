# Luciteria Collector Cabinet — Architecture Document

## System Overview

The Collector Cabinet is a Shopify embedded app that provides:
1. A customer-facing "digital cabinet" for tracking element collections
2. An interactive periodic table showing all 118 elements with collection status
3. A subscription management system with intelligent, duplicate-free assignments
4. Collection type selection (10mm, 25.4mm, 50mm, Lucite, Ampoules)
5. A billing system with dual billing model and grandfathering
6. An admin operations dashboard with discount monitoring and sequence preview
7. Email/webhook notification stubs for 8 event types

## Technology Stack

```
┌─────────────────────────────────────────────────────┐
│                   Shopify Admin                      │
│              (Embedded App Frame)                     │
│  ┌───────────────────────────────────────────────┐  │
│  │            Shopify App Bridge                  │  │
│  │     (Auth, Navigation, Toast, Modal)           │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │           Remix Application                    │  │
│  │  ┌──────────┐  ┌──────────┐  ┌────────────┐  │  │
│  │  │ Customer │  │  Admin   │  │ Assignment │  │  │
│  │  │  Routes  │  │  Routes  │  │   Engine   │  │  │
│  │  └──────────┘  └──────────┘  └────────────┘  │  │
│  │  ┌───────────┐  ┌───────────┐  ┌──────────┐  │  │
│  │  │ Billing   │  │ Notif.   │  │ Periodic │  │  │
│  │  │ System    │  │ System   │  │  Table   │  │  │
│  │  └───────────┘  └───────────┘  └──────────┘  │  │
│  │  ┌──────────────────────────────────────────┐ │  │
│  │  │    Shopify Polaris + Light Theme UI      │ │  │
│  │  └──────────────────────────────────────────┘ │  │
│  │  ┌──────────────────────────────────────────┐ │  │
│  │  │    Data Access Layer (Prisma ORM)        │ │  │
│  │  │    ┌──────────────────────────────┐      │ │  │
│  │  │    │ SQLite (proto) / PostgreSQL  │      │ │  │
│  │  │    └──────────────────────────────┘      │ │  │
│  │  └──────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

## Sitemap

### Customer-Facing Pages
```
/app/cabinet                    → Dashboard (periodic table, collection summary, recent shipments)
/app/cabinet/collection         → Collection grid filtered by collection type
/app/cabinet/missing            → Missing items with collection type awareness
/app/cabinet/wishlist           → Wishlist management
/app/cabinet/subscription       → Subscription plan, billing schedule, shipment history
/app/cabinet/preferences        → Assignment preferences & notification settings
/app/cabinet/onboarding         → Collection type selection (new subscribers)
```

### Admin Pages
```
/app/admin/operations           → Operations dashboard (discount monitoring, sequence preview)
/app/admin/customers            → Customer list with collection type badges
/app/admin/customer/:id         → Individual customer profile with periodic table
```

## Data Model

### Entity Relationship Diagram (Phase 2)

```
┌──────────────────┐     ┌──────────────────┐     ┌────────────────────┐
│   Customer       │     │     Product      │     │  Subscription      │
├──────────────────┤     ├──────────────────┤     ├────────────────────┤
│ id               │──┐  │ id               │  ┌──│ id                 │
│ shopifyId        │  │  │ shopifyProductId │  │  │ customerId         │──┐
│ email            │  │  │ shopifyVariantId │  │  │ planName           │  │
│ firstName        │  │  │ handle           │  │  │ planTier           │  │
│ lastName         │  │  │ title            │  │  │ status             │  │
│ displayName      │  │  │ sku              │  │  │ billingCadence     │  │
│ collectionType   │◄─┼──│ elementSymbol    │  │  │ priceUsd           │  │
│ signupDate       │  │  │ elementName      │  │  │ subscriptionCost   │  │
│ grandPriceAtLock │  │  │ atomicNumber     │  │  │ nextShipment       │  │
│ grandLockedAt    │  │  │ collectionType   │◄─┤  │ nextBillingDate    │  │
│ grandPauseBank   │  │  │ category         │  │  │ billingDayOfMonth  │  │
│ grandPauseStart  │  │  │ format           │  │  │ signupBillingDay   │  │
└──────────────────┘  │  │ inventoryQty     │  │  │ itemsPerShipment   │  │
                      │  │ priceUsd         │  │  │ grandActive        │  │
                      │  │ retailPrice      │  │  │ grandPriceAtLock   │  │
                      │  │ subscriptionCost │  │  └────────────────────┘  │
                      │  │ rarityTier       │  │                          │
                      │  └──────────────────┘  │                          │
                      │           │            │                          │
        ┌─────────────┴───────────┤            │                          │
        │         │           │   │            │                          │
        ▼         ▼           ▼   │            ▼                          │
┌──────────────┐ ┌────────────┐ │ ┌────────────────────────┐             │
│ Collection   │ │  Wishlist  │ │ │ SubscriptionShipment   │             │
│   Record     │ │   Item     │ │ ├────────────────────────┤             │
├──────────────┤ ├────────────┤ │ │ id                     │             │
│ customerId   │ │ customerId │ │ │ subscriptionId ────────┘             │
│ productId    │ │ productId  │ │ │ customerId ─────────────────────────┘
│ acquiredVia  │ │ priority   │ │ │ shipmentDate           │
│ acquiredDate │ │ notifyRstk │ │ │ status                 │
└──────────────┘ └────────────┘ │ │ trackingNumber         │
                                │ │ assignedBy             │
                                │ │ discountPercent (new)  │
                                │ │ retailPrice (new)      │
                                │ │ subscriptionCost (new) │
                                │ └──────────┬─────────────┘
                                │            │
                                │            ▼
                                │    ┌───────────────┐
                                │    │  ShipmentItem │
                                │    ├───────────────┤
                                │    │ shipmentId    │
                                │    │ productId     │
                                │    └───────────────┘
                                │
    ┌───────────────────────────┤
    │                           │
    ▼                           ▼
┌─────────────────────┐  ┌──────────────────────┐
│ CollectionTypeChange │  │ NotificationLog     │
│ (new Phase 2)       │  │ (new Phase 2)       │
├─────────────────────┤  ├──────────────────────┤
│ id                  │  │ id                   │
│ customerId          │  │ customerId           │
│ fromType            │  │ type                 │
│ toType              │  │ channel              │
│ changedAt           │  │ payload              │
│ reason              │  │ sentAt               │
└─────────────────────┘  └──────────────────────┘

┌───────────────────┐  ┌───────────────────────┐  ┌──────────────┐
│ CustomerPreference│  │ AssignmentException   │  │  AdminNote   │
├───────────────────┤  ├───────────────────────┤  ├──────────────┤
│ customerId        │  │ customerId            │  │ customerId   │
│ duplicateHandling │  │ reason                │  │ authorName   │
│ preferredCats     │  │ details               │  │ content      │
│ excludedCats      │  │ status                │  │ createdAt    │
│ preferredFormats  │  │ resolvedBy            │  └──────────────┘
│ budgetMaxUsd      │  │ resolution            │
│ notifPrefs (new)  │  └───────────────────────┘
└───────────────────┘

┌──────────────────┐
│ PricingHistory   │
│ (new Phase 2)    │
├──────────────────┤
│ id               │
│ productId        │
│ retailPrice      │
│ subscriptionCost │
│ effectiveDate    │
│ changedBy        │
└──────────────────┘
```

### New Phase 2 Fields

| Entity | New Field | Purpose |
|---|---|---|
| Customer | `collectionType` | Selected collection format (10mm/25.4mm/50mm/lucite/ampoules) |
| Customer | `signupDate`, `grandPriceAtLock`, etc. | Grandfathering tracking |
| Product | `collectionType` | Which collection format this product belongs to |
| Product | `retailPrice`, `subscriptionCost` | Dual pricing for discount calculations |
| Subscription | `nextBillingDate`, `billingDayOfMonth` | Billing schedule fields |
| Subscription | `grandActive`, `grandPriceAtLock` | Grandfathered pricing |
| SubscriptionShipment | `discountPercent`, `retailPrice`, `subscriptionCost` | Discount tracking per shipment |

### New Phase 2 Models

| Model | Purpose |
|---|---|
| `CollectionTypeChange` | Audit log when customer changes collection type |
| `PricingHistory` | Track price changes over time |
| `NotificationLog` | Log all notification dispatches |

## Billing System Architecture

### Dual Billing Model
```
Customer subscribes → Two billing events:
1. Signup Day Billing: Charged on the same day-of-month they signed up
2. 1st-of-Month Billing: Charged on the 1st for the upcoming month's element

5-Day Edge Case:
  If signup is within 5 days of month end (e.g., Jan 28):
  → First element ships immediately
  → Next billing starts Feb 1 (not Feb 28)
  → Avoids double-charge within days
```

### Grandfathering Clock
```
Customer pauses subscription:
  → Pause start date recorded
  → Grandfathering clock pauses (pause bank accumulates)

Customer resumes:
  → Pause bank = days paused
  → Grandfathering expiry extended by pause bank days
  → Price stays locked at grandPriceAtLock
```

## Notification System Architecture

### Event Types
```
1. assignment_preview    — "Here's what's shipping next"
2. shipment_confirmed    — "Your element has shipped"
3. restock_alert         — "Wishlist item back in stock"
4. discount_alert        — "Admin: discount > 20% detected"
5. billing_reminder      — "Billing in 3 days"
6. collection_milestone  — "You've reached 50 elements!"
7. pause_confirmation    — "Subscription paused"
8. welcome               — "Welcome to the Collector Cabinet"
```

### Implementation (Prototype)
All notifications are stubs that:
- Log to console with full payload
- Store in NotificationLog table (when using Prisma)
- Return success response for UI integration

Production would replace stubs with SendGrid/Postmark email and Shopify webhooks.

## Component Architecture

### Shared Components
- `AppNav` — Sidebar navigation (customer/admin modes) with collection type badge
- `PeriodicTable` — Interactive 118-element periodic table (standard layout, click details, compact mode)
- `StatCard` — Summary metric card (light theme)
- `ProductCard` — Element display card with status badges and discount info
- `ProgressBar` — Collection completion indicator

### Data Flow
```
Route Loader → Mock DB / Prisma → JSON → React Component → Polaris UI
                    ↓                          ↓
            Assignment Engine           Periodic Table
            Billing Calculator          Collection Type Filter
            Notification Dispatcher     Discount Calculator
```

### Theme
- **Phase 1**: Dark theme (cabinet metaphor)
- **Phase 2**: White/light theme (Luciteria branding)
  - `--luc-bg: #f5f7fa` (page background)
  - `--luc-surface: #ffffff` (card surfaces)
  - `--luc-accent: #4A90E2` (primary blue)
  - `--luc-text: #1a1a2e` (dark text on light)
  - Mobile responsive sidebar (collapsible at 768px)
