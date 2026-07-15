# Collector Cabinet Onboarding Requirements

**Project:** Luciteria Collector Cabinet  
**Document Version:** 1.0  
**Last Updated:** May 26, 2026  
**Status:** Requirements Specification

---

## 1. Executive Summary

### 1.1 Purpose

The Collector Cabinet onboarding experience is designed to seamlessly introduce two distinct user types to a unified collection management platform:

1. **Cube of the Month Subscribers** – Customers with active element subscriptions who need to track ownership, manage formats, and ensure intelligent assignment of future shipments
2. **Independent Collectors** – Element enthusiasts who want to catalog their existing collections, track missing elements, and share wishlists with gift-givers

The onboarding flow must accomplish three critical objectives:
- **Identity Verification** – Authenticate users via Shopify customer accounts
- **Collection Initialization** – Gather existing ownership data to populate the collector dashboard
- **Subscription Detection** – Identify active subscribers and link them to subscription management features

### 1.2 Target Audiences

| Audience | Primary Goal | Key Pain Point | Success Metric |
|----------|--------------|----------------|----------------|
| **New Subscribers** | Prevent duplicate shipments | Manual communication with support | Zero duplicate shipments after onboarding |
| **Existing Subscribers** | Retroactively prevent duplicates | Already own elements in subscription queue | Collection data captured within 48 hours of launch |
| **Independent Collectors** | Organize and share collections | Spreadsheet chaos or no tracking | Wishlist shared with 1+ people |
| **Gift Buyers** | See recipient's wishlist | Guessing what they already own | View-only access to wishlist (Phase 2) |

### 1.3 Core Onboarding Flow

```
Entry Point → Shopify Auth → Welcome Screen → Collection Format Selection → 
Manual Collection Entry → Dashboard Preview → Subscription Detection (async) → 
Complete (Dashboard Access)
```

**Total Time Estimate:** 3-8 minutes depending on collection size  
**Critical Path:** Auth → Format Selection → Dashboard Access  
**Optional Path:** Collection Entry (can be skipped and completed later)

---

## 2. Prerequisites

### 2.1 Shopify Configuration Required Before Launch

#### A. Subscription Products Setup

**Product Structure:**
```
Product Type: Subscription
Billing Frequency: Monthly
```

| Product Name | SKU Pattern | Description | Price |
|--------------|-------------|-------------|-------|
| Cube of the Month (10mm) | SUB-10MM | Monthly 10mm element cube | TBD |
| Cube of the Month (25.4mm) | SUB-25MM | Monthly 25.4mm element cube | TBD |
| Cube of the Month (50mm) | SUB-50MM | Monthly 50mm element cube | TBD |
| Cube of the Month (Lucite Cubes) | SUB-LUCITE | Monthly Lucite cube element | TBD |
| Cube of the Month (Ampoules) | SUB-AMPOULE | Monthly ampoule element | TBD |

**Required Metadata Fields:**
- `collection_format` – Maps to CollectionFormat enum (TEN_MM, TWENTY_FIVE_MM, etc.)
- `subscription_type` – "cube_of_month"
- `auto_assignment_enabled` – true/false

**Implementation Note:** Product IDs must be added to `/app/config/shopify.js` after creation.

#### B. Customer Metafields Schema

```javascript
// Namespace: collector_cabinet
{
  "has_onboarded": "boolean",
  "onboarding_completed_at": "date_time",
  "collection_format_preference": "single_line_text_field",
  "wishlist_share_token": "single_line_text_field"
}
```

#### C. App Installation & Permissions

**Required Shopify Scopes:**
- `read_customers` – Authenticate users and read customer data
- `write_customers` – Store onboarding state in customer metafields
- `read_orders` – Verify past element purchases for collection pre-fill
- `read_products` – Access SKU mapping and subscription product details
- `read_subscriptions` / `write_subscriptions` – Detect and manage active subscriptions

#### D. Email Template Configuration

**Template ID Required:**
- **Wishlist Share Email** – Sent when user generates shareable wishlist link
- **Subscription Welcome Email** – Include Collector Cabinet CTA
- **Post-Purchase Email** – Include "Add to Collection" CTA

---

## 3. User Journeys

### 3.1 Journey A: New Cube of the Month Subscriber

**Persona:** Sarah, 34, science teacher  
**Context:** Just purchased 25.4mm subscription, receives welcome email

#### Timeline
1. **Day 0 (Purchase Day)**
   - Completes checkout for subscription
   - Receives order confirmation + separate welcome email
   - Welcome email contains: "Start Your Collector Cabinet" CTA button

2. **Day 0+30min (First App Access)**
   - Clicks CTA → Redirects to app with Shopify SSO
   - **Screen 1:** Welcome splash with video preview of dashboard
   - **Screen 2:** "Select Your Subscription Format" → Pre-selected to 25.4mm (detected from order)
   - **Screen 3:** "Do you already own any elements?" → Options: [Start Fresh] [I Have Some Elements]
   - Selects "Start Fresh" → Skips manual entry
   - **Screen 4:** Dashboard preview with animated walkthrough
   - Lands on empty dashboard with tooltips

3. **Background Process:**
   - System detects subscription via Shopify API (async, ~5min delay)
   - Updates user record with `subscription_status: ACTIVE`
   - Triggers assignment engine to queue first shipment
   - Sends confirmation: "Your first shipment will be [Element Name] on [Date]"

#### User Story
```
AS A new subscriber
I WANT TO see my upcoming shipment immediately after onboarding
SO THAT I know the system recognizes my subscription
AND I trust it won't send duplicates
```

---

### 3.2 Journey B: Existing Collector (No Subscription)

**Persona:** Michael, 52, engineer  
**Context:** Owns 30+ elements purchased over 5 years, finds app via product page banner

#### Timeline
1. **Discovery**
   - Browsing product page for Osmium cube
   - Sees banner: "Track Your Collection – Never Buy Duplicates"
   - Clicks → App opens with Shopify SSO

2. **Onboarding Flow**
   - **Screen 1:** Welcome – "Join 1,000+ Element Collectors"
   - **Screen 2:** "What format do you collect?" → Selects 25.4mm
   - **Screen 3:** "Let's add your existing collection"
     - Periodic table appears with all elements clickable
     - Clicks owned elements → They turn green with checkmark
     - Progress indicator: "12/118 elements marked"
   - **Screen 4:** "Want to create a wishlist?" → Explains sharing feature
     - Clicks 10 missing elements → They turn yellow with star icon
     - Generates shareable link: `luciteria.com/wishlist/a8f9e2c1`

