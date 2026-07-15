/**
 * Database client singleton for server-side use.
 * Prevents multiple PrismaClient instances in development.
 */
import { PrismaClient } from "@prisma/client";

let prisma;

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  // Reuse client in dev to avoid "too many connections" in hot reload
  if (!global.__prisma) {
    global.__prisma = new PrismaClient();
  }
  prisma = global.__prisma;
}

export { prisma };
