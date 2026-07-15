import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { prisma } from "../lib/db.server";

export const loader = async () => {
  // Redact password from connection string for security
  const rawDbUrl = process.env.DATABASE_URL || "not set";
  let redactedDbUrl = rawDbUrl;
  try {
    if (rawDbUrl.startsWith("postgresql://") || rawDbUrl.startsWith("postgres://")) {
      const urlObj = new URL(rawDbUrl);
      urlObj.password = "****";
      redactedDbUrl = urlObj.toString();
    }
  } catch (e) {
    redactedDbUrl = "Invalid URL format";
  }

  const result = {
    databaseUrl: redactedDbUrl,
    nodeEnv: process.env.NODE_ENV || "not set",
    appMode: process.env.APP_MODE || "not set",
    connectionSuccess: false,
    error: null,
  };

  try {
    // Run a simple query to verify connection
    await prisma.$queryRaw`SELECT 1`;
    result.connectionSuccess = true;
  } catch (err) {
    result.error = {
      message: err.message,
      code: err.code,
      meta: err.meta,
    };
  }

  return json(result);
};

export default function DbTest() {
  const data = useLoaderData();

  return (
    <div style={{ padding: "40px", fontFamily: "monospace", maxWidth: "800px", margin: "0 auto" }}>
      <h1 style={{ borderBottom: "1px solid #ccc", paddingBottom: "10px" }}>Database Connection Diagnostic</h1>
      <div style={{ background: "#f8f9fa", border: "1px solid #ddd", borderRadius: "4px", padding: "20px", marginTop: "20px" }}>
        <p><strong>Connection Success:</strong> {data.connectionSuccess ? "✅ YES" : "❌ NO"}</p>
        <p><strong>Environment:</strong> {data.nodeEnv} (Mode: {data.appMode})</p>
        <p><strong>Database URL (Redacted):</strong> {data.databaseUrl}</p>
        
        {!data.connectionSuccess && data.error && (
          <div style={{ marginTop: "20px" }}>
            <h3 style={{ color: "#d9534f" }}>Connection Error Details:</h3>
            <pre style={{ background: "#f2dede", color: "#a94442", padding: "15px", borderRadius: "4px", overflowX: "auto", border: "1px solid #ebccd1" }}>
              {JSON.stringify(data.error, null, 2)}
            </pre>
          </div>
        )}
      </div>
      <div style={{ marginTop: "20px", fontSize: "14px", color: "#666" }}>
        <a href="/onboarding/welcome" style={{ color: "#5781D8" }}>&larr; Back to Welcome</a>
      </div>
    </div>
  );
}
