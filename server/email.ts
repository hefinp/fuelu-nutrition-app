import { Resend } from "resend";
import crypto from "crypto";

const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET || crypto.randomBytes(32).toString("hex");
if (!process.env.UNSUBSCRIBE_SECRET) {
  console.warn("[email] UNSUBSCRIBE_SECRET not set — using ephemeral random key. Unsubscribe links will break on restart. Set UNSUBSCRIBE_SECRET in production.");
}

interface ResendCredentials {
  apiKey: string;
  fromEmail: string;
}

interface ConnectorSettings {
  api_key: string;
  from_email?: string;
}

interface ConnectorItem {
  settings: ConnectorSettings;
}

interface ConnectorResponse {
  items?: ConnectorItem[];
}

async function getResendCredentials(): Promise<ResendCredentials | null> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? "depl " + process.env.WEB_REPL_RENEWAL
    : null;

  if (hostname && xReplitToken) {
    try {
      const data: ConnectorResponse = await fetch(
        "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=resend",
        {
          headers: {
            Accept: "application/json",
            "X-Replit-Token": xReplitToken,
          },
        }
      ).then((res) => res.json());

      const item = data.items?.[0];
      if (item?.settings?.api_key && item?.settings?.from_email) {
        return {
          apiKey: item.settings.api_key,
          fromEmail: item.settings.from_email,
        };
      }
    } catch (err) {
      console.warn("[email] Failed to fetch Resend connector credentials:", err);
    }
  }

  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
    return {
      apiKey: process.env.RESEND_API_KEY,
      fromEmail: process.env.RESEND_FROM_EMAIL,
    };
  }

  return null;
}

function esc(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatFromAddress(fromEmail: string, displayName = "FuelU"): string {
  return fromEmail.includes("<") ? fromEmail : `${displayName} <${fromEmail}>`;
}

export function generateUnsubscribeToken(userId: number): string {
  const payload = `${userId}`;
  const hmac = crypto.createHmac("sha256", UNSUBSCRIBE_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${hmac}`).toString("base64url");
}

export function generateEmailUnsubscribeToken(email: string): string {
  const payload = `email:${email}`;
  const hmac = crypto.createHmac("sha256", UNSUBSCRIBE_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${hmac}`).toString("base64url");
}

export function verifyUnsubscribeToken(token: string): { userId: number } | { email: string } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const colonIdx = decoded.lastIndexOf(":");
    if (colonIdx === -1) return null;
    const payload = decoded.substring(0, colonIdx);
    const hmac = decoded.substring(colonIdx + 1);
    const expected = crypto.createHmac("sha256", UNSUBSCRIBE_SECRET).update(payload).digest("hex");
    if (hmac.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) return null;
    if (payload.startsWith("email:")) {
      const email = payload.substring(6);
      return email ? { email } : null;
    }
    const userId = parseInt(payload, 10);
    return isNaN(userId) ? null : { userId };
  } catch {
    return null;
  }
}

export function buildUnsubscribeUrl(userId: number): string {
  const token = generateUnsubscribeToken(userId);
  const appUrl = process.env.APP_URL || "http://localhost:5000";
  return `${appUrl}/email-preferences?token=${token}`;
}

export function buildEmailUnsubscribeUrl(email: string): string {
  const token = generateEmailUnsubscribeToken(email);
  const appUrl = process.env.APP_URL || "http://localhost:5000";
  return `${appUrl}/email-preferences?token=${token}`;
}

