/** @type {import('tailwindcss').Config} */
export default {
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  theme: {
    // Match the Shopify "Live Working Theme" breakpoints
    // mobile: 0-749, tablet: 750-989, desktop: 990+, widescreen: 1400+
    screens: {
      sm: "750px",
      md: "990px",
      lg: "1200px",
      xl: "1400px",
    },
    extend: {
      colors: {
        // Shopify theme palette (consumer-facing only)
        luc: {
          blue: "#5781D8",
          "blue-hover": "#4a6fc0",
          black: "#000000",
          ink: "#0D0D0D", // near-black headings
          text: "rgba(0, 0, 0, 0.81)", // body text
          orange: "#E06412",
          // backgrounds
          bg: "#FFFFFF",
          gray: "#F5F5F5", // cards / hero left panel
          soft: "#FAFAFA",
          bluegray: "#E1EDF5", // why-us / FAQ section
          // chrome
          charcoal: "#333333", // footer + announcement bar
          muted: "#A5A5A5", // footer muted links
          border: "#DFDFDF",
        },
      },
      fontFamily: {
        // Inter for body / nav, DM Sans for headings
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        heading: ["'DM Sans'", "Inter", "ui-sans-serif", "sans-serif"],
      },
      borderRadius: {
        btn: "10px",
        "btn-lg": "14px",
        card: "20px",
        "card-sm": "16px",
      },
      maxWidth: {
        container: "1400px",
        content: "1180px",
      },
      spacing: {
        // Shopify spacing scale
        "page": "40px",
        "section": "64px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.06)",
        "card-hover": "0 8px 24px rgba(0,0,0,0.08)",
      },
      transitionTimingFunction: {
        theme: "ease",
      },
    },
  },
  plugins: [],
};
