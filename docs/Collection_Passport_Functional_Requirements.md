# Collection Passport — Functional Requirements

**Project:** LuciteriaCabinet  
**Feature:** Collection Passport (Viral Growth Feature — Option 1)  
**Status:** Draft v1.0  
**Date:** July 2026

---

## 1. Overview

The **Collection Passport** is a shareable, public-facing profile page that allows every LuciteriaCabinet account holder to showcase their element collection to the world. It functions as both a personal collector identity card and a discovery mechanism for new users — acting as the primary organic growth surface for the platform.

Each Passport is unique to one account. It is manually published by the collector, can be shared via a permanent URL, and generates rich link preview cards for social media and messaging apps. It is designed to surface the collector's pride in their collection while gently directing curious visitors to `cabinet.luciteria.com` to start their own.

---

## 2. Goals

- Give collectors a shareable identity that reflects their collection achievement.
- Create a low-friction sharing loop: one link, shared in collector communities, Discord, Reddit, Instagram, etc.
- Drive new account registrations through visible social proof.
- Surface the Passport naturally within existing app flows (wishlist, cabinet) so it is not an isolated feature.

---

## 3. Summary of Key Decisions

| # | Topic | Decision |
|---|-------|----------|
| 1 | Passports per account | One per account |
| 2 | Who can create | Every account holder |
| 3 | Display name | Auto-generated from account data |
| 4 | Publishing | Manual — user must explicitly publish |
| 5 | Profile page | Required; dedicated edit page |
| 6 | Avatar scope | Account-level (not Passport-specific) |
| 7 | Avatar upload | JPG, PNG, WebP only; max 2 MB |
| 8 | Default avatar | Luciteria branded default for users without one |
| 9 | Featured elements | Up to 5, user-selected; catalog images + text/no-image option |
| 10 | Stats basis | Owned items only (not wishlist) |
| 11 | Wishlist integration | Bidirectional — Passport ↔ Wishlist, no duplicate entry |
| 12 | Publicly shown items | Collector chooses, capped at 5 |
| 13 | Public page items | Owned elements only |
| 14 | Share card content | Collector avatar + collection progress + one featured element image |
| 15 | Link preview | Open Graph cards (og:title, og:description, og:image) |
| 16 | Public page CTA | "Start your own cabinet" → `cabinet.luciteria.com` |
| 17 | Public page footer | Links to `cabinet.luciteria.com` |

---

## 4. Pages & Routes

### 4.1 Profile Setup & Edit Page
**Route:** `/app/cabinet/profile`  
**Access:** Authenticated users only  
**Purpose:** The collector configures all account-level identity fields used across the Passport and (where applicable) the wishlist share page.

This page is a **prerequisite** for publishing a Passport. If a user navigates to the Passport management page without a completed profile, they are prompted to set one up first.

**Fields on this page:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Collector Handle | Text | Yes | Auto-generated slug on account creation (e.g. `@ironmike_92`). User can edit. Must be globally unique, lowercase, alphanumeric + hyphens only. Used in the public URL. |
| Display Name | Text | Yes | Auto-populated from account first name + last initial (e.g. "Michael T."). User can override. Max 40 characters. |
| Avatar | Image upload | No | JPG, PNG, or WebP. Max 2 MB. Stored at account level. If not set, the default Luciteria avatar is used everywhere. |
| Bio | Textarea | No | Short collector biography. Max 280 characters. Shown on the public Passport. |
| Location | Text | No | Free-text city/country (e.g. "Bristol, UK"). Max 60 characters. |
| Favourite Element | Element selector | No | Single element from the periodic table. Shown as a badge on the Passport. |
| Collection Motivation | Select (existing onboarding values) | No | Pre-populated from onboarding (`primaryMotivation`). User can update. Options: Inventory, Social, Acquisition, Investment, Discovery. |

