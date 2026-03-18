import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Users, Plus, Search, X, FileText, ArrowLeft,
  Mail, Calendar, ChevronRight, Trash2, Edit2, Check, AlertCircle, ClipboardList,
  Activity, BarChart2, Bell, Building2, UserMinus, UserPlus, RefreshCw,
  TrendingDown, TrendingUp, Minus, ChevronDown, ChevronUp, Settings,
  MessageSquare, Send, Target, RotateCcw, Heart, Pill, Utensils, Leaf, StickyNote, CheckCircle2
} from "lucide-react";

interface ClientWithUser {
  id: number;
  nutritionistId: number;
  clientId: number;
  status: string;
  goalSummary: string | null;
  healthNotes: string | null;
  lastActivityAt: string | null;
  createdAt: string;
  client: {
    id: number;
    name: string;
    email: string;
    preferences: Record<string, unknown> | null;
    isManagedClient: boolean;
    createdAt: string;
  };
}

interface ClientWithMonitoring extends ClientWithUser {
  monitoring: {
    daysLogged: number;
    daysInactive: number;
    lastLogDate: string | null;
    adherenceScore: number | null;
    avgCalories: number | null;
    targetCalories: number | null;
    alerts: string[];
    recentWeight: number | null;
  };
}

interface Capacity {
  tier: string;
  limit: number;
  count: number;
  canAddMore: boolean;
}

interface Note {
  id: number;
  note: string;
  createdAt: string;
  updatedAt: string;
}

interface ClientProfileData {
  id: number;
  nutritionistId: number;
  clientId: number;
  status: string;
  goalSummary: string | null;
  healthNotes: string | null;
  lastActivityAt: string | null;
  createdAt: string;
  client: {
    id: number;
    name: string;
    email: string;
    preferences: Record<string, unknown> | null;
    isManagedClient: boolean;
    createdAt: string;
  };
  preferences: Record<string, unknown> | null;
}

interface Invitation {
  id: number;
  nutritionistId: number;
  email: string;
  token: string;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  inviteUrl?: string;
}

interface NutritionistProfile {
  id: number;
  userId: number;
  tier: string;
  bio: string | null;
  credentials: string | null;
  specializations: string[] | null;
  createdAt: string;
  updatedAt: string;
}

interface ClientIntakeForm {
  id: number;
  nutritionistClientId: number;
  nutritionistId: number;
  clientId: number;
  medicalHistory: string | null;
  medications: string | null;
  lifestyle: string | null;
  dietaryRestrictions: string | null;
  foodPreferences: string | null;
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ClientGoal {
  id: number;
  nutritionistClientId: number;
  nutritionistId: number;
  clientId: number;
  goalType: string;
  title: string;
  targetValue: string | null;
  currentValue: string | null;
  unit: string | null;
  targetDate: string | null;
  status: string;
  progress: number | null;
  onTrack: boolean | null;
  createdAt: string;
  updatedAt: string;
}

interface Alert {
  clientId: number;
  clientName: string;
  type: string;
  severity: "high" | "medium" | "low";
  message: string;
  date: string;
}

interface AdherenceData {
  clientId: number;
  fromDate: string;
  toDate: string;
  dailyBreakdown: Array<{
    date: string;
    logged: boolean;
    actual: { calories: number; protein: number; carbs: number; fat: number };
    target: { calories: number; protein: number; carbs: number; fat: number } | null;
    adherencePct: number | null;
  }>;
  weightTrend: Array<{ date: string; weight: number }>;
  targets: { calories: number; protein: number; carbs: number; fat: number } | null;
}

interface PracticeData {
  id: number;
  name: string;
  adminUserId: number;
  maxSeats: number;
  createdAt: string;
  role: string;
}

interface PracticeMember {
  id: number;
  practiceId: number;
  nutritionistUserId: number;
  role: string;
  createdAt: string;
  nutritionist: {
    id: number;
    name: string;
    email: string;
    profile: NutritionistProfile | null;
  };
}

interface PracticeClientsGroup {
  nutritionistId: number;
  nutritionistName: string;
  clients: ClientWithUser[];
}

const STATUS_LABELS: Record<string, { label: string; classes: string }> = {
  onboarding: { label: "Onboarding", classes: "bg-blue-50 text-blue-700" },
  active: { label: "Active", classes: "bg-emerald-50 text-emerald-700" },
  paused: { label: "Paused", classes: "bg-zinc-100 text-zinc-500" },
};

const ALERT_SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  high: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", icon: "text-red-500" },
  medium: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", icon: "text-amber-500" },
  low: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", icon: "text-emerald-500" },
};

