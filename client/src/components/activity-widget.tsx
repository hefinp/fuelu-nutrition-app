import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Activity, Clock, Flame, Heart, MapPin, Loader2, Unplug, RefreshCw, ExternalLink } from "lucide-react";
import { getActivityIcon } from "@/lib/activityIcons";

interface StravaActivity {
  id: number;
  name: string;
  type: string;
  sportType: string;
  startDate: string;
  movingTime: number;
  distance: number;
  calories: number;
  averageHeartrate: number | null;
  maxHeartrate: number | null;
  averageSpeed: number;
}

interface WeeklyStats {
  totalActivities: number;
  totalCalories: number;
  totalDistanceKm: number;
  totalDurationMinutes: number;
  avgHeartRate: number | null;
}

interface ActivitiesResponse {
  activities: StravaActivity[];
  weeklyStats: WeeklyStats;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDistance(meters: number): string {
  const km = meters / 1000;
  if (km >= 1) return `${km.toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}


export function ActivityWidget() {
  const queryClient = useQueryClient();

  const { data: status, isLoading: statusLoading } = useQuery<{ connected: boolean }>({
    queryKey: ["/api/strava/status"],
  });

  const { data: activitiesData, isLoading: activitiesLoading } = useQuery<ActivitiesResponse>({
    queryKey: ["/api/strava/activities"],
    enabled: status?.connected === true,
    staleTime: 5 * 60 * 1000,
  });

  const connectMutation = useMutation({
    mutationFn: () => apiRequest("GET", "/api/strava/auth").then(r => r.json()),
    onSuccess: (data: { url: string }) => {
      window.location.href = data.url;
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/strava/disconnect"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strava/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/strava/activities"] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/strava/sync"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/strava/activities"] });
    },
  });

  if (statusLoading) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-100 shadow-md p-6" data-testid="widget-activity">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center">
            <Activity className="w-4 h-4 text-orange-500" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-800">Activity</h3>
        </div>
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-zinc-300" />
        </div>
      </div>
    );
  }

  if (!status?.connected) {
    return (
      <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl border border-orange-100 p-5" data-testid="widget-activity-connect">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/80 flex items-center justify-center flex-shrink-0">
            <Activity className="w-4.5 h-4.5 text-orange-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-zinc-800 mb-1">Activity Tracking</h4>
            <p className="text-xs text-zinc-500 leading-relaxed mb-3">
              Connect your Strava account to see your workouts, calories burned, and weekly stats right on your dashboard.
            </p>
            <button
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-600 text-white rounded-lg text-xs font-medium hover:bg-orange-700 transition-colors disabled:opacity-50"
              data-testid="button-connect-strava"
            >
              {connectMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
              Connect Strava
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activities = activitiesData?.activities ?? [];
  const stats = activitiesData?.weeklyStats;

  return (
    <div className="bg-white rounded-2xl border border-zinc-100 shadow-md" data-testid="widget-activity">
      <div className="flex items-center justify-between p-5 pb-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center">
            <Activity className="w-4 h-4 text-orange-500" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-800">Activity</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="text-xs text-zinc-400 hover:text-orange-500 transition-colors flex items-center gap-1"
            data-testid="button-sync-strava"
            title="Refresh activities from Strava"
          >
            <RefreshCw className={`w-3 h-3 ${syncMutation.isPending ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={() => disconnectMutation.mutate()}
            disabled={disconnectMutation.isPending}
            className="text-xs text-zinc-400 hover:text-red-500 transition-colors flex items-center gap-1"
            data-testid="button-disconnect-strava"
          >
            <Unplug className="w-3 h-3" />
            Disconnect
          </button>
        </div>
      </div>

      {activitiesLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-zinc-300" />
        </div>
      ) : (
        <div className="p-5 pt-4 space-y-4">
          {stats && (
            <div className="grid grid-cols-2 gap-2.5" data-testid="strava-weekly-stats">
              <div className="bg-orange-50/60 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium mb-0.5">This Week</p>
                <p className="text-lg font-bold text-zinc-800">{stats.totalActivities}</p>
                <p className="text-[10px] text-zinc-400">activities</p>
              </div>
              <div className="bg-red-50/60 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium mb-0.5">Calories</p>
                <p className="text-lg font-bold text-zinc-800">{stats.totalCalories.toLocaleString()}</p>
                <p className="text-[10px] text-zinc-400">burned</p>
              </div>
              <div className="bg-blue-50/60 rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium mb-0.5">Distance</p>
                <p className="text-lg font-bold text-zinc-800">{stats.totalDistanceKm}</p>
                <p className="text-[10px] text-zinc-400">km total</p>
              </div>
              {stats.avgHeartRate ? (
                <div className="bg-pink-50/60 rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium mb-0.5">Avg HR</p>
                  <p className="text-lg font-bold text-zinc-800">{stats.avgHeartRate}</p>
                  <p className="text-[10px] text-zinc-400">bpm</p>
                </div>
              ) : (
                <div className="bg-zinc-50/60 rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium mb-0.5">Duration</p>
                  <p className="text-lg font-bold text-zinc-800">{stats.totalDurationMinutes}</p>
                  <p className="text-[10px] text-zinc-400">minutes</p>
                </div>
              )}
            </div>
          )}

          {activities.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">Recent Activities</p>
              {activities.slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-start gap-3 py-2 border-b border-zinc-50 last:border-0" data-testid={`activity-item-${a.id}`}>
                  {((Icon) => (
                    <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5 text-orange-500" />
                    </div>
                  ))(getActivityIcon(a.type))}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-medium text-zinc-800 truncate">{a.name}</p>
                      <span className="text-[10px] text-zinc-400 flex-shrink-0">{formatDate(a.startDate)}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                        <Clock className="w-3 h-3" />
                        {formatDuration(a.movingTime)}
                      </span>
                      {a.distance > 0 && (
                        <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                          <MapPin className="w-3 h-3" />
                          {formatDistance(a.distance)}
                        </span>
                      )}
                      {a.calories > 0 && (
                        <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                          <Flame className="w-3 h-3" />
                          {a.calories} cal
                        </span>
                      )}
                      {a.averageHeartrate && (
                        <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                          <Heart className="w-3 h-3" />
                          {Math.round(a.averageHeartrate)} bpm
                        </span>
                      )}
                    </div>
                  </div>
                  <a
                    href={`https://www.strava.com/activities/${a.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center gap-1 text-xs font-medium transition-colors"
                    style={{ color: "#FC5200" }}
                    data-testid={`activity-strava-link-${a.id}`}
                    title="View on Strava"
                    aria-label="View on Strava"
                  >
                    View on Strava
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-xs text-zinc-400">No activities in the past 7 days</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