**Avatar upload behaviour:**
- Upload UI shows current avatar (or Luciteria default) with a "Change" button.
- Client-side validation: format (JPG/PNG/WebP) and file size (≤ 2 MB) before upload.
- On submit, avatar is stored server-side (path recorded on the `User` model).
- Successful upload immediately replaces the current preview; no page reload required.
- A "Remove avatar" option resets to the Luciteria default.

**Save behaviour:**
- Saving the profile does not publish the Passport. These are separate actions.
- Validation errors are shown inline per field.
- A success toast is shown on save.

---

### 4.2 Passport Management Page (Private)
**Route:** `/app/cabinet/passport`  
**Access:** Authenticated users only  
**Purpose:** The collector's private workspace for building and managing their Passport before and after publishing.

**Page sections:**

#### 4.2.1 Passport Status Banner
- Shows current state: **Draft** (not yet published) or **Published** (live at public URL).
- If Draft: primary CTA is "Publish Passport". Secondary link: "Preview how it will look".
- If Published: shows the public URL with a copy-to-clipboard button and a "Share" button (see §6). A "Unpublish" option is also available.

#### 4.2.2 Profile Summary Card
- Displays avatar, display name, handle, and bio in a read-only preview matching how it will appear publicly.
- "Edit Profile" button links to `/app/cabinet/profile`.

#### 4.2.3 Featured Collection Elements
- A panel showing up to 5 selected elements.
- Each slot shows: element image (from catalog), element name, atomic number, format owned.
- Empty slots show a "+" placeholder card prompting selection.
- "Manage featured elements" opens an in-page modal or drawer (see §5.2).

#### 4.2.4 Collection Stats Preview
- Shows the stats exactly as they will appear publicly (see §5.3).

#### 4.2.5 Passport URL
- Auto-generated once the handle is set: `cabinet.luciteria.com/p/{handle}` (or similar public subdomain pattern — engineering to confirm URL structure).
- Shown even before publishing so the user knows their URL in advance.

---

### 4.3 Public Passport Page
**Route:** `/p/:handle` (or `/passport/:handle` — engineering to confirm)  
**Access:** Unauthenticated (public). No login required to view.  
**Purpose:** The shareable page visitors land on after receiving a Passport link.

**Page layout (top to bottom):**

1. **Header / Hero**
   - Collector avatar (or Luciteria default)
   - Display name
   - Collector handle (`@handle`)
   - Bio (if set)
   - Location + Favourite Element badge (if set)
   - Collection Motivation tag (if set)
   - Passport publication date ("Collector since [month year]" derived from account creation date)

2. **Collection Stats Bar**
   - Total elements owned
   - Periodic table completion percentage
   - Number of complete sets (see §5.3 for definition)
   - Format(s) collected (icons/badges)

3. **Featured Elements Grid**
   - Up to 5 featured element cards
   - Each card: catalog element image (or "no image" text card), element name, atomic number, format
   - View-only — no interaction for visitors

4. **Call to Action**
   - A section at the bottom of the page, clearly separated
   - Heading: "Build your own cabinet"
   - Body: short line about what LuciteriaCabinet is
   - Button: "Get Started" → `cabinet.luciteria.com`
   - Luciteria logo / wordmark

5. **Footer**
   - Minimal — link to `cabinet.luciteria.com`
   - Privacy policy link

**Public page behaviour:**
- If the handle does not exist or the Passport is not published, return a 404-style "This Passport hasn't been published yet" page — not a generic error. The page still shows the Luciteria CTA.
- No login wall. Visitors can see everything with no account required.
- Fully responsive (mobile-first — most shares will be opened on mobile).

---

## 5. Core Feature Specifications

### 5.1 Profile Fields & Display Name Generation

**Auto-generated display name logic (on account creation):**
1. If `user.firstName` is set: use `{firstName} {lastNameInitial}.` → e.g. "Sarah K."
2. If only email is available: derive from email prefix, capitalise, strip numbers → e.g. "irongiant99@…" → "Irongiant"
3. User can override at any time on the Profile page.

