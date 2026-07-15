# Wishlist Context Wireframes

## Overview
Wishlist Context adds semantic labels to wishlisted elements, helping collectors prioritize purchases based on intent. Four context types capture different collecting motivations: Core (foundation-building), Exploration (curiosity-driven), Aspirational (rare/valuable targets), and Upgrade Target (replacement/improvement).

---

## Context Types

### 1. Core
**Definition**: Essential elements for foundation-building  
**Typical Use**: Common, affordable elements needed to reach key milestones  
**Auto-Detection Criteria**:
- Element is in a category where user has <50% completion
- Element is priced <$50
- Element has >70% global ownership (common element)

**Examples**: Carbon, Copper, Iron, Aluminum

---

### 2. Exploration
**Definition**: Curiosity-driven additions  
**Typical Use**: Interesting but not critical elements  
**Auto-Detection Criteria**:
- Element is in a category where user has 50-90% completion
- Element is priced $20-$100
- Element has 30-70% global ownership

**Examples**: Bismuth, Gallium, Selenium, Tellurium

---

### 3. Aspirational
**Definition**: Rare, valuable, or difficult-to-acquire elements  
**Typical Use**: Long-term goals, "dream" elements  
**Auto-Detection Criteria**:
- Element is priced >$100
- Element has <20% global ownership (rare)
- Element is in Precious Metals or Rare Earth categories

**Examples**: Rhodium, Osmium, Iridium, Gold

---

### 4. Upgrade Target
**Definition**: Replacement or improvement of already-owned element  
**Typical Use**: Larger format, better condition, different form  
**Auto-Detection Criteria**:
- User already owns this element in a different format
- New format is larger (e.g., user owns 10mm, wants 50mm)
- New format is more valuable (e.g., user owns ampoule, wants Lucite cube)

**Examples**: User owns Iron 10mm, wants Iron 50mm cube

---

## UI Wireframes

### A. Enhanced Wishlist View

