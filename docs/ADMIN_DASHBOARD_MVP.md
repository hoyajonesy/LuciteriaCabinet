# Admin Dashboard MVP - Wireframes & Specifications

## Overview
The Admin Dashboard provides essential collection intelligence for Luciteria staff. This MVP focuses on three simple views: Overview Dashboard, User Collections List, and Demand Insights. No complex automation, triggers, or sync panels—just actionable data.

---

## A. Admin Overview Dashboard
**Route**: `/app/admin`

### Purpose
Single-page snapshot of collection activity across all users. Quick insights into what collectors own, want, and recent activity.

### Wireframe

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│ Luciteria Admin  [Overview] [User Collections] [Demand Insights]   [Back to Cabinet]│
├────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                    │
│  📊 Collection Intelligence Hub                                                    │
│  Last updated: May 27, 2026, 3:42 PM                              [Refresh Data]  │
│                                                                                    │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────┐│
│  │  Total Users     │ │ Total Collections│ │ Avg Elements/User│ │ Active Users ││
│  │                  │ │                  │ │                  │ │              ││
│  │      247         │ │      18,943      │ │       76.7       │ │     89       ││
│  │  collectors      │ │   items tracked  │ │    elements      │ │  (last 7d)   ││
│  └──────────────────┘ └──────────────────┘ └──────────────────┘ └──────────────┘│
│                                                                                    │
│  ┌───────────────────────────────────────────────────────────────────────────────┐│
│  │ 🏆 Top 10 Most Collected Elements                                             ││
│  ├─────┬───────────────────────┬──────────────┬───────────────┬─────────────────┤│
│  │ Rank│ Element               │ Collections  │ % of Users    │ Trend (30d)     ││
│  ├─────┼───────────────────────┼──────────────┼───────────────┼─────────────────┤│
│  │  1  │ Carbon (C)            │     198      │    80.2%      │ ↑ +12           ││
│  │  2  │ Copper (Cu)           │     187      │    75.7%      │ ↑ +8            ││
│  │  3  │ Silicon (Si)          │     176      │    71.3%      │ ↑ +15           ││
│  │  4  │ Iron (Fe)             │     169      │    68.4%      │ ↑ +7            ││
│  │  │  │ Aluminum (Al)         │     162      │    65.6%      │ ↑ +11           ││
│  │  6  │ Sulfur (S)            │     154      │    62.3%      │ ↑ +9            ││
│  │  7  │ Zinc (Zn)             │     148      │    59.9%      │ → +2            ││
│  │  8  │ Nickel (Ni)           │     142      │    57.5%      │ ↑ +6            ││
│  │  9  │ Titanium (Ti)         │     139      │    56.3%      │ ↑ +10           ││
│  │ 10  │ Magnesium (Mg)        │     135      │    54.7%      │ ↑ +5            ││
│  └─────┴───────────────────────┴──────────────┴───────────────┴─────────────────┘│
│                                                          [Export to CSV]           │
│                                                                                    │
│  ┌───────────────────────────────────────────────────────────────────────────────┐│
│  │ ⭐ Top 10 Most Wanted Elements                                                 ││
│  ├─────┬───────────────────────┬──────────────┬───────────────┬─────────────────┤│
│  │ Rank│ Element               │ Wishlist Cnt │ Out of Stock? │ Demand Score    ││
│  ├─────┼───────────────────────┼──────────────┼───────────────┼─────────────────┤│
│  │  1  │ Gallium (Ga)          │      89      │  ⚠️ YES       │ 🔥 High (89)    ││
│  │  2  │ Bismuth (Bi)          │      76      │  ✓ In Stock   │ 🔥 High (76)    ││
│  │  3  │ Selenium (Se)         │      68      │  ⚠️ YES       │ 🔥 High (68)    ││
│  │  4  │ Antimony (Sb)         │      63      │  ✓ In Stock   │ 🟡 Medium (63)  ││
│  │  5  │ Indium (In)           │      58      │  ⚠️ YES       │ 🟡 Medium (58)  ││
│  │  6  │ Tellurium (Te)        │      52      │  ✓ In Stock   │ 🟡 Medium (52)  ││
│  │  7  │ Cesium (Cs)           │      49      │  ✓ In Stock   │ 🟡 Medium (49)  ││
│  │  8  │ Rhodium (Rh)          │      47      │  ⚠️ YES       │ 🟡 Medium (47)  ││
│  │  9  │ Ruthenium (Ru)        │      44      │  ✓ In Stock   │ 🟡 Medium (44)  ││
│  │ 10  │ Hafnium (Hf)          │      41      │  ⚠️ YES       │ 🟡 Medium (41)  ││
│  └─────┴───────────────────────┴──────────────┴───────────────┴─────────────────┘│
│                                                          [Export to CSV]           │
│                                                                                    │
│  ┌───────────────────────────────────────────────────────────────────────────────┐│
│  │ 📝 Recent Activity Feed                                      [View All]        ││
│  ├───────────────────────────────────────────────────────────────────────────────┤│
│  │ • Sarah K. added Iron (Fe) 50mm cube to collection               2 hours ago  ││
│  │ • Michael R. added Bismuth (Bi) ampoule to collection            3 hours ago  ││
│  │ • Jennifer L. added Gallium (Ga) 25.4mm to wishlist              4 hours ago  ││
│  │ • David P. completed "Transition Metals" milestone               5 hours ago  ││
│  │ • Emma W. added Selenium (Se) 10mm sample to collection          6 hours ago  ││
│  │ • James T. added Copper (Cu) Lucite cube to collection           8 hours ago  ││
│  │ • Olivia M. reached 50% collection completion                    9 hours ago  ││
│  │ • Noah H. added Titanium (Ti) 50mm cube to collection           11 hours ago  ││
│  │ • Sophia G. added Carbon (C) ampoule to wishlist                13 hours ago  ││
│  │ • Liam B. added Zinc (Zn) 25.4mm to collection                  14 hours ago  ││
│  └───────────────────────────────────────────────────────────────────────────────┘│
│                                                                                    │
└────────────────────────────────────────────────────────────────────────────────────┘
```

### Component Specifications

#### 1. Key Stats Cards
**Layout**: 4 cards in a row (responsive: 2×2 on tablet, 1×4 on mobile)

| Metric | Calculation | Update Frequency |
|--------|-------------|------------------|
| Total Users | `COUNT(DISTINCT userId)` from CollectionItem | Real-time |
| Total Collections | `COUNT(*)` from CollectionItem where state = 'owned' | Real-time |
| Avg Elements/User | `Total Collections / Total Users` | Real-time |
| Active Users (7d) | `COUNT(DISTINCT userId)` from CollectionItem where `updatedAt` > now() - 7 days | Real-time |

**Visual Design**:
- Large number (48px, bold)
- Descriptive label below (14px, gray)
- Subtle border, white background
- Hover effect: slight shadow

#### 2. Top 10 Most Collected Elements
**Data Source**: `CollectionItem` table, `state = 'owned'`, grouped by `elementSymbol`

**Columns**:
- Rank (auto-numbered)
- Element (symbol + name, e.g., "Carbon (C)")
- Collections (count of owned items)
- % of Users (collections / total users × 100)
- Trend (30d) - change in collections over last 30 days with arrow indicator

**Sorting**: Default by Collections descending

**Export**: CSV with columns: Rank, Element, Symbol, Atomic Number, Collections, Percentage, Trend_30d

#### 3. Top 10 Most Wanted Elements
**Data Source**: `CollectionItem` table, `state = 'wishlist'`, grouped by `elementSymbol`

**Columns**:
- Rank (auto-numbered)
- Element (symbol + name)
- Wishlist Count (count of wishlisted items)
- Out of Stock? - checks if any SKU for this element has `inventory = 0` in Product table
- Demand Score - visual indicator (High/Medium/Low) based on wishlist count

**Demand Score Thresholds**:
- 🔥 High: 50+ wishlists
- 🟡 Medium: 20-49 wishlists
- 🟢 Low: <20 wishlists

**Export**: CSV with columns: Rank, Element, Symbol, Atomic_Number, Wishlist_Count, Out_Of_Stock, Demand_Score

#### 4. Recent Activity Feed
**Data Source**: `CollectionItem` table, joined with `User` and `Element` tables, ordered by `createdAt DESC`, limit 10

**Entry Types**:
- New collection addition: "{User} added {Element} {format} to collection"
- Wishlist addition: "{User} added {Element} to wishlist"
- Milestone: "{User} completed '{Milestone Name}' milestone"
- Completion: "{User} reached {percentage}% collection completion"

**Timestamp**: Relative time (e.g., "2 hours ago")

**Interactions**:
- Click user name → navigate to `/app/admin/users?userId={id}`
- Click element → show element details modal
- "View All" button → paginated full activity log

---

## B. User Collections List
**Route**: `/app/admin/users`

### Purpose
Browse all collectors, search by name/email, view individual collections, and export user data for analysis.

### Wireframe

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│ Luciteria Admin  [Overview] [User Collections] [Demand Insights]   [Back to Cabinet]│
├────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                    │
│  👥 User Collections                                                               │
│                                                                                    │
│  ┌─────────────────────────────────────────────────┐                              │
│  │ 🔍 Search by name or email...                   │ [Search]   [Export All CSV]  │
│  └─────────────────────────────────────────────────┘                              │
│                                                                                    │
│  Showing 247 collectors                                                            │
│                                                                                    │
│  ┌───────────────────────────────────────────────────────────────────────────────┐│
│  │ User Name          │ Email                │ Elements │ Complete │ Last Active ││
│  ├────────────────────┼──────────────────────┼──────────┼──────────┼─────────────┤│
│  │ Sarah Johnson      │ sarah@email.com      │   94     │  79.7%   │ 2 hours ago ││
│  │ Michael Rodriguez  │ michael.r@email.com  │   88     │  74.6%   │ 3 hours ago ││
│  │ Jennifer Lee       │ jlee@email.com       │   82     │  69.5%   │ 1 day ago   ││
│  │ David Park         │ dpark@email.com      │   76     │  64.4%   │ 5 hours ago ││
│  │ Emma Wilson        │ emma.w@email.com     │   71     │  60.2%   │ 6 hours ago ││
│  │ James Taylor       │ jtaylor@email.com    │   68     │  57.6%   │ 2 days ago  ││
│  │ Olivia Martinez    │ olivia.m@email.com   │   65     │  55.1%   │ 9 hours ago ││
│  │ Noah Harris        │ noah.h@email.com     │   62     │  52.5%   │ 11 hours ago││
│  │ Sophia Garcia      │ sophia.g@email.com   │   58     │  49.2%   │ 1 day ago   ││
│  │ Liam Brown         │ lbrown@email.com     │   54     │  45.8%   │ 14 hours ago││
│  │ Ava Davis          │ ava.d@email.com      │   51     │  43.2%   │ 3 days ago  ││
│  │ Ethan Miller       │ ethan.m@email.com    │   48     │  40.7%   │ 1 week ago  ││
│  │ Isabella Anderson  │ isabella.a@email.com │   45     │  38.1%   │ 2 days ago  ││
│  │ Mason Thomas       │ mason.t@email.com    │   42     │  35.6%   │ 4 days ago  ││
│  │ Mia Jackson        │ mia.j@email.com      │   39     │  33.1%   │ 1 week ago  ││
│  └────────────────────┴──────────────────────┴──────────┴──────────┴─────────────┘│
│                                                                                    │
│  [← Previous]  Page 1 of 17  [Next →]                                             │
│                                                                                    │
└────────────────────────────────────────────────────────────────────────────────────┘
```

