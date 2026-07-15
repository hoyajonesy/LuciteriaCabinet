/**
 * Luciteria Collector Cabinet — Error Handling Utilities
 *
 * Centralised error handling, logging, and graceful degradation.
 *
 * PRODUCTION TODO:
 * - Replace console.* with structured logger (pino, winston)
 * - Add Sentry or similar error tracking
 * - Add request-id correlation
 * - Add rate-limit / circuit-breaker for external API calls
 */

import { json } from "@remix-run/node";
import { LOG_LEVEL } from "../config/environment.server.js";

// ─── LOG LEVELS ──────────────────────────────────────────────

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LEVELS[LOG_LEVEL] ?? LEVELS.info;

function shouldLog(level) {
  return (LEVELS[level] ?? 0) >= currentLevel;
}

// ─── LOGGER ──────────────────────────────────────────────────

/**
 * Structured logger.  In production, replace with pino or winston
 * and output JSON to stdout for log aggregation.
 */
export const logger = {
  debug(module, message, data) {
    if (shouldLog("debug")) console.debug(`[DEBUG][${module}]`, message, data ?? "");
  },
  info(module, message, data) {
    if (shouldLog("info")) console.info(`[INFO][${module}]`, message, data ?? "");
  },
  warn(module, message, data) {
    if (shouldLog("warn")) console.warn(`[WARN][${module}]`, message, data ?? "");
  },
  error(module, message, error) {
    if (shouldLog("error")) {
      console.error(`[ERROR][${module}]`, message);
      if (error instanceof Error) {
        console.error(`  Stack: ${error.stack}`);
      } else if (error) {
        console.error(`  Details:`, error);
      }
    }
  },
};

// ─── CUSTOM ERROR CLASSES ────────────────────────────────────

/**
 * Application-level error with HTTP status code and structured data.
 */
export class AppError extends Error {
  /**
   * @param {string} message - Human-readable error message
   * @param {number} status - HTTP status code (default 500)
   * @param {string} code - Machine-readable error code
   * @param {Object} [data] - Additional structured data
   */
  constructor(message, status = 500, code = "INTERNAL_ERROR", data = {}) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

export class NotFoundError extends AppError {
  constructor(resource, id) {
    super(`${resource} not found: ${id}`, 404, "NOT_FOUND", { resource, id });
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message, fields = {}) {
    super(message, 400, "VALIDATION_ERROR", { fields });
    this.name = "ValidationError";
  }
}

export class ShopifyApiError extends AppError {
  constructor(message, shopifyResponse = null) {
    super(message, 502, "SHOPIFY_API_ERROR", { shopifyResponse });
    this.name = "ShopifyApiError";
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, "AUTHENTICATION_ERROR");
    this.name = "AuthenticationError";
  }
}

// ─── ERROR RESPONSE HELPERS ──────────────────────────────────

/**
 * Convert any error into a Remix json() response.
 * Use in loader/action catch blocks.
 *
 * @param {Error} error
 * @returns {Response} Remix json response with appropriate status
 */
export function errorResponse(error) {
  if (error instanceof AppError) {
    return json(
      { error: error.message, code: error.code, data: error.data },
      { status: error.status }
    );
  }

  // Unknown error — log it and return generic 500
  logger.error("errorResponse", "Unhandled error", error);
  return json(
    { error: "An unexpected error occurred", code: "INTERNAL_ERROR" },
    { status: 500 }
  );
}

// ─── SAFE WRAPPERS ───────────────────────────────────────────

/**
 * Wrap a loader/action function with try-catch and structured logging.
 * Returns mock/fallback data on error so the page still renders.
 *
 * @param {string} routeName - Route identifier for logging
 * @param {Function} fn - The async loader/action function
 * @param {*} fallbackData - Data to return if fn throws
 * @returns {Function} Wrapped function
 */
export function safeLoader(routeName, fn, fallbackData = null) {
  return async (args) => {
    try {
      return await fn(args);
    } catch (error) {
      logger.error(routeName, "Loader error", error);

      if (fallbackData !== null) {
        logger.warn(routeName, "Returning fallback data due to error");
        return json(fallbackData);
      }

      return errorResponse(error);
    }
  };
}

/**
 * Wrap a Shopify API call with retry logic and error handling.
 *
 * @param {string} operation - Description for logging
 * @param {Function} apiCall - Async function making the API call
 * @param {number} maxRetries - Max retry attempts (default 2)
 * @returns {*} API call result
 */
export async function withRetry(operation, apiCall, maxRetries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        logger.info("retry", `Retrying ${operation} (attempt ${attempt + 1}/${maxRetries + 1})`);
        await new Promise((r) => setTimeout(r, 1000 * attempt)); // exponential-ish backoff
      }
      return await apiCall();
    } catch (error) {
      lastError = error;
      logger.warn("retry", `${operation} failed (attempt ${attempt + 1})`, error.message);

      // Don't retry on 4xx errors (client errors)
      if (error.status >= 400 && error.status < 500) {
        throw error;
      }
    }
  }
  throw lastError;
}

// ─── INPUT VALIDATION HELPERS ────────────────────────────────

/**
 * Validate and sanitise a customer ID from request params.
 * @param {string} id
 * @returns {string} Validated ID
 * @throws {ValidationError}
 */
export function validateCustomerId(id) {
  if (!id || typeof id !== "string") {
    throw new ValidationError("Customer ID is required");
  }
  // In prototype mode, IDs look like "cust_001"
  // In production, they'll be Shopify GIDs or UUIDs
  if (id.length > 100) {
    throw new ValidationError("Customer ID is too long");
  }
  return id.trim();
}

/**
 * Validate a collection type string.
 * @param {string} type
 * @returns {string} Validated collection type
 * @throws {ValidationError}
 */
export function validateCollectionType(type) {
  const valid = ["lucite", "10mm", "25.4mm", "50mm", "ampoules"];
  if (!valid.includes(type)) {
    throw new ValidationError(`Invalid collection type: "${type}"`, {
      validTypes: valid,
    });
  }
  return type;
}
