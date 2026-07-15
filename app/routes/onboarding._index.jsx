/**
 * Onboarding index — /onboarding
 *
 * The `/onboarding` path has no UI of its own; the layout route
 * (onboarding.jsx) only renders an <Outlet />. Without an index
 * route, visiting `/onboarding` directly rendered a blank, dead
 * page (the form appeared "greyed out / non-interactive" because
 * nothing was actually mounted there).
 *
 * This index resolves the entry point by sending visitors to the
 * first real step. `onboarding.welcome` then handles all session /
 * progress-aware redirects (resume at the correct step, or jump to
 * /app/cabinet when onboarding is already complete).
 */
import { redirect } from "@remix-run/node";

export const loader = () => redirect("/onboarding/welcome");

export default function OnboardingIndex() {
  return null;
}
