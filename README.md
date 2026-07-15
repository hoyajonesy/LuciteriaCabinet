# Luciteria Collector Cabinet — Shopify App Prototype

A premium Shopify embedded app that transforms element collecting into a curated, subscription-driven experience. Built for internal review and concept validation.

## What This Is

The Collector Cabinet gives Luciteria subscribers a personal dashboard to track their element collection, manage wishlists, and receive intelligently-assigned subscription shipments — with zero duplicates.

### Key Features

- **Interactive Periodic Table** — Full 118-element periodic table front-and-center, with owned/missing/wishlisted status indicators
- **Collection Type Selection** — Choose from 10mm, 25.4mm, 50mm, Lucite, or Ampoules formats
- **Collector Dashboard** — Progress tracking, collection stats, recent shipments with discount info
- **Collection Grid** — Visual element grid filtered by collection type
- **Missing Items** — Browse unowned elements with availability and rarity filters
- **Wishlist Management** — Priority-ordered wishlist that drives subscription assignments
- **Subscription Control** — Plan details, billing schedule, shipment history, skip/pause/cancel
- **Preference Settings** — Duplicate handling modes, category/format preferences, notification prefs
- **Admin Operations** — Assignment queue, discount monitoring, sequence preview, customer profiles
- **Assignment Engine** — Collection-aware algorithm with collection type filtering, discount tracking, out-of-stock shifting, and precious metal exclusion
- **Billing System** — Dual billing model (signup day + 1st of month), 5-day edge case handling, grandfathering during pause
- **Notification Stubs** — Email/webhook notification system with console/DB logging

### Phase 2 Enhancements (Current)

- ✅ **Interactive Periodic Table** — All 118 elements in standard layout with click-to-detail
- ✅ **Collection Types** — 5 format types with onboarding selection and per-customer tracking
- ✅ **Enhanced Assignment Engine** — Collection type filtering, discount calculations, >20% discount alerts, sequence preview (4+ months), out-of-stock shifting
- ✅ **Billing System** — Signup day + 1st of month billing, 5-day edge case, grandfathering clock with pause preservation
- ✅ **Discount Monitoring** — Admin dashboard shows discount percentages with red alerts for >20%
- ✅ **White/Light Theme** — Luciteria-branded clean white UI with blue accents
- ✅ **Mobile Responsive** — Collapsible sidebar, responsive grids
- ✅ **Notification Stubs** — Console-logged email/webhook dispatchers for 8 event types
- ✅ **Expanded Seed Data** — 35 products, 6 customers across all collection types

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Remix (React SSR) |
| UI Components | Shopify Polaris + custom light theme |
| App Integration | Shopify App Bridge (mock for prototype) |
| Database | SQLite via Prisma ORM (mock in-memory for quick start) |
| Language | JavaScript (JSX) |
| Bundler | Vite |

## Quick Start

### Prerequisites
- Node.js >= 18

### Setup & Run

```bash
# Clone and enter project
cd luciteria_collector_cabinet

# Install dependencies
npm install

# Start development server
npm run dev
```

The app runs at **http://localhost:3000**.

### With Prisma Database (optional)

```bash
# Full setup with SQLite
npm run setup

# Or step by step:
npx prisma generate
npx prisma migrate dev --name init
node prisma/seed.js
npm run dev
```

## Navigating the Prototype

### Customer Views (default)
- `/app/cabinet` — Dashboard with periodic table (use `?customer=cust_001` through `cust_006` to switch profiles)
- `/app/cabinet/collection` — Full collection grid filtered by collection type
- `/app/cabinet/missing` — Missing elements for your collection type
- `/app/cabinet/wishlist` — Wishlist management
- `/app/cabinet/subscription` — Subscription details with billing schedule
- `/app/cabinet/preferences` — Customer preferences & notification settings
- `/app/cabinet/onboarding` — Collection type selection (new subscribers)

### Admin Views
- `/app/admin/operations` — Operations dashboard with discount monitoring & sequence preview
- `/app/admin/customers` — Customer list with collection type badges
- `/app/admin/customer/:id` — Individual customer profile with periodic table

### Test Customer Profiles