### User Detail Modal (Click any row)

```
┌────────────────────────────────────────────────────────────────┐
│ Sarah Johnson's Collection                            [✕ Close] │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Email: sarah@email.com                                        │
│  Shopify Customer ID: 5847392019                               │
│  Collection Format: 25.4mm                                     │
│  Member Since: January 15, 2024                                │
│                                                                │
│  ┌──────────────────┐ ┌──────────────────┐ ┌────────────────┐ │
│  │  Elements Owned  │ │   Completion     │ │  Wishlist Size │ │
│  │       94         │ │      79.7%       │ │       12       │ │
│  └──────────────────┘ └──────────────────┘ └────────────────┘ │
│                                                                │
│  Recent Activity:                                              │
│  • Added Iron (Fe) 50mm cube - 2 hours ago                     │
│  • Added Bismuth (Bi) ampoule - 1 week ago                     │
│  • Completed "Transition Metals" milestone - 2 weeks ago       │
│                                                                │
│  Top Wishlist Items:                                           │
│  1. Gallium (Ga) - Added 3 weeks ago                           │
│  2. Selenium (Se) - Added 1 month ago                          │
│  3. Antimony (Sb) - Added 2 months ago                         │
│                                                                │
│  [View Full Cabinet] [Export User Data]                        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Component Specifications

#### 1. Search Bar
**Functionality**:
- Real-time search as user types (debounced 300ms)
- Searches across: `firstName`, `lastName`, `email`
- Case-insensitive
- Clears with ✕ button

**No Results State**:
```
  No collectors found matching "xyz"
  Try adjusting your search terms.
