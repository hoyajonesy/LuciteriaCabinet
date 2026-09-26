import { json } from "@remix-run/node";
import { handleWebhook, validateWebhookHmac } from "../integrations/shopify/shopify-webhooks.server.js";
import { prisma } from "../lib/db.server.js";

export const action = async ({ request }) => {
    let logEntry = null;
    try {
        const rawBody = await request.text();
        const hmacHeader = request.headers.get("x-shopify-hmac-sha256");

        // Validate HMAC signature
        if (!validateWebhookHmac(rawBody, hmacHeader)) {
            console.error("Webhook signature validation failed");
            return json({ error: "Unauthorized" }, { status: 401 });
        }

        const payload = JSON.parse(rawBody);
        console.log("Processing product update webhook payload:", payload);

        // NT-6: store only the product/variant fields we compare, never the raw
        // body (no body_html, images or options), so each row stays small.
        const trimmedPayload = JSON.stringify({
            id: payload.id,
            title: payload.title,
            variants: (payload.variants || []).map((v) => ({
                id: v.id,
                sku: v.sku,
                price: v.price,
                inventory_quantity: v.inventory_quantity,
            })),
        });

        // Track incoming webhook event in WebhookEventLog
        // NT-5: select only the id so the write never echoes the payload back.
        logEntry = await prisma.webhookEventLog.create({
            data: {
                topic: "products/update",
                shopifyId: payload.id ? String(payload.id) : null,
                payload: trimmedPayload,
                status: "received",
            },
            select: { id: true },
        });

        // Handle webhook logic
        const result = await handleWebhook("products/update", payload);

        // Update log entry status
        await prisma.webhookEventLog.update({
            where: { id: logEntry.id },
            data: {
                status: result.handled ? "processed" : "failed",
                errorMsg: result.error || null,
                processedAt: new Date(),
            },
            select: { id: true },
        });

        return json({ ok: true, result });
    } catch (error) {
        console.error("Webhook route error:", error);

        if (logEntry) {
            try {
                await prisma.webhookEventLog.update({
                    where: { id: logEntry.id },
                    data: {
                        status: "failed",
                        errorMsg: error.message,
                        processedAt: new Date(),
                    },
                    select: { id: true },
                });
            } catch (logErr) {
                console.error("Failed to update WebhookEventLog error status:", logErr);
            }
        }

        return json(
            { error: "Webhook handler failed", details: error.message },
            { status: 200 }
        );
    }
};
