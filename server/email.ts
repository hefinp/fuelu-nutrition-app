import { Resend } from "resend";

// Replit Resend connector — fetches API key and from_email from the Replit connections API.
// WARNING: Never cache the client. Tokens expire, so credentials must be fetched fresh each call.

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

  // Fallback to bare environment variable (non-Replit environments)
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
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Reset your FuelU password</title></head>
<body style="font-family:sans-serif;max-width:520px;margin:40px auto;padding:0 20px;color:#1a1a1a">
  <div style="margin-bottom:24px">
    <span style="font-weight:700;font-size:18px">FuelU</span>
  </div>
  <h2 style="font-size:22px;font-weight:700;margin-bottom:8px">Reset your password</h2>
  <p style="color:#555;margin-bottom:24px">Hi ${esc(name)}, we received a request to reset your FuelU password. Click the button below to choose a new one. This link expires in 1 hour.</p>
  <a href="${resetUrl}" style="display:inline-block;padding:12px 28px;background:#18181b;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px">Reset Password</a>
  <p style="margin-top:24px;color:#888;font-size:12px">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
  <p style="color:#888;font-size:12px">Or copy this link: <a href="${resetUrl}" style="color:#555">${resetUrl}</a></p>
</body>
</html>`;
}

export function buildMealPlanEmailHtml(planName: string, userName: string, planData: any, planType: string, shoppingList?: Record<string, Array<{ item: string; quantity: string }>>): string {
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

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${esc(planName)}</title></head>
<body style="font-family:sans-serif;max-width:560px;margin:40px auto;padding:0 20px;color:#1a1a1a">
  <div style="background:#18181b;border-radius:12px;padding:16px 20px;margin-bottom:24px">
    <span style="color:#fff;font-weight:700;font-size:18px">FuelU</span>
    <span style="color:#a1a1aa;font-size:13px;margin-left:12px">Meal Plan</span>
  </div>
  <h2 style="font-size:20px;font-weight:700;margin-bottom:4px">${esc(planName)}</h2>
  <p style="color:#71717a;font-size:13px;margin-bottom:20px">Hi ${esc(userName)} — here is your ${esc(planType)} meal plan.</p>
  ${mealsHtml}
  ${shoppingHtml}
  <p style="font-size:11px;color:#a1a1aa;margin-top:28px;border-top:1px solid #e4e4e7;padding-top:16px">
    Results are estimates. Consult a qualified healthcare professional before making dietary changes.
  </p>
</body>
</html>`;
}

export function buildWaitlistInviteEmailHtml(opts: {
  prospectName: string;
  nutritionistName: string;
  inviteUrl: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>You're invited to join FuelU</title></head>
<body style="font-family:sans-serif;max-width:520px;margin:40px auto;padding:0 20px;color:#1a1a1a">
  <div style="margin-bottom:24px">
    <span style="font-weight:700;font-size:18px">FuelU</span>
  </div>
  <h2 style="font-size:22px;font-weight:700;margin-bottom:8px">You've been invited!</h2>
  <p style="color:#555;margin-bottom:24px">Hi ${esc(opts.prospectName)}, great news — <strong>${esc(opts.nutritionistName)}</strong> has a spot available and would like to invite you to join as a client on FuelU.</p>
  <p style="color:#555;margin-bottom:24px">Click the button below to create your account and get started. This invitation link will expire in 7 days.</p>
  <a href="${opts.inviteUrl}" style="display:inline-block;padding:12px 28px;background:#18181b;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px">Accept Invitation</a>
  <p style="margin-top:24px;color:#888;font-size:12px">If you didn't request this, you can safely ignore this email.</p>
  <p style="color:#888;font-size:12px">Or copy this link: <a href="${opts.inviteUrl}" style="color:#555">${opts.inviteUrl}</a></p>
</body>
</html>`;
}

export function buildFeedbackEmailHtml(opts: {
  userName: string;
  userEmail: string;
  category: string;
  message: string;
  submittedAt: string;
}): string {
  const categoryLabel = opts.category === "bug" ? "Bug Report" : opts.category === "feature" ? "Feature Request" : "General Feedback";
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>FuelU Beta Feedback</title></head>
<body style="font-family:sans-serif;max-width:560px;margin:40px auto;padding:0 20px;color:#1a1a1a">
  <div style="margin-bottom:24px">
    <span style="font-weight:700;font-size:18px">FuelU</span>
    <span style="margin-left:8px;font-size:13px;color:#71717a">Beta Feedback</span>
  </div>
  <div style="background:#f4f4f5;border-radius:10px;padding:20px 24px;margin-bottom:20px">
    <p style="margin:0 0 4px 0;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:.05em">Category</p>
    <p style="margin:0;font-weight:600;font-size:15px">${esc(categoryLabel)}</p>
  </div>
  <div style="background:#f4f4f5;border-radius:10px;padding:20px 24px;margin-bottom:20px">
    <p style="margin:0 0 4px 0;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:.05em">Message</p>
    <p style="margin:0;font-size:15px;line-height:1.6;white-space:pre-wrap">${esc(opts.message)}</p>
  </div>
  <div style="background:#f4f4f5;border-radius:10px;padding:16px 24px">
    <p style="margin:0 0 6px 0;font-size:12px;color:#71717a;text-transform:uppercase;letter-spacing:.05em">Submitted by</p>
    <p style="margin:0;font-size:14px"><strong>${esc(opts.userName)}</strong> &lt;${esc(opts.userEmail)}&gt;</p>
    <p style="margin:4px 0 0 0;font-size:12px;color:#71717a">${esc(opts.submittedAt)}</p>
  </div>
</body>
</html>`;
}
