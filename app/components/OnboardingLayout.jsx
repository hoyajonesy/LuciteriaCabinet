/**
 * OnboardingLayout — wraps all onboarding steps with a progress indicator.
 * Restyled to match the Shopify "Live Working Theme": white surface,
 * DM Sans headings, Inter body, blue (#5781D8) accent, large rounded cards.
 */
import { Link } from "@remix-run/react";

const STEPS = [
  { num: 1, label: "Account" },
  { num: 2, label: "Motivation" },
  { num: 3, label: "Collection" },
];

export default function OnboardingLayout({ step = 1, hideProgress = false, children }) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-luc-gray px-5 py-10 font-sans text-luc-text sm:py-14">
      <div className="w-full max-w-2xl">
        {/* Branding */}
        <Link to="/" className="mb-8 flex items-center justify-center" aria-label="Luciteria Science home">
          <img src="/logo.png" alt="Luciteria Science" className="h-10 w-auto" />
        </Link>

        {/* Progress indicator */}
        {!hideProgress && (
          <div className="mb-8 flex items-center justify-center">
            {STEPS.map((s, idx) => {
              const done = s.num < step;
              const active = s.num === step;
              return (
                <div key={s.num} className="flex items-center">
                  <div className="flex items-center gap-2">
                    <div
                      className={[
                        "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-bold transition-colors",
                        done
                          ? "border-2 border-luc-blue bg-luc-blue text-white"
                          : active
                          ? "border-2 border-luc-blue bg-white text-luc-blue shadow-[0_0_0_3px_rgba(87,129,216,0.15)]"
                          : "border-2 border-luc-border bg-white text-luc-muted",
                      ].join(" ")}
                    >
                      {done ? "✓" : s.num}
                    </div>
                    <span
                      className={[
                        "whitespace-nowrap text-xs",
                        s.num <= step ? "font-semibold text-luc-blue" : "text-luc-muted",
                      ].join(" ")}
                    >
                      {s.label}
                    </span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div
                      className={[
                        "mx-2 h-0.5 w-7 flex-shrink-0 rounded",
                        s.num < step ? "bg-luc-blue" : "bg-luc-border",
                      ].join(" ")}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Step content */}
        <div className="min-h-[300px] rounded-card border border-luc-border bg-white p-6 shadow-card sm:p-9">
          {children}
        </div>

        {/* Footer */}
        {!hideProgress && (
          <div className="mt-5 text-center">
            <span className="text-xs text-luc-muted">
              Step {step} of 3 · Your data is saved automatically
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