**Route**: `/app/wishlist`

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│ My Wishlist                                                         [Add Element ▼] │
├────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                    │
│ 📌 23 elements on your wishlist                                                    │
│                                                                                    │
│ Filter by Context:  [All] [Core] [Exploration] [Aspirational] [Upgrade Target]    │
│                                                                                    │
│ ┌────────────────────────────────────────────────────────────────────────────────┐│
│ │                                                                                ││
│ │ CORE (8 elements)                                               [Collapse ▲]   ││
│ │ Foundation-building essentials                                                 ││
│ │                                                                                ││
│ │ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      ││
│ │ │   Zinc (Zn)  │  │ Silicon (Si) │  │ Sulfur (S)   │  │ Nickel (Ni)  │      ││
│ │ │              │  │              │  │              │  │              │      ││
│ │ │ 🟢 Core      │  │ 🟢 Core      │  │ 🟢 Core      │  │ 🟢 Core      │      ││
│ │ │ $28.99       │  │ $32.50       │  │ $19.99       │  │ $38.00       │      ││
│ │ │ ✅ In Stock  │  │ ✅ In Stock  │  │ ⚠️ Low Stock │  │ ✅ In Stock  │      ││
│ │ │              │  │              │  │              │  │              │      ││
│ │ │ [Edit Label] │  │ [Edit Label] │  │ [Edit Label] │  │ [Edit Label] │      ││
│ │ │ [View]       │  │ [View]       │  │ [View]       │  │ [View]       │      ││
│ │ └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘      ││
│ │                                                                                ││
│ │ [+4 more...]                                                                   ││
│ │                                                                                ││
│ └────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                    │
│ ┌────────────────────────────────────────────────────────────────────────────────┐│
│ │                                                                                ││
│ │ EXPLORATION (7 elements)                                        [Collapse ▲]   ││
│ │ Curiosity-driven additions                                                     ││
│ │                                                                                ││
│ │ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                         ││
│ │ │ Gallium (Ga) │  │ Bismuth (Bi) │  │ Selenium(Se) │                         ││
│ │ │              │  │              │  │              │                         ││
│ │ │ 🔵 Explore   │  │ 🔵 Explore   │  │ 🔵 Explore   │                         ││
│ │ │ $49.99       │  │ $52.50       │  │ $44.99       │                         ││
│ │ │ ⚠️ Out Stock │  │ ✅ In Stock  │  │ ⚠️ Out Stock │                         ││
│ │ │              │  │              │  │              │                         ││
│ │ │ [Edit Label] │  │ [Edit Label] │  │ [Edit Label] │                         ││
│ │ │ [Notify Me]  │  │ [View]       │  │ [Notify Me]  │                         ││
│ │ └──────────────┘  └──────────────┘  └──────────────┘                         ││
│ │                                                                                ││
│ │ [+4 more...]                                                                   ││
│ │                                                                                ││
│ └────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                    │
│ ┌────────────────────────────────────────────────────────────────────────────────┐│
│ │                                                                                ││
│ │ ASPIRATIONAL (5 elements)                                       [Collapse ▲]   ││
│ │ Long-term goals and rare finds                                                 ││
│ │                                                                                ││
│ │ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                         ││
│ │ │ Rhodium (Rh) │  │ Osmium (Os)  │  │ Iridium (Ir) │                         ││
│ │ │              │  │              │  │              │                         ││
│ │ │ ⭐ Aspire    │  │ ⭐ Aspire    │  │ ⭐ Aspire    │                         ││
│ │ │ $847.00      │  │ $1,249.99    │  │ $923.50      │                         ││
│ │ │ ⚠️ Out Stock │  │ ⚠️ Out Stock │  │ ✅ In Stock  │                         ││
│ │ │              │  │              │  │              │                         ││
│ │ │ [Edit Label] │  │ [Edit Label] │  │ [Edit Label] │                         ││
│ │ │ [Notify Me]  │  │ [Notify Me]  │  │ [View]       │                         ││
│ │ └──────────────┘  └──────────────┘  └──────────────┘                         ││
│ │                                                                                ││
│ │ [+2 more...]                                                                   ││
│ │                                                                                ││
│ └────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                    │
│ ┌────────────────────────────────────────────────────────────────────────────────┐│
│ │                                                                                ││
│ │ UPGRADE TARGET (3 elements)                                     [Collapse ▲]   ││
│ │ Improving existing collection items                                            ││
│ │                                                                                ││
│ │ ┌──────────────┐  ┌──────────────┐                                            ││
│ │ │ Iron (Fe)    │  │ Copper (Cu)  │                                            ││
│ │ │ 50mm cube    │  │ Lucite cube  │                                            ││
│ │ │ 🔄 Upgrade   │  │ 🔄 Upgrade   │                                            ││
│ │ │ $67.50       │  │ $58.99       │                                            ││
│ │ │ ✅ In Stock  │  │ ✅ In Stock  │                                            ││
│ │ │              │  │              │                                            ││
│ │ │ You own: 10mm│  │ You own: 25mm│                                            ││
│ │ │              │  │              │                                            ││
│ │ │ [Edit Label] │  │ [Edit Label] │                                            ││
│ │ │ [View]       │  │ [View]       │                                            ││
│ │ └──────────────┘  └──────────────┘                                            ││
│ │                                                                                ││
│ │ [+1 more...]                                                                   ││
│ │                                                                                ││
│ └────────────────────────────────────────────────────────────────────────────────┘│
│                                                                                    │
└────────────────────────────────────────────────────────────────────────────────────┘
```

**Key Features**:
- Wishlist items grouped by context type
- Collapsible sections
- Visual badges with distinct colors per context
- Stock status indicators
- "Edit Label" button for manual override
- "Upgrade Target" shows what user already owns

---

### B. Context Label Assignment Modal

**Trigger**: Click "Edit Label" on any wishlist item

```
┌──────────────────────────────────────────────────────┐
│ Assign Context for Gallium (Ga)           [✕ Close]  │
├──────────────────────────────────────────────────────┤
│                                                      │
│ Why do you want this element?                        │
│                                                      │
│ ┌────────────────────────────────────────────────┐  │
│ │ ⚪ Core                                         │  │
│ │    Foundation-building essentials              │  │
│ │    → Common elements needed for milestones     │  │
│ └────────────────────────────────────────────────┘  │
│                                                      │
│ ┌────────────────────────────────────────────────┐  │
│ │ 🔵 Exploration (Recommended)                   │  │
│ │    Curiosity-driven additions                  │  │
│ │    → Interesting but not critical              │  │
│ └────────────────────────────────────────────────┘  │
│                                                      │
│ ┌────────────────────────────────────────────────┐  │
│ │ ⚪ Aspirational                                 │  │
│ │    Long-term goals and rare finds              │  │
│ │    → High-value or hard-to-acquire elements    │  │
│ └────────────────────────────────────────────────┘  │
│                                                      │
│ ┌────────────────────────────────────────────────┐  │
│ │ ⚪ Upgrade Target                               │  │
│ │    Improving existing items                    │  │
│ │    → You don't own Ga yet, so this doesn't fit│  │
│ │      (grayed out, cannot select)               │  │
│ └────────────────────────────────────────────────┘  │
│                                                      │
│ 💡 We recommended "Exploration" based on:           │
│    • You're 68% complete in Post-Transition Metals  │
│    • Gallium is priced at $49.99 (mid-range)        │
│    • 42% of collectors own this element             │
│                                                      │
│                              [Cancel] [Save Label]   │
└──────────────────────────────────────────────────────┘
```

**Key Features**:
- Radio button selection (single choice)
- Recommended option highlighted
- Explanation for recommendation
- Invalid options grayed out with explanation
- Descriptive subtitles for each context type

---

### C. Auto-Detection Prompt (First-Time Wishlist Add)

**Trigger**: User adds first element to wishlist (or first 5 elements)

```
┌──────────────────────────────────────────────────────┐
│ 🎯 Set Your Wishlist Priorities                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│ We've added Zinc (Zn) to your wishlist!             │
│                                                      │
│ To help you prioritize purchases, we can             │
│ automatically label your wishlist items:             │
│                                                      │
│ 🟢 Core - Foundation-building essentials            │
│ 🔵 Exploration - Curiosity-driven additions         │
│ ⭐ Aspirational - Long-term goals                   │
│ 🔄 Upgrade Target - Improving owned items           │
│                                                      │
│ Based on your collection and this element's          │
│ price/rarity, we suggest:                            │
│                                                      │
│ ┌────────────────────────────────────────────────┐  │
│ │ 🟢 Core                                         │  │
│ │ Zinc is a common, affordable element needed    │  │
│ │ to build your foundation collection.           │  │
│ └────────────────────────────────────────────────┘  │
│                                                      │
│ ☑ Auto-assign context labels to future wishlist     │
│    items (you can change them anytime)              │
│                                                      │
│              [Skip] [Use Core] [Choose Different]   │
└──────────────────────────────────────────────────────┘
```

**Options**:
- **Skip**: Don't assign a label, just add to wishlist
- **Use Core**: Accept the recommendation
- **Choose Different**: Opens full context selection modal

**Auto-assign checkbox**: If checked, future wishlist additions get auto-labeled (with option to edit)

---

### D. Filter by Context (Compact View)

**Filter Bar** (at top of wishlist):

```
┌────────────────────────────────────────────────────────────────────┐
│ Filter by Context:                                                 │
│ ┌─────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐ ┌──────────┐  │
│ │ All │ │ 🟢 Core (8)│ │🔵 Explore  │ │⭐ Aspire │ │🔄 Upgrade│  │
│ │     │ │            │ │    (7)     │ │   (5)    │ │   (3)    │  │
│ └─────┘ └────────────┘ └────────────┘ └──────────┘ └──────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

