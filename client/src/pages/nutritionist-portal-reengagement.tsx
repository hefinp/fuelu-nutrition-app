import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Loader2, Plus, Check, Edit2, Trash2, Send, Mail, Activity, Ban, Pause, Play, Zap,
  MoveVertical, Save, CheckCircle2, Clock, Link as LinkIcon,
} from "lucide-react";

interface ClientWithUser {
  id: number; nutritionistId: number; clientId: number; status: string; pipelineStage: string;
  goalSummary: string | null; healthNotes: string | null; lastActivityAt: string | null;
  createdAt: string; referralSource: string | null; referredByClientId: number | null;
  client: { id: number; name: string; email: string; preferences: Record<string, unknown> | null; isManagedClient: boolean; createdAt: string; };
}

interface Capacity {
  tier: string; limit: number; count: number; activeCount: number;
  canAddMore: boolean; maxClients: number | null;
}

interface ReengagementMessage { delayDays: number; body: string; }

interface ReengagementSequence {
  id: number; nutritionistId: number; name: string; triggerAfterDays: number;
  messages: ReengagementMessage[]; isDefault: boolean; createdAt: string; updatedAt: string;
}

interface ActiveReengagementJob {
  id: number; nutritionistId: number; clientId: number; sequenceId: number;
  currentStep: number; nextSendAt: string; status: string; createdAt: string; updatedAt: string;
  sequence: ReengagementSequence;
}

interface WaitlistEntry {
  id: number; nutritionistId: number; name: string; email: string;
  notes: string | null; position: number; status: string; invitedAt: string | null;
  addedAt: string | null; createdAt: string | null;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
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


// ─── Packages Manager ────────────────────────────────────────────────────────

export { ReengagementManager, WaitlistPanel };
