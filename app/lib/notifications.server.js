/**
 * Luciteria Collector Cabinet — Notification Stubs (Phase 2)
 * 
 * Email and webhook notification system.
 * Phase 2: Console logging + in-memory log storage.
 * Production: Replace with SendGrid/Postmark + webhook dispatch.
 * 
 * Notification types:
 *  - shipment_assigned: New element assigned for upcoming shipment
 *  - shipment_shipped: Element has shipped with tracking
 *  - shipment_delivered: Element delivered
 *  - subscription_paused: Subscription paused
 *  - subscription_resumed: Subscription resumed
 *  - price_change: Grandfathered price changing
 *  - restock_alert: Wishlisted item back in stock
 *  - high_discount_alert: Admin alert for >20% discount assignment
 *  - collection_milestone: Customer hit a collection milestone
 *  - assignment_exception: Assignment engine exception needs review
 */

import nodemailer from 'nodemailer';

// In-memory notification log (replaced by DB in production)
const notificationLog = [];

// Initialize SMTP transporter using process.env variables
let transporter = null;
if (process.env.RESEND_API_KEY) {
  let userEmail = 'sales.starkedge@gmail.com';
  const emailFrom = process.env.EMAIL_FROM || '';
  const match = emailFrom.match(/<([^>]+)>/);
  if (match && match[1]) {
    userEmail = match[1];
  } else if (emailFrom && emailFrom.includes('@')) {
    userEmail = emailFrom.trim();
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: userEmail,
      pass: process.env.RESEND_API_KEY,
    },
  });
}

/**
 * Send an email notification (stub / SMTP)
 * Logs to console, sends via SMTP if configured, and stores in memory
 */
