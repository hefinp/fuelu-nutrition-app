import { Router, type Request } from "express";
import crypto from "crypto";
import { storage } from "../storage";

const router = Router();

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const STRAVA_WEBHOOK_VERIFY_TOKEN = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN || "fuelr_strava_verify";

interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { id: number };
}

interface StravaActivityRaw {
  id: number;
  name: string;
  type: string;
  sport_type: string;
  start_date_local: string;
  start_date: string;
  moving_time: number;
  distance: number;
  total_elevation_gain: number;
  calories: number;
  average_heartrate: number | null;
  max_heartrate: number | null;
  average_speed: number;
}

function getBaseUrl(req?: Request): string {
  if (process.env.STRAVA_REDIRECT_URL) {
    return process.env.STRAVA_REDIRECT_URL.replace(/\/$/, "");
  }
  const replitDomain = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  if (replitDomain) {
    return `https://${replitDomain}`;
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  if (req) {
    const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const host = req.headers.host;
    return `${proto}://${host}`;
  }
  return "http://localhost:5000";
}

async function refreshTokenIfNeeded(userId: number, connection: { accessToken: string; refreshToken: string; tokenExpiresAt: Date | null }): Promise<string> {
  const now = new Date();
  const expiresAt = connection.tokenExpiresAt ? new Date(connection.tokenExpiresAt) : new Date(0);
  if (expiresAt > new Date(now.getTime() + 60_000)) {
    return connection.accessToken;
  }

  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
    throw new Error("Strava not configured");
  }

  const resp = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: connection.refreshToken,
    }),
  });

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    console.error(`[strava] Token refresh failed ${resp.status}: ${errBody}`);
    throw new Error(`Failed to refresh Strava token (${resp.status})`);
  }

  const data = (await resp.json()) as StravaTokenResponse;
  await storage.updateStravaConnection(userId, {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenExpiresAt: new Date(data.expires_at * 1000),
  });

  return data.access_token;
}