```

#### 2. User Table
**Data Source**: `User` table joined with aggregated `CollectionItem` data

**Columns**:
| Column | Source | Calculation |
|--------|--------|-------------|
| User Name | `User.firstName + lastName` | Direct |
| Email | `User.email` | Direct |
| Elements | Count of owned CollectionItems | `COUNT(*) WHERE state = 'owned'` |
| Complete | Percentage completion | `(Elements / 118) × 100` |
| Last Active | Most recent CollectionItem update | `MAX(CollectionItem.updatedAt)` formatted as relative time |

**Sorting**:
- Default: Last Active descending (most recent first)
- Clickable column headers to sort by any column
- Visual indicator (↑↓) on sorted column

**Pagination**:
- 15 rows per page
- Standard pagination controls
- Shows total count: "Showing 247 collectors"

**Row Interaction**:
- Click anywhere on row → open User Detail Modal
- Hover effect: light background color change

#### 3. Export All CSV
**Button**: Top-right of page

**Exported Data**:
```csv
User_ID,Name,Email,Shopify_Customer_ID,Elements_Owned,Completion_Percent,Wishlist_Size,Last_Active,Member_Since
12345,Sarah Johnson,sarah@email.com,5847392019,94,79.7,12,2026-05-27T13:42:00Z,2024-01-15
...
```

**Filename**: `luciteria_collectors_export_{timestamp}.csv`

#### 4. User Detail Modal
**Trigger**: Click table row

**Data Displayed**:
- User profile info (email, Shopify ID, format, join date)
- Collection stats (owned count, completion %, wishlist size)
- Recent activity (last 5 actions)
- Top wishlist items (top 5 by priority)

**Actions**:
- **View Full Cabinet**: Opens user's cabinet view (read-only for admin)
- **Export User Data**: Downloads CSV with user's complete collection
- **Close** (✕): Dismisses modal

**Read-Only Cabinet View**:
- Navigates to `/app/admin/users/{userId}/cabinet`
- Shows user's periodic table with their owned/wishlist states
- Banner at top: "Viewing {User Name}'s Cabinet (Read-Only)"
- No edit capabilities for admin

---

## C. Demand Insights Panel
**Route**: `/app/admin/demand`

### Purpose
Identify restocking opportunities and high-demand items to inform inventory purchasing decisions.

### Wireframe

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│ Luciteria Admin  [Overview] [User Collections] [Demand Insights]   [Back to Cabinet]│
├────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                    │
│  📊 Demand Insights                                                                │
│  Inventory intelligence for restocking decisions                                   │
│                                                                                    │
│  ┌───────────────────────────────────────────────────────────────────────────────┐│
│  │ ⚠️ Out-of-Stock Watchlist                                                      ││
│  │                                                                                ││
│  │ Items currently unavailable with active collector demand                       ││
│  │                                                                                ││
│  ├───────────────┬──────────────┬──────────────┬──────────────┬─────────────────┤│
│  │ SKU           │ Element      │ Format       │ Waitlist Cnt │ Days Out Stock  ││
│  ├───────────────┼──────────────┼──────────────┼──────────────┼─────────────────┤│
│  │ GA-25-PU      │ Gallium (Ga) │ 25.4mm       │      89      │ 🔴 47 days      ││
│  │ SE-10-AM      │ Selenium(Se) │ 10mm         │      68      │ 🔴 32 days      ││
│  │ IN-50-CU      │ Indium (In)  │ 50mm cube    │      58      │ 🟡 18 days      ││
│  │ RH-AM-PU      │ Rhodium (Rh) │ Ampoule      │      47      │ 🔴 61 days      ││
│  │ HF-25-PU      │ Hafnium (Hf) │ 25.4mm       │      41      │ 🟡 22 days      ││
│  │ OS-AM-PU      │ Osmium (Os)  │ Ampoule      │      38      │ 🔴 89 days      ││
│  │ IR-10-PU      │ Iridium (Ir) │ 10mm         │      35      │ 🔴 76 days      ││
│  │ TA-25-CU      │ Tantalum(Ta) │ 25.4mm       │      31      │ 🟡 15 days      ││
│  │ RE-AM-PU      │ Rhenium (Re) │ Ampoule      │      28      │ 🔴 54 days      ││
│  │ TL-10-AM      │ Thallium(Tl) │ 10mm ampoule │      24      │ 🟡 19 days      ││
│  └───────────────┴──────────────┴──────────────┴──────────────┴─────────────────┘│
│                                                                                    │
│  [Export for Restocking] [View All Out-of-Stock]                                  │
│                                                                                    │
│  ┌───────────────────────────────────────────────────────────────────────────────┐│
│  │ 🔥 High-Demand Items                                                           ││
│  │                                                                                ││
│  │ Most wanted by collectors (in stock + out of stock)                            ││
│  │                                                                                ││
│  ├───────────────┬──────────────┬──────────────┬──────────────┬─────────────────┤│
│  │ SKU           │ Element      │ Wishlist Cnt │ Missing From │ Stock Status    ││
│  ├───────────────┼──────────────┼──────────────┼──────────────┼─────────────────┤│
│  │ GA-25-PU      │ Gallium (Ga) │      89      │ 158 users    │ ⚠️ Out of Stock ││
│  │ BI-50-CU      │ Bismuth (Bi) │      76      │ 171 users    │ ✅ In Stock (45)││
│  │ SE-10-AM      │ Selenium(Se) │      68      │ 179 users    │ ⚠️ Out of Stock ││
│  │ SB-25-PU      │ Antimony(Sb) │      63      │ 184 users    │ ✅ In Stock (28)││
│  │ IN-50-CU      │ Indium (In)  │      58      │ 189 users    │ ⚠️ Out of Stock ││
│  │ TE-AM-PU      │ Tellurium    │      52      │ 195 users    │ ✅ In Stock (19)││
│  │ CS-AM-GL      │ Cesium (Cs)  │      49      │ 198 users    │ ✅ In Stock (12)││
│  │ RH-AM-PU      │ Rhodium (Rh) │      47      │ 200 users    │ ⚠️ Out of Stock ││
│  │ RU-10-PU      │ Ruthenium    │      44      │ 203 users    │ ✅ In Stock (34)││
│  │ HF-25-PU      │ Hafnium (Hf) │      41      │ 206 users    │ ⚠️ Out of Stock ││
│  └───────────────┴──────────────┴──────────────┴──────────────┴─────────────────┘│
│                                                                                    │
│  [Export High-Demand List] [Sort by: Wishlist Count ▼]                            │
│                                                                                    │
└────────────────────────────────────────────────────────────────────────────────────┘
```