**Auto-generated handle logic (on account creation):**
1. Start from `{firstName}{lastNameInitial}` or email prefix.
2. Lowercase, strip special characters, append a short random suffix if a collision exists.
3. Example: `sarahk`, `sarahk_42`
4. User can edit their handle once. After the Passport is published, changing the handle invalidates the old URL — the user must be warned before saving a handle change post-publish.

---

### 5.2 Featured Collection Elements

**Selection rules:**
- Collector selects up to 5 elements from their **owned** collection only.
- No wishlist items may appear as featured elements.
- Each element slot can be:
  - An element with a catalog image (preferred)
  - An element with no image — displayed as a styled text card showing element symbol and name
- If the collector owns fewer than 5 elements, all owned elements can be selected (fewer than 5 slots is valid).

**Selection modal / drawer (within `/app/cabinet/passport`):**
- Shows a searchable, filterable grid of the collector's owned elements.
- Each element card shows: catalog image (if available), element name, symbol, atomic number, format.
- Already-selected elements are highlighted with a checkmark.
- Selecting beyond 5 is blocked; the UI shows "5 / 5 selected" and disables further selection.
- Deselecting removes the element from the featured list, freeing a slot.
- Order of featured elements can be rearranged via drag-and-drop (or up/down controls on mobile).
- Changes are saved immediately (optimistic update) or via an explicit "Save" button — engineering to confirm.

**Display on public page:**
- Elements appear in the order the collector arranged them.
- Catalog images are pulled from the existing `Product` / element catalog data.
- If no catalog image exists for an element, the "no-image text card" is automatically used — no broken images.

---

### 5.3 Collection Stats

Stats are calculated from **owned elements only** (not wishlist). All stats are read-only on both the private and public pages — not editable.

| Stat | Definition | Display Label |
|------|-----------|---------------|
| Total Owned | Count of distinct elements the collector owns (across all formats) | "X elements owned" |
| Periodic Table Completion | (Distinct owned elements / 118) × 100, rounded to 1 decimal | "X% complete" |
| Sets Completed | Count of `CollectionSet` records where the collector owns all `CollectionSetElement` entries | "X sets completed" |
| Formats Collected | Distinct formats owned by the collector | Shown as format icons/badges |

**Stats recalculation:** Stats shown on the Passport are calculated at page-load time (server-rendered), not cached separately. No separate sync job is required for v1.

---

### 5.4 Wishlist ↔ Passport Integration

The Passport and Wishlist are designed to share the same underlying element data without requiring the collector to manage items in two places.

**Bidirectional flow:**

#### Adding from Wishlist → Passport (Featured)
- On the wishlist page (`/app/cabinet/wishlist`), each wishlist item that the user owns (i.e., has since been acquired) will have a "Feature on Passport" option alongside existing wishlist actions.
- Selecting it opens the Featured Element selection flow (pre-selecting that element).

#### Adding from Passport → Wishlist
- On the Passport management page, when browsing the element selection modal, any element the collector owns can also be added to the wishlist at the same time via a secondary action (e.g., a bookmark/wishlist icon on the element card within the modal).
- This is non-destructive — it adds the element to the wishlist without removing it from the featured selection.

#### Wishlist items surfaced in Passport context
- On the Featured Element selection modal, elements that are also on the wishlist are visually tagged (e.g., a small wishlist icon badge) so the collector knows the overlap.
- No automatic syncing — the collector remains in control of both lists independently.

**Key constraint:** The Passport's publicly visible "Featured Elements" are always drawn from **owned** elements, not wishlist items. The wishlist remains private and is never exposed on the public Passport page.

---

### 5.5 Publishing & Privacy

**Publishing flow:**
1. Collector completes their profile (handle + display name minimum required).
2. Collector navigates to `/app/cabinet/passport`.
3. Collector reviews their Passport in preview.
4. Collector clicks "Publish Passport".
5. A confirmation dialog warns: "Your Passport will be publicly visible at `cabinet.luciteria.com/p/{handle}`. Anyone with the link can view it."
6. On confirm, `passport.published = true` and `passport.publishedAt` is set.
7. The Passport is immediately live at the public URL.

