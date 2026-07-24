/**
 * ConsumerHeader — shared top navigation for all consumer-facing pages
 * (landing, onboarding, cabinet). Faithfully matches the Shopify
 * "Live Working Theme" header: white sticky bar, logo on the left,
 * centered nav (Science | Blog | Products | More), utilities on the right,
 * and a hamburger drawer on mobile.
 *
 * Admin routes (/admin/*) never render this component.
 */
import { Link } from "@remix-run/react";
import { useState } from "react";

const NAV_LINKS = [
  { label: "Home", to: "http://luciteria.com/", internal: true },
  { label: "Collections", href: "http://luciteria.com/collections", internal: false },
  { label: "Cabinet", to: "/app/cabinet/shop", internal: true },
];

const MORE_LINKS = [
  { label: "Collection", to: "/app/cabinet/periodic-table", internal: true },
  { label: "Wishlist", to: "/app/cabinet/wishlist", internal: true },
  { label: "FAQ", href: "https://luciteria.com/pages/faq", internal: false },
  { label: "Contact Us", href: "https://luciteria.com/pages/contact", internal: false },
];

function NavItem({ link, onClick }) {
  const cls =
    "text-base font-normal text-luc-text transition-colors duration-200 hover:text-luc-blue";
  if (link.internal) {
    return (
      <Link to={link.to} className={cls} onClick={onClick}>
        {link.label}
      </Link>
    );
  }
  return (
    <a href={link.href} className={cls} target="_blank" rel="noreferrer" onClick={onClick}>
      {link.label}
    </a>
  );
}

export default function ConsumerHeader({ ctaTo = "/onboarding/welcome?mode=login", ctaLabel = "Sign In" }) {
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-white">
      {/* Announcement bar - EMPTY RIGHT NOW, DO NOT DELETE*/}
      {/* <div className="bg-luc-charcoal px-5 py-2.5 text-center text-sm font-normal text-white sm:px-page">
        Free shipping on orders over $99 — pure elements, precision cubes &amp; rare displays.
      </div> */}

      <nav className="mx-auto flex max-w-container items-center justify-between px-5 py-4 sm:px-page">
        {/* Logo */}
        <a
          href="https://luciteria.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-shrink-0 items-center"
          aria-label="Luciteria Science home"
        >
          <img src="/logo.png" alt="Luciteria Science" className="h-9 w-auto sm:h-10" />
        </a>

        {/* Center nav (desktop) */}
        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((l) => (
            <NavItem key={l.label} link={l} />
          ))}

          {/* More dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setMoreOpen(true)}
            onMouseLeave={() => setMoreOpen(false)}
          >
            <button
              type="button"
              className="flex items-center gap-1.5 text-base font-normal text-luc-text transition-colors duration-200 hover:text-luc-blue"
              onClick={() => setMoreOpen((v) => !v)}
            >
              More <i className="fa-solid fa-chevron-down text-xs" />
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-full w-48 rounded-card-sm border border-luc-border bg-white py-2 shadow-card-hover">
                {MORE_LINKS.map((l) => (
                  <div key={l.label} className="px-4 py-2 hover:bg-luc-gray">
                    <NavItem link={l} onClick={() => setMoreOpen(false)} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Utilities (desktop) */}
        <div className="hidden items-center gap-4 md:flex">
          <a
            href="https://luciteria.com/search"
            target="_blank"
            rel="noreferrer"
            aria-label="Search"
            className="text-luc-text transition-colors hover:text-luc-blue"
          >
            <i className="fa-solid fa-magnifying-glass text-lg" />
          </a>
          <Link to={ctaTo} className="btn-primary px-6 py-2.5 text-sm">
            {ctaLabel}
          </Link>
        </div>

        {/* Hamburger (mobile) */}
        <button
          type="button"
          className="text-2xl text-luc-ink md:hidden"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <i className={`fa-solid ${open ? "fa-xmark" : "fa-bars"}`} />
        </button>
      </nav>

      {/* Mobile drawer */}
      {open && (
        <div className="border-t border-luc-border bg-white px-5 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            {[...NAV_LINKS, ...MORE_LINKS].map((l) => (
              <div key={l.label} className="py-2">
                <NavItem link={l} onClick={() => setOpen(false)} />
              </div>
            ))}
            <Link to={ctaTo} className="btn-primary mt-3 w-full" onClick={() => setOpen(false)}>
              {ctaLabel}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
