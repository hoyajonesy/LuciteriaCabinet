/**
 * Database client singleton for server-side use.
 * Prevents multiple PrismaClient instances in development.
 * 
 * Note: Prisma Client is lazy and only connects on first query.
 * If DATABASE_URL is missing, we provide a stub to prevent build errors.
 */
import { PrismaClient } from "@prisma/client";

let prisma;

// Safety check: if DATABASE_URL is not set, create a stub client that will fail
// gracefully at runtime (but won't block the build)
if (!process.env.DATABASE_URL) {
  console.warn('[db.server.js] DATABASE_URL not set - database operations will fail');
  // Create a proxy that throws helpful errors if any DB operation is attempted
  prisma = new Proxy({}, {
    get(target, prop) {
      throw new Error(`Database operation "${String(prop)}" attempted but DATABASE_URL is not configured`);
    }
  });
} else if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient({
    log: ['error'],
  });
} else {
  // Reuse client in dev to avoid "too many connections" in hot reload
  if (!global.__prisma) {
    global.__prisma = new PrismaClient({
      log: ['error'],
    });
  }
  prisma = global.__prisma;
}

export { prisma };