| ID | Name | Collection Type | Collection State |
|---|---|---|---|
| `cust_001` | Marcus Chen "The Completionist" | Lucite | 16/35 owned, 4 on wishlist |
| `cust_002` | Sarah Kovacs "The Curator" | Lucite | 8/35 owned, curated selection |
| `cust_003` | David Nakamura "The Newcomer" | 10mm | 0/35 owned, new subscriber |
| `cust_004` | Elena Ross "The Completionist Elite" | Lucite | 20/35 owned, edge case |
| `cust_005` | James Park "The Traditionalist" | 25.4mm | 5/35 owned |
| `cust_006` | Mia Torres "The Scientist" | Ampoules | 3/35 owned |

### Collection Types

| Type | Description | Price Range |
|---|---|---|
| 10mm | 10mm density cubes | $29-69 |
| 25.4mm | 1-inch density cubes | $49-129 |
| 50mm | 50mm display cubes | $79-249 |
| Lucite | Lucite-embedded specimens | $59-299 |
| Ampoules | Sealed glass ampoules | $39-149 |

## Project Structure

```
luciteria_collector_cabinet/
├── app/
│   ├── routes/                        # Remix routes (pages)
│   │   ├── app.cabinet._index.jsx        # Dashboard with periodic table
│   │   ├── app.cabinet.collection.jsx    # Collection grid
│   │   ├── app.cabinet.missing.jsx       # Missing items
│   │   ├── app.cabinet.wishlist.jsx      # Wishlist
│   │   ├── app.cabinet.subscription.jsx  # Subscription & billing
│   │   ├── app.cabinet.preferences.jsx   # Preferences & notifications
│   │   ├── app.cabinet.onboarding.jsx    # Collection type selection (new)
│   │   ├── app.admin.operations.jsx      # Admin ops with discount monitoring
│   │   ├── app.admin.customers.jsx       # Customer list
│   │   └── app.admin.customer.$id.jsx    # Customer profile
│   ├── components/                    # Shared UI components
│   │   ├── AppNav.jsx                    # Sidebar navigation
│   │   ├── PeriodicTable.jsx             # Interactive 118-element table (new)
│   │   ├── StatCard.jsx                  # Summary metric card
│   │   ├── ProductCard.jsx               # Element display card
│   │   └── ProgressBar.jsx               # Collection completion bar
│   ├── data/
│   │   ├── mock-db.server.js             # In-memory mock database (35 products, 6 customers)
│   │   └── elements.server.js            # 118-element periodic table data (new)
│   ├── lib/
│   │   ├── assignment-engine.server.js   # Enhanced assignment engine (new)
│   │   ├── billing.server.js             # Billing system (new)
│   │   ├── notifications.server.js       # Notification stubs (new)
│   │   ├── db.server.js                  # Prisma client singleton
│   │   └── data-access.server.js         # Database query layer
│   └── root.jsx                       # App root with light theme
├── prisma/
│   ├── schema.prisma                  # Database schema (Phase 2 models)
│   └── seed.js                        # Seed data (35 products, 6 customers)
├── ARCHITECTURE.md                    # System design document
├── ASSIGNMENT_LOGIC.md                # Assignment engine pseudocode
├── PRODUCTION_ROADMAP.md              # Production deployment plan
├── ASSUMPTIONS.md                     # Business rule assumptions
├── SETUP_GUIDE_FOR_NON_DEVELOPERS.md  # Non-developer setup guide
└── README.md                          # This file
```

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — System design, data model, billing & notification architecture
- [ASSIGNMENT_LOGIC.md](./ASSIGNMENT_LOGIC.md) — Assignment engine with collection type filtering & discount tracking
- [PRODUCTION_ROADMAP.md](./PRODUCTION_ROADMAP.md) — Production deployment guide with Phase 2 progress
- [ASSUMPTIONS.md](./ASSUMPTIONS.md) — Business rule assumptions (Phase 1 + Phase 2)

## Brand Voice Notes

UI copy follows Luciteria's brand voice:
- Smart but accessible, witty, collector-first
- "Your Cabinet" not "My Account"
- "The Hunt Continues" not "Missing Items"
- Celebrate the journey, not just the destination
- Scarcity is exciting, not frustrating
- Clean, premium white aesthetic (Phase 2 — light theme)
