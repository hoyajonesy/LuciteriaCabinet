import { json } from "@remix-run/node";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteError, isRouteErrorResponse, useLoaderData } from "@remix-run/react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import tailwindStyles from "./tailwind.css?url";
import { enforceSubdomainRouting } from "./lib/subdomain-guard.server.js";
import { useGoogleAnalytics } from "./hooks/useGoogleAnalytics.js";

export const loader = async ({ request }) => {
  const subdomain = enforceSubdomainRouting(request); // throws redirect / 404 when needed
  return json({
    subdomain: {
      name: subdomain.subdomain,
      isAdmin: subdomain.isAdmin,
      isApp: subdomain.isApp,
    },
    ENV: {
      GA_MEASUREMENT_ID: process.env.GA_MEASUREMENT_ID || "",
    },
  });
};

export const meta = () => [
  { title: "Luciteria Collector Cabinet" },
  { name: "description", content: "Your personal element collection, beautifully organized." },
];

export const links = () => [
  { rel: "stylesheet", href: polarisStyles },
  { rel: "stylesheet", href: tailwindStyles },
  // Shopify theme fonts: Inter (body/nav) + DM Sans (headings)
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap",
  },
  {
    rel: "stylesheet",
    href: "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css",
  },
];

export default function App() {
  const { ENV } = useLoaderData();
  useGoogleAnalytics(ENV.GA_MEASUREMENT_ID);

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
        {ENV.GA_MEASUREMENT_ID && (
          <>
            <script
              async
              src={`https://www.googletagmanager.com/gtag/js?id=${ENV.GA_MEASUREMENT_ID}`}
            />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${ENV.GA_MEASUREMENT_ID}', {
                    page_path: window.location.pathname + window.location.search,
                  });
                `,
              }}
            />
          </>
        )}
        <style>{`
          :root {
            /* Shopify "Live Working Theme" palette (consumer-facing) */
            --luc-bg: #f5f5f5;
            --luc-surface: #ffffff;
            --luc-surface-raised: #f5f5f5;
            --luc-accent: #5781D8;
            --luc-accent-light: #4a6fc0;
            --luc-gold: #c5960c;
            --luc-text: #0D0D0D;
            --luc-text-muted: #6b7280;
            --luc-success: #059669;
            --luc-warning: #d97706;
            --luc-danger: #dc2626;
            --luc-border: #DFDFDF;
          }
          /* Inter as the default body font on consumer pages */
          body { font-family: "Inter", ui-sans-serif, system-ui, sans-serif; }
          /* Override Polaris for light theme */
          .Polaris-Frame { background: var(--luc-bg) !important; }
          .Polaris-Card { background: var(--luc-surface) !important; border: 1px solid var(--luc-border) !important; }
          .Polaris-Text--root { color: var(--luc-text) !important; }
        `}</style>
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  console.error("Root ErrorBoundary caught:", error);

  let title = "An unexpected error occurred";
  let message = "We apologize for the inconvenience. Please try again later.";
  let status = 500;

  if (isRouteErrorResponse(error)) {
    status = error.status;
    if (error.status === 404) {
      title = "Page Not Found";
      message = "The page you requested could not be found.";
    } else {
      title = `${error.status} ${error.statusText}`;
      message = error.data || message;
    }
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>{title}</title>
        <style>{`
          body {
            font-family: ui-sans-serif, system-ui, sans-serif;
            background-color: #f5f5f5;
            color: #333;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
          }
          .card {
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
            max-width: 480px;
            width: 100%;
            text-align: center;
            border: 1px solid #e5e7eb;
          }
          h1 {
            font-size: 28px;
            margin-top: 0;
            color: #0D0D0D;
            font-weight: 600;
          }
          p {
            font-size: 16px;
            color: #666;
            line-height: 1.6;
            margin-bottom: 24px;
          }
          a {
            display: inline-block;
            background-color: #5781D8;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 500;
            transition: background-color 0.2s;
          }
          a:hover {
            background-color: #4a6fc0;
          }
        `}</style>
      </head>
      <body>
        <div className="card">
          <div style={{ fontSize: '48px', color: '#5781D8', fontWeight: 'bold', marginBottom: '16px' }}>{status}</div>
          <h1>{title}</h1>
          <p>{message}</p>
          <a href="/">Go to Homepage</a>
        </div>
      </body>
    </html>
  );
}
