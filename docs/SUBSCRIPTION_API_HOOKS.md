# Subscription API Hooks — Shopify Integration Points

## Overview
This document describes the integration points between the subscription system and Shopify. All hooks are currently stubs/mocks in the prototype.

---

## 1. Billing Integration

### Shopify Subscription API
```
TODO: Connect to Shopify Selling Plan Groups API
- Create selling plans for Bronze/Silver/Gold tiers
- Map MembershipTier records to Shopify selling plan IDs
- Handle billing events via webhooks
```

### Webhooks to Implement
| Webhook | Action |
|---------|--------|
| `subscription_contracts/create` | Create UserSubscription record |
| `subscription_contracts/update` | Update status (pause/resume/cancel) |
| `subscription_billing_attempts/success` | Grant monthly credits, log transaction |
| `subscription_billing_attempts/failure` | Mark subscription as PAST_DUE |

---

## 2. Inventory Integration

### Current Stubs (`/app/lib/inventory-sync.server.js`)
| Function | Shopify Hook |
|----------|-------------|
| `syncSkuAvailability(sku, count)` | `inventory_levels/update` webhook |
| `checkPackAvailability(packId)` | Called before order approval |
| `reservePackInventory(packId, qty)` | Called on order approval |

### Webhooks to Implement
| Webhook | Action |
|---------|--------|
| `products/update` | Sync product status, pricing |
| `inventory_levels/update` | Update stock counts |
| `inventory_levels/connect` | Track new inventory items |

---

## 3. Order Fulfillment

### Current Flow (Prototype)
```
PackOrder (PENDING) → Admin Approves → ADMIN_APPROVED → Manual shipping → FULFILLED
```

### Production Flow
```
PackOrder (PENDING) → Admin Approves → 
Create Shopify Draft Order → Customer pays → 
Shopify Order created → Fulfillment via Shopify →
Webhook: orders/fulfilled → Mark FULFILLED
```

### Webhooks to Implement
| Webhook | Action |
|---------|--------|
| `orders/create` | Link PackOrder to Shopify order ID |
| `orders/paid` | Confirm payment received |
| `orders/fulfilled` | Mark PackOrder as FULFILLED |
| `orders/cancelled` | Refund credits if applicable |

---

## 4. Customer Sync

### Webhooks to Implement
| Webhook | Action |
|---------|--------|
| `customers/create` | Create User record (Shopify OAuth) |
| `customers/update` | Sync email, name changes |
| `customers/delete` | Deactivate user, retain data |

---

## 5. Ownership Tracking (Phase 2)

### When Phase 2 is Active
| Event | Action |
|-------|--------|
| `orders/fulfilled` | Call `trackPurchase()` for each line item SKU |
| Manual import | Bulk create UserOwnedSku records from CSV |

---

## 6. Authentication

### Current: Email/Password (Prototype)
- Session-based auth via `session.server.js`
- Password hashing via bcrypt

### Production: Shopify OAuth
- Replace with Shopify App Bridge session tokens
- Map Shopify customer IDs to User records
- Remove password fields from User model
- All auth files marked with `TODO PRODUCTION`
