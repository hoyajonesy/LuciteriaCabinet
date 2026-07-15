/**
 * Root index — Landing page / auth-aware entry point.
 * Matches wireframe: homepage-landing.html

 * - Not logged in → show landing page
 * - Logged in but onboarding incomplete → redirect to next onboarding step
 * - Logged in and onboarding complete → redirect to dashboard
 */
import { json, redirect } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { getUserId } from "../lib/session.server";
import { getUserById } from "../lib/auth.server";
import ConsumerHeader from "../components/ConsumerHeader";
import ConsumerFooter from "../components/ConsumerFooter";

export const loader = async ({ request }) => {
  const userId = await getUserId(request);
  if (userId) {
    const user = await getUserById(userId);
    if (user) {
      if (user.onboardingCompleted) return redirect("/app/cabinet");
      const stepRoutes = {
        1: "/onboarding/welcome",
        2: "/onboarding/collection-goal",
        3: "/onboarding/log-owned",
        4: "/onboarding/complete",
      };
      return redirect(stepRoutes[user.onboardingStep] || "/onboarding/welcome");
    }
  }
  return json({});
};


const STATS = [
  { value: "85+", label: "Elements Available" },
  { value: "10+", label: "Years of Expertise" },
  { value: "20k", label: "Happy Collectors" },
];

const BENEFITS = [
  { icon: "fa-table-cells", title: "Track & manage", body: "Keep every owned element organized in one beautiful collection." },
  { icon: "fa-magnifying-glass", title: "Discover new elements", body: "Find the missing pieces and grow your set toward completion." },
  { icon: "fa-share-nodes", title: "Share your wishlist", body: "Send a wishlist link to friends and family with one tap." },
  { icon: "fa-trophy", title: "Unlock milestones", body: "Earn achievements and watch your progress climb over time." },
];

const HERO_TILES = [
  { sym: "H", accent: false }, { sym: "He", accent: true }, { sym: "Li", accent: false },
  { sym: "Be", accent: false }, { sym: "B", accent: true }, { sym: "C", accent: false },
  { sym: "N", accent: false }, { sym: "O", accent: true }, { sym: "F", accent: false },
  { sym: "Ne", accent: false }, { sym: "Na", accent: true }, { sym: "Mg", accent: false },
  { sym: "Al", accent: false }, { sym: "Si", accent: true }, { sym: "P", accent: false },
  { sym: "Fe", accent: true }, { sym: "Cu", accent: false }, { sym: "Au", accent: true },
];

export default function Index() {
  return (
    <div className="min-h-screen bg-white font-sans text-luc-text">
      <ConsumerHeader ctaTo="/onboarding/welcome?mode=login" ctaLabel="Sign In" />

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-container px-5 py-10 sm:px-page sm:py-14">
          <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2">
            {/* Left panel */}
            <div className="flex flex-col justify-center rounded-card bg-luc-gray p-8 sm:p-12">
              <span className="mb-5 inline-block w-fit rounded-full border border-luc-border bg-white px-4 py-1.5 text-sm text-luc-text">
                The #1 Source for Element Collectors
              </span>
              <h1 className="luc-heading mb-5 text-4xl font-normal leading-tight sm:text-5xl md:text-6xl">
                The Digital Home for Your Element Collection
              </h1>
              <p className="mb-8 max-w-md text-lg leading-relaxed text-luc-text">
                Track, organize, and grow your collection of pure elements, precision cubes,
                and rare displays — all in one place.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link to="/onboarding/welcome?mode=login" className="btn-primary">
                  <i className="fa-brands fa-shopify" /> Get Started
                </Link>
                <Link to="/onboarding/welcome?mode=signup" className="btn-outline">
                  Create Account
                </Link>
              </div>
              <p className="mt-4 text-sm text-luc-muted">
                <i className="fa-solid fa-circle-info mr-1.5" />
                New here? You'll set up your account in under a minute.
              </p>
            </div>

            {/* Right panel — periodic table motif */}
            <div className="flex min-h-[320px] items-center justify-center rounded-card bg-luc-bluegray p-8 sm:p-12">
              <div className="grid grid-cols-6 gap-2 sm:gap-3">
                {HERO_TILES.map((t, i) => (
                  <div
                    key={i}
                    className={`flex aspect-square w-12 items-center justify-center rounded-btn text-sm font-medium sm:w-14 ${t.accent
                      ? "bg-luc-blue text-white"
                      : "bg-white text-luc-ink shadow-card"
                      }`}
                  >
                    {t.sym}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Stats bar */}
        <section className="mx-auto max-w-container px-5 py-8 sm:px-page">
          <div className="grid grid-cols-3 gap-4">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <p className="luc-heading text-3xl font-bold sm:text-5xl">{s.value}</p>
                <p className="mt-1 text-xs text-luc-text sm:text-sm">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Benefits */}
        <section className="mx-auto max-w-container px-5 py-section sm:px-page">
          <h2 className="luc-heading mb-2 text-center text-3xl font-medium sm:text-4xl">
            Everything you need to manage your collection
          </h2>
          <p className="mb-10 text-center text-base text-luc-muted">
            One place to track, discover, share, and celebrate your progress.
          </p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((b) => (
              <article key={b.title} className="luc-card text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-btn-lg bg-luc-blue text-xl text-white">
                  <i className={`fa-solid ${b.icon}`} />
                </div>
                <h3 className="luc-heading mb-2 text-lg font-medium">{b.title}</h3>
                <p className="text-sm leading-relaxed text-luc-text">{b.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Why Luciteria band */}
        <section className="mx-auto max-w-container px-5 sm:px-page">
          <div className="rounded-card bg-luc-bluegray px-6 py-section sm:px-page">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="luc-heading mb-4 text-3xl font-medium sm:text-4xl">Why Luciteria?</h2>
              <p className="text-base leading-relaxed text-luc-text">
                The broadest selection of elements, sourced from trusted labs and held to high
                standards. From beginners to experts — we make it easy to collect the periodic
                table the way you want to, with worldwide shipping to just about anywhere.
              </p>
            </div>
          </div>
        </section>

        {/* CTA strip */}
        <section className="mx-auto max-w-container px-5 py-section sm:px-page">
          <div className="flex flex-col items-center gap-5 rounded-card bg-luc-gray px-6 py-12 text-center sm:px-page">
            <h2 className="luc-heading text-2xl font-medium sm:text-3xl">
              Ready to build your collection?
            </h2>
            <p className="max-w-lg text-base text-luc-text">
              Join thousands of collectors and start tracking your elements today.
            </p>
            <Link to="/onboarding/welcome?mode=login" className="btn-primary">
              <i className="fa-brands fa-shopify" /> Get Started with Shopify
            </Link>
          </div>
        </section>
      </main>

      <ConsumerFooter />
    </div>
  );
}
