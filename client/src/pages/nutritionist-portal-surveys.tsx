import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Loader2, Plus, X, Check, ArrowLeft, ClipboardList, CheckCircle2, Edit2, Trash2,
  BarChart2, Send, Clock,
} from "lucide-react";

interface ClientWithUser {
  id: number; nutritionistId: number; clientId: number; status: string; pipelineStage: string;
  goalSummary: string | null; healthNotes: string | null; lastActivityAt: string | null;
  createdAt: string; referralSource: string | null; referredByClientId: number | null;
  client: { id: number; name: string; email: string; preferences: Record<string, unknown> | null; isManagedClient: boolean; createdAt: string; };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

interface SurveyQuestion {
  id: string;
  type: "rating" | "yes_no" | "free_text";
  text: string;
  required?: boolean;
}

interface SurveyTemplate {
  id: number;
  nutritionistId: number;
  name: string;
  description: string | null;
  questions: SurveyQuestion[];
  triggerType: string;
  triggerDayOffset: number | null;
  isDefault: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface SurveyDeliveryWithTemplate {
  id: number;
  surveyTemplateId: number;
  nutritionistId: number;
  clientId: number;
  sentAt: string;
  completedAt: string | null;
  createdAt: string;
  template: SurveyTemplate;
}

interface SurveyResponseWithDelivery {
  id: number;
  surveyDeliveryId: number;
  clientId: number;
  answers: Record<string, string | number | boolean | null>;
  submittedAt: string;
  delivery: SurveyDeliveryWithTemplate;
}

interface AggregateResult {
  questionId: string;
  questionText: string;
  questionType: string;
  answers: (string | number | boolean | null)[];
}

const TRIGGER_LABELS: Record<string, string> = {
  manual: "Manual only",
  onboarding_7d: "7 days after onboarding",
  active_30d: "30 days active",
  quarterly: "Quarterly",
};

// ─── Survey Management Panel (Nutritionist Portal) ───────────────────────────

function SurveyManagementPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [view, setSurveyView] = useState<"templates" | "responses" | "builder" | "aggregate">("templates");
  const [editingTemplate, setEditingTemplate] = useState<SurveyTemplate | null>(null);
  const [selectedTemplateForAggregate, setSelectedTemplateForAggregate] = useState<SurveyTemplate | null>(null);

  const { data: templates = [], isLoading } = useQuery<SurveyTemplate[]>({
    queryKey: ["/api/nutritionist/surveys/templates"],
    queryFn: () => apiRequest("GET", "/api/nutritionist/surveys/templates").then(r => r.json()),
  });

  const { data: responses = [] } = useQuery<SurveyResponseWithDelivery[]>({
    queryKey: ["/api/nutritionist/surveys/responses"],
    queryFn: () => apiRequest("GET", "/api/nutritionist/surveys/responses").then(r => r.json()),
    enabled: view === "responses",
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/nutritionist/surveys/templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/surveys/templates"] });
      toast({ title: "Survey template deleted" });
    },
    onError: () => toast({ title: "Failed to delete template", variant: "destructive" }),
  });

  if (view === "builder") {
    return (
      <SurveyBuilder
        template={editingTemplate}
        onDone={() => { setSurveyView("templates"); setEditingTemplate(null); }}
      />
    );
  }

