/**
 * Onboarding Step 1 — Welcome / Account Creation
 * 
 * Provides both Sign Up and Log In flows with a toggle.
 * On success: creates user session and redirects to Step 2.
 * 
 * TODO PRODUCTION: Replace with Shopify OAuth login flow.
 * This page becomes unnecessary — Shopify handles authentication.
 */
import { json, redirect } from "@remix-run/node";
import { useActionData, Form, useNavigation, useSearchParams } from "@remix-run/react";
import { useState, useEffect } from "react";
import { createUser, verifyLogin, getUserById } from "../lib/auth.server";
import { getUserId, createUserSession } from "../lib/session.server";

export const loader = async ({ request }) => {
  // If already logged in, redirect appropriately
  const userId = await getUserId(request);
  if (userId) {
    const user = await getUserById(userId);
    if (user) {
      if (user.onboardingCompleted) return redirect("/app/cabinet");
      // Resume onboarding at correct step
      const stepRoutes = {
        1: "/onboarding/welcome",
        2: "/onboarding/collection-goal",
        3: "/onboarding/log-owned",
        4: "/onboarding/complete",
      };
      return redirect(stepRoutes[user.onboardingStep] || "/onboarding/collection-goal");
    }
  }
  return json({});
};

export const action = async ({ request }) => {
  const formData = await request.formData();
  const intent = formData.get("intent"); // "signup" or "login"
  const email = formData.get("email");
  const password = formData.get("password");
  const firstName = formData.get("firstName");
  const lastName = formData.get("lastName");

  if (intent === "signup") {
    const { user, error } = await createUser({ email, password, firstName, lastName });
    if (error) {
      // Detect the "already registered" case so the UI can offer a Log In shortcut.
      const emailTaken = /already exists|already been taken|already registered/i.test(error);
      return json({ error, intent: "signup", emailTaken }, { status: 400 });
    }
    return createUserSession(user.id, "/onboarding/collection-goal");
  }

  if (intent === "login") {
    const { user, error } = await verifyLogin({ email, password });
    if (error) return json({ error, intent: "login" }, { status: 400 });

    // Redirect based on onboarding state
    if (user.onboardingCompleted) {
      return createUserSession(user.id, "/app/cabinet");
    }
    // Resume onboarding at their current step
    const stepRoutes = {
      1: "/onboarding/welcome",
      2: "/onboarding/collection-goal",
      3: "/onboarding/log-owned",
      4: "/onboarding/complete",
    };
    return createUserSession(user.id, stepRoutes[user.onboardingStep] || "/onboarding/collection-goal");
  }

  return json({ error: "Invalid request." }, { status: 400 });
};


