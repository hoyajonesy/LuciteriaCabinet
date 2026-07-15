import { json } from "@remix-run/node";
import { Link } from "@remix-run/react";
import ConsumerHeader from "../components/ConsumerHeader";
import ConsumerFooter from "../components/ConsumerFooter";

export const loader = async () => {
  return null;
};

export default function CatchAll() {
  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-luc-text">
      <ConsumerHeader ctaTo="/onboarding/welcome?mode=login" ctaLabel="Sign In" />

      <main className="flex-grow bg-luc-gray py-20">
        <div className="mx-auto max-w-container px-5 sm:px-page">
          <div className="mx-auto max-w-md rounded-card bg-white p-8 text-center border border-luc-border shadow-card">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-btn-lg bg-luc-blue/10 text-3xl text-luc-blue font-bold">
              404
            </div>
            <h1 className="luc-heading mb-3 text-3xl font-medium">Page Not Found</h1>
            <p className="mb-8 text-base leading-relaxed text-luc-text">
              The page you are looking for might have been moved, had its name changed, or is temporarily unavailable.
            </p>
            <div className="flex flex-col gap-3">
              <Link to="/" className="btn-primary w-full py-3 text-center text-sm font-semibold rounded-btn transition-colors duration-200">
                Go to Cabinet Home
              </Link>
              <a
                href="https://luciteria.com"
                target="_blank"
                rel="noreferrer"
                className="btn-outline w-full py-3 text-center text-sm font-semibold rounded-btn transition-colors duration-200"
              >
                Go to Storefront
              </a>
            </div>
          </div>
        </div>
      </main>

      <ConsumerFooter />
    </div>
  );
}
