/**
 * Onboarding layout — wraps all /onboarding/* routes.
 * Provides the data router context that child routes need for useLoaderData.
 */
import { Outlet } from "@remix-run/react";

export default function OnboardingLayout() {
  return <Outlet />;
}