function wrapEmailHtml(body: string, opts: {
  title: string;
  accentText?: string;
  disclaimer?: string;
  unsubscribeUrl?: string;
}): string {
  const year = new Date().getFullYear();
  const accentHtml = opts.accentText
    ? `<span style="color:#a1a1aa;font-size:13px;margin-left:12px;font-weight:400">${esc(opts.accentText)}</span>`
    : "";
  const disclaimerHtml = opts.disclaimer
    ? `<p style="margin:12px 0 0;font-size:11px;color:#a1a1aa;line-height:1.5">${esc(opts.disclaimer)}</p>`
    : "";
  const unsubscribeHtml = opts.unsubscribeUrl
    ? `<p style="margin:8px 0 0;font-size:11px;color:#a1a1aa;line-height:1.5"><a href="${opts.unsubscribeUrl}" style="color:#71717a;text-decoration:underline">Manage email preferences or unsubscribe</a></p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#18181b">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f4f5;padding:32px 16px">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%">

          <!-- Header -->
          <tr>
            <td style="background:#18181b;border-radius:14px 14px 0 0;padding:18px 24px">
              <table cellpadding="0" cellspacing="0" role="presentation" style="background:#18181b">
                <tr>
                  <td style="vertical-align:middle;padding-right:10px;background:#18181b">
                    <!-- Logomark: white rounded square with dark stem + circle inside (inverted app icon) -->
                    <table cellpadding="0" cellspacing="0" role="presentation" style="background:#18181b">
                      <tr>
                        <td align="center" width="36" style="background:#18181b;line-height:0;font-size:0">
                          <div style="width:36px;height:36px;background:#ffffff;border-radius:8px;line-height:0;font-size:0">
                            <div style="width:3px;height:12px;background:#18181b;margin:0 auto"></div>
                            <div style="width:17px;height:17px;background:#18181b;border-radius:9px;margin:0 auto"></div>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="vertical-align:middle;background:#18181b">
                    <span style="color:#ffffff;font-weight:700;font-size:18px;letter-spacing:-0.3px">FuelU</span>${accentHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:32px 24px">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9f9f9;border-top:1px solid #e4e4e7;border-radius:0 0 14px 14px;padding:16px 24px">
              <p style="margin:0;font-size:12px;color:#71717a;line-height:1.5">&copy; ${year} FuelU. All rights reserved.</p>
              ${disclaimerHtml}
              ${unsubscribeHtml}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<void> {
  const credentials = await getResendCredentials();
  if (!credentials) {
    console.warn("[email] Resend not configured — skipping email send. Would have sent to:", to, "| Subject:", subject);
    return;
  }

  const resend = new Resend(credentials.apiKey);
  const { error } = await resend.emails.send({
    from: formatFromAddress(credentials.fromEmail),
    to,
    subject,
    html,
  });
  if (error) {
    throw new Error(`Email send failed: ${error.message}`);
  }
}

export function buildPasswordResetEmailHtml(resetUrl: string, name: string): string {
  const body = `
    <h2 style="font-size:22px;font-weight:700;margin:0 0 12px">Reset your password</h2>
    <p style="color:#52525b;font-size:15px;line-height:1.6;margin:0 0 24px">Hi ${esc(name)}, we received a request to reset your FuelU password. Click the button below to choose a new one. This link expires in 1 hour.</p>
    <a href="${resetUrl}" style="display:inline-block;padding:13px 28px;background:#18181b;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px">Reset Password</a>
    <p style="margin:24px 0 0;color:#a1a1aa;font-size:13px;line-height:1.5">If you didn't request this, you can safely ignore this email — your password won't change.</p>
    <p style="margin:8px 0 0;color:#a1a1aa;font-size:12px">Or copy this link:<br><a href="${resetUrl}" style="color:#71717a;word-break:break-all">${resetUrl}</a></p>
  `;
  return wrapEmailHtml(body, { title: "Reset your FuelU password" });
}

export function buildMealPlanEmailHtml(planName: string, userName: string, planData: any, planType: string, shoppingList?: Record<string, Array<{ item: string; quantity: string }>>, unsubscribeUrl?: string): string {
  const slots = ["breakfast", "lunch", "dinner", "snacks"] as const;
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

  function renderDay(dayPlan: any, label?: string): string {
    let html = label ? `<h3 style="text-transform:capitalize;font-size:15px;font-weight:700;margin:20px 0 8px;color:#18181b;border-bottom:1px solid #e4e4e7;padding-bottom:4px">${label}</h3>` : "";
    for (const slot of slots) {
      const meals: any[] = dayPlan[slot] || [];
      if (!meals.length) continue;
      html += `<p style="font-size:12px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:.05em;margin:10px 0 4px">${slot}</p>`;
      for (const m of meals) {
        html += `<div style="background:#f4f4f5;border-radius:8px;padding:8px 12px;margin-bottom:6px">
          <span style="font-size:13px;font-weight:600;color:#18181b">${esc(String(m.meal))}</span>
          <span style="float:right;font-size:12px;color:#71717a">${esc(String(m.calories))} kcal</span>
          <div style="clear:both"></div>
          <span style="font-size:11px;color:#a1a1aa">P: ${m.protein}g &nbsp; C: ${m.carbs}g &nbsp; F: ${m.fat}g</span>
        </div>`;
      }
    }
    if (dayPlan.dayTotalCalories) {
      html += `<p style="font-size:12px;color:#52525b;margin-top:6px"><strong>Day total:</strong> ${dayPlan.dayTotalCalories} kcal &nbsp; P: ${dayPlan.dayTotalProtein}g &nbsp; C: ${dayPlan.dayTotalCarbs}g &nbsp; F: ${dayPlan.dayTotalFat}g</p>`;
    }
    return html;
  }

  let mealsHtml = "";
  if (planType === "daily") {
    mealsHtml = renderDay(planData);
  } else {
    for (const day of days) {
      if (planData[day]) mealsHtml += renderDay(planData[day], day);
    }
  }

  let shoppingHtml = "";
  if (shoppingList && Object.keys(shoppingList).length > 0) {
    const categoryOrder = ["Protein", "Produce", "Grains & Carbs", "Dairy", "Pantry & Spices", "Other"];
    shoppingHtml += `<h3 style="font-size:17px;font-weight:700;margin:28px 0 12px;color:#18181b;border-top:2px solid #e4e4e7;padding-top:20px">Shopping List</h3>`;
    for (const cat of categoryOrder) {
      const items = shoppingList[cat];
      if (!items || !items.length) continue;
      shoppingHtml += `<p style="font-size:12px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:.05em;margin:14px 0 6px">${cat}</p>`;
      for (const { item, quantity } of items) {
        shoppingHtml += `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f4f4f5;font-size:13px">
          <span style="color:#18181b">${esc(item)}</span>
          <span style="color:#71717a;font-weight:500">${esc(quantity)}</span>
        </div>`;
      }
    }
  }

  const body = `
    <h2 style="font-size:20px;font-weight:700;margin:0 0 4px">${esc(planName)}</h2>
    <p style="color:#71717a;font-size:13px;margin:0 0 20px">Hi ${esc(userName)} — here is your ${esc(planType)} meal plan.</p>
    ${mealsHtml}
    ${shoppingHtml}
  `;
  return wrapEmailHtml(body, {
    title: planName,
    accentText: "Meal Plan",
    disclaimer: "Results are estimates. Consult a qualified healthcare professional before making dietary changes.",
    unsubscribeUrl,
  });
}

export function buildWaitlistInviteEmailHtml(opts: {
  prospectName: string;
  nutritionistName: string;
  inviteUrl: string;
  unsubscribeUrl?: string;
}): string {
  const body = `
    <h2 style="font-size:22px;font-weight:700;margin:0 0 12px">You've been invited!</h2>
    <p style="color:#52525b;font-size:15px;line-height:1.6;margin:0 0 16px">Hi ${esc(opts.prospectName)}, great news — <strong>${esc(opts.nutritionistName)}</strong> has a spot available and would like to invite you to join as a client on FuelU.</p>
    <p style="color:#52525b;font-size:15px;line-height:1.6;margin:0 0 24px">Click the button below to create your account and get started. This invitation expires in 7 days.</p>
    <a href="${opts.inviteUrl}" style="display:inline-block;padding:13px 28px;background:#18181b;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px">Accept Invitation</a>
    <p style="margin:24px 0 0;color:#a1a1aa;font-size:13px;line-height:1.5">If you weren't expecting this, you can safely ignore this email.</p>
    <p style="margin:8px 0 0;color:#a1a1aa;font-size:12px">Or copy this link:<br><a href="${opts.inviteUrl}" style="color:#71717a;word-break:break-all">${opts.inviteUrl}</a></p>
  `;
  return wrapEmailHtml(body, { title: "You're invited to join FuelU", unsubscribeUrl: opts.unsubscribeUrl });
}

export function buildVerificationEmailHtml(verifyUrl: string, name: string): string {
  const body = `
    <h2 style="font-size:22px;font-weight:700;margin:0 0 12px">Verify your email</h2>
    <p style="color:#52525b;font-size:15px;line-height:1.6;margin:0 0 24px">Hi ${esc(name)}, thanks for signing up for FuelU! Please verify your email address by clicking the button below. This link expires in 24 hours.</p>
    <a href="${verifyUrl}" style="display:inline-block;padding:13px 28px;background:#18181b;color:#ffffff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px">Verify Email</a>
    <p style="margin:24px 0 0;color:#a1a1aa;font-size:13px;line-height:1.5">If you didn't create an account on FuelU, you can safely ignore this email.</p>
    <p style="margin:8px 0 0;color:#a1a1aa;font-size:12px">Or copy this link:<br><a href="${verifyUrl}" style="color:#71717a;word-break:break-all">${verifyUrl}</a></p>
  `;
  return wrapEmailHtml(body, { title: "Verify your FuelU email" });
}

export function buildFeedbackEmailHtml(opts: {
  userName: string;
  userEmail: string;
  category: string;
  message: string;
  submittedAt: string;
}): string {
  const categoryLabel = opts.category === "bug" ? "Bug Report" : opts.category === "feature" ? "Feature Request" : "General Feedback";
  const body = `
    <h2 style="font-size:20px;font-weight:700;margin:0 0 20px">Beta Feedback</h2>
    <div style="background:#f4f4f5;border-radius:10px;padding:16px 20px;margin-bottom:12px">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:.06em">Category</p>
      <p style="margin:0;font-weight:600;font-size:15px;color:#18181b">${esc(categoryLabel)}</p>
    </div>
    <div style="background:#f4f4f5;border-radius:10px;padding:16px 20px;margin-bottom:12px">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:.06em">Message</p>
      <p style="margin:0;font-size:15px;line-height:1.6;color:#18181b;white-space:pre-wrap">${esc(opts.message)}</p>
    </div>
    <div style="background:#f4f4f5;border-radius:10px;padding:16px 20px">
      <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#71717a;text-transform:uppercase;letter-spacing:.06em">Submitted by</p>
      <p style="margin:0;font-size:14px;color:#18181b"><strong>${esc(opts.userName)}</strong> &lt;${esc(opts.userEmail)}&gt;</p>
      <p style="margin:4px 0 0;font-size:12px;color:#71717a">${esc(opts.submittedAt)}</p>
    </div>
  `;
  return wrapEmailHtml(body, { title: "FuelU Beta Feedback" });
}