### Component Specifications

#### 1. Out-of-Stock Watchlist
**Purpose**: Prioritize restocking based on active collector demand

**Data Source**: 
- `Product` table where `inventory = 0` OR `availableForSale = false`
- Joined with `CollectionItem` where `state = 'wishlist'`
- Calculate days out of stock: `NOW() - lastInStockDate`

**Columns**:
| Column | Source | Notes |
|--------|--------|-------|
| SKU | Product.sku | Direct |
| Element | Product.title parsed | Extract element name + symbol |
| Format | Product.variant or tags | 10mm, 25.4mm, 50mm, Lucite Cube, Ampoule |
| Waitlist Cnt | COUNT(CollectionItem) WHERE state = 'wishlist' | Number of collectors wanting this SKU |
| Days Out Stock | NOW() - Product.lastInStockDate | Visual indicator based on severity |

**Days Out of Stock Color Coding**:
- 🔴 Red: 30+ days (critical)
- 🟡 Yellow: 15-29 days (moderate)
- 🟢 Green: <15 days (recent)

**Sorting**: Default by Waitlist Count descending

**Export Button**: "Export for Restocking"
- Generates CSV: `restocking_priority_{timestamp}.csv`
- Columns: SKU, Element, Atomic_Number, Format, Waitlist_Count, Days_Out_Of_Stock, Supplier_Info (if available)
- Sorted by demand priority