async function fetchAndStoreActivities(userId: number, accessToken: string, afterEpoch?: number): Promise<void> {
  const after = afterEpoch ?? Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
  console.log(`[strava] Fetching activities for user ${userId}: after=${after} (${new Date(after * 1000).toISOString()})`);

  try {
    let activities: StravaActivityRaw[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const pageUrl = `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=${perPage}&page=${page}`;
      console.log(`[strava] Fetching page ${page} for user ${userId}`);
      const listResp = await fetch(pageUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!listResp.ok) {
        const errText = await listResp.text().catch(() => '(could not read body)');
        console.error(`[strava] Activities list API error ${listResp.status}: ${errText}`);
        return;
      }

      const rawText = await listResp.text();
      let pageActivities: StravaActivityRaw[];
      try {
        pageActivities = JSON.parse(rawText) as StravaActivityRaw[];
      } catch (parseErr) {
        console.error(`[strava] Failed to parse activities response as JSON. First 500 chars:`, rawText.slice(0, 500));
        return;
      }

      console.log(`[strava] Page ${page}: got ${pageActivities.length} activities`);
      activities.push(...pageActivities);

      if (pageActivities.length < perPage || page >= 5) break;
      page++;
    }

    console.log(`[strava] Total ${activities.length} activities from API:`, JSON.stringify(activities.map(a => ({ id: a.id, name: a.name, type: a.type, start_date: a.start_date }))));
    if (activities.length === 0) {
      console.log(`[strava] No activities returned from Strava API for user ${userId}`);
      return;
    }

    const detailResults = await Promise.allSettled(
      activities.map((a) =>
        fetch(`https://www.strava.com/api/v3/activities/${a.id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((r) => (r.ok ? r.json() : null))
      )
    );

    const detailCalories = new Map<number, number>();
    for (let i = 0; i < activities.length; i++) {
      const result = detailResults[i];
      if (result.status === "fulfilled" && result.value) {
        const cal = (result.value as { calories?: number }).calories;
        if (cal != null && cal > 0) {
          detailCalories.set(activities[i].id, cal);
        }
      }
    }

    for (const a of activities) {
      try {
        await storage.upsertStravaActivity({
          userId,
          stravaActivityId: a.id,
          name: a.name,
          type: a.type,
          sportType: a.sport_type,
          startDate: new Date(a.start_date),
          movingTime: a.moving_time,
          distance: a.distance,
          totalElevationGain: a.total_elevation_gain,
          calories: detailCalories.get(a.id) ?? a.calories ?? 0,
          averageHeartrate: a.average_heartrate,
          maxHeartrate: a.max_heartrate,
          averageSpeed: a.average_speed,
        });
      } catch (upsertErr) {
        console.error(`[strava] Failed to upsert activity ${a.id} (${a.name}):`, upsertErr);
      }
    }

    console.log(`[strava] Successfully stored ${activities.length} activities for user ${userId}`);
  } catch (err) {
    console.error(`[strava] fetchAndStoreActivities crashed for user ${userId}:`, err);
  }
}

async function fetchAndStoreSingleActivity(userId: number, accessToken: string, stravaActivityId: number): Promise<void> {
  const resp = await fetch(`https://www.strava.com/api/v3/activities/${stravaActivityId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) return;

  const a = (await resp.json()) as StravaActivityRaw;
  await storage.upsertStravaActivity({
    userId,
    stravaActivityId: a.id,
    name: a.name,
    type: a.type,
    sportType: a.sport_type,
    startDate: new Date(a.start_date),
    movingTime: a.moving_time,
    distance: a.distance,
    totalElevationGain: a.total_elevation_gain,
    calories: a.calories ?? 0,
    averageHeartrate: a.average_heartrate,
    maxHeartrate: a.max_heartrate,
    averageSpeed: a.average_speed,
  });
}

// ── OAuth flow ──────────────────────────────────────────────────────────────

router.get("/api/strava/auth", (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  if (!STRAVA_CLIENT_ID) return res.status(500).json({ message: "Strava not configured" });

  const state = crypto.randomBytes(16).toString("hex");
  req.session.stravaOAuthState = state;

  const baseUrl = getBaseUrl(req);
  const redirectUri = `${baseUrl}/api/strava/callback`;
  const scope = "read,activity:read_all";
  const authUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&approval_prompt=force&state=${state}`;

  res.json({ url: authUrl });
});

router.get("/api/strava/callback", async (req, res) => {
  if (!req.session.userId) return res.redirect("/dashboard?strava=error&reason=not_authenticated");
  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) return res.redirect("/dashboard?strava=error&reason=not_configured");

  const state = req.query.state as string;
  const expectedState = req.session.stravaOAuthState;
  if (!state || !expectedState || state !== expectedState) {
    return res.redirect("/dashboard?strava=error&reason=invalid_state");
  }
  delete req.session.stravaOAuthState;

  const code = req.query.code as string;
  if (!code) return res.redirect("/dashboard?strava=error&reason=no_code");

  try {
    const tokenResp = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResp.ok) {
      return res.redirect("/dashboard?strava=error&reason=token_exchange_failed");
    }

    const data = (await tokenResp.json()) as StravaTokenResponse;
    console.log(`[strava] Token exchange - token_type: ${(data as any).token_type}, scope: ${(data as any).scope ?? 'not_returned'}, expires_at: ${data.expires_at}, athlete: ${data.athlete?.id}`);
    const athleteId = String(data.athlete?.id || "");
    const accessToken = data.access_token;
    const refreshToken = data.refresh_token;
    const tokenExpiresAt = new Date(data.expires_at * 1000);

    const existing = await storage.getStravaConnection(req.session.userId);
    if (existing) {
      await storage.updateStravaConnection(req.session.userId, {
        accessToken,
        refreshToken,
        tokenExpiresAt,
      });
    } else {
      await storage.createStravaConnection({
        userId: req.session.userId,
        athleteId,
        accessToken,
        refreshToken,
        tokenExpiresAt,
      });
    }

    fetchAndStoreActivities(req.session.userId, accessToken).catch((err) => {
      console.error("[strava] Backfill error:", err);
    });

    res.redirect("/dashboard?strava=connected");
  } catch (err) {
    console.error("Strava callback error:", err);
    res.redirect("/dashboard?strava=error&reason=unknown");
  }
});

// ── Status & disconnect ─────────────────────────────────────────────────────

router.get("/api/strava/status", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const conn = await storage.getStravaConnection(req.session.userId);
  res.json({ connected: !!conn });
});

router.delete("/api/strava/disconnect", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  await storage.deleteStravaActivitiesByUser(req.session.userId);
  await storage.deleteStravaConnection(req.session.userId);
  res.json({ ok: true });
});

// ── Manual sync (force re-fetch from Strava API) ────────────────────────────

router.post("/api/strava/sync", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });

  const conn = await storage.getStravaConnection(req.session.userId);
  if (!conn) return res.status(404).json({ message: "Strava not connected" });

  try {
    const accessToken = await refreshTokenIfNeeded(req.session.userId, conn);
    await fetchAndStoreActivities(req.session.userId, accessToken);
    res.json({ ok: true });
  } catch (err) {
    console.error("[strava] Manual sync error:", err);
    res.status(500).json({ message: "Failed to sync activities" });
  }
});

// ── Activities (read from DB, fallback to API) ──────────────────────────────

router.get("/api/strava/activities", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });

  const conn = await storage.getStravaConnection(req.session.userId);
  if (!conn) return res.status(404).json({ message: "Strava not connected" });

  try {
    const now = new Date();
    const endBuffer = new Date(now.getTime() + 14 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    let dbActivities = await storage.getStravaActivitiesRange(req.session.userId, weekAgo, endBuffer);

    if (dbActivities.length === 0) {
      try {
        const accessToken = await refreshTokenIfNeeded(req.session.userId, conn);
        await fetchAndStoreActivities(req.session.userId, accessToken);
        dbActivities = await storage.getStravaActivitiesRange(req.session.userId, weekAgo, endBuffer);
      } catch (fetchErr) {
        console.error("[strava] API fallback error:", fetchErr);
      }
    }

    const mapped = dbActivities.map((a) => ({
      id: a.stravaActivityId,
      name: a.name,
      type: a.type,
      sportType: a.sportType || a.type,
      startDate: a.startDate,
      movingTime: a.movingTime,
      distance: a.distance,
      totalElevationGain: a.totalElevationGain ?? 0,
      calories: a.calories ?? 0,
      averageHeartrate: a.averageHeartrate ?? null,
      maxHeartrate: a.maxHeartrate ?? null,
      averageSpeed: a.averageSpeed ?? 0,
    }));

    mapped.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

    let totalCalories = 0;
    let totalDistance = 0;
    let totalDuration = 0;
    let heartRateSum = 0;
    let heartRateCount = 0;

    for (const a of mapped) {
      totalCalories += a.calories;
      totalDistance += a.distance;
      totalDuration += a.movingTime;
      if (a.averageHeartrate) {
        heartRateSum += a.averageHeartrate;
        heartRateCount++;
      }
    }

    const weeklyStats = {
      totalActivities: mapped.length,
      totalCalories: Math.round(totalCalories),
      totalDistanceKm: +(totalDistance / 1000).toFixed(1),
      totalDurationMinutes: Math.round(totalDuration / 60),
      avgHeartRate: heartRateCount > 0 ? Math.round(heartRateSum / heartRateCount) : null,
    };

    res.json({ activities: mapped, weeklyStats });
  } catch (err) {
    console.error("Strava activities error:", err);
    res.status(500).json({ message: err instanceof Error ? err.message : "Failed to fetch activities" });
  }
});

// ── Activities by date (for diary) ───────────────────────────────────────────

function isValidDateString(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00");
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

router.get("/api/strava/activities/date/:date", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });

  const conn = await storage.getStravaConnection(req.session.userId);
  if (!conn) return res.json({ activities: [], totalCalories: 0 });

  const date = req.params.date;
  if (!isValidDateString(date)) {
    return res.status(400).json({ message: "Invalid date format (YYYY-MM-DD)" });
  }

  try {
    const dbActivities = await storage.getStravaActivitiesByDate(req.session.userId, date);

    const mapped = dbActivities.map((a) => ({
      id: a.stravaActivityId,
      name: a.name,
      type: a.type,
      sportType: a.sportType || a.type,
      startDate: a.startDate,
      movingTime: a.movingTime,
      distance: a.distance,
      calories: a.calories ?? 0,
      averageHeartrate: a.averageHeartrate ?? null,
    }));

    const totalCalories = Math.round(mapped.reduce((s, a) => s + a.calories, 0));

    res.json({ activities: mapped, totalCalories });
  } catch (err) {
    console.error("[strava] Activities by date error:", err);
    res.status(500).json({ message: "Failed to load activities", activities: [], totalCalories: 0 });
  }
});

// ── Activities date-range (for TDEE) ────────────────────────────────────────

router.get("/api/strava/activities/range", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });

  const conn = await storage.getStravaConnection(req.session.userId);
  if (!conn) return res.json({ dailyCalories: {} });

  const from = req.query.from as string;
  const to = req.query.to as string;
  if (!from || !to || !isValidDateString(from) || !isValidDateString(to)) {
    return res.status(400).json({ message: "Valid from and to date params required (YYYY-MM-DD)" });
  }

  try {
    const startDate = new Date(from + "T00:00:00");
    const endDate = new Date(to + "T23:59:59.999");
    const dbActivities = await storage.getStravaActivitiesRange(req.session.userId, startDate, endDate);

    const dailyCalories: Record<string, number> = {};
    for (const a of dbActivities) {
      const day = new Date(a.startDate).toISOString().slice(0, 10);
      dailyCalories[day] = (dailyCalories[day] ?? 0) + (a.calories ?? 0);
    }

    for (const key of Object.keys(dailyCalories)) {
      dailyCalories[key] = Math.round(dailyCalories[key]);
    }

    res.json({ dailyCalories });
  } catch (err) {
    console.error("[strava] Activities range error:", err);
    res.json({ dailyCalories: {} });
  }
});

// ── Webhook endpoints ───────────────────────────────────────────────────────

router.get("/api/strava/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === STRAVA_WEBHOOK_VERIFY_TOKEN) {
    res.json({ "hub.challenge": challenge });
  } else {
    res.status(403).json({ message: "Verification failed" });
  }
});

router.post("/api/strava/webhook", async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const { object_type, aspect_type, object_id, owner_id, subscription_id } = body;

  if (
    typeof object_type !== "string" ||
    typeof aspect_type !== "string" ||
    typeof object_id !== "number" ||
    typeof owner_id !== "number" ||
    typeof subscription_id !== "number"
  ) {
    res.status(400).json({ message: "Invalid webhook payload" });
    return;
  }

  res.status(200).json({ ok: true });

  try {
    if (object_type !== "activity") return;

    const match = await findStravaConnectionByAthleteId(String(owner_id));
    if (!match) return;

    const { userId } = match;

    if (aspect_type === "delete") {
      await storage.deleteStravaActivity(userId, object_id);
      return;
    }

    if (aspect_type === "create" || aspect_type === "update") {
      const connData = await storage.getStravaConnection(userId);
      if (!connData) return;
      const accessToken = await refreshTokenIfNeeded(userId, connData);
      await fetchAndStoreSingleActivity(userId, accessToken, object_id);
    }
  } catch (err) {
    console.error("[strava] Webhook processing error:", err);
  }
});

async function findStravaConnectionByAthleteId(athleteId: string) {
  const { pool } = await import("../db");
  const result = await pool.query(
    `SELECT user_id FROM strava_connections WHERE athlete_id = $1 LIMIT 1`,
    [athleteId]
  );
  if (result.rows.length === 0) return null;
  return { userId: result.rows[0].user_id as number };
}

export async function registerStravaWebhook(): Promise<void> {
  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
    console.log("[strava] Skipping webhook registration — STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET not set");
    return;
  }

  const callbackUrl = `${getBaseUrl()}/api/strava/webhook`;

  try {
    const listRes = await fetch(
      `https://www.strava.com/api/v3/push_subscriptions?client_id=${STRAVA_CLIENT_ID}&client_secret=${STRAVA_CLIENT_SECRET}`
    );

    if (!listRes.ok) {
      const errText = await listRes.text();
      console.error(`[strava] Failed to list webhook subscriptions (${listRes.status}): ${errText}`);
      return;
    }

    const subscriptions = (await listRes.json()) as Array<{ id: number; callback_url: string }>;

    if (subscriptions.length > 0) {
      const existing = subscriptions[0];
      console.log(`[strava] Webhook subscription already exists (id=${existing.id}, callback=${existing.callback_url})`);
      if (existing.callback_url !== callbackUrl) {
        console.warn(`[strava] WARNING: Existing callback URL differs from expected. Expected: ${callbackUrl}, Got: ${existing.callback_url}`);
      }
      return;
    }

    console.log(`[strava] No webhook subscription found — creating one with callback: ${callbackUrl}`);

    const createRes = await fetch("https://www.strava.com/api/v3/push_subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        callback_url: callbackUrl,
        verify_token: STRAVA_WEBHOOK_VERIFY_TOKEN,
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error(`[strava] Failed to create webhook subscription (${createRes.status}): ${errText}`);
      return;
    }

    const created = (await createRes.json()) as { id: number };
    console.log(`[strava] Webhook subscription created successfully (id=${created.id})`);
  } catch (err) {
    console.error("[strava] Error during webhook registration:", err);
  }
}

export default router;