3. **Post-Onboarding**
   - Dashboard shows:
     - 12 owned (green)
     - 10 wishlisted (yellow)
     - 96 missing (gray)
   - Shares wishlist link with spouse via email
   - Returns monthly to update collection as he buys more

#### User Story
```
AS AN independent collector
I WANT TO mark my existing elements quickly
SO THAT I can see what I'm missing at a glance
AND share my wishlist with gift-givers
```

---

### 3.3 Journey C: Subscriber with Existing Collection

**Persona:** Elena, 28, chemistry PhD student  
**Context:** Already owns 45 elements (mixed formats), just subscribed to 10mm format

#### Timeline
1. **Onboarding Entry**
   - Post-purchase email CTA → App opens
   - **Screen 2:** Format selection → Selects 10mm (matches subscription)
   - Warning appears: "We noticed you've purchased elements before. Import your order history?"

2. **Collection Pre-Fill (Optional)**
   - System scans past orders for element SKUs
   - Pre-populates 18 elements in 10mm format
   - **Screen 3:** "We found these in your order history" → Review table
     - User reviews and confirms 16, removes 2 (were gifts)

3. **Manual Addition**
   - **Screen 4:** "Add any elements from other sources"
   - Clicks 27 additional elements (bought from other vendors)
   - Total: 43 elements marked

4. **Assignment Preview**
   - System shows: "Based on your collection, your first shipment will be: **Scandium**"
   - Tooltips explain: "We skip elements you already own"

#### Edge Case Handling
- **Multi-format ownership:** User owns 50mm elements but subscribing to 10mm
  - System filters order history to only show 10mm SKUs
  - Prompts: "Want to track other formats too? (Coming in Phase 2)"

---

## 4. Onboarding Screens (Detailed Specifications)

### Screen 0: Entry Point Authentication

**Trigger:** User clicks any CTA leading to Collector Cabinet  
**Technical Flow:**
```
1. App receives request at /auth/login
2. Redirect to Shopify OAuth endpoint
3. Shopify authenticates customer
4. Callback to /auth/callback with customer token
5. App creates/loads user record
6. Check: has_onboarded === true?
   - YES → Redirect to /dashboard
   - NO → Continue to Screen 1
```

**Error Handling:**
- **Not Logged In:** Redirect to Shopify customer login page
- **Auth Failure:** Show error + retry button
- **No Customer Account:** Prompt to create Shopify account first

---

### Screen 1: Welcome Splash

**Visual Design:**
- Full-screen hero image: Periodic table with glowing owned elements
- Centered card overlay (max-width: 600px)

**Copy:**
```
Welcome to Your Collector Cabinet

Track your element collection, prevent duplicates, 
and share your wishlist with friends and family.

[Watch 30s Demo Video] [Get Started →]
```

**Video Content (Optional):**
- 0:00-0:10 – Dashboard pan showing colorful periodic table
- 0:10-0:20 – Closeup of clicking elements to mark ownership
- 0:20-0:30 – Sharing wishlist link via email

**Implementation Notes:**
- Video hosted on Shopify CDN or YouTube (unlisted)
- "Skip" option in top-right corner
- Progress indicator: "Step 1 of 4"

---

### Screen 2: Collection Format Selection

**Purpose:** Determine which SKU universe to filter (critical for subscribers)

**Layout:**
- Centered heading + 5 large cards (responsive grid)

**Copy:**
```
What format do you collect?

Each subscription focuses on one size. Choose the format 
you're collecting, and we'll show you relevant products.

[Card: 10mm Cubes]       [Image: Tiny cube]
[Card: 25.4mm Cubes]     [Image: Standard cube]  ← Selected by default if subscription detected
[Card: 50mm Cubes]       [Image: Large cube]
[Card: Lucite Cubes]     [Image: Acrylic block]
[Card: Ampoules]         [Image: Glass vial]

[Continue →]
```

**Interaction Logic:**
1. **Subscription Pre-Detection (If Available):**
   - If user has active subscription, pre-select matching format
   - Show banner: "We've selected 25.4mm based on your subscription"
   - Allow user to change if incorrect

2. **Multi-Format Collections (Phase 2):**
   - Show link: "Collect multiple formats? Contact us for beta access"

3. **Validation:**
   - Cannot proceed without selecting exactly 1 format
   - Selected card highlights with border + checkmark

**Database Update:**
- Save `collection_format` to User record
- Log event: `onboarding_format_selected`

---

### Screen 3: Existing Collection Entry

**Purpose:** Populate initial ownership data

**Layout:**
- Interactive periodic table (full-screen)
- Right sidebar with instructions + progress

**Copy (Sidebar):**
```
Add Your Existing Collection

Click any element you already own in [10mm] format.
Don't worry—you can always update this later.

Progress: 0/118 elements marked

[Mark All as Owned] ← Rare but useful
[Skip This Step]
[Continue →] ← Enabled after any selection OR skip
```

**Periodic Table Interaction:**
- **Idle State:** Gray tiles with element symbol + name
- **Hover State:** Tooltip shows element name + atomic number
- **Clicked (Owned):** Tile turns green, checkmark icon appears
- **Clicked Again (Undo):** Returns to gray

**Smart Features:**
1. **Bulk Selection (Optional):**
   - "Select by group" dropdown: Alkali Metals, Noble Gases, etc.
   - Click group → All elements in category toggle to owned

2. **Search Bar:**
   - Type "Gold" → Au tile highlights
   - Click → Marks as owned

3. **Order History Import (If Available):**
   - Button: "Import from Past Orders"
   - Modal shows table of detected purchases:
     ```
     | Element | Format | Order Date | Action |
     |---------|--------|------------|---------|
     | Iron    | 10mm   | 2024-03-12 | [✓ Add] |
     | Copper  | 10mm   | 2024-05-20 | [✓ Add] |
     ```
   - User can bulk-add or review individually

