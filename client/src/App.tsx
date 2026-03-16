import { lazy, Suspense } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import AuthPage from "@/pages/auth";
import LandingPage from "@/pages/landing";
import PrivacyPage from "@/pages/privacy";
import TermsPage from "@/pages/terms";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import NotFound from "@/pages/not-found";
import AdminPage from "@/pages/admin";
import PricingPage from "@/pages/pricing";
import BillingPage from "@/pages/billing";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

const InsightsPage = lazy(() => import("@/pages/insights"));
const DiaryPage = lazy(() => import("@/pages/diary"));
const MyLibraryPage = lazy(() => import("@/pages/my-library"));
const VitalityInsightsPage = lazy(() => import("@/pages/vitality-insights"));

function LazyFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
    </div>
  );
}

function RootRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  return <LandingPage loggedIn={!!user} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RootRedirect} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/billing" component={BillingPage} />
      <Route path="/insights">{() => <Suspense fallback={<LazyFallback />}><InsightsPage /></Suspense>}</Route>
      <Route path="/diary">{() => <Suspense fallback={<LazyFallback />}><DiaryPage /></Suspense>}</Route>
      <Route path="/my-library">{() => <Suspense fallback={<LazyFallback />}><MyLibraryPage /></Suspense>}</Route>
      <Route path="/vitality-insights">{() => <Suspense fallback={<LazyFallback />}><VitalityInsightsPage /></Suspense>}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