  if (view === "aggregate" && selectedTemplateForAggregate) {
    return (
      <SurveyAggregateView
        template={selectedTemplateForAggregate}
        onBack={() => { setSurveyView("templates"); setSelectedTemplateForAggregate(null); }}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-display font-bold text-zinc-900 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-zinc-500" />
            Client Surveys
          </h2>
          <p className="text-sm text-zinc-500 mt-0.5">Collect structured feedback from clients at key milestones</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSurveyView(v => v === "responses" ? "templates" : "responses")}
            className="flex items-center gap-1.5 px-3 py-2 border border-zinc-200 rounded-xl text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
            data-testid="button-toggle-survey-view"
          >
            {view === "responses" ? <ClipboardList className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            {view === "responses" ? "Templates" : "All Responses"}
          </button>
          <button
            type="button"
            onClick={() => { setEditingTemplate(null); setSurveyView("builder"); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 transition-colors"
            data-testid="button-new-survey-template"
          >
            <Plus className="w-3.5 h-3.5" />
            New Survey
          </button>
        </div>
      </div>

      {view === "responses" ? (
        <div className="space-y-3">
          {responses.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-100 p-10 text-center">
              <CheckCircle2 className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">No responses received yet</p>
            </div>
          ) : (
            responses.map(r => (
              <div key={r.id} className="bg-white rounded-2xl border border-zinc-100 p-4" data-testid={`survey-response-${r.id}`}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="text-sm font-semibold text-zinc-900">{r.delivery.template.name}</p>
                    <p className="text-xs text-zinc-400">Submitted {formatDate(r.submittedAt)}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {r.delivery.template.questions.map(q => {
                    const answer = r.answers[q.id];
                    return (
                      <div key={q.id} className="text-xs">
                        <p className="text-zinc-500 mb-0.5">{q.text}</p>
                        <p className="font-medium text-zinc-900">
                          {answer === null || answer === undefined || answer === "" ? <span className="text-zinc-400 italic">No answer</span> :
                            q.type === "rating" ? `${answer}/5` :
                            q.type === "yes_no" ? (answer ? "Yes" : "No") :
                            String(answer)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>
          ) : templates.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-100 p-10 text-center">
              <ClipboardList className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
              <p className="text-sm text-zinc-500 mb-4">No survey templates yet</p>
              <button
                type="button"
                onClick={() => { setEditingTemplate(null); setSurveyView("builder"); }}
                className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-sm font-medium"
                data-testid="button-create-first-survey"
              >
                Create your first survey
              </button>
            </div>
          ) : (
            templates.map(t => (
              <div key={t.id} className="bg-white rounded-2xl border border-zinc-100 p-4" data-testid={`survey-template-${t.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-zinc-900">{t.name}</p>
                      {t.isDefault && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-zinc-100 text-zinc-500">Default</span>}
                      {!t.active && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-50 text-red-600">Inactive</span>}
                    </div>
                    {t.description && <p className="text-xs text-zinc-500 mb-2">{t.description}</p>}
                    <div className="flex items-center gap-3 text-xs text-zinc-400">
                      <span>{t.questions.length} question{t.questions.length !== 1 ? "s" : ""}</span>
                      <span>·</span>
                      <span>{TRIGGER_LABELS[t.triggerType] ?? t.triggerType}</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => { setSelectedTemplateForAggregate(t); setSurveyView("aggregate"); }}
                      className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
                      title="View aggregate results"
                      data-testid={`button-view-aggregate-${t.id}`}
                    >
                      <BarChart2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditingTemplate(t); setSurveyView("builder"); }}
                      className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
                      title="Edit template"
                      data-testid={`button-edit-survey-${t.id}`}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Delete this survey template? Existing responses will be preserved.")) {
                          deleteMutation.mutate(t.id);
                        }
                      }}
                      className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete template"
                      data-testid={`button-delete-survey-${t.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Survey Builder ───────────────────────────────────────────────────────────

function SurveyBuilder({ template, onDone }: { template: SurveyTemplate | null; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [triggerType, setTriggerType] = useState(template?.triggerType ?? "manual");
  const [questions, setQuestions] = useState<SurveyQuestion[]>(
    template?.questions ?? [{ id: crypto.randomUUID(), type: "rating", text: "", required: true }]
  );

  const saveMutation = useMutation({
    mutationFn: (data: object) => template
      ? apiRequest("PUT", `/api/nutritionist/surveys/templates/${template.id}`, data).then(r => r.json())
      : apiRequest("POST", "/api/nutritionist/surveys/templates", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/surveys/templates"] });
      toast({ title: template ? "Survey updated" : "Survey created" });
      onDone();
    },
    onError: () => toast({ title: "Failed to save survey", variant: "destructive" }),
  });

  const addQuestion = () => {
    if (questions.length >= 10) return;
    setQuestions(qs => [...qs, { id: crypto.randomUUID(), type: "rating", text: "", required: false }]);
  };

  const removeQuestion = (id: string) => {
    setQuestions(qs => qs.filter(q => q.id !== id));
  };

  const updateQuestion = (id: string, updates: Partial<SurveyQuestion>) => {
    setQuestions(qs => qs.map(q => q.id === id ? { ...q, ...updates } : q));
  };

  const handleSave = () => {
    if (!name.trim()) return toast({ title: "Survey name is required", variant: "destructive" });
    const validQuestions = questions.filter(q => q.text.trim());
    if (validQuestions.length === 0) return toast({ title: "Add at least one question", variant: "destructive" });
    saveMutation.mutate({ name: name.trim(), description: description.trim() || undefined, triggerType, questions: validQuestions });
  };

  return (
    <div>
      <button
        type="button"
        onClick={onDone}
        className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 mb-6 transition-colors"
        data-testid="button-back-survey-builder"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to surveys
      </button>

      <div className="bg-white rounded-2xl border border-zinc-100 p-6 mb-4">
        <h2 className="text-lg font-bold text-zinc-900 mb-4">{template ? "Edit Survey" : "New Survey"}</h2>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-zinc-500 block mb-1">Survey Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Onboarding Check-in"
              maxLength={200}
              className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
              data-testid="input-survey-name"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-500 block mb-1">Description (optional)</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of this survey"
              maxLength={500}
              className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
              data-testid="input-survey-description"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-500 block mb-1">Trigger</label>
            <select
              value={triggerType}
              onChange={e => setTriggerType(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:outline-none text-zinc-700 bg-white"
              data-testid="select-survey-trigger"
            >
              <option value="manual">Manual only</option>
              <option value="onboarding_7d">7 days after onboarding</option>
              <option value="active_30d">30 days active</option>
              <option value="quarterly">Quarterly</option>
            </select>
            <p className="text-xs text-zinc-400 mt-1">Automatic triggers send the survey when the client hits the milestone. You can always send manually too.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-zinc-100 p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-zinc-900">Questions ({questions.length}/10)</h3>
          <button
            type="button"
            onClick={addQuestion}
            disabled={questions.length >= 10}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 rounded-xl text-xs text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-40"
            data-testid="button-add-question"
          >
            <Plus className="w-3.5 h-3.5" />
            Add question
          </button>
        </div>

        <div className="space-y-4">
          {questions.map((q, i) => (
            <div key={q.id} className="p-4 bg-zinc-50 rounded-xl" data-testid={`question-${i}`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-zinc-400 w-5 shrink-0">{i + 1}</span>
                <select
                  value={q.type}
                  onChange={e => updateQuestion(q.id, { type: e.target.value as SurveyQuestion["type"] })}
                  className="px-2 py-1 border border-zinc-200 rounded-lg text-xs text-zinc-700 bg-white focus:outline-none"
                  data-testid={`select-question-type-${i}`}
                >
                  <option value="rating">Rating (1-5)</option>
                  <option value="yes_no">Yes / No</option>
                  <option value="free_text">Free text</option>
                </select>
                <div className="flex items-center gap-1 ml-auto">
                  <input
                    type="checkbox"
                    checked={q.required ?? false}
                    onChange={e => updateQuestion(q.id, { required: e.target.checked })}
                    id={`req-${q.id}`}
                    className="w-3.5 h-3.5"
                    data-testid={`checkbox-required-${i}`}
                  />
                  <label htmlFor={`req-${q.id}`} className="text-xs text-zinc-500">Required</label>
                </div>
                <button
                  type="button"
                  onClick={() => removeQuestion(q.id)}
                  disabled={questions.length <= 1}
                  className="p-1 text-zinc-400 hover:text-red-600 rounded-lg transition-colors disabled:opacity-30"
                  data-testid={`button-remove-question-${i}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                type="text"
                value={q.text}
                onChange={e => updateQuestion(q.id, { text: e.target.value })}
                placeholder="Enter your question..."
                maxLength={500}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900/20"
                data-testid={`input-question-text-${i}`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onDone}
          className="px-4 py-2 border border-zinc-200 rounded-xl text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
          data-testid="button-cancel-survey-builder"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50"
          data-testid="button-save-survey"
        >
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {template ? "Update Survey" : "Create Survey"}
        </button>
      </div>
    </div>
  );
}

// ─── Survey Aggregate View ────────────────────────────────────────────────────

function SurveyAggregateView({ template, onBack }: { template: SurveyTemplate; onBack: () => void }) {
  const { data: results = [], isLoading } = useQuery<AggregateResult[]>({
    queryKey: ["/api/nutritionist/surveys/aggregate", template.id],
    queryFn: () => apiRequest("GET", `/api/nutritionist/surveys/aggregate/${template.id}`).then(r => r.json()),
  });

  const renderAggregatedAnswer = (result: AggregateResult) => {
    if (result.answers.length === 0) return <p className="text-xs text-zinc-400 italic">No responses yet</p>;

    if (result.questionType === "rating") {
      const nums = result.answers.filter(a => typeof a === "number") as number[];
      const avg = nums.length ? (nums.reduce((s, n) => s + n, 0) / nums.length).toFixed(1) : null;
      const counts = [1, 2, 3, 4, 5].map(v => ({ v, c: nums.filter(n => n === v).length }));
      return (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl font-bold text-zinc-900">{avg ?? "–"}</span>
            <span className="text-sm text-zinc-400">/ 5 avg · {nums.length} response{nums.length !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex gap-1">
            {counts.map(({ v, c }) => (
              <div key={v} className="flex-1">
                <div className="h-6 bg-zinc-100 rounded-sm relative overflow-hidden">
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-zinc-700 rounded-sm transition-all"
                    style={{ height: nums.length ? `${(c / nums.length) * 100}%` : "0%" }}
                  />
                </div>
                <p className="text-[10px] text-zinc-400 text-center mt-0.5">{v}</p>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (result.questionType === "yes_no") {
      const yesCount = result.answers.filter(a => a === true || a === "true" || a === "yes").length;
      const noCount = result.answers.length - yesCount;
      const yesPct = result.answers.length ? Math.round((yesCount / result.answers.length) * 100) : 0;
      return (
        <div className="flex items-center gap-4">
          <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${yesPct}%` }} />
          </div>
          <span className="text-xs text-emerald-600 font-medium">{yesPct}% Yes</span>
          <span className="text-xs text-zinc-400">{yesCount}Y / {noCount}N</span>
        </div>
      );
    }

    return (
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {(result.answers as string[]).map((a, i) => (
          <p key={i} className="text-xs text-zinc-700 bg-zinc-50 rounded-lg px-3 py-1.5">"{a}"</p>
        ))}
      </div>
    );
  };

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 mb-6 transition-colors"
        data-testid="button-back-aggregate"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to surveys
      </button>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900">{template.name}</h2>
          <p className="text-sm text-zinc-500">Aggregated responses across all clients</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-zinc-400" /></div>
      ) : results.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-100 p-10 text-center">
          <BarChart2 className="w-10 h-10 text-zinc-200 mx-auto mb-3" />
          <p className="text-sm text-zinc-500">No data yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {results.map((result, i) => (
            <div key={result.questionId} className="bg-white rounded-2xl border border-zinc-100 p-5" data-testid={`aggregate-q-${i}`}>
              <p className="text-sm font-medium text-zinc-700 mb-3">{result.questionText}</p>
              {renderAggregatedAnswer(result)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Client Surveys Panel (in ClientProfile) ──────────────────────────────────

function ClientSurveysPanel({ clientRecord }: { clientRecord: ClientWithUser }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showSendModal, setShowSendModal] = useState(false);

  const { data: templates = [] } = useQuery<SurveyTemplate[]>({
    queryKey: ["/api/nutritionist/surveys/templates"],
    queryFn: () => apiRequest("GET", "/api/nutritionist/surveys/templates").then(r => r.json()),
  });

  const { data: deliveries = [], isLoading } = useQuery<SurveyDeliveryWithTemplate[]>({
    queryKey: ["/api/nutritionist/surveys/deliveries", clientRecord.clientId],
    queryFn: () => apiRequest("GET", `/api/nutritionist/surveys/deliveries?clientId=${clientRecord.clientId}`).then(r => r.json()),
  });

  const { data: responses = [] } = useQuery<SurveyResponseWithDelivery[]>({
    queryKey: ["/api/nutritionist/surveys/responses", clientRecord.clientId],
    queryFn: () => apiRequest("GET", `/api/nutritionist/surveys/responses?clientId=${clientRecord.clientId}`).then(r => r.json()),
  });

  const sendMutation = useMutation({
    mutationFn: ({ surveyTemplateId }: { surveyTemplateId: number }) =>
      apiRequest("POST", "/api/nutritionist/surveys/send", { surveyTemplateId, clientId: clientRecord.clientId }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nutritionist/surveys/deliveries", clientRecord.clientId] });
      toast({ title: "Survey sent to client" });
      setShowSendModal(false);
    },
    onError: () => toast({ title: "Failed to send survey", variant: "destructive" }),
  });

  const pendingDeliveries = deliveries.filter(d => !d.completedAt);
  const completedDeliveries = deliveries.filter(d => d.completedAt);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-zinc-400" />
          Surveys
        </h3>
        <button
          type="button"
          onClick={() => setShowSendModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-200 rounded-xl text-xs text-zinc-600 hover:bg-zinc-50 transition-colors"
          data-testid="button-send-survey-to-client"
        >
          <Send className="w-3 h-3" />
          Send Survey
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-zinc-400" /></div>
      ) : deliveries.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-100 p-6 text-center">
          <ClipboardList className="w-8 h-8 text-zinc-200 mx-auto mb-2" />
          <p className="text-xs text-zinc-500">No surveys sent yet</p>
          <button
            type="button"
            onClick={() => setShowSendModal(true)}
            className="mt-3 px-3 py-1.5 bg-zinc-900 text-white rounded-lg text-xs font-medium"
            data-testid="button-send-first-survey"
          >
            Send a survey
          </button>
        </div>
      ) : (
        <>
          {pendingDeliveries.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-xs font-semibold text-amber-700 mb-2">Awaiting response ({pendingDeliveries.length})</p>
              {pendingDeliveries.map(d => (
                <div key={d.id} className="text-xs text-amber-600 flex items-center gap-2" data-testid={`pending-delivery-${d.id}`}>
                  <Clock className="w-3 h-3 shrink-0" />
                  {d.template.name} — sent {formatDate(d.sentAt)}
                </div>
              ))}
            </div>
          )}

          {completedDeliveries.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Completed responses</p>
              {completedDeliveries.map(d => {
                const response = responses.find(r => r.surveyDeliveryId === d.id);
                return (
                  <div key={d.id} className="bg-white rounded-2xl border border-zinc-100 p-4" data-testid={`completed-delivery-${d.id}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">{d.template.name}</p>
                        <p className="text-xs text-zinc-400">Completed {formatDate(d.completedAt!)}</p>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    </div>
                    {response && (
                      <div className="space-y-2 mt-2">
                        {d.template.questions.map(q => {
                          const answer = response.answers[q.id];
                          return (
                            <div key={q.id} className="text-xs">
                              <p className="text-zinc-500">{q.text}</p>
                              <p className="font-medium text-zinc-900">
                                {answer === null || answer === undefined || answer === "" ? <span className="text-zinc-400 italic">Skipped</span> :
                                  q.type === "rating" ? `${answer}/5` :
                                  q.type === "yes_no" ? (answer ? "Yes" : "No") :
                                  String(answer)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {showSendModal && (
        <SendSurveyModal
          templates={templates}
          onSend={(templateId) => sendMutation.mutate({ surveyTemplateId: templateId })}
          onClose={() => setShowSendModal(false)}
          isPending={sendMutation.isPending}
        />
      )}
    </div>
  );
}

function SendSurveyModal({ templates, onSend, onClose, isPending }: {
  templates: SurveyTemplate[];
  onSend: (templateId: number) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(templates[0]?.id ?? null);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm" data-testid="modal-send-survey">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <h2 className="font-semibold text-zinc-900">Send Survey</h2>
          <button type="button" onClick={onClose} className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg" data-testid="button-close-send-survey">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {templates.length === 0 ? (
            <p className="text-sm text-zinc-500">No survey templates available. Create one in the Surveys tab first.</p>
          ) : (
            <>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-2">Select Survey</label>
                <div className="space-y-2">
                  {templates.map(t => (
                    <label
                      key={t.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${selectedId === t.id ? "border-zinc-900 bg-zinc-50" : "border-zinc-200 hover:border-zinc-300"}`}
                      data-testid={`survey-option-${t.id}`}
                    >
                      <input
                        type="radio"
                        name="survey"
                        checked={selectedId === t.id}
                        onChange={() => setSelectedId(t.id)}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium text-zinc-900">{t.name}</p>
                        <p className="text-xs text-zinc-400">{t.questions.length} question{t.questions.length !== 1 ? "s" : ""}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => selectedId && onSend(selectedId)}
                disabled={!selectedId || isPending}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                data-testid="button-confirm-send-survey"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send Survey
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


export { SurveyManagementPanel, ClientSurveysPanel, SendSurveyModal };
