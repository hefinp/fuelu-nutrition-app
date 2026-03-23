import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, ChevronUp, ChevronDown, Send, Check, Loader2 } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Category = "bug" | "feature" | "general";

const CATEGORIES: { value: Category; label: string; emoji: string }[] = [
  { value: "bug", label: "Bug Report", emoji: "🐛" },
  { value: "feature", label: "Feature Request", emoji: "✨" },
  { value: "general", label: "General Feedback", emoji: "💬" },
];

export function FeedbackWidget() {
  const widgetRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>("general");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const submitMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/feedback", { category, message }).then(r => r.json()),
    onSuccess: () => {
      setSubmitted(true);
      setMessage("");
      setTimeout(() => {
        setSubmitted(false);
        setOpen(false);
      }, 3500);
    },
    onError: (err: Error) => {
      setError(err.message || "Something went wrong. Please try again.");
    },
  });

  function handleSubmit() {
    setError("");
    if (message.trim().length < 10) {
      setError("Please give us a bit more detail (min 10 characters).");
      return;
    }
    submitMutation.mutate();
  }

  return (
    <div ref={widgetRef} className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-6 mb-20 sm:mb-0">
      <div className="border border-zinc-100 rounded-2xl overflow-hidden bg-white shadow-lg">
        <button
          data-testid="button-feedback-toggle"
          onClick={() => {
            setOpen(o => {
              if (!o) {
                setTimeout(() => widgetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
              }
              return !o;
            });
            setError("");
          }}
          className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-zinc-400" />
            Beta Feedback
            <span className="text-xs bg-zinc-100 text-zinc-500 px-1.5 py-0.5 rounded-full font-normal">Help us improve</span>
          </span>
          {open ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-24 sm:pb-5 pt-1 border-t border-zinc-100">
                <AnimatePresence mode="wait">
                  {submitted ? (
                    <motion.div
                      key="thanks"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center py-6 gap-3 text-center"
                    >
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <Check className="w-5 h-5 text-green-600" />
                      </div>
                      <p className="font-medium text-zinc-800">Thank you for your feedback!</p>
                      <p className="text-sm text-zinc-500">We read every submission. This panel will close shortly.</p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="form"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-4 pt-3"
                    >
                      <div>
                        <p className="text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wide">Category</p>
                        <div className="flex gap-2 flex-wrap">
                          {CATEGORIES.map(cat => (
                            <button
                              key={cat.value}
                              data-testid={`button-feedback-category-${cat.value}`}
                              onClick={() => setCategory(cat.value)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all ${
                                category === cat.value
                                  ? "bg-zinc-900 text-white border-zinc-900 font-medium"
                                  : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-400"
                              }`}
                            >
                              <span>{cat.emoji}</span>
                              {cat.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wide">Message</p>
                        <Textarea
                          data-testid="textarea-feedback-message"
                          value={message}
                          onChange={e => setMessage(e.target.value)}
                          placeholder={
                            category === "bug"
                              ? "Describe what happened and what you expected to happen..."
                              : category === "feature"
                              ? "Describe the feature you'd like and why it would help..."
                              : "Share any thoughts, suggestions, or impressions..."
                          }
                          className="resize-none min-h-[100px] text-sm"
                          maxLength={2000}
                        />
                        <div className="flex items-center justify-between mt-1">
                          {error ? (
                            <p className="text-xs text-red-500">{error}</p>
                          ) : (
                            <span />
                          )}
                          <span className="text-xs text-zinc-400 ml-auto">{message.length}/2000</span>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <Button
                          data-testid="button-feedback-submit"
                          onClick={handleSubmit}
                          disabled={submitMutation.isPending}
                          size="sm"
                          className="bg-zinc-900 hover:bg-zinc-700 text-white gap-2"
                        >
                          {submitMutation.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          Send Feedback
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
