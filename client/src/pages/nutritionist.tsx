import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  Users, ClipboardList, BookTemplate, ChevronRight, Plus, Send, CheckCircle,
  Clock, AlertCircle, Trash2, Edit3, Sparkles, FileText, ArrowRight,
  Calendar, Eye, PenLine, Save, RefreshCw, X, ChevronDown, ChevronUp,
  MessageSquare, Loader2, History, Star
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ClientUser {
  id: number;
  email: string;
  name: string;
  tier: string;
}

interface NutritionistClientEntry {
  id: number;
  nutritionistId: number;
  clientId: number;
  notes: string | null;
  createdAt: string;
  client: ClientUser;
}

interface NutritionistPlan {
  id: number;
  nutritionistId: number;
  clientId: number;
  name: string;
  planType: string;
  planData: Record<string, any>;
  status: "draft" | "pending_review" | "approved" | "delivered";
  promptNote: string | null;
  scheduledDeliverAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  annotations?: PlanAnnotation[];
}

interface PlanAnnotation {
  id: number;
  planId: number;
  day: string;
  slot: string | null;
  note: string;
  createdAt: string;
}

interface PlanTemplate {
  id: number;
  nutritionistId: number;
  name: string;
  description: string | null;
  planType: string;
  planData: Record<string, any>;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_review: "Pending Review",
  approved: "Approved",
  delivered: "Delivered",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  pending_review: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  delivered: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const SLOTS = ["breakfast", "lunch", "dinner", "snack"];

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// ─── Plan Viewer ──────────────────────────────────────────────────────────────

function PlanViewer({ plan, onAnnotate }: { plan: NutritionistPlan; onAnnotate?: (day: string, slot: string | null) => void }) {
  const planData = plan.planData;
  const isWeekly = plan.planType === "weekly";
  const days = isWeekly ? DAYS : ["today"];

  const getAnnotation = (day: string, slot: string | null) =>
    plan.annotations?.find(a => a.day === day && a.slot === slot) ?? null;

  if (isWeekly) {
    return (
      <div className="space-y-4" data-testid="plan-viewer">
        {DAYS.map(day => {
          const dayData = planData[day];
          if (!dayData) return null;
          const dayAnnotation = getAnnotation(day, null);
          return (
            <div key={day} className="border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between bg-muted/50 px-4 py-2">
                <h4 className="font-semibold text-sm capitalize">{day}</h4>
                <div className="flex items-center gap-2">
                  {dayAnnotation && (
                    <span className="text-xs text-muted-foreground italic flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" /> {dayAnnotation.note}
                    </span>
                  )}
                  {onAnnotate && (
                    <button
                      onClick={() => onAnnotate(day, null)}
                      className="text-xs text-blue-600 hover:text-blue-700"
                      data-testid={`annotate-day-${day}`}
                    >
                      <PenLine className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-y">
                {SLOTS.map(slot => {
                  const meal = dayData[slot];
                  if (!meal) return null;
                  const annotation = getAnnotation(day, slot);
                  return (
                    <div key={slot} className="p-3 text-sm">
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <div className="text-xs text-muted-foreground capitalize mb-1">{slot}</div>
                          <div className="font-medium leading-snug">{meal.meal || meal.name || "—"}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {meal.calories} kcal · P {meal.protein}g · C {meal.carbs}g · F {meal.fat}g
                          </div>
                        </div>
                        {onAnnotate && (
                          <button
                            onClick={() => onAnnotate(day, slot)}
                            className="text-muted-foreground hover:text-blue-600 mt-1 flex-shrink-0"
                            data-testid={`annotate-${day}-${slot}`}
                          >
                            <PenLine className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      {annotation && (
                        <div className="mt-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded px-2 py-1 flex items-start gap-1">
                          <MessageSquare className="h-3 w-3 flex-shrink-0 mt-0.5" />
                          {annotation.note}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="plan-viewer-daily">
      {SLOTS.map(slot => {
        const meal = planData[slot];
        if (!meal) return null;
        const annotation = getAnnotation("today", slot);
        return (
          <div key={slot} className="border rounded-lg p-3 flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="text-xs text-muted-foreground capitalize mb-1">{slot}</div>
              <div className="font-medium">{meal.meal || meal.name || "—"}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {meal.calories} kcal · P {meal.protein}g · C {meal.carbs}g · F {meal.fat}g
              </div>
              {annotation && (
                <div className="mt-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded px-2 py-1 flex items-start gap-1">
                  <MessageSquare className="h-3 w-3 flex-shrink-0 mt-0.5" /> {annotation.note}
                </div>
              )}
            </div>
            {onAnnotate && (
              <button onClick={() => onAnnotate("today", slot)} className="text-muted-foreground hover:text-blue-600">
                <PenLine className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Annotation Dialog ────────────────────────────────────────────────────────

function AnnotationDialog({
  planId,
  day,
  slot,
  existing,
  onClose,
}: {
  planId: number;
  day: string;
  slot: string | null;
  existing: PlanAnnotation | null;
  onClose: () => void;
}) {
  const [note, setNote] = useState(existing?.note ?? "");
  const { toast } = useToast();

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest("PUT", `/api/nutritionist/plans/${planId}/annotations`, { day, slot, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/plans", planId] });
      toast({ title: "Annotation saved" });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      apiRequest("DELETE", `/api/nutritionist/plans/${planId}/annotations/${existing!.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/plans", planId] });
      toast({ title: "Annotation removed" });
      onClose();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Guidance Note</DialogTitle>
          <DialogDescription>
            {slot ? `${capitalize(day)} · ${capitalize(slot)}` : capitalize(day)} — this note will be visible to the client.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="E.g. Focus on protein recovery here — you've had a hard training day."
          className="min-h-[100px]"
          data-testid="annotation-note-input"
        />
        <DialogFooter className="gap-2">
          {existing && (
            <Button
              variant="outline"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              data-testid="annotation-delete"
            >
              <Trash2 className="h-4 w-4 mr-1" /> Remove
            </Button>
          )}
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!note.trim() || saveMutation.isPending}
            data-testid="annotation-save"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Save Note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Plan Detail View ─────────────────────────────────────────────────────────

function PlanDetailView({ plan, onClose, clients }: { plan: NutritionistPlan; onClose: () => void; clients: NutritionistClientEntry[] }) {
  const { toast } = useToast();
  const [annotating, setAnnotating] = useState<{ day: string; slot: string | null } | null>(null);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState(plan.name);
  const [templateDesc, setTemplateDesc] = useState("");
  const [scheduledDate, setScheduledDate] = useState(
    plan.scheduledDeliverAt ? new Date(plan.scheduledDeliverAt).toISOString().split("T")[0] : ""
  );

  const { data: fullPlan, isLoading } = useQuery<NutritionistPlan>({
    queryKey: ["/api/nutritionist/plans", plan.id],
    queryFn: async () => {
      const res = await fetch(`/api/nutritionist/plans/${plan.id}`, { credentials: "include" });
      return res.json();
    },
  });

  const client = clients.find(c => c.clientId === plan.clientId);

  const approveMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/nutritionist/plans/${plan.id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/plans", plan.id] });
      toast({ title: "Plan approved" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deliverMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/nutritionist/plans/${plan.id}/deliver`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/plans", plan.id] });
      toast({ title: "Plan delivered to client" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const scheduleMutation = useMutation({
    mutationFn: () =>
      apiRequest("PATCH", `/api/nutritionist/plans/${plan.id}`, {
        scheduledDeliverAt: scheduledDate ? new Date(scheduledDate).toISOString() : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/plans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/plans", plan.id] });
      toast({ title: "Delivery date updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveTemplateMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/nutritionist/plans/${plan.id}/save-as-template`, {
        name: templateName,
        description: templateDesc,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/templates"] });
      toast({ title: "Saved as template" });
      setSaveTemplateOpen(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const displayPlan = fullPlan ?? plan;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">{displayPlan.name}</h3>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            {client && <span>{client.client.name}</span>}
            <span>·</span>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[displayPlan.status]}`}>
              {STATUS_LABELS[displayPlan.status]}
            </span>
            <span>·</span>
            <span>{capitalize(displayPlan.planType)}</span>
          </div>
          {displayPlan.promptNote && (
            <div className="mt-2 text-sm text-muted-foreground bg-muted/50 rounded px-3 py-2 italic">
              <span className="font-medium not-italic">Clinical note:</span> {displayPlan.promptNote}
            </div>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {displayPlan.status === "pending_review" && (
          <Button
            onClick={() => approveMutation.mutate()}
            disabled={approveMutation.isPending}
            size="sm"
            data-testid="approve-plan"
          >
            {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
            Approve Plan
          </Button>
        )}
        {displayPlan.status === "approved" && (
          <Button
            onClick={() => deliverMutation.mutate()}
            disabled={deliverMutation.isPending}
            size="sm"
            data-testid="deliver-plan"
          >
            {deliverMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
            Deliver to Client
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => setSaveTemplateOpen(true)} data-testid="save-as-template">
          <Star className="h-4 w-4 mr-1" /> Save as Template
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Label className="text-sm whitespace-nowrap">Schedule delivery:</Label>
        <Input
          type="date"
          value={scheduledDate}
          onChange={e => setScheduledDate(e.target.value)}
          className="w-40 h-8 text-sm"
          data-testid="schedule-date-input"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => scheduleMutation.mutate()}
          disabled={scheduleMutation.isPending}
          data-testid="schedule-save"
        >
          {scheduleMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Calendar className="h-3 w-3" />}
        </Button>
        {displayPlan.scheduledDeliverAt && (
          <span className="text-sm text-muted-foreground">→ {formatDate(displayPlan.scheduledDeliverAt)}</span>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <PlanViewer
          plan={displayPlan}
          onAnnotate={(day, slot) => setAnnotating({ day, slot })}
        />
      )}

      {annotating && (
        <AnnotationDialog
          planId={plan.id}
          day={annotating.day}
          slot={annotating.slot}
          existing={displayPlan.annotations?.find(a => a.day === annotating.day && a.slot === annotating.slot) ?? null}
          onClose={() => {
            setAnnotating(null);
            queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/plans", plan.id] });
          }}
        />
      )}

      <Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as Template</DialogTitle>
            <DialogDescription>This plan will be saved to your template library for reuse.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Template Name</Label>
              <Input value={templateName} onChange={e => setTemplateName(e.target.value)} data-testid="template-name-input" />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Input
                value={templateDesc}
                onChange={e => setTemplateDesc(e.target.value)}
                placeholder="e.g. Marathon taper week, Post-race recovery"
                data-testid="template-desc-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => saveTemplateMutation.mutate()}
              disabled={!templateName.trim() || saveTemplateMutation.isPending}
              data-testid="save-template-submit"
            >
              {saveTemplateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Save Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function NutritionistPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<"clients" | "queue" | "templates">("clients");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<NutritionistPlan | null>(null);

  const [addClientEmail, setAddClientEmail] = useState("");
  const [addClientNotes, setAddClientNotes] = useState("");
  const [addClientOpen, setAddClientOpen] = useState(false);

  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateClientId, setGenerateClientId] = useState<number | null>(null);
  const [generatePrompt, setGeneratePrompt] = useState("");
  const [generatePlanType, setGeneratePlanType] = useState<"weekly" | "daily">("weekly");

  const [createManualOpen, setCreateManualOpen] = useState(false);
  const [manualPlanName, setManualPlanName] = useState("");
  const [manualPlanType, setManualPlanType] = useState<"weekly" | "daily">("weekly");

  const [applyTemplateOpen, setApplyTemplateOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [applyTemplateClientId, setApplyTemplateClientId] = useState<number | null>(null);

  const [isNutritionistUser, setIsNutritionistUser] = useState(true);

  async function safeFetch<T>(url: string, defaultValue: T): Promise<T> {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) {
      if (res.status === 403) setIsNutritionistUser(false);
      return defaultValue;
    }
    setIsNutritionistUser(true);
    return res.json();
  }

  // Data fetching
  const { data: clients = [], isLoading: clientsLoading } = useQuery<NutritionistClientEntry[]>({
    queryKey: ["/api/nutritionist/clients"],
    queryFn: () => safeFetch<NutritionistClientEntry[]>("/api/nutritionist/clients", []),
  });

  const { data: pendingPlans = [] } = useQuery<NutritionistPlan[]>({
    queryKey: ["/api/nutritionist/plans/pending-review"],
    queryFn: () => safeFetch<NutritionistPlan[]>("/api/nutritionist/plans/pending-review", []),
  });

  const { data: templates = [], isLoading: templatesLoading } = useQuery<PlanTemplate[]>({
    queryKey: ["/api/nutritionist/templates"],
    queryFn: () => safeFetch<PlanTemplate[]>("/api/nutritionist/templates", []),
  });

  const { data: clientPlans = [], isLoading: clientPlansLoading } = useQuery<NutritionistPlan[]>({
    queryKey: ["/api/nutritionist/clients", selectedClientId, "plans"],
    queryFn: async () => {
      if (!selectedClientId) return [];
      return safeFetch<NutritionistPlan[]>(`/api/nutritionist/clients/${selectedClientId}/plans`, []);
    },
    enabled: !!selectedClientId,
  });

  // Mutations
  const addClientMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/nutritionist/clients", { clientEmail: addClientEmail, notes: addClientNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/clients"] });
      toast({ title: "Client added" });
      setAddClientEmail("");
      setAddClientNotes("");
      setAddClientOpen(false);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeClientMutation = useMutation({
    mutationFn: (clientId: number) => apiRequest("DELETE", `/api/nutritionist/clients/${clientId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/clients"] });
      if (selectedClientId) setSelectedClientId(null);
      toast({ title: "Client removed" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const generatePlanMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/nutritionist/plans/generate", {
        clientId: generateClientId,
        promptNote: generatePrompt || undefined,
        planType: generatePlanType,
      }),
    onSuccess: async (res) => {
      const plan = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/plans/pending-review"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/clients", generateClientId, "plans"] });
      toast({ title: "Plan generated", description: "It's now in the verification queue" });
      setGenerateOpen(false);
      setGeneratePrompt("");
      setActiveTab("queue");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const createManualPlanMutation = useMutation({
    mutationFn: () => {
      const emptyDay = SLOTS.reduce((acc, slot) => ({
        ...acc,
        [slot]: { meal: "", calories: 0, protein: 0, carbs: 0, fat: 0 },
      }), {});
      const planData = manualPlanType === "weekly"
        ? DAYS.reduce((acc, d) => ({ ...acc, [d]: { ...emptyDay } }), {})
        : { ...emptyDay };
      return apiRequest("POST", "/api/nutritionist/plans", {
        clientId: selectedClientId,
        name: manualPlanName || "New Plan",
        planType: manualPlanType,
        planData,
        status: "draft",
      });
    },
    onSuccess: async (res) => {
      const plan = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/clients", selectedClientId, "plans"] });
      toast({ title: "Plan created" });
      setCreateManualOpen(false);
      setManualPlanName("");
      setSelectedPlan(plan);
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const applyTemplateMutation = useMutation({
    mutationFn: () => {
      const template = templates.find(t => t.id === selectedTemplateId);
      if (!template) throw new Error("Template not found");
      return apiRequest("POST", "/api/nutritionist/plans", {
        clientId: applyTemplateClientId,
        name: template.name,
        planType: template.planType,
        planData: template.planData,
        status: "draft",
      });
    },
    onSuccess: async (res) => {
      const plan = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/clients", applyTemplateClientId, "plans"] });
      toast({ title: "Template applied — plan created as draft" });
      setApplyTemplateOpen(false);
      setSelectedClientId(applyTemplateClientId);
      setSelectedPlan(plan);
      setActiveTab("clients");
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/nutritionist/templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/templates"] });
      toast({ title: "Template deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deletePlanMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/nutritionist/plans/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/plans/pending-review"] });
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/clients", selectedClientId, "plans"] });
      if (selectedPlan) setSelectedPlan(null);
      toast({ title: "Plan deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (authLoading) {
    return <div className="flex justify-center items-center min-h-screen"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const selectedClient = clients.find(c => c.clientId === selectedClientId);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Nutritionist Portal</h1>
            <p className="text-sm text-muted-foreground">Build and deliver personalised meal plans</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} data-testid="back-to-dashboard">
            Back to Dashboard
          </Button>
        </div>
      </div>

      {!isNutritionistUser && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 flex items-center gap-3 text-amber-800 dark:text-amber-200 text-sm" data-testid="access-denied-banner">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            Your account doesn't have nutritionist access. Contact your administrator to be added as a nutritionist.
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
          <div className="flex items-center justify-between mb-4">
            <TabsList data-testid="main-tabs">
              <TabsTrigger value="clients" data-testid="tab-clients">
                <Users className="h-4 w-4 mr-1" /> Clients
              </TabsTrigger>
              <TabsTrigger value="queue" data-testid="tab-queue">
                <ClipboardList className="h-4 w-4 mr-1" /> Review Queue
                {pendingPlans.length > 0 && (
                  <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">
                    {pendingPlans.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="templates" data-testid="tab-templates">
                <Star className="h-4 w-4 mr-1" /> Templates
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ─── Clients Tab ──────────────────────────────────────────────────── */}
          <TabsContent value="clients">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Client List */}
              <div className="md:col-span-1 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Your Clients</h2>
                  <Button size="sm" variant="outline" onClick={() => setAddClientOpen(true)} data-testid="add-client-btn">
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
                {clientsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : clients.length === 0 ? (
                  <Card>
                    <CardContent className="pt-6 text-center text-sm text-muted-foreground">
                      No clients yet. Add a client by their email address.
                    </CardContent>
                  </Card>
                ) : (
                  clients.map(entry => (
                    <Card
                      key={entry.id}
                      className={`cursor-pointer transition-colors ${selectedClientId === entry.clientId ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"}`}
                      onClick={() => { setSelectedClientId(entry.clientId); setSelectedPlan(null); }}
                      data-testid={`client-card-${entry.clientId}`}
                    >
                      <CardContent className="p-3 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{entry.client.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{entry.client.email}</div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>

              {/* Client Detail / Plan Builder */}
              <div className="md:col-span-2">
                {!selectedClientId ? (
                  <Card>
                    <CardContent className="pt-12 pb-12 text-center text-muted-foreground">
                      <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p>Select a client to view their plans and build new ones</p>
                    </CardContent>
                  </Card>
                ) : selectedPlan ? (
                  <Card>
                    <CardContent className="p-4">
                      <PlanDetailView
                        plan={selectedPlan}
                        clients={clients}
                        onClose={() => setSelectedPlan(null)}
                      />
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {/* Client header */}
                    {selectedClient && (
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-lg font-semibold">{selectedClient.client.name}</h2>
                          <p className="text-sm text-muted-foreground">{selectedClient.client.email}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => { setGenerateClientId(selectedClientId); setGenerateOpen(true); }}
                            data-testid="generate-plan-btn"
                          >
                            <Sparkles className="h-4 w-4 mr-1" /> Generate AI Plan
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setCreateManualOpen(true)} data-testid="create-manual-plan-btn">
                            <Plus className="h-4 w-4 mr-1" /> Manual Plan
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => removeClientMutation.mutate(selectedClientId)}
                            data-testid="remove-client-btn"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Plan history */}
                    <div>
                      <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-3">
                        Plan History
                      </h3>
                      {clientPlansLoading ? (
                        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
                      ) : clientPlans.length === 0 ? (
                        <Card>
                          <CardContent className="pt-6 pb-6 text-center text-sm text-muted-foreground">
                            No plans yet for this client. Generate one with AI or create manually.
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="space-y-2">
                          {clientPlans.map(plan => (
                            <Card
                              key={plan.id}
                              className="cursor-pointer hover:border-muted-foreground/30 transition-colors"
                              onClick={() => setSelectedPlan(plan)}
                              data-testid={`plan-card-${plan.id}`}
                            >
                              <CardContent className="p-3 flex items-center justify-between gap-4">
                                <div className="min-w-0 flex-1">
                                  <div className="font-medium truncate">{plan.name}</div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[plan.status]}`}>
                                      {STATUS_LABELS[plan.status]}
                                    </span>
                                    <span className="text-xs text-muted-foreground capitalize">{plan.planType}</span>
                                    {plan.deliveredAt && (
                                      <span className="text-xs text-muted-foreground">· Delivered {formatDate(plan.deliveredAt)}</span>
                                    )}
                                    {plan.scheduledDeliverAt && plan.status !== "delivered" && (
                                      <span className="text-xs text-blue-600">· Scheduled {formatDate(plan.scheduledDeliverAt)}</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={e => { e.stopPropagation(); deletePlanMutation.mutate(plan.id); }}
                                    data-testid={`delete-plan-${plan.id}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                                  </Button>
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ─── Queue Tab ────────────────────────────────────────────────────── */}
          <TabsContent value="queue">
            <div className="space-y-4">
              <div>
                <h2 className="font-semibold mb-1">Plans Pending Review</h2>
                <p className="text-sm text-muted-foreground">AI-generated plans waiting for your approval before delivery.</p>
              </div>
              {pendingPlans.length === 0 ? (
                <Card>
                  <CardContent className="pt-10 pb-10 text-center text-muted-foreground">
                    <CheckCircle className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p>No plans pending review — you're all caught up!</p>
                  </CardContent>
                </Card>
              ) : selectedPlan ? (
                <Card>
                  <CardContent className="p-4">
                    <PlanDetailView plan={selectedPlan} clients={clients} onClose={() => setSelectedPlan(null)} />
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {pendingPlans.map(plan => {
                    const client = clients.find(c => c.clientId === plan.clientId);
                    return (
                      <Card
                        key={plan.id}
                        className="cursor-pointer hover:border-amber-300 transition-colors"
                        onClick={() => setSelectedPlan(plan)}
                        data-testid={`queue-plan-${plan.id}`}
                      >
                        <CardContent className="p-4 flex items-center justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{plan.name}</div>
                            {client && <div className="text-sm text-muted-foreground">{client.client.name}</div>}
                            {plan.promptNote && (
                              <div className="text-xs text-muted-foreground italic mt-1 truncate">"{plan.promptNote}"</div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{formatDate(plan.createdAt)}</span>
                            <Button size="sm" variant="outline" onClick={e => { e.stopPropagation(); setSelectedPlan(plan); }}>
                              <Eye className="h-4 w-4 mr-1" /> Review
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ─── Templates Tab ────────────────────────────────────────────────── */}
          <TabsContent value="templates">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">Template Library</h2>
                  <p className="text-sm text-muted-foreground">Reusable plan structures you can apply to any client.</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setApplyTemplateOpen(true); }}
                  disabled={templates.length === 0 || clients.length === 0}
                  data-testid="apply-template-btn"
                >
                  <ArrowRight className="h-4 w-4 mr-1" /> Apply Template
                </Button>
              </div>
              {templatesLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : templates.length === 0 ? (
                <Card>
                  <CardContent className="pt-10 pb-10 text-center text-muted-foreground">
                    <Star className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No templates yet</p>
                    <p className="text-sm mt-1">Open any plan and click "Save as Template" to add it here.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {templates.map(t => (
                    <Card key={t.id} data-testid={`template-card-${t.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-base">{t.name}</CardTitle>
                            {t.description && <CardDescription className="mt-0.5">{t.description}</CardDescription>}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteTemplateMutation.mutate(t.id)}
                            data-testid={`delete-template-${t.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="capitalize">{t.planType} plan</span>
                          <span>·</span>
                          <span>Created {formatDate(t.createdAt)}</span>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-3"
                          onClick={() => { setSelectedTemplateId(t.id); setApplyTemplateOpen(true); }}
                          data-testid={`apply-template-${t.id}`}
                        >
                          <ArrowRight className="h-4 w-4 mr-1" /> Apply to Client
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ─── Add Client Dialog ─────────────────────────────────────────────── */}
      <Dialog open={addClientOpen} onOpenChange={setAddClientOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Client</DialogTitle>
            <DialogDescription>Enter the email address of the client's FuelU account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Client Email</Label>
              <Input
                type="email"
                value={addClientEmail}
                onChange={e => setAddClientEmail(e.target.value)}
                placeholder="client@example.com"
                data-testid="add-client-email-input"
              />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={addClientNotes}
                onChange={e => setAddClientNotes(e.target.value)}
                placeholder="Internal notes about this client..."
                className="min-h-[80px]"
                data-testid="add-client-notes-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => addClientMutation.mutate()}
              disabled={!addClientEmail.trim() || addClientMutation.isPending}
              data-testid="add-client-submit"
            >
              {addClientMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Add Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Generate AI Plan Dialog ───────────────────────────────────────── */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate AI Meal Plan</DialogTitle>
            <DialogDescription>
              The AI will use the client's stored profile, goals, and preferences to create a plan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Plan Type</Label>
              <Select value={generatePlanType} onValueChange={(v: any) => setGeneratePlanType(v)}>
                <SelectTrigger data-testid="generate-plan-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly (7 days)</SelectItem>
                  <SelectItem value="daily">Daily (1 day)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Clinical Adjustment Note (optional)</Label>
              <Textarea
                value={generatePrompt}
                onChange={e => setGeneratePrompt(e.target.value)}
                placeholder="e.g. Increase protein — she's in a peak training block, race in 3 weeks."
                className="min-h-[100px]"
                data-testid="generate-prompt-input"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This note is injected directly into the AI prompt alongside the client's profile data.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => generatePlanMutation.mutate()}
              disabled={!generateClientId || generatePlanMutation.isPending}
              data-testid="generate-plan-submit"
            >
              {generatePlanMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Generating...</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-1" /> Generate Plan</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Create Manual Plan Dialog ─────────────────────────────────────── */}
      <Dialog open={createManualOpen} onOpenChange={setCreateManualOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Manual Plan</DialogTitle>
            <DialogDescription>Start with an empty plan structure you can fill in.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Plan Name</Label>
              <Input
                value={manualPlanName}
                onChange={e => setManualPlanName(e.target.value)}
                placeholder="e.g. Week 1 Base Training"
                data-testid="manual-plan-name-input"
              />
            </div>
            <div>
              <Label>Plan Type</Label>
              <Select value={manualPlanType} onValueChange={(v: any) => setManualPlanType(v)}>
                <SelectTrigger data-testid="manual-plan-type-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly (7 days)</SelectItem>
                  <SelectItem value="daily">Daily (1 day)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => createManualPlanMutation.mutate()}
              disabled={createManualPlanMutation.isPending}
              data-testid="create-manual-plan-submit"
            >
              {createManualPlanMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Create Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Apply Template Dialog ─────────────────────────────────────────── */}
      <Dialog open={applyTemplateOpen} onOpenChange={setApplyTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Template to Client</DialogTitle>
            <DialogDescription>This creates a new draft plan for the selected client.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Template</Label>
              <Select value={selectedTemplateId?.toString() ?? ""} onValueChange={v => setSelectedTemplateId(parseInt(v))}>
                <SelectTrigger data-testid="apply-template-select">
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Client</Label>
              <Select value={applyTemplateClientId?.toString() ?? ""} onValueChange={v => setApplyTemplateClientId(parseInt(v))}>
                <SelectTrigger data-testid="apply-template-client-select">
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.clientId} value={c.clientId.toString()}>{c.client.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => applyTemplateMutation.mutate()}
              disabled={!selectedTemplateId || !applyTemplateClientId || applyTemplateMutation.isPending}
              data-testid="apply-template-submit"
            >
              {applyTemplateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ArrowRight className="h-4 w-4 mr-1" />}
              Apply Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