#### 2. High-Demand Items
**Purpose**: Identify popular elements regardless of stock status (helps with inventory planning)

**Data Source**:
- All SKUs with active wishlists (regardless of stock status)
- Aggregated wishlist counts
- "Missing From" = collectors who don't own this element yet

**Columns**:
| Column | Source | Calculation |
|--------|--------|-------------|
| SKU | Product.sku | Direct |
| Element | Product.title | Parse element name |
| Wishlist Cnt | COUNT(CollectionItem) WHERE state = 'wishlist' | Total wishlists |
| Missing From | COUNT(Users) WHERE element NOT in owned collection | Potential market size |
| Stock Status | Product.inventory | "In Stock (qty)" or "Out of Stock" |

**Stock Status Visual**:
- ✅ Green: In Stock (shows quantity)
- ⚠️ Red: Out of Stock

**Sorting Options** (dropdown):
- Wishlist Count (default)
- Missing From (potential market)
- Stock Status (show out-of-stock first)
- Element (alphabetical)

**Export Button**: "Export High-Demand List"
- Generates CSV: `high_demand_elements_{timestamp}.csv`
- Includes all columns plus: Current_Inventory, Price, Last_Restock_Date

#### 3. Visual Indicators

**Demand Severity Badges**:
```
🔥🔥🔥 Critical (80+ wishlists)
🔥🔥   High (50-79 wishlists)
🔥     Medium (20-49 wishlists)
       Low (<20 wishlists)
```

