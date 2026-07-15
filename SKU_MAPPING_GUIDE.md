# Luciteria Collector Cabinet — SKU Mapping Guide

**Generated:** 2026-05-25  
**Source:** Products (1).csv (Shopify export, 1,654 variant rows)

---

## Overview

This mapping connects every Shopify product variant to its corresponding chemical element and collection type. It is the bridge between real Shopify product data and the Collector Cabinet subscription engine.

### Key Stats

| Metric | Value |
|---|---|
| Total product variants | 1,654 |
| Mapped to an element | 1,533 |
| Unmapped (accessories, display cases, etc.) | 121 |
| Unique elements covered | **118 / 118 (100%)** |
| Precious metal variants (excluded from auto-assignment) | ~100+ |

---

## Deliverable Files

| File | Description |
|---|---|
| `SKU_MAPPING_MASTER.xlsx` | 4-sheet workbook: Summary, Master Mapping, Precious Metals, Unmapped Products |
| `SKU_MAPPING_MASTER.csv` | Flat CSV of the master mapping for easy import/API use |
| `ELEMENT_COVERAGE_REPORT.xlsx` | 4-sheet workbook: Coverage Matrix, Gap Analysis, Collection Summary, Multi-Format Elements |
| `SKU_MAPPING_GUIDE.md` | This file |

---

## Collection Types

Products are classified into these collection types based on title, SKU patterns, and Shopify tags:

| Collection Type | Description | SKU Pattern | Coverage |
|---|---|---|---|
| **10mm Cube** | Small metal cubes | `{Sym}10mm` | 82 elements |
| **25.4mm Cube** | 1-inch metal cubes | `{Sym}25.4mm` | 59 elements |
| **50mm Cube** | 2-inch metal cubes | `{Sym}50mm` | 29 elements |
| **Lucite 50mm** | Element embedded in 50mm acrylic | `{Sym}2x2` | **118 elements** (full set) |
| **31mm Round** | Metal rounds/coins | `{Sym}31mm` | 74 elements |
| **Ampoule** | Sealed glass ampoule | `{Sym}{weight}_amp` | 29 elements |

### Subscription-Relevant Collection Types

For the Collector Cabinet subscription:
- **Lucite 50mm** = "Lucite Collection" (the flagship — all 118 elements available)
- **10mm Cube** = "10mm Collection" (82 elements)
- **25.4mm Cube** = "25.4mm Collection" (59 elements)

These three are the primary subscription collection types shown in the UI.

---

## Element Extraction Logic

### From Product Title (primary method)
1. Match element name at the **start** of the title (e.g., "Strontium 50mm Lucite Cube" → Sr)
2. Handle parenthetical variants: "Chlorine (liquid)" → Cl, "Phosphorus (Black)" → P
3. Fall back to matching element name **anywhere** in title (for names > 3 characters to avoid false positives)

### From SKU (fallback)
1. Extract 1-2 letter element symbol from start of SKU: `Sr2x2` → Sr, `Na2x2` → Na
2. Validate against periodic table

### SKU Naming Convention

```
{Symbol}{Size}_{Modifier}

Examples:
  Sr2x2          → Strontium, Lucite 50mm
  Al10mm         → Aluminum, 10mm Cube  
  Al10mm_mp      → Aluminum, 10mm Cube (mirror polish variant)
  Ag10.1mm_empty → Silver, 10mm (empty acrylic box)
  Hg30g_amp      → Mercury, Ampoule (30g)
  Cu2x2_disc     → Copper, Lucite 50mm (discontinued/discounted variant)
  Fe25.4mm       → Iron, 25.4mm Cube
```

---

## Precious Metals — Special Handling

The following 8 elements are flagged as **precious metals** and are **excluded from automatic subscription assignment**:

| Symbol | Element | Reason |
|---|---|---|
| Au | Gold | High value |
| Pt | Platinum | High value |
| Pd | Palladium | High value |
| Rh | Rhodium | High value |
| Ir | Iridium | High value |
| Os | Osmium | High value + hazardous |
| Ru | Ruthenium | High value |
| Re | Rhenium | High value |

These appear in the `Precious Metals` sheet of the master workbook with orange highlighting. They should only be assigned via manual override by an admin.

---

## How to Use This Mapping

### For the Subscription Engine
1. Load `SKU_MAPPING_MASTER.csv`
2. Filter by the customer's collection type (e.g., "Lucite 50mm")
3. Filter `Available for Subscription = Yes`
4. Cross-reference with customer's owned elements to find eligible next shipments
5. Use `Retail Price` for discount calculations
6. Check `Current Stock` before assignment (recheck live via Shopify API at assignment time)

### For Inventory Decisions
1. Open `ELEMENT_COVERAGE_REPORT.xlsx` → "Gap Analysis" sheet
2. See which elements are missing from each collection type
3. Prioritize procurement for collection types with active subscribers

### For the Developer
- The `SKU` column maps directly to Shopify's `variant.sku` field
- The `Element Symbol` + `Collection Type` combination is the unique key for subscription logic
- When a product has multiple variants (e.g., different weights of the same element ampoule), all are listed — the engine should pick the variant with the best stock/price

---

## Known Limitations & Notes

1. **No price in source CSV**: Prices were joined from a secondary Shopify export (`products_May-01_11-17-41AM.csv`). Some SKUs may not have matched — check for blank prices.
2. **Inventory is a snapshot**: Stock levels are from the CSV export date, not real-time. The live app must query Shopify API.
3. **Synthetic/Radioactive elements** (Tc, Pm, Po, At, Fr, Ra, Ac, Np, Pu, Am, Cm, Bk, Cf, Es, Fm, Md, No, Lr, Rf, Db, Sg, Bh, Hs, Mt, Ds, Rg, Cn, Nh, Fl, Mc, Lv, Ts, Og): These exist as Lucite cubes (containing representative imagery/samples) but may not exist in metal cube formats.
4. **121 unmapped products**: These are display cases, accessories, sets, and non-element products. See the "Unmapped Products" sheet.
5. **Some elements have multiple SKUs per collection type** (e.g., different purities, finishes, or weights). The engine should select the best available variant.

---

## Updating This Mapping

When new products are added to Shopify:
1. Export a fresh Products CSV from Shopify
2. Re-run the mapping script (`build_sku_mapping.py`)
3. Review the "Unmapped Products" sheet for any new items that need manual classification
4. Check the Coverage Matrix for newly filled gaps