export default function OnboardingWelcome() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [searchParams] = useSearchParams();
  const queryMode = searchParams.get("mode");
  // Show a confirmation after a successful password reset. Accept both the
  // current flag (?resetSuccess=true) and the legacy one (?reset=success).
  const resetSuccess =
    searchParams.get("resetSuccess") === "true" || searchParams.get("reset") === "success";

  const [mode, setMode] = useState(() => {
    if (actionData?.intent) return actionData.intent;
    if (resetSuccess) return "login";
    return queryMode === "login" ? "login" : "signup";
  });

  useEffect(() => {
    if (!actionData?.intent && (queryMode || resetSuccess)) {
      setMode(queryMode === "login" || resetSuccess ? "login" : "signup");
    }
  }, [queryMode, actionData, resetSuccess]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const canContinue =
    mode === "signup"
      ? firstName.trim() && lastName.trim() && email.trim() && password.length >= 6
      : email.trim() && password.length >= 1;

  return (
    <main className="flex min-h-screen items-center justify-center bg-luc-gray px-5 py-16 font-sans text-luc-text">
      <section className="w-full max-w-[560px] rounded-card border border-luc-border bg-white p-8 shadow-card sm:p-10">
        {/* Step indicator */}
        {mode === "signup" && (
          <div className="mb-8 flex items-center justify-between">
            <span className="inline-block rounded-full border border-luc-border bg-luc-gray px-3 py-1 text-sm text-luc-text">
              Step 1 of 3
            </span>
            <div className="flex gap-1.5">
              <span className="h-1.5 w-8 rounded bg-luc-blue" />
              <span className="h-1.5 w-8 rounded bg-luc-border" />
              <span className="h-1.5 w-8 rounded bg-luc-border" />
            </div>
          </div>
        )
        }
        {/* Logo / branding */}
        <div className="mb-8 flex flex-col items-center text-center">
          <img src="/logo.png" alt="Luciteria Science" className="h-10 w-auto" />
        </div>

        <h1 className="luc-heading mb-2 text-center text-3xl font-medium">
          {mode === "signup" ? "Welcome to Collector Cabinet" : "Welcome back"}
        </h1>
        <p className="mb-8 text-center text-base text-luc-muted">
          {mode === "signup" ? "Let's set up your collection profile." : "Log in to continue your collection."}
        </p>

        {resetSuccess && !actionData?.error && (
          <div className="mb-5 rounded-btn border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            <i className="fa-solid fa-circle-check mr-1 text-green-500" />
            Password updated successfully, please log in.
          </div>
        )}

        {actionData?.error && (
          <div className="mb-5 rounded-btn border border-luc-border bg-luc-gray px-3 py-2 text-sm text-luc-text">
            <i className="fa-solid fa-triangle-exclamation mr-1 text-luc-orange" />
            {actionData.emailTaken ? "This account already exists." : actionData.error}
            {actionData.emailTaken && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="font-medium text-luc-blue underline"
                >
                  Go to Log In
                </button>
              </>
            )}
          </div>
        )}

        <Form method="post" className="space-y-5 mb-6">
          <input type="hidden" name="intent" value={mode} />

          {mode === "signup" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-luc-text">
                  First Name <span className="text-luc-orange">*</span>
                </label>
                <input
                  name="firstName"
                  type="text"
                  placeholder="Chris"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  className="w-full rounded-btn border-[1.5px] border-luc-border bg-white px-4 py-3 text-base text-luc-text focus:border-luc-blue focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-luc-text">
                  Last Name <span className="text-luc-orange">*</span>
                </label>
                <input
                  name="lastName"
                  type="text"
                  placeholder="Your last name"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                  className="w-full rounded-btn border-[1.5px] border-luc-border bg-white px-4 py-3 text-base text-luc-text focus:border-luc-blue focus:outline-none"
                />
              </div>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-luc-text">
              Email <span className="text-luc-orange">*</span>
            </label>
            <input
              name="email"
              type="email"
              placeholder="collector@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="w-full rounded-btn border-[1.5px] border-luc-border bg-white px-4 py-3 text-base text-luc-text focus:border-luc-blue focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-luc-text">
              Password <span className="text-luc-orange">*</span>
            </label>
            <input
              name="password"
              type="password"
              placeholder={mode === "signup" ? "Min 6 characters" : "Your password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className="w-full rounded-btn border-[1.5px] border-luc-border bg-white px-4 py-3 text-base text-luc-text focus:border-luc-blue focus:outline-none"
            />
            {mode === "login" && (
              <div className="mt-1.5 text-right">
                <a href="/onboarding/forgot-password" className="text-sm font-medium text-luc-blue underline">
                  Forgot password?
                </a>
              </div>
            )}
          </div>

          <p className="text-xs text-luc-muted">
            <i className="fa-solid fa-circle-info mr-1" /> All fields are required to continue.
          </p>

          <button
            type="submit"
            disabled={isSubmitting || !canContinue}
            className="btn-primary w-full"
          >
            {isSubmitting ? "Please wait…" : "Continue →"}
          </button>
        </Form>

        <p className="text-center text-sm text-luc-muted">
          {mode === "signup" ? (
            <>
              Already have an account?{" "}
              <button onClick={() => setMode("login")} className="font-medium text-luc-blue underline">
                Log In
              </button>
            </>
          ) : (
            <>
              New here?{" "}
              <button onClick={() => setMode("signup")} className="font-medium text-luc-blue underline">
                Create Account
              </button>
            </>
          )}
        </p>
      </section>
    </main>
  );
}
