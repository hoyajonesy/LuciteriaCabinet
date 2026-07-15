import { parseSizes } from "./formats";

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

  if (!parseSizes(element.size).includes(formatId)) return null;
  return element.productsByFormat?.[formatId] || null;
}

export function elementForDisplayFormat(element, formatId) {
  const mixed = isMixedFormat(formatId);
  const product = productForDisplayFormat(element, formatId);
  const available = mixed || (parseSizes(element.size).includes(formatId) && !!product);

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