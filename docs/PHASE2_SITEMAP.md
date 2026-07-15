# Phase 2 Complete Sitemap
**Luciteria Collector Cabinet - Navigation Architecture**

---

## Navigation Hierarchy & Authentication Requirements

```
┌─────────────────────────────────────────────────────────────────────┐
│                      LUCITERIA COLLECTOR CABINET                    │
│                         (Shopify Embedded App)                      │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                ┌──────────────────┴──────────────────┐
                │                                     │
         [PUBLIC ROUTES]                    [AUTHENTICATED ROUTES]
                │                                     │
                │                                     │
        ┌───────┴────────┐               ┌───────────┴────────────┐
        │                │               │                        │
   /auth/login      /auth/signup    CUSTOMER ROUTES         ADMIN ROUTES
   /auth/callback                        │                        │
                                         │                        │
                          ┌──────────────┼────────────────────────┤
                          │              │                        │
                    CORE NAVIGATION   OVERLAYS              /admin/**
                          │              │                    (Role Required)
              ┌───────────┼──────────────┴────────┐
              │           │              │        │
        PRIMARY TABS  NOTIFICATIONS  WISHLIST  ELEMENT
         (Phase 1+2)      CENTER      DETAIL    NOTES
              │         (Phase 2)   (Phase 2)  (Phase 2)
              │                                   
    ┌─────────┼─────────┬──────────┬──────────┬──────────┐
    │         │         │          │          │          │
    │         │         │          │          │          │
/collection /progress  /shop   /membership /profile  /notifications
 (Phase 1)  (Phase 1) (Phase 1) (Phase 1)  (Phase 1)   (Phase 2 NEW)
    │         │         │          │          │          │
    └─────────┴─────────┴──────────┴──────────┴──────────┘
                    MAIN APP TABS
```

---

## 🔐 Authentication Matrix

| Route Pattern | Auth Required | Role Required | Notes |
|--------------|---------------|---------------|-------|
| `/auth/*` | ❌ No | None | Public authentication flows |
| `/collection` | ✅ Yes | Customer | Primary dashboard |
| `/progress` | ✅ Yes | Customer | Milestones & achievements |
| `/shop` | ✅ Yes | Customer | Browse missing items |
| `/membership` | ✅ Yes | Customer | Subscription management |
| `/profile` | ✅ Yes | Customer | User settings & preferences |
| `/notifications` | ✅ Yes | Customer | Notification center (NEW) |
| `/wishlist/:sku` | ✅ Yes | Customer | Context-aware wishlist detail (NEW) |
| `/element-notes/:sku` | ✅ Yes | Customer | Drawer overlay (NEW) |
| `/admin/**` | ✅ Yes | **Admin** | All admin routes |

---

## 📱 Phase 1 Routes (Existing)

### 1️⃣ `/collection` - Collection Dashboard
**Primary interface showing periodic table and collection status**

```
/collection
    │
    ├─ Default View: Interactive Periodic Table
    │   ├─ Filter by: Form (10mm, 25.4mm, 50mm, Cubes, Ampoules)
    │   ├─ State indicators: Owned, Missing, Wishlisted
    │   └─ Click item → Element Detail Modal
    │
    ├─ Collection Stats Widget
    │   ├─ Total Owned: X/118
    │   ├─ Primary Pattern: [detected]
    │   └─ Active Goals: N
    │
    └─ Quick Actions
        ├─ "Add to Wishlist" (from periodic table)
        └─ "Shop Missing Items" → /shop

TRIGGERS:
- Click element card → Opens element detail modal with "Add Notes" button
- "Add Notes" button → Opens /element-notes/:sku drawer (Phase 2)
```

### 2️⃣ `/progress` - Milestones & Achievements
**Progress tracking and milestone visualization**

