# Responsive Font Sizes Implementation

**Date:** June 5, 2026  
**Status:** ✅ Complete

## Overview
Replaced fixed-size periodic table fonts with responsive breakpoints that automatically adapt to screen size across **all pages** (Collection, Shop, Onboarding).

---

## Implementation Details

### Font Size Breakpoints

| Screen Size | Viewport Width | Symbol | Atomic# | Name |
|------------|---------------|--------|---------|------|
| **Small (Mobile)** | < 768px | 16px | 9px | 7px |
| **Medium (Tablet/Laptop)** | 768px - 1279px | 24px | 14px | 10px |
| **Large (Desktop)** | ≥ 1280px | 32px | 18px | 14px |

### Mobile-First Approach
Using CSS `@media (min-width)` queries to progressively enhance from small to large screens:

```css
/* Default: Mobile (< 768px) */
.cell .num { font-size: 9px; }
.cell .sym { font-size: 16px; }
.cell .nm { font-size: 7px; }

/* Medium screens (768px+) */
@media (min-width: 768px) {
  .cell .num { font-size: 14px; }
  .cell .sym { font-size: 24px; }
  .cell .nm { font-size: 10px; }
}

/* Large screens (1280px+) */
@media (min-width: 1280px) {
  .cell .num { font-size: 18px; }
  .cell .sym { font-size: 32px; }
  .cell .nm { font-size: 14px; }
}
```

---

## Changes Made

### 1. `/app/tailwind.css`
- ✅ Removed fixed font sizes (old: 32px/18px/14px globally)
- ✅ Added mobile-first responsive sizing (16px/9px/7px default)
- ✅ Added `@media (min-width: 768px)` for medium screens (24px/14px/10px)
- ✅ Added `@media (min-width: 1280px)` for large screens (32px/18px/14px)
- ✅ **Removed** `.ptable-onboarding` override (no longer needed)

### 2. `/app/routes/onboarding.log-owned.jsx`
- ✅ Removed `className="ptable-onboarding"` prop from `<WireframePeriodicTable>`
- ✅ Now uses same responsive sizing as all other pages

### 3. `/app/components/WireframePeriodicTable.jsx`
- ✅ Updated JSDoc comment to reflect responsive font sizing
- ✅ Removed outdated `ptable-onboarding` example

---

## Affected Pages
All periodic table instances now use the same responsive sizing:

1. **Dashboard** → "Collection Overview" widget
2. **Collection** (`/app/cabinet/periodic-table`) → Main periodic table
3. **Shop** (`/app/cabinet/shop`) → Product-linked periodic table
4. **Onboarding: Log Owned** (`/onboarding/log-owned`) → Initial collection setup
5. **Notes Overlay** → Element status modal

---

## Testing Checklist
- [ ] View Collection page on mobile (< 768px) → fonts should be smallest
- [ ] View Collection page on tablet/laptop (768-1279px) → fonts should be medium
- [ ] View Collection page on desktop (≥ 1280px) → fonts should be largest
- [ ] Repeat for Shop page
- [ ] Repeat for Onboarding flow
- [ ] Verify count badges and checkmarks still display correctly at all sizes

---

## Browser Compatibility
Uses standard CSS `@media` queries supported by all modern browsers:
- Chrome/Edge 88+
- Firefox 78+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

---

## Performance Impact
- ✅ No JavaScript required (pure CSS)
- ✅ No additional HTTP requests
- ✅ Minimal CSS overhead (3 media queries)
- ✅ No render-blocking resources

---

## Rollback Instructions
If responsive sizing needs to be reverted:

1. **Restore fixed sizes in `/app/tailwind.css`:**
   ```css
   .cell .num { font-size: 18px; }
   .cell .sym { font-size: 32px; }
   .cell .nm { font-size: 14px; }
   ```

2. **Re-add onboarding override (if needed):**
   ```css
   .ptable-onboarding .cell .num { font-size: 9px; }
   .ptable-onboarding .cell .sym { font-size: 16px; }
   .ptable-onboarding .cell .nm { font-size: 7px; }
   ```

3. **Re-add className to onboarding route:**
   ```jsx
   <WireframePeriodicTable
     elements={elements}
     states={states}
     showChecks
     onCellClick={toggle}
     className="ptable-onboarding"
   />
   ```

---

## Future Enhancements
Consider adding responsive adjustments for:
- Grid gap spacing (currently 4px fixed)
- Count badge size on mobile
- Check icon size on mobile
- Border width adjustments

---

**Build Verification:** ✅ `npm run build` successful (June 5, 2026)