**Validation:**
- No minimum required (skip is allowed)
- Maximum: 118 elements (can't mark more than exist)

**Database Update:**
- Create `OwnedElement` records for each marked element
- Fields: `user_id`, `atomic_number`, `collection_format`, `acquisition_source: MANUAL_ENTRY`, `created_at`

---

### Screen 4: Wishlist Setup (Optional)

**Purpose:** Introduce wishlist feature and capture desired elements

**Trigger:** Only shown if user marked < 50 elements (assumes they have gaps to fill)

**Copy:**
```
Create Your Wishlist

Mark elements you'd love to receive as gifts. 
We'll generate a shareable link for friends and family.

[Same Periodic Table Interface]

Now showing:
- Green (✓) = Already Own
- Yellow (★) = Wishlist
- Gray = Not Tracked

[Skip Wishlist]
[Generate Shareable Link →]
```

**Interaction Logic:**
- Clicking owned (green) element does nothing
- Clicking gray element marks as wishlist (yellow)
- Clicking yellow element removes from wishlist (back to gray)
- "Generate Link" button appears after 1+ wishlist item

**Shareable Link Generation:**
1. User clicks "Generate Shareable Link"
2. System creates unique token: `UUID.v4()`
3. Stores in database:
   ```javascript
   {
     user_id: 123,
     share_token: "a8f9e2c1-b8d3-4f5e-9a1c-d2e3f4a5b6c7",
     expires_at: null, // Never expires in V1
     view_count: 0
   }
   ```
4. Displays modal with:
   ```
   Your Wishlist is Ready to Share!
   
   Copy this link and send it to anyone:
   https://luciteria.com/wishlist/a8f9e2c1
   
   [Copy Link] [Send via Email]
   
   They'll see your wishlist and can shop directly from it.
   ```

**Email Share Option:**
- Opens email client with pre-filled message:
  ```
  Subject: My Element Collection Wishlist
  
  Hi!
  
  I'm building a collection of the periodic table. Here's my wishlist
  of elements I'd love to receive:
  
  https://luciteria.com/wishlist/a8f9e2c1
  
  You can view what I already own and what I'm still looking for.
  
  Thanks!
  ```

**Implementation Notes:**
- Wishlist is view-only in V1 (no gift purchasing flow)
- Recipient sees public periodic table with legend
- Track `view_count` for analytics

---

### Screen 5: Completion & Dashboard Preview

**Purpose:** Celebrate completion and orient user to dashboard

**Layout:**
- Success animation (confetti or element cascade)
- Centered card with summary stats

**Copy:**
```
Your Collector Cabinet is Ready! 🎉

Collection Summary:
- [12] Elements Owned
- [8] Elements Wishlisted
- [98] Elements to Discover

[View Your Dashboard →]
```

**If Subscriber Detected (Async):**
- Additional panel appears:
  ```
  📦 Your Next Shipment
  
  Element: Scandium (Sc)
  Ships: June 15, 2026
  Format: 25.4mm Cube
  
  We automatically skip elements you own.
  [View Shipment Calendar]
  ```

**First-Time User Tooltips (On Dashboard):**
- Pointer to periodic table: "Click any element to update ownership"
- Pointer to filters: "Switch between Owned, Missing, or Wishlisted"
- Pointer to profile: "Manage your subscription here"

**Database Update:**
- Set `has_onboarded: true`
- Set `onboarding_completed_at: NOW()`
- Log event: `onboarding_completed`

---

## 5. Technical Requirements

### 5.1 Authentication & Session Management

**Flow:**
```javascript
// /app/routes/auth/login.js
export async function loader({ request }) {
  const shopDomain = getShopDomain(request);
  const redirectUri = `${APP_URL}/auth/callback`;
  
  return redirect(
    `https://${shopDomain}/admin/oauth/authorize?` +
    `client_id=${SHOPIFY_API_KEY}&` +
    `scope=${REQUIRED_SCOPES.join(',')}&` +
    `redirect_uri=${redirectUri}`
  );
}
```

**Session Storage:**
- Store encrypted session token in secure HTTP-only cookie
- Session duration: 30 days (refresh on activity)
- Customer ID stored in session for database queries

**Security:**
- CSRF protection via Shopify nonce validation
- No plaintext tokens in client-side storage
- Rate limiting: 10 auth attempts per IP per hour

---

### 5.2 Subscription Detection

**Challenge:** Subscription data may not be immediately available after purchase

**Solution: Async Detection with Polling**

```javascript
// /app/lib/subscription-detector.js
export async function detectSubscription(userId) {
  const customer = await getShopifyCustomer(userId);
  
  // Check for active subscription contracts
  const subscriptions = await shopify.subscriptionContracts.list({
    customer_id: customer.shopify_id
  });
  
  const activeSubscription = subscriptions.find(sub => 
    sub.status === 'ACTIVE' && 
    SUBSCRIPTION_PRODUCT_IDS.includes(sub.product_id)
  );
  
  if (activeSubscription) {
    // Extract format from product metadata
    const format = parseSubscriptionFormat(activeSubscription.product_id);
    
    await db.user.update({
      where: { id: userId },
      data: {
        subscription_status: 'ACTIVE',
        subscription_format: format,
        subscription_detected_at: new Date()
      }
    });
    
    // Trigger first assignment
    await assignmentEngine.queueNextShipment(userId);
    
    return true;
  }
  
  return false;
}
```

**Polling Strategy:**
- **Immediate:** Check on onboarding completion
- **Retry 1:** 5 minutes after onboarding
- **Retry 2:** 30 minutes after onboarding
- **Retry 3:** 24 hours after onboarding
- **Manual Trigger:** "Refresh Subscription Status" button in profile

**User Communication:**
- If not detected after 24 hours:
  ```
  We're still confirming your subscription.
  This usually takes a few minutes.
  
  [Refresh Status] [Contact Support]
  ```

---

### 5.3 Data Storage Schema

**Core Tables:**

```prisma
model User {
  id                    String   @id @default(uuid())
  shopifyCustomerId     String   @unique
  email                 String
  firstName             String?
  lastName              String?
  
  // Onboarding state
  hasOnboarded          Boolean  @default(false)
  onboardingCompletedAt DateTime?
  onboardingStep        Int      @default(0) // Track partial progress
  
  // Collection preferences
  collectionFormat      CollectionFormat?
  
  // Subscription data
  subscriptionStatus    SubscriptionStatus @default(NONE)
  subscriptionFormat    CollectionFormat?
  subscriptionDetectedAt DateTime?
  shopifySubscriptionId String?
  
  // Relationships
  ownedElements         OwnedElement[]
  wishlistItems         WishlistItem[]
  wishlistShare         WishlistShare?
  shipments             Shipment[]
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}

model OwnedElement {
  id                String   @id @default(uuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id])
  
  atomicNumber      Int
  collectionFormat  CollectionFormat
  acquisitionSource AcquisitionSource @default(MANUAL_ENTRY)
  acquiredAt        DateTime @default(now())
  
  // Optional: Link to original order
  shopifyOrderId    String?
  shopifyLineItemId String?
  
  @@unique([userId, atomicNumber, collectionFormat])
}

