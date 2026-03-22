import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Loader2, Plus, Check, Edit2, Trash2, Save, Package, Timer, Clock, Zap,
  Activity, Building2, KanbanSquare, Minus, Tags, User, Users, UserPlus, LogOut,
  Link as LinkIcon, ClipboardList, CheckCircle2, X, PackageCheck,
} from "lucide-react";

interface ClientWithUser {
  id: number; nutritionistId: number; clientId: number; status: string; pipelineStage: string;
  goalSummary: string | null; healthNotes: string | null; lastActivityAt: string | null;
  createdAt: string; referralSource: string | null; referredByClientId: number | null;
  client: { id: number; name: string; email: string; preferences: Record<string, unknown> | null; isManagedClient: boolean; createdAt: string; };
}

interface ServicePackage {
  id: number; nutritionistId: number; name: string; description: string | null;
  sessionCount: number; durationWeeks: number; referencePrice: string | null;
  createdAt: string; updatedAt: string;
}

interface ClientPackageAssignment {
  id: number; nutritionistId: number; clientId: number; packageId: number;
  startDate: string; endDate: string; sessionsUsed: number; createdAt: string; updatedAt: string;
  package: ServicePackage;
}

interface ExpiringSoonClient {
  clientId: number; clientName: string; endDate: string;
  daysRemaining: number; packageName: string;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function PackagesManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingPkg, setEditingPkg] = useState<ServicePackage | null>(null);
  const [form, setForm] = useState({ name: "", description: "", sessionCount: "6", durationWeeks: "12", referencePrice: "" });

  const { data: packages = [], isLoading } = useQuery<ServicePackage[]>({
    queryKey: ["/api/nutritionist/packages"],
    queryFn: () => apiRequest("GET", "/api/nutritionist/packages").then(r => r.json()),
  });

  const { data: expiringSoon = [] } = useQuery<ExpiringSoonClient[]>({
    queryKey: ["/api/nutritionist/packages/expiring-soon"],
    queryFn: () => apiRequest("GET", "/api/nutritionist/packages/expiring-soon").then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof form) =>
      apiRequest("POST", "/api/nutritionist/packages", {
        name: data.name,
        description: data.description || undefined,
        sessionCount: parseInt(data.sessionCount),
        durationWeeks: parseInt(data.durationWeeks),
        referencePrice: data.referencePrice || undefined,
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/packages"] });
      setShowForm(false);
      setForm({ name: "", description: "", sessionCount: "6", durationWeeks: "12", referencePrice: "" });
      toast({ title: "Package created" });
    },
    onError: () => toast({ title: "Failed to create package", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof form }) =>
      apiRequest("PUT", `/api/nutritionist/packages/${id}`, {
        name: data.name,
        description: data.description || undefined,
        sessionCount: parseInt(data.sessionCount),
        durationWeeks: parseInt(data.durationWeeks),
        referencePrice: data.referencePrice || undefined,
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/packages"] });
      setEditingPkg(null);
      setShowForm(false);
      toast({ title: "Package updated" });
    },
    onError: () => toast({ title: "Failed to update package", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/nutritionist/packages/${id}`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/packages"] });
      toast({ title: "Package deleted" });
    },
    onError: () => toast({ title: "Failed to delete package", variant: "destructive" }),
  });

  function startEdit(pkg: ServicePackage) {
    setEditingPkg(pkg);
    setForm({
      name: pkg.name,
      description: pkg.description ?? "",
      sessionCount: String(pkg.sessionCount),
      durationWeeks: String(pkg.durationWeeks),
      referencePrice: pkg.referencePrice ?? "",
    });
    setShowForm(true);
  }

  function handleSubmit() {
    if (!form.name.trim()) return;
    if (editingPkg) {
      updateMutation.mutate({ id: editingPkg.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-display font-bold text-zinc-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-zinc-500" />
            Service Packages
          </h2>
          <p className="text-sm text-zinc-500 mt-0.5">Define the packages you sell to clients</p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => { setEditingPkg(null); setForm({ name: "", description: "", sessionCount: "6", durationWeeks: "12", referencePrice: "" }); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 transition-colors"
            data-testid="button-create-package"
          >
            <Plus className="w-4 h-4" />
            New Package
          </button>
        )}
      </div>

      {expiringSoon.length > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-amber-900 flex items-center gap-2 mb-3">
            <Timer className="w-4 h-4 text-amber-600" />
            Expiring Soon ({expiringSoon.length} client{expiringSoon.length !== 1 ? "s" : ""})
          </h3>
          <div className="space-y-2">
            {expiringSoon.map(e => (
              <div key={e.clientId} className="flex items-center justify-between text-sm" data-testid={`expiring-soon-row-${e.clientId}`}>
                <div>
                  <span className="font-medium text-amber-900">{e.clientName}</span>
                  <span className="text-amber-700 ml-2 text-xs">{e.packageName}</span>
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${e.daysRemaining <= 3 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                  {e.daysRemaining === 0 ? "Expires today" : `${e.daysRemaining}d left`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-2xl border border-zinc-200 p-5 mb-4">
          <h3 className="text-sm font-semibold text-zinc-900 mb-4">{editingPkg ? "Edit Package" : "New Package"}</h3>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">Package Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                maxLength={200}
                placeholder="e.g. 3-Month Transformation Program"
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                data-testid="input-package-name"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-500 block mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                maxLength={1000}
                rows={3}
                placeholder="What's included in this package..."
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20 resize-none"
                data-testid="textarea-package-description"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Sessions Included</label>
                <input
                  type="number"
                  min="1"
                  value={form.sessionCount}
                  onChange={e => setForm(f => ({ ...f, sessionCount: e.target.value }))}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                  data-testid="input-package-session-count"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Duration (weeks)</label>
                <input
                  type="number"
                  min="1"
                  value={form.durationWeeks}
                  onChange={e => setForm(f => ({ ...f, durationWeeks: e.target.value }))}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                  data-testid="input-package-duration-weeks"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Price (reference)</label>
                <input
                  type="text"
                  value={form.referencePrice}
                  onChange={e => setForm(f => ({ ...f, referencePrice: e.target.value }))}
                  placeholder="e.g. 450"
                  className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                  data-testid="input-package-price"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!form.name.trim() || isPending}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                data-testid="button-save-package"
              >
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                {editingPkg ? "Save Changes" : "Create Package"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingPkg(null); }}
                className="px-4 py-2 border border-zinc-200 rounded-xl text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
                data-testid="button-cancel-package-form"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>
      ) : packages.length === 0 && !showForm ? (
        <div className="bg-white rounded-2xl border border-zinc-100 p-12 text-center">
          <Package className="w-10 h-10 text-zinc-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-zinc-600 mb-1">No packages yet</p>
          <p className="text-xs text-zinc-400">Create your first service package to assign to clients.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {packages.map(pkg => (
            <div key={pkg.id} className="bg-white rounded-2xl border border-zinc-100 p-5" data-testid={`card-package-${pkg.id}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-zinc-900">{pkg.name}</h3>
                    {pkg.referencePrice && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                        £{parseFloat(pkg.referencePrice).toFixed(0)}
                      </span>
                    )}
                  </div>
                  {pkg.description && <p className="text-xs text-zinc-500 mt-1">{pkg.description}</p>}
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-zinc-500 flex items-center gap-1">
                      <PackageCheck className="w-3.5 h-3.5" />
                      {pkg.sessionCount} session{pkg.sessionCount !== 1 ? "s" : ""}
                    </span>
                    <span className="text-xs text-zinc-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {pkg.durationWeeks} week{pkg.durationWeeks !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => startEdit(pkg)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                    data-testid={`button-edit-package-${pkg.id}`}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(pkg.id)}
                    disabled={deleteMutation.isPending}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    data-testid={`button-delete-package-${pkg.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ClientPackagePanel({ clientRecord }: { clientRecord: ClientWithUser }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);

  const { data: clientPkg, isLoading: pkgLoading } = useQuery<ClientPackageAssignment | null>({
    queryKey: ["/api/nutritionist/clients", clientRecord.clientId, "package"],
    queryFn: () => apiRequest("GET", `/api/nutritionist/clients/${clientRecord.clientId}/package`).then(r => r.json()),
  });

  const { data: availablePackages = [] } = useQuery<ServicePackage[]>({
    queryKey: ["/api/nutritionist/packages"],
    queryFn: () => apiRequest("GET", "/api/nutritionist/packages").then(r => r.json()),
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/nutritionist/clients/${clientRecord.clientId}/package`, {
        packageId: parseInt(selectedPackageId),
        startDate,
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/clients", clientRecord.clientId, "package"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/packages/expiring-soon"] });
      setShowAssignForm(false);
      toast({ title: "Package assigned" });
    },
    onError: () => toast({ title: "Failed to assign package", variant: "destructive" }),
  });

  const updateSessionsMutation = useMutation({
    mutationFn: (sessionsUsed: number) =>
      apiRequest("PATCH", `/api/nutritionist/clients/${clientRecord.clientId}/package/${clientPkg!.id}`, { sessionsUsed }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/clients", clientRecord.clientId, "package"] });
      toast({ title: "Sessions updated" });
    },
    onError: () => toast({ title: "Failed to update sessions", variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: () =>
      apiRequest("DELETE", `/api/nutritionist/clients/${clientRecord.clientId}/package/${clientPkg!.id}`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/clients", clientRecord.clientId, "package"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/packages/expiring-soon"] });
      toast({ title: "Package removed" });
    },
    onError: () => toast({ title: "Failed to remove package", variant: "destructive" }),
  });

  function getPackageStatus(cp: ClientPackageAssignment): { label: string; classes: string; badge: string } {
    const today = new Date();
    const end = new Date(cp.endDate);
    const daysLeft = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return { label: "Expired", classes: "bg-red-50 border-red-200", badge: "bg-red-100 text-red-700" };
    if (daysLeft <= 14) return { label: "Expiring Soon", classes: "bg-amber-50 border-amber-200", badge: "bg-amber-100 text-amber-700" };
    return { label: "Active", classes: "bg-emerald-50 border-emerald-200", badge: "bg-emerald-100 text-emerald-700" };
  }

  if (pkgLoading) return <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-zinc-400" /></div>;

  return (
    <div>
      {clientPkg ? (
        <div className={`rounded-xl border p-4 ${getPackageStatus(clientPkg).classes}`} data-testid="card-client-package">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h4 className="text-sm font-semibold text-zinc-900">{clientPkg.package.name}</h4>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${getPackageStatus(clientPkg).badge}`} data-testid="badge-package-status">
                  {getPackageStatus(clientPkg).label}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs text-zinc-600">
                <span>Sessions: <strong className="text-zinc-900" data-testid="text-sessions-used">{clientPkg.sessionsUsed}/{clientPkg.package.sessionCount}</strong></span>
                <span>Starts: <strong className="text-zinc-900">{formatDate(clientPkg.startDate)}</strong></span>
                <span>Remaining: <strong className="text-zinc-900" data-testid="text-sessions-remaining">{Math.max(0, clientPkg.package.sessionCount - clientPkg.sessionsUsed)}</strong></span>
                <span>Expires: <strong className="text-zinc-900">{formatDate(clientPkg.endDate)}</strong></span>
              </div>
              <div className="mt-2">
                <div className="w-full h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-zinc-700 rounded-full"
                    style={{ width: `${Math.min(100, (clientPkg.sessionsUsed / clientPkg.package.sessionCount) * 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-zinc-400 mt-0.5">{clientPkg.sessionsUsed} of {clientPkg.package.sessionCount} sessions used</p>
              </div>
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button
                type="button"
                onClick={() => { setShowAssignForm(true); setSelectedPackageId(String(clientPkg.packageId)); setStartDate(clientPkg.startDate); }}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-white/60 transition-colors"
                title="Change package"
                data-testid="button-change-package"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => removeMutation.mutate()}
                disabled={removeMutation.isPending}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Remove package"
                data-testid="button-remove-package"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-200/60">
            <span className="text-xs text-zinc-500">Sessions used:</span>
            <button
              type="button"
              onClick={() => clientPkg.sessionsUsed > 0 && updateSessionsMutation.mutate(clientPkg.sessionsUsed - 1)}
              disabled={clientPkg.sessionsUsed === 0 || updateSessionsMutation.isPending}
              className="w-6 h-6 flex items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-30 transition-colors"
              data-testid="button-decrement-sessions"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="text-sm font-semibold text-zinc-900 w-6 text-center" data-testid="text-sessions-counter">{clientPkg.sessionsUsed}</span>
            <button
              type="button"
              onClick={() => updateSessionsMutation.mutate(clientPkg.sessionsUsed + 1)}
              disabled={clientPkg.sessionsUsed >= clientPkg.package.sessionCount || updateSessionsMutation.isPending}
              className="w-6 h-6 flex items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-30 transition-colors"
              data-testid="button-increment-sessions"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      ) : !showAssignForm ? (
        <div className="rounded-xl border border-dashed border-zinc-200 p-4 text-center">
          <Package className="w-6 h-6 text-zinc-300 mx-auto mb-2" />
          <p className="text-xs text-zinc-500 mb-2">No active package</p>
          {availablePackages.length > 0 ? (
            <button
              type="button"
              onClick={() => setShowAssignForm(true)}
              className="text-xs font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-900 transition-colors"
              data-testid="button-assign-package"
            >
              Assign a package
            </button>
          ) : (
            <p className="text-xs text-zinc-400">Create packages in the Packages tab first</p>
          )}
        </div>
      ) : null}

      {showAssignForm && (
        <div className="mt-3 bg-white rounded-xl border border-zinc-200 p-4">
          <h4 className="text-xs font-semibold text-zinc-700 mb-3">Assign Package</h4>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Package</label>
              <select
                value={selectedPackageId}
                onChange={e => setSelectedPackageId(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20 text-zinc-700 bg-white"
                data-testid="select-assign-package"
              >
                <option value="">— Select package —</option>
                {availablePackages.map(p => (
                  <option key={p.id} value={String(p.id)}>
                    {p.name} ({p.sessionCount} sessions, {p.durationWeeks}w)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                data-testid="input-package-start-date"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => assignMutation.mutate()}
                disabled={!selectedPackageId || !startDate || assignMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 text-white rounded-xl text-xs font-medium hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                data-testid="button-confirm-assign-package"
              >
                {assignMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Assign
              </button>
              <button
                type="button"
                onClick={() => setShowAssignForm(false)}
                className="px-3 py-1.5 border border-zinc-200 rounded-xl text-xs text-zinc-600 hover:bg-zinc-50 transition-colors"
                data-testid="button-cancel-assign-package"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { PackagesManager, ClientPackagePanel };