```
/progress
    │
    ├─ Milestone Progress Cards
    │   ├─ First Element
    │   ├─ 10 Elements
    │   ├─ First Complete Row
    │   ├─ First Complete Group
    │   ├─ 50 Elements
    │   └─ Complete Periodic Table (118)
    │
    ├─ Collection Path Analysis
    │   ├─ Detected Primary Pattern: [Family + Form + Size]
    │   ├─ Completion %: XX%
    │   └─ Next Recommended Items
    │
    └─ Achievement History
        └─ Unlocked milestones with dates
```

### 3️⃣ `/shop` - Browse Missing Items
**Shop integration showing collection-aware product feed**

```
/shop
    │
    ├─ Filter Controls
    │   ├─ Show: All / Missing Only / Wishlisted
    │   ├─ Form Filter: All / Cubes / Ampoules / etc.
    │   └─ Family Filter: Alkali Metals / Noble Gases / etc.
    │
    ├─ Product Grid
    │   └─ Each Card Shows:
    │       ├─ Element name + symbol
    │       ├─ SKU and form
    │       ├─ Price
    │       ├─ Stock status
    │       ├─ "Owned" / "Missing" badge
    │       ├─ "Add to Cart" (in stock)
    │       ├─ "Join Waitlist" (out of stock) → Phase 2
    │       └─ "Add to Wishlist" button
    │
    └─ Sort Controls
        └─ By: Relevance / Price / Atomic Number
```

### 4️⃣ `/membership` - Subscription Management
**Cube of the Month subscription and billing**

```
/membership
    │
    ├─ Subscription Status Card
    │   ├─ Active / Paused / Cancelled
    │   ├─ Next shipment: [Element Name] on [Date]
    │   ├─ Billing: $XX.XX on [Day of Month]
    │   └─ Grandfathered Price: $YY.YY (if applicable)
    │
    ├─ Shipment History
    │   └─ Past deliveries with tracking
    │
    ├─ Assignment Preview
    │   ├─ Next 3 shipments (auto-assigned)
    │   └─ "These avoid duplicates based on your collection"
    │
    └─ Actions
        ├─ Pause Subscription
        ├─ Update Payment Method
        └─ Change Preferred Form (if multi-format)
```

### 5️⃣ `/profile` - User Settings
**Account settings and preferences**

```
/profile
    │
    ├─ Account Information
    │   ├─ Name, Email
    │   └─ Password Change
    │
    ├─ Collection Preferences
    │   ├─ Primary Format: [10mm / 25.4mm / 50mm / Cubes / Ampoules]
    │   └─ Display Preferences
    │
    ├─ 🆕 Notification Preferences (Phase 2)
    │   ├─ Notification Types (5 toggles)
    │   │   ├─ ✅ Completion Unlock Alerts
    │   │   ├─ ✅ Near-Completion Urgency
    │   │   ├─ ✅ Wishlist Restock Alerts
    │   │   ├─ ✅ High-Relevance Restock
    │   │   └─ ✅ Milestone Proximity
    │   │
    │   ├─ Frequency Limit: Max per week [1-2 slider]
    │   └─ Delivery Method: In-App, Email, Both
    │
    └─ Data Export
        ├─ Export Collection (CSV/JSON)
        └─ 🆕 Export Element Notes (Phase 2)
```

---

## 🆕 Phase 2 New Customer Routes

### 6️⃣ `/notifications` - Notification Center
**Centralized notification inbox with context-aware alerts**

```
/notifications
    │
    ├─ Header
    │   ├─ "Notifications" title
    │   ├─ Unread count badge
    │   └─ "Mark All Read" button
    │
    ├─ Filter Tabs
    │   ├─ All (default)
    │   ├─ Completion Unlock
    │   ├─ Near-Completion
    │   ├─ Wishlist Restock
    │   ├─ High-Relevance
    │   └─ Milestone Proximity
    │
    ├─ Notification List
    │   └─ Each Notification Card:
    │       ├─ Type icon + color badge
    │       ├─ Title (e.g., "Your Alkali Metal Cube Set is Complete!")
    │       ├─ Context message with SKU/set name
    │       ├─ Timestamp
    │       ├─ Read/Unread indicator
    │       ├─ Primary CTA button → /shop?sku=XXX
    │       └─ Secondary action: "Dismiss" / "Add to Wishlist"
    │
    └─ Empty State
        └─ "No notifications yet. We'll alert you when items you need restock."

MOBILE BEHAVIOR:
- Bell icon in top nav shows unread count
- Tapping opens full-screen notification center
- Swipe-to-dismiss on mobile
```