model WishlistItem {
  id           String   @id @default(uuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  atomicNumber Int
  priority     Int      @default(0) // For ranking (not used in V1)
  addedAt      DateTime @default(now())
  
  @@unique([userId, atomicNumber])
}

model WishlistShare {
  id         String   @id @default(uuid())
  userId     String   @unique
  user       User     @relation(fields: [userId], references: [id])
  shareToken String   @unique @default(uuid())
  viewCount  Int      @default(0)
  lastViewedAt DateTime?
  createdAt  DateTime @default(now())
}

model OnboardingEvent {
  id        String   @id @default(uuid())
  userId    String
  eventType String   // "format_selected", "collection_entry_started", etc.
  metadata  Json?
  createdAt DateTime @default(now())
  
  @@index([userId, createdAt])
}

enum AcquisitionSource {
  MANUAL_ENTRY
  SUBSCRIPTION_SHIPMENT
  ORDER_IMPORT
  PURCHASED
}

enum SubscriptionStatus {
  NONE
  ACTIVE
  PAUSED
  CANCELLED
}

enum CollectionFormat {
  TEN_MM
  TWENTY_FIVE_MM
  FIFTY_MM
  LUCITE_CUBES
  AMPOULES
}
```

---

### 5.4 Performance Requirements

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Auth Redirect** | < 2 seconds | Time from CTA click to welcome screen |
| **Periodic Table Render** | < 500ms | Initial paint of 118 elements |
| **Element Toggle** | < 50ms | Click to visual feedback |
| **Onboarding Completion** | < 1 second | Final screen load + DB write |
| **Subscription Detection** | < 5 minutes | 95% detected within 5min of purchase |

**Optimization Strategies:**
- Periodic table: SVG sprite sheet (single HTTP request)
- Database: Batch insert owned elements (not 1 query per element)
- CDN: Static assets served from Shopify CDN
- Caching: User session data cached in Redis (if available)

---

## 6. Entry Points

### 6.1 Primary Entry Points

#### A. Post-Purchase Email (Subscribers Only)

**Trigger:** Order confirmed with subscription product  
**Email Template:**

```
Subject: Welcome to Cube of the Month! 🧪

Hi [First Name],

Thanks for subscribing! Your first element ships on [Date].

To make sure we never send you duplicates, set up your 
Collector Cabinet:

[Start Your Collector Cabinet →]

This takes 2 minutes and helps us customize your shipments.

Questions? Reply to this email.

The Luciteria Team
```

**CTA Link:** `https://luciteria.com/apps/collector-cabinet?source=welcome_email`

**Implementation:**
- Shopify Flow automation or custom webhook
- Trigger: `orders/create` with subscription line item
- Template stored in Shopify Email or external ESP

---

#### B. Shopify Customer Account Menu

**Location:** Customer account dashboard navigation

**Menu Item:**
```
My Account
├─ Order History
├─ Subscriptions
├─ Collector Cabinet  ← NEW
└─ Account Details
```

**Implementation:**
```liquid
<!-- theme.liquid -->
<nav class="customer-account-menu">
  <a href="/apps/collector-cabinet">
    <svg><!-- Periodic table icon --></svg>
    Collector Cabinet
    {% if customer.metafields.collector_cabinet.has_onboarded == false %}
      <span class="badge">New</span>
    {% endif %}
  </a>
</nav>
```

---

#### C. Product Page Banner (Independent Collectors)

**Placement:** Above "Add to Cart" button on all element product pages

**Banner Copy:**
```
[Icon] Already collecting? Track your collection to avoid duplicates.
[Set Up Collector Cabinet →]
```

**Conditional Display:**
- Show only if customer is NOT a subscriber
- Hide after user completes onboarding
- A/B test: Show vs. don't show impact on conversions

**Implementation:**
```liquid
<!-- product-template.liquid -->
{% unless customer.metafields.collector_cabinet.has_onboarded %}
  <div class="collector-cabinet-banner">
    <p>Already collecting? Track your collection to avoid duplicates.</p>
    <a href="/apps/collector-cabinet?source=product_page">Set Up Cabinet</a>
  </div>
{% endunless %}
```

---

#### D. Website Navigation (Global)

**Location:** Main site header (desktop) or hamburger menu (mobile)

**Placement:**
```
[Logo]  Shop  |  Subscriptions  |  Collector Cabinet  |  About  [Cart] [Account]
                                  ^^^^^^^^^^^^^^^^^^^^^
```

**Visibility:**
- Show for all logged-in customers
- Show "Login to Access" for guest visitors

---

#### E. Subscription Confirmation Page

**Placement:** Thank-you page after completing subscription checkout

**Hero Section:**
```
🎉 You're Subscribed!

Order #12345 confirmed. Your first cube ships June 15.

Next Step: Set up your Collector Cabinet to prevent duplicates.

[Set Up Now →]  [I'll Do This Later]
```

**Technical Implementation:**
```liquid
<!-- checkout-thank-you.liquid -->
{% if order.line_items contains 'subscription' %}
  <div class="collector-cabinet-cta">
    <h2>Set Up Your Collector Cabinet</h2>
    <p>Tell us what you already own—takes 2 minutes.</p>
    <a href="/apps/collector-cabinet?source=checkout_thankyou&order={{ order.id }}">
      Set Up Now
    </a>
  </div>
{% endif %}
```

---

### 6.2 Entry Point Tracking

**URL Parameters:**
All entry point links include `?source=` parameter for analytics

| Source Value | Description |
|--------------|-------------|
| `welcome_email` | Post-purchase subscriber email |
| `account_menu` | Customer account dashboard |
| `product_page` | Banner on element product pages |
| `main_nav` | Website header/navigation |
| `checkout_thankyou` | Post-subscription confirmation page |
| `support_link` | Customer support directed user |

**Database Logging:**
```javascript
// On app entry
await db.onboardingEvent.create({
  data: {
    userId: user.id,
    eventType: 'onboarding_entry',
    metadata: {
      source: request.query.source,
      referrer: request.headers.referer,
      timestamp: new Date()
    }
  }
});
```

**Analytics Dashboard (Admin):**
- "Top Entry Points" chart
- Conversion rate by source
- Time-to-onboard by source

---

## 7. Feature Access Matrix

### 7.1 Core Principle: No Feature Paywalls

**Philosophy:** All users (subscribers and independent collectors) have access to the same core features. The distinction is in **automated workflows**, not **manual capabilities**.

| Feature | Subscribers | Independent Collectors | Notes |
|---------|-------------|------------------------|-------|
| **View Dashboard** | ✅ Full Access | ✅ Full Access | Both see 118-element periodic table |
| **Mark Owned Elements** | ✅ Unlimited | ✅ Unlimited | No caps or restrictions |
| **Create Wishlist** | ✅ Unlimited | ✅ Unlimited | Same sharing capabilities |
| **Share Wishlist Link** | ✅ Generate Link | ✅ Generate Link | Public view for recipients |
| **Track Multiple Formats** | ⚠️ Phase 2 | ⚠️ Phase 2 | V1: One format per user |
| **Auto-Assignment** | ✅ **EXCLUSIVE** | ❌ N/A | System queues monthly shipments |
| **Shipment Calendar** | ✅ View Upcoming | ❌ N/A | See 12 months of assignments |
| **Skip/Swap Shipments** | ⚠️ Phase 2 | ❌ N/A | Manual override of assignments |
| **Subscription Management** | ✅ Pause/Cancel | ❌ N/A | Links to Shopify subscription portal |
| **Order History Import** | ✅ Available | ✅ Available | Both can scan past orders |
| **Manual Collection Entry** | ✅ Via Dashboard | ✅ Via Dashboard | Identical UI |
| **CSV Export** | ✅ Download Data | ✅ Download Data | Export owned/wishlist |

---

### 7.2 Subscriber-Exclusive Features (Automated Workflows)

#### A. Auto-Assignment Engine

**What It Does:**
- Scans owned elements to prevent duplicates
- Respects wishlist priority (Phase 2)
- Excludes out-of-stock items (sequence shifting)
- Excludes precious metals (manual approval required)
- Generates monthly shipment queue

**User Experience:**
```
[Dashboard Panel]
📦 Your Next Shipments

June 2026: Scandium (Sc) - Ships June 15
July 2026: Yttrium (Y) - Ships July 15
August 2026: Pending Assignment
```

**Access Control:**
```javascript
// Only show if user.subscriptionStatus === 'ACTIVE'
{user.subscriptionStatus === 'ACTIVE' && (
  <ShipmentCalendar userId={user.id} />
)}
```

---

#### B. Duplicate Prevention Alerts

**What It Does:**
- If user manually marks an element as owned that was already assigned
- Show warning: "Scandium was scheduled for your next shipment. We'll skip it."
- Auto-reassign next element

**Implementation:**
```javascript
async function markElementOwned(userId, atomicNumber) {
  // Check if element is in upcoming shipment queue
  const upcomingShipment = await db.shipment.findFirst({
    where: {
      userId,
      atomicNumber,
      status: 'ASSIGNED',
      shipDate: { gte: new Date() }
    }
  });
  
  if (upcomingShipment) {
    // Trigger reassignment
    await assignmentEngine.reassignShipment(upcomingShipment.id);
    
    // Show user notification
    return {
      success: true,
      message: `${elementName} was in your queue. We've updated your shipments.`
    };
  }
}
```

---

### 7.3 Independent Collector Experience

**Key Point:** Non-subscribers see the exact same dashboard UI, but without subscription-related panels.

**What They See:**
- Periodic table with owned/wishlist/missing states
- Collection statistics (12 owned, 8 wishlisted, 98 missing)
- Wishlist sharing link
- "Upgrade to Subscription" CTA (soft sell)

**What They DON'T See:**
- Shipment calendar
- "Next shipment" panel
- Subscription management settings

**Upgrade CTA Placement:**
```
[Dashboard - Bottom of Sidebar]