**Stock Status Icons**:
```
✅ In Stock (quantity shown)
⚠️ Out of Stock
🔄 Restocking Soon (if flag set in admin)
```

---

## Technical Requirements

### Data Refresh Strategy
- **Real-time**: User-facing metrics update on page load
- **Cached**: Aggregate stats cached for 5 minutes (reduce DB load)
- **Manual Refresh**: "Refresh Data" button forces cache invalidation

### Performance Targets
- Dashboard load: <2 seconds
- User list search: <500ms
- Table sorting: <200ms (client-side after initial load)
- Export generation: <5 seconds for full dataset

### Access Control
- All admin routes require `User.isStaff = true`
- If non-staff user attempts access: redirect to `/app/cabinet` with toast error
- Audit log: Track all admin actions (exports, user views)

### Mobile Responsiveness
- **Desktop** (>1200px): Full layout as shown
- **Tablet** (768-1199px): Stack tables vertically, reduce columns
- **Mobile** (<768px): Card-based layout instead of tables

### Browser Support
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

---

## Key Design Decisions

### 1. MVP Scope
**What's Included**:
- Essential collection intelligence (who owns what, what's wanted)
- Restocking decision support
- Basic user management (view/search)

**What's Deferred** (Post-MVP):
- Automated notification triggers UI
- Bulk operations (mass email, bulk updates)
- Advanced analytics (trend charts, forecasting)
- Subscription management integration
- Real-time activity stream

### 2. Data Export Over Automation
- MVP focuses on exporting data for manual decisions
- No automated restocking triggers, notification campaigns, or email blasts
- Staff downloads CSVs and uses existing tools (Shopify, email client, Excel)
- Reduces complexity, faster to ship

### 3. Read-Only User Cabinet View
- Admins can view any user's collection but NOT edit
- Prevents accidental data corruption
- If editing needed, staff uses Shopify admin tools

### 4. Simple Tables, No Charts
- MVP uses sortable tables, not graphs/charts
- Reduces development time (no charting library)
- Tables are more actionable (can scan and copy SKUs)
- Phase 3 can add visualizations if needed

---

## Success Metrics

### For Staff
- **Time saved**: Restocking decisions made in <10 minutes (vs. manual Shopify queries)
- **User support**: Find user collections in <30 seconds
- **Data export**: All key reports exportable in 1 click

### For Business
- **Demand visibility**: Out-of-stock items with waitlists identified immediately
- **Inventory optimization**: Restock based on actual collector demand, not guesses
- **User engagement insights**: Track collection growth and completion rates

---

## Summary

**Total Views**: 3 (Overview, User Collections, Demand Insights)  
**Total Components**: 9 (4 cards, 4 tables, 1 activity feed)  
**Export Options**: 4 (Overview elements, user list, restocking priority, high-demand)

**Philosophy**: Simple, actionable intelligence. Staff can see what collectors own/want, identify restocking priorities, and export data for decisions—all without complexity or automation overhead.
