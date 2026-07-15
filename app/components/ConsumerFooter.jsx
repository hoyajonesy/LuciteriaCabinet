/**
 * ConsumerFooter — minimal app-specific footer for consumer-facing pages.
 * Matches the Shopify theme footer: dark charcoal (#333) background,
 * white headings, muted gray links, responsive column stacking.
 */
import { Link } from "@remix-run/react";

const COLUMNS = [
  {
    heading: "Collector Cabinet",
    links: [
      { label: "Dashboard", to: "/app/cabinet", internal: true },
      { label: "My Collection", to: "/app/cabinet/periodic-table", internal: true },
      { label: "Wishlist", to: "/app/cabinet/wishlist", internal: true },
      { label: "Shop", to: "/app/cabinet/shop", internal: true },
    ],
  },
  {
    heading: "Luciteria Science",
    links: [
      { label: "Elements", href: "https://luciteria.com/collections/elements" },
      { label: "Lucite Cubes", href: "https://luciteria.com/collections/lucite" },
      { label: "Bullion", href: "https://luciteria.com/collections/bullion" },
      { label: "Displays", href: "https://luciteria.com/collections/displays" },
    ],
  },
  {
    heading: "Support",
    links: [
      { label: "FAQ", href: "https://luciteria.com/pages/faq" },
      { label: "Contact Us", href: "https://luciteria.com/pages/contact" },
      { label: "Shipping", href: "https://luciteria.com/policies/shipping-policy" },
      { label: "Returns", href: "https://luciteria.com/policies/refund-policy" },
      { label: "Privacy Policy", to: "/app/cabinet/privacy", internal: true },
      { label: "Terms and Conditions", to: "/app/cabinet/terms", internal: true },
    ],
  },
];

export default function ConsumerFooter() {
  return (
    <footer className="bg-luc-charcoal text-white">
      <div className="mx-auto max-w-container px-5 py-section sm:px-page">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-4">
          {/* Brand column */}
          <div>
            <span className="mb-4 inline-block rounded-card-sm bg-white px-3 py-2">
              <img src="/logo.png" alt="Luciteria Science" className="h-8 w-auto" />
            </span>
            <p className="max-w-xs text-sm leading-relaxed text-luc-muted">
              Your personal element collection — beautifully tracked, organized, and grown.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h4 className="mb-4 font-heading text-[22px] font-medium text-white">
                {col.heading}
              </h4>
              <ul className="space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.internal ? (
                      <Link
                        to={l.to}
                        className="text-base text-luc-muted transition-colors hover:text-white"
                      >
                        {l.label}
                      </Link>
                    ) : (
                      <a
                        href={l.href}
                        target="_blank"
                        rel="noreferrer"
                        className="text-base text-luc-muted transition-colors hover:text-white"
                      >
                        {l.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-white/10 pt-6 text-sm text-luc-muted">
          Copyright © {new Date().getFullYear()} Luciteria Science. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
