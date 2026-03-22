import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Users, Plus, Search, X, FileText, ArrowLeft,
  Mail, Calendar, ChevronRight, ChevronLeft, Trash2, Edit2, Check, AlertCircle, ClipboardList,
  Activity, BarChart2, Bell, Building2, UserMinus, UserPlus, RefreshCw,
  TrendingDown, TrendingUp, Minus, ChevronDown, ChevronUp, Settings,
  MessageSquare, Send, Target, RotateCcw, Heart, Pill, Utensils, Leaf, StickyNote, CheckCircle2, Download, History,
  LogOut, User, BookOpen, LineChart as LineChartIcon, KanbanSquare, Zap, Pause, Play, Ban, FolderOpen, Upload, Eye, EyeOff,
  Clock, MoveVertical, Link as LinkIcon, Tag, Tags,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { AnimatePresence, motion } from "framer-motion";
import { exportProgressReportToPDF, type ProgressReportData } from "@/components/results-pdf";

interface ClientWithUser {
  id: number;
  nutritionistId: number;
  clientId: number;
  status: string;
  pipelineStage: string;
  goalSummary: string | null;
  healthNotes: string | null;
  lastActivityAt: string | null;
  createdAt: string;
  referralSource: string | null;
  referredByClientId: number | null;
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
  activeCount: number;
  canAddMore: boolean;
  maxClients: number | null;
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
  referralSource: string | null;
  referredByClientId: number | null;
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

interface ReferralSummary {
  totalReferred: number;
  channelBreakdown: { source: string; count: number }[];
  topReferrers: { clientId: number; clientName: string; count: number }[];
}

const REFERRAL_SOURCE_LABELS: Record<string, string> = {
  client: "Existing Client",
  social_media: "Social Media",
  website: "Website",
  other: "Other",
};

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

interface ReengagementMessage {
  delayDays: number;
  body: string;
}

interface ReengagementSequence {
  id: number;
  nutritionistId: number;
  name: string;
  triggerAfterDays: number;
  messages: ReengagementMessage[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ActiveReengagementJob {
  id: number;
  nutritionistId: number;
  clientId: number;
  sequenceId: number;
  currentStep: number;
  nextSendAt: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  sequence: ReengagementSequence;
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

interface ClientTag {
  id: number;
  nutritionistId: number;
  name: string;
  color: string;
  createdAt: string;
  clientCount?: number;
}

interface BulkActionLog {
  id: number;
  nutritionistId: number;
  tagId: number | null;
  actionType: string;
  clientIds: number[];
  payload: Record<string, unknown> | null;
  createdAt: string;
}

const STATUS_LABELS: Record<string, { label: string; classes: string }> = {
  onboarding: { label: "Onboarding", classes: "bg-blue-50 text-blue-700" },
  active: { label: "Active", classes: "bg-emerald-50 text-emerald-700" },
  paused: { label: "Paused", classes: "bg-zinc-100 text-zinc-500" },
};

const PIPELINE_STAGES = [
  { id: "inquiry", label: "Inquiry", color: "bg-violet-50 border-violet-200", headerColor: "bg-violet-100 text-violet-700", dotColor: "bg-violet-400" },
  { id: "onboarding", label: "Onboarding", color: "bg-blue-50 border-blue-200", headerColor: "bg-blue-100 text-blue-700", dotColor: "bg-blue-400" },
  { id: "active", label: "Active", color: "bg-emerald-50 border-emerald-200", headerColor: "bg-emerald-100 text-emerald-700", dotColor: "bg-emerald-400" },
  { id: "maintenance", label: "Maintenance", color: "bg-amber-50 border-amber-200", headerColor: "bg-amber-100 text-amber-700", dotColor: "bg-amber-400" },
  { id: "alumni", label: "Alumni", color: "bg-zinc-50 border-zinc-200", headerColor: "bg-zinc-100 text-zinc-600", dotColor: "bg-zinc-400" },
] as const;

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

  const { data: reengagementJobs = [] } = useQuery<ActiveReengagementJob[]>({
    queryKey: ["/api/nutritionist/reengagement/jobs"],
    queryFn: () => apiRequest("GET", "/api/nutritionist/reengagement/jobs").then(r => r.json()),
  });

  const reengagementMap = new Map(reengagementJobs.map(j => [j.clientId, j]));

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
            const reJob = reengagementMap.get(c.clientId);
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
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-semibold text-zinc-900">{c.client.name}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${s.classes}`}>{s.label}</span>
                    {m.alerts.filter(a => a.startsWith("inactive")).map((a, i) => (
                      <span key={i} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-700">
                        {a.replace("inactive_", "").replace("d", "d inactive")}
                      </span>
                    ))}
                    {reJob && (reJob.status === "active" || reJob.status === "paused") && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${reJob.status === "active" ? "bg-violet-50 text-violet-700" : "bg-zinc-100 text-zinc-500"}`} data-testid={`badge-reengagement-${c.id}`}>
                        <Zap className="w-2.5 h-2.5" />
                        {reJob.status === "active" ? "Sequence active" : "Sequence paused"}
                      </span>
                    )}
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

function CapacityBar({ count, max, label }: { count: number; max: number | null; label?: string }) {
  if (max === null) return null;
  const pct = Math.min(100, Math.round((count / max) * 100));
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div data-testid="capacity-bar">
      {label && <p className="text-xs text-zinc-500 mb-1">{label}</p>}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs font-medium text-zinc-600 flex-shrink-0">{count}/{max}</span>
      </div>
    </div>
  );
}

function PipelineKanban({
  capacity,
  onSelectClient,
}: {
  capacity: Capacity;
  onSelectClient: (c: ClientWithUser) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: monitoringData = [], isLoading } = useQuery<ClientWithMonitoring[]>({
    queryKey: ["/api/nutritionist/monitoring/dashboard"],
    queryFn: () => apiRequest("GET", "/api/nutritionist/monitoring/dashboard").then(r => r.json()),
    refetchInterval: 60000,
  });

  const stageMutation = useMutation({
    mutationFn: ({ id, stage }: { id: number; stage: string }) =>
      apiRequest("PATCH", `/api/nutritionist/clients/${id}/pipeline-stage`, { stage }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/monitoring/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/clients"] });
    },
    onError: () => {
      toast({ title: "Failed to update stage", variant: "destructive" });
    },
  });

  const activeCount = monitoringData.filter(c => (c.pipelineStage || "onboarding") === "active").length;

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
            <KanbanSquare className="w-5 h-5 text-zinc-500" />
            Client Pipeline
          </h2>
          <p className="text-sm text-zinc-500 mt-0.5">{monitoringData.length} client{monitoringData.length !== 1 ? "s" : ""} across all stages</p>
        </div>
        {capacity.maxClients !== null && (
          <div className="w-48">
            <CapacityBar count={activeCount} max={capacity.maxClients} label="Active capacity" />
          </div>
        )}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4" data-testid="pipeline-kanban-board">
        {PIPELINE_STAGES.map(stage => {
          const stageClients = monitoringData.filter(c => (c.pipelineStage || "onboarding") === stage.id);
          return (
            <div
              key={stage.id}
              className={`flex-shrink-0 w-60 rounded-2xl border ${stage.color} flex flex-col`}
              data-testid={`pipeline-column-${stage.id}`}
            >
              <div className={`px-3 py-2.5 rounded-t-2xl ${stage.headerColor} flex items-center justify-between`}>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${stage.dotColor}`} />
                  <span className="text-xs font-semibold">{stage.label}</span>
                </div>
                <span className="text-xs font-bold opacity-70">{stageClients.length}</span>
              </div>
              <div className="p-2 space-y-2 flex-1 min-h-[100px]">
                {stageClients.length === 0 && (
                  <div className="flex items-center justify-center h-16 text-[11px] text-zinc-400 italic">No clients</div>
                )}
                {stageClients.map(client => (
                  <PipelineCard
                    key={client.id}
                    client={client}
                    currentStage={stage.id}
                    onSelect={() => onSelectClient(client)}
                    onMoveStage={(newStage) => stageMutation.mutate({ id: client.id, stage: newStage })}
                    isPending={stageMutation.isPending}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ClientTagBadge({ tag }: { tag: ClientTag }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
      style={{ backgroundColor: tag.color + "22", color: tag.color, border: `1px solid ${tag.color}44` }}
      data-testid={`badge-tag-${tag.id}`}
    >
      {tag.name}
    </span>
  );
}

function ClientTagPicker({ clientId }: { clientId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: allTags = [] } = useQuery<ClientTag[]>({
    queryKey: ["/api/nutritionist/tags"],
    queryFn: () => apiRequest("GET", "/api/nutritionist/tags").then(r => r.json()),
  });

  const { data: clientTags = [] } = useQuery<ClientTag[]>({
    queryKey: ["/api/nutritionist/clients", clientId, "tags"],
    queryFn: () => apiRequest("GET", `/api/nutritionist/clients/${clientId}/tags`).then(r => r.json()),
  });

  const setTagsMutation = useMutation({
    mutationFn: (tagIds: number[]) =>
      apiRequest("PUT", `/api/nutritionist/clients/${clientId}/tags`, { tagIds }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/clients", clientId, "tags"] });
    },
    onError: () => toast({ title: "Failed to update tags", variant: "destructive" }),
  });

  const assignedIds = new Set(clientTags.map(t => t.id));

  const toggleTag = (tag: ClientTag) => {
    const newIds = assignedIds.has(tag.id)
      ? Array.from(assignedIds).filter(id => id !== tag.id)
      : Array.from(assignedIds).concat(tag.id);
    setTagsMutation.mutate(newIds);
  };

  if (allTags.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-zinc-500 mb-1.5">Tags</p>
      <div className="flex flex-wrap gap-1.5">
        {allTags.map(tag => {
          const active = assignedIds.has(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggleTag(tag)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all"
              style={active
                ? { backgroundColor: tag.color + "33", color: tag.color, border: `1px solid ${tag.color}` }
                : { backgroundColor: "#f4f4f5", color: "#71717a", border: "1px solid #e4e4e7" }
              }
              data-testid={`toggle-tag-${tag.id}`}
            >
              {active && <Check className="w-2.5 h-2.5" />}
              {tag.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PipelineCard({
  client,
  currentStage,
  onSelect,
  onMoveStage,
  isPending,
}: {
  client: ClientWithMonitoring;
  currentStage: string;
  onSelect: () => void;
  onMoveStage: (stage: string) => void;
  isPending: boolean;
}) {
  const [showStageMenu, setShowStageMenu] = useState(false);
  const monitoring = client.monitoring;

  return (
    <div className="bg-white rounded-xl border border-zinc-100 shadow-sm" data-testid={`pipeline-card-${client.id}`}>
      <button
        type="button"
        onClick={onSelect}
        className="w-full text-left px-3 py-2.5 hover:bg-zinc-50 rounded-xl transition-colors"
      >
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-6 h-6 bg-zinc-900 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
            {client.client.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-xs font-semibold text-zinc-900 truncate">{client.client.name}</span>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-full h-1 bg-zinc-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${(monitoring.adherenceScore ?? 0) >= 80 ? "bg-emerald-400" : (monitoring.adherenceScore ?? 0) >= 60 ? "bg-amber-400" : "bg-red-400"}`}
                style={{ width: `${Math.min(100, monitoring.adherenceScore ?? 0)}%` }}
              />
            </div>
            <span className="text-[10px] text-zinc-400 flex-shrink-0">
              {monitoring.adherenceScore !== null ? `${monitoring.adherenceScore}%` : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-400">
              {monitoring.daysInactive > 0 ? `${monitoring.daysInactive}d inactive` : monitoring.lastLogDate ? "Active" : "No logs"}
            </span>
            {monitoring.alerts.length > 0 && (
              <span className="text-[10px] px-1 py-0.5 bg-red-50 text-red-600 rounded-full font-medium" data-testid={`pipeline-alert-${client.id}`}>
                Alert
              </span>
            )}
          </div>
        </div>
      </button>
      <div className="px-3 pb-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowStageMenu(v => !v)}
            disabled={isPending}
            className="w-full text-[10px] flex items-center justify-between px-2 py-1 border border-zinc-200 rounded-lg text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 transition-colors bg-white"
            data-testid={`button-move-stage-${client.id}`}
          >
            <span>Move to...</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          {showStageMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowStageMenu(false)} />
              <div className="absolute bottom-full left-0 right-0 mb-1 z-20 bg-white border border-zinc-200 rounded-xl shadow-lg overflow-hidden">
                {PIPELINE_STAGES.filter(s => s.id !== currentStage).map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { onMoveStage(s.id); setShowStageMenu(false); }}
                    className="w-full text-left px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-50 transition-colors flex items-center gap-2"
                    data-testid={`option-stage-${s.id}-${client.id}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${s.dotColor}`} />
                    {s.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SegmentsView() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedTag, setSelectedTag] = useState<ClientTag | null>(null);
  const [selectedClientIds, setSelectedClientIds] = useState<Set<number>>(new Set());
  const [bulkMessage, setBulkMessage] = useState("");
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6366f1");
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [editingTag, setEditingTag] = useState<ClientTag | null>(null);
  const [editTagName, setEditTagName] = useState("");
  const [editTagColor, setEditTagColor] = useState("");

  const { data: tags = [], isLoading: tagsLoading } = useQuery<ClientTag[]>({
    queryKey: ["/api/nutritionist/tags"],
    queryFn: () => apiRequest("GET", "/api/nutritionist/tags").then(r => r.json()),
  });

  const { data: segmentClients = [], isLoading: segmentLoading } = useQuery<ClientWithUser[]>({
    queryKey: ["/api/nutritionist/tags", selectedTag?.id, "clients"],
    queryFn: () => apiRequest("GET", `/api/nutritionist/tags/${selectedTag!.id}/clients`).then(r => r.json()),
    enabled: !!selectedTag,
  });

  const { data: templates = [] } = useQuery<Array<{ id: number; name: string; description?: string }>>({
    queryKey: ["/api/nutritionist/plan-templates"],
    queryFn: () => apiRequest("GET", "/api/nutritionist/plan-templates").then(r => r.json()),
  });

  const { data: actionLogs = [] } = useQuery<BulkActionLog[]>({
    queryKey: ["/api/nutritionist/bulk-action-logs"],
    queryFn: () => apiRequest("GET", "/api/nutritionist/bulk-action-logs?limit=10").then(r => r.json()),
  });

  const createTagMutation = useMutation({
    mutationFn: (data: { name: string; color: string }) =>
      apiRequest("POST", "/api/nutritionist/tags", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/tags"] });
      toast({ title: "Tag created" });
      setNewTagName("");
      setShowCreateTag(false);
    },
    onError: (err: Error) => toast({ title: "Failed to create tag", description: err.message, variant: "destructive" }),
  });

  const updateTagMutation = useMutation({
    mutationFn: ({ id, name, color }: { id: number; name: string; color: string }) =>
      apiRequest("PUT", `/api/nutritionist/tags/${id}`, { name, color }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/tags"] });
      toast({ title: "Tag updated" });
      setEditingTag(null);
    },
    onError: (err: Error) => toast({ title: "Failed to update tag", description: err.message, variant: "destructive" }),
  });

  const deleteTagMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/nutritionist/tags/${id}`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/tags"] });
      toast({ title: "Tag deleted" });
      if (selectedTag && deleteTagMutation.variables === selectedTag.id) setSelectedTag(null);
    },
    onError: (err: Error) => toast({ title: "Failed to delete tag", description: err.message, variant: "destructive" }),
  });

  const bulkMessageMutation = useMutation({
    mutationFn: (data: { clientIds: number[]; message: string; tagId?: number }) =>
      apiRequest("POST", "/api/nutritionist/segments/bulk-message", data).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/bulk-action-logs"] });
      toast({ title: `Message sent to ${data.sentTo} client${data.sentTo !== 1 ? "s" : ""}` });
      setBulkMessage("");
      setShowMessageForm(false);
      setSelectedClientIds(new Set());
    },
    onError: (err: Error) => toast({ title: "Failed to send message", description: err.message, variant: "destructive" }),
  });

  const bulkAssignMutation = useMutation({
    mutationFn: (data: { clientIds: number[]; templateId: number; tagId?: number }) =>
      apiRequest("POST", "/api/nutritionist/segments/bulk-assign-template", data).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/bulk-action-logs"] });
      toast({ title: `Template assigned to ${data.assignedTo} client${data.assignedTo !== 1 ? "s" : ""}` });
      setShowTemplateForm(false);
      setSelectedClientIds(new Set());
    },
    onError: (err: Error) => toast({ title: "Failed to assign template", description: err.message, variant: "destructive" }),
  });

  const allSelected = segmentClients.length > 0 && selectedClientIds.size === segmentClients.length;

  const toggleSelectAll = () => {
    if (allSelected) setSelectedClientIds(new Set());
    else setSelectedClientIds(new Set(segmentClients.map(c => c.clientId)));
  };

  const toggleClient = (clientId: number) => {
    const s = new Set(selectedClientIds);
    if (s.has(clientId)) s.delete(clientId);
    else s.add(clientId);
    setSelectedClientIds(s);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-display font-bold text-zinc-900 flex items-center gap-2">
            <Tags className="w-5 h-5 text-zinc-500" />
            Segments
          </h2>
          <p className="text-sm text-zinc-500 mt-0.5">Group clients by tag and send bulk messages or assign plans</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateTag(v => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 transition-colors"
          data-testid="button-create-tag"
        >
          <Plus className="w-4 h-4" />
          New Tag
        </button>
      </div>

      {showCreateTag && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-4 mb-4" data-testid="form-create-tag">
          <h3 className="text-sm font-semibold text-zinc-900 mb-3">Create Tag</h3>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={newTagName}
              onChange={e => setNewTagName(e.target.value)}
              placeholder="Tag name (e.g. PCOS, Athletes)"
              className="flex-1 px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
              data-testid="input-tag-name"
            />
            <input
              type="color"
              value={newTagColor}
              onChange={e => setNewTagColor(e.target.value)}
              className="w-10 h-10 border border-zinc-200 rounded-xl cursor-pointer"
              title="Tag color"
              data-testid="input-tag-color"
            />
            <button
              type="button"
              onClick={() => newTagName.trim() && createTagMutation.mutate({ name: newTagName.trim(), color: newTagColor })}
              disabled={!newTagName.trim() || createTagMutation.isPending}
              className="px-4 py-2 bg-zinc-900 text-white text-sm rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-colors"
              data-testid="button-save-tag"
            >
              {createTagMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateTag(false)}
              className="px-3 py-2 border border-zinc-200 text-sm rounded-xl text-zinc-600 hover:bg-zinc-50 transition-colors"
              data-testid="button-cancel-create-tag"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="md:col-span-1">
          <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-100">
              <h3 className="text-sm font-semibold text-zinc-900">Tags</h3>
            </div>
            {tagsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>
            ) : tags.length === 0 ? (
              <div className="p-8 text-center">
                <Tag className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">No tags yet</p>
                <p className="text-xs text-zinc-400 mt-1">Create a tag to segment your clients</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-50">
                {tags.map(tag => (
                  <div key={tag.id} className="flex items-center gap-3 px-4 py-3" data-testid={`row-tag-${tag.id}`}>
                    {editingTag?.id === tag.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={editTagName}
                          onChange={e => setEditTagName(e.target.value)}
                          className="flex-1 px-2 py-1 border border-zinc-200 rounded-lg text-sm focus:outline-none"
                          data-testid="input-edit-tag-name"
                        />
                        <input
                          type="color"
                          value={editTagColor}
                          onChange={e => setEditTagColor(e.target.value)}
                          className="w-8 h-8 border border-zinc-200 rounded-lg cursor-pointer"
                          data-testid="input-edit-tag-color"
                        />
                        <button
                          type="button"
                          onClick={() => updateTagMutation.mutate({ id: tag.id, name: editTagName, color: editTagColor })}
                          disabled={updateTagMutation.isPending}
                          className="p-1.5 bg-zinc-900 text-white rounded-lg"
                          data-testid={`button-save-edit-tag-${tag.id}`}
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTag(null)}
                          className="p-1.5 border border-zinc-200 text-zinc-600 rounded-lg hover:bg-zinc-50"
                          data-testid={`button-cancel-edit-tag-${tag.id}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => { setSelectedTag(tag); setSelectedClientIds(new Set()); setShowMessageForm(false); setShowTemplateForm(false); }}
                          className={`flex-1 flex items-center gap-2 text-left ${selectedTag?.id === tag.id ? "opacity-100" : "opacity-80 hover:opacity-100"}`}
                          data-testid={`button-select-tag-${tag.id}`}
                        >
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color }} />
                          <span className="text-sm font-medium text-zinc-900">{tag.name}</span>
                          <span className="ml-auto text-xs text-zinc-400">{tag.clientCount ?? 0}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => { setEditingTag(tag); setEditTagName(tag.name); setEditTagColor(tag.color); }}
                          className="p-1 text-zinc-400 hover:text-zinc-700 transition-colors"
                          data-testid={`button-edit-tag-${tag.id}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTagMutation.mutate(tag.id)}
                          disabled={deleteTagMutation.isPending}
                          className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
                          data-testid={`button-delete-tag-${tag.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-2">
          {!selectedTag ? (
            <div className="bg-white border border-zinc-100 rounded-2xl p-10 text-center h-full flex items-center justify-center">
              <div>
                <Tags className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
                <p className="text-sm text-zinc-500">Select a tag to see its clients</p>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedTag.color }} />
                  <h3 className="text-sm font-semibold text-zinc-900">{selectedTag.name}</h3>
                  <span className="text-xs text-zinc-400">{segmentClients.length} client{segmentClients.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex items-center gap-2">
                  {selectedClientIds.size > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => { setShowMessageForm(v => !v); setShowTemplateForm(false); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-colors"
                        data-testid="button-bulk-message"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        Message ({selectedClientIds.size})
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowTemplateForm(v => !v); setShowMessageForm(false); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-zinc-200 text-zinc-700 rounded-lg hover:bg-zinc-50 transition-colors"
                        data-testid="button-bulk-assign-template"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Assign Plan ({selectedClientIds.size})
                      </button>
                    </>
                  )}
                </div>
              </div>

              {showMessageForm && (
                <div className="border-b border-zinc-100 px-4 py-3 bg-zinc-50" data-testid="form-bulk-message">
                  <p className="text-xs font-medium text-zinc-700 mb-2">Send message to {selectedClientIds.size} client{selectedClientIds.size !== 1 ? "s" : ""}</p>
                  <textarea
                    value={bulkMessage}
                    onChange={e => setBulkMessage(e.target.value)}
                    placeholder="Write your message..."
                    rows={3}
                    maxLength={5000}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20 resize-none"
                    data-testid="textarea-bulk-message"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => bulkMessageMutation.mutate({ clientIds: Array.from(selectedClientIds), message: bulkMessage, tagId: selectedTag.id })}
                      disabled={!bulkMessage.trim() || bulkMessageMutation.isPending}
                      className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white text-xs font-medium rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                      data-testid="button-send-bulk-message"
                    >
                      {bulkMessageMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Send
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowMessageForm(false)}
                      className="px-3 py-2 border border-zinc-200 text-xs rounded-xl text-zinc-600 hover:bg-zinc-50 transition-colors"
                      data-testid="button-cancel-bulk-message"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {showTemplateForm && (
                <div className="border-b border-zinc-100 px-4 py-3 bg-zinc-50" data-testid="form-bulk-template">
                  <p className="text-xs font-medium text-zinc-700 mb-2">Assign plan template to {selectedClientIds.size} client{selectedClientIds.size !== 1 ? "s" : ""}</p>
                  {templates.length === 0 ? (
                    <p className="text-xs text-zinc-400">No plan templates available. Create one first in the Clients tab.</p>
                  ) : (
                    <>
                      <select
                        value={selectedTemplateId ?? ""}
                        onChange={e => setSelectedTemplateId(parseInt(e.target.value) || null)}
                        className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none bg-white mb-2"
                        data-testid="select-template"
                      >
                        <option value="">Select a template...</option>
                        {templates.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => selectedTemplateId && bulkAssignMutation.mutate({ clientIds: Array.from(selectedClientIds), templateId: selectedTemplateId, tagId: selectedTag.id })}
                          disabled={!selectedTemplateId || bulkAssignMutation.isPending}
                          className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white text-xs font-medium rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                          data-testid="button-confirm-assign-template"
                        >
                          {bulkAssignMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          Assign to {selectedClientIds.size} client{selectedClientIds.size !== 1 ? "s" : ""}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowTemplateForm(false)}
                          className="px-3 py-2 border border-zinc-200 text-xs rounded-xl text-zinc-600 hover:bg-zinc-50 transition-colors"
                          data-testid="button-cancel-assign-template"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {segmentLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>
              ) : segmentClients.length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                  <p className="text-sm text-zinc-500">No clients in this segment</p>
                  <p className="text-xs text-zinc-400 mt-1">Assign this tag to clients from their profile</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-50">
                  <div className="px-4 py-2.5 flex items-center gap-3 bg-zinc-50/50">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-zinc-300"
                      data-testid="checkbox-select-all"
                    />
                    <span className="text-xs text-zinc-500">Select all</span>
                  </div>
                  {segmentClients.map(c => (
                    <div key={c.id} className="px-4 py-3 flex items-center gap-3" data-testid={`row-segment-client-${c.clientId}`}>
                      <input
                        type="checkbox"
                        checked={selectedClientIds.has(c.clientId)}
                        onChange={() => toggleClient(c.clientId)}
                        className="w-4 h-4 rounded border-zinc-300"
                        data-testid={`checkbox-client-${c.clientId}`}
                      />
                      <div className="w-8 h-8 bg-zinc-900 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {c.client.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-900">{c.client.name}</p>
                        <p className="text-xs text-zinc-400">{c.client.email}</p>
                      </div>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_LABELS[c.status]?.classes ?? STATUS_LABELS.onboarding.classes}`}>
                        {STATUS_LABELS[c.status]?.label ?? c.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {actionLogs.length > 0 && (
        <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-100">
            <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
              <History className="w-4 h-4 text-zinc-400" />
              Bulk Action History
            </h3>
          </div>
          <div className="divide-y divide-zinc-50">
            {actionLogs.map(log => {
              const tag = tags.find(t => t.id === log.tagId);
              return (
                <div key={log.id} className="px-4 py-3" data-testid={`row-log-${log.id}`}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${log.actionType === "bulk_message" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}>
                      {log.actionType === "bulk_message" ? "Message" : "Plan Assigned"}
                    </span>
                    {tag && <ClientTagBadge tag={tag} />}
                    <span className="text-xs text-zinc-400 ml-auto">{formatDate(log.createdAt)}</span>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Sent to {(log.clientIds as number[]).length} client{(log.clientIds as number[]).length !== 1 ? "s" : ""}
                    {log.payload?.message ? (
                      <span className="italic"> — &#34;{String(log.payload.message).slice(0, 60)}{String(log.payload.message).length > 60 ? "..." : ""}&#34;</span>
                    ) : null}
                    {log.payload?.templateName ? (
                      <span> — template: {String(log.payload.templateName)}</span>
                    ) : null}
                  </p>
                </div>
              );
            })}
          </div>
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

interface ClientReportEntry {
  id: number;
  nutritionistId: number;
  clientId: number;
  title: string;
  fromDate: string;
  toDate: string;
  clinicalSummary: string | null;
  reportData: ProgressReportData;
  createdAt: string;
}

function GenerateReportDialog({
  clientId,
  clientName,
  onClose,
}: {
  clientId: number;
  clientName: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

  const [fromDate, setFromDate] = useState(thirtyDaysAgo);
  const [toDate, setToDate] = useState(today);
  const [clinicalSummary, setClinicalSummary] = useState("");
  const [title, setTitle] = useState("");
  const [previewData, setPreviewData] = useState<ClientReportEntry | null>(null);
  const [editingSummary, setEditingSummary] = useState(false);

  const generateMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/nutritionist/clients/${clientId}/reports/generate`, {
        fromDate,
        toDate,
        clinicalSummary: clinicalSummary.trim() || null,
        title: title.trim() || undefined,
      }).then(r => r.json()),
    onSuccess: (data: ClientReportEntry) => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/clients", clientId, "reports"] });
      setPreviewData(data);
      toast({ title: "Report generated" });
    },
    onError: (err: Error) => toast({ title: "Failed to generate report", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (updates: { clinicalSummary?: string | null }) =>
      apiRequest("PATCH", `/api/nutritionist/clients/${clientId}/reports/${previewData!.id}`, updates).then(r => r.json()),
    onSuccess: (data: ClientReportEntry) => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/clients", clientId, "reports"] });
      setPreviewData(data);
      setEditingSummary(false);
      toast({ title: "Report updated" });
    },
    onError: (err: Error) => toast({ title: "Failed to update", description: err.message, variant: "destructive" }),
  });

  const handleExportPDF = async () => {
    if (!previewData) return;
    const rd = previewData.reportData;
    await exportProgressReportToPDF(rd, previewData.clinicalSummary, previewData.title);
    toast({ title: "PDF downloaded" });
  };

  if (previewData) {
    const rd = previewData.reportData;
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="modal-report-preview">
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 sticky top-0 bg-white z-10">
            <h2 className="font-semibold text-zinc-900">{previewData.title}</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportPDF}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 text-white text-sm rounded-xl hover:bg-zinc-800 transition-colors"
                data-testid="button-export-pdf"
              >
                <Download className="w-3.5 h-3.5" />
                Export PDF
              </button>
              <button type="button" onClick={onClose} className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg" data-testid="button-close-report">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div className="bg-zinc-50 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Client</h3>
              <p className="text-sm font-medium text-zinc-900">{rd.client.name}</p>
              <p className="text-xs text-zinc-500">{rd.client.email}</p>
              {rd.goalSummary && <p className="text-xs text-zinc-500 mt-1">Goal: {rd.goalSummary}</p>}
            </div>

            <div className="bg-zinc-50 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Period</h3>
              <p className="text-sm text-zinc-700">
                {formatDate(rd.period.fromDate)} — {formatDate(rd.period.toDate)} ({rd.period.totalDays} days)
              </p>
            </div>

            {rd.targets && (
              <div className="bg-zinc-50 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                  Targets {rd.targets.hasOverrides && <span className="text-amber-600">(overridden)</span>}
                </h3>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { l: "Calories", v: `${rd.targets.dailyCalories} kcal` },
                    { l: "Protein", v: `${rd.targets.proteinGoal}g` },
                    { l: "Carbs", v: `${rd.targets.carbsGoal}g` },
                    { l: "Fat", v: `${rd.targets.fatGoal}g` },
                  ].map(item => (
                    <div key={item.l} className="text-center">
                      <p className="text-sm font-bold text-zinc-900">{item.v}</p>
                      <p className="text-[10px] text-zinc-400">{item.l}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {rd.weightTrend.length > 0 && (
              <div className="bg-zinc-50 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Weight Trend</h3>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {rd.weightTrend.map(w => (
                    <div key={w.date} className="text-center flex-shrink-0">
                      <p className="text-sm font-bold text-zinc-900">{w.weight}</p>
                      <p className="text-[10px] text-zinc-400">{formatDateShort(w.date)}</p>
                    </div>
                  ))}
                </div>
                {rd.weightTrend.length >= 2 && (
                  <p className="text-xs text-zinc-500 mt-2">
                    {rd.weightTrend[0].weight} → {rd.weightTrend[rd.weightTrend.length - 1].weight} kg
                    ({(rd.weightTrend[rd.weightTrend.length - 1].weight - rd.weightTrend[0].weight) >= 0 ? "+" : ""}
                    {(rd.weightTrend[rd.weightTrend.length - 1].weight - rd.weightTrend[0].weight).toFixed(1)} kg)
                  </p>
                )}
              </div>
            )}

            <div className="bg-zinc-50 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Intake & Adherence</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-sm font-bold text-zinc-900">{rd.avgIntake ? `${rd.avgIntake.calories} kcal` : "—"}</p>
                  <p className="text-[10px] text-zinc-400">Avg daily calories</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-zinc-900">{rd.daysLogged} / {rd.totalDays}</p>
                  <p className="text-[10px] text-zinc-400">Days logged</p>
                </div>
                <div>
                  <p className={`text-sm font-bold ${rd.adherenceScore !== null ? (rd.adherenceScore >= 80 ? "text-emerald-600" : rd.adherenceScore >= 60 ? "text-amber-600" : "text-red-600") : "text-zinc-400"}`}>
                    {rd.adherenceScore !== null ? `${rd.adherenceScore}%` : "—"}
                  </p>
                  <p className="text-[10px] text-zinc-400">Adherence</p>
                </div>
              </div>
              {rd.avgIntake && (
                <div className="grid grid-cols-3 gap-3 text-center mt-3 pt-3 border-t border-zinc-200">
                  <div>
                    <p className="text-xs font-medium text-zinc-700">{rd.avgIntake.protein}g</p>
                    <p className="text-[10px] text-zinc-400">Avg protein</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-700">{rd.avgIntake.carbs}g</p>
                    <p className="text-[10px] text-zinc-400">Avg carbs</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-700">{rd.avgIntake.fat}g</p>
                    <p className="text-[10px] text-zinc-400">Avg fat</p>
                  </div>
                </div>
              )}
            </div>

            {rd.intakeVsTargets && (
              <div className="bg-zinc-50 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Intake vs Targets</h3>
                <div className="grid grid-cols-4 gap-3 text-center">
                  {[
                    { l: "Calories", v: rd.intakeVsTargets.caloriesDelta, u: " kcal" },
                    { l: "Protein", v: rd.intakeVsTargets.proteinDelta, u: "g" },
                    { l: "Carbs", v: rd.intakeVsTargets.carbsDelta, u: "g" },
                    { l: "Fat", v: rd.intakeVsTargets.fatDelta, u: "g" },
                  ].map(item => (
                    <div key={item.l}>
                      <p className={`text-sm font-bold ${Math.abs(item.v) <= 10 ? "text-emerald-600" : "text-amber-600"}`}>
                        {item.v >= 0 ? "+" : ""}{item.v}{item.u}
                      </p>
                      <p className="text-[10px] text-zinc-400">{item.l}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {rd.goalProgress && rd.goalProgress.length > 0 && (
              <div className="bg-zinc-50 rounded-xl p-4" data-testid="report-goals-section">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Goals</h3>
                <div className="space-y-2">
                  {rd.goalProgress.map((goal: { title: string; goalType: string; targetValue: string | null; currentValue: string | null; unit: string | null; status: string; targetDate: string | null }, idx: number) => (
                    <div key={idx} className="flex items-center justify-between border border-zinc-200 rounded-lg p-2">
                      <div>
                        <p className="text-sm font-medium text-zinc-900">{goal.title}</p>
                        <p className="text-[10px] text-zinc-400">
                          {goal.targetValue && `Target: ${goal.targetValue}${goal.unit ? ` ${goal.unit}` : ""}`}
                          {goal.currentValue && ` · Current: ${goal.currentValue}${goal.unit ? ` ${goal.unit}` : ""}`}
                        </p>
                      </div>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${goal.status === "completed" ? "bg-emerald-50 text-emerald-700" : goal.status === "active" ? "bg-zinc-100 text-zinc-700" : "bg-zinc-100 text-zinc-400"}`}>
                        {goal.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-zinc-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Clinical Summary</h3>
                <button
                  type="button"
                  onClick={() => { setEditingSummary(!editingSummary); setClinicalSummary(previewData.clinicalSummary ?? ""); }}
                  className="text-xs text-blue-600 hover:text-blue-700"
                  data-testid="button-edit-clinical-summary"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {editingSummary ? (
                <div className="space-y-2">
                  <textarea
                    value={clinicalSummary}
                    onChange={e => setClinicalSummary(e.target.value)}
                    rows={4}
                    maxLength={5000}
                    placeholder="Add clinical observations, recommendations, and notes for this report..."
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20 resize-none"
                    data-testid="textarea-clinical-summary"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateMutation.mutate({ clinicalSummary: clinicalSummary.trim() || null })}
                      disabled={updateMutation.isPending}
                      className="flex items-center gap-1 px-3 py-1.5 bg-zinc-900 text-white text-xs rounded-lg disabled:opacity-50"
                      data-testid="button-save-clinical-summary"
                    >
                      {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
                    </button>
                    <button type="button" onClick={() => setEditingSummary(false)} className="px-3 py-1.5 border border-zinc-200 text-xs rounded-lg text-zinc-600">Cancel</button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-zinc-700 whitespace-pre-wrap" data-testid="text-clinical-summary">
                  {previewData.clinicalSummary || <span className="italic text-zinc-400">No clinical summary added yet. Click edit to add one before exporting.</span>}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" data-testid="modal-generate-report">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="font-semibold text-zinc-900">Generate Progress Report</h2>
          <button type="button" onClick={onClose} className="p-1.5 text-zinc-400 hover:text-zinc-700 rounded-lg" data-testid="button-close-generate-report">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-zinc-500">Generate a progress report for <strong>{clientName}</strong> over a selected date range.</p>

          <div>
            <label className="text-xs font-medium text-zinc-500 block mb-1">Report Title (optional)</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={`Progress Report — ${clientName}`}
              maxLength={200}
              className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
              data-testid="input-report-title"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">From</label>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                max={toDate}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                data-testid="input-report-from"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">To</label>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                min={fromDate}
                max={today}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                data-testid="input-report-to"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-500 block mb-1">Clinical Summary (optional — can be added later)</label>
            <textarea
              value={clinicalSummary}
              onChange={e => setClinicalSummary(e.target.value)}
              rows={3}
              maxLength={5000}
              placeholder="Clinical observations, recommendations, and notes for the report..."
              className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20 resize-none"
              data-testid="textarea-report-summary"
            />
          </div>

          <button
            type="button"
            onClick={() => generateMutation.mutate()}
            disabled={!fromDate || !toDate || generateMutation.isPending}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            data-testid="button-generate-report"
          >
            {generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Generate Report
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportHistoryPanel({ clientId }: { clientId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [expandedReport, setExpandedReport] = useState<number | null>(null);

  const { data: reports = [], isLoading } = useQuery<ClientReportEntry[]>({
    queryKey: ["/api/nutritionist/clients", clientId, "reports"],
    queryFn: () => apiRequest("GET", `/api/nutritionist/clients/${clientId}/reports`).then(r => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (reportId: number) =>
      apiRequest("DELETE", `/api/nutritionist/clients/${clientId}/reports/${reportId}`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/clients", clientId, "reports"] });
      toast({ title: "Report deleted" });
    },
    onError: () => toast({ title: "Failed to delete report", variant: "destructive" }),
  });

  const handleDownload = async (report: ClientReportEntry) => {
    await exportProgressReportToPDF(report.reportData, report.clinicalSummary, report.title);
    toast({ title: "PDF downloaded" });
  };

  if (isLoading) {
    return <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>;
  }

  if (reports.length === 0) {
    return (
      <p className="text-sm text-zinc-400 text-center py-4" data-testid="state-no-reports">
        No reports generated yet.
      </p>
    );
  }

  return (
    <div className="space-y-2" data-testid="report-history-list">
      {reports.map(report => (
        <div key={report.id} className="border border-zinc-100 rounded-xl p-3" data-testid={`report-${report.id}`}>
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-900 truncate">{report.title}</p>
              <p className="text-xs text-zinc-400">
                {formatDate(report.fromDate)} — {formatDate(report.toDate)} · Created {formatDate(report.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => handleDownload(report)}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 transition-colors"
                title="Download PDF"
                data-testid={`button-download-report-${report.id}`}
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setExpandedReport(expandedReport === report.id ? null : report.id)}
                className="p-1.5 text-zinc-400 hover:text-zinc-700 transition-colors"
                data-testid={`button-expand-report-${report.id}`}
              >
                {expandedReport === report.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(report.id)}
                disabled={deleteMutation.isPending}
                className="p-1.5 text-zinc-400 hover:text-red-600 transition-colors"
                data-testid={`button-delete-report-${report.id}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {expandedReport === report.id && (
            <div className="mt-3 pt-3 border-t border-zinc-100 space-y-2">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs font-bold text-zinc-900">
                    {report.reportData.avgIntake ? `${report.reportData.avgIntake.calories} kcal` : "—"}
                  </p>
                  <p className="text-[10px] text-zinc-400">Avg calories</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-zinc-900">{report.reportData.daysLogged} / {report.reportData.totalDays}</p>
                  <p className="text-[10px] text-zinc-400">Days logged</p>
                </div>
                <div>
                  <p className={`text-xs font-bold ${report.reportData.adherenceScore !== null ? (report.reportData.adherenceScore >= 80 ? "text-emerald-600" : "text-amber-600") : "text-zinc-400"}`}>
                    {report.reportData.adherenceScore !== null ? `${report.reportData.adherenceScore}%` : "—"}
                  </p>
                  <p className="text-[10px] text-zinc-400">Adherence</p>
                </div>
              </div>
              {report.clinicalSummary && (
                <div className="bg-zinc-50 rounded-lg p-2">
                  <p className="text-xs text-zinc-600 whitespace-pre-wrap">{report.clinicalSummary}</p>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
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

interface ClientMetric {
  id: number;
  nutritionistId: number;
  clientId: number;
  metricType: string;
  customLabel: string | null;
  value: string;
  unit: string | null;
  notes: string | null;
  recordedAt: string;
  createdAt: string;
}

const METRIC_TYPE_LABELS: Record<string, { label: string; defaultUnit: string }> = {
  weight: { label: "Weight", defaultUnit: "kg" },
  body_fat: { label: "Body Fat", defaultUnit: "%" },
  waist_circumference: { label: "Waist Circumference", defaultUnit: "cm" },
  blood_pressure_systolic: { label: "Blood Pressure (Systolic)", defaultUnit: "mmHg" },
  blood_pressure_diastolic: { label: "Blood Pressure (Diastolic)", defaultUnit: "mmHg" },
  blood_glucose: { label: "Blood Glucose", defaultUnit: "mmol/L" },
  custom: { label: "Custom", defaultUnit: "" },
};

function OutcomesPanel({ clientRecord, readonly = false }: { clientRecord: ClientWithUser; readonly?: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedMetricType, setSelectedMetricType] = useState<string>("weight");
  const [newEntry, setNewEntry] = useState({
    value: "",
    unit: "",
    customLabel: "",
    notes: "",
    recordedAt: new Date().toISOString().split("T")[0],
  });
  const [selectedMetricFilter, setSelectedMetricFilter] = useState<string>("all");

  const apiPath = readonly
    ? "/api/my-nutritionist/metrics"
    : `/api/nutritionist/clients/${clientRecord.clientId}/metrics`;

  const { data: metrics = [], isLoading } = useQuery<ClientMetric[]>({
    queryKey: readonly
      ? ["/api/my-nutritionist/metrics"]
      : ["/api/nutritionist/clients", clientRecord.clientId, "metrics"],
    queryFn: () => apiRequest("GET", apiPath).then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: object) =>
      apiRequest("POST", `/api/nutritionist/clients/${clientRecord.clientId}/metrics`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/clients", clientRecord.clientId, "metrics"] });
      toast({ title: "Metric entry logged" });
      setShowAddForm(false);
      setNewEntry({ value: "", unit: "", customLabel: "", notes: "", recordedAt: new Date().toISOString().split("T")[0] });
    },
    onError: (err: Error) => toast({ title: "Failed to log metric", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/nutritionist/clients/${clientRecord.clientId}/metrics/${id}`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/clients", clientRecord.clientId, "metrics"] });
      toast({ title: "Entry deleted" });
    },
    onError: () => toast({ title: "Failed to delete entry", variant: "destructive" }),
  });

  const handleSubmit = () => {
    if (!newEntry.value.trim()) return;
    const info = METRIC_TYPE_LABELS[selectedMetricType];
    createMutation.mutate({
      metricType: selectedMetricType,
      customLabel: selectedMetricType === "custom" ? newEntry.customLabel || null : undefined,
      value: newEntry.value,
      unit: newEntry.unit || info?.defaultUnit || null,
      notes: newEntry.notes || null,
      recordedAt: newEntry.recordedAt || undefined,
    });
  };

  const metricTypes = Array.from(new Set(metrics.map(m => m.metricType)));

  const filteredMetrics = selectedMetricFilter === "all"
    ? metrics
    : metrics.filter(m => m.metricType === selectedMetricFilter);

  const chartMetrics = selectedMetricFilter !== "all"
    ? metrics
        .filter(m => m.metricType === selectedMetricFilter)
        .slice()
        .reverse()
        .map(m => ({
          date: new Date(m.recordedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
          value: parseFloat(m.value),
        }))
    : [];

  const getMetricLabel = (metric: ClientMetric) => {
    if (metric.metricType === "custom") return metric.customLabel || "Custom";
    return METRIC_TYPE_LABELS[metric.metricType]?.label ?? metric.metricType;
  };

  const beforeAfterByType: Record<string, { first: ClientMetric; last: ClientMetric }> = {};
  for (const type of metricTypes) {
    const ofType = metrics.filter(m => m.metricType === type).slice().sort(
      (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );
    if (ofType.length >= 2) {
      beforeAfterByType[type] = { first: ofType[0], last: ofType[ofType.length - 1] };
    }
  }

  return (
    <div className="space-y-4" data-testid="panel-outcomes">
      {!readonly && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LineChartIcon className="w-4 h-4 text-zinc-400" />
            <h3 className="text-sm font-semibold text-zinc-900">Outcomes</h3>
          </div>
          <button
            type="button"
            onClick={() => setShowAddForm(v => !v)}
            className="flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-900 transition-colors"
            data-testid="button-log-metric"
          >
            <Plus className="w-3.5 h-3.5" />
            Log Entry
          </button>
        </div>
      )}

      {readonly && (
        <div className="flex items-center gap-2 mb-2">
          <LineChartIcon className="w-4 h-4 text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-900">My Progress</h3>
        </div>
      )}

      {!readonly && showAddForm && (
        <div className="border border-zinc-200 rounded-xl p-4 space-y-3 bg-zinc-50" data-testid="form-log-metric">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">Metric</label>
              <select
                value={selectedMetricType}
                onChange={e => {
                  setSelectedMetricType(e.target.value);
                  const info = METRIC_TYPE_LABELS[e.target.value];
                  setNewEntry(prev => ({ ...prev, unit: info?.defaultUnit || "" }));
                }}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none bg-white"
                data-testid="select-metric-type"
              >
                {Object.entries(METRIC_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            {selectedMetricType === "custom" && (
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Custom Label</label>
                <input
                  type="text"
                  value={newEntry.customLabel}
                  onChange={e => setNewEntry(prev => ({ ...prev, customLabel: e.target.value }))}
                  placeholder="e.g. Resting Heart Rate"
                  maxLength={100}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                  data-testid="input-metric-custom-label"
                />
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">Value</label>
              <input
                type="number"
                value={newEntry.value}
                onChange={e => setNewEntry(prev => ({ ...prev, value: e.target.value }))}
                placeholder="0"
                step="any"
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                data-testid="input-metric-value"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">Unit</label>
              <input
                type="text"
                value={newEntry.unit}
                onChange={e => setNewEntry(prev => ({ ...prev, unit: e.target.value }))}
                placeholder="kg"
                maxLength={50}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                data-testid="input-metric-unit"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">Date</label>
              <input
                type="date"
                value={newEntry.recordedAt}
                onChange={e => setNewEntry(prev => ({ ...prev, recordedAt: e.target.value }))}
                max={new Date().toISOString().split("T")[0]}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                data-testid="input-metric-date"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-500 block mb-1">Notes (optional)</label>
            <input
              type="text"
              value={newEntry.notes}
              onChange={e => setNewEntry(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="e.g. Fasted, morning reading"
              maxLength={500}
              className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
              data-testid="input-metric-notes"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!newEntry.value.trim() || createMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 text-white text-sm rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-colors"
              data-testid="button-save-metric"
            >
              {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Log Entry
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 border border-zinc-200 text-sm rounded-xl text-zinc-600 hover:bg-zinc-50 transition-colors"
              data-testid="button-cancel-metric"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>
      ) : metrics.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-2xl border border-zinc-100">
          <LineChartIcon className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
          <p className="text-sm text-zinc-400" data-testid="state-no-metrics">
            {readonly ? "No metrics recorded yet" : "No metric entries yet — log the first measurement"}
          </p>
        </div>
      ) : (
        <>
          {Object.keys(beforeAfterByType).length > 0 && (
            <div className="bg-white rounded-2xl border border-zinc-100 p-4" data-testid="section-before-after">
              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Before / After Summary</h4>
              <div className="space-y-3">
                {Object.entries(beforeAfterByType).map(([type, { first, last }]) => {
                  const delta = parseFloat(last.value) - parseFloat(first.value);
                  const isPositive = delta > 0;
                  const label = type === "custom" ? (first.customLabel || "Custom") : (METRIC_TYPE_LABELS[type]?.label ?? type);
                  const unit = last.unit || "";
                  return (
                    <div key={type} className="flex items-center gap-4" data-testid={`before-after-${type}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-zinc-700">{label}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-zinc-400">
                            {parseFloat(first.value)}{unit} → {parseFloat(last.value)}{unit}
                          </span>
                        </div>
                      </div>
                      <div className={`flex items-center gap-1 text-sm font-bold ${delta === 0 ? "text-zinc-400" : isPositive ? "text-rose-600" : "text-emerald-600"}`}>
                        {delta === 0 ? <Minus className="w-3.5 h-3.5" /> : isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        {isPositive ? "+" : ""}{delta.toFixed(1)}{unit}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {metricTypes.length > 1 && (
            <div className="flex gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedMetricFilter("all")}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${selectedMetricFilter === "all" ? "bg-zinc-900 text-white" : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}
                data-testid="filter-metric-all"
              >
                All
              </button>
              {metricTypes.map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSelectedMetricFilter(type)}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${selectedMetricFilter === type ? "bg-zinc-900 text-white" : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}
                  data-testid={`filter-metric-${type}`}
                >
                  {type === "custom" ? "Custom" : METRIC_TYPE_LABELS[type]?.label ?? type}
                </button>
              ))}
            </div>
          )}

          {chartMetrics.length >= 2 && (
            <div className="bg-white rounded-2xl border border-zinc-100 p-4" data-testid="chart-metric-trend">
              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">
                Trend — {selectedMetricFilter !== "all" ? (METRIC_TYPE_LABELS[selectedMetricFilter]?.label ?? selectedMetricFilter) : ""}
              </h4>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={chartMetrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#a1a1aa" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#a1a1aa" }} tickLine={false} axisLine={false} width={40} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e4e4e7" }} />
                  <Line type="monotone" dataKey="value" stroke="#18181b" strokeWidth={2} dot={{ fill: "#18181b", r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden" data-testid="table-metrics">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50">
                    <th className="text-left px-4 py-2.5 font-medium text-zinc-500">Date</th>
                    <th className="text-left px-3 py-2.5 font-medium text-zinc-500">Metric</th>
                    <th className="text-right px-3 py-2.5 font-medium text-zinc-500">Value</th>
                    <th className="text-left px-3 py-2.5 font-medium text-zinc-500 hidden sm:table-cell">Notes</th>
                    {!readonly && <th className="px-4 py-2.5" />}
                  </tr>
                </thead>
                <tbody>
                  {filteredMetrics.map((metric, i) => (
                    <tr key={metric.id} className={`border-b border-zinc-50 ${i % 2 === 0 ? "" : "bg-zinc-50/50"}`} data-testid={`metric-row-${metric.id}`}>
                      <td className="px-4 py-2.5 text-zinc-600 font-medium whitespace-nowrap">
                        {new Date(metric.recordedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-3 py-2.5 text-zinc-700">{getMetricLabel(metric)}</td>
                      <td className="px-3 py-2.5 text-right text-zinc-900 font-semibold whitespace-nowrap">
                        {parseFloat(metric.value)}{metric.unit ? ` ${metric.unit}` : ""}
                      </td>
                      <td className="px-3 py-2.5 text-zinc-400 hidden sm:table-cell">{metric.notes || "—"}</td>
                      {!readonly && (
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => deleteMutation.mutate(metric.id)}
                            disabled={deleteMutation.isPending}
                            className="p-1 text-zinc-300 hover:text-red-600 transition-colors"
                            data-testid={`button-delete-metric-${metric.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
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

interface FoodDiaryEntry {
  id: number;
  mealName: string;
  foodName: string;
  quantity: string;
  unit: string;
  mealSlot: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number | null;
}

interface FoodDiaryData {
  date: string;
  grouped: Record<string, FoodDiaryEntry[]>;
  totals: { calories: number; protein: number; carbs: number; fat: number; fibre: number };
  targets: { calories: number; protein: number; carbs: number; fat: number; fibre: number | null } | null;
}

const MEAL_SLOT_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snacks: "Snacks",
};

function FoodDiaryTab({ clientId }: { clientId: number }) {
  const [currentDate, setCurrentDate] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  const { data, isLoading } = useQuery<FoodDiaryData>({
    queryKey: ["/api/nutritionist/clients", clientId, "food-diary", currentDate],
    queryFn: () =>
      apiRequest("GET", `/api/nutritionist/clients/${clientId}/food-diary?date=${currentDate}`).then(r => r.json()),
  });

  function shiftDate(delta: number) {
    const d = new Date(currentDate + "T00:00:00");
    d.setDate(d.getDate() + delta);
    setCurrentDate(d.toISOString().split("T")[0]);
  }

  const formattedDate = new Date(currentDate + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const isToday = currentDate === new Date().toISOString().split("T")[0];
  const totalEntries = data
    ? Object.values(data.grouped).reduce((sum, arr) => sum + arr.length, 0)
    : 0;

  return (
    <div>
      <div className="bg-white rounded-2xl border border-zinc-100 p-4 mb-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => shiftDate(-1)}
            className="p-2 border border-zinc-200 rounded-xl text-zinc-600 hover:bg-zinc-50 transition-colors"
            data-testid="button-diary-prev-day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold text-zinc-900" data-testid="text-diary-date">{formattedDate}</p>
            {isToday && <p className="text-xs text-zinc-400">Today</p>}
          </div>
          <button
            type="button"
            onClick={() => shiftDate(1)}
            disabled={isToday}
            className="p-2 border border-zinc-200 rounded-xl text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            data-testid="button-diary-next-day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
        </div>
      ) : !data || totalEntries === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-100 p-12 text-center" data-testid="state-diary-empty">
          <BookOpen className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-zinc-600 mb-1">No entries logged for this day</p>
          <p className="text-xs text-zinc-400">The client hasn't logged any food on this date.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(data.grouped)
            .filter(([, entries]) => entries.length > 0)
            .map(([slot, entries]) => (
              <div key={slot} className="bg-white rounded-2xl border border-zinc-100 overflow-hidden" data-testid={`diary-section-${slot}`}>
                <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-100">
                  <h3 className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">{MEAL_SLOT_LABELS[slot] ?? slot}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-zinc-100">
                        <th className="text-left px-4 py-2 font-medium text-zinc-500">Food</th>
                        <th className="text-left px-3 py-2 font-medium text-zinc-500 hidden sm:table-cell">Portion</th>
                        <th className="text-right px-3 py-2 font-medium text-zinc-500">kcal</th>
                        <th className="text-right px-3 py-2 font-medium text-zinc-500 hidden sm:table-cell">Protein</th>
                        <th className="text-right px-3 py-2 font-medium text-zinc-500 hidden sm:table-cell">Carbs</th>
                        <th className="text-right px-3 py-2 font-medium text-zinc-500 hidden sm:table-cell">Fat</th>
                        <th className="text-right px-4 py-2 font-medium text-zinc-500 hidden md:table-cell">Fibre</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry, i) => (
                        <tr
                          key={entry.id}
                          className={`border-b border-zinc-50 ${i % 2 === 0 ? "" : "bg-zinc-50/50"}`}
                          data-testid={`diary-entry-${entry.id}`}
                        >
                          <td className="px-4 py-2.5 text-zinc-800 font-medium">{entry.foodName}</td>
                          <td className="px-3 py-2.5 text-zinc-500 hidden sm:table-cell">
                            {entry.quantity} {entry.unit}
                          </td>
                          <td className="px-3 py-2.5 text-right text-zinc-700">{entry.calories}</td>
                          <td className="px-3 py-2.5 text-right text-zinc-500 hidden sm:table-cell">{entry.protein}g</td>
                          <td className="px-3 py-2.5 text-right text-zinc-500 hidden sm:table-cell">{entry.carbs}g</td>
                          <td className="px-3 py-2.5 text-right text-zinc-500 hidden sm:table-cell">{entry.fat}g</td>
                          <td className="px-4 py-2.5 text-right text-zinc-500 hidden md:table-cell">
                            {entry.fibre != null ? `${entry.fibre}g` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

          <div className="bg-zinc-900 rounded-2xl p-4" data-testid="diary-daily-summary">
            <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Daily Totals</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Calories", value: data.totals.calories, target: data.targets?.calories, unit: "kcal" },
                { label: "Protein", value: data.totals.protein, target: data.targets?.protein, unit: "g" },
                { label: "Carbs", value: data.totals.carbs, target: data.targets?.carbs, unit: "g" },
                { label: "Fat", value: data.totals.fat, target: data.targets?.fat, unit: "g" },
              ].map(item => {
                const pct = item.target ? Math.round((item.value / item.target) * 100) : null;
                const color = pct === null ? "text-white" : pct > 115 ? "text-red-400" : pct >= 85 ? "text-emerald-400" : "text-amber-400";
                return (
                  <div key={item.label} className="text-center" data-testid={`diary-total-${item.label.toLowerCase()}`}>
                    <p className={`text-lg font-bold ${color}`}>
                      {item.value}
                      <span className="text-xs font-normal text-zinc-500 ml-0.5">{item.unit}</span>
                    </p>
                    {item.target ? (
                      <p className="text-xs text-zinc-500 mt-0.5">of {item.target} target</p>
                    ) : (
                      <p className="text-xs text-zinc-500 mt-0.5">No target</p>
                    )}
                    <p className="text-[10px] text-zinc-400">{item.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ClientDocument {
  id: number;
  nutritionistId: number;
  clientId: number;
  uploaderId: number;
  uploaderName: string;
  uploaderEmail: string;
  filename: string;
  storagePath: string;
  mimeType: string;
  size: number;
  sharedWithClient: boolean;
  createdAt: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentVaultPanel({ clientRecord }: { clientRecord: ClientWithUser }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [shareOnUpload, setShareOnUpload] = useState(false);

  const { data: documents = [], isLoading } = useQuery<ClientDocument[]>({
    queryKey: ["/api/nutritionist/clients", clientRecord.clientId, "documents"],
    queryFn: () => apiRequest("GET", `/api/nutritionist/clients/${clientRecord.clientId}/documents`).then(r => r.json()),
  });

  const toggleSharingMutation = useMutation({
    mutationFn: ({ id, sharedWithClient }: { id: number; sharedWithClient: boolean }) =>
      apiRequest("PATCH", `/api/nutritionist/clients/${clientRecord.clientId}/documents/${id}/sharing`, { sharedWithClient }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/clients", clientRecord.clientId, "documents"] });
    },
    onError: () => toast({ title: "Failed to update sharing", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/nutritionist/clients/${clientRecord.clientId}/documents/${id}`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/clients", clientRecord.clientId, "documents"] });
      toast({ title: "Document deleted" });
    },
    onError: () => toast({ title: "Failed to delete document", variant: "destructive" }),
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("sharedWithClient", shareOnUpload ? "true" : "false");

    try {
      const res = await fetch(`/api/nutritionist/clients/${clientRecord.clientId}/documents`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(err.message);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/clients", clientRecord.clientId, "documents"] });
      toast({ title: "Document uploaded" });
    } catch (err: unknown) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownload = (doc: ClientDocument) => {
    window.open(`/api/nutritionist/clients/${clientRecord.clientId}/documents/${doc.id}/download`, "_blank");
  };

  return (
    <div className="bg-white rounded-2xl border border-zinc-100 p-6 mb-4" data-testid="panel-document-vault">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-900">Document Vault</h3>
          {documents.length > 0 && (
            <span className="text-xs text-zinc-400">{documents.length} file{documents.length !== 1 ? "s" : ""}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-zinc-500 cursor-pointer select-none" data-testid="toggle-share-on-upload">
            <input
              type="checkbox"
              checked={shareOnUpload}
              onChange={e => setShareOnUpload(e.target.checked)}
              className="rounded"
            />
            Share on upload
          </label>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 text-white text-xs font-medium rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            data-testid="button-upload-document"
          >
            {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            Upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv"
            onChange={handleFileChange}
            data-testid="input-file-upload"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-zinc-400" /></div>
      ) : documents.length === 0 ? (
        <div className="text-center py-8">
          <FolderOpen className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-zinc-500 mb-1" data-testid="state-no-documents">No documents yet</p>
          <p className="text-xs text-zinc-400">Upload lab results, handouts, or other files for this client.</p>
        </div>
      ) : (
        <div className="space-y-2" data-testid="document-list">
          {documents.map(doc => (
            <div
              key={doc.id}
              className="flex items-center gap-3 p-3 border border-zinc-100 rounded-xl hover:bg-zinc-50 transition-colors"
              data-testid={`document-${doc.id}`}
            >
              <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-zinc-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-900 truncate" data-testid={`doc-filename-${doc.id}`}>{doc.filename}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-zinc-400">{formatFileSize(doc.size)}</span>
                  <span className="text-zinc-300">·</span>
                  <span className="text-xs text-zinc-400">{formatDate(doc.createdAt)}</span>
                  <span className="text-zinc-300">·</span>
                  <span className="text-xs text-zinc-400" data-testid={`doc-uploader-${doc.id}`}>{doc.uploaderName}</span>
                  {doc.sharedWithClient && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-full" data-testid={`badge-shared-${doc.id}`}>
                      Shared
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => toggleSharingMutation.mutate({ id: doc.id, sharedWithClient: !doc.sharedWithClient })}
                  disabled={toggleSharingMutation.isPending}
                  className={`p-1.5 rounded-lg transition-colors ${doc.sharedWithClient ? "text-blue-600 hover:text-blue-800 hover:bg-blue-50" : "text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100"}`}
                  title={doc.sharedWithClient ? "Unshare from client" : "Share with client"}
                  data-testid={`button-toggle-share-${doc.id}`}
                >
                  {doc.sharedWithClient ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload(doc)}
                  className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
                  title="Download"
                  data-testid={`button-download-doc-${doc.id}`}
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(doc.id)}
                  disabled={deleteMutation.isPending}
                  className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete"
                  data-testid={`button-delete-doc-${doc.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
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
  const [activeSection, setActiveSection] = useState<"profile" | "messages" | "food-diary" | "outcomes" | "documents">("profile");

  const { data: profileData, isLoading: profileLoading } = useQuery<ClientProfileData>({
    queryKey: ["/api/nutritionist/clients", clientRecord.clientId, "profile"],
    queryFn: () => apiRequest("GET", `/api/nutritionist/clients/${clientRecord.clientId}/profile`).then(r => r.json()),
  });

  const { data: notes = [], isLoading: notesLoading } = useQuery<Note[]>({
    queryKey: ["/api/nutritionist/clients", clientRecord.clientId, "notes"],
    queryFn: () => apiRequest("GET", `/api/nutritionist/clients/${clientRecord.clientId}/notes`).then(r => r.json()),
  });

  const { data: adherenceData7d } = useQuery<AdherenceData>({
    queryKey: ["/api/nutritionist/monitoring/clients", clientRecord.clientId, "adherence", 7],
    queryFn: () => apiRequest("GET", `/api/nutritionist/monitoring/clients/${clientRecord.clientId}/adherence?days=7`).then(r => r.json()),
  });

  const streakDays = adherenceData7d
    ? adherenceData7d.dailyBreakdown.filter(d => d.logged).length
    : null;

  const [newNote, setNewNote] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editNoteText, setEditNoteText] = useState("");
  const [editingStatus, setEditingStatus] = useState(clientRecord.status);
  const [editingGoal, setEditingGoal] = useState(clientRecord.goalSummary ?? "");
  const [editingHealthNotes, setEditingHealthNotes] = useState(clientRecord.healthNotes ?? "");
  const [editingReferralSource, setEditingReferralSource] = useState(clientRecord.referralSource ?? "");
  const [editingReferredByClientId, setEditingReferredByClientId] = useState(clientRecord.referredByClientId?.toString() ?? "");
  const [editMode, setEditMode] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);

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
    mutationFn: (updates: { status?: string; goalSummary?: string; healthNotes?: string; referralSource?: string | null; referredByClientId?: number | null }) =>
      apiRequest("PUT", `/api/nutritionist/clients/${clientRecord.id}`, updates).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/referrals/summary"] });
      setEditMode(false);
      toast({ title: "Client updated" });
    },
    onError: () => toast({ title: "Failed to update client", variant: "destructive" }),
  });

  const { data: allClients = [] } = useQuery<ClientWithUser[]>({
    queryKey: ["/api/nutritionist/clients"],
    queryFn: () => apiRequest("GET", "/api/nutritionist/clients").then(r => r.json()),
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
              onClick={() => setShowReportDialog(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 rounded-xl text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
              data-testid="button-generate-report"
            >
              <FileText className="w-3.5 h-3.5" />
              Report
            </button>
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
              onClick={() => { setEditMode(v => !v); setEditingStatus(clientRecord.status); setEditingGoal(clientRecord.goalSummary ?? ""); setEditingHealthNotes(clientRecord.healthNotes ?? ""); setEditingReferralSource(clientRecord.referralSource ?? ""); setEditingReferredByClientId(clientRecord.referredByClientId?.toString() ?? ""); }}
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
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">Referral Source</label>
              <select
                value={editingReferralSource}
                onChange={e => { setEditingReferralSource(e.target.value); setEditingReferredByClientId(""); }}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20 text-zinc-700 bg-white"
                data-testid="select-client-referral-source"
              >
                <option value="">— No referral source —</option>
                <option value="client">Existing Client</option>
                <option value="social_media">Social Media</option>
                <option value="website">Website</option>
                <option value="other">Other</option>
              </select>
            </div>
            {editingReferralSource === "client" && (
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Referred by (client)</label>
                <select
                  value={editingReferredByClientId}
                  onChange={e => setEditingReferredByClientId(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20 text-zinc-700 bg-white"
                  data-testid="select-client-referred-by"
                >
                  <option value="">— Select a client —</option>
                  {allClients.filter(c => c.clientId !== clientRecord.clientId).map(c => (
                    <option key={c.clientId} value={c.clientId}>{c.client.name} ({c.client.email})</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => updateClientMutation.mutate({
                  status: editingStatus,
                  goalSummary: editingGoal,
                  healthNotes: editingHealthNotes,
                  referralSource: editingReferralSource || null,
                  referredByClientId: editingReferralSource === "client" && editingReferredByClientId ? Number(editingReferredByClientId) : null,
                })}
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
            {clientRecord.referralSource && (
              <span className="text-zinc-400 flex items-center gap-1" data-testid="text-referral-source">
                Via {REFERRAL_SOURCE_LABELS[clientRecord.referralSource] ?? clientRecord.referralSource}
                {clientRecord.referralSource === "client" && clientRecord.referredByClientId && (() => {
                  const referrer = allClients.find(c => c.clientId === clientRecord.referredByClientId);
                  return referrer ? ` (${referrer.client.name})` : null;
                })()}
              </span>
            )}
          </div>
        )}
        <ClientTagPicker clientId={clientRecord.clientId} />
      </div>

      <div className="flex gap-1 mb-4 flex-wrap">
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
          onClick={() => setActiveSection("food-diary")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeSection === "food-diary" ? "bg-zinc-900 text-white" : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}
          data-testid="tab-client-food-diary"
        >
          <BookOpen className="w-3.5 h-3.5" />
          My Diary
          {streakDays !== null && (
            <span className={`ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${activeSection === "food-diary" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700"}`}>
              {streakDays}/7 days
            </span>
          )}
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
        <button
          type="button"
          onClick={() => setActiveSection("outcomes")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeSection === "outcomes" ? "bg-zinc-900 text-white" : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}
          data-testid="tab-client-outcomes"
        >
          <LineChartIcon className="w-3.5 h-3.5" />
          Outcomes
        </button>
        <button
          type="button"
          onClick={() => setActiveSection("documents")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${activeSection === "documents" ? "bg-zinc-900 text-white" : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}
          data-testid="tab-client-documents"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          Documents
        </button>
      </div>

      {activeSection === "documents" && (
        <DocumentVaultPanel clientRecord={clientRecord} />
      )}

      {activeSection === "messages" && user && (
        <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden">
          <MessageThread clientId={clientRecord.clientId} currentUserId={user.id} />
        </div>
      )}

      {activeSection === "food-diary" && (
        <FoodDiaryTab clientId={clientRecord.clientId} />
      )}

      {activeSection === "outcomes" && (
        <div className="bg-white rounded-2xl border border-zinc-100 p-6">
          <OutcomesPanel clientRecord={clientRecord} />
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

      <div className="bg-white rounded-2xl border border-zinc-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-4 h-4 text-zinc-400" />
          <h3 className="text-sm font-semibold text-zinc-900">Progress Reports</h3>
        </div>
        <ReportHistoryPanel clientId={clientRecord.clientId} />
      </div>
        </>
      )}

      {showReportDialog && (
        <GenerateReportDialog
          clientId={clientRecord.clientId}
          clientName={clientRecord.client.name}
          onClose={() => setShowReportDialog(false)}
        />
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

  const { data: capacityStats = [] } = useQuery<{ nutritionistId: number; activeCount: number; maxClients: number | null }[]>({
    queryKey: ["/api/practice", practice?.id, "capacity"],
    queryFn: () => apiRequest("GET", `/api/practice/${practice!.id}/capacity`).then(r => r.json()),
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
              const capStat = capacityStats.find(s => s.nutritionistId === member.nutritionistUserId);
              return (
                <div key={member.id} className="border border-zinc-100 rounded-xl" data-testid={`member-${member.nutritionistUserId}`}>
                  <div className="flex items-center gap-3 p-3">
                    <div className="w-8 h-8 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-600 text-sm font-bold flex-shrink-0">
                      {member.nutritionist.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-900">{member.nutritionist.name}</p>
                      <p className="text-xs text-zinc-400">{member.nutritionist.email} · {clientCount} client{clientCount !== 1 ? "s" : ""}</p>
                      {capStat && capStat.maxClients !== null && (
                        <div className="mt-1.5">
                          <CapacityBar count={capStat.activeCount} max={capStat.maxClients} />
                        </div>
                      )}
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

function ReferralsSummaryView({
  clients,
  onSelectClient,
}: {
  clients: ClientWithUser[];
  onSelectClient: (c: ClientWithUser) => void;
}) {
  const { data: summary, isLoading } = useQuery<ReferralSummary>({
    queryKey: ["/api/nutritionist/referrals/summary"],
    queryFn: () => apiRequest("GET", "/api/nutritionist/referrals/summary").then(r => r.json()),
  });

  const clientsByReferrer = new Map<number, ClientWithUser[]>();
  for (const c of clients) {
    if (c.referredByClientId) {
      if (!clientsByReferrer.has(c.referredByClientId)) clientsByReferrer.set(c.referredByClientId, []);
      clientsByReferrer.get(c.referredByClientId)!.push(c);
    }
  }

  const referredClients = clients.filter(c => c.referralSource);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-display font-bold text-zinc-900 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-zinc-500" />
            Referrals
          </h2>
          <p className="text-sm text-zinc-500 mt-0.5">Track how clients discovered your practice</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>
      ) : (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl border border-zinc-100 p-5" data-testid="card-total-referred">
              <p className="text-xs text-zinc-500 mb-1">Total Referred</p>
              <p className="text-3xl font-bold text-zinc-900">{summary?.totalReferred ?? 0}</p>
            </div>
            <div className="bg-white rounded-2xl border border-zinc-100 p-5" data-testid="card-top-channel">
              <p className="text-xs text-zinc-500 mb-1">Top Channel</p>
              <p className="text-xl font-bold text-zinc-900">
                {summary?.channelBreakdown?.[0]
                  ? REFERRAL_SOURCE_LABELS[summary.channelBreakdown[0].source] ?? summary.channelBreakdown[0].source
                  : "—"}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-zinc-100 p-5" data-testid="card-top-referrers-count">
              <p className="text-xs text-zinc-500 mb-1">Top Referrers</p>
              <p className="text-3xl font-bold text-zinc-900">{summary?.topReferrers?.length ?? 0}</p>
            </div>
          </div>

          {(summary?.channelBreakdown?.length ?? 0) > 0 && (
            <div className="bg-white rounded-2xl border border-zinc-100 p-5">
              <h3 className="text-sm font-semibold text-zinc-900 mb-4">Acquisition Channels</h3>
              <div className="space-y-3">
                {summary!.channelBreakdown.map(({ source, count }) => {
                  const pct = summary!.totalReferred > 0 ? Math.round((count / summary!.totalReferred) * 100) : 0;
                  return (
                    <div key={source} data-testid={`channel-bar-${source}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-zinc-700">{REFERRAL_SOURCE_LABELS[source] ?? source}</span>
                        <span className="text-sm font-semibold text-zinc-900">{count} <span className="text-xs font-normal text-zinc-400">({pct}%)</span></span>
                      </div>
                      <div className="w-full h-2 bg-zinc-100 rounded-full overflow-hidden">
                        <div className="h-full bg-zinc-800 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(summary?.topReferrers?.length ?? 0) > 0 && (
            <div className="bg-white rounded-2xl border border-zinc-100 p-5">
              <h3 className="text-sm font-semibold text-zinc-900 mb-4">Top Referrers</h3>
              <div className="space-y-2">
                {summary!.topReferrers.map((referrer) => {
                  const referrerClient = clients.find(c => c.clientId === referrer.clientId);
                  const referred = clientsByReferrer.get(referrer.clientId) ?? [];
                  return (
                    <div key={referrer.clientId} className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl" data-testid={`referrer-row-${referrer.clientId}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-zinc-900 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {referrer.clientName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={() => referrerClient && onSelectClient(referrerClient)}
                            className="text-sm font-medium text-zinc-900 hover:underline text-left"
                            disabled={!referrerClient}
                          >
                            {referrer.clientName}
                          </button>
                          {referred.length > 0 && (
                            <p className="text-xs text-zinc-400">
                              Referred: {referred.map(r => r.client.name).join(", ")}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-bold text-zinc-900">{referrer.count} referral{referrer.count !== 1 ? "s" : ""}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-zinc-100 p-5">
            <h3 className="text-sm font-semibold text-zinc-900 mb-4">All Referred Clients</h3>
            {referredClients.length === 0 ? (
              <div className="text-center py-8">
                <UserPlus className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
                <p className="text-sm text-zinc-500">No referrals recorded yet.</p>
                <p className="text-xs text-zinc-400 mt-1">When you invite a client, optionally record how they heard about you.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {referredClients.map(c => {
                  const referrerClient = c.referredByClientId ? clients.find(r => r.clientId === c.referredByClientId) : null;
                  return (
                    <div key={c.id} className="flex items-center justify-between p-3 rounded-xl border border-zinc-100 hover:border-zinc-200 transition-colors" data-testid={`referred-client-${c.id}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-600 text-xs font-bold">
                          {c.client.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={() => onSelectClient(c)}
                            className="text-sm font-medium text-zinc-900 hover:underline text-left"
                          >
                            {c.client.name}
                          </button>
                          <p className="text-xs text-zinc-400">
                            {REFERRAL_SOURCE_LABELS[c.referralSource!] ?? c.referralSource}
                            {referrerClient && ` via ${referrerClient.client.name}`}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs text-zinc-400">{formatDate(c.createdAt)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [referralSource, setReferralSource] = useState<string>("");
  const [referredByClientId, setReferredByClientId] = useState<string>("");

  const { data: clients = [] } = useQuery<ClientWithUser[]>({
    queryKey: ["/api/nutritionist/clients"],
    queryFn: () => apiRequest("GET", "/api/nutritionist/clients").then(r => r.json()),
  });

  const inviteMutation = useMutation({
    mutationFn: ({ email, referralSource, referredByClientId }: { email: string; referralSource?: string; referredByClientId?: number | null }) =>
      apiRequest("POST", "/api/nutritionist/invitations", { email, referralSource: referralSource || undefined, referredByClientId: referredByClientId || undefined }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/invitations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/referrals/summary"] });
      toast({
        title: "Invitation created",
        description: `Invite link generated for ${email}. Share the link with your client.`,
      });
      setEmail("");
      setReferralSource("");
      setReferredByClientId("");
    },
    onError: (err: Error) => {
      toast({ title: "Failed to create invitation", description: err.message, variant: "destructive" });
    },
  });

  const { data: invitations = [] } = useQuery<Invitation[]>({
    queryKey: ["/api/nutritionist/invitations"],
    queryFn: () => apiRequest("GET", "/api/nutritionist/invitations").then(r => r.json()),
  });

  const baseUrl = window.location.origin;

  const handleGenerate = () => {
    if (!email) return;
    inviteMutation.mutate({
      email,
      referralSource: referralSource || undefined,
      referredByClientId: referralSource === "client" && referredByClientId ? Number(referredByClientId) : null,
    });
  };

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

          <div className="space-y-3 mb-5">
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="client@example.com"
                className="flex-1 px-3 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                data-testid="input-invite-email"
                onKeyDown={e => e.key === "Enter" && email && handleGenerate()}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">Referral source (optional)</label>
              <select
                value={referralSource}
                onChange={e => { setReferralSource(e.target.value); setReferredByClientId(""); }}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20 text-zinc-700 bg-white"
                data-testid="select-invite-referral-source"
              >
                <option value="">— No referral source —</option>
                <option value="client">Existing Client</option>
                <option value="social_media">Social Media</option>
                <option value="website">Website</option>
                <option value="other">Other</option>
              </select>
            </div>
            {referralSource === "client" && (
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Referred by (client)</label>
                <select
                  value={referredByClientId}
                  onChange={e => setReferredByClientId(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20 text-zinc-700 bg-white"
                  data-testid="select-invite-referred-by"
                >
                  <option value="">— Select a client —</option>
                  {clients.map(c => (
                    <option key={c.clientId} value={c.clientId}>{c.client.name} ({c.client.email})</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={!email || inviteMutation.isPending}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-colors mb-6"
            data-testid="button-generate-invite"
          >
            {inviteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
            Generate Link
          </button>

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

const DEFAULT_MESSAGES: ReengagementMessage[] = [
  { delayDays: 0, body: "Hi! I noticed you haven't logged your meals in a few days. How are you getting on? I'm here if you need any support or adjustments to your plan." },
  { delayDays: 4, body: "Just checking in again — it can be tough to stay consistent, but even small steps count. Would it help to review your meal plan together? Don't hesitate to reach out." },
  { delayDays: 7, body: "It's been a couple of weeks since your last log. Your health journey matters — let's reconnect when you're ready. I'm available any time to help you get back on track." },
];

function ReengagementManager({ clients }: { clients: ClientWithUser[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingSeq, setEditingSeq] = useState<ReengagementSequence | null>(null);
  const [showNewSeq, setShowNewSeq] = useState(false);

  const { data: sequences = [], isLoading: seqLoading } = useQuery<ReengagementSequence[]>({
    queryKey: ["/api/nutritionist/reengagement/sequences"],
    queryFn: () => apiRequest("GET", "/api/nutritionist/reengagement/sequences").then(r => r.json()),
  });

  const { data: jobs = [], isLoading: jobsLoading } = useQuery<ActiveReengagementJob[]>({
    queryKey: ["/api/nutritionist/reengagement/jobs"],
    queryFn: () => apiRequest("GET", "/api/nutritionist/reengagement/jobs").then(r => r.json()),
  });

  const deleteSeqMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/nutritionist/reengagement/sequences/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/reengagement/sequences"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/reengagement/jobs"] });
      toast({ title: "Sequence deleted" });
    },
  });

  const cancelJobMutation = useMutation({
    mutationFn: ({ clientId }: { clientId: number }) =>
      apiRequest("POST", `/api/nutritionist/clients/${clientId}/reengagement/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/reengagement/jobs"] });
      toast({ title: "Sequence cancelled" });
    },
  });

  const pauseJobMutation = useMutation({
    mutationFn: ({ clientId }: { clientId: number }) =>
      apiRequest("POST", `/api/nutritionist/clients/${clientId}/reengagement/pause`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/reengagement/jobs"] });
      toast({ title: "Sequence paused" });
    },
  });

  const resumeJobMutation = useMutation({
    mutationFn: ({ clientId }: { clientId: number }) =>
      apiRequest("POST", `/api/nutritionist/clients/${clientId}/reengagement/resume`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/reengagement/jobs"] });
      toast({ title: "Sequence resumed" });
    },
  });

  const startJobMutation = useMutation({
    mutationFn: ({ clientId, sequenceId }: { clientId: number; sequenceId: number }) =>
      apiRequest("POST", `/api/nutritionist/clients/${clientId}/reengagement/start`, { sequenceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/reengagement/jobs"] });
      toast({ title: "Sequence started" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to start sequence", description: err.message, variant: "destructive" });
    },
  });

  const activeJobs = jobs.filter(j => j.status === "active" || j.status === "paused");
  const clientMap = new Map(clients.map(c => [c.clientId, c]));

  if (seqLoading || jobsLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-display font-bold text-zinc-900 flex items-center gap-2">
              <Zap className="w-5 h-5 text-zinc-500" />
              Re-engagement Sequences
            </h2>
            <p className="text-sm text-zinc-500 mt-0.5">Pre-written message chains that send automatically when clients go inactive</p>
          </div>
          <button
            type="button"
            onClick={() => setShowNewSeq(true)}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 transition-colors"
            data-testid="button-new-sequence"
          >
            <Plus className="w-4 h-4" />
            New Sequence
          </button>
        </div>

        {sequences.length === 0 && !showNewSeq ? (
          <div className="bg-white rounded-2xl border border-zinc-100 p-12 text-center">
            <Zap className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-zinc-600 mb-1">No sequences yet</p>
            <p className="text-xs text-zinc-400 mb-4">Create a message sequence to automatically re-engage inactive clients</p>
            <button
              type="button"
              onClick={() => setShowNewSeq(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 transition-colors"
              data-testid="button-create-first-sequence"
            >
              <Plus className="w-4 h-4" />
              Create Your First Sequence
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {sequences.map(seq => (
              <div key={seq.id} className="bg-white rounded-2xl border border-zinc-100 p-4" data-testid={`card-sequence-${seq.id}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-zinc-900">{seq.name}</span>
                      {seq.isDefault && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-zinc-900 text-white">Default</span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500">
                      Triggers after <strong>{seq.triggerAfterDays}</strong> days of inactivity ·{" "}
                      <strong>{seq.messages.length}</strong> message{seq.messages.length !== 1 ? "s" : ""}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {seq.messages.map((m, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-50 border border-zinc-100 text-zinc-500">
                          Day {seq.messages.slice(0, i).reduce((sum, msg) => sum + msg.delayDays, 0) + m.delayDays}: {m.body.slice(0, 40)}…
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setEditingSeq(seq)}
                      className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
                      data-testid={`button-edit-sequence-${seq.id}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Delete this sequence? Any active jobs using it will be cancelled.")) {
                          deleteSeqMutation.mutate(seq.id);
                        }
                      }}
                      className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      data-testid={`button-delete-sequence-${seq.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {(showNewSeq || editingSeq) && (
          <SequenceForm
            sequence={editingSeq ?? undefined}
            clients={clients}
            onClose={() => { setShowNewSeq(false); setEditingSeq(null); }}
          />
        )}
      </div>

      <div>
        <h3 className="text-base font-semibold text-zinc-900 mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-zinc-500" />
          Active Sequences
        </h3>

        {activeJobs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-zinc-100 p-8 text-center">
            <p className="text-sm text-zinc-400">No active sequences running</p>
            {sequences.length > 0 && clients.length > 0 && (
              <p className="text-xs text-zinc-400 mt-1">Start a sequence from a client profile or use the form below</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {activeJobs.map(job => {
              const client = clientMap.get(job.clientId);
              const totalSteps = job.sequence.messages.length;
              const isActive = job.status === "active";
              return (
                <div key={job.id} className="bg-white rounded-2xl border border-zinc-100 p-4 flex items-center gap-4" data-testid={`card-job-${job.id}`}>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${isActive ? "bg-zinc-900" : "bg-zinc-300"}`}>
                    {client?.client.name.charAt(0).toUpperCase() ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-zinc-900">{client?.client.name ?? `Client #${job.clientId}`}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${isActive ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
                        {isActive ? "Active" : "Paused"}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500">
                      {job.sequence.name} · Step {job.currentStep + 1}/{totalSteps} ·{" "}
                      Next: {new Date(job.nextSendAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isActive ? (
                      <button
                        type="button"
                        onClick={() => pauseJobMutation.mutate({ clientId: job.clientId })}
                        disabled={pauseJobMutation.isPending}
                        className="p-1.5 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Pause sequence"
                        data-testid={`button-pause-job-${job.id}`}
                      >
                        <Pause className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => resumeJobMutation.mutate({ clientId: job.clientId })}
                        disabled={resumeJobMutation.isPending}
                        className="p-1.5 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Resume sequence"
                        data-testid={`button-resume-job-${job.id}`}
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Cancel this sequence for this client?")) {
                          cancelJobMutation.mutate({ clientId: job.clientId });
                        }
                      }}
                      disabled={cancelJobMutation.isPending}
                      className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Cancel sequence"
                      data-testid={`button-cancel-job-${job.id}`}
                    >
                      <Ban className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {sequences.length > 0 && clients.length > 0 && (
          <div className="mt-4">
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Start a Sequence for a Client</h4>
            <StartJobForm sequences={sequences} clients={clients} onStart={({ clientId, sequenceId }) => startJobMutation.mutate({ clientId, sequenceId })} isPending={startJobMutation.isPending} />
          </div>
        )}
      </div>
    </div>
  );
}

function SequenceForm({ sequence, clients, onClose }: { sequence?: ReengagementSequence; clients: ClientWithUser[]; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!sequence;

  const [name, setName] = useState(sequence?.name ?? "");
  const [triggerAfterDays, setTriggerAfterDays] = useState(sequence?.triggerAfterDays ?? 3);
  const [isDefault, setIsDefault] = useState(sequence?.isDefault ?? false);
  const [messages, setMessages] = useState<ReengagementMessage[]>(
    sequence?.messages ?? DEFAULT_MESSAGES.map(m => ({ ...m }))
  );

  const saveMutation = useMutation({
    mutationFn: (data: { name: string; triggerAfterDays: number; isDefault: boolean; messages: ReengagementMessage[] }) =>
      isEdit
        ? apiRequest("PUT", `/api/nutritionist/reengagement/sequences/${sequence!.id}`, data)
        : apiRequest("POST", "/api/nutritionist/reengagement/sequences", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/reengagement/sequences"] });
      toast({ title: isEdit ? "Sequence updated" : "Sequence created" });
      onClose();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!name.trim()) return toast({ title: "Name is required", variant: "destructive" });
    if (messages.length === 0) return toast({ title: "At least one message is required", variant: "destructive" });
    for (const m of messages) {
      if (!m.body.trim()) return toast({ title: "All messages must have content", variant: "destructive" });
    }
    saveMutation.mutate({ name: name.trim(), triggerAfterDays, isDefault, messages });
  };

  const addMessage = () => {
    if (messages.length >= 3) return;
    setMessages(ms => [...ms, { delayDays: 7, body: "" }]);
  };

  const removeMessage = (i: number) => {
    setMessages(ms => ms.filter((_, idx) => idx !== i));
  };

  const updateMessage = (i: number, field: keyof ReengagementMessage, value: string | number) => {
    setMessages(ms => ms.map((m, idx) => idx === i ? { ...m, [field]: value } : m));
  };

  return (
    <div className="mt-4 bg-white rounded-2xl border border-zinc-200 p-5" data-testid="form-sequence">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-zinc-900">{isEdit ? "Edit Sequence" : "New Sequence"}</h3>
        <button type="button" onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700" data-testid="button-close-sequence-form">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">Sequence Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. 3-Day Check-in"
            className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
            data-testid="input-sequence-name"
          />
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-zinc-700 mb-1">Trigger after inactivity (days)</label>
            <input
              type="number"
              min={1}
              max={90}
              value={triggerAfterDays}
              onChange={e => setTriggerAfterDays(parseInt(e.target.value) || 3)}
              className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
              data-testid="input-trigger-days"
            />
          </div>
          <div className="flex items-end pb-0.5">
            <label className="flex items-center gap-2 text-sm text-zinc-700 cursor-pointer pb-2.5">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={e => setIsDefault(e.target.checked)}
                className="rounded border-zinc-300"
                data-testid="checkbox-is-default"
              />
              Set as default
            </label>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-xs font-medium text-zinc-700">Messages ({messages.length}/3)</label>
            {messages.length < 3 && (
              <button
                type="button"
                onClick={addMessage}
                className="text-xs text-zinc-500 hover:text-zinc-900 flex items-center gap-1"
                data-testid="button-add-message"
              >
                <Plus className="w-3 h-3" />
                Add message
              </button>
            )}
          </div>
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <div key={i} className="p-3 bg-zinc-50 rounded-xl space-y-2" data-testid={`message-item-${i}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-500">Message {i + 1}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-zinc-500">Send</span>
                      <input
                        type="number"
                        min={0}
                        max={90}
                        value={msg.delayDays}
                        onChange={e => updateMessage(i, "delayDays", parseInt(e.target.value) || 0)}
                        className="w-14 px-2 py-1 border border-zinc-200 rounded-lg text-xs text-center focus:outline-none focus:ring-2 focus:ring-zinc-900/20 bg-white"
                        data-testid={`input-delay-${i}`}
                      />
                      <span className="text-xs text-zinc-500">days after {i === 0 ? "trigger" : "previous"}</span>
                    </div>
                  </div>
                  {messages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMessage(i)}
                      className="p-1 text-zinc-300 hover:text-red-500 transition-colors"
                      data-testid={`button-remove-message-${i}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <textarea
                  value={msg.body}
                  onChange={e => updateMessage(i, "body", e.target.value)}
                  placeholder="Write your message..."
                  rows={3}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-zinc-900/20 bg-white resize-none"
                  data-testid={`textarea-message-${i}`}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-zinc-600 border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-colors"
            data-testid="button-cancel-sequence-form"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saveMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            data-testid="button-save-sequence"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {isEdit ? "Save Changes" : "Create Sequence"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface WaitlistEntry {
  id: number;
  nutritionistId: number;
  name: string;
  email: string;
  notes: string | null;
  position: number;
  status: string;
  invitedAt: string | null;
  addedAt: string | null;
  createdAt: string | null;
}

function WaitlistPanel({ nutritionistId, capacity }: { nutritionistId: number; capacity: Capacity | undefined }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [showCopied, setShowCopied] = useState(false);

  const { data: entries = [], isLoading } = useQuery<WaitlistEntry[]>({
    queryKey: ["/api/nutritionist/waitlist"],
    queryFn: () => apiRequest("GET", "/api/nutritionist/waitlist").then(r => r.json()),
  });

  const addMutation = useMutation({
    mutationFn: (data: { name: string; email: string; notes?: string }) =>
      apiRequest("POST", "/api/nutritionist/waitlist", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/waitlist"] });
      setShowAddForm(false);
      setAddName("");
      setAddEmail("");
      setAddNotes("");
      toast({ title: "Added to waitlist" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to add", description: err?.message ?? "Unknown error", variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/nutritionist/waitlist/${id}`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/waitlist"] });
      toast({ title: "Removed from waitlist" });
    },
    onError: () => {
      toast({ title: "Failed to remove", variant: "destructive" });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("POST", `/api/nutritionist/waitlist/${id}/invite`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/waitlist"] });
      toast({ title: "Invitation sent", description: "An email invitation has been sent to the prospect." });
    },
    onError: (err: any) => {
      toast({ title: "Failed to invite", description: err?.message ?? "Unknown error", variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: number[]) =>
      apiRequest("PUT", "/api/nutritionist/waitlist/reorder", { orderedIds }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/waitlist"] });
    },
  });

  const waitingEntries = entries.filter(e => e.status === "waiting");
  const otherEntries = entries.filter(e => e.status !== "waiting");

  const hasCapacity = capacity && capacity.canAddMore;

  const publicWaitlistUrl = `${window.location.origin}/waitlist/${nutritionistId}`;

  function handleCopyLink() {
    navigator.clipboard.writeText(publicWaitlistUrl).then(() => {
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    });
  }

  function handleDragStart(e: React.DragEvent, id: number) {
    e.dataTransfer.setData("waitlist-id", String(id));
  }

  function handleDrop(e: React.DragEvent, targetId: number) {
    e.preventDefault();
    const draggedId = parseInt(e.dataTransfer.getData("waitlist-id"));
    if (draggedId === targetId) return;
    const ids = waitingEntries.map(e => e.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;
    const newIds = [...ids];
    newIds.splice(from, 1);
    newIds.splice(to, 0, draggedId);
    reorderMutation.mutate(newIds);
    setDragOverId(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-display font-bold text-zinc-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-zinc-500" />
            Waitlist
          </h2>
          <p className="text-sm text-zinc-500 mt-0.5">{waitingEntries.length} prospect{waitingEntries.length !== 1 ? "s" : ""} waiting</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-zinc-200 rounded-xl text-zinc-600 hover:bg-zinc-50 transition-colors"
            data-testid="button-copy-waitlist-link"
          >
            <LinkIcon className="w-4 h-4" />
            {showCopied ? "Copied!" : "Share link"}
          </button>
          <button
            type="button"
            onClick={() => setShowAddForm(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 transition-colors"
            data-testid="button-add-waitlist"
          >
            <Plus className="w-4 h-4" />
            Add prospect
          </button>
        </div>
      </div>

      {hasCapacity && waitingEntries.length > 0 && (
        <div className="mb-4 flex items-start gap-3 p-3 rounded-xl border border-emerald-200 bg-emerald-50" data-testid="banner-capacity-available">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-700">You have capacity available</p>
            <p className="text-xs text-emerald-600 mt-0.5">{capacity.limit - capacity.count} slot{capacity.limit - capacity.count !== 1 ? "s" : ""} open — consider inviting your next prospect.</p>
          </div>
        </div>
      )}

      {showAddForm && (
        <div className="mb-4 bg-white border border-zinc-100 rounded-2xl p-4" data-testid="form-add-waitlist">
          <h3 className="text-sm font-semibold text-zinc-900 mb-3">Add prospect to waitlist</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-zinc-500 mb-1 block">Name *</label>
              <input
                type="text"
                value={addName}
                onChange={e => setAddName(e.target.value)}
                placeholder="Full name"
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                data-testid="input-waitlist-name"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 mb-1 block">Email *</label>
              <input
                type="email"
                value={addEmail}
                onChange={e => setAddEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                data-testid="input-waitlist-email"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 mb-1 block">Notes (optional)</label>
              <textarea
                value={addNotes}
                onChange={e => setAddNotes(e.target.value)}
                placeholder="Any relevant notes about this prospect..."
                rows={2}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20 resize-none"
                data-testid="input-waitlist-notes"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!addName.trim() || !addEmail.trim()) return;
                  addMutation.mutate({ name: addName.trim(), email: addEmail.trim(), notes: addNotes.trim() || undefined });
                }}
                disabled={addMutation.isPending || !addName.trim() || !addEmail.trim()}
                className="px-4 py-2 bg-zinc-900 text-white text-sm rounded-xl font-medium hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                data-testid="button-submit-waitlist"
              >
                {addMutation.isPending ? "Adding..." : "Add to waitlist"}
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-sm border border-zinc-200 rounded-xl text-zinc-600 hover:bg-zinc-50 transition-colors"
                data-testid="button-cancel-waitlist"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>
      ) : waitingEntries.length === 0 && otherEntries.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-100 p-12 text-center">
          <Clock className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-zinc-600 mb-1">No prospects on your waitlist</p>
          <p className="text-xs text-zinc-400">Add a prospect manually or share your sign-up link.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {waitingEntries.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Waiting ({waitingEntries.length})</h3>
              <div className="space-y-2">
                {waitingEntries.map((entry, idx) => (
                  <div
                    key={entry.id}
                    draggable
                    onDragStart={e => handleDragStart(e, entry.id)}
                    onDragOver={e => { e.preventDefault(); setDragOverId(entry.id); }}
                    onDragLeave={() => setDragOverId(null)}
                    onDrop={e => handleDrop(e, entry.id)}
                    className={`bg-white rounded-2xl border p-4 flex items-center gap-3 transition-all ${dragOverId === entry.id ? "border-zinc-400 shadow-sm" : "border-zinc-100"}`}
                    data-testid={`row-waitlist-${entry.id}`}
                  >
                    <div className="cursor-grab text-zinc-300 hover:text-zinc-500 flex-shrink-0" title="Drag to reorder">
                      <MoveVertical className="w-4 h-4" />
                    </div>
                    <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600 text-sm font-bold flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-900">{entry.name}</p>
                      <p className="text-xs text-zinc-500">{entry.email}</p>
                      {entry.notes && <p className="text-xs text-zinc-400 mt-0.5 truncate">{entry.notes}</p>}
                    </div>
                    <div className="text-right flex-shrink-0 hidden sm:block">
                      <p className="text-xs text-zinc-400">{entry.addedAt ? formatDate(entry.addedAt) : "—"}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => inviteMutation.mutate(entry.id)}
                        disabled={inviteMutation.isPending}
                        title="Invite this prospect"
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-lg hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                        data-testid={`button-invite-waitlist-${entry.id}`}
                      >
                        <Mail className="w-3.5 h-3.5" />
                        Invite
                      </button>
                      <button
                        type="button"
                        onClick={() => removeMutation.mutate(entry.id)}
                        disabled={removeMutation.isPending}
                        title="Remove from waitlist"
                        className="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                        data-testid={`button-remove-waitlist-${entry.id}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {otherEntries.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Previously invited / other ({otherEntries.length})</h3>
              <div className="space-y-2">
                {otherEntries.map(entry => {
                  const statusColors: Record<string, string> = {
                    invited: "bg-blue-50 text-blue-700",
                    converted: "bg-emerald-50 text-emerald-700",
                    removed: "bg-zinc-50 text-zinc-500",
                  };
                  return (
                    <div
                      key={entry.id}
                      className="bg-white rounded-2xl border border-zinc-100 p-4 flex items-center gap-3"
                      data-testid={`row-waitlist-other-${entry.id}`}
                    >
                      <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 text-sm font-bold flex-shrink-0">
                        {entry.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-zinc-700">{entry.name}</p>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusColors[entry.status] ?? "bg-zinc-50 text-zinc-500"}`}>
                            {entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400">{entry.email}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => removeMutation.mutate(entry.id)}
                          disabled={removeMutation.isPending}
                          title="Remove record"
                          className="p-1.5 text-zinc-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                          data-testid={`button-remove-waitlist-other-${entry.id}`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StartJobForm({
  sequences,
  clients,
  onStart,
  isPending,
}: {
  sequences: ReengagementSequence[];
  clients: ClientWithUser[];
  onStart: (data: { clientId: number; sequenceId: number }) => void;
  isPending: boolean;
}) {
  const [clientId, setClientId] = useState<number | "">("");
  const [sequenceId, setSequenceId] = useState<number | "">("");

  return (
    <div className="bg-white rounded-2xl border border-zinc-100 p-4" data-testid="form-start-job">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-medium text-zinc-700 mb-1">Client</label>
          <select
            value={clientId}
            onChange={e => setClientId(parseInt(e.target.value) || "")}
            className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none text-zinc-700 bg-white"
            data-testid="select-start-job-client"
          >
            <option value="">Select client…</option>
            {clients.map(c => (
              <option key={c.clientId} value={c.clientId}>{c.client.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs font-medium text-zinc-700 mb-1">Sequence</label>
          <select
            value={sequenceId}
            onChange={e => setSequenceId(parseInt(e.target.value) || "")}
            className="w-full px-3 py-2.5 border border-zinc-200 rounded-xl text-sm focus:outline-none text-zinc-700 bg-white"
            data-testid="select-start-job-sequence"
          >
            <option value="">Select sequence…</option>
            {sequences.map(s => (
              <option key={s.id} value={s.id}>{s.name}{s.isDefault ? " (default)" : ""}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!clientId || !sequenceId) return;
            onStart({ clientId: clientId as number, sequenceId: sequenceId as number });
          }}
          disabled={!clientId || !sequenceId || isPending}
          className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-colors"
          data-testid="button-start-job"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Start
        </button>
      </div>
    </div>
  );
}

type Tab = "monitoring" | "clients" | "pipeline" | "reengagement" | "waitlist" | "referrals" | "segments" | "practice";
type ViewState =
  | { kind: "list" }
  | { kind: "profile"; client: ClientWithUser }
  | { kind: "adherence"; client: ClientWithUser };

export default function NutritionistPortalPage() {
  const [, setLocation] = useLocation();
  const { user, logout, isLoggingOut } = useAuth();
  const [tab, setTab] = useState<Tab>("monitoring");
  const [view, setView] = useState<ViewState>({ kind: "list" });
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

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
    { id: "pipeline", label: "Pipeline", icon: KanbanSquare },
    { id: "reengagement", label: "Re-engage", icon: Zap },
    { id: "waitlist", label: "Waitlist", icon: Clock },
    { id: "referrals", label: "Referrals", icon: UserPlus },
    { id: "segments", label: "Segments", icon: Tags },
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

            {capacity && capacity.maxClients !== null && (
              <div className="hidden sm:flex items-center gap-2 ml-2 px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl" data-testid="header-capacity-indicator">
                <div className="w-20 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${Math.round((capacity.activeCount / capacity.maxClients) * 100) >= 90 ? "bg-red-500" : Math.round((capacity.activeCount / capacity.maxClients) * 100) >= 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                    style={{ width: `${Math.min(100, Math.round((capacity.activeCount / capacity.maxClients) * 100))}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-500 font-medium">{capacity.activeCount}/{capacity.maxClients} active</span>
              </div>
            )}

            <div className="relative ml-2">
              <button
                onClick={() => setShowUserMenu(v => !v)}
                className="flex items-center gap-2 text-sm font-medium text-zinc-700 hover:text-zinc-900 transition-colors"
                data-testid="button-user-menu-pro"
              >
                <div className="w-8 h-8 bg-zinc-900 rounded-full flex items-center justify-center text-white text-xs font-bold">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              </button>

              <AnimatePresence>
                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -8 }}
                      className="absolute right-0 top-10 z-20 bg-white border border-zinc-100 rounded-xl shadow-lg py-1 w-52"
                    >
                      <div className="px-3 py-2.5 border-b border-zinc-100">
                        <p className="text-xs font-semibold text-zinc-900 truncate">{user.name}</p>
                        <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                      </div>
                      <Link
                        href="/account"
                        onClick={() => setShowUserMenu(false)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                        data-testid="link-my-account-pro"
                      >
                        <User className="w-4 h-4 text-zinc-400" />
                        My Account
                      </Link>
                      <Link
                        href="/dashboard"
                        onClick={() => setShowUserMenu(false)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 transition-colors"
                        data-testid="link-personal-dashboard"
                      >
                        <Activity className="w-4 h-4 text-zinc-400" />
                        Personal Dashboard
                      </Link>
                      <button
                        onClick={async () => { setShowUserMenu(false); await logout(); }}
                        disabled={isLoggingOut}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        data-testid="button-logout-pro"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
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

        {tab === "pipeline" && (
          view.kind === "profile" ? (
            <ClientProfile
              clientRecord={view.client}
              onBack={() => setView({ kind: "list" })}
              onViewAdherence={() => setView({ kind: "adherence", client: view.client })}
            />
          ) : view.kind === "adherence" ? (
            <AdherenceView
              clientRecord={view.client}
              onBack={() => setView({ kind: "profile", client: view.client })}
            />
          ) : (
            capacity && (
              <PipelineKanban
                capacity={capacity}
                onSelectClient={(c) => setView({ kind: "profile", client: c })}
              />
            )
          )
        )}

        {tab === "reengagement" && (
          <ReengagementManager clients={clients} />
        )}

        {tab === "waitlist" && (
          <WaitlistPanel nutritionistId={profile.userId} capacity={capacity} />
        )}

        {tab === "referrals" && (
          <ReferralsSummaryView clients={clients} onSelectClient={(c) => { setTab("clients"); setView({ kind: "profile", client: c }); }} />
        )}

        {tab === "segments" && (
          <SegmentsView />
        )}

        {tab === "practice" && (
          <PracticeAdminPanel profile={profile} />
        )}
      </main>

      {showInviteModal && <InviteModal onClose={() => setShowInviteModal(false)} />}
    </div>
  );
}