**Interaction**:
- Click a context chip → filters wishlist to show only that context
- Shows count in parentheses
- "All" chip selected by default
- Active chip has blue border/background

**Filtered View** (e.g., Core selected):

```
┌────────────────────────────────────────────────────────────────────┐
│ Filter by Context:                                                 │
│ ┌─────┐ ┌────────────┐ ┌──────────┐ ┌────────┐ ┌────────┐        │
│ │ All │ │ 🟢 Core (8)│ │ Explore  │ │ Aspire │ │Upgrade │        │
│ └─────┘ └────────────┘ └──────────┘ └────────┘ └────────┘        │
│         ▲ Active                                                   │
└────────────────────────────────────────────────────────────────────┘

Showing 8 Core elements
  
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Zinc (Zn)  │  │ Silicon (Si) │  │ Sulfur (S)   │  │ Nickel (Ni)  │
│              │  │              │  │              │  │              │
│ 🟢 Core      │  │ 🟢 Core      │  │ 🟢 Core      │  │ 🟢 Core      │
│ $28.99       │  │ $32.50       │  │ $19.99       │  │ $38.00       │
│ [View]       │  │ [View]       │  │ [View]       │  │ [View]       │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

---

### E. Mobile Wishlist with Context Labels

```
┌─────────────────────────────────────┐
│ ← Back        My Wishlist      [+]  │
├─────────────────────────────────────┤
│                                     │
│ 📌 23 elements on your wishlist     │
│                                     │
│ Filter: [All ▼]                     │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 🟢 Core                         │ │
│ │                                 │ │
│ │ Zinc (Zn)                  $29  │ │
│ │ ✅ In Stock              [View] │ │
│ │                                 │ │
│ │ Silicon (Si)            $32.50  │ │
│ │ ✅ In Stock              [View] │ │
│ │                                 │ │
│ │ Sulfur (S)                 $20  │ │
│ │ ⚠️ Low Stock            [View] │ │
│ │                                 │ │
│ │ [+5 more...]                    │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 🔵 Exploration                  │ │
│ │                                 │ │
│ │ Gallium (Ga)            $49.99  │ │
│ │ ⚠️ Out of Stock      [Notify]  │ │
│ │                                 │ │
│ │ Bismuth (Bi)            $52.50  │ │
│ │ ✅ In Stock              [View] │ │
│ │                                 │ │
│ │ [+5 more...]                    │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Load More]                         │
│                                     │
└─────────────────────────────────────┘
```

**Mobile Optimizations**:
- Simplified card layout (no photos, just text)
- Larger touch targets
- Dropdown filter instead of chip buttons
- Collapsible sections by default

---

## Auto-Detection Logic

### Detection Flow

```
User adds Element X to wishlist
   │
   ├─ Get user's collection stats
   │  • Total completion %
   │  • Category completion %
   │  • Owned formats for this element
   │
   ├─ Get element metadata
   │  • Price
   │  • Global ownership %
   │  • Category
   │  • Rarity score
   │
   ├─ Run context detection algorithm
   │
   ├─ Determine context:
   │
   │  ┌─ IF user owns element in different format
   │  │  └─ Context = UPGRADE_TARGET ✓
   │  │
   │  ├─ ELSE IF price > $100 OR global ownership < 20%
   │  │  └─ Context = ASPIRATIONAL ✓
   │  │
   │  ├─ ELSE IF category completion 50-90%
   │  │  └─ Context = EXPLORATION ✓
   │  │
   │  └─ ELSE (category completion < 50% AND common)
   │     └─ Context = CORE ✓
   │
   ├─ Show context label on wishlist item
   │
   └─ Store context in WishlistItem.contextLabel field