async function sendEmail({ to, subject, template, data, customerId }) {
  const notification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    channel: "email",
    to,
    subject,
    template,
    data,
    customerId,
    status: "sent",
    sentAt: new Date().toISOString(),
  };

  notificationLog.push(notification);
  
  console.log(`📧 [EMAIL] To: ${to}`);
  console.log(`   Subject: ${subject}`);
  console.log(`   Template: ${template}`);
  console.log(`   Data:`, JSON.stringify(data, null, 2));

  if (transporter) {
    try {
      let text = '';
      
      if (template === 'collection_milestone' || template === 'notification_milestone') {
        const userName = data.customerName || data.UserName || 'Collector';
        const milestoneTitle = data.milestone?.title || data.title || data.MilestoneTitle || '';
        const milestoneDescription = data.milestone?.description || data.body || data.MilestoneDescription || '';
        const ownedCount = data.ownedCount || data.OwnedCount || '??';
        const totalEarned = data.totalEarned || data.TotalEarned || '??';
        const totalPossible = data.totalPossible || data.TotalPossible || '??';

        let dbUserName = userName;
        let dbOwnedCount = ownedCount;
        let dbTotalEarned = totalEarned;
        let dbTotalPossible = totalPossible;

        if (customerId && (ownedCount === '??' || totalEarned === '??')) {
          try {
            const { getUserMilestones } = await import('./milestones.server.js');
            const { ownedCount: dbCount, totalEarned: dbEarned, totalPossible: dbPossible } = await getUserMilestones(customerId);
            
            const { prisma } = await import('./db.server.js');
            const user = await prisma.user.findUnique({
              where: { id: customerId }
            });
            if (user) {
              dbUserName = user.firstName || userName;
            }
            
            dbOwnedCount = dbCount;
            dbTotalEarned = dbEarned;
            dbTotalPossible = dbPossible;
          } catch (e) {
            console.error('Failed to enrich milestone email data from DB:', e);
          }
        }

        text = `Hi ${dbUserName},

Great news! 🚀

You’ve just unlocked a new milestone in your Luciteria Collector Cabinet:

🏆 ${milestoneTitle}
${milestoneDescription}

Your dedication to building your element collection is paying off. Keep going — there are many more achievements waiting for you!

🔬 Your Progress So Far:

* Elements Collected: ${dbOwnedCount} / 118
* Milestones Earned: ${dbTotalEarned} / ${dbTotalPossible}

Whether you're aiming for your next milestone or going for the ultimate Completionist 👑, we’re excited to be part of your journey.

👉 Continue your collection and discover more milestones!

If you have any questions or ideas, feel free to reach out — we’d love to hear from you.

Happy Collecting,
The Luciteria Team

---

This is an automated notification based on your collection activity.`;
      } else if (template === 'restock_alert') {
        const userName = data.customerName || 'Collector';
        const elementSymbol = data.elementSymbol || '';
        const productTitle = data.productTitle || '';
        const qty = data.inventoryQty || 0;

        text = `Hi ${userName},

Great news! 🎉 The item you've been waiting for is back in stock:

🔔 ${productTitle} (${elementSymbol})

We currently have ${qty} available in stock. Since this is a high-demand item, it may sell out quickly.

👉 Visit our shop to secure yours today!

Happy Collecting,
The Luciteria Team

---

This is an automated restock alert from your Luciteria Collector Cabinet wishlist.`;
      } else if (template === 'forgot_password') {
        const userName = data.customerName || 'Collector';
        const resetLink = data.resetLink || '';

        text = `Hi ${userName},

We received a request to reset the password for your Luciteria Collector Cabinet account.

To reset your password, please click on the link below (or copy and paste it into your browser):

👉 ${resetLink}

This link is secure and will expire in 30 minutes.

If you did not request a password reset, you can safely ignore this email. Your password will remain secure and unchanged.

Happy Collecting,
The Luciteria Team

---

This is an automated notification. Please do not reply to this email.`;
      } else {
        // Fallback for other templates
        text = `Hi ${data.customerName || 'Collector'},\n\n`;
        if (data.body) {
          text += `${data.body}\n\n`;
        } else if (data.message) {
          text += `${data.message}\n\n`;
        } else {
          text += `You have received a new update regarding your collection cabinet.\n\n`;
          text += JSON.stringify(data, null, 2) + `\n\n`;
        }
        
        if (data.linkUrl) {
          text += `👉 View details here: ${data.linkUrl}\n\n`;
        }
        
        text += `Happy Collecting,\nThe Luciteria Team\n\n---\n\nThis is an automated notification.`;
      }

      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'sales.starkedge@gmail.com',
        to,
        subject,
        text,
      });
      console.log(`   ✅ Email successfully sent via SMTP to ${to}`);
      notification.status = "sent";
    } catch (error) {
      console.error(`   ❌ Email sending failed via SMTP:`, error);
      notification.status = "failed";
      notification.error = error.message;
    }
  } else {
    console.log(`   ℹ️ SMTP email transporter is not configured. Email logged to console only.`);
  }

  return notification;
}

/**
 * Send a webhook notification (stub)
 * Logs to console and stores in memory
 */