### 7️⃣ `/element-notes/:sku` - Element Notes Drawer
**Overlay drawer for private collector notes on owned items**

```
/element-notes/:sku (Drawer Overlay)
    │
    ├─ Accessed From:
    │   ├─ Collection dashboard element card → "View/Add Notes"
    │   └─ Progress page → Owned items
    │
    ├─ Drawer Slides In (Right Side)
    │   │
    │   ├─ Header
    │   │   ├─ Element name + symbol (e.g., "Gold (Au)")
    │   │   ├─ SKU display
    │   │   ├─ "🔒 Private - Only You See This"
    │   │   └─ Close button [×]
    │   │
    │   ├─ Form Fields (7 total)
    │   │   ├─ 📅 Acquisition Date (date picker)
    │   │   ├─ 🏪 Acquired From (text input)
    │   │   ├─ 💰 Purchase Price (currency input, optional)
    │   │   ├─ 📝 Condition Notes (textarea)
    │   │   ├─ 📍 Display Location (text input)
    │   │   ├─ 💭 Personal Notes (large textarea)
    │   │   └─ 📷 Photos (upload zone, 1-3 slots)
    │   │
    │   ├─ Auto-Populated Hint
    │   │   └─ "✨ Acquisition date auto-filled from order history"
    │   │
    │   └─ Footer Actions
    │       ├─ [Cancel] button
    │       └─ [Save Notes] button (primary)
    │
    └─ On Save:
        ├─ Success toast: "Notes saved for [Element Name]"
        └─ Returns to collection view with note indicator visible

NAVIGATION:
- Not a separate route, renders as drawer overlay
- URL updates to /collection?notes=:sku for deep linking
- Back button closes drawer
```

### 8️⃣ `/wishlist` - Enhanced Wishlist with Context Filtering
**Context-aware wishlist with intelligent labeling**

```
/wishlist
    │
    ├─ Header
    │   ├─ "My Wishlist" title
    │   ├─ Total count: "X items"
    │   └─ "Export List" button
    │
    ├─ Filter Controls
    │   ├─ Context Labels:
    │   │   ├─ All (default, shows count)
    │   │   ├─ 🎯 Core (matches primary pattern)
    │   │   ├─ 🧭 Exploration (different form/family)
    │   │   ├─ ⭐ Aspirational (premium/larger size)
    │   │   └─ 🔄 Upgrade Target (better version of owned)
    │   │
    │   ├─ Sort By:
    │   │   ├─ Date Added (newest first)
    │   │   ├─ Priority (high → low)
    │   │   └─ Availability (in stock first)
    │   │
    │   └─ View Toggle: [Grid] / [List]
    │
    ├─ Wishlist Item Cards
    │   └─ Each Card:
    │       ├─ Element image
    │       ├─ Element name + SKU
    │       ├─ Context badge (colored label)
    │       ├─ Stock status indicator
    │       │   ├─ ✅ In Stock
    │       │   ├─ ⏳ Low Stock (urgency!)
    │       │   └─ ❌ Out of Stock
    │       ├─ Price
    │       ├─ Date added timestamp
    │       ├─ Primary CTA:
    │       │   ├─ "Add to Cart" (if in stock)
    │       │   └─ "Join Waitlist" (if out of stock)
    │       └─ Secondary actions:
    │           ├─ Edit context label
    │           ├─ Enable stock alert
    │           └─ Remove from wishlist
    │
    ├─ Click Item → Opens Detail View
    │   │
    │   └─ Wishlist Item Detail Modal:
    │       ├─ Full product details
    │       ├─ Current context label (with edit button)
    │       ├─ "Why this label?" explanation
    │       │   └─ e.g., "Auto-labeled Aspirational because this is 
    │       │       a 50mm cube and your primary pattern is 10mm"
    │       ├─ Collection fit analysis
    │       ├─ Stock alert toggle
    │       └─ [Remove from Wishlist] button
    │
    └─ Empty State
        └─ "No items in wishlist. Browse the shop to add items!"

ADDING TO WISHLIST:
When user adds out-of-pattern item from /shop or /collection:
    │
    ├─ Context Label Prompt (Modal)
    │   ├─ "Why are you interested in this item?"
    │   ├─ Radio Options:
    │   │   ├─ 🎯 Core Collection (fits my main pattern)
    │   │   ├─ 🧭 Exploration (trying new form/family)
    │   │   ├─ ⭐ Aspirational (premium/upgrade)
    │   │   └─ 🔄 Upgrade Target (replace existing)
    │   │
    │   ├─ Auto-Detection Hint:
    │   │   └─ "✨ We think this is: Aspirational"
    │   │   └─ "Based on: Higher price tier than your pattern"
    │   │
    │   └─ [Cancel] / [Add to Wishlist] buttons
    │
    └─ On Confirm:
        ├─ Item added with selected/auto-detected label
        └─ Toast: "Added to wishlist as [Context Type]"
```

