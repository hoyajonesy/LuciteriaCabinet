# Phase Activation Guide

## Phase 1 — Active at Launch
Phase 1 features are active by default. No flags needed.

### Checklist Before Launch
- [ ] Create 3 membership tiers at `/app/admin/membership-tiers`
- [ ] Mark SKUs as eligible at `/app/admin/subscription-skus`
- [ ] Create collector packs at `/app/admin/collector-packs`
- [ ] Test subscription flow end-to-end
- [ ] Test order approval flow

---

## Phase 2 — Enabling Ownership & Suggestions

### Prerequisites
1. Phase 1 must be fully operational
2. Product catalog must be up to date
3. Consider backfilling existing ownership data before enabling display

### Step-by-Step Activation

#### Step 1: Enable Ownership Tracking
1. Go to `/app/admin/feature-flags`
2. Toggle **phase2_ownership_tracking** to ON
3. From this point, all new purchases create UserOwnedSku records
4. Run backfill script for historical purchases (if needed)

#### Step 2: Enable Completion Display
1. Wait until ownership data has accumulated (or been backfilled)
2. Toggle **phase2_completion_display** to ON
3. Users will now see collection completion rings on their dashboard

#### Step 3: Enable Suggestions
1. Toggle **phase2_suggestions** to ON
2. Users will see "You're missing these" suggestions based on their collection gaps
3. Suggestions are display-only — no auto-ship or auto-add

### Rollback
Toggle any flag back to OFF to instantly hide the feature.

---

## Phase 3 — Dynamic Curation

### Current State
Phase 3 is scaffolded but NOT functional. All functions throw errors.

### When Ready to Implement
1. Complete the curation logic in `/app/lib/curation.server.js`
2. Build the request UI at `/app/cabinet/curation-request`
3. Build the admin queue at `/app/admin/curation-queue`
4. Test thoroughly
5. Enable `phase3_enabled` flag (requires code change — UI prevents enabling)

### Phase 3 will NOT auto-ship
Even when Phase 3 is active, every curated box requires admin approval before fulfillment.
