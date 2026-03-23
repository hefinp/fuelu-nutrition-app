import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function VerifyEmailPage() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");

  useEffect(() => {
    if (!isLoading && user?.emailVerified) {
      setLocation("/dashboard");
    }
    if (!isLoading && !user && !error) {
      setLocation("/auth");
    }
  }, [isLoading, user, error, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950">
        <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (user?.emailVerified || (!user && !error)) {
    return null;
  }

  const handleResend = async () => {
    setSending(true);
    try {
      const res = await apiRequest("POST", "/api/auth/send-verification", {});
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message);
      }
      setSent(true);
      toast({ title: "Verification email sent", description: "Check your inbox for the verification link." });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to send verification email";
      toast({ title: "Failed to send", description: message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4">
      <Card className="w-full max-w-md" data-testid="verify-email-card">
        <CardContent className="pt-8 pb-8 px-6 text-center">
          {error === "invalid_token" || error === "missing_token" ? (
            <>
              <div className="mx-auto w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
                <AlertCircle className="w-7 h-7 text-red-600 dark:text-red-400" />
              </div>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2" data-testid="text-verify-title">
                Invalid verification link
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
                This verification link is invalid or has already been used. Please request a new one.
              </p>
            </>
          ) : error === "expired_token" ? (
            <>
              <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
                <AlertCircle className="w-7 h-7 text-amber-600 dark:text-amber-400" />
              </div>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2" data-testid="text-verify-title">
                Verification link expired
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
                This verification link has expired. Verification links are valid for 24 hours. Please request a new one below.
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto w-14 h-14 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
                <Mail className="w-7 h-7 text-zinc-600 dark:text-zinc-300" />
              </div>
              <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2" data-testid="text-verify-title">
                Check your email
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
                We've sent a verification email to:
              </p>
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-4" data-testid="text-verify-email">
                {user?.email}
              </p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
                Click the link in the email to verify your account and get started. The link expires in 24 hours.
              </p>
            </>
          )}

          {!user ? null : sent ? (
            <div className="flex items-center justify-center gap-2 text-sm text-green-600 dark:text-green-400" data-testid="text-resend-success">
              <CheckCircle2 className="w-4 h-4" />
              <span>Verification email sent!</span>
            </div>
          ) : (
            <Button
              onClick={handleResend}
              disabled={sending}
              variant="outline"
              className="w-full"
              data-testid="button-resend-verification"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                "Resend verification email"
              )}
            </Button>
          )}

          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-4">
            Didn't receive the email? Check your spam folder or request a new one.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
