import { json, redirect } from "@remix-run/node";
import { useActionData, Form, useNavigation, useLoaderData, Link } from "@remix-run/react";
import { useState } from "react";
import { getUserByResetToken, resetPasswordWithToken } from "../lib/auth.server";

function validatePasswordStrength(password) {
  if (!password || password.length < 8) {
    return "Password must be at least 8 characters.";
  }
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  if (!hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
    return "Password must include at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.";
  }
  return null;
}

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return json({ valid: false, error: "Missing password reset token." }, { status: 400 });
  }

  const user = await getUserByResetToken(token);
  if (!user) {
    return json({ valid: false, error: "This password reset link is invalid or has expired." }, { status: 400 });
  }

  return json({ valid: true, email: user.email, token });
};

export const action = async ({ request }) => {
  const formData = await request.formData();
  const token = formData.get("token");
  const password = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");

  if (!token) {
    return json({ error: "Token is required." }, { status: 400 });
  }

  // Validate passwords match
  if (password !== confirmPassword) {
    return json({ error: "Passwords do not match." }, { status: 400 });
  }

  // Validate password strength
  const strengthError = validatePasswordStrength(password);
  if (strengthError) {
    return json({ error: strengthError }, { status: 400 });
  }

  const result = await resetPasswordWithToken(token, password);
  if (!result.success) {
    return json({ error: result.error || "Failed to reset password." }, { status: 400 });
  }

  // Redirect to login page upon success
  return redirect("/onboarding/welcome?mode=login&resetSuccess=true");
};

export default function ResetPassword() {
  const { valid, error, token, email } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const canSubmit = password.length >= 8 && confirmPassword.length >= 8;

  if (!valid) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-luc-gray px-5 py-16 font-sans text-luc-text">
        <section className="w-full max-w-[560px] rounded-card border border-luc-border bg-white p-8 shadow-card sm:p-10 text-center">
          <div className="mb-8 flex flex-col items-center">
            <img src="/logo.png" alt="Luciteria Science" className="h-10 w-auto" />
          </div>

          <div className="mb-6 rounded-full bg-red-50 p-4 inline-block text-red-500">
            <i className="fa-solid fa-triangle-exclamation text-3xl" />
          </div>

          <h1 className="luc-heading mb-2 text-3xl font-medium text-luc-text">
            Link Expired or Invalid
          </h1>
          <p className="mb-8 text-base text-luc-muted">
            {error || "This password reset link is invalid or has expired."}
          </p>

          <Link
            to="/onboarding/welcome?mode=forgot"
            className="btn-primary inline-block w-full text-center"
          >
            Request a New Reset Link
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-luc-gray px-5 py-16 font-sans text-luc-text">
      <section className="w-full max-w-[560px] rounded-card border border-luc-border bg-white p-8 shadow-card sm:p-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src="/logo.png" alt="Luciteria Science" className="h-10 w-auto" />
        </div>

        <h1 className="luc-heading mb-2 text-center text-3xl font-medium">
          Reset Password
        </h1>
        <p className="mb-8 text-center text-base text-luc-muted">
          Enter a secure new password for your account <strong>{email}</strong>.
        </p>

        {actionData?.error && (
          <div className="mb-5 rounded-btn border border-luc-border bg-luc-gray px-3 py-2 text-sm text-luc-text">
            <i className="fa-solid fa-triangle-exclamation mr-1 text-luc-orange" />
            {actionData.error}
          </div>
        )}

        <Form method="post" className="space-y-5">
          <input type="hidden" name="token" value={token} />

          <div>
            <label className="mb-1.5 block text-sm font-medium text-luc-text">
              New Password <span className="text-luc-orange">*</span>
            </label>
            <input
              name="password"
              type="password"
              placeholder="At least 8 characters"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-btn border-[1.5px] border-luc-border bg-white px-4 py-3 text-base text-luc-text focus:border-luc-blue focus:outline-none"
            />
            <p className="mt-1.5 text-xs text-luc-muted">
              Must include at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-luc-text">
              Confirm Password <span className="text-luc-orange">*</span>
            </label>
            <input
              name="confirmPassword"
              type="password"
              placeholder="Repeat your new password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-btn border-[1.5px] border-luc-border bg-white px-4 py-3 text-base text-luc-text focus:border-luc-blue focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !canSubmit}
            className="btn-primary w-full"
          >
            {isSubmitting ? "Updating password…" : "Reset Password"}
          </button>
        </Form>

        <p className="text-center text-sm text-luc-muted mt-6">
          Back to{" "}
          <Link to="/onboarding/welcome?mode=login" className="font-medium text-luc-blue underline">
            Log In
          </Link>
        </p>
      </section>
    </main>
  );
}
