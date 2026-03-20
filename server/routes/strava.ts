import { Router, type Request } from "express";
import crypto from "crypto";
import { storage } from "../storage";

const router = Router();

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

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

function getBaseUrl(req: Request): string {
  if (process.env.REPLIT_DEPLOYMENT_URL) {
    return `https://${process.env.REPLIT_DEPLOYMENT_URL}`;
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers.host;
  return `${proto}://${host}`;
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
    throw new Error("Failed to refresh Strava token");
  }

  const data = (await resp.json()) as StravaTokenResponse;
  await storage.updateStravaConnection(userId, {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenExpiresAt: new Date(data.expires_at * 1000),
  });

  return data.access_token;
}

router.get("/api/strava/auth", (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  if (!STRAVA_CLIENT_ID) return res.status(500).json({ message: "Strava not configured" });

  const state = crypto.randomBytes(16).toString("hex");
  req.session.stravaOAuthState = state;

  const baseUrl = getBaseUrl(req);
  const redirectUri = `${baseUrl}/api/strava/callback`;
  const scope = "read,activity:read_all";
  const authUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&approval_prompt=auto&state=${state}`;

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

    res.redirect("/dashboard?strava=connected");
  } catch (err) {
    console.error("Strava callback error:", err);
    res.redirect("/dashboard?strava=error&reason=unknown");
  }
});

router.get("/api/strava/status", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  const conn = await storage.getStravaConnection(req.session.userId);
  res.json({ connected: !!conn });
});

router.delete("/api/strava/disconnect", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });
  await storage.deleteStravaConnection(req.session.userId);
  res.json({ ok: true });
});

router.get("/api/strava/activities", async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ message: "Not authenticated" });

  const conn = await storage.getStravaConnection(req.session.userId);
  if (!conn) return res.status(404).json({ message: "Strava not connected" });

  try {
    const accessToken = await refreshTokenIfNeeded(req.session.userId, conn);

    const now = Math.floor(Date.now() / 1000);
    const weekAgo = now - 7 * 24 * 60 * 60;

    const activitiesResp = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${weekAgo}&per_page=10`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!activitiesResp.ok) {
      if (activitiesResp.status === 401) {
        await storage.deleteStravaConnection(req.session.userId);
        return res.status(401).json({ message: "Strava token expired. Please reconnect." });
      }
      return res.status(502).json({ message: "Failed to fetch Strava activities" });
    }

    const activities = (await activitiesResp.json()) as StravaActivityRaw[];

    const mapped = activities.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      sportType: a.sport_type,
      startDate: a.start_date_local || a.start_date,
      movingTime: a.moving_time,
      distance: a.distance,
      totalElevationGain: a.total_elevation_gain,
      calories: a.calories || 0,
      averageHeartrate: a.average_heartrate || null,
      maxHeartrate: a.max_heartrate || null,
      averageSpeed: a.average_speed,
    }));

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

export default router;
