import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Users, Plus, Search, X, FileText, ArrowLeft,
  Mail, Calendar, ChevronRight, Trash2, Edit2, Check, AlertCircle, ClipboardList
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

const STATUS_LABELS: Record<string, { label: string; classes: string }> = {
  onboarding: { label: "Onboarding", classes: "bg-blue-50 text-blue-700" },
  active: { label: "Active", classes: "bg-emerald-50 text-emerald-700" },
  paused: { label: "Paused", classes: "bg-zinc-100 text-zinc-500" },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function ClientRoster({
  clients,
  capacity,
  onSelectClient,
  onInvite,
}: {
  clients: ClientWithUser[];
  capacity: Capacity;
  onSelectClient: (c: ClientWithUser) => void;
  onInvite: () => void;
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
                <ChevronRight className="w-4 h-4 text-zinc-300 flex-shrink-0" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ClientProfile({ clientRecord, onBack }: { clientRecord: ClientWithUser; onBack: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
            Enter your client's email address. They will receive an invitation link to create their FuelU account pre-linked to your practice.
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

export default function NutritionistPortalPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [selectedClient, setSelectedClient] = useState<ClientWithUser | null>(null);
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

  return (
    <div className="min-h-screen bg-zinc-50 pb-16">
      <header className="bg-white border-b border-zinc-100 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center relative">
              <div className="w-3 h-3 bg-white rounded-full" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[3px] h-[calc(50%-6px)] bg-white rounded-t-sm" />
            </div>
            <h1 className="font-display font-bold text-xl tracking-tight text-zinc-900">FuelU</h1>
          </Link>
          <span className="hidden sm:block text-xs font-medium text-zinc-400 bg-zinc-100 px-2.5 py-1 rounded-full capitalize">
            {profile.tier} Plan
          </span>
        </div>
      </header>

      {/* Personal / Professional tab strip */}
      <div className="bg-white border-b border-zinc-100" data-testid="tab-strip-professional-portal">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-1 h-11">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 transition-colors"
              data-testid="tab-personal"
            >
              Personal
            </Link>
            <span
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg text-zinc-900 bg-zinc-100"
              data-testid="tab-professional-active"
            >
              Professional
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {clientsLoading || capacityLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
          </div>
        ) : selectedClient ? (
          <ClientProfile
            clientRecord={selectedClient}
            onBack={() => setSelectedClient(null)}
          />
        ) : (
          <ClientRoster
            clients={clients}
            capacity={capacity!}
            onSelectClient={setSelectedClient}
            onInvite={() => setShowInviteModal(true)}
          />
        )}
      </div>

      {showInviteModal && (
        <InviteModal onClose={() => setShowInviteModal(false)} />
      )}
    </div>
  );
}
