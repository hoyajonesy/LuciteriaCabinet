# Luciteria Collector Cabinet — Business Rule Assumptions

## Product & Catalog Assumptions

1. **Multiple collection formats**: Products are organized into 5 collection types: 10mm density cubes, 25.4mm (1-inch) density cubes, 50mm display cubes, Lucite-embedded specimens, and sealed glass ampoules. Each customer selects one type (Phase 2); multi-collection support is forward-compatible.

2. **Prices include dual pricing**: Each product has a `retailPrice` (full price) and `subscriptionCost` (subscriber price). The discount percentage is calculated per shipment and tracked historically.

3. **Rarity tiers are inferred**: Products are classified as common/uncommon/rare/ultra-rare/legendary based on inventory levels, element scarcity, product type, and price point.

4. **35 products in prototype**: The seed data uses 35 representative products across all 5 collection types. Production would include all active products from the full catalog.

5. **118-element periodic table**: The interactive periodic table shows all 118 elements with standard layout. Element data includes symbol, name, atomic number, category, row, and column positioning.

6. **Element metadata**: Atomic numbers, element names, and group classifications are from standard periodic table data. Categories include alkali metals, alkaline earth metals, transition metals, post-transition metals, metalloids, reactive nonmetals, noble gases, lanthanides, and actinides.

## Collection Type Assumptions

7. **Five collection types**: 10mm, 25.4mm, 50mm, Lucite, and Ampoules. These represent the primary product formats offered by Luciteria.

8. **One type per customer in Phase 2**: Customers select their collection type during onboarding. This is locked for Phase 2; switching requires admin intervention. Multi-collection support is planned for Phase 3+.

9. **Type-filtered assignments**: The assignment engine only considers products matching the customer's selected collection type.

10. **Forward-compatible schema**: The database schema supports `CollectionTypeChange` audit logging and is designed for eventual multi-collection support without breaking changes.

## Subscription Assumptions

11. **Two plan tiers**:
    - **Element Explorer** ($79.99/mo): 1 item/month, basic duplicate prevention
    - **Completionist** ($149.99/mo): 1 premium item/month, rare element access, no budget cap

12. **Dual billing model**: Customers experience two billing events — signup day billing and 1st-of-month billing.

13. **5-day edge case**: If a customer signs up within 5 days of month end (e.g., Jan 28), the first element ships immediately and next billing starts on the 1st of the following month, avoiding a double-charge.

14. **One item per shipment**: Default is 1 element per subscription shipment.

15. **No partial shipments**: Either a full shipment goes out or it's skipped.

16. **Skip/pause are free**: Customers can skip or pause without penalty. Grandfathered pricing is preserved during pause.

## Billing & Pricing Assumptions

17. **Grandfathering**: Customers who subscribed before a price increase keep their locked-in price. The grandfathering clock pauses during subscription pause and resumes when the subscription is reactivated.

18. **Discount tracking**: Each shipment records the retail price, subscription cost, and discount percentage. This enables historical discount analysis.

19. **>20% discount alert**: If the discount on an assigned item exceeds 20%, the admin is alerted via the operations dashboard (red badge). This helps monitor margin impact.

20. **Precious metals excluded**: Rhenium (Re), Rhodium (Rh), Gold (Au), Osmium (Os), Ruthenium (Ru), Palladium (Pd), Iridium (Ir), and Platinum (Pt) are excluded from subscription assignments due to price volatility. Silver (Ag) is explicitly allowed.

## Assignment Engine Assumptions

21. **Duplicate = same product ID**: Two different formats of the same element are considered different products.

22. **Wishlist priority is absolute**: If a customer's #1 wishlist item is in stock and matches their collection type, that's what ships.

23. **Budget filter is soft**: If no items fit within budget, the filter widens rather than skipping.

24. **High-value threshold**: Items over $200 are flagged for manual review.

25. **Low-stock threshold**: Items with ≤2 units are flagged for potential subscriber conflicts.

26. **Sequence preview**: The engine can preview the next 4+ months of planned assignments by simulating future ownership states. This is visible in the admin dashboard.

27. **Out-of-stock shifting**: If a planned item goes OOS before shipment, the engine automatically substitutes the next best eligible item and logs the change.

28. **Manual override**: Admin can override engine recommendations. Overrides are validated (product must be in stock, match collection type) and logged.

29. **No inter-subscriber deconfliction in prototype**: The engine evaluates each customer independently. Production would add a reservation system.

## Collection Tracking Assumptions

30. **Collection = purchases + subscriptions**: A customer's collection includes items acquired via direct purchase and subscription shipments.

31. **No automatic order scanning**: The prototype uses manually-seeded collection data. Production would scan Shopify order history.

32. **Collection is per-variant, not per-element**: Owning a Lucite Chromium cube doesn't mean you "have Chromium" in 10mm format.

## Customer Profile Assumptions

33. **Six test profiles cover key scenarios**:
    - Marcus (Lucite, nearly complete): Tests low-eligible-items edge case
    - Sarah (Lucite, mid-collection): Tests normal assignment flow
    - David (10mm, new/empty): Tests first-time assignment
    - Elena (Lucite, complete): Tests no-eligible-items edge case
    - James (25.4mm, mid-collection): Tests alternative collection type
    - Mia (Ampoules, early): Tests ampoule-specific assignment

34. **Single subscription per customer**: Each customer has at most one active subscription (Phase 2). Multi-subscription is Phase 3+.

## Notification Assumptions

35. **8 notification types**: assignment_preview, shipment_confirmed, restock_alert, discount_alert, billing_reminder, collection_milestone, pause_confirmation, welcome.

36. **Stubs only in prototype**: All notifications log to console and (optionally) database. No actual emails are sent. Production would use SendGrid/Postmark.

37. **Channel preferences**: Customers can set notification preferences (email, SMS, push) in the preferences page. These are stored but not acted upon in the prototype.

## UX Assumptions

38. **White/light theme is brand-appropriate**: Phase 2 switches from dark to light theme to align with Luciteria's clean, premium brand aesthetic. CSS variables make theme switching easy.

39. **Periodic table is front-and-center**: The interactive periodic table is the primary visual element on the customer dashboard, reinforcing the element-collecting experience.

40. **Customer switcher is prototype-only**: The `?customer=` query parameter lets reviewers see different collection states. In production, the logged-in Shopify customer is used.

41. **Buttons are non-functional in prototype**: UI actions show the UX but don't persist changes. Production would wire these to API calls.

42. **No image assets**: Product images are not mocked. Production would pull from Shopify's product image API.

43. **Mobile responsive**: Sidebar collapses at 768px, grids reflow, periodic table scales down.

## Business Model Assumptions

44. **Subscription is additive**: Subscriptions supplement direct purchases, not replace them.

45. **Free shipping included in subscription**: Subscription price covers shipping. Not modeled in prototype.

46. **No international considerations**: The prototype doesn't handle multi-currency, shipping restrictions, or export controls.

47. **Admin is a small team**: The Operations Dashboard is designed for 1-3 people, with simple session-based auth in the prototype.
