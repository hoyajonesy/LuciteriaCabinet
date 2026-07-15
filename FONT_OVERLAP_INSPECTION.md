# Font Overlap Inspection Report

**Date:** June 5, 2026  
**Inspector:** Automated visual inspection  
**Pages Tested:** Collection, Shop, Onboarding (Log Owned)  
**Component:** `WireframePeriodicTable` (shared across all three pages)

---

## Executive Summary

**Significant text overflow issues were found across ALL three breakpoints.** Element names (`.nm` class) overflow their cell boundaries at every responsive size. At the small breakpoint, even some element symbols (`.sym`) overflow. The root cause is that the cell widths in an 18-column grid are too narrow for the current font sizes, especially for long element names like "Praseodymium", "Rutherfordium", and "Darmstadtium".

---

## Current Font Size Configuration

| Breakpoint | Screen Width | Symbol (`.sym`) | Atomic # (`.num`) | Name (`.nm`) |
|---|---|---|---|---|
| **Small** | < 768px | 14px | 8px | 6px |
| **Medium** | 768px–1023px | 20px | 12px | 8px |
| **Large** | ≥ 1024px | 26px | 15px | 11px |

---

## Overflow Results Summary

| Breakpoint | Name Overflows | Symbol Overflows | Total Elements |
|---|---|---|---|
| **Small** (500px) | **98 / 118** (83%) | **19 / 118** (16%) | 118 |
| **Medium** (768px) | **55 / 118** (47%) | 0 / 118 | 118 |
| **Large** (1024px) | **53 / 118** (45%) | 0 / 118 | 118 |

### Key Finding
The element name (`.nm`) text overflows in nearly half of all cells even at the largest breakpoint. At the small breakpoint, the problem is catastrophic — 83% of element names and 16% of symbols overflow.

---

## Worst Offenders (by overflow amount)

### Small Breakpoint (cell width: ~21px)
| Element | Text Width | Cell Width | Overflow |
|---|---|---|---|
| Praseodymium | 45px | 21px | +24px |
| Rutherfordium | 43px | 21px | +22px |
| Darmstadtium | 43px | 21px | +22px |
| Roentgenium | 40px | 21px | +19px |
| Mendelevium | 40px | 21px | +19px |

### Medium Breakpoint (cell width: ~36px)
| Element | Text Width | Cell Width | Overflow |
|---|---|---|---|
| Praseodymium | 60px | 36px | +24px |
| Rutherfordium | 58px | 36px | +22px |
| Darmstadtium | 57px | 36px | +21px |
| Mendelevium | 54px | 36px | +18px |
| Roentgenium | 53px | 36px | +17px |

### Large Breakpoint (cell width: ~50px)
| Element | Text Width | Cell Width | Overflow |
|---|---|---|---|
| Praseodymium | 82px | 50px | +32px |
| Rutherfordium | 79px | 50px | +29px |
| Darmstadtium | 79px | 50px | +29px |
| Mendelevium | 74px | 50px | +24px |
| Roentgenium | 73px | 50px | +23px |

---

## Pages Affected

All three pages use the shared `WireframePeriodicTable` component (`app/components/WireframePeriodicTable.jsx`) with the same CSS classes defined in `app/tailwind.css`. The overflow behavior is identical across:

1. **Collection Page** (`/app/cabinet/periodic-table`) — Names like "Rutherfordium", "Darmstadtium", "Meitnerium" visibly bleed outside cells
2. **Shop Page** (`/app/cabinet/shop`) — Same overflow, with shop-specific gradient styling making it slightly more noticeable
3. **Onboarding Log Owned** (`/onboarding/log-owned`) — Same component, same overflow

---

## Visual Evidence

### Collection Page (Large viewport, 1536px)
![Collection Page](/home/ubuntu/screenshot_collection_page.png)

Names like "Rutherfordium", "Molybdenum", "Praseodymium", "Darmstadtium" visibly overflow their cell boundaries in row 7 and the lanthanide/actinide rows.

### Shop Page (Large viewport, 1536px)
![Shop Page](/home/ubuntu/screenshot_shop_page.png)

Same overflow pattern visible, particularly in the bottom rows with longer element names.

### Automated Test — All Breakpoints Side-by-Side
![Overflow Report](/home/ubuntu/screenshot_overflow_report.png)

Red-highlighted cells indicate overflow. The medium table shows ~55 overflowing cells, and the large table shows ~53.

### Medium & Large Tables with Red Highlights
![Tables with Overflow Highlights](/home/ubuntu/screenshot_tables_overflow.png)

---

## Root Cause Analysis

The fundamental issue is a **mismatch between font size and available cell width**. In an 18-column grid:

- At 500px container width: each cell is ~21px wide → 6px font names still overflow
- At 768px container width: each cell is ~36px wide → 8px font names still overflow  
- At 1024px container width: each cell is ~50px wide → 11px font names still overflow

The longest element names (Praseodymium = 13 chars, Rutherfordium = 14 chars) need roughly **1.6× the cell width** even at the smallest font size.

---

## Recommended Fixes

### Option A: Add `overflow: hidden` + `text-overflow: ellipsis` (Quick Fix)
```css
.cell .nm {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
```
This clips long names but keeps the layout clean. Most periodic tables use this approach.

### Option B: Reduce Name Font Sizes Further
- Small: 6px → **4px** (may be unreadable)
- Medium: 8px → **6px**
- Large: 11px → **8px**

This reduces overflow count but won't eliminate it for the longest names.

### Option C: Hide Names on Small Screens, Truncate on Medium/Large
```css
/* Small: hide names entirely */
.cell .nm { display: none; }

/* Medium: show truncated */
@media (min-width: 768px) {
  .cell .nm {
    display: block;
    font-size: 6px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }
}

/* Large: show with slightly larger truncated text */
@media (min-width: 1024px) {
  .cell .nm { font-size: 9px; }
}
```

### Option D: Use CSS `scale()` for Names (Best Visual Result)
```css
.cell .nm {
  white-space: nowrap;
  transform: scale(var(--nm-scale, 1));
  transform-origin: center;
}
```
Then use JavaScript to auto-calculate the scale factor per cell. This preserves readability while fitting within bounds.

### Recommended Approach
**Option A** is the simplest and most standard approach for periodic tables. Combined with a `title` attribute (already present via the component), users can hover to see the full name. This is the industry-standard pattern used by most interactive periodic tables.

---

## CSS Location
All styles are in: `app/tailwind.css` (lines 7–22)  
Component: `app/components/WireframePeriodicTable.jsx`