**Unpublishing:**
- Collector can unpublish at any time from the Passport management page.
- Unpublishing immediately takes the public page offline (returns the 404-style page).
- All Passport configuration is retained — re-publishing restores the page instantly.

**Handle change warning (post-publish):**
- If a collector changes their handle after publishing, a modal warns: "Changing your handle will break your existing shared link. Your Passport will be live at the new URL immediately. Do you want to continue?"
- Old URL becomes a 404. No redirect is implemented in v1.

---

### 5.6 Sharing & Link Preview Cards

#### Share Action (from the Passport management page)
When the collector clicks "Share", a share sheet appears containing:
- **Copy link** button — copies the full public URL to clipboard.
- **Share text** — pre-written copy the collector can paste into forums/Discord/social:
  > "Check out my Luciteria element collection — {completion}% of the periodic table and counting! 🧪 {URL}"
- **Native share API** — on mobile/supported browsers, triggers the OS share sheet.

#### Open Graph / Link Preview Metadata
Every public Passport page must emit the following `<meta>` tags to generate rich previews in iMessage, WhatsApp, Discord, Twitter/X, and Facebook:

| Tag | Value |
|-----|-------|
| `og:title` | `{Display Name}'s Element Collection — Luciteria Cabinet` |
| `og:description` | `{completion}% of the periodic table owned. {total} elements collected. See their cabinet and start your own.` |
| `og:image` | Dynamically generated share card image (see below) |
| `og:url` | `https://cabinet.luciteria.com/p/{handle}` |
| `og:type` | `profile` |
| `twitter:card` | `summary_large_image` |
| `twitter:title` | Same as `og:title` |
| `twitter:description` | Same as `og:description` |
| `twitter:image` | Same as `og:image` |

#### Share Card Image Generation
A server-generated image (1200×630px) composed of:
- **Left / top zone:** Collector avatar (or Luciteria default), display name, handle
- **Centre:** Collection progress bar with percentage label and "X / 118 elements"
- **Right / bottom zone:** The first (primary) featured element's catalog image, or the Luciteria logo if no featured elements are set
- **Branding:** Luciteria wordmark and `cabinet.luciteria.com` URL in a footer strip

**Implementation note for engineering:** The share card can be generated as a server-side rendered image using a headless browser (Puppeteer/Playwright), a canvas-based approach, or a third-party image generation service (e.g. Vercel OG / Satori). The image is generated on first request and can be cached per passport. Engineering to confirm implementation approach.

---

### 5.7 Avatar Upload

**Accepted formats:** JPG (`.jpg` / `.jpeg`), PNG (`.png`), WebP (`.webp`)  
**Maximum file size:** 2 MB  
**Minimum recommended dimensions:** 200×200px (square)  
**Display shape:** Circle crop on all UI surfaces  
**Storage:** Server-side file storage (engineering to confirm: Vercel Blob, S3, or similar — the app currently has no upload facilities and this will require a new storage integration)

**Upload flow:**
1. User clicks "Upload avatar" or "Change avatar" on the Profile page.
2. File picker opens filtered to `.jpg,.jpeg,.png,.webp`.
3. Client-side validation:
   - Format check (MIME type + extension)
   - File size ≤ 2 MB
   - If either fails, an inline error is shown and the upload is blocked.
4. On valid file selection, a preview of the cropped circle is shown before submission.
5. On submit, file is uploaded via a multipart form action.
6. Server validates format and size again (never trust client-only validation).
7. On success, `user.avatarUrl` is updated in the database.
8. Avatar appears immediately in the UI (no full page reload needed).

**Default avatar:** The Luciteria branded default avatar SVG/image is used whenever `user.avatarUrl` is null. It must be a recognisable, on-brand asset (e.g. stylised "L" or element cube motif). Engineering/design to produce the default asset.

---

## 6. Data Model Changes

### 6.1 New Model: `CollectorPassport`