```

### Algorithm Pseudocode

```javascript
function detectWishlistContext(userId, elementSymbol, productId) {
  // Check if user owns this element in a different format
  const ownedFormats = await getUserOwnedFormats(userId, elementSymbol);
  const thisProductFormat = await getProductFormat(productId);
  
  if (ownedFormats.length > 0 && !ownedFormats.includes(thisProductFormat)) {
    return {
      context: 'UPGRADE_TARGET',
      reason: `You own ${elementSymbol} in ${ownedFormats[0]} format`
    };
  }
  
  // Get element and product metadata
  const product = await getProduct(productId);
  const element = await getElement(elementSymbol);
  const globalOwnership = await getGlobalOwnershipPercent(elementSymbol);
  
  // Check if aspirational (rare or expensive)
  if (product.price > 100 || globalOwnership < 20 || element.category === 'Precious Metals') {
    return {
      context: 'ASPIRATIONAL',
      reason: `High value or rare element (${globalOwnership}% ownership)`
    };
  }
  
  // Check category completion
  const categoryCompletion = await getCategoryCompletion(userId, element.category);
  
  // If category is well-developed, it's exploration
  if (categoryCompletion >= 50 && categoryCompletion < 90) {
    return {
      context: 'EXPLORATION',
      reason: `You're ${categoryCompletion}% complete in ${element.category}`
    };
  }
  
  // Default: Core (foundation-building)
  return {
    context: 'CORE',
    reason: `Common element for building your ${element.category} collection`
  };
}
```

---

## Context Override Flow

### User Manual Override

```
User clicks "Edit Label" on Zinc (currently labeled "Core")
   │
   ├─ Context selection modal opens
   │  • Core (currently selected)
   │  • Exploration
   │  • Aspirational
   │  • Upgrade Target (grayed out - user doesn't own Zn yet)
   │
   ├─ User selects "Aspirational"
   │
   ├─ System updates WishlistItem.contextLabel = 'ASPIRATIONAL'
   │
   ├─ System sets WishlistItem.contextOverridden = true
   │
   ├─ Zinc now appears in "Aspirational" section
   │
   └─ Future auto-detection won't change this label (respects user override)
```

**Key Point**: Once user manually overrides, system never auto-changes it again

---

## Database Schema

### Updated WishlistItem Model

```prisma
model CollectionItem {
  id                String              @id @default(cuid())
  userId            String
  elementSymbol     String
  state             CollectionItemState // 'owned' | 'wishlist' | 'watchlist' | 'missing'
  
  // NEW FIELDS FOR CONTEXT
  contextLabel      WishlistContext?
  contextOverridden Boolean             @default(false)
  contextReason     String?             // Auto-detection explanation
  
  priority          Int?                @default(0)
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
  
  user              User                @relation(fields: [userId], references: [id])
  element           Element             @relation(fields: [elementSymbol], references: [symbol])
}

enum WishlistContext {
  CORE
  EXPLORATION
  ASPIRATIONAL
  UPGRADE_TARGET
}
```

**Field Descriptions**:
- `contextLabel`: The assigned context (null if none)
- `contextOverridden`: True if user manually changed it (prevents auto-updates)
- `contextReason`: Explanation text shown to user (e.g., "You're 68% complete in Post-Transition Metals")

---

## Admin View Enhancement

### Admin Demand Insights: Context Breakdown

**Location**: `/app/admin/demand` (existing route)

**New Section**: Context Distribution

```
┌────────────────────────────────────────────────────────────────────┐
│ 📊 Wishlist Context Distribution                                   │
│                                                                    │
│ Understanding collector intent across all wishlists                │
│                                                                    │
│ ┌──────────────────────────────────────────────────────────────┐  │
│ │ Context Breakdown (All Collectors)                           │  │
│ ├──────────────────┬───────────────┬────────────────┬──────────┤  │
│ │ Context          │ Total Items   │ Avg per User   │ %        │  │
│ ├──────────────────┼───────────────┼────────────────┼──────────┤  │
│ │ 🟢 Core          │    1,876      │      7.6       │  42.3%   │  │
│ │ 🔵 Exploration   │    1,542      │      6.2       │  34.7%   │  │
│ │ ⭐ Aspirational  │      789      │      3.2       │  17.8%   │  │
│ │ 🔄 Upgrade       │      234      │      0.9       │   5.2%   │  │
│ └──────────────────┴───────────────┴────────────────┴──────────┘  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│ 🔥 Most Wanted by Context                                          │
│                                                                    │
│ ┌──────────────────────────────────────────────────────────────┐  │
│ │ CORE Elements (Top 5)                                        │  │
│ ├──────────────────┬───────────────┬────────────────┬──────────┤  │
│ │ Element          │ Wishlist Cnt  │ In Stock?      │ Price    │  │
│ ├──────────────────┼───────────────┼────────────────┼──────────┤  │
│ │ Zinc (Zn)        │      187      │ ✅ Yes (45)    │  $28.99  │  │
│ │ Silicon (Si)     │      176      │ ✅ Yes (32)    │  $32.50  │  │
│ │ Sulfur (S)       │      164      │ ⚠️ Low (8)     │  $19.99  │  │
│ │ Nickel (Ni)      │      152      │ ✅ Yes (28)    │  $38.00  │  │
│ │ Titanium (Ti)    │      147      │ ✅ Yes (51)    │  $45.50  │  │
│ └──────────────────┴───────────────┴────────────────┴──────────┘  │
│                                                                    │
│ ┌──────────────────────────────────────────────────────────────┐  │
│ │ ASPIRATIONAL Elements (Top 5)                                │  │
│ ├──────────────────┬───────────────┬────────────────┬──────────┤  │
│ │ Element          │ Wishlist Cnt  │ In Stock?      │ Price    │  │
│ ├──────────────────┼───────────────┼────────────────┼──────────┤  │
│ │ Rhodium (Rh)     │       89      │ ⚠️ No          │  $847    │  │
│ │ Osmium (Os)      │       76      │ ⚠️ No          │ $1,250   │  │
│ │ Iridium (Ir)     │       68      │ ✅ Yes (2)     │  $924    │  │
│ │ Platinum (Pt)    │       63      │ ✅ Yes (5)     │  $672    │  │
│ │ Palladium (Pd)   │       58      │ ⚠️ No          │  $589    │  │
│ └──────────────────┴───────────────┴────────────────┴──────────┘  │
│                                                                    │
│ [Export Context Analysis]                                          │
└────────────────────────────────────────────────────────────────────┘
```

**Insights for Staff**:
- See which context types are most common
- Identify high-demand items per context (helps prioritize restocking)
- Understand collector intent (e.g., if 42% are "Core", focus on affordable essentials)

---

## User Benefits

### 1. Prioritization
- Quick glance at wishlist shows what's essential vs. aspirational
- Filter by context to focus shopping budget

### 2. Budget Planning
- "Core" items are affordable foundation-builders
- "Aspirational" items are saved for special occasions
- "Exploration" items are flexible curiosity purchases

### 3. Collection Strategy
- See at a glance how many "Core" items are left to reach milestone
- Track upgrade targets separately
- Celebrate when aspirational items come in stock

---

## Success Metrics

### For Users
- **Wishlist clarity**: Users can articulate why each element is on wishlist
- **Purchase decisions**: Faster decision-making when shopping
- **Engagement**: More frequent wishlist check-ins

### For Business
- **Conversion rate**: Higher conversion on in-stock wishlist items
- **Average order value**: Core + Exploration bundling
- **Restock prioritization**: Focus on high-demand context types

---

## Future Enhancements (Post-MVP)

### Phase 3+ Features
1. **Smart Sort**: Sort wishlist by context + stock status + price
2. **Budget Planner**: "Shop Core items for <$200"
3. **Bundle Suggestions**: "Complete your Core collection - 5 items for $120"
4. **Notification Priority**: Notify sooner for Core restocks, later for Aspirational
5. **Goal Tracking**: "3 more Core items to reach 50% completion"

---

## Design System

### Context Color Palette

| Context | Color | Badge | Emoji |
|---------|-------|-------|-------|
| Core | #48BB78 (green) | 🟢 | 🎯 |
| Exploration | #4299E1 (blue) | 🔵 | 🔬 |
| Aspirational | #F6AD55 (gold) | ⭐ | 💎 |
| Upgrade Target | #9F7AEA (purple) | 🔄 | ⬆️ |

### Typography
- **Context Label**: 12px, bold, uppercase, colored by context
- **Context Description**: 14px, gray, regular weight

---

## Summary

**Purpose**: Add semantic meaning to wishlist items  
**Context Types**: 4 (Core, Exploration, Aspirational, Upgrade Target)  
**Auto-Detection**: Smart labeling based on collection state + price + rarity  
**Override**: User can manually change any label  
**Benefits**: Better prioritization, budget planning, collection strategy

**Philosophy**: Not all wishlist items are equal. Context helps collectors focus their budget and energy on what matters most right now.
