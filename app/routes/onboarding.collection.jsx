/**
 * Legacy/duplicate onboarding step — REMOVED from the 4-step flow.
 *
 * The "What Do You Already Own?" experience now lives at
 * /onboarding/log-owned. This route only redirects there so any old
 * links or bookmarks keep working.
 */
import { redirect } from "@remix-run/node";
import { getUserById } from "../lib/auth.server";
import { requireUserId } from "../lib/session.server";

export const loader = async ({ request }) => {
  const userId = await requireUserId(request);
  const user = await getUserById(userId);
  if (!user) return redirect("/onboarding/welcome");
  if (user.onboardingCompleted) return redirect("/app/cabinet");
  return redirect("/onboarding/log-owned");
};

export const action = async ({ request }) => {
  const userId = await requireUserId(request);
  const user = await getUserById(userId);
  if (!user) return redirect("/onboarding/welcome");
  return redirect("/onboarding/log-owned");
};