🚀 Want monthly surprises?

Subscribe to Cube of the Month and get a new element
every month—automatically skipping ones you own.

[Explore Subscriptions →]
```

**Conversion Tracking:**
- Track clicks on "Explore Subscriptions" CTA
- Attribute subscription purchases to Collector Cabinet if within 7 days

---

## 8. Wishlist Implementation

### 8.1 Feature Overview

**Purpose:** Enable collectors to share desired elements with friends and family for gift-giving

**Key Clarification:** Wishlist does NOT influence subscription shipment selection in V1. It is purely for sharing with external gift-givers.

---

### 8.2 User Flow: Creating a Wishlist

**Step 1: Mark Wishlist Items**

From dashboard:
- User clicks any gray (missing) element
- Dropdown appears:
  ```
  [+ Mark as Owned]
  [★ Add to Wishlist]
  ```
- Selecting "Add to Wishlist" turns element yellow with star icon

**Step 2: Generate Share Link**

- User clicks "Share Wishlist" button in sidebar
- Modal appears:
  ```
  Share Your Wishlist
  
  [Generate Shareable Link]
  
  Anyone with this link can view your wishlist.
  They'll see which elements you already own (so they 
  don't buy duplicates) and which you're hoping for.
  ```
- Clicking "Generate" creates unique URL:
  ```
  https://luciteria.com/wishlist/a8f9e2c1
  ```

**Step 3: Share Options**

```
Your Wishlist Link is Ready!

https://luciteria.com/wishlist/a8f9e2c1

[Copy Link]  [Send via Email]  [Download PDF]
```

- **Copy Link:** Copies to clipboard with toast notification
- **Send via Email:** Opens default email client with template
- **Download PDF:** Generates printable wishlist (Phase 2)

---

### 8.3 Public Wishlist View (Recipient Experience)

**URL Structure:** `/wishlist/:shareToken`

**Layout:**
- Public-facing page (no login required)
- Header: "[Collector Name]'s Element Wishlist"
- Periodic table with three states:
  - **Green (✓):** Already owned (don't buy)
  - **Yellow (★):** Wishlist items
  - **Gray:** Not tracked

**Copy:**
```
Michael's Element Collection

Owned: 12 elements
Wishlist: 8 elements