---

## 🔧 Phase 2 Admin Routes

### 🛡️ `/admin` - Admin Command Center
**Dashboard overview with quick access to all panels**

```
/admin (Requires Admin Role)
    │
    ├─ Dashboard Overview
    │   ├─ Quick Stats Cards
    │   │   ├─ Total SKUs Mapped: XXX/1654
    │   │   ├─ Active Collection Sets: N
    │   │   ├─ Pending Notifications: N
    │   │   └─ Critical Sync Issues: N (⚠️ Alert if >0)
    │   │
    │   └─ Quick Access Panel Grid
    │       ├─ [SKU Mapping] → /admin/sku-mapping
    │       ├─ [Collection Sets] → /admin/collection-sets
    │       ├─ [Demand Signals] → /admin/demand-signals
    │       ├─ [Back-in-Stock Control] → /admin/restock-control
    │       ├─ [Sync & Integrity] → /admin/sync-integrity
    │       └─ [Collector Insights] → /admin/insights
    │
    └─ Critical Alerts Banner (Top of Page)
        └─ Shows sync issues, unmatched SKUs, price violations (auto-loaded)
```

### 📊 Admin Sub-Routes (6 Panels)

#### `/admin/sku-mapping` - SKU ↔ Collection Mapping Panel
```
Purpose: Map every SKU to element, family, form, size, and collection sets
Access: Admin only
Navigation: Admin sidebar → "SKU Mapping"

Features:
├─ Bulk import/export tools
├─ Inline editing
├─ Filter by: Element, Family, Form, Size, Set Membership
├─ Search by SKU or element name
└─ "Create New Set" button → /admin/collection-sets/new
```

#### `/admin/collection-sets` - Collection Set Builder
```
Purpose: Create and manage named collection sets (e.g., "10mm Alkali Cubes")
Access: Admin only
Navigation: Admin sidebar → "Collection Sets"

Routes:
├─ /admin/collection-sets (list view)
├─ /admin/collection-sets/new (create form)
└─ /admin/collection-sets/:id/edit (edit form)

Features:
├─ Set name, description
├─ Completion rule: STRICT / FLEXIBLE / THRESHOLD
├─ Required SKUs list (drag-drop interface)
├─ Optional SKUs list
├─ Nested set support (parent set selector)
├─ Threshold percentage (for flexible rules)
└─ Active/Inactive toggle
```

#### `/admin/demand-signals` - Demand Signals Dashboard
```
Purpose: Answer "What is the most painful missing item right now?"
Access: Admin only
Navigation: Admin sidebar → "Demand Signals"

Features:
├─ Hero Widget: "Most Painful Missing Item" (top result)
├─ Table Columns:
│   ├─ SKU
│   ├─ Element Name
│   ├─ Wishlist Count (🔥 high demand indicator)
│   ├─ Missing Count (collectors who need it)
│   ├─ Blocks N Near-Completions (critical metric)
│   ├─ Stock Status (In Stock / Out of Stock)
│   └─ Priority Score (calculated)
│
├─ Sort controls (by any column)
├─ Date range filter
└─ Export button (CSV/JSON)
```

