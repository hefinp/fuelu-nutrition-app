import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, ArrowLeft, ClipboardList, CheckCircle2, Star, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface SurveyQuestion {
  id: string;
  type: "rating" | "yes_no" | "free_text";
  text: string;
  required?: boolean;
}

interface SurveyTemplate {
  id: number;
  name: string;
  description: string | null;
  questions: SurveyQuestion[];
}

interface PendingSurvey {
  id: number;
  surveyTemplateId: number;
  sentAt: string;
  template: SurveyTemplate;
}

type AnswerValue = string | number | boolean | null;

function RatingInput({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap" data-testid="rating-input">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          data-testid={`rating-option-${n}`}
          className={`w-9 h-9 rounded-full border-2 text-sm font-semibold transition-all ${
            value === n
              ? "border-emerald-600 bg-emerald-600 text-white shadow-md"
              : "border-zinc-200 text-zinc-600 hover:border-emerald-400 hover:text-emerald-600"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function YesNoInput({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex gap-3" data-testid="yes-no-input">
      <button
        type="button"
        onClick={() => onChange(true)}
        data-testid="yes-no-yes"
        className={`px-6 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
          value === true
            ? "border-emerald-600 bg-emerald-600 text-white"
            : "border-zinc-200 text-zinc-600 hover:border-emerald-400"
        }`}
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        data-testid="yes-no-no"
        className={`px-6 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
          value === false
            ? "border-rose-500 bg-rose-500 text-white"
            : "border-zinc-200 text-zinc-600 hover:border-rose-300"
        }`}
      >
        No
      </button>
    </div>
  );
}

function SurveyForm({
  survey,
  onSubmitted,
}: {
  survey: PendingSurvey;
  onSubmitted: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/my-nutritionist/surveys/${survey.id}/respond`, { answers }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-nutritionist/surveys/pending"] });
      setSubmitted(true);
      setTimeout(onSubmitted, 1600);
    },
    onError: (e: Error) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function setAnswer(questionId: string, value: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function canSubmit() {
    for (const q of survey.template.questions) {
      if (q.required !== false) {
        const ans = answers[q.id];
        if (ans === undefined || ans === null || ans === "") return false;
      }
    }
    return true;
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4" data-testid="survey-submitted">
        <CheckCircle2 className="w-14 h-14 text-emerald-500" />
        <p className="text-lg font-semibold text-zinc-800">Thanks for your feedback!</p>
        <p className="text-sm text-zinc-500">Your response has been submitted.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="survey-form">
      {survey.template.questions.map((q, idx) => (
        <div key={q.id} className="bg-white rounded-2xl border border-zinc-100 p-5 shadow-sm" data-testid={`question-${q.id}`}>
          <p className="text-sm font-semibold text-zinc-800 mb-1">
            <span className="text-zinc-400 font-normal mr-1">{idx + 1}.</span>
            {q.text}
            {q.required !== false && <span className="text-rose-400 ml-1">*</span>}
          </p>
          <div className="mt-3">
            {q.type === "rating" && (
              <RatingInput
                value={typeof answers[q.id] === "number" ? (answers[q.id] as number) : null}
                onChange={(v) => setAnswer(q.id, v)}
              />
            )}
            {q.type === "yes_no" && (
              <YesNoInput
                value={typeof answers[q.id] === "boolean" ? (answers[q.id] as boolean) : null}
                onChange={(v) => setAnswer(q.id, v)}
              />
            )}
            {q.type === "free_text" && (
              <Textarea
                value={typeof answers[q.id] === "string" ? (answers[q.id] as string) : ""}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                placeholder="Type your answer here..."
                className="resize-none min-h-[80px]"
                data-testid={`textarea-${q.id}`}
              />
            )}
          </div>
        </div>
      ))}

      <Button
        onClick={() => submitMutation.mutate()}
        disabled={!canSubmit() || submitMutation.isPending}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-3"
        data-testid="button-submit-survey"
      >
        {submitMutation.isPending ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
        ) : (
          "Submit Response"
        )}
      </Button>
    </div>
  );
}

export default function MySurveysPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [activeSurveyId, setActiveSurveyId] = useState<number | null>(null);

  const { data: surveys = [], isLoading } = useQuery<PendingSurvey[]>({
    queryKey: ["/api/my-nutritionist/surveys/pending"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/my-nutritionist/surveys/pending");
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user?.isManagedClient,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!user?.isManagedClient) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <ClipboardList className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
          <p className="text-zinc-500">Surveys are only available for managed clients.</p>
          <Link href="/dashboard">
            <Button variant="outline" className="mt-4" data-testid="link-back-dashboard">
              Go to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const activeSurvey = activeSurveyId ? surveys.find((s) => s.id === activeSurveyId) : null;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/dashboard" data-testid="link-back">
            <button className="p-2 rounded-xl hover:bg-zinc-100 transition-colors text-zinc-500">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-zinc-900" data-testid="page-title">My Surveys</h1>
            <p className="text-sm text-zinc-500">Feedback requested by your nutritionist</p>
          </div>
        </div>

        {activeSurvey ? (
          <div>
            <div className="mb-6">
              <button
                onClick={() => setActiveSurveyId(null)}
                className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-800 transition-colors mb-4"
                data-testid="button-back-to-list"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to surveys
              </button>
              <h2 className="text-lg font-bold text-zinc-900" data-testid="survey-title">{activeSurvey.template.name}</h2>
              {activeSurvey.template.description && (
                <p className="text-sm text-zinc-500 mt-1" data-testid="survey-description">{activeSurvey.template.description}</p>
              )}
            </div>
            <SurveyForm
              survey={activeSurvey}
              onSubmitted={() => setActiveSurveyId(null)}
            />
          </div>
        ) : (
          <div>
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
              </div>
            ) : surveys.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4" data-testid="no-surveys">
                <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center">
                  <ClipboardList className="w-8 h-8 text-zinc-400" />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-zinc-700">No pending surveys</p>
                  <p className="text-sm text-zinc-400 mt-1">You're all caught up! Check back later.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3" data-testid="survey-list">
                {surveys.map((survey) => (
                  <button
                    key={survey.id}
                    onClick={() => setActiveSurveyId(survey.id)}
                    className="w-full bg-white rounded-2xl border border-zinc-100 p-4 shadow-sm hover:shadow-md transition-all flex items-center gap-4 text-left group"
                    data-testid={`survey-card-${survey.id}`}
                  >
                    <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
                      <ClipboardList className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-zinc-800 truncate">{survey.template.name}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {survey.template.questions.length} question{survey.template.questions.length !== 1 ? "s" : ""}
                        {survey.template.description && ` · ${survey.template.description}`}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:text-zinc-500 transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
