import { Activity, Flame, Clock, MapPin, ExternalLink, Loader2 } from "lucide-react";
import { getActivityIcon } from "@/lib/activityIcons";

interface DiaryActivityData {
  id: number;
  name: string;
  type: string;
  movingTime: number;
  distance: number;
  calories: number;
  averageHeartrate: number | null;
  deviceType: string | null;
}

interface DiaryStravaSectionProps {
  activities: DiaryActivityData[];
  totalCalories: number;
  isLoading: boolean;
  isError: boolean;
}

export function DiaryStravaSection({ activities, totalCalories, isLoading, isError }: DiaryStravaSectionProps) {
  if (isLoading) {
    return (
      <div className="bg-orange-50/40 border border-orange-100 rounded-xl p-3 mb-4" data-testid="diary-widget-activity-loading">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-orange-500" />
          <span className="text-xs font-medium text-zinc-500">Loading activities...</span>
          <Loader2 className="w-3 h-3 animate-spin text-zinc-400 ml-auto" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-orange-50/40 border border-orange-100 rounded-xl p-3 mb-4" data-testid="diary-widget-activity-error">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-xs text-zinc-400">Unable to load Strava activities</span>
        </div>
      </div>
    );
  }

  if (activities.length === 0) return null;

  return (
    <div className="bg-orange-50/40 border border-orange-100 rounded-xl p-3 mb-4" data-testid="diary-widget-activity-section">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1 rounded-md bg-orange-100/80">
          <Activity className="w-3 h-3 text-orange-600" />
        </div>
        <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider flex-1">Activity</span>
        {totalCalories > 0 && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-orange-600" data-testid="diary-widget-activity-total-cal">
            <Flame className="w-3 h-3" />
            {totalCalories} kcal burned
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {activities.map((a) => (
          <div key={a.id} data-testid={`diary-widget-activity-${a.id}`}>
            <div className="flex items-center gap-2 py-1">
              {((Icon) => (
                <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5 text-orange-500" />
                </div>
              ))(getActivityIcon(a.type))}
              <span className="text-xs font-medium text-zinc-700 flex-1 truncate">{a.name}</span>
              <div className="flex items-center gap-2 text-[10px] text-zinc-400">
                <span className="flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {a.movingTime >= 3600
                    ? `${Math.floor(a.movingTime / 3600)}h ${Math.floor((a.movingTime % 3600) / 60)}m`
                    : `${Math.floor(a.movingTime / 60)}m`}
                </span>
                {a.distance > 0 && (
                  <span className="flex items-center gap-0.5">
                    <MapPin className="w-2.5 h-2.5" />
                    {(a.distance / 1000).toFixed(1)}km
                  </span>
                )}
                {a.calories > 0 && (
                  <span className="font-medium text-orange-500">{Math.round(a.calories)} cal</span>
                )}
              </div>
              <a
                href={`https://www.strava.com/activities/${a.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1 text-xs font-medium transition-colors"
                style={{ color: "#FC4C02" }}
                data-testid={`diary-widget-activity-strava-link-${a.id}`}
                title="View on Strava"
                aria-label="View on Strava"
              >
                View on Strava
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            {a.deviceType && /garmin/i.test(a.deviceType) && (
              <p className="text-[10px] text-zinc-400 ml-10 -mt-0.5" data-testid={`diary-widget-garmin-attr-${a.id}`}>Recorded with Garmin</p>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-center pt-2" data-testid="diary-widget-strava-powered-badge">
        <img src="/strava-powered-by.svg" alt="Powered by Strava" className="h-4 opacity-60" />
      </div>
    </div>
  );
}

export type { DiaryActivityData };
