import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM_ADDRESS = "NutriSync <noreply@nutrisync.app>";

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<void> {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping email send. Would have sent to:", to, "| Subject:", subject);
    return;
  }
  const { error } = await resend.emails.send({ from: FROM_ADDRESS, to, subject, html });
  if (error) {
    throw new Error(`Email send failed: ${error.message}`);
  }
}

export function buildPasswordResetEmailHtml(resetUrl: string, name: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Reset your NutriSync password</title></head>
<body style="font-family:sans-serif;max-width:520px;margin:40px auto;padding:0 20px;color:#1a1a1a">
  <div style="margin-bottom:24px">
    <span style="font-weight:700;font-size:18px">NutriSync</span>
  </div>
  <h2 style="font-size:22px;font-weight:700;margin-bottom:8px">Reset your password</h2>
  <p style="color:#555;margin-bottom:24px">Hi ${name}, we received a request to reset your NutriSync password. Click the button below to choose a new one. This link expires in 1 hour.</p>
  <a href="${resetUrl}" style="display:inline-block;padding:12px 28px;background:#18181b;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:14px">Reset Password</a>
  <p style="margin-top:24px;color:#888;font-size:12px">If you didn't request this, you can safely ignore this email. Your password won't change.</p>
  <p style="color:#888;font-size:12px">Or copy this link: <a href="${resetUrl}" style="color:#555">${resetUrl}</a></p>
</body>
</html>`;
}

export function buildMealPlanEmailHtml(planName: string, userName: string, planData: any, planType: string): string {
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
          <span style="font-size:13px;font-weight:600;color:#18181b">${m.meal}</span>
          <span style="float:right;font-size:12px;color:#71717a">${m.calories} kcal</span>
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

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${planName}</title></head>
<body style="font-family:sans-serif;max-width:560px;margin:40px auto;padding:0 20px;color:#1a1a1a">
  <div style="background:#18181b;border-radius:12px;padding:16px 20px;margin-bottom:24px">
    <span style="color:#fff;font-weight:700;font-size:18px">NutriSync</span>
    <span style="color:#a1a1aa;font-size:13px;margin-left:12px">Meal Plan</span>
  </div>
  <h2 style="font-size:20px;font-weight:700;margin-bottom:4px">${planName}</h2>
  <p style="color:#71717a;font-size:13px;margin-bottom:20px">Hi ${userName} — here is your ${planType} meal plan.</p>
  ${mealsHtml}
  <p style="font-size:11px;color:#a1a1aa;margin-top:28px;border-top:1px solid #e4e4e7;padding-top:16px">
    Results are estimates. Consult a qualified healthcare professional before making dietary changes.
  </p>
</body>
</html>`;
}