Click any yellow element to shop for it on Luciteria.com
```

**Interaction:**
- Clicking a yellow (wishlist) element → Redirects to product page
  - URL: `/products/scandium-10mm-cube?ref=wishlist_a8f9e2c1`
  - Tracks conversions via `ref` parameter

**Privacy Considerations:**
- No personal information shown (just first name)
- No email address or account details
- No subscription status visible
- Cannot edit collection (view-only)

---

### 8.4 Wishlist Synchronization

**Challenge:** Recipient buys element as gift → Collector receives it → Needs to mark as owned → Wishlist should update for other potential gift-givers

**Solution: Real-Time Updates**

```javascript
// When collector marks element as owned
async function markElementOwned(userId, atomicNumber) {
  await db.ownedElement.create({ userId, atomicNumber });
  
  // Remove from wishlist if present
  await db.wishlistItem.deleteMany({
    where: { userId, atomicNumber }
  });
  
  // Trigger WebSocket broadcast (if using real-time)
  websocket.broadcast(`wishlist:${user.wishlistShare.shareToken}`, {
    action: 'element_acquired',
    atomicNumber
  });
}
```

**User Experience:**
- Recipient viewing wishlist sees element disappear from yellow list
- Toast notification: "This element was just added to their collection"

---

### 8.5 Edge Cases

#### Case 1: Wishlist Link Shared Before Generation

**Scenario:** User marks wishlist items but never clicks "Generate Link"

**Behavior:**
- Wishlist exists in database but no `shareToken` created
- "Share Wishlist" button visible in dashboard
- Clicking generates token retroactively

---

#### Case 2: User Deletes All Wishlist Items

**Scenario:** User removes all yellow stars → Wishlist is empty

**Behavior:**
- Share link remains valid but shows:
  ```
  Michael's wishlist is currently empty.
  Check back later!
  ```

---

#### Case 3: User Marks Entire Periodic Table as Owned

**Scenario:** User owns all 118 elements

**Behavior:**
- Wishlist automatically disabled
- Dashboard shows: "Collection Complete! 🎉"
- Share link shows:
  ```
  Michael has completed the entire periodic table!
  Consider a gift card instead.
  
  [Shop Luciteria Gift Cards →]
  ```

---

#### Case 4: Non-Customer Views Wishlist

**Scenario:** Recipient doesn't have a Luciteria account

**Behavior:**
- Can view wishlist without login
- Clicking element → Redirected to product page
- Product page shows normal guest checkout flow
- Attribution tracked via `?ref=wishlist_token`

---

## 9. Edge Cases & Error Handling

### 9.1 Subscription-Related Edge Cases

#### Edge Case 1: Subscription Cancelled Mid-Onboarding

**Scenario:**
1. User purchases subscription
2. Starts onboarding
3. Cancels subscription before completing onboarding
4. Completes onboarding later

**Expected Behavior:**
- User can complete onboarding (keep collection data)
- No shipment calendar shown
- Dashboard shows:
  ```
  Your subscription was cancelled.
  Your collection data is safe—you can still track manually.
  
  [Resubscribe] [Continue as Independent Collector]
  ```

**Implementation:**
```javascript
// Check subscription status on every dashboard load
const activeSubscription = await getActiveSubscription(userId);
if (!activeSubscription && user.subscriptionStatus === 'ACTIVE') {
  await db.user.update({
    where: { id: userId },
    data: { subscriptionStatus: 'CANCELLED' }
  });
}
```

---

#### Edge Case 2: User Subscribes After Completing Onboarding

**Scenario:**
1. User onboards as independent collector
2. Weeks later, subscribes to Cube of the Month

**Expected Behavior:**
- Subscription detected via polling (async)
- Dashboard auto-updates to show shipment calendar
- First shipment assigned based on existing owned elements
- Welcome message:
  ```
  Welcome to Cube of the Month!
  
  We've analyzed your collection (12 elements owned) and 
  assigned your first shipment: Scandium (June 15).
  
  [View Shipment Calendar →]
  ```

**Implementation:**
- Webhook listener for `subscription_contracts/create`
- Triggers subscription detection + assignment engine
- Sends in-app notification

---

#### Edge Case 3: User Changes Subscription Format

**Scenario:**
1. User subscribes to 10mm format
2. Onboards and marks 20 owned 10mm elements
3. Cancels 10mm subscription and subscribes to 25.4mm

**Expected Behavior (V1 Limitation):**
- User must re-onboard for new format
- Dashboard shows warning:
  ```
  You've switched to a new format (25.4mm).
  Please update your collection for this format.
  
  [Start Collection Entry for 25.4mm →]
  ```
- Owned 10mm elements remain in database but hidden
- Fresh start for 25.4mm format

**Phase 2 Solution:**
- Multi-format tracking
- User can toggle between formats in dashboard

---

### 9.2 Authentication Edge Cases

#### Edge Case 4: User Not Logged Into Shopify

**Scenario:** User clicks CTA but no active Shopify session

**Expected Behavior:**
1. Redirect to Shopify customer login page
2. After login, redirect back to Collector Cabinet with onboarding flow intact
3. Preserve `?source=` parameter for analytics

**Implementation:**
```javascript
// Store intended destination in session
export async function loader({ request }) {
  const session = await getSession(request);
  if (!session.customerId) {
    // Store return URL
    session.set('returnTo', request.url);
    
    return redirect('/auth/login');
  }
}
```

---

#### Edge Case 5: User Has No Shopify Customer Account

**Scenario:** First-time visitor clicks Collector Cabinet CTA

**Expected Behavior:**
- Redirect to Shopify account creation page
- After account creation, redirect to onboarding
- Show welcome message:
  ```
  Welcome to Luciteria!
  
  You've created your account. Now let's set up your
  Collector Cabinet.
  ```

---

### 9.3 Data Integrity Edge Cases

#### Edge Case 6: User Marks Element Twice (Duplicate Entry)

**Scenario:** Bug or race condition causes same element marked twice

**Prevention:**
- Database unique constraint: `@@unique([userId, atomicNumber, collectionFormat])`
- Graceful error handling:
  ```javascript
  try {
    await db.ownedElement.create({ userId, atomicNumber });
  } catch (error) {
    if (error.code === 'P2002') { // Prisma unique constraint error
      return { success: true, message: 'Already in your collection' };
    }
    throw error;
  }
  ```

---

#### Edge Case 7: User Tries to Wishlist Owned Element

**Scenario:** User accidentally clicks "Add to Wishlist" on green (owned) element

**Prevention:**
- UI: Disable wishlist option for owned elements
- Backend validation:
  ```javascript
  const alreadyOwned = await db.ownedElement.findUnique({
    where: { userId_atomicNumber: { userId, atomicNumber } }
  });
  
  if (alreadyOwned) {
    return { error: 'You already own this element' };
  }
  ```

---

#### Edge Case 8: User Marks All 118 Elements on First Login

**Scenario:** Suspicious activity or bot

**Detection + Handling:**
- Track onboarding duration
- If < 30 seconds and 100+ elements marked:
  ```
  Whoa, that was fast!
  
  Can you confirm you own all these elements?
  This helps us prevent errors.
  
  [Yes, I Own Them All] [Let Me Review]
  ```
- Log event for admin review

---

### 9.4 Wishlist Edge Cases

#### Edge Case 9: Recipient Buys Element, But Collector Doesn't Update

**Scenario:**
1. Grandma views wishlist, buys Scandium
2. Collector receives Scandium but doesn't mark as owned
3. Grandpa views wishlist, also buys Scandium

**Mitigation (Phase 2):**
- Email collector after gift purchase:
  ```
  Did you receive [Element Name]?
  
  [Yes, Mark as Owned] [Not Yet]
  ```
- Track purchase attribution via `?ref=wishlist_token`
- Temporarily gray out element on wishlist for 7 days

**V1 Behavior:**
- No automatic updates
- Relies on collector manually updating

---

#### Edge Case 10: User Generates Multiple Share Links

**Scenario:** User clicks "Generate Link" multiple times

**Expected Behavior:**
- First click: Creates `shareToken`
- Subsequent clicks: Returns same token (doesn't create new)
- Implementation:
  ```javascript
  async function getOrCreateShareToken(userId) {
    let share = await db.wishlistShare.findUnique({ where: { userId } });
    
    if (!share) {
      share = await db.wishlistShare.create({
        data: { userId, shareToken: uuid() }
      });
    }
    
    return share.shareToken;
  }
  ```

---

### 9.5 Performance Edge Cases

#### Edge Case 11: Slow Shopify API Response

**Scenario:** Subscription detection API call times out (>10 seconds)

**Handling:**
- Show loading state with progress message:
  ```
  Checking for subscription...
  This is taking longer than usual.
  
  [Continue Without Waiting] [Keep Waiting]
  ```
- If user clicks "Continue Without Waiting":
  - Complete onboarding without subscription data
  - Retry detection in background (polling)

---

#### Edge Case 12: User Abandons Onboarding Mid-Flow

**Scenario:** User completes Screen 2, then closes browser

**Recovery:**
- Store `onboardingStep` in database
- Next login:
  ```
  Welcome back!
  
  You started setting up your Collector Cabinet.
  Want to pick up where you left off?
  
  [Continue Setup] [Start Over]
  ```
- If "Continue": Jump to last completed step
- If "Start Over": Reset `onboardingStep` to 0

**Implementation:**
```javascript
// Save progress after each screen
async function saveOnboardingProgress(userId, step) {
  await db.user.update({
    where: { id: userId },
    data: { onboardingStep: step }
  });
}
```

---

## 10. Success Metrics

### 10.1 Primary KPIs

| Metric | Target | Measurement Window | Tracking Method |
|--------|--------|-------------------|-----------------|
| **Onboarding Completion Rate** | >80% | 30 days post-launch | % of users who reach Screen 5 |
| **Time to Complete** | <5 minutes | Per session | Median duration (entry → completion) |
| **Collection Data Capture** | >50% | Within 48 hours of signup | % of users who mark ≥1 element |
| **Subscription Detection Success** | >95% | Within 5 minutes | % detected without manual intervention |
| **Wishlist Generation Rate** | >40% | 7 days post-onboarding | % who create shareable link |
| **Duplicate Shipment Prevention** | 100% | Ongoing | Zero duplicates sent to onboarded users |

---

### 10.2 Onboarding Funnel Analysis

**Funnel Stages:**
```
1. Entry (CTA Click) → 100% baseline
2. Auth Success → Target: 95%
3. Format Selection → Target: 90%
4. Collection Entry Started → Target: 75%
5. Onboarding Completed → Target: 80%
```

**Drop-Off Analysis:**
- Track where users abandon
- Heatmaps on each screen
- Exit survey for users who close app during onboarding:
  ```
  Quick Question: Why are you leaving?
  
  [ ] Too long / confusing
  [ ] Don't have time now
  [ ] Not interested anymore
  [ ] Technical issue
  [ ] Other: _______
  ```

---

### 10.3 Engagement Metrics (Post-Onboarding)

| Metric | Target | Purpose |
|--------|--------|---------|
| **Return Visit Rate** | >60% within 7 days | Measures stickiness |
| **Collection Update Frequency** | >2 updates/month | Shows active usage |
| **Wishlist Share CTR** | >25% | Measures sharing feature adoption |
| **Wishlist View Count** | >3 views/link | Validates sharing value |
| **Subscription Upgrade Rate** | >10% | Independent collectors → subscribers |

---

### 10.4 Subscriber-Specific Metrics

| Metric | Target | Purpose |
|--------|--------|---------|
| **Subscription Detection Time** | <5 min (median) | Measures API performance |
| **First Assignment Accuracy** | 100% | No duplicates in first shipment |
| **Manual Override Requests** | <5% | Low = assignment engine works well |
| **Subscription Retention** | +15% vs. non-Cabinet users | Impact on churn |

**Hypothesis:** Subscribers who complete onboarding have higher retention because they trust the duplicate prevention system.

---

### 10.5 Entry Point Performance

**Track Conversion by Source:**

| Entry Point | Expected Traffic | Expected Conversion | Tracking URL |
|-------------|------------------|---------------------|--------------|
| Welcome Email | High (100% of new subs) | 70% | `?source=welcome_email` |
| Account Menu | Medium | 40% | `?source=account_menu` |
| Product Page Banner | High (all product views) | 5% | `?source=product_page` |
| Main Navigation | Low | 20% | `?source=main_nav` |
| Checkout Thank-You | High (100% of subs) | 60% | `?source=checkout_thankyou` |

**Optimization:**
- A/B test email copy for welcome email
- Test banner placement on product pages (top vs. bottom)
- Experiment with urgency ("Set up in 2 minutes" vs. "Prevent duplicates")

---

### 10.6 Technical Performance Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| **Page Load Time** | <2s (p95) | >3s |
| **API Response Time** | <500ms (p95) | >1s |
| **Error Rate** | <0.5% | >2% |
| **Auth Failure Rate** | <2% | >5% |
| **Database Query Time** | <100ms (p95) | >500ms |

---

### 10.7 Business Impact Metrics

**Revenue Attribution:**
- Track subscription purchases within 7 days of onboarding
- Track product purchases via wishlist referrals (`?ref=wishlist_token`)

**Customer Support Impact:**
- Measure ticket volume for "I already own this element" (expect 80% reduction)
- Track time saved by support team (fewer manual collection audits)

**Lifetime Value (LTV):**
- Compare LTV of onboarded vs. non-onboarded subscribers
- Hypothesis: Onboarded users stay 3+ months longer

---

### 10.8 Dashboard & Reporting

**Admin Analytics View:**

```
Onboarding Overview (Last 30 Days)

