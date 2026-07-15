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
        console.log("Processing inventory update webhook payload:", payload);

        // Track incoming webhook event in WebhookEventLog
        logEntry = await prisma.webhookEventLog.create({
            data: {
                topic: "inventory_levels/update",
                shopifyId: payload.inventory_item_id ? String(payload.inventory_item_id) : null,
                payload: rawBody,
                status: "received",
            }
        });

        // Handle webhook logic
        const result = await handleWebhook("inventory_levels/update", payload);

        // Update log entry status
        await prisma.webhookEventLog.update({
            where: { id: logEntry.id },
            data: {
                status: result.handled ? "processed" : "failed",
                errorMsg: result.error || null,
                processedAt: new Date(),
            }
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
                    }
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