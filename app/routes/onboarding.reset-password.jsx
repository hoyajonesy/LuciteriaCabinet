/**
 * Password reset — Step 2: choose a new password.
 *
 * GET  validates the ?token= query param; shows an error if invalid/expired.
 * POST verifies the token + password confirmation and updates the password,
 *      then redirects to the login page with a success flag.
 */
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation } from "@remix-run/react";
import { getUserByResetToken, resetPasswordWithToken } from "../lib/auth.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  const user = token ? await getUserByResetToken(token) : null;
  return json({ token, valid: Boolean(user) });
};

export const action = async ({ request }) => {
  const formData = await request.formData();
  const token = String(formData.get("token") || "");
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirmPassword") || "");

  if (password !== confirm) {
    return json({ error: "Passwords do not match." }, { status: 400 });
  }

  const result = await resetPasswordWithToken(token, password);
  if (!result.success) {
    return json({ error: result.error }, { status: 400 });
  }

  // Password reset users have already completed onboarding — send them to the
  // LOGIN screen (not the signup/onboarding flow) with a success flag.
  return redirect("/onboarding/welcome?mode=login&resetSuccess=true");
};

export default function ResetPassword() {
  const { token, valid } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <main className="flex min-h-screen items-center justify-center bg-luc-gray px-5 py-16 font-sans text-luc-text">
      <section className="w-full max-w-[480px] rounded-card border border-luc-border bg-white p-8 shadow-card sm:p-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src="/logo.png" alt="Luciteria Science" className="h-10 w-auto" />
        </div>

        <h1 className="luc-heading mb-2 text-center text-3xl font-medium">Choose a new password</h1>

        {!valid ? (
          <>
            <div className="mb-6 rounded-btn border border-luc-border bg-luc-gray px-4 py-3 text-sm text-luc-text">
              <i className="fa-solid fa-triangle-exclamation mr-1 text-luc-orange" />
              This reset link is invalid or has expired. Please request a new one.
            </div>
            <p className="text-center text-sm text-luc-muted">
              <a href="/onboarding/forgot-password" className="font-medium text-luc-blue underline">
                Request a new reset link
              </a>
            </p>
          </>
        ) : (
          <>
            <p className="mb-8 text-center text-base text-luc-muted">
              Enter a new password for your account.
            </p>
            {actionData?.error && (
              <div className="mb-5 rounded-btn border border-luc-border bg-luc-gray px-3 py-2 text-sm text-luc-text">
                <i className="fa-solid fa-triangle-exclamation mr-1 text-luc-orange" />
                {actionData.error}
              </div>
            )}
            <Form method="post" className="space-y-5 mb-6">
              <input type="hidden" name="token" value={token} />
              <div>
                <label className="mb-1.5 block text-sm font-medium text-luc-text">
                  New password <span className="text-luc-orange">*</span>
                </label>
                <input
                  name="password"
                  type="password"
                  placeholder="Min 6 characters"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full rounded-btn border-[1.5px] border-luc-border bg-white px-4 py-3 text-base text-luc-text focus:border-luc-blue focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-luc-text">
                  Confirm new password <span className="text-luc-orange">*</span>
                </label>
                <input
                  name="confirmPassword"
                  type="password"
                  placeholder="Re-enter your new password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className="w-full rounded-btn border-[1.5px] border-luc-border bg-white px-4 py-3 text-base text-luc-text focus:border-luc-blue focus:outline-none"
                />
              </div>
              <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
                {isSubmitting ? "Updating..." : "Update password"}
              </button>
            </Form>
          </>
        )}
      </section>
    </main>
  );
}
