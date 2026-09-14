import { parseSizes, normaliseFormat } from "./formats.js";

/**
 * Look up a product in productsByFormat by canonical format id, tolerating
 * raw/aliased keys ("10mm" vs "10mm_cube") that may still exist in the map.
 */
function productForFormatKey(productsByFormat, formatId) {
  if (!productsByFormat) return null;
  if (productsByFormat[formatId]) return productsByFormat[formatId];
  for (const [key, value] of Object.entries(productsByFormat)) {
    if (normaliseFormat(key) === formatId) return value;
  }
  return null;
}

/**
 * True when the element is offered in the given canonical format, comparing
 * normalised size tokens so "10mm"/"10mm_cube" etc. all match.
 */
function sizesIncludeFormat(element, formatId) {
  return parseSizes(element.size).map(normaliseFormat).includes(formatId);
}

export function isMixedFormat(formatId) {
  return !formatId || formatId === "other";
}

export function shopifyNumericId(gid) {
  return String(gid || "").split("/").pop();
}

export function productUrlForShopProduct(product, elementName) {
  if (!product?.handle) {
    return `https://luciteria.com/search?q=${encodeURIComponent(elementName || "")}`;
  }

  const variantId = shopifyNumericId(product.variantId);
  const variantQuery = variantId ? `?variant=${encodeURIComponent(variantId)}` : "";
  return `https://luciteria.com/products/${product.handle}${variantQuery}`;
}

export function productForDisplayFormat(element, formatId) {
  if (isMixedFormat(formatId)) {
    return (
      element.productsByFormat?.other ||
      element.products?.[0] ||
      Object.values(element.productsByFormat || {})[0] ||
      null
    );
  }

  if (!sizesIncludeFormat(element, formatId)) return null;
  return productForFormatKey(element.productsByFormat, formatId);
}

export function elementForDisplayFormat(element, formatId) {
  const mixed = isMixedFormat(formatId);
  const product = productForDisplayFormat(element, formatId);
  const available = mixed || (sizesIncludeFormat(element, formatId) && !!product);

  if (!available) return null;

  return {
    ...element,
    name: product?.title || element.name,
    elementName: element.elementName || element.name,
    product,
    available,
  };
}

export function elementsForDisplayFormat(elements, formatId) {
  return elements
    .map((element) => elementForDisplayFormat(element, formatId))
    .filter(Boolean);
}

/**
 * FR-2 — availability-aware variant for the cabinet shop periodic table.
 *
 * Unlike elementForDisplayFormat (which returns null for elements not offered
 * in the format so list views can drop them), this ALWAYS returns the element
 * so the periodic table can still render its cell, but with a dynamically
 * computed `available` flag and `product` (null when the element has no
 * purchasable product in the selected format). Callers grey out / disable
 * cells where `available === false` instead of silently hiding them.
 */
export function elementWithAvailabilityForFormat(element, formatId) {
  const mixed = isMixedFormat(formatId);
  const product = productForDisplayFormat(element, formatId);
  const available = mixed || (sizesIncludeFormat(element, formatId) && !!product);

  return {
    ...element,
    // Keep the clean canonical element name for unavailable cells; only swap in
    // the product title when there is an actual product for this format.
    name: available && product?.title ? product.title : (element.elementName || element.name),
    elementName: element.elementName || element.name,
    product: available ? product : null,
    available,
  };
}

export function elementsWithAvailabilityForFormat(elements, formatId) {
  return elements.map((element) => elementWithAvailabilityForFormat(element, formatId));
}