```prisma
model CollectorPassport {
  id               String    @id @default(cuid())
  userId           String    @unique
  user             User      @relation(fields: [userId], references: [id])

  published        Boolean   @default(false)
  publishedAt      DateTime?

  featuredElements PassportFeaturedElement[]

  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
}
```

### 6.2 New Model: `PassportFeaturedElement`

```prisma
model PassportFeaturedElement {
  id           String            @id @default(cuid())
  passportId   String
  passport     CollectorPassport @relation(fields: [passportId], references: [id])

  elementKey   String            // matches the element key used elsewhere (e.g. "fe", "au")
  format       String?           // e.g. "10mm_cube", "lucite" — which owned format to show
  displayOrder Int               // 1–5, user-defined ordering

  createdAt    DateTime          @default(now())

  @@unique([passportId, elementKey])
  @@unique([passportId, displayOrder])
}
```

### 6.3 Extensions to `User` Model

The following fields are added to the existing `User` model:

```prisma
// Profile fields
handle           String?   @unique   // collector handle, e.g. "sarahk_42"
displayName      String?             // overridable display name
bio              String?             // max 280 chars
location         String?             // free text, max 60 chars
favouriteElement String?             // element key
collectionMotivation String?         // mirrors / replaces primaryMotivation if already present

// Avatar
avatarUrl        String?             // path/URL to uploaded avatar; null = use default

// Passport relation
passport         CollectorPassport?
```

**Note:** `primaryMotivation` already exists on `User` (from onboarding). Confirm with engineering whether `collectionMotivation` should be a separate field or whether the Profile page simply updates `primaryMotivation` in place.

---

## 7. Route & API Summary

| Route | Type | Auth | Purpose |
|-------|------|------|---------|
| `/app/cabinet/profile` | Private | Required | Profile setup and edit |
| `/app/cabinet/passport` | Private | Required | Passport management (build, preview, publish) |
| `/p/:handle` | Public | None | Public Passport page |
| `/app/cabinet/passport/publish` (action) | Action | Required | Publish / unpublish toggle |
| `/app/cabinet/passport/featured` (action) | Action | Required | Save featured element selections and order |
| `/app/cabinet/profile` (action) | Action | Required | Save profile fields + avatar |
| `/og/passport/:handle` | Public | None | Server-rendered Open Graph share card image |

---

## 8. Admin Considerations

### 8.1 Visibility to Staff
- The admin user management view (`/app/admin/users/$userId`) should show:
  - Whether the user has a Passport (yes/no)
  - Whether it is published (yes/no)
  - Their handle and public URL

### 8.2 Moderation (v1 scope)
- No content moderation tooling is built in v1.
- Staff can manually unpublish a Passport by setting `published = false` directly via the admin interface (a simple toggle on the user detail page).
- Bio content is plain text only — no markdown, no HTML. This limits injection risk.

### 8.3 Feature Flag
- The Passport feature should be gated behind a `Feature Flag` (existing `FeatureFlag` model) so it can be enabled/disabled at runtime without a deployment.
- Flag name: `feature_collection_passport`
- When disabled: `/app/cabinet/passport` and `/app/cabinet/profile` return a "Coming soon" screen; public `/p/:handle` routes return 404.

---

## 9. Edge Cases & Error Handling

| Scenario | Behaviour |
|----------|-----------|
| User visits `/p/:handle` where handle does not exist | 404-style "Passport not found" page with Luciteria CTA |
| User visits `/p/:handle` where Passport is unpublished | Same 404-style page — no indication whether the user exists |
| User has 0 owned elements when selecting featured elements | Empty state with message: "You haven't added any elements to your cabinet yet." Link to the periodic table view. |
| User changes handle after publishing | Warning modal before save; old URL becomes dead (no redirect in v1) |
| Avatar upload exceeds 2 MB | Client-side error before upload attempt; server-side check as safety net |
| Avatar upload is wrong format | Same as above — error shown inline |
| CollectionSet stats: user has no complete sets | "0 sets completed" shown — not hidden |
| User has no featured elements when publishing | Allowed — public page shows stats and profile with no featured grid section |
| Share card generation fails | Falls back to a static Luciteria-branded OG image; no error surfaced to user |
| Handle collision on auto-generation | Auto-append incrementing suffix until unique (`sarahk`, `sarahk_2`, `sarahk_3`) |
| Passport feature flag disabled | `/app/cabinet/passport` and profile redirect to a "coming soon" screen; public routes 404 |

