# Admin Backend — Comprehensive Wireframe Analysis

> **Source:** 12 admin wireframe HTML files  
> **Date:** June 5, 2026  
> **Purpose:** Complete feature, data-model, flow, and integration analysis prior to implementation

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Screen-by-Screen Analysis](#2-screen-by-screen-analysis)
3. [Complete Feature List](#3-complete-feature-list)
4. [Data Requirements](#4-data-requirements)
5. [User Flows](#5-user-flows)
6. [UI Components Inventory](#6-ui-components-inventory)
7. [Integration Points](#7-integration-points)
8. [Sidebar Navigation Discrepancy](#8-sidebar-navigation-discrepancy)
9. [Ambiguities & Questions](#9-ambiguities--questions)

---

## 1. Executive Summary

The admin backend is a **separate, internal-only console** (not accessible to front-end collectors) that provides Luciteria staff with platform management capabilities across **six functional domains**:

| Domain | Screens | Purpose |
|--------|---------|---------|
| **Authentication** | Login | Standalone email/password auth (not Shopify) |
| **User Management** | Users, Freeze Modal, Award Milestone, Bulk Notification | View, search, freeze/unfreeze, award milestones, bulk-notify collectors |
| **Admin Management** | Manage Admins, Add Admin Modal | CRUD admin accounts with primary/non-primary roles |
| **Analytics** | Analytics Dashboard | Platform-wide user, collection, format, and source metrics |
| **Catalog Management** | Formats, Set Builder, SKU Sync | Manage formats, build curated sets, sync cross-platform pricing |
| **Demand Intelligence** | Demand Signals | Restock prioritization from wishlist/watchlist/waitlist data |

Two distinct sidebar navigation schemas appear across the wireframes (see [Section 8](#8-sidebar-navigation-discrepancy)), suggesting an iteration occurred during design.

---

## 2. Screen-by-Screen Analysis

### 2.1 Admin Login (`admin-login.html`)

**Purpose:** Standalone authentication gate for the admin console.

**Features:**
- Email + password login form
- "Remember me" checkbox
- "Forgot password?" link
- Password visibility toggle (eye icon)
- Info banner: *"This is the admin console. User login is via Shopify."*

**UI Components:**
- Card-based centered layout (420px)
- Brand header with cube icon + "Luciteria / Collector Cabinet"
- Two text inputs (email, password) with left-side icons
- Single CTA button: "Sign In" (gray-700 bg)

**Data Touched:**
- `AdminUser.email`, `AdminUser.passwordHash`
- Session/token creation

---

### 2.2 User Management (`admin-users.html`)

**Purpose:** Browse, search, filter, and act on all collector accounts.

**Features:**
- **Summary stats:** "247 total users · 189 active"
- **Search:** By name or email (text input)
- **Filters:** Motivation (All / Inventory / Social / Acquisition / Investment / Exploring), Tier (All / Free / Lucite Pro / Curator), Status (All / Active / Frozen)
- **Bulk selection bar:** Shows "3 users selected" with bulk actions: "Send Notification", "Freeze Accounts"
- **User table columns:** Checkbox, Name, Email, Owned count, Wanted count, Status badge, Last Login, Actions (ellipsis menu)
- **Per-row actions (active user):** Freeze Account, Award Milestone, View Details
- **Per-row actions (frozen user):** Unfreeze Account, View Details
- **Pagination:** Prev / Next with "Showing 8 of 247 users"
- **Export Data** button (top-right)

**UI Components:**
- Sidebar navigation (Schema A — see Section 8)
- Search + filter toolbar (white card)
- Bulk action bar (gray-200 bg, conditional on selection)
- Data table (grid layout, 8 columns)
- Row-level hover dropdown menus
- Pagination controls

**Data Touched:**
- `User.*` (name, email, ownedCount, wantedCount, status, lastLogin, motivation, tier)

---

### 2.3 Freeze Account Modal (`admin-users-freeze-modal.html`)

**Purpose:** Confirm freezing a specific user's account with a required reason.

**Features:**
- Shows target user (avatar initials, name, email)
- **Required** reason textarea
- Info note: *"User will have read-only access. They can still view their collection but cannot make changes."*
- Cancel / "Freeze Account" buttons

**UI Components:**
- Modal overlay (480px, dimmed background)
- User identity card (gray-50 bg)
- Textarea (required)
- Info banner
- Two-button footer (Cancel + Confirm)

**Data Touched:**
- `User.status` → "frozen"
- `FreezeLog.reason`, `FreezeLog.frozenAt`, `FreezeLog.frozenBy`

---

### 2.4 Admin Users Management (`admin-manage-admins.html`)

**Purpose:** List all admin users, manage activation status, add/remove admins.

**Features:**
- **Header:** "All admin users have full access to all features."
- **Table columns:** Name (with avatar initials), Email, Date Added, Status, Last Login, Actions
- **Primary admin** row: Labeled "You · Primary" — no action buttons, cannot self-remove/deactivate
- **Other admin actions:** Deactivate / Remove (text links)
- **Inactive admin actions:** Reactivate / Remove
- **"+ Add Admin User"** button (top-right)
- **Security note:** *"Admin users can access all data and perform all actions. Only grant admin access to trusted team members."*
- **Footer:** "4 admin users · You cannot remove yourself or deactivate the primary admin."

**UI Components:**
- Data table (6 columns)
- Status badges: Active (filled circle), Inactive (pause icon)
- Security info banner (shield icon)

**Data Touched:**
- `AdminUser.*` (name, email, dateAdded, status, lastLogin, isPrimary)

---

### 2.5 Add Admin User Modal (`admin-add-admin-modal.html`)

**Purpose:** Create a new admin account.

**Features:**
- **Form fields:** First Name*, Last Name*, Email* (with helper: "Must be a valid email address. Login instructions will be sent here.")
- **Temporary password:** Auto-generated, shown in readonly mono input, with Copy + Regenerate buttons
- **Info note:** "The new admin will receive an email with login instructions and will be prompted to change their password on first login."
- **Checkbox:** "Send welcome email now" (checked by default)
- Cancel / "Add Admin User" buttons

**UI Components:**
- Modal overlay (520px, dimmed background)
- 2-column name fields
- Readonly password field with action buttons
- Info banner
- Checkbox
- Two-button footer

**Data Touched:**
- Creates `AdminUser` record (firstName, lastName, email, tempPassword, status="active")
- Triggers welcome email (optional)

---

### 2.6 Analytics Dashboard (`admin-analytics.html`)

**Purpose:** Platform-wide metrics across users, collections, formats, and acquisition sources.

**Features:**

#### User Metrics Section
- **KPI cards (4):** Total Users, Active Users (30d), Inactive, Avg Logins/Week
- **User Activity table:** Name, Last Login, Total Logins, Motivation — with segment-by-motivation dropdown filter

#### Collection Metrics Section
- **Per User Average:** Owned / Wanted / Wishlist counts
- **Platform Wide Total:** Owned / Wanted / Wishlist aggregate counts

#### Product Types Section
- **Format Breakdown bar chart:** 10mm, 25.4mm, 50mm, Lucite, Ampoule — horizontal bars with counts
- **Top 10/20 Most Collected Elements** (expandable/collapsible list, ranked by owner count)
- **Top 10/20 Most Wanted Elements** (expandable/collapsible list, ranked by wishlist demand)

#### External Sources Section
- **Source ranking table:** 18 sources listed (eBay, Amazon, Luciteria Direct, RotoMetals, Element Sales, Etsy, Alibaba, Metallium, Luciteria Gift, Mineralogical Research, Sigma-Aldrich, Edmund Optics, Smart Elements, Goodfellow, Local Mineral Show, Estate Sale, University Surplus, Other/Private)
- Collapsible: "Show Less (Top 6)" / "Show More"

**Time Range Filter:** Global selector — Last 7 days / Last 30 days / Last 90 days / All time

**UI Components:**
- 4-column KPI card grid
- Data table with segment filter
- 2-column metric cards with sub-grids
- Horizontal bar chart (CSS-based)
- Two side-by-side ranked lists (expandable)
- Source count table (collapsible)

**Data Touched:**
- Aggregated from `User`, `ElementSample`, `WishlistItem`, `WatchlistItem` tables
- `ElementSample.source` field (for external sources)
- `ElementSample.format` (for format breakdown)
- `User.motivation`, `User.lastLogin`, `User.totalLogins`

---

### 2.7 Collection Formats (`admin-formats.html`)

**Purpose:** CRUD management of the physical formats elements can be collected in.

**Features:**
- **Table columns:** Format Name (with icon), Used By (user count), Active Status, Actions
- **Listed formats:** 10mm Cube, 25.4mm Cube, 50mm Cube, Lucite Cube, Ampoule, Other
- **Inline editing:** One row shown in edit mode with text input + "Editing…" label + Save/Cancel buttons
- **Row actions:** Edit (pen icon), Delete (trash icon)
- **Status badges:** Active (filled circle) or Inactive (hollow circle)
- **"+ Add Format"** button (top-right)
- **Footer note:** *"Format changes automatically apply to wishlist, collection tracking, and progress views."*

**UI Components:**
- Data table (4 columns)
- Inline edit mode (replaces static text with input)
- Icon-based format identifiers (cube, gem, vial, ellipsis)
- Status toggle badges

**Data Touched:**
- `Format.id`, `Format.name`, `Format.icon`, `Format.isActive`, `Format.usedByCount` (computed)

---

### 2.8 Collection Set Builder (`admin-set-builder.html`)

**Purpose:** Create curated sets of elements that can be sold as packages.

**Features:**
- **Breadcrumb:** "← Back to Sets" (implies a Sets list page exists but no wireframe provided)
- **Form fields:**
  - Set Name (text input)
  - Description (textarea)
  - Price (text input, formatted as "$189.00")
  - Stock Allocation (text input, e.g. "25 units")
- **Tier Eligibility:** Checkboxes for Free / Collector / Curator
- **Element Selection:** Interactive periodic table grid — click to toggle elements; selected elements shown in dark (gray-700); legend: "Selected" vs "Available"; counter: "8 selected · click to toggle"
- **Live Preview Panel (sticky sidebar):**
  - Cover image placeholder (dashed border)
  - Set name, description
  - Summary: Elements count, Price, Stock, Tiers
  - Included elements list (symbol chips)
- **Action buttons:** "Save Draft" + "Publish Set"

**UI Components:**
- 3-column layout (2 form + 1 preview)
- Multi-section card form
- Interactive periodic table mini-grid (18-column CSS grid)
- Sticky preview sidebar
- Checkbox group (tier selection)
- Dual action buttons (draft/publish)

**Data Touched:**
- `CollectionSet.id`, `name`, `description`, `price`, `stockAllocation`, `status` (draft/published)
- `CollectionSetTier` (junction: set ↔ tier)
- `CollectionSetElement` (junction: set ↔ element)
- `CollectionSet.coverImage` (implied by placeholder)

---

### 2.9 SKU Sync Validation (`admin-sku-sync.html`)

**Purpose:** Cross-platform price and stock comparison between Shopify and eBay.

**Features:**
- **Header actions:** "Re-sync" button, "Export CSV" button
- **Last sync timestamp:** "Last synced 12 minutes ago"
- **Filters:** Status, Platform, Element (dropdowns) + SKU search input
- **Bulk toolbar:** Checkbox select-all, "3 selected", "Update Price", "Flag for Review" buttons
- **Data table columns:** Checkbox, SKU (monospace), Element, Shopify Price, eBay Price, Delta, Stock (Shopify), Qty (eBay), Status
- **Status badges:** OK, Too Low, Too High, Missing Data (dashed border)
- **Price delta:** Shown as signed dollar amount ($0.00, -$15.00, +$34.00) — bold for non-zero
- **Missing data handling:** Em-dashes for unavailable eBay data
- **Pagination:** Prev/Next, "Showing 8 of 142 SKUs"

**UI Components:**
- Dual action buttons (top-right)
- 4-filter toolbar + search
- Bulk action bar
- Full HTML `<table>` (not CSS grid — different from other screens)
- Status badge variants (4 states)
- Pagination

**Data Touched:**
- `SkuMapping.sku`, `element`, `shopifyPrice`, `ebayPrice`, `priceDelta`, `shopifyStock`, `ebayQty`, `syncStatus`
- `SkuMapping.lastSyncedAt`
- Integration: Shopify Product API, eBay Listing API

---

### 2.10 Demand Signal Intelligence (`admin-demand-signal.html`)

**Purpose:** Restock intelligence powered by wishlist, watchlist, and waitlist activity.

**Features:**
- **KPI cards (3):**
  - Total Waitlist Size: 1,284 (+12% vs last 30 days)
  - Avg Priority Score: 68.4 (across 142 tracked SKUs)
  - Pending Restocks: 17 (9 high priority)
- **Top Restock Priorities:** Ranked list of 6 items with priority scores (e.g., "Rhenium 10mm — 94")
- **Most Wanted Elements bar chart:** By wishlist frequency — Rhenium (312), Hafnium (278), Iridium (241), Osmium (205), Gadolinium (188), Tantalum (164)
- **Waitlist Growth chart:** SVG line chart showing 8-week trend (W1–W8), upward trajectory

**UI Components:**
- 3-column KPI card grid
- 3-column content grid (list + bar chart + line chart)
- Numbered ranked list with score badges
- Horizontal bar chart (CSS-based)
- SVG line chart (hand-drawn polyline)

**Data Touched:**
- Aggregated from `WishlistItem`, `WatchlistItem`, `WaitlistEntry` tables
- `DemandSignal.elementId`, `format`, `priorityScore`, `wishlistCount`, `waitlistCount`
- Computed: priority score algorithm (undefined in wireframe)

---

### 2.11 Bulk Notification Modal (`admin-bulk-notification.html`)

**Purpose:** Send targeted or broadcast notifications to collectors.

**Features:**
- **Recipient indicator:** "Sending to 247 users" (dynamic based on segment)
- **Segment filter:** All Users / Inventory / Social / Acquisition / Investment / Exploring
- **Form fields:** Notification title (text input), Message (textarea)
- **Delivery method:** Radio buttons — "In-App only" (default) / "Include Email"
- **Live preview panel:** Shows notification card as it would appear in the user's inbox (avatar, title, message, timestamp)
- Cancel / "Send Notification" buttons

**UI Components:**
- Modal overlay (760px, wide)
- 2-column layout inside modal (form + preview)
- Segment dropdown
- Radio button group
- Live preview card (white card on gray-50 bg)

**Data Touched:**
- Creates `Notification` records per targeted user
- `Notification.title`, `message`, `deliveryMethod`, `sentAt`, `sentBy`
- `Notification.segment` (for targeting logic)

---

### 2.12 Award Milestone Modal (`admin-award-milestone.html`)

**Purpose:** Manually award a collection milestone badge to a specific user.

**Features:**
- **Target user display:** Avatar initials, name, email (pre-populated from row context)
- **Milestone dropdown:** First 10 Elements, Reach 25 Elements, Reach 50 Elements, Noble Gases Complete, Transition Metals Complete, Full Lucite Format Set
- **Optional note:** Textarea for personal message
- **Checkbox:** "Notify user" (checked by default)
- Cancel / "Award Milestone" buttons

**UI Components:**
- Modal overlay (480px)
- User identity card
- Select dropdown (6 milestone options)
- Textarea (optional)
- Checkbox
- Two-button footer

**Data Touched:**
- Creates `UserMilestone` record (userId, milestoneId, awardedAt, awardedBy, note)
- Optionally creates `Notification` for the user

---

## 3. Complete Feature List

### Authentication & Access Control
| # | Feature | Screen |
|---|---------|--------|
| 1 | Admin email/password login | Login |
| 2 | Remember me persistence | Login |
| 3 | Forgot password flow | Login |
| 4 | Password visibility toggle | Login |
| 5 | Session management | Implied |

### User Management
| # | Feature | Screen |
|---|---------|--------|
| 6 | View all collectors (paginated table) | Users |
| 7 | Search users by name/email | Users |
| 8 | Filter by motivation | Users |
| 9 | Filter by subscription tier | Users |
| 10 | Filter by status (active/frozen) | Users |
| 11 | Bulk select users | Users |
| 12 | Bulk send notification | Users → Bulk Notification |
| 13 | Bulk freeze accounts | Users → Freeze Modal |
| 14 | Per-user: Freeze account (with reason) | Freeze Modal |
| 15 | Per-user: Unfreeze account | Users (row menu) |
| 16 | Per-user: Award milestone | Award Milestone |
| 17 | Per-user: View details | Users (row menu) |
| 18 | Export user data | Users |

### Admin Management
| # | Feature | Screen |
|---|---------|--------|
| 19 | View all admin users | Manage Admins |
| 20 | Add new admin user | Add Admin Modal |
| 21 | Auto-generate temporary password | Add Admin Modal |
| 22 | Copy/regenerate password | Add Admin Modal |
| 23 | Send welcome email | Add Admin Modal |
| 24 | Deactivate admin | Manage Admins |
| 25 | Reactivate admin | Manage Admins |
| 26 | Remove admin | Manage Admins |
| 27 | Primary admin protection (cannot self-remove) | Manage Admins |

### Analytics
| # | Feature | Screen |
|---|---------|--------|
| 28 | User KPIs (total, active, inactive, avg logins) | Analytics |
| 29 | User activity table (segmentable by motivation) | Analytics |
| 30 | Collection averages (owned/wanted/wishlist per user) | Analytics |
| 31 | Platform-wide collection totals | Analytics |
| 32 | Format breakdown bar chart | Analytics |
| 33 | Top collected elements (expandable top 10/20) | Analytics |
| 34 | Top wanted elements (expandable top 10/20) | Analytics |
| 35 | External source ranking (collapsible) | Analytics |
| 36 | Time range filter (7d / 30d / 90d / all time) | Analytics |

### Catalog Management
| # | Feature | Screen |
|---|---------|--------|
| 37 | View all formats | Formats |
| 38 | Add new format | Formats |
| 39 | Inline rename format | Formats |
| 40 | Delete format | Formats |
| 41 | Toggle format active/inactive | Formats |
| 42 | Create collection set (name, description, price, stock) | Set Builder |
| 43 | Select elements for set via periodic table | Set Builder |
| 44 | Assign tier eligibility to set | Set Builder |
| 45 | Save set as draft | Set Builder |
| 46 | Publish set | Set Builder |
| 47 | Live preview of set | Set Builder |
| 48 | Set cover image upload (placeholder shown) | Set Builder |

### SKU Sync & Pricing
| # | Feature | Screen |
|---|---------|--------|
| 49 | Cross-platform price comparison (Shopify vs eBay) | SKU Sync |
| 50 | Stock/quantity comparison | SKU Sync |
| 51 | Price delta calculation | SKU Sync |
| 52 | Status classification (OK / Too Low / Too High / Missing Data) | SKU Sync |
| 53 | Filter by status, platform, element | SKU Sync |
| 54 | Search by SKU | SKU Sync |
| 55 | Bulk update price | SKU Sync |
| 56 | Bulk flag for review | SKU Sync |
| 57 | Manual re-sync trigger | SKU Sync |
| 58 | Export CSV | SKU Sync |

### Demand Intelligence
| # | Feature | Screen |
|---|---------|--------|
| 59 | Waitlist size KPI with trend | Demand Signals |
| 60 | Average priority score | Demand Signals |
| 61 | Pending restock count (with high-priority sub-count) | Demand Signals |
| 62 | Top restock priorities ranked list | Demand Signals |
| 63 | Most wanted elements bar chart | Demand Signals |
| 64 | Waitlist growth line chart (8-week trend) | Demand Signals |

### Notifications
| # | Feature | Screen |
|---|---------|--------|
| 65 | Compose bulk notification (title + message) | Bulk Notification |
| 66 | Segment targeting (by motivation) | Bulk Notification |
| 67 | Delivery method selection (in-app / in-app + email) | Bulk Notification |
| 68 | Live notification preview | Bulk Notification |
| 69 | Per-user milestone notification | Award Milestone |

---

## 4. Data Requirements

### 4.1 New Models Required

```
┌─────────────────────────────────────────────────────────┐
│  AdminUser                                              │
├─────────────────────────────────────────────────────────┤
│  id            String   @id @default(uuid())            │
│  firstName     String                                   │
│  lastName      String                                   │
│  email         String   @unique                         │
│  passwordHash  String                                   │
│  isPrimary     Boolean  @default(false)                 │
│  status        Enum     (active | inactive)             │
│  dateAdded     DateTime @default(now())                 │
│  lastLogin     DateTime?                                │
│  mustChangePassword  Boolean @default(true)             │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  AdminSession                                           │
├─────────────────────────────────────────────────────────┤
│  id            String   @id @default(uuid())            │
│  adminUserId   String   → AdminUser                     │
│  token         String   @unique                         │
│  rememberMe    Boolean  @default(false)                 │
│  expiresAt     DateTime                                 │
│  createdAt     DateTime @default(now())                 │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  FreezeLog                                              │
├─────────────────────────────────────────────────────────┤
│  id            String   @id @default(uuid())            │
│  userId        String   → User                          │
│  frozenBy      String   → AdminUser                     │
│  reason        String                                   │
│  action        Enum     (freeze | unfreeze)             │
│  createdAt     DateTime @default(now())                 │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Milestone                                              │
├─────────────────────────────────────────────────────────┤
│  id            String   @id @default(uuid())            │
│  name          String   @unique                         │
│  description   String?                                  │
│  threshold     Int?     (for count-based milestones)    │
│  type          Enum     (count | category_complete |    │
│                          format_complete)               │
│  sortOrder     Int                                      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  UserMilestone                                          │
├─────────────────────────────────────────────────────────┤
│  id            String   @id @default(uuid())            │
│  userId        String   → User                          │
│  milestoneId   String   → Milestone                     │
│  awardedBy     String   → AdminUser                     │
│  note          String?                                  │
│  awardedAt     DateTime @default(now())                 │
│  @@unique([userId, milestoneId])                        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Format                                                 │
├─────────────────────────────────────────────────────────┤
│  id            String   @id @default(uuid())            │
│  name          String   @unique                         │
│  icon          String   (FontAwesome class reference)   │
│  isActive      Boolean  @default(true)                  │
│  sortOrder     Int                                      │
│  createdAt     DateTime @default(now())                 │
│  updatedAt     DateTime @updatedAt                      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  CollectionSet                                          │
├─────────────────────────────────────────────────────────┤
│  id              String   @id @default(uuid())          │
│  name            String                                 │
│  description     String?                                │
│  price           Decimal                                │
│  stockAllocation Int                                    │
│  coverImageUrl   String?                                │
│  status          Enum     (draft | published)           │
│  createdBy       String   → AdminUser                   │
│  createdAt       DateTime @default(now())               │
│  updatedAt       DateTime @updatedAt                    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  CollectionSetElement                                   │
├─────────────────────────────────────────────────────────┤
│  id              String   @id @default(uuid())          │
│  setId           String   → CollectionSet               │
│  atomicNumber    Int                                    │
│  @@unique([setId, atomicNumber])                        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  CollectionSetTier                                      │
├─────────────────────────────────────────────────────────┤
│  id              String   @id @default(uuid())          │
│  setId           String   → CollectionSet               │
│  tierName        String   (Free | Collector | Curator)  │
│  @@unique([setId, tierName])                            │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  SkuMapping                                             │
├─────────────────────────────────────────────────────────┤
│  id              String   @id @default(uuid())          │
│  sku             String   @unique                       │
│  elementName     String                                 │
│  atomicNumber    Int                                    │
│  format          String                                 │
│  shopifyPrice    Decimal?                               │
│  ebayPrice       Decimal?                               │
│  priceDelta      Decimal? (computed)                    │
│  shopifyStock    Int?                                   │
│  ebayQty         Int?                                   │
│  syncStatus      Enum (ok | too_low | too_high |        │
│                        missing_data)                    │
│  flaggedForReview Boolean @default(false)               │
│  lastSyncedAt    DateTime?                              │
│  createdAt       DateTime @default(now())               │
│  updatedAt       DateTime @updatedAt                    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  DemandSignal  (materialized / computed)                │
├─────────────────────────────────────────────────────────┤
│  id              String   @id @default(uuid())          │
│  atomicNumber    Int                                    │
│  format          String                                 │
│  wishlistCount   Int                                    │
│  waitlistCount   Int                                    │
│  priorityScore   Float                                  │
│  restockPending  Boolean  @default(false)               │
│  computedAt      DateTime @default(now())               │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  AdminNotification                                      │
├─────────────────────────────────────────────────────────┤
│  id              String   @id @default(uuid())          │
│  title           String                                 │
│  message         String                                 │
│  segment         String?  (null = all users)            │
│  deliveryMethod  Enum     (in_app | in_app_and_email)   │
│  recipientCount  Int                                    │
│  sentBy          String   → AdminUser                   │
│  sentAt          DateTime @default(now())               │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Modifications to Existing Models

| Model | Change | Reason |
|-------|--------|--------|
| `User` | Add `status` field (active/frozen) | Freeze/unfreeze functionality |
| `User` | Add `tier` field (free/lucite_pro/curator) | Filter and tier eligibility |
| `User` | Add `motivation` field (if not already present) | Filtering and segmentation |
| `User` | Add `totalLogins` counter | Analytics user activity table |
| `User` | Add `lastLogin` timestamp | User table + analytics |
| `ElementSample` | Ensure `source` field exists | External sources analytics |
| `ElementSample` | Ensure `format` references `Format` model | Format breakdown analytics |
| `Notification` (existing) | Add `adminNotificationId` FK | Link user notifications to admin broadcast |

---

## 5. User Flows

### 5.1 Authentication Flow
```
Login Page → Enter Email + Password → [Valid?]
  ├─ Yes → Redirect to Dashboard (or Users page)
  └─ No → Show error, stay on Login
  
"Forgot Password?" → [Not wireframed — needs design]
```

### 5.2 Freeze/Unfreeze User Flow
```
Users Page → Select user row → Click "⋮" menu → "Freeze Account"
  → Freeze Modal opens → Enter reason (required) → Click "Freeze Account"
  → User status changes to "Frozen" → Modal closes → Table refreshes
  
Users Page → Select frozen user → Click "⋮" menu → "Unfreeze Account"
  → [No modal shown — direct action? Or confirmation needed?]
```

### 5.3 Award Milestone Flow
```
Users Page → Select user row → Click "⋮" menu → "Award Milestone"
  → Award Modal opens → Select milestone from dropdown
  → Optionally add note → Toggle "Notify user"
  → Click "Award Milestone" → Record created → Notification sent (if checked)
```

### 5.4 Bulk Notification Flow
```
Users Page → Select multiple users (checkboxes) → Click "Send Notification"
  → Bulk Notification Modal opens → Select segment (optional refinement)
  → Enter title + message → Choose delivery method
  → Review preview → Click "Send Notification"
  → Notifications created for all targeted users → Modal closes
```

### 5.5 Admin Management Flow
```
Admin Users Page → Click "+ Add Admin User"
  → Add Admin Modal opens → Fill first name, last name, email
  → Copy auto-generated temporary password
  → Toggle "Send welcome email now" → Click "Add Admin User"
  → Admin record created → Welcome email sent → Modal closes → Table refreshes

Admin Users Page → Click "Deactivate" on a row → [Direct toggle? Confirmation?]
Admin Users Page → Click "Remove" on a row → [Confirmation modal? Not wireframed]
```

### 5.6 Format Management Flow
```
Formats Page → Click "+ Add Format" → [New row? Modal? Not wireframed]
Formats Page → Click pen icon on row → Row enters inline edit mode
  → Modify name → Click "Save" (or "Cancel")
Formats Page → Click trash icon → [Confirmation? What about "Used By" count?]
```

### 5.7 Set Builder Flow
```
[Sets List — not wireframed] → Click "Create Set" OR "Edit Set"
  → Set Builder Page → Fill metadata (name, description, price, stock)
  → Select tier eligibility → Click elements on periodic table
  → Upload cover image → Review live preview
  → "Save Draft" or "Publish Set"
```

### 5.8 SKU Sync Flow
```
SKU Sync Page → [Auto-loaded on page visit]
  → Apply filters (status / platform / element / SKU search)
  → Review price deltas and status flags
  → Select rows → "Update Price" or "Flag for Review"
  → Click "Re-sync" to pull latest data
  → Click "Export CSV" for offline analysis
```

---

## 6. UI Components Inventory

### Shared / Global Components

| Component | Used In | Notes |
|-----------|---------|-------|
| **Admin Sidebar** | All pages (post-login) | Two variant schemas (see Section 8) |
| **Brand Header** | Sidebar + Login | Cube icon + "Luciteria" / "Admin Console" |
| **"Back to Collector view" link** | Sidebar footer | Links back to collector-facing app |

### Data Display

| Component | Used In | Notes |
|-----------|---------|-------|
| **KPI Card** | Analytics, Demand Signals | Large number + label + optional trend indicator |
| **Data Table (CSS grid)** | Users, Admins, Analytics, Formats | Consistent column header styling |
| **Data Table (HTML table)** | SKU Sync | Different pattern — uses `<table>` element |
| **Ranked List** | Analytics, Demand Signals | Numbered items with right-aligned values |
| **Horizontal Bar Chart** | Analytics, Demand Signals | CSS-based width percentages |
| **SVG Line Chart** | Demand Signals | Hand-drawn polyline in viewBox |
| **Status Badge** | Users, Admins, Formats, SKU Sync | Pill-shaped, variant by status |
| **Pagination** | Users, SKU Sync | Prev/Next + showing count |

### Forms & Inputs

| Component | Used In | Notes |
|-----------|---------|-------|
| **Text Input** | Login, Add Admin, Set Builder, Bulk Notification | With and without icons |
| **Textarea** | Freeze Modal, Award Milestone, Set Builder, Bulk Notification | Various row counts |
| **Select Dropdown** | Users, Analytics, Award Milestone, SKU Sync, Bulk Notification | Custom styled with chevron |
| **Checkbox** | Users (bulk select), Add Admin, Set Builder (tiers), Award Milestone | Both standalone and in groups |
| **Radio Button Group** | Bulk Notification | Delivery method selection |
| **Inline Edit Input** | Formats | Replaces static text in table row |
| **Password Input** | Login, Add Admin | With visibility toggle / copy / regenerate |

### Modals & Overlays

| Component | Used In | Dimensions |
|-----------|---------|------------|
| **Freeze Account Modal** | Users → Freeze | 480px |
| **Add Admin Modal** | Admin Users → Add | 520px |
| **Bulk Notification Modal** | Users → Notify | 760px (2-column) |
| **Award Milestone Modal** | Users → Award | 480px |

All modals share: dimmed bg overlay, header with icon + title + close button, footer with Cancel + primary action button.

### Action Elements

| Component | Used In | Notes |
|-----------|---------|-------|
| **Primary Button** | All screens | gray-700/800 bg, white text |
| **Secondary Button** | All screens | white bg, gray border |
| **Row Action Menu** | Users | Hover-triggered dropdown |
| **Inline Text Links** | Admin Users | "Deactivate" / "Remove" / "Reactivate" |
| **Icon Buttons** | Formats | Pen (edit) / Trash (delete) |
| **Bulk Action Bar** | Users, SKU Sync | Conditional on selection |

---

## 7. Integration Points

### 7.1 With Existing Collector Cabinet

| Integration | Direction | Details |
|-------------|-----------|---------|
| **User data read** | Admin ← Cabinet | Users table, ElementSample, WishlistItem, WatchlistItem read for admin views |
| **User status write** | Admin → Cabinet | Freeze/unfreeze changes User.status; cabinet must enforce read-only for frozen users |
| **Notification delivery** | Admin → Cabinet | AdminNotification → creates records in existing Notification table; appears in collector's notification inbox |
| **Milestone awards** | Admin → Cabinet | UserMilestone records must surface on collector's dashboard/profile |
| **Format changes** | Admin → Cabinet | Format CRUD propagates to collection page format selector, onboarding format cards, shop page format filter |
| **Collection Set visibility** | Admin → Cabinet | Published sets appear in collector-facing shop/collection areas |

### 7.2 With Shopify

| Integration | Direction | Details |
|-------------|-----------|---------|
| **Product price sync** | Shopify → Admin | SKU Sync reads Shopify product prices via API |
| **Stock levels** | Shopify → Admin | SKU Sync reads inventory levels |
| **Price updates** | Admin → Shopify | "Update Price" action writes back to Shopify (implied) |
| **Set publishing** | Admin → Shopify | Published sets may need to create Shopify products/collections |
| **User authentication** | Shopify → Cabinet | Admin note confirms user auth is separate ("User login is via Shopify") |

### 7.3 With eBay

| Integration | Direction | Details |
|-------------|-----------|---------|
| **Listing prices** | eBay → Admin | SKU Sync reads eBay listing prices |
| **Listing quantities** | eBay → Admin | SKU Sync reads eBay available quantities |
| **Price updates** | Admin → eBay? | Unclear if "Update Price" also writes to eBay |

### 7.4 Internal Computed Data

| Computation | Source Tables | Output |
|-------------|--------------|--------|
| **User KPIs** | User (count, active filter, avg logins) | Analytics cards |
| **Collection averages** | ElementSample (group by user, avg) | Analytics metrics |
| **Format breakdown** | ElementSample (group by format, count) | Analytics bar chart |
| **Top collected** | ElementSample (group by element, count distinct users) | Analytics ranked list |
| **Top wanted** | WishlistItem (group by element, count) | Analytics ranked list |
| **External sources** | ElementSample.source (group by source, count) | Analytics source table |
| **Priority score** | WishlistItem + WaitlistEntry + WatchlistItem (weighted formula) | Demand Signals |
| **Waitlist growth** | WaitlistEntry (weekly cohort counts) | Demand Signals line chart |

---

## 8. Sidebar Navigation Discrepancy

Two **distinct sidebar navigation schemas** appear across the wireframes:

### Schema A (Users-centric wireframes)
Used in: `admin-users`, `admin-users-freeze-modal`, `admin-manage-admins`, `admin-add-admin-modal`, `admin-analytics`, `admin-formats`, `admin-bulk-notification`, `admin-award-milestone`

| Nav Item | Icon |
|----------|------|
| Dashboard | `fa-gauge` |
| Formats | `fa-shapes` |
| Analytics | `fa-chart-line` |
| Users | `fa-users` |
| Admin Users | `fa-user-shield` |
| Export | `fa-file-export` |

### Schema B (Catalog-centric wireframes)
Used in: `admin-sku-sync`, `admin-set-builder`, `admin-demand-signal`

| Nav Item | Icon |
|----------|------|
| Overview | `fa-gauge` |
| SKU Sync | `fa-arrows-rotate` |
| Demand Signals | `fa-signal` |
| Set Builder | `fa-layer-group` |
| Inventory | `fa-box` |
| Collectors | `fa-users` |

### ⚠️ Resolution Needed

These are **incompatible navigation structures**. Possible interpretations:

1. **Two separate admin sections** (unlikely — no cross-linking shown)
2. **Design iteration** — Schema B is a later revision that replaces Schema A
3. **Merged navigation** — The final implementation should combine both schemas into a single sidebar

**Recommendation:** Merge into a unified sidebar:
```
Dashboard / Overview
Users (= Collectors)
Admin Users
Analytics
Formats
Set Builder
SKU Sync
Demand Signals
Inventory [placeholder — no wireframe]
Export
```

---

## 9. Ambiguities & Questions

### Authentication & Security

| # | Question | Context |
|---|----------|---------|
| Q1 | **What is the forgot-password flow?** The link exists but no wireframe shows the reset process. Is it email-based OTP, reset link, or admin-to-admin manual reset? | Login |
| Q2 | **What session duration?** How long should admin sessions last? Different for "Remember me" checked vs unchecked? | Login |
| Q3 | **Is there MFA / 2FA?** No mention in wireframes, but the security note on Admin Users page suggests high sensitivity. | Manage Admins |
| Q4 | **What password policy?** Min length, complexity requirements for admin accounts? The auto-generated password suggests complexity is expected. | Add Admin Modal |

### User Management

| # | Question | Context |
|---|----------|---------|
| Q5 | **What does "View Details" show?** The row menu has this action but no detail-view wireframe exists. What data is shown? Collection summary? Activity history? | Users |
| Q6 | **Is unfreeze a direct action or does it require a modal/reason?** Freeze requires a reason; unfreeze just shows as a menu item with no confirmation step wireframed. | Users (frozen row) |
| Q7 | **Can frozen users be bulk-unfrozen?** The bulk bar only shows "Freeze Accounts" — no unfreeze bulk action. | Users |
| Q8 | **What does "Export Data" export?** Full user list? Filtered results? What format (CSV, Excel)? What columns? | Users |
| Q9 | **Is there a user creation flow?** The admin can view users but there's no "Add User" button. Are users only created via Shopify? | Users |

### Admin Management

| # | Question | Context |
|---|----------|---------|
| Q10 | **Is "Remove" permanent deletion or soft-delete?** The action exists but the consequence is unclear. | Manage Admins |
| Q11 | **Is there a confirmation modal for Deactivate/Remove?** No wireframe provided. | Manage Admins |
| Q12 | **Can the primary admin be transferred?** The wireframe says "You · Primary" but doesn't show how to change primary status. | Manage Admins |
| Q13 | **Is there an admin activity/audit log?** Given the security note, should admin actions be logged? | Implied |

### Analytics

| # | Question | Context |
|---|----------|---------|
| Q14 | **How is "Active Users (30d)" defined?** At least one login in 30 days? Or any activity (collection update, etc.)? | Analytics |
| Q15 | **Are analytics real-time or cached/computed periodically?** For 247 users this is trivial, but the architecture decision matters for scale. | Analytics |
| Q16 | **What is "Wishlist" in collection metrics?** The collector cabinet has Wishlist and Watchlist. Does this analytics metric combine them or is it strictly wishlist? | Analytics |

### Formats

| # | Question | Context |
|---|----------|---------|
| Q17 | **What happens when deleting a format that's "Used By" users?** The "Other" format has 12 users and a delete button. Does deleting cascade, reassign, or require zero users first? | Formats |
| Q18 | **How does "Add Format" work?** Button exists but no wireframe shows the creation flow (modal or inline new row?). | Formats |
| Q19 | **Can format icons be customized?** Each format has a FontAwesome icon, but there's no picker in the edit flow. | Formats |

### Set Builder

| # | Question | Context |
|---|----------|---------|
| Q20 | **Where is the Sets list page?** "← Back to Sets" breadcrumb implies a list view, but no wireframe exists. | Set Builder |
| Q21 | **How does cover image upload work?** A placeholder is shown but no upload UI or file picker is wireframed. | Set Builder |
| Q22 | **What format does the set apply to?** The "Transition Metals Starter Pack" example mentions "10mm cubes" in description but there's no format selector field. Is format implicit? | Set Builder |
| Q23 | **Can sets be edited after publishing?** Only "Save Draft" and "Publish Set" are shown. No "Unpublish" or "Archive" action. | Set Builder |
| Q24 | **How do sets relate to Shopify products?** Does publishing a set create a Shopify product, a collection, or is it cabinet-only? | Set Builder |
| Q25 | **What are the subscription tiers?** The wireframe shows "Free / Collector / Curator" but the Users page shows "Free / Lucite Pro / Curator". Which is canonical? | Set Builder vs Users |

### SKU Sync

| # | Question | Context |
|---|----------|---------|
| Q26 | **How does "Update Price" work?** Does it update Shopify price, eBay price, or both? To what value? | SKU Sync |
| Q27 | **Is sync automatic or manual only?** "Re-sync" button and "Last synced 12 minutes ago" suggests manual, but is there a periodic background job? | SKU Sync |
| Q28 | **What eBay API integration is needed?** Are eBay credentials already configured? Which API (Browse, Inventory, Trading)? | SKU Sync |
| Q29 | **What threshold defines "Too Low" vs "Too High"?** Is any negative delta "Too Low"? Or is there a percentage/dollar threshold? | SKU Sync |

### Demand Signals

| # | Question | Context |
|---|----------|---------|
| Q30 | **What is the priority score algorithm?** The wireframe shows scores (94, 88, 81…) but the formula is undefined. What inputs and weights? | Demand Signals |
| Q31 | **What is a "Waitlist" vs "Wishlist"?** The collector cabinet has Wishlist but this page references "Waitlist" separately. Is this a new concept (notify-when-back-in-stock) or a renaming? | Demand Signals |
| Q32 | **Are demand signals actionable?** No "Create Restock Order" or "Notify Waitlist" actions are shown. Are these view-only? | Demand Signals |
| Q33 | **Is "Pending Restocks" managed here or externally?** The KPI shows 17 pending, but there's no UI to mark a restock as complete or in-progress. | Demand Signals |

### Bulk Notifications

| # | Question | Context |
|---|----------|---------|
| Q34 | **Can notifications include links/CTAs?** The message appears text-only. Should rich content (links, buttons) be supported? | Bulk Notification |
| Q35 | **Is there a notification history/log?** No wireframe shows previously sent notifications. Can admins review past broadcasts? | Implied |
| Q36 | **What email service handles "Include Email" delivery?** Is this Shopify email, SendGrid, or another provider? | Bulk Notification |

### Milestones

| # | Question | Context |
|---|----------|---------|
| Q37 | **Are milestones auto-awarded or always manual?** The wireframe shows only manual admin-initiated awards. Should the system auto-detect "First 10 Elements" and award automatically? | Award Milestone |
| Q38 | **Can milestones be revoked?** No "revoke" action is shown. What if an admin awards incorrectly? | Award Milestone |
| Q39 | **Where do milestones appear for collectors?** The award is created admin-side, but no collector wireframe shows a "Milestones" or "Badges" section on the dashboard. | Award Milestone |

### General / Cross-cutting

| # | Question | Context |
|---|----------|---------|
| Q40 | **What is the "Dashboard" page?** Both navigation schemas list it (as "Dashboard" or "Overview") but no wireframe exists. What KPIs/widgets should it show? | Sidebar |
| Q41 | **What is the "Export" page?** Schema A lists it in the sidebar but no wireframe exists. Is this a general data export tool? | Sidebar |
| Q42 | **What is the "Inventory" page?** Schema B lists it but no wireframe exists. Is this different from SKU Sync? | Sidebar |
| Q43 | **Should the admin console be responsive?** All wireframes are fixed at 1440px width. Is mobile/tablet support needed? | All screens |
| Q44 | **Is role-based access control (RBAC) needed?** Currently "all admin users have full access to all features." Will granular permissions be needed later? | Manage Admins |

---

## Appendix: File-to-Feature Matrix

| Wireframe File | Primary Feature | Modals/Overlays |
|---------------|-----------------|-----------------|
| `admin-login.html` | Authentication | — |
| `admin-users.html` | User list, search, filter, bulk actions | — |
| `admin-users-freeze-modal.html` | — | Freeze Account confirmation |
| `admin-manage-admins.html` | Admin user list, activate/deactivate/remove | — |
| `admin-add-admin-modal.html` | — | Add new admin user form |
| `admin-analytics.html` | Platform metrics dashboard | — |
| `admin-formats.html` | Format CRUD with inline editing | — |
| `admin-set-builder.html` | Curated set creation with periodic table | — |
| `admin-sku-sync.html` | Cross-platform price/stock comparison | — |
| `admin-demand-signal.html` | Restock intelligence dashboard | — |
| `admin-bulk-notification.html` | — | Compose & send bulk notifications |
| `admin-award-milestone.html` | — | Award milestone badge to user |