async function sendWebhook({ url, event, payload, customerId }) {
  const notification = {
    id: `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    channel: "webhook",
    url: url || "https://hooks.example.com/luciteria",
    event,
    payload,
    customerId,
    status: "delivered",
    sentAt: new Date().toISOString(),
  };

  notificationLog.push(notification);

  console.log(`🪝 [WEBHOOK STUB] Event: ${event}`);
  console.log(`   URL: ${notification.url}`);
  console.log(`   Payload:`, JSON.stringify(payload, null, 2));

  return notification;
}

/**
 * High-level notification dispatchers
 */

async function notifyShipmentAssigned(customer, product, shipmentDate) {
  return Promise.all([
    sendEmail({
      to: customer.email,
      subject: `Your next element is ready: ${product.elementSymbol} — ${product.elementName}`,
      template: "shipment_assigned",
      data: {
        customerName: customer.firstName,
        elementSymbol: product.elementSymbol,
        elementName: product.elementName,
        productTitle: product.title,
        shipmentDate,
      },
      customerId: customer.id,
    }),
    sendWebhook({
      event: "shipment.assigned",
      payload: {
        customerId: customer.id,
        productId: product.id,
        elementSymbol: product.elementSymbol,
        shipmentDate,
      },
      customerId: customer.id,
    }),
  ]);
}

async function notifyShipmentShipped(customer, product, trackingNumber) {
  return sendEmail({
    to: customer.email,
    subject: `📦 ${product.elementSymbol} is on its way!`,
    template: "shipment_shipped",
    data: {
      customerName: customer.firstName,
      elementSymbol: product.elementSymbol,
      productTitle: product.title,
      trackingNumber,
    },
    customerId: customer.id,
  });
}

async function notifyHighDiscountAlert(adminEmail, assignment) {
  return sendEmail({
    to: adminEmail || "admin@luciteria.com",
    subject: `⚠️ High discount alert: ${assignment.product?.elementSymbol} (${(assignment.discount?.discountPct * 100).toFixed(1)}%)`,
    template: "admin_high_discount",
    data: {
      customerName: `${assignment.customer?.firstName} ${assignment.customer?.lastName}`,
      elementSymbol: assignment.product?.elementSymbol,
      retailPrice: assignment.discount?.retailPrice,
      subscriptionCost: assignment.discount?.subscriptionCost,
      discountPct: assignment.discount?.discountPct,
      flags: assignment.flags,
    },
    customerId: assignment.customer?.id,
  });
}

async function notifyCollectionMilestone(customer, milestone) {
  const milestoneMessages = {
    10: "Double digits! 🎉",
    25: "Quarter of the table! 🔥",
    50: "Halfway there! 🏔️",
    75: "Three quarters! 💪",
    100: "The century mark! 🏆",
    118: "ALL ELEMENTS COLLECTED! 👑🎊",
  };

  return sendEmail({
    to: customer.email,
    subject: `Collection milestone: ${milestone} elements! ${milestoneMessages[milestone] || "🎉"}`,
    template: "collection_milestone",
    data: {
      customerName: customer.firstName,
      milestone,
      message: milestoneMessages[milestone] || `${milestone} elements collected!`,
    },
    customerId: customer.id,
  });
}

async function notifyRestockAlert(customer, product) {
  return sendEmail({
    to: customer.email,
    subject: `🔔 ${product.elementSymbol} is back in stock!`,
    template: "restock_alert",
    data: {
      customerName: customer.firstName,
      elementSymbol: product.elementSymbol,
      productTitle: product.title,
      inventoryQty: product.inventoryQty,
    },
    customerId: customer.id,
  });
}

async function notifyPriceChange(customer, oldPrice, newPrice, effectiveDate) {
  return sendEmail({
    to: customer.email,
    subject: `Subscription price update: $${oldPrice}/mo → $${newPrice}/mo`,
    template: "price_change",
    data: {
      customerName: customer.firstName,
      oldPrice,
      newPrice,
      effectiveDate,
      savings: oldPrice - newPrice,
    },
    customerId: customer.id,
  });
}

async function notifyAssignmentException(adminEmail, exception, customer) {
  return sendEmail({
    to: adminEmail || "admin@luciteria.com",
    subject: `⚠️ Assignment exception: ${customer.firstName} ${customer.lastName}`,
    template: "admin_assignment_exception",
    data: {
      customerName: `${customer.firstName} ${customer.lastName}`,
      reason: exception.reason,
      details: exception.details,
    },
    customerId: customer.id,
  });
}

/**
 * Get all notifications (for admin view)
 */
function getNotificationLog(filters = {}) {
  let results = [...notificationLog];
  if (filters.customerId) {
    results = results.filter((n) => n.customerId === filters.customerId);
  }
  if (filters.channel) {
    results = results.filter((n) => n.channel === filters.channel);
  }
  if (filters.template) {
    results = results.filter((n) => n.template === filters.template);
  }
  return results.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
}

/**
 * Get notification count by type
 */
function getNotificationStats() {
  const stats = {};
  for (const n of notificationLog) {
    const key = n.template || n.event || "unknown";
    stats[key] = (stats[key] || 0) + 1;
  }
  return { total: notificationLog.length, byType: stats };
}

export {
  sendEmail,
  sendWebhook,
  notifyShipmentAssigned,
  notifyShipmentShipped,
  notifyHighDiscountAlert,
  notifyCollectionMilestone,
  notifyRestockAlert,
  notifyPriceChange,
  notifyAssignmentException,
  getNotificationLog,
  getNotificationStats,
};
