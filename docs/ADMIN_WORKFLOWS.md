# Admin Workflows

## 1. Managing Membership Tiers

**Route:** `/app/admin/membership-tiers`

1. Click **+ New Tier** to create a tier
2. Set internal name (e.g., "Gold"), display name, monthly price, store credit amount, early access days
3. Maximum 3 active tiers are enforced — you cannot create a 4th active tier
4. Use **Edit** to change pricing/credits for existing tiers
5. Use **Deactivate** to hide a tier from new signups (existing members keep their tier)
6. Use **Delete** only if no members are assigned to that tier

## 2. Controlling SKU Eligibility

**Route:** `/app/admin/subscription-skus`

1. View all active products with their subscription flags
2. Toggle **Eligible** — makes the SKU available for collector packs
3. Toggle **Subscriber Only** — hides the product from non-members
4. Toggle **Early Access** — gives higher-tier members early access
5. Set **Min Tier** — requires a minimum membership tier to access
6. Use **Bulk Eligible** to mark all filtered SKUs at once

## 3. Creating Collector Packs

**Route:** `/app/admin/collector-packs`

1. Click **+ New Pack**
2. Enter pack name, description, and choose 3 or 5 items
3. Select SKUs from the eligible pool (only eligible SKUs are shown)
4. Optionally restrict the pack to a specific tier
5. Set a cash price, credit cost, or both
6. Set a stock limit if needed
7. Click **Create Pack** — pack is immediately available in the storefront

## 4. Order Approval

**Route:** `/app/admin/orders-pending`

⚠️ **CRITICAL: Orders are NEVER auto-shipped. You must approve every order.**

1. Review pending orders in the queue
2. Each order shows: customer info, pack contents, payment method, SKU list
3. Click **✅ Approve** to move order to ADMIN_APPROVED status
4. Click **❌ Reject** to reject the order
5. Use **Approve All** for batch approval when queue is large
6. Approved orders appear in Recent Orders — click **📦 Mark Fulfilled** after shipping

## 5. Feature Flags

**Route:** `/app/admin/feature-flags`

1. Toggle Phase 2 features on/off individually
2. Phase 3 flag is locked — cannot be enabled via UI
3. Changes take effect immediately

## 6. Granting Monthly Credits

**Manual process (prototype):**
Credits are granted via the store credit system. In production, this would be an automated monthly job.

For now, admin can simulate credit grants through the dashboard or directly in the database.