#### `/admin/restock-control` - Back-in-Stock Trigger Control
```
Purpose: Manually trigger restock notifications with priority control
Access: Admin only
Navigation: Admin sidebar → "Back-in-Stock Control"

Features:
├─ Per-SKU Table:
│   ├─ SKU + Element Name
│   ├─ Waitlist Size
│   ├─ Wanted Count (active collectors who need it)
│   ├─ Missing Count (total collectors missing it)
│   ├─ Notification Queue Status
│   └─ [Trigger Notification] button
│
├─ Notification History Log
│   └─ Shows recent notifications sent with timestamps
│
├─ Priority Queue Management
│   └─ Reorder notification queue by urgency
│
└─ Batch Actions
    ├─ "Trigger All High Priority"
    └─ "Preview Notification Recipients"
```

#### `/admin/sync-integrity` - Sync & Data Integrity Panel
```
Purpose: Monitor Squarespace ↔ eBay sync and surface critical issues
Access: Admin only
Navigation: Admin sidebar → "Sync & Integrity"

⚠️ CRITICAL: This panel loads alerts on admin dashboard load (visible immediately)

Features:
├─ Critical Issues Alert Banner (Top)
│   └─ Shows count of: Unmatched SKUs, Price Violations, Stock Mismatches
│
├─ Unmatched SKUs Table
│   ├─ Squarespace-Only SKUs (not on eBay)
│   ├─ eBay-Only SKUs (not on Squarespace)
│   └─ Action: "Mark as Retired" / "Merge with..."
│
├─ Price Delta Violations Table
│   ├─ SKU + Element Name
│   ├─ Squarespace Price
│   ├─ eBay Price
│   ├─ Delta Amount
│   ├─ Status Badge:
│   │   ├─ 🔴 Too Low (<$5 delta)
│   │   ├─ 🟡 Too High (>$7 delta)
│   │   ├─ ✅ OK ($5-$7 range)
│   │   └─ ⚪ Missing Data
│   └─ Last Sync Timestamp
│
├─ Stock Sync Alerts Table
│   ├─ SKUs with stock mismatches between platforms
│   └─ Recommended action
│
├─ Auto-Refresh Indicator (updates every 5 min)
└─ [Export Issues Report] button
```

#### `/admin/insights` - Collector Insights (Analytics)
```
Purpose: High-signal analytics on collection behavior and completion patterns
Access: Admin only
Navigation: Admin sidebar → "Collector Insights"

Features:
├─ Key Metrics Cards (Top Row)
│   ├─ Avg Elements Owned: X.X
│   ├─ Active Collectors: N
│   ├─ Avg Collection Completion: XX%
│   └─ Most Popular Pattern: [Family + Form + Size]
│
├─ Most Popular Collection Paths (Bar Chart)
│   └─ Shows top 10 patterns collectors follow
│
├─ Set Completion Rates Table
│   ├─ Set Name
│   ├─ Total Collectors Pursuing
│   ├─ Avg Completion %
│   └─ Est. Time to Complete
│
├─ Drop-Off Points Table
│   ├─ Element Name + SKU
│   ├─ "Stall Point" (collectors who stop here)
│   ├─ Avg time before stalling
│   └─ Potential blockers (price, availability)
│
├─ Top Aspirational Items Table
│   ├─ SKU
│   ├─ Times Wishlisted (Aspirational context)
│   ├─ Avg Collection Size When Wishlisted
│   └─ "Dream item" indicator
│
└─ Date Range Selector
    └─ Last 30 days / 90 days / 1 year / All time
```

---

## 🎯 Navigation Patterns & UX Flow

### Primary User Journeys

