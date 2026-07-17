/**
 * Google Analytics 4 hook for Remix
 * 
 * Tracks page views on route changes in a client-side SPA.
 * Call this once in root.jsx with the GA measurement ID.
 */
import { useEffect } from "react";
import { useLocation } from "@remix-run/react";

export function useGoogleAnalytics(measurementId) {
  const location = useLocation();

  useEffect(() => {
    // Skip if no measurement ID or if gtag is not loaded
    if (!measurementId || typeof window === "undefined" || !window.gtag) {
      return;
    }

    // Track page view on route change
    window.gtag("config", measurementId, {
      page_path: location.pathname + location.search,
    });
  }, [measurementId, location]);
}
