import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, MessageSquare, Send, FolderOpen, FileText, Download } from "lucide-react";

interface Message {
  id: number;
  nutritionistId: number;
  clientId: number;
  senderId: number;
  body: string;
  isRead: boolean;
  createdAt: string;
}

interface SharedDocument {
  id: number;
  filename: string;
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

export default function ClientMessagesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newMessage, setNewMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"messages" | "documents">("messages");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading, error } = useQuery<Message[]>({
    queryKey: ["/api/my-nutritionist/messages"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/my-nutritionist/messages");
      if (!res.ok) {
        if (res.status === 403) throw new Error("not_linked");
        throw new Error("Failed to fetch messages");
      }
      return res.json();
    },
    enabled: !!user,
    refetchInterval: 5000,
    retry: (count, err) => (err as Error)?.message !== "not_linked" && count < 3,
  });

  const { data: documents = [], isLoading: docsLoading } = useQuery<SharedDocument[]>({
    queryKey: ["/api/client/documents"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/client/documents");
      if (!res.ok) {
        if (res.status === 403) throw new Error("not_linked");
        throw new Error("Failed to fetch documents");
      }
      return res.json();
    },
    enabled: !!user,
    retry: (count, err) => (err as Error)?.message !== "not_linked" && count < 3,
  });

  const sendMutation = useMutation({
    mutationFn: (body: string) =>
      apiRequest("POST", "/api/my-nutritionist/messages", { body }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-nutritionist/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-nutritionist/messages/unread-count"] });
      setNewMessage("");
    },
    onError: () => toast({ title: "Failed to send message", variant: "destructive" }),
  });

  useEffect(() => {
    if (scrollRef.current && activeTab === "messages") {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, activeTab]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

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

  const isNotLinked = (error as Error)?.message === "not_linked";

  if (isNotLinked) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center p-8 max-w-md">
          <MessageSquare className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-zinc-900 mb-2">No nutritionist linked</h2>
          <p className="text-sm text-zinc-500 mb-4">You are not currently linked to a nutritionist. Messages will be available once a nutritionist adds you as a client.</p>
          <Link href="/dashboard" className="text-sm text-zinc-900 font-semibold underline" data-testid="link-back-dashboard">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const sorted = [...messages].reverse();

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-100 sticky top-0 z-50 safe-area-inset-top">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 transition-colors"
            data-testid="link-back-dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-zinc-600" />
            <h1 className="font-display font-bold text-lg text-zinc-900">My Nutritionist</h1>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 flex gap-1 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("messages")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-medium transition-colors ${activeTab === "messages" ? "bg-zinc-900 text-white" : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}
            data-testid="tab-messages"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Messages
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("documents")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-sm font-medium transition-colors ${activeTab === "documents" ? "bg-zinc-900 text-white" : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50"}`}
            data-testid="tab-documents"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Documents
            {documents.length > 0 && (
              <span className={`ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${activeTab === "documents" ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-600"}`}>
                {documents.length}
              </span>
            )}
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto">
        {activeTab === "messages" && (
          <div className="bg-white min-h-[calc(100vh-7rem)] flex flex-col">
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3" data-testid="client-message-thread">
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
                </div>
              ) : sorted.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <MessageSquare className="w-12 h-12 text-zinc-200 mb-4" />
                  <p className="text-sm font-medium text-zinc-500" data-testid="state-no-client-messages">No messages yet</p>
                  <p className="text-xs text-zinc-400 mt-1">Your nutritionist can send you messages here</p>
                </div>
              ) : (
                sorted.map(msg => {
                  const isMe = msg.senderId === user.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                      data-testid={`client-message-${msg.id}`}
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
            <div className="border-t border-zinc-100 p-3 flex items-end gap-2 sticky bottom-0 bg-white">
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
                data-testid="input-client-message"
              />
              <button
                type="button"
                onClick={() => newMessage.trim() && sendMutation.mutate(newMessage.trim())}
                disabled={!newMessage.trim() || sendMutation.isPending}
                className="flex items-center justify-center w-10 h-10 bg-zinc-900 text-white rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-colors flex-shrink-0"
                data-testid="button-send-client-message"
              >
                {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}

        {activeTab === "documents" && (
          <div className="bg-white min-h-[calc(100vh-7rem)] p-4" data-testid="client-documents-panel">
            {docsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
              </div>
            ) : documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <FolderOpen className="w-12 h-12 text-zinc-200 mb-4" />
                <p className="text-sm font-medium text-zinc-500" data-testid="state-no-shared-documents">No documents shared yet</p>
                <p className="text-xs text-zinc-400 mt-1">Your nutritionist can share files, lab results, and handouts here</p>
              </div>
            ) : (
              <div className="space-y-2" data-testid="client-document-list">
                <p className="text-xs text-zinc-400 mb-3">{documents.length} document{documents.length !== 1 ? "s" : ""} shared with you</p>
                {documents.map(doc => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-3 p-3 border border-zinc-100 rounded-xl hover:bg-zinc-50 transition-colors"
                    data-testid={`client-doc-${doc.id}`}
                  >
                    <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-zinc-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-900 truncate" data-testid={`client-doc-filename-${doc.id}`}>{doc.filename}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-zinc-400">{formatFileSize(doc.size)}</span>
                        <span className="text-zinc-300">·</span>
                        <span className="text-xs text-zinc-400">
                          {new Date(doc.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                    </div>
                    <a
                      href={`/api/client/documents/${doc.id}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors flex-shrink-0"
                      title="Download"
                      data-testid={`client-button-download-${doc.id}`}
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