---

## 10. Out of Scope for v1

The following are explicitly **not** in scope for the initial release and are deferred to future phases:

- Multiple Passports per account
- Follower / following between collectors
- Comments or reactions on a Passport
- Leaderboards or public discovery listings ("Top Collectors")
- Badge/achievement integration with the existing Milestone system (possible Phase 2)
- Email notifications when someone views your Passport
- Analytics for the collector (view count, share count)
- Redirect from old handle URL after a handle change
- Custom Passport themes or background colours
- Integration with Shopify customer profile data
- Social login (Twitter/X, Google) for new account creation via Passport CTA

---

## 11. Open Items for Engineering

1. **File storage for avatar uploads** — The app has no existing upload infrastructure. Engineering must decide on a storage provider (Vercel Blob, AWS S3, Cloudflare R2) and implement the upload endpoint. This is a foundational dependency for the avatar feature.

2. **Public URL structure** — Confirm whether public Passport routes live at `/p/:handle` on the same domain (`cabinet.luciteria.com/p/handle`) or at a subdomain. The CTA in the summary points to `cabinet.luciteria.com`, which suggests same-domain routing is appropriate.

3. **OG image generation approach** — Confirm implementation: Vercel OG (Satori), server-side Puppeteer/Playwright render, or third-party service. Caching strategy for generated images.

4. **Handle edit policy** — Confirm whether the handle can be edited more than once, or only once. A "one edit" policy is simpler and prevents link churn.

5. **`primaryMotivation` consolidation** — Confirm whether the Profile page edits the existing `primaryMotivation` column on `User` or introduces a new `collectionMotivation` column.

6. **Featured element data source** — Confirm which model/query provides the element catalog images for the featured element picker (likely `Product` linked to element keys via `SubscriptionSku` or similar).

7. **Stats calculation performance** — For collectors with large collections, confirm that set-completion stats can be computed efficiently at request time. If not, a background calculation with a cached `passportStatsSnapshot` column may be needed.

---

## 12. Acceptance Criteria (Summary)

A Passport implementation is complete when:

- [ ] Every account has access to a Profile page at `/app/cabinet/profile` where they can set handle, display name, bio, location, favourite element, motivation, and upload an avatar (JPG/PNG/WebP, ≤ 2 MB).
- [ ] Every account has a Passport management page at `/app/cabinet/passport` with a preview, featured element selector, and publish/unpublish controls.
- [ ] A published Passport is publicly accessible at `/p/{handle}` with no authentication required.
- [ ] The public page shows: avatar, display name, handle, bio, location, favourite element, motivation, collection stats (owned count, completion %, sets completed, formats), and up to 5 featured elements.
- [ ] The public page has a "Start your own cabinet" CTA linking to `cabinet.luciteria.com`.
- [ ] Open Graph meta tags are emitted on every public Passport page, producing a rich share card in Discord, iMessage, WhatsApp, and Twitter/X.
- [ ] The share card image (1200×630px) contains avatar, collection progress, and primary featured element image.
- [ ] The Passport management page provides a copy-link and share action.
- [ ] Featured elements are selectable from owned items only (up to 5), orderable, and include a "no image" text option.
- [ ] Wishlist items can be added to the featured list from the wishlist page; owned elements viewed in the Passport element picker can be added to the wishlist without leaving the modal.
- [ ] Unpublished Passports return a 404-style page to visitors.
- [ ] The feature is gated behind the `feature_collection_passport` feature flag.
- [ ] Admin user detail page shows Passport status and handle.
- [ ] All avatar uploads are validated server-side (format + size).
- [ ] Users without an avatar see the Luciteria default avatar.

---

*End of Document*