#### Journey 1: New Collector Onboarding
```
1. /auth/signup → Account creation
2. /collection (first load) → Onboarding modal
   ├─ "What format are you collecting?" 
   └─ "Set your first goal"
3. /collection → See empty periodic table
4. /shop → Browse and add first item to cart
5. Return to /collection → See first owned element
6. /element-notes/:sku → Add notes about first element
```

#### Journey 2: Active Collector Routine
```
1. /collection → Check owned items, see progress
2. /notifications → Check for restock alerts
   └─ Click notification → /shop?sku=XXX
3. /shop → Add restocked item to cart
4. /wishlist → Review and update wishlist
5. /progress → See milestone progress
6. /membership → Review next subscription shipment
```

#### Journey 3: Admin Daily Operations
```
1. /admin → Dashboard overview, check critical alerts
2. /admin/sync-integrity → Address any sync issues
3. /admin/demand-signals → Review most painful missing items
4. /admin/restock-control → Trigger notifications for restocked SKUs
5. /admin/insights → Review collector behavior trends
```

---

## 📱 Mobile Navigation Adaptations

### Bottom Navigation Bar (Mobile)
```
┌───────────────────────────────────────────────┐
│                                               │
│            [Main Content Area]                │
│                                               │
└───────────────────────────────────────────────┘
┌─────┬─────┬─────┬─────┬─────────────────────┐
│ 📦  │ 📈  │ 🛍️  │ 🔔  │         👤          │
│Colxn│Prog │Shop │Notif│       Profile       │
└─────┴─────┴─────┴─────┴─────────────────────┘
```

- **Collection** (📦) - Primary tab (default)
- **Progress** (📈) - Milestones
- **Shop** (🛍️) - Browse products
- **Notifications** (🔔) - Phase 2, shows unread badge
- **Profile** (👤) - Settings + Membership

**Wishlist** and **Element Notes** open as full-screen overlays on mobile.

### Desktop Navigation
- Top horizontal tabs for main sections
- Sidebar for admin routes
- Right-side drawer for element notes
- Notification center as dropdown or dedicated page

---

## 🔄 State Management & URL Patterns

### URL Query Parameters for Filtering

| Route | Query Params | Example |
|-------|-------------|---------|
| `/collection` | `?form=10mm&filter=missing` | Show missing 10mm items |
| `/shop` | `?family=alkali&form=cube&show=missing` | Filtered shop view |
| `/wishlist` | `?context=aspirational&sort=priority` | Filtered wishlist |
| `/notifications` | `?type=completion&status=unread` | Filtered notifications |
| `/admin/demand-signals` | `?range=30d&sort=blocks` | Date-filtered demand signals |

### Deep Linking Support

```
Direct Links:
- /collection?element=Au → Opens gold element detail
- /element-notes/SKU-123 → Opens notes drawer for SKU
- /shop?sku=LC-AU-10MM → Direct to product page
- /wishlist?context=core → Filtered wishlist view
- /notifications?id=notif-123 → Specific notification
```

---

## 🚀 Progressive Enhancement Strategy

### Phase 1 Routes (Deployed)
✅ Collection, Progress, Shop, Membership, Profile

### Phase 2A Routes (First Release)
🆕 Notifications Center, Element Notes, Enhanced Wishlist

### Phase 2B Routes (Admin Release)
🔧 Admin Dashboard, SKU Mapping, Collection Sets, Sync Integrity

### Phase 2C Routes (Analytics Release)
📊 Demand Signals, Restock Control, Collector Insights

---

## 📝 Implementation Notes

### Route Protection Middleware
```javascript
// Protect customer routes
if (!user.authenticated) redirect('/auth/login')

// Protect admin routes
if (!user.hasRole('admin')) return 403
```

### Navigation State Persistence
- Last active tab saved in localStorage
- Filter preferences persisted per route
- Notification read states synced to DB

### Performance Considerations
- Lazy load admin panels (not in customer bundle)
- Infinite scroll for notification center
- Debounced search on SKU mapping panel
- Cached demand signals (refresh on restock events)

---

**End of Sitemap Documentation**
*Version: Phase 2 Complete*
*Last Updated: May 2026*