Total Starts: 1,247
Completed: 1,038 (83.2%) ✅
Avg. Time: 4m 32s

Funnel Breakdown:
━━━━━━━━━━ 100% Entry (1,247)
━━━━━━━━━░  95% Auth Success (1,185)
━━━━━━━━░░  88% Format Selected (1,097)
━━━━━━░░░░  75% Collection Entry (935)
━━━━━━━░░░  83% Completed (1,038)

Top Entry Points:
1. Welcome Email - 612 completions (59%)
2. Checkout Thank-You - 298 (29%)
3. Account Menu - 94 (9%)

Subscription Detection:
- <1 min: 72%
- <5 min: 94%
- <30 min: 98%
- >24 hours: 2% (Needs Review)

Collection Stats:
- Avg. elements marked: 8.3
- Wishlist created: 42%
- Wishlist shared: 31%
```

---

## 11. Implementation Phases

### Phase 1: MVP (Weeks 1-4)

**Scope:**
- ✅ Shopify authentication
- ✅ Screens 1-5 (basic onboarding)
- ✅ Manual collection entry
- ✅ Subscription detection (async)
- ✅ Single-format tracking
- ✅ Basic wishlist generation
- ✅ Entry points: Welcome email + account menu

**Launch Criteria:**
- 100 beta testers complete onboarding
- <2% error rate
- Subscription detection >90%

---

### Phase 2: Enhancements (Weeks 5-8)

**Scope:**
- ✅ Order history import (pre-fill owned elements)
- ✅ Multi-format tracking
- ✅ Wishlist PDF export
- ✅ Entry points: Product page banners
- ✅ Advanced analytics dashboard
- ✅ A/B testing framework

---

### Phase 3: Automation (Weeks 9-12)

**Scope:**
- ✅ Real-time subscription detection (webhooks)
- ✅ Wishlist purchase attribution
- ✅ Email notifications for collection updates
- ✅ Mobile-optimized UI
- ✅ Bulk element selection (by group)

---

### Phase 4: Advanced Features (Future)

**Scope:**
- Collection photography (upload images of owned elements)
- Social sharing (public profiles)
- Collection value tracking (resale market prices)
- Trade/swap marketplace
- Gamification (badges, completion rewards)

---

## 12. Open Questions & Decisions Needed

### 12.1 Pricing & Business Model

**Question:** Should independent collectors pay for Collector Cabinet access?

**Options:**
- **Free for All:** Drives adoption, converts to subscribers
- **Freemium:** Free basic tracking, $5/month for wishlist sharing + advanced features
- **Subscriber-Only:** Only available to active subscribers (limits growth)

**Recommendation:** Free for all (drives subscription conversions via "upgrade" CTAs)

---

### 12.2 Data Ownership & Portability

**Question:** What happens to collection data if user cancels subscription?

**Options:**
- **Retain Forever:** Data persists, user can return anytime
- **30-Day Grace Period:** Delete after 30 days of inactivity
- **Export Required:** User must download CSV before cancellation

**Recommendation:** Retain forever (increases re-subscription likelihood)

---

### 12.3 Social Features

**Question:** Should users be able to see other collectors' profiles?

**Considerations:**
- **Pro:** Community building, engagement
- **Con:** Privacy concerns, competition
- **Middle Ground:** Opt-in public profiles

**Recommendation:** Phase 4 feature with opt-in

---

### 12.4 Mobile App vs. Web App

**Question:** Should we build a native mobile app?

**Analysis:**
| Approach | Pros | Cons |
|----------|------|------|
| **Web-Only** | No app store approval, easier updates | Less engagement |
| **PWA** | Installable, offline support | Limited native features |
| **Native App** | Best UX, push notifications | High development cost |

**Recommendation:** Start with responsive web app (PWA in Phase 3)

---

### 12.5 Inventory Integration

**Question:** Should onboarding show real-time stock availability?

**Scenario:** User marks 100 elements as missing, but 20 are out of stock

**Options:**
- **Show All Elements:** User can wishlist out-of-stock items (frustrating if never available)
- **Hide Out-of-Stock:** Only show available elements (limits wishlist value)
- **Show with Badges:** Display "Out of Stock" label (transparent but cluttered)

**Recommendation:** Show all, but add "Notify Me" button for out-of-stock wishlist items

---

## 13. Appendix

### A. Glossary

| Term | Definition |
|------|------------|
| **Collector Cabinet** | Web app for tracking element collections |
| **Cube of the Month** | Monthly element subscription service |
| **Onboarding** | First-time user setup flow |
| **Collection Format** | Size/type of element (10mm, 25.4mm, etc.) |
| **Owned Element** | Element user has physically received |
| **Wishlist Item** | Element user wants to receive as gift |
| **Assignment Engine** | Algorithm that selects next shipment |
| **Subscription Detection** | Process of linking Shopify subscription to user |
| **Share Token** | Unique URL identifier for wishlist sharing |

---

### B. Referenced Documents

- `PROJECT_SUMMARY.md` – Overall project architecture
- `ASSIGNMENT_LOGIC.md` – Shipment selection algorithm details
- `SHOPIFY_INTEGRATION_GUIDE.md` – Technical integration steps
- `DEVELOPER_INTEGRATION_CHECKLIST.md` – Pre-launch validation

---

### C. User Research Insights

**Findings from 25 beta tester interviews:**

1. **"I don't trust automated systems with my collection"**
   - **Solution:** Show preview of first 3 shipments during onboarding
   
2. **"I collect multiple formats—this forces me to choose one"**
   - **Solution:** Phase 2 multi-format support
   
3. **"Marking 50+ elements manually is tedious"**
   - **Solution:** Order history import + bulk selection by group
   
4. **"I want my family to see what I already own, not just my wishlist"**
   - **Solution:** Wishlist view shows green (owned) + yellow (wished)
   
5. **"What if I mark an element by mistake?"**
   - **Solution:** Easy undo on dashboard (click owned element → "Remove from Collection")

---

### D. Design Mockup Links

*(To be created by design team)*

- Figma: Onboarding Flow Screens 1-5
- Figma: Wishlist Public View
- Figma: Dashboard First-Time Tooltips
- Video: 30-second Demo for Welcome Screen

---

### E. Technical Dependencies

**Third-Party Services:**
- **Shopify API** – Customer auth, subscription data
- **SendGrid/Klaviyo** – Email automation (welcome emails)
- **Sentry** – Error tracking
- **Google Analytics** – Funnel analysis
- **Mixpanel/Amplitude** – Event tracking (optional)

**Internal Systems:**
- **SKU Mapping Database** – Maps atomic numbers to product IDs
- **Assignment Engine** – Separate service/module for shipment logic
- **Admin Dashboard** – Staff interface for monitoring

---

## 14. Approval & Sign-Off

**Document Prepared By:** Abacus AI Agent  
**Reviewed By:** *(Pending)*  
**Approved By:** *(Pending)*  
**Approval Date:** *(Pending)*  

**Next Steps:**
1. Review and approve requirements
2. Design mockups for Screens 1-5
3. Set up Shopify subscription products
4. Begin Phase 1 development
5. Recruit 100 beta testers

---

**End of Document**
