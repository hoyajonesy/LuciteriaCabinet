# Phase 2 Sitemap (Simplified)

## Overview
This sitemap shows the complete application structure including Phase 1 (existing) and Phase 2 (new) routes. The Phase 2 admin dashboard has been simplified to MVP scope focused on essential collection intelligence.

---

## Complete Application Routes

### Public Routes
```
/
├── / (landing/auth)
└── /auth/callback (Shopify OAuth)
```

### User Routes (Phase 1 - Existing)
```
/app
├── /app/cabinet
│   └── Main collector dashboard
│       - Interactive 118-element periodic table
│       - Filter by collection format (10mm, 25.4mm, 50mm, Lucite Cubes, Ampoules)
│       - Element state indicators (Owned, Missing, Wishlisted)
│       - Quick stats: completion %, elements owned, milestones
│
├── /app/collection
│   └── Detailed collection view
│       - Owned items grid with photos
│       - Filter by format and status
│       - Export collection data
│
├── /app/wishlist
│   └── Wishlist management (Enhanced in Phase 2)
│       - Prioritized list of wanted elements
│       - Context labels (Phase 2): Core, Exploration, Aspirational, Upgrade Target
│       - Auto-detection with manual override
│       - Filter by context and restock status
│       - Stock alerts configuration
│
├── /app/goals
│   └── Collection goals and milestones
│       - Progress tracking toward custom goals
│       - Milestone achievements (10%, 25%, 50%, 75%, 90%, 100%)
│       - Rarity achievements
│
├── /app/shop
│   └── Integrated shop experience
│       - Smart recommendations based on wishlist
│       - Hide owned elements
│       - Direct links to Shopify product pages
│
└── /app/profile
    └── User settings
        - Collection format preferences
        - Email notification preferences (Phase 2)
        - Export personal data
```

### User Routes (Phase 2 - New)
```
/app
├── /app/notifications
│   └── Notification Center (Phase 2 - New)
│       - In-app notification feed
│       - 5 notification types:
│         * Completion unlock (nearby elements now purchasable)
│         * Near-completion (90%+ in a category)
│         * Wishlist restock alerts
│         * High-relevance product arrivals
│         * Milestone celebrations
│       - Mark as read/unread
│       - Email delivery preferences
│       - Frequency limiting controls
│
└── [Element Notes Drawer]
    - Not a separate route - opens as drawer/modal from cabinet
    - Accessible from any element card
    - Fields: Acquisition date, source, price paid, condition, storage location, notes, private flag
```

### Admin Routes (Phase 2 - Simplified MVP)
```
/app/admin
├── /app/admin (Overview Dashboard)
│   └── Collection Intelligence Hub
│       - Key Stats Cards:
│         * Total Users
│         * Total Collections Tracked
│         * Avg Elements per User
│         * Active Users (last 7 days)
│       - Top 10 Most Collected Elements
│       - Top 10 Most Wanted Elements
│       - Recent Activity Feed (last 10 acquisitions across all users)
│
├── /app/admin/users
│   └── User Collections List
│       - Table view: User Name, Email, Elements Owned, Completion %, Last Activity
│       - Search by name/email
│       - Click row to view user's collection
│       - Export to CSV
│       - View individual user's cabinet (read-only)
│
└── /app/admin/demand
    └── Demand Insights Panel
        - Section 1: Out-of-Stock Watchlist
          * Table: SKU, Element, Waitlist Count, Days Out of Stock
          * Export for Restocking button
        - Section 2: High-Demand Items
          * Table: SKU, Element, Wishlist Count, Missing from X Collections
          * Sort by demand
          * Export to CSV
```

---

## Navigation Structure

### User Navigation (Top Bar)
```
┌─────────────────────────────────────────────────────────────┐
│ Luciteria                    🔔 Notifications    👤 Profile  │
├─────────────────────────────────────────────────────────────┤
│  Cabinet  │  Collection  │  Wishlist  │  Goals  │  Shop     │
└─────────────────────────────────────────────────────────────┘
```

### Admin Navigation (Top Bar)
```
┌─────────────────────────────────────────────────────────────┐
│ Luciteria Admin              [Back to Cabinet]   👤 Profile  │
├─────────────────────────────────────────────────────────────┤
│  Overview  │  User Collections  │  Demand Insights           │
└─────────────────────────────────────────────────────────────┘
```

