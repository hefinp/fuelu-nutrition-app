import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { MessageCircle, Send, Trash2, Loader2 } from "lucide-react";
import type { MealComment } from "@shared/schema";
import { ReportButton } from "@/components/report-content-dialog";

type CommentWithUser = MealComment & { userName: string };

function timeAgo(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

export function MealCommentsSection({ communityMealId }: { communityMealId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [newComment, setNewComment] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: comments = [], isLoading } = useQuery<CommentWithUser[]>({
    queryKey: ["/api/community-meals", communityMealId, "comments"],
    queryFn: async () => {
      const res = await fetch(`/api/community-meals/${communityMealId}/comments`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch comments");
      return res.json();
    },
    enabled: isExpanded,
  });

  const postMutation = useMutation({
    mutationFn: (text: string) =>
      apiRequest("POST", `/api/community-meals/${communityMealId}/comments`, { text }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community-meals", communityMealId, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/community-meals/comment-counts"] });
      setNewComment("");
    },
    onError: () => toast({ title: "Failed to post comment", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/community-meals/comments/${id}`, undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community-meals", communityMealId, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/community-meals/comment-counts"] });
    },
    onError: () => toast({ title: "Failed to delete comment", variant: "destructive" }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newComment.trim();
    if (!trimmed) return;
    postMutation.mutate(trimmed);
  };

  return (
    <div className="mt-3" data-testid={`comments-section-${communityMealId}`}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-700 font-medium transition-colors"
        data-testid={`button-toggle-comments-${communityMealId}`}
      >
        <MessageCircle className="w-3.5 h-3.5" />
        {isExpanded ? "Hide comments" : "Comments"}
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-3">
              <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-[11px] text-zinc-400 py-1" data-testid={`text-no-comments-${communityMealId}`}>No comments yet. Be the first!</p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {comments.map(comment => (
                <div
                  key={comment.id}
                  className="flex items-start gap-2 bg-zinc-50 rounded-lg px-2.5 py-2"
                  data-testid={`comment-${comment.id}`}
                >
                  <div className="w-5 h-5 rounded-full bg-zinc-200 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-[9px] font-bold text-zinc-500">{comment.userName?.charAt(0)?.toUpperCase() ?? "?"}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-zinc-700">{comment.userName}</span>
                      <span className="text-[10px] text-zinc-400">{timeAgo(comment.createdAt)}</span>
                    </div>
                    <p className="text-xs text-zinc-600 mt-0.5 break-words">{comment.text}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {user && user.id !== comment.userId && (
                      <ReportButton contentType="comment" contentId={comment.id} />
                    )}
                    {user && user.id === comment.userId && (
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate(comment.id)}
                        className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
                        data-testid={`button-delete-comment-${comment.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex gap-1.5" data-testid={`form-comment-${communityMealId}`}>
            <input
              type="text"
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              maxLength={500}
              className="flex-1 text-xs px-3 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-300 bg-white"
              data-testid={`input-comment-${communityMealId}`}
            />
            <button
              type="submit"
              disabled={!newComment.trim() || postMutation.isPending}
              className="px-2.5 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-700 transition-colors disabled:opacity-40 flex items-center justify-center"
              data-testid={`button-post-comment-${communityMealId}`}
            >
              {postMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
