/**
 * Frozen Guard — Checks if a user account is frozen.
 * Returns frozen status for loaders (to show banner).
 * Rejects mutations (actions) with a 403 for frozen users.
 */
import { json } from "@remix-run/node";
import { prisma } from "./db.server.js";

/**
 * Check if user is frozen. For use in loaders.
 * Returns { isFrozen, freezeReason }
 */
export async function checkFrozenStatus(userId) {
  if (!userId) return { isFrozen: false, freezeReason: null };
  
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true, freezeReason: true },
  });
  
  return {
    isFrozen: user?.status === "frozen",
    freezeReason: user?.freezeReason || null,
  };
}

/**
 * Guard for actions — throws 403 JSON if user is frozen.
 * Use at the top of action functions that modify data.
 */
export async function requireNotFrozen(userId) {
  const { isFrozen } = await checkFrozenStatus(userId);
  if (isFrozen) {
    throw json(
      { error: "Your account is frozen. Contact support@luciteria.com to restore access." },
      { status: 403 }
    );
  }
}