---

## Route Access Control

| Route Pattern | Access Level | Notes |
|--------------|--------------|-------|
| `/` | Public | Landing page, authentication |
| `/app/*` (user routes) | Authenticated Users | Customer-facing features |
| `/app/admin/*` | Staff Only | Requires `isStaff: true` flag in user record |
| `/app/notifications` | Authenticated Users | Personal notification center |
| Element Notes Drawer | Authenticated Users | Opens from cabinet, collection views |

---

## Phase 2 Route Priority

### Must-Have (MVP)
1. `/app/admin` - Overview dashboard
2. `/app/admin/users` - User collections list
3. `/app/admin/demand` - Demand insights
4. `/app/notifications` - Notification center
5. Element Notes Drawer (UI component)
6. Enhanced `/app/wishlist` with context labels

### Nice-to-Have (Post-MVP)
- Bulk operations panel
- Advanced analytics dashboard
- Export scheduling
- Real-time activity stream

---

## Key Design Decisions

### 1. Admin Dashboard Simplification
- **Decision**: Single overview dashboard instead of multiple specialized views
- **Rationale**: MVP should focus on essential collection intelligence without overwhelming staff
- **Scope**: Basic stats, top lists, recent activity only
- **Deferred**: Complex automation triggers, sync panels, notification management UI

### 2. Element Notes as Drawer
- **Decision**: Notes open in drawer/modal, not separate route
- **Rationale**: Keeps user in context of their cabinet/collection view
- **Access**: Single tap from element card "Add Notes" button

### 3. Notification Center as Dedicated Route
- **Decision**: `/app/notifications` is a full page, not just a dropdown
- **Rationale**: Provides space for rich notification content, preferences, and history
- **Fallback**: Bell icon dropdown shows last 3 notifications with "View All" link

### 4. Wishlist Enhancement In-Place
- **Decision**: Add context labels to existing `/app/wishlist` route
- **Rationale**: Enhances existing feature without fragmenting navigation
- **UX**: Context labels are optional enhancement, don't break existing workflow

---

## Mobile Considerations

### Responsive Breakpoints
- **Desktop**: Full navigation, side-by-side layouts
- **Tablet**: Collapsible sidebar, stacked layouts
- **Mobile**: Bottom tab bar for user routes, hamburger menu for admin

### Mobile Navigation (User)
```
┌─────────────────────────────────────────┐
│         Luciteria Collector             │
│                                         │
│     [Main Content Area]                 │
│                                         │
└─────────────────────────────────────────┘
│ 🏠 Cabinet │ 📦 Collection │ ⭐ Wishlist │
│ 🎯 Goals   │ 🛍️ Shop       │ 🔔 Alerts   │
└─────────────────────────────────────────┘
```

---

## Integration Points

### Shopify Embedded App
- All routes render within Shopify admin iframe
- Uses Shopify App Bridge for navigation
- Session tokens for authentication

### Email Notifications
- Triggered from `/app/notifications` route logic
- Uses user email from Shopify customer record
- Preferences managed in notification center

### Data Export
- CSV export buttons on:
  * `/app/admin/users` - User collection data
  * `/app/admin/demand` - Restocking lists
  * `/app/collection` - Personal collection

---

## URL Structure Examples

### User Routes
```
https://your-shop.myshopify.com/apps/collector-cabinet/cabinet
https://your-shop.myshopify.com/apps/collector-cabinet/wishlist?context=core
https://your-shop.myshopify.com/apps/collector-cabinet/notifications
```

### Admin Routes
```
https://your-shop.myshopify.com/apps/collector-cabinet/admin
https://your-shop.myshopify.com/apps/collector-cabinet/admin/users?search=john
https://your-shop.myshopify.com/apps/collector-cabinet/admin/demand?sort=waitlist
```

---

## Summary

**Total Routes:**
- **Public**: 2 routes
- **Phase 1 User**: 6 routes
- **Phase 2 User**: 1 new route + 1 drawer component + enhancements to 1 existing route
- **Phase 2 Admin**: 3 routes (simplified MVP)

**Total Application**: 12 routes + 1 modal component

**Philosophy**: Clean, focused navigation that prioritizes collector experience while giving staff essential intelligence tools without complexity.