const ALERT_TYPE_LABELS: Record<string, string> = {
  inactive: "Inactive",
  over_fueling: "Over-fueling",
  under_fueling: "Under-fueling",
  missed_targets: "Missed targets",
  milestone: "Milestone",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function AdherenceBar({ pct }: { pct: number | null }) {
  if (pct === null) return <div className="w-full h-1.5 bg-zinc-100 rounded-full" />;
  const color = pct >= 80 ? "bg-emerald-400" : pct >= 60 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

function MonitoringDashboard({
  onSelectClient,
}: {
  onSelectClient: (c: ClientWithUser) => void;
}) {
  const [sortBy, setSortBy] = useState<"urgency" | "name" | "adherence">("urgency");
  const [statusFilter, setStatusFilter] = useState("active");
  const [search, setSearch] = useState("");

  const { data: dashboardData = [], isLoading } = useQuery<ClientWithMonitoring[]>({
    queryKey: ["/api/nutritionist/monitoring/dashboard"],
    queryFn: () => apiRequest("GET", "/api/nutritionist/monitoring/dashboard").then(r => r.json()),
    refetchInterval: 60000,
  });

  const { data: alerts = [] } = useQuery<Alert[]>({
    queryKey: ["/api/nutritionist/monitoring/alerts"],
    queryFn: () => apiRequest("GET", "/api/nutritionist/monitoring/alerts").then(r => r.json()),
  });

  const highAlerts = alerts.filter(a => a.severity === "high");

  let filtered = dashboardData.filter(c => {
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    const matchSearch = !search ||
      c.client.name.toLowerCase().includes(search.toLowerCase()) ||
      c.client.email.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  if (sortBy === "name") filtered = [...filtered].sort((a, b) => a.client.name.localeCompare(b.client.name));
  else if (sortBy === "adherence") filtered = [...filtered].sort((a, b) => (b.monitoring.adherenceScore ?? -1) - (a.monitoring.adherenceScore ?? -1));

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-display font-bold text-zinc-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-zinc-500" />
            Monitoring Dashboard
          </h2>
          <p className="text-sm text-zinc-500 mt-0.5">{dashboardData.length} clients tracked</p>
        </div>
        {highAlerts.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-xl" data-testid="banner-high-alerts">
            <Bell className="w-4 h-4 text-red-500" />
            <span className="text-sm font-medium text-red-700">{highAlerts.length} urgent alert{highAlerts.length !== 1 ? "s" : ""}</span>
          </div>
        )}
      </div>

      {alerts.length > 0 && (
        <div className="mb-4 space-y-2">
          {alerts.slice(0, 3).map((alert, i) => {
            const c = ALERT_SEVERITY_COLORS[alert.severity];
            return (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${c.bg} ${c.border}`} data-testid={`alert-${alert.type}-${alert.clientId}`}>
                <AlertCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${c.icon}`} />
                <div className="flex-1 min-w-0">
                  <span className={`text-xs font-semibold ${c.text}`}>{ALERT_TYPE_LABELS[alert.type] ?? alert.type}</span>
                  <p className={`text-xs ${c.text} mt-0.5`}>{alert.message}</p>
                </div>
              </div>
            );
          })}
          {alerts.length > 3 && (
            <p className="text-xs text-zinc-400 pl-1">+{alerts.length - 3} more alerts</p>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="w-full pl-9 pr-3 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-400"
            data-testid="input-search-monitoring"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none text-zinc-700 bg-white"
          data-testid="select-monitoring-status"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="onboarding">Onboarding</option>
          <option value="paused">Paused</option>
        </select>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}
          className="px-3 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none text-zinc-700 bg-white"
          data-testid="select-monitoring-sort"
        >
          <option value="urgency">Sort by urgency</option>
          <option value="name">Sort by name</option>
          <option value="adherence">Sort by adherence</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-100 p-12 text-center">
          <Activity className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-zinc-600 mb-1">No clients match this filter</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(c => {
            const s = STATUS_LABELS[c.status] ?? STATUS_LABELS.onboarding;
            const m = c.monitoring;
            const hasAlerts = m.alerts.length > 0;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelectClient(c)}
                className={`w-full bg-white rounded-2xl border p-4 flex items-center gap-4 hover:shadow-sm transition-all text-left ${hasAlerts ? "border-amber-200" : "border-zinc-100 hover:border-zinc-300"}`}
                data-testid={`card-monitoring-${c.id}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${hasAlerts ? "bg-amber-500" : "bg-zinc-900"}`}>
                  {c.client.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-zinc-900">{c.client.name}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${s.classes}`}>{s.label}</span>
                    {m.alerts.filter(a => a.startsWith("inactive")).map((a, i) => (
                      <span key={i} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-700">
                        {a.replace("inactive_", "").replace("d", "d inactive")}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-24">
                      <AdherenceBar pct={m.adherenceScore} />
                    </div>
                    <span className="text-xs text-zinc-400">
                      {m.adherenceScore !== null ? `${m.adherenceScore}% adherence` : "No targets set"}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {m.daysLogged}/7 days logged
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 hidden sm:block">
                  <p className="text-xs text-zinc-400">Last log</p>
                  <p className="text-xs font-medium text-zinc-600">{m.lastLogDate ? formatDateShort(m.lastLogDate) : "Never"}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-300 flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AdherenceView({ clientRecord, onBack }: { clientRecord: ClientWithUser; onBack: () => void }) {
  const [days, setDays] = useState(14);

  const { data, isLoading } = useQuery<AdherenceData>({
    queryKey: ["/api/nutritionist/monitoring/clients", clientRecord.clientId, "adherence", days],
    queryFn: () => apiRequest("GET", `/api/nutritionist/monitoring/clients/${clientRecord.clientId}/adherence?days=${days}`).then(r => r.json()),
  });

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 mb-6 transition-colors"
        data-testid="button-back-adherence"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to client profile
      </button>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900">{clientRecord.client.name} — Planned vs Actual</h2>
          <p className="text-sm text-zinc-500">Daily nutrition breakdown</p>
        </div>
        <div className="flex gap-1">
          {[7, 14, 30].map(d => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${days === d ? "bg-zinc-900 text-white" : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}
              data-testid={`button-days-${d}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>
      ) : !data ? null : (
        <div className="space-y-4">
          {data.targets && (
            <div className="bg-white rounded-2xl border border-zinc-100 p-4">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Daily Targets</h3>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Calories", value: data.targets.calories, unit: "kcal" },
                  { label: "Protein", value: data.targets.protein, unit: "g" },
                  { label: "Carbs", value: data.targets.carbs, unit: "g" },
                  { label: "Fat", value: data.targets.fat, unit: "g" },
                ].map(item => (
                  <div key={item.label} className="text-center">
                    <p className="text-lg font-bold text-zinc-900">{item.value}</p>
                    <p className="text-xs text-zinc-400">{item.label} ({item.unit})</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100">
              <h3 className="text-sm font-semibold text-zinc-900">Daily Log</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50">
                    <th className="text-left px-4 py-2 font-medium text-zinc-500">Date</th>
                    <th className="text-right px-3 py-2 font-medium text-zinc-500">Calories</th>
                    <th className="text-right px-3 py-2 font-medium text-zinc-500 hidden sm:table-cell">Protein</th>
                    <th className="text-right px-3 py-2 font-medium text-zinc-500 hidden sm:table-cell">Carbs</th>
                    <th className="text-right px-3 py-2 font-medium text-zinc-500 hidden sm:table-cell">Fat</th>
                    <th className="text-right px-4 py-2 font-medium text-zinc-500">Adherence</th>
                  </tr>
                </thead>
                <tbody>
                  {data.dailyBreakdown.slice().reverse().map((day, i) => {
                    const calDiff = data.targets ? day.actual.calories - data.targets.calories : 0;
                    return (
                      <tr key={day.date} className={`border-b border-zinc-50 ${i % 2 === 0 ? "" : "bg-zinc-50/50"}`} data-testid={`row-adherence-${day.date}`}>
                        <td className="px-4 py-2.5 font-medium text-zinc-700">{formatDateShort(day.date)}</td>
                        <td className="px-3 py-2.5 text-right">
                          {day.logged ? (
                            <span className={day.actual.calories > 0 && data.targets ? (calDiff > 200 ? "text-red-600" : calDiff < -200 ? "text-amber-600" : "text-emerald-600") : "text-zinc-700"}>
                              {day.actual.calories}
                              {data.targets && <span className="text-zinc-400 font-normal"> / {data.targets.calories}</span>}
                            </span>
                          ) : (
                            <span className="text-zinc-300 italic">Not logged</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right hidden sm:table-cell text-zinc-600">
                          {day.logged ? `${day.actual.protein}g` : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right hidden sm:table-cell text-zinc-600">
                          {day.logged ? `${day.actual.carbs}g` : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right hidden sm:table-cell text-zinc-600">
                          {day.logged ? `${day.actual.fat}g` : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {day.adherencePct !== null ? (
                            <span className={`font-medium ${day.adherencePct >= 80 ? "text-emerald-600" : day.adherencePct >= 60 ? "text-amber-600" : "text-red-600"}`}>
                              {day.adherencePct}%
                            </span>
                          ) : (
                            <span className="text-zinc-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {data.weightTrend.length > 0 && (
            <div className="bg-white rounded-2xl border border-zinc-100 p-4">
              <h3 className="text-sm font-semibold text-zinc-900 mb-3 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-zinc-400" />
                Weight Trend
              </h3>
              <div className="flex gap-4 overflow-x-auto pb-1">
                {data.weightTrend.slice(-14).map(w => (
                  <div key={w.date} className="text-center flex-shrink-0">
                    <p className="text-sm font-bold text-zinc-900">{w.weight}</p>
                    <p className="text-[10px] text-zinc-400">{formatDateShort(w.date)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ClientRoster({
  clients,
  capacity,
  onSelectClient,
  onInvite,
  unreadMap,
}: {
  clients: ClientWithUser[];
  capacity: Capacity;
  onSelectClient: (c: ClientWithUser) => void;
  onInvite: () => void;
  unreadMap?: Map<number, number>;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = clients.filter(c => {
    const matchSearch = c.client.name.toLowerCase().includes(search.toLowerCase()) ||
      c.client.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-display font-bold text-zinc-900">Client Roster</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            {capacity.count} of {capacity.limit === 999 ? "unlimited" : capacity.limit} clients
          </p>
        </div>
        <button
          type="button"
          onClick={onInvite}
          disabled={!capacity.canAddMore}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          data-testid="button-invite-client"
        >
          <Plus className="w-4 h-4" />
          Invite Client
        </button>
      </div>

      {!capacity.canAddMore && (
        <div className="flex items-start gap-3 p-4 mb-4 bg-amber-50 border border-amber-200 rounded-2xl" data-testid="banner-limit-reached">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">Client limit reached</p>
            <p className="text-xs text-amber-700 mt-0.5">
              You have reached your {capacity.limit}-client limit for the {capacity.tier} tier. Upgrade your plan to add more clients.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="w-full pl-9 pr-3 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-400"
            data-testid="input-search-clients"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20 text-zinc-700 bg-white"
          data-testid="select-status-filter"
        >
          <option value="all">All statuses</option>
          <option value="onboarding">Onboarding</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-100 p-12 text-center" data-testid="state-empty-clients">
          <Users className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-zinc-600 mb-1">
            {clients.length === 0 ? "No clients yet" : "No matching clients"}
          </p>
          <p className="text-xs text-zinc-400">
            {clients.length === 0
              ? "Invite your first client using the button above."
              : "Try adjusting your search or filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(client => {
            const s = STATUS_LABELS[client.status] ?? STATUS_LABELS.onboarding;
            return (
              <button
                key={client.id}
                type="button"
                onClick={() => onSelectClient(client)}
                className="w-full bg-white rounded-2xl border border-zinc-100 p-4 flex items-center gap-4 hover:border-zinc-300 hover:shadow-sm transition-all text-left"
                data-testid={`card-client-${client.id}`}
              >
                <div className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {client.client.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-zinc-900">{client.client.name}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${s.classes}`}>
                      {s.label}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 truncate">{client.client.email}</p>
                  {client.goalSummary && (
                    <p className="text-xs text-zinc-400 mt-0.5 truncate">{client.goalSummary}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-zinc-400">Last active</p>
                  <p className="text-xs font-medium text-zinc-600">{formatDate(client.lastActivityAt)}</p>
                </div>
                {(unreadMap?.get(client.clientId) ?? 0) > 0 && (
                  <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-full flex-shrink-0" data-testid={`badge-unread-${client.clientId}`}>
                    {unreadMap!.get(client.clientId)}
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-zinc-300 flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface NutMessage {
  id: number;
  nutritionistId: number;
  clientId: number;
  senderId: number;
  body: string;
  isRead: boolean;
  createdAt: string;
}

function MessageThread({
  clientId,
  currentUserId,
}: {
  clientId: number;
  currentUserId: number;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newMessage, setNewMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery<NutMessage[]>({
    queryKey: ["/api/nutritionist/clients", clientId, "messages"],
    queryFn: () => apiRequest("GET", `/api/nutritionist/clients/${clientId}/messages`).then(r => r.json()),
    refetchInterval: 5000,
  });

  const sendMutation = useMutation({
    mutationFn: (body: string) =>
      apiRequest("POST", `/api/nutritionist/clients/${clientId}/messages`, { body }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/clients", clientId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/messages/unread-counts"] });
      setNewMessage("");
    },
    onError: () => toast({ title: "Failed to send message", variant: "destructive" }),
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const sorted = [...messages].reverse();

  return (
    <div className="flex flex-col h-[500px]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3" data-testid="message-thread">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="w-10 h-10 text-zinc-200 mb-3" />
            <p className="text-sm text-zinc-400" data-testid="state-no-messages">No messages yet</p>
            <p className="text-xs text-zinc-300 mt-1">Send a message to start the conversation</p>
          </div>
        ) : (
          sorted.map(msg => {
            const isMe = msg.senderId === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                data-testid={`message-${msg.id}`}
              >
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isMe ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-900"}`}>
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                  <p className={`text-[10px] mt-1 ${isMe ? "text-zinc-400" : "text-zinc-400"}`}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {" · "}
                    {new Date(msg.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="border-t border-zinc-100 p-3 flex items-end gap-2">
        <textarea
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          rows={1}
          className="flex-1 px-3 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20 resize-none max-h-32"
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (newMessage.trim()) sendMutation.mutate(newMessage.trim());
            }
          }}
          data-testid="input-message"
        />
        <button
          type="button"
          onClick={() => newMessage.trim() && sendMutation.mutate(newMessage.trim())}
          disabled={!newMessage.trim() || sendMutation.isPending}
          className="flex items-center justify-center w-10 h-10 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-colors flex-shrink-0"
          data-testid="button-send-message"
        >
          {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

interface TargetOverridesData {
  calculated: { dailyCalories: number; proteinGoal: number; carbsGoal: number; fatGoal: number; fibreGoal: number | null } | null;
  overrides: { id: number; dailyCalories: number | null; proteinGoal: number | null; carbsGoal: number | null; fatGoal: number | null; fibreGoal: number | null; rationale: string | null } | null;
  effective: { dailyCalories: number; proteinGoal: number; carbsGoal: number; fatGoal: number; fibreGoal: number | null; hasOverrides: boolean; overriddenFields: string[] } | null;
}

const TARGET_FIELDS = [
  { key: "dailyCalories", label: "Calories", unit: "kcal" },
  { key: "proteinGoal", label: "Protein", unit: "g" },
  { key: "carbsGoal", label: "Carbs", unit: "g" },
  { key: "fatGoal", label: "Fat", unit: "g" },
  { key: "fibreGoal", label: "Fibre", unit: "g" },
] as const;

function TargetOverridesPanel({ clientId }: { clientId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [overrideValues, setOverrideValues] = useState<Record<string, string>>({});
  const [rationale, setRationale] = useState("");

  const { data, isLoading } = useQuery<TargetOverridesData>({
    queryKey: ["/api/nutritionist/clients", clientId, "target-overrides"],
    queryFn: () => apiRequest("GET", `/api/nutritionist/clients/${clientId}/target-overrides`).then(r => r.json()),
  });

  const saveMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiRequest("PUT", `/api/nutritionist/clients/${clientId}/target-overrides`, payload).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/clients", clientId, "target-overrides"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/monitoring"] });
      setEditMode(false);
      toast({ title: "Target overrides saved" });
    },
    onError: (err: Error) => toast({ title: "Failed to save overrides", description: err.message, variant: "destructive" }),
  });

  const clearMutation = useMutation({
    mutationFn: () =>
      apiRequest("DELETE", `/api/nutritionist/clients/${clientId}/target-overrides`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/clients", clientId, "target-overrides"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/monitoring"] });
      setEditMode(false);
      toast({ title: "Overrides cleared — reverted to calculated targets" });
    },
    onError: (err: Error) => toast({ title: "Failed to clear overrides", description: err.message, variant: "destructive" }),
  });

  const startEdit = () => {
    const vals: Record<string, string> = {};
    for (const f of TARGET_FIELDS) {
      const overrideVal = data?.overrides?.[f.key as keyof typeof data.overrides];
      vals[f.key] = overrideVal != null ? String(overrideVal) : "";
    }
    setRationale(data?.overrides?.rationale ?? "");
    setOverrideValues(vals);
    setEditMode(true);
  };

  const handleSave = () => {
    const payload: Record<string, unknown> = { rationale: rationale || null };
    for (const f of TARGET_FIELDS) {
      const v = overrideValues[f.key]?.trim();
      payload[f.key] = v ? parseInt(v, 10) : null;
    }
    saveMutation.mutate(payload);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-100 p-6 mb-4">
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>
      </div>
    );
  }

  const hasCalc = !!data?.calculated;
  const hasOverrides = data?.effective?.hasOverrides ?? false;

  return (
    <div className="bg-white rounded-2xl border border-zinc-100 p-6 mb-4" data-testid="panel-target-overrides">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-900">Nutrition Targets</h3>
          {hasOverrides && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700" data-testid="badge-has-overrides">
              Overridden
            </span>
          )}
        </div>
        {!editMode && (
          <button
            type="button"
            onClick={startEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 rounded-xl text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
            data-testid="button-edit-overrides"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Override
          </button>
        )}
      </div>

      {!hasCalc && !hasOverrides && !editMode && (
        <p className="text-sm text-zinc-400 text-center py-3" data-testid="text-no-targets">
          No targets set. This client has not completed their nutrition calculator yet.
        </p>
      )}

      {editMode ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {TARGET_FIELDS.map(f => {
              const calcVal = data?.calculated?.[f.key as keyof NonNullable<typeof data.calculated>];
              return (
                <div key={f.key}>
                  <label className="text-[10px] font-medium text-zinc-500 block mb-1">{f.label} ({f.unit})</label>
                  <input
                    type="number"
                    value={overrideValues[f.key] ?? ""}
                    onChange={e => setOverrideValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={calcVal != null ? String(calcVal) : "—"}
                    className="w-full px-2.5 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                    data-testid={`input-override-${f.key}`}
                  />
                  {calcVal != null && (
                    <p className="text-[10px] text-zinc-400 mt-0.5">Calculated: {calcVal}</p>
                  )}
                </div>
              );
            })}
          </div>
          <div>
            <label className="text-[10px] font-medium text-zinc-500 block mb-1">Clinical Rationale (optional)</label>
            <textarea
              value={rationale}
              onChange={e => setRationale(e.target.value)}
              placeholder="e.g. Reduced carbs per endocrinologist recommendation"
              rows={2}
              maxLength={500}
              className="w-full px-2.5 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20 resize-none"
              data-testid="textarea-override-rationale"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white text-sm rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-colors"
              data-testid="button-save-overrides"
            >
              {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Save Overrides
            </button>
            {hasOverrides && (
              <button
                type="button"
                onClick={() => clearMutation.mutate()}
                disabled={clearMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-2 border border-zinc-200 text-sm rounded-xl text-zinc-600 hover:bg-zinc-50 transition-colors"
                data-testid="button-clear-overrides"
              >
                {clearMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                Revert to Calculated
              </button>
            )}
            <button
              type="button"
              onClick={() => setEditMode(false)}
              className="px-3 py-2 border border-zinc-200 text-sm rounded-xl text-zinc-600 hover:bg-zinc-50 transition-colors"
              data-testid="button-cancel-overrides"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (hasCalc || hasOverrides) ? (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {TARGET_FIELDS.map(f => {
              const effectiveVal = data?.effective?.[f.key as keyof NonNullable<typeof data.effective>];
              const isOverridden = data?.effective?.overriddenFields?.includes(f.key) ?? false;
              const calcVal = data?.calculated?.[f.key as keyof NonNullable<typeof data.calculated>];
              return (
                <div
                  key={f.key}
                  className={`rounded-xl p-3 text-center ${isOverridden ? "bg-amber-50 border border-amber-200" : "bg-zinc-50 border border-zinc-100"}`}
                  data-testid={`target-${f.key}`}
                >
                  <p className={`text-lg font-bold ${isOverridden ? "text-amber-800" : "text-zinc-900"}`}>
                    {effectiveVal != null ? effectiveVal : "—"}
                  </p>
                  <p className="text-[10px] text-zinc-500">{f.label} ({f.unit})</p>
                  {isOverridden && calcVal != null && (
                    <p className="text-[10px] text-zinc-400 mt-0.5 line-through">{calcVal}</p>
                  )}
                </div>
              );
            })}
          </div>
          {data?.overrides?.rationale && (
            <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl" data-testid="text-override-rationale">
              <p className="text-xs text-amber-800">
                <span className="font-medium">Rationale:</span> {data.overrides.rationale}
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function IntakeFormPanel({ clientRecord }: { clientRecord: ClientWithUser }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [formData, setFormData] = useState({
    medicalHistory: "",
    medications: "",
    lifestyle: "",
    dietaryRestrictions: "",
    foodPreferences: "",
    notes: "",
  });

  const { data: intakeForm, isLoading } = useQuery<ClientIntakeForm | null>({
    queryKey: ["/api/nutritionist/clients", clientRecord.clientId, "intake"],
    queryFn: () => apiRequest("GET", `/api/nutritionist/clients/${clientRecord.clientId}/intake`).then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      apiRequest("POST", `/api/nutritionist/clients/${clientRecord.clientId}/intake`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/clients", clientRecord.clientId, "intake"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/clients"] });
      toast({ title: "Intake form submitted — client is now active" });
      setIsEditing(false);
    },
    onError: (err: Error) => toast({ title: "Failed to save", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      apiRequest("PUT", `/api/nutritionist/clients/${clientRecord.clientId}/intake`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/clients", clientRecord.clientId, "intake"] });
      toast({ title: "Intake form updated" });
      setIsEditing(false);
    },
    onError: (err: Error) => toast({ title: "Failed to update", description: err.message, variant: "destructive" }),
  });

  const startEditing = () => {
    if (intakeForm) {
      setFormData({
        medicalHistory: intakeForm.medicalHistory ?? "",
        medications: intakeForm.medications ?? "",
        lifestyle: intakeForm.lifestyle ?? "",
        dietaryRestrictions: intakeForm.dietaryRestrictions ?? "",
        foodPreferences: intakeForm.foodPreferences ?? "",
        notes: intakeForm.notes ?? "",
      });
    }
    setIsEditing(true);
  };

  const handleSubmit = () => {
    if (intakeForm) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const sections = [
    { key: "medicalHistory" as const, label: "Medical History", icon: Heart, placeholder: "Previous conditions, surgeries, family history..." },
    { key: "medications" as const, label: "Medications & Supplements", icon: Pill, placeholder: "Current medications, vitamins, supplements..." },
    { key: "lifestyle" as const, label: "Lifestyle Habits", icon: Activity, placeholder: "Exercise routine, sleep patterns, stress levels, occupation..." },
    { key: "dietaryRestrictions" as const, label: "Dietary Restrictions", icon: AlertCircle, placeholder: "Allergies, intolerances, religious/ethical restrictions..." },
    { key: "foodPreferences" as const, label: "Food Preferences", icon: Utensils, placeholder: "Preferred cuisines, liked/disliked foods, cooking ability..." },
    { key: "notes" as const, label: "Additional Notes", icon: StickyNote, placeholder: "Any other relevant information..." },
  ];

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-100 p-6 mb-4">
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>
      </div>
    );
  }

  const handleSendIntakeLink = () => {
    const intakeUrl = `${window.location.origin}/dashboard`;
    navigator.clipboard.writeText(intakeUrl).then(() => {
      setLinkCopied(true);
      toast({ title: "Intake link copied", description: "Share this link with your client so they can complete their intake form from their dashboard." });
      setTimeout(() => setLinkCopied(false), 3000);
    }).catch(() => {
      toast({ title: "Link ready", description: `Share this link with your client: ${intakeUrl}` });
    });
  };

  if (!intakeForm && !isEditing) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-100 p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-zinc-400" />
            <h3 className="text-sm font-semibold text-zinc-900">Client Intake Form</h3>
          </div>
        </div>
        <div className="text-center py-6">
          <ClipboardList className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-zinc-600 mb-1">No intake form completed</p>
          <p className="text-xs text-zinc-400 mb-4">Complete the intake form yourself or send a link to your client.</p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={startEditing}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 transition-colors"
              data-testid="button-start-intake"
            >
              <Plus className="w-4 h-4" />
              Fill Form
            </button>
            <button
              type="button"
              onClick={handleSendIntakeLink}
              className="flex items-center gap-2 px-4 py-2 border border-zinc-200 text-zinc-700 text-sm font-medium rounded-xl hover:bg-zinc-50 transition-colors"
              data-testid="button-send-intake-link"
            >
              <Mail className="w-4 h-4" />
              {linkCopied ? "Link Copied!" : "Send to Client"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="bg-white rounded-2xl border border-zinc-100 p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-zinc-400" />
            <h3 className="text-sm font-semibold text-zinc-900">
              {intakeForm ? "Edit Intake Form" : "Client Intake Form"}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="text-sm text-zinc-500 hover:text-zinc-700"
            data-testid="button-cancel-intake"
          >
            Cancel
          </button>
        </div>

        <div className="space-y-4">
          {sections.map(({ key, label, icon: Icon, placeholder }) => (
            <div key={key}>
              <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 mb-1.5">
                <Icon className="w-3.5 h-3.5" />
                {label}
              </label>
              <textarea
                value={formData[key]}
                onChange={e => setFormData(prev => ({ ...prev, [key]: e.target.value }))}
                placeholder={placeholder}
                rows={3}
                className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20 resize-none"
                data-testid={`textarea-intake-${key}`}
              />
            </div>
          ))}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white text-sm rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-colors"
              data-testid="button-submit-intake"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {intakeForm ? "Update Form" : "Submit & Activate Client"}
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 border border-zinc-200 text-sm rounded-xl text-zinc-600 hover:bg-zinc-50 transition-colors"
              data-testid="button-cancel-intake-form"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-zinc-100 p-6 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-900">Client Intake Form</h3>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Completed</span>
        </div>
        <button
          type="button"
          onClick={startEditing}
          className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 transition-colors"
          data-testid="button-edit-intake"
        >
          <Edit2 className="w-3 h-3" />
          Edit
        </button>
      </div>
      <div className="space-y-3">
        {sections.map(({ key, label, icon: Icon }) => {
          const value = intakeForm?.[key];
          if (!value) return null;
          return (
            <div key={key}>
              <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 mb-1">
                <Icon className="w-3.5 h-3.5" />
                {label}
              </div>
              <p className="text-sm text-zinc-700 whitespace-pre-wrap pl-5" data-testid={`text-intake-${key}`}>{value}</p>
            </div>
          );
        })}
      </div>
      {intakeForm?.completedAt && (
        <p className="text-xs text-zinc-400 mt-4 pt-3 border-t border-zinc-100">
          Completed {formatDate(intakeForm.completedAt)}
        </p>
      )}
    </div>
  );
}

function GoalsPanel({ clientRecord }: { clientRecord: ClientWithUser }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoal, setNewGoal] = useState({
    title: "",
    goalType: "custom" as string,
    targetValue: "",
    unit: "",
    targetDate: "",
  });

  const { data: goals = [], isLoading } = useQuery<ClientGoal[]>({
    queryKey: ["/api/nutritionist/clients", clientRecord.clientId, "goals"],
    queryFn: () => apiRequest("GET", `/api/nutritionist/clients/${clientRecord.clientId}/goals`).then(r => r.json()),
  });

  const createGoalMutation = useMutation({
    mutationFn: (data: typeof newGoal) =>
      apiRequest("POST", `/api/nutritionist/clients/${clientRecord.clientId}/goals`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/clients", clientRecord.clientId, "goals"] });
      toast({ title: "Goal created" });
      setShowAddGoal(false);
      setNewGoal({ title: "", goalType: "custom", targetValue: "", unit: "", targetDate: "" });
    },
    onError: (err: Error) => toast({ title: "Failed to create goal", description: err.message, variant: "destructive" }),
  });

  const updateGoalMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number; status?: string }) =>
      apiRequest("PUT", `/api/nutritionist/clients/${clientRecord.clientId}/goals/${id}`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/clients", clientRecord.clientId, "goals"] });
      toast({ title: "Goal updated" });
    },
    onError: (err: Error) => toast({ title: "Failed to update goal", description: err.message, variant: "destructive" }),
  });

  const deleteGoalMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/nutritionist/clients/${clientRecord.clientId}/goals/${id}`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/clients", clientRecord.clientId, "goals"] });
      toast({ title: "Goal removed" });
    },
    onError: (err: Error) => toast({ title: "Failed to delete goal", description: err.message, variant: "destructive" }),
  });

  const GOAL_TYPE_LABELS: Record<string, string> = {
    weight: "Weight",
    macro_average: "Macro Average",
    body_fat: "Body Fat",
    custom: "Custom",
  };

  return (
    <div className="bg-white rounded-2xl border border-zinc-100 p-6 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-900">Goals</h3>
          {goals.length > 0 && (
            <span className="text-xs text-zinc-400">{goals.filter(g => g.status === "active").length} active</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowAddGoal(v => !v)}
          className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-900 transition-colors"
          data-testid="button-add-goal"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Goal
        </button>
      </div>

      {showAddGoal && (
        <div className="border border-zinc-200 rounded-xl p-4 mb-4 space-y-3" data-testid="form-add-goal">
          <div>
            <label className="text-xs font-medium text-zinc-500 block mb-1">Goal Title</label>
            <input
              type="text"
              value={newGoal.title}
              onChange={e => setNewGoal(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g. Reach 75 kg"
              className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
              data-testid="input-goal-title"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">Type</label>
              <select
                value={newGoal.goalType}
                onChange={e => setNewGoal(prev => ({ ...prev, goalType: e.target.value }))}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none bg-white"
                data-testid="select-goal-type"
              >
                <option value="weight">Weight</option>
                <option value="macro_average">Macro Average</option>
                <option value="body_fat">Body Fat</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">Unit</label>
              <input
                type="text"
                value={newGoal.unit}
                onChange={e => setNewGoal(prev => ({ ...prev, unit: e.target.value }))}
                placeholder="kg, g protein/day, %"
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                data-testid="input-goal-unit"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">Target Value</label>
              <input
                type="text"
                value={newGoal.targetValue}
                onChange={e => setNewGoal(prev => ({ ...prev, targetValue: e.target.value }))}
                placeholder="75"
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                data-testid="input-goal-target"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">Target Date</label>
              <input
                type="date"
                value={newGoal.targetDate}
                onChange={e => setNewGoal(prev => ({ ...prev, targetDate: e.target.value }))}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                data-testid="input-goal-date"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => newGoal.title.trim() && createGoalMutation.mutate(newGoal)}
              disabled={!newGoal.title.trim() || createGoalMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white text-sm rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-colors"
              data-testid="button-save-goal"
            >
              {createGoalMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Save Goal
            </button>
            <button
              type="button"
              onClick={() => setShowAddGoal(false)}
              className="px-4 py-2 border border-zinc-200 text-sm rounded-xl text-zinc-600 hover:bg-zinc-50 transition-colors"
              data-testid="button-cancel-goal"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>
      ) : goals.length === 0 ? (
        <div className="text-center py-6">
          <Target className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
          <p className="text-sm text-zinc-400" data-testid="state-no-goals">No goals set yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {goals.map(goal => {
            const progressPct = goal.progress ?? 0;
            const progressColor = goal.onTrack === null ? "bg-zinc-300" : goal.onTrack ? "bg-emerald-400" : "bg-amber-400";
            return (
              <div key={goal.id} className="border border-zinc-100 rounded-xl p-3" data-testid={`goal-${goal.id}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-zinc-900">{goal.title}</span>
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                        {GOAL_TYPE_LABELS[goal.goalType] ?? goal.goalType}
                      </span>
                      {goal.status === "completed" && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                      {goal.currentValue && goal.targetValue && (
                        <span data-testid={`goal-progress-text-${goal.id}`}>
                          {goal.currentValue} / {goal.targetValue} {goal.unit ?? ""}
                        </span>
                      )}
                      {goal.targetValue && !goal.currentValue && (
                        <span>Target: {goal.targetValue} {goal.unit ?? ""}</span>
                      )}
                      {goal.targetDate && (
                        <span className="flex items-center gap-0.5">
                          <Calendar className="w-3 h-3" />
                          {formatDate(goal.targetDate)}
                        </span>
                      )}
                      {goal.onTrack !== null && (
                        <span className={`font-medium ${goal.onTrack ? "text-emerald-600" : "text-amber-600"}`} data-testid={`goal-status-${goal.id}`}>
                          {goal.onTrack ? "On track" : "Off track"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {goal.status === "active" && (
                      <button
                        type="button"
                        onClick={() => updateGoalMutation.mutate({ id: goal.id, status: "completed" })}
                        disabled={updateGoalMutation.isPending}
                        className="p-1 text-zinc-400 hover:text-emerald-600 transition-colors"
                        title="Mark complete"
                        data-testid={`button-complete-goal-${goal.id}`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteGoalMutation.mutate(goal.id)}
                      disabled={deleteGoalMutation.isPending}
                      className="p-1 text-zinc-400 hover:text-red-600 transition-colors"
                      title="Delete goal"
                      data-testid={`button-delete-goal-${goal.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {goal.targetValue && (
                  <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden" data-testid={`goal-progress-bar-${goal.id}`}>
                    <div
                      className={`h-full rounded-full transition-all ${progressColor}`}
                      style={{ width: `${Math.min(100, progressPct)}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


function ClientProfile({
  clientRecord,
  onBack,
  onViewAdherence,
}: {
  clientRecord: ClientWithUser;
  onBack: () => void;
  onViewAdherence: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<"profile" | "messages">("profile");

  const { data: profileData, isLoading: profileLoading } = useQuery<ClientProfileData>({
    queryKey: ["/api/nutritionist/clients", clientRecord.clientId, "profile"],
    queryFn: () => apiRequest("GET", `/api/nutritionist/clients/${clientRecord.clientId}/profile`).then(r => r.json()),
  });

  const { data: notes = [], isLoading: notesLoading } = useQuery<Note[]>({
    queryKey: ["/api/nutritionist/clients", clientRecord.clientId, "notes"],
    queryFn: () => apiRequest("GET", `/api/nutritionist/clients/${clientRecord.clientId}/notes`).then(r => r.json()),
  });

  const [newNote, setNewNote] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editNoteText, setEditNoteText] = useState("");
  const [editingStatus, setEditingStatus] = useState(clientRecord.status);
  const [editingGoal, setEditingGoal] = useState(clientRecord.goalSummary ?? "");
  const [editingHealthNotes, setEditingHealthNotes] = useState(clientRecord.healthNotes ?? "");
  const [editMode, setEditMode] = useState(false);

  const addNoteMutation = useMutation({
    mutationFn: (note: string) =>
      apiRequest("POST", `/api/nutritionist/clients/${clientRecord.clientId}/notes`, { note }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/clients", clientRecord.clientId, "notes"] });
      setNewNote("");
    },
    onError: () => toast({ title: "Failed to add note", variant: "destructive" }),
  });

  const updateNoteMutation = useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) =>
      apiRequest("PUT", `/api/nutritionist/clients/${clientRecord.clientId}/notes/${id}`, { note }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/clients", clientRecord.clientId, "notes"] });
      setEditingNoteId(null);
    },
    onError: () => toast({ title: "Failed to update note", variant: "destructive" }),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/nutritionist/clients/${clientRecord.clientId}/notes/${id}`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/clients", clientRecord.clientId, "notes"] });
    },
    onError: () => toast({ title: "Failed to delete note", variant: "destructive" }),
  });

  const updateClientMutation = useMutation({
    mutationFn: (updates: { status?: string; goalSummary?: string; healthNotes?: string }) =>
      apiRequest("PUT", `/api/nutritionist/clients/${clientRecord.id}`, updates).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/clients"] });
      setEditMode(false);
      toast({ title: "Client updated" });
    },
    onError: () => toast({ title: "Failed to update client", variant: "destructive" }),
  });

  const prefs = profileData?.preferences as Record<string, unknown> | null;
  const s = STATUS_LABELS[clientRecord.status] ?? STATUS_LABELS.onboarding;

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 mb-6 transition-colors"
        data-testid="button-back-to-roster"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to roster
      </button>

      <div className="bg-white rounded-2xl border border-zinc-100 p-6 mb-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-zinc-900 rounded-full flex items-center justify-center text-white text-lg font-bold">
              {clientRecord.client.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900" data-testid="text-client-name">{clientRecord.client.name}</h2>
              <p className="text-sm text-zinc-500" data-testid="text-client-email">{clientRecord.client.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onViewAdherence}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 rounded-xl text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
              data-testid="button-view-adherence"
            >
              <BarChart2 className="w-3.5 h-3.5" />
              Adherence
            </button>
            <button
              type="button"
              onClick={() => { setEditMode(v => !v); setEditingStatus(clientRecord.status); setEditingGoal(clientRecord.goalSummary ?? ""); setEditingHealthNotes(clientRecord.healthNotes ?? ""); }}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 rounded-xl text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
              data-testid="button-edit-client"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Edit
            </button>
          </div>
        </div>

        {editMode ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">Status</label>
              <select
                value={editingStatus}
                onChange={e => setEditingStatus(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                data-testid="select-client-status"
              >
                <option value="onboarding">Onboarding</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">Goal Summary</label>
              <input
                type="text"
                value={editingGoal}
                onChange={e => setEditingGoal(e.target.value)}
                maxLength={500}
                placeholder="e.g. Weight loss, muscle gain..."
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                data-testid="input-goal-summary"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">Health &amp; Medical Notes</label>
              <textarea
                value={editingHealthNotes}
                onChange={e => setEditingHealthNotes(e.target.value)}
                maxLength={2000}
                rows={4}
                placeholder="Medical history, conditions, medications, contraindications..."
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20 resize-none"
                data-testid="textarea-health-notes"
              />
              <p className="text-xs text-zinc-400 mt-1">Private — not visible to client</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => updateClientMutation.mutate({ status: editingStatus, goalSummary: editingGoal, healthNotes: editingHealthNotes })}
                disabled={updateClientMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white text-sm rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                data-testid="button-save-client"
              >
                {updateClientMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditMode(false)}
                className="px-4 py-2 border border-zinc-200 text-sm rounded-xl text-zinc-600 hover:bg-zinc-50 transition-colors"
                data-testid="button-cancel-edit"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4 text-sm flex-wrap">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.classes}`} data-testid="badge-client-status">
              {s.label}
            </span>
            {clientRecord.goalSummary && (
              <span className="text-zinc-500" data-testid="text-goal-summary">Goal: {clientRecord.goalSummary}</span>
            )}
            <span className="text-zinc-400 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Joined {formatDate(clientRecord.createdAt)}
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-1 mb-4">
        <button
          type="button"
          onClick={() => setActiveSection("profile")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeSection === "profile" ? "bg-zinc-900 text-white" : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}
          data-testid="tab-client-profile"
        >
          <FileText className="w-3.5 h-3.5" />
          Profile
        </button>
        <button
          type="button"
          onClick={() => setActiveSection("messages")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeSection === "messages" ? "bg-zinc-900 text-white" : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}
          data-testid="tab-client-messages"
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Messages
        </button>
      </div>

      {activeSection === "messages" && user && (
        <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden">
          <MessageThread clientId={clientRecord.clientId} currentUserId={user.id} />
        </div>
      )}

      {activeSection === "profile" && (
        <>
      {clientRecord.healthNotes && (
        <div className="bg-white rounded-2xl border border-zinc-100 p-6 mb-4">
          <h3 className="text-sm font-semibold text-zinc-900 mb-3 flex items-center gap-2">
            Health &amp; Medical Notes
            <span className="text-xs font-normal text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">Private</span>
          </h3>
          <p className="text-sm text-zinc-700 whitespace-pre-wrap" data-testid="text-health-notes">{clientRecord.healthNotes}</p>
        </div>
      )}

      {prefs && (
        <div className="bg-white rounded-2xl border border-zinc-100 p-6 mb-4">
          <h3 className="text-sm font-semibold text-zinc-900 mb-3">Client Preferences</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {Boolean(prefs.diet) && (
              <div className="text-xs">
                <span className="text-zinc-400 block mb-0.5">Diet</span>
                <span className="text-zinc-800 capitalize font-medium" data-testid="text-client-diet">{String(prefs.diet)}</span>
              </div>
            )}
            {Array.isArray(prefs.allergies) && prefs.allergies.length > 0 && (
              <div className="text-xs">
                <span className="text-zinc-400 block mb-0.5">Allergies</span>
                <span className="text-zinc-800 font-medium" data-testid="text-client-allergies">
                  {(prefs.allergies as string[]).join(", ")}
                </span>
              </div>
            )}
            {Array.isArray(prefs.excludedFoods) && prefs.excludedFoods.length > 0 && (
              <div className="text-xs">
                <span className="text-zinc-400 block mb-0.5">Excluded Foods</span>
                <span className="text-zinc-800 font-medium" data-testid="text-excluded-foods">
                  {(prefs.excludedFoods as string[]).join(", ")}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <TargetOverridesPanel clientId={clientRecord.clientId} />
      <IntakeFormPanel clientRecord={clientRecord} />

      <GoalsPanel clientRecord={clientRecord} />

      <div className="bg-white rounded-2xl border border-zinc-100 p-6 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-zinc-400" />
            <h3 className="text-sm font-semibold text-zinc-900">Current Plan</h3>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-xl border border-zinc-100">
          <div className="w-8 h-8 bg-zinc-200 rounded-lg flex items-center justify-center">
            <ClipboardList className="w-4 h-4 text-zinc-500" />
          </div>
          <div>
            <p className="text-sm text-zinc-500" data-testid="text-current-plan-status">No plan assigned yet</p>
            <p className="text-xs text-zinc-400">Plan assignment coming in a future update</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-zinc-400" />
            <h3 className="text-sm font-semibold text-zinc-900">Clinical Notes</h3>
            <span className="text-xs text-zinc-400">(private — not visible to client)</span>
          </div>
        </div>

        <div className="mb-4">
          <textarea
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            placeholder="Add a clinical note..."
            rows={3}
            className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20 resize-none"
            data-testid="textarea-new-note"
          />
          <div className="flex justify-end mt-2">
            <button
              type="button"
              onClick={() => newNote.trim() && addNoteMutation.mutate(newNote.trim())}
              disabled={!newNote.trim() || addNoteMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white text-sm rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-colors"
              data-testid="button-add-note"
            >
              {addNoteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Add Note
            </button>
          </div>
        </div>

        {notesLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
          </div>
        ) : notes.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-6" data-testid="state-no-notes">No notes yet.</p>
        ) : (
          <div className="space-y-3">
            {notes.map(note => (
              <div key={note.id} className="border border-zinc-100 rounded-xl p-3" data-testid={`note-${note.id}`}>
                {editingNoteId === note.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editNoteText}
                      onChange={e => setEditNoteText(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20 resize-none"
                      data-testid={`textarea-edit-note-${note.id}`}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => updateNoteMutation.mutate({ id: note.id, note: editNoteText })}
                        disabled={updateNoteMutation.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 bg-zinc-900 text-white text-xs rounded-lg disabled:opacity-50"
                        data-testid={`button-save-note-${note.id}`}
                      >
                        <Check className="w-3 h-3" /> Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingNoteId(null)}
                        className="px-3 py-1.5 border border-zinc-200 text-xs rounded-lg text-zinc-600"
                        data-testid={`button-cancel-note-${note.id}`}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-zinc-800 whitespace-pre-wrap" data-testid={`text-note-${note.id}`}>{note.note}</p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-zinc-400">{formatDate(note.createdAt)}</p>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => { setEditingNoteId(note.id); setEditNoteText(note.note); }}
                          className="p-1 text-zinc-400 hover:text-zinc-700 transition-colors"
                          data-testid={`button-edit-note-${note.id}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteNoteMutation.mutate(note.id)}
                          disabled={deleteNoteMutation.isPending}
                          className="p-1 text-zinc-400 hover:text-red-600 transition-colors"
                          data-testid={`button-delete-note-${note.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}

function PracticeAdminPanel({ profile }: { profile: NutritionistProfile }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [newPracticeName, setNewPracticeName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [expandedNutritionist, setExpandedNutritionist] = useState<number | null>(null);

  const { data: practice, isLoading: practiceLoading } = useQuery<PracticeData | null>({
    queryKey: ["/api/practice"],
    queryFn: () => apiRequest("GET", "/api/practice").then(r => r.json()),
    enabled: !!user,
  });

  const createPracticeMutation = useMutation({
    mutationFn: (name: string) =>
      apiRequest("POST", "/api/practice", { name }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/practice"] });
      toast({ title: "Practice account created" });
      setNewPracticeName("");
    },
    onError: (err: Error) => toast({ title: "Failed to create practice", description: err.message, variant: "destructive" }),
  });

  const { data: members = [], isLoading: membersLoading } = useQuery<PracticeMember[]>({
    queryKey: ["/api/practice", practice?.id, "members"],
    queryFn: () => apiRequest("GET", `/api/practice/${practice!.id}/members`).then(r => r.json()),
    enabled: !!practice,
  });

  const { data: practiceClients = [], isLoading: practiceClientsLoading } = useQuery<PracticeClientsGroup[]>({
    queryKey: ["/api/practice", practice?.id, "clients"],
    queryFn: () => apiRequest("GET", `/api/practice/${practice!.id}/clients`).then(r => r.json()),
    enabled: !!practice,
  });

  const removeMemberMutation = useMutation({
    mutationFn: (nutritionistUserId: number) =>
      apiRequest("DELETE", `/api/practice/${practice!.id}/members/${nutritionistUserId}`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/practice", practice!.id, "members"] });
      toast({ title: "Member removed" });
    },
    onError: (err: Error) => toast({ title: "Failed to remove member", description: err.message, variant: "destructive" }),
  });

  const addMemberByEmailMutation = useMutation({
    mutationFn: async (email: string) => {
      const found = await apiRequest("GET", `/api/practice/lookup-nutritionist?email=${encodeURIComponent(email)}`).then(r => r.json());
      if (!found || found.message) throw new Error(found.message ?? "User not found");
      return apiRequest("POST", `/api/practice/${practice!.id}/members`, { nutritionistUserId: found.id }).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/practice", practice!.id, "members"] });
      toast({ title: "Member added to practice" });
      setNewMemberEmail("");
    },
    onError: (err: Error) => toast({ title: "Failed to add member", description: err.message, variant: "destructive" }),
  });

  if (practiceLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>;
  }

  if (!practice) {
    if (profile.tier !== "practice") {
      return (
        <div className="bg-white rounded-2xl border border-zinc-100 p-8 text-center">
          <Building2 className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
          <h3 className="text-base font-bold text-zinc-900 mb-2">Practice Tier Required</h3>
          <p className="text-sm text-zinc-500 mb-4">
            Upgrade to the Practice tier to create a shared practice account with multiple nutritionist seats.
          </p>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-2xl border border-zinc-100 p-8">
        <div className="text-center mb-6">
          <Building2 className="w-12 h-12 text-zinc-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-zinc-900 mb-1">Create Your Practice</h3>
          <p className="text-sm text-zinc-500">Set up a shared practice account to manage multiple nutritionists and their clients.</p>
        </div>
        <div className="max-w-sm mx-auto space-y-3">
          <input
            type="text"
            value={newPracticeName}
            onChange={e => setNewPracticeName(e.target.value)}
            placeholder="Practice name (e.g. Wellness Clinic)"
            className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
            data-testid="input-practice-name"
          />
          <button
            type="button"
            onClick={() => newPracticeName.trim() && createPracticeMutation.mutate(newPracticeName.trim())}
            disabled={!newPracticeName.trim() || createPracticeMutation.isPending}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            data-testid="button-create-practice"
          >
            {createPracticeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
            Create Practice
          </button>
        </div>
      </div>
    );
  }

  const isAdmin = practice.adminUserId === user?.id || practice.role === "admin";
  const totalClients = practiceClients.reduce((s, g) => s + g.clients.length, 0);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-zinc-100 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900" data-testid="text-practice-name">{practice.name}</h2>
              <p className="text-xs text-zinc-500">{members.length} nutritionist{members.length !== 1 ? "s" : ""} · {totalClients} client{totalClients !== 1 ? "s" : ""} · {practice.maxSeats} seat{practice.maxSeats !== 1 ? "s" : ""}</p>
            </div>
          </div>
          {isAdmin && (
            <span className="text-xs font-medium px-2 py-1 bg-zinc-900 text-white rounded-lg">Admin</span>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-zinc-400" />
            Nutritionist Seats ({members.length}/{practice.maxSeats})
          </h3>
        </div>

        {membersLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-zinc-400" /></div>
        ) : (
          <div className="space-y-2 mb-4">
            {members.map(member => {
              const group = practiceClients.find(g => g.nutritionistId === member.nutritionistUserId);
              const clientCount = group?.clients.length ?? 0;
              const isExpanded = expandedNutritionist === member.nutritionistUserId;
              return (
                <div key={member.id} className="border border-zinc-100 rounded-xl" data-testid={`member-${member.nutritionistUserId}`}>
                  <div className="flex items-center gap-3 p-3">
                    <div className="w-8 h-8 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-600 text-sm font-bold flex-shrink-0">
                      {member.nutritionist.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-900">{member.nutritionist.name}</p>
                      <p className="text-xs text-zinc-400">{member.nutritionist.email} · {clientCount} client{clientCount !== 1 ? "s" : ""}</p>
                    </div>
                    {member.role === "admin" && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 bg-zinc-100 text-zinc-600 rounded-full">Admin</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setExpandedNutritionist(isExpanded ? null : member.nutritionistUserId)}
                      className="p-1 text-zinc-400 hover:text-zinc-700"
                      data-testid={`button-expand-nutritionist-${member.nutritionistUserId}`}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {isAdmin && member.nutritionistUserId !== user?.id && (
                      <button
                        type="button"
                        onClick={() => removeMemberMutation.mutate(member.nutritionistUserId)}
                        disabled={removeMemberMutation.isPending}
                        className="p-1 text-zinc-400 hover:text-red-600 transition-colors"
                        data-testid={`button-remove-member-${member.nutritionistUserId}`}
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {isExpanded && group && group.clients.length > 0 && (
                    <div className="border-t border-zinc-100 px-3 py-2 space-y-1">
                      {group.clients.map(c => (
                        <div key={c.id} className="flex items-center gap-2 py-1" data-testid={`practice-client-${c.id}`}>
                          <div className="w-5 h-5 bg-zinc-100 rounded-full flex items-center justify-center text-[10px] font-bold text-zinc-500">
                            {c.client.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs text-zinc-700">{c.client.name}</span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_LABELS[c.status]?.classes ?? ""}`}>
                            {STATUS_LABELS[c.status]?.label ?? c.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {isAdmin && members.length < practice.maxSeats && (
          <div className="border-t border-zinc-100 pt-4">
            <p className="text-xs font-medium text-zinc-500 mb-2">Add nutritionist by email (they must have a nutritionist profile)</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={newMemberEmail}
                onChange={e => setNewMemberEmail(e.target.value)}
                placeholder="nutritionist@example.com"
                className="flex-1 px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                data-testid="input-add-member-email"
              />
              <button
                type="button"
                onClick={() => newMemberEmail.trim() && addMemberByEmailMutation.mutate(newMemberEmail.trim())}
                disabled={!newMemberEmail.trim() || addMemberByEmailMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 text-white text-sm rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                data-testid="button-add-member"
              >
                {addMemberByEmailMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                Add
              </button>
            </div>
          </div>
        )}

        {isAdmin && members.length >= practice.maxSeats && (
          <div className="text-xs text-zinc-400 text-center py-2">
            All {practice.maxSeats} seats filled. Contact support to increase your seat limit.
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-zinc-100 p-5">
        <h3 className="text-sm font-semibold text-zinc-900 mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-zinc-400" />
          All Practice Clients
        </h3>
        {practiceClientsLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-zinc-400" /></div>
        ) : practiceClients.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-4">No clients in practice yet</p>
        ) : (
          <div className="space-y-4">
            {practiceClients.map(group => (
              <div key={group.nutritionistId}>
                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">{group.nutritionistName}</h4>
                {group.clients.length === 0 ? (
                  <p className="text-xs text-zinc-400 italic">No clients</p>
                ) : (
                  <div className="space-y-1">
                    {group.clients.map(c => (
                      <div key={c.id} className="flex items-center gap-3 p-2 rounded-xl bg-zinc-50" data-testid={`practice-all-client-${c.id}`}>
                        <div className="w-7 h-7 bg-zinc-200 rounded-full flex items-center justify-center text-xs font-bold text-zinc-600">
                          {c.client.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-900">{c.client.name}</p>
                          <p className="text-xs text-zinc-400">{c.client.email}</p>
                        </div>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_LABELS[c.status]?.classes ?? ""}`}>
                          {STATUS_LABELS[c.status]?.label ?? c.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [email, setEmail] = useState("");

  const inviteMutation = useMutation({
    mutationFn: (email: string) =>
      apiRequest("POST", "/api/nutritionist/invitations", { email }).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/invitations"] });
      toast({
        title: "Invitation created",
        description: `Invite link generated for ${email}. Share the link with your client.`,
      });
      setEmail("");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create invitation", description: err.message, variant: "destructive" });
    },
  });

  const { data: invitations = [], isLoading } = useQuery<Invitation[]>({
    queryKey: ["/api/nutritionist/invitations"],
    queryFn: () => apiRequest("GET", "/api/nutritionist/invitations").then(r => r.json()),
  });

  const baseUrl = window.location.origin;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" data-testid="modal-invite">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="font-semibold text-zinc-900">Invite a Client</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
            data-testid="button-close-invite-modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-zinc-500 mb-4">
            Enter your client's email address. They will receive an invitation link to create their account pre-linked to your practice.
          </p>

          <div className="flex gap-2 mb-6">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="client@example.com"
              className="flex-1 px-3 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
              data-testid="input-invite-email"
              onKeyDown={e => e.key === "Enter" && email && inviteMutation.mutate(email)}
            />
            <button
              type="button"
              onClick={() => email && inviteMutation.mutate(email)}
              disabled={!email || inviteMutation.isPending}
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-colors"
              data-testid="button-generate-invite"
            >
              {inviteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Generate Link
            </button>
          </div>

          {invitations.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Recent Invitations</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {invitations.slice(0, 10).map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl" data-testid={`invite-${inv.id}`}>
                    <div>
                      <p className="text-xs font-medium text-zinc-800">{inv.email}</p>
                      <p className="text-[10px] text-zinc-400">
                        {inv.acceptedAt ? "Accepted" : new Date(inv.expiresAt) < new Date() ? "Expired" : "Pending"}
                        {" · "}Expires {formatDate(inv.expiresAt)}
                      </p>
                    </div>
                    {!inv.acceptedAt && new Date(inv.expiresAt) >= new Date() && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(`${baseUrl}/auth?tab=register&nutritionist_invite=${inv.token}`);
                          toast({ title: "Link copied to clipboard" });
                        }}
                        className="text-xs px-2.5 py-1 border border-zinc-200 rounded-lg text-zinc-600 hover:bg-white transition-colors"
                        data-testid={`button-copy-invite-${inv.id}`}
                      >
                        Copy Link
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type Tab = "monitoring" | "clients" | "practice";
type ViewState =
  | { kind: "list" }
  | { kind: "profile"; client: ClientWithUser }
  | { kind: "adherence"; client: ClientWithUser };

export default function NutritionistPortalPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("monitoring");
  const [view, setView] = useState<ViewState>({ kind: "list" });
  const [showInviteModal, setShowInviteModal] = useState(false);

  const { data: profile, isLoading: profileLoading } = useQuery<NutritionistProfile | null>({
    queryKey: ["/api/nutritionist/profile"],
    enabled: !!user,
    retry: false,
  });

  const { data: clients = [], isLoading: clientsLoading } = useQuery<ClientWithUser[]>({
    queryKey: ["/api/nutritionist/clients"],
    queryFn: () => apiRequest("GET", "/api/nutritionist/clients").then(r => r.json()),
    enabled: !!profile,
  });

  const { data: capacity, isLoading: capacityLoading } = useQuery<Capacity>({
    queryKey: ["/api/nutritionist/capacity"],
    queryFn: () => apiRequest("GET", "/api/nutritionist/capacity").then(r => r.json()),
    enabled: !!profile,
  });

  const { data: unreadCounts = [] } = useQuery<{ clientId: number; count: number }[]>({
    queryKey: ["/api/nutritionist/messages/unread-counts"],
    queryFn: () => apiRequest("GET", "/api/nutritionist/messages/unread-counts").then(r => r.json()),
    enabled: !!profile,
    refetchInterval: 10000,
  });

  const unreadMap = new Map(unreadCounts.map(u => [u.clientId, u.count]));

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center p-8">
          <p className="text-zinc-600 mb-4">You must be signed in.</p>
          <Link href="/auth" className="text-zinc-900 font-semibold underline" data-testid="link-sign-in">Sign In</Link>
        </div>
      </div>
    );
  }

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-zinc-400" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 mb-2">No professional account</h2>
          <p className="text-zinc-500 mb-6 text-sm">
            Register as a nutritionist to access the professional portal and manage clients.
          </p>
          <Link
            href="/nutritionist/register"
            className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-xl font-medium hover:bg-zinc-800 transition-colors"
            data-testid="link-register-nutritionist"
          >
            Register as Nutritionist
          </Link>
        </div>
      </div>
    );
  }

  const TABS: { id: Tab; label: string; icon: typeof Activity }[] = [
    { id: "monitoring", label: "Monitoring", icon: Activity },
    { id: "clients", label: "Clients", icon: Users },
    { id: "practice", label: "Practice", icon: Building2 },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 pb-16">
      <header className="bg-white border-b border-zinc-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center relative">
              <div className="w-3 h-3 bg-white rounded-full" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[3px] h-[calc(50%-6px)] bg-white rounded-t-sm" />
            </div>
            <h1 className="font-display font-bold text-xl tracking-tight text-zinc-900">FuelU</h1>
          </Link>
          <div className="flex items-center gap-1">
            {TABS.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { setTab(t.id); setView({ kind: "list" }); }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${tab === t.id ? "bg-zinc-900 text-white" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"}`}
                  data-testid={`tab-${t.id}`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:block">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Personal / Professional tab strip */}
        <div className="border-t border-zinc-100" data-testid="tab-strip-professional-portal">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-1 h-10">
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 transition-colors"
                data-testid="tab-personal"
              >
                Personal
              </Link>
              <span
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md text-zinc-900 bg-zinc-100"
                data-testid="tab-professional-active"
              >
                Professional
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {tab === "monitoring" && (
          view.kind === "adherence" ? (
            <AdherenceView
              clientRecord={view.client}
              onBack={() => setView({ kind: "profile", client: view.client })}
            />
          ) : view.kind === "profile" ? (
            <ClientProfile
              clientRecord={view.client}
              onBack={() => setView({ kind: "list" })}
              onViewAdherence={() => setView({ kind: "adherence", client: view.client })}
            />
          ) : (
            <MonitoringDashboard
              onSelectClient={(c) => setView({ kind: "profile", client: c })}
            />
          )
        )}

        {tab === "clients" && (
          view.kind === "adherence" && tab === "clients" ? (
            <AdherenceView
              clientRecord={view.client}
              onBack={() => setView({ kind: "profile", client: view.client })}
            />
          ) : view.kind === "profile" ? (
            <ClientProfile
              clientRecord={view.client}
              onBack={() => setView({ kind: "list" })}
              onViewAdherence={() => setView({ kind: "adherence", client: view.client })}
            />
          ) : (
            capacity && (
              <ClientRoster
                clients={clients}
                capacity={capacity}
                onSelectClient={(c) => setView({ kind: "profile", client: c })}
                onInvite={() => setShowInviteModal(true)}
                unreadMap={unreadMap}
              />
            )
          )
        )}

        {tab === "practice" && (
          <PracticeAdminPanel profile={profile} />
        )}
      </main>

      {showInviteModal && <InviteModal onClose={() => setShowInviteModal(false)} />}
    </div>
  );
}
