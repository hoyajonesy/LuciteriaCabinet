/**
 * Password reset — Step 1: request a reset link.
 *
 * GET  renders an email form.
 * POST creates a one-time reset token (no account enumeration) and emails a
 *      reset link. Always shows a generic success message.
 */
import { json } from "@remix-run/node";
import { useActionData, Form, useNavigation } from "@remix-run/react";
import { createPasswordResetToken } from "../lib/auth.server";
import { sendEmail } from "../lib/notifications.server";

export const action = async ({ request }) => {
  const formData = await request.formData();
  const email = String(formData.get("email") || "").trim();

  // Always return the same generic response to avoid revealing whether an
  // account exists for this email address.
  const generic = json({ sent: true });

  if (!email) return generic;

  try {
    const { rawToken, user } = await createPasswordResetToken(email);
    if (rawToken && user) {
      // Derive the public origin from forwarded headers (behind Vercel proxy),
      // falling back to the request URL.
      const forwardedHost = request.headers.get("x-forwarded-host");
      const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
      const origin = forwardedHost
        ? `${forwardedProto}://${forwardedHost}`
        : new URL(request.url).origin;
      const linkUrl = `${origin}/onboarding/reset-password?token=${rawToken}`;

      await sendEmail({
        to: user.email,
        subject: "Reset your Luciteria Collector Cabinet password",
        template: "password_reset",
        data: {
          customerName: user.firstName || user.name || "Collector",
          body: "We received a request to reset the password for your Collector Cabinet account. Click the link below to choose a new password. This link expires in 1 hour. If you didn't request this, you can safely ignore this email.",
          linkUrl,
        },
        customerId: user.id,
      });
    }
  } catch (err) {
    console.error("[forgot-password] error:", err);
    // Still return generic success — do not leak internal errors.
  }

  return generic;
};

export default function ForgotPassword() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <main className="flex min-h-screen items-center justify-center bg-luc-gray px-5 py-16 font-sans text-luc-text">
      <section className="w-full max-w-[480px] rounded-card border border-luc-border bg-white p-8 shadow-card sm:p-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src="/logo.png" alt="Luciteria Science" className="h-10 w-auto" />
        </div>

        <h1 className="luc-heading mb-2 text-center text-3xl font-medium">Reset your password</h1>

        {actionData?.sent ? (
          <>
            <div className="mb-6 rounded-btn border border-luc-border bg-luc-gray px-4 py-3 text-sm text-luc-text">
              <i className="fa-solid fa-circle-check mr-1 text-luc-blue" />
              If an account exists for that email, we've sent a link to reset your
              password. Please check your inbox (and spam folder). The link expires in
              1 hour.
            </div>
            <p className="text-center text-sm text-luc-muted">
              <a href="/onboarding/welcome" className="font-medium text-luc-blue underline">
                Back to log in
              </a>
            </p>
          </>
        ) : (
          <>
            <p className="mb-8 text-center text-base text-luc-muted">
              Enter your account email and we'll send you a link to reset your password.
            </p>
            <Form method="post" className="space-y-5 mb-6">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-luc-text">
                  Email <span className="text-luc-orange">*</span>
                </label>
                <input
                  name="email"
                  type="email"
                  placeholder="collector@example.com"
                  required
                  autoComplete="email"
                  className="w-full rounded-btn border-[1.5px] border-luc-border bg-white px-4 py-3 text-base text-luc-text focus:border-luc-blue focus:outline-none"
                />
              </div>
              <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
                {isSubmitting ? "Sending..." : "Send reset link"}
              </button>
            </Form>
            <p className="text-center text-sm text-luc-muted">
              Remembered it?{" "}
              <a href="/onboarding/welcome" className="font-medium text-luc-blue underline">
                Back to log in
              </a>
            </p>
          </>
        )}
      </section>
    </main>
  );
}
