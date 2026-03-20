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
import DataSourcesPage from "@/pages/data-sources";
import ForgotPasswordPage from "@/pages/forgot-password";
import ResetPasswordPage from "@/pages/reset-password";
import NotFound from "@/pages/not-found";
import AdminPage from "@/pages/admin";
import PricingPage from "@/pages/pricing";
import BillingPage from "@/pages/billing";
import AccountPage from "@/pages/account";
import NutritionistRegisterPage from "@/pages/nutritionist-register";
import NutritionistPortalPage from "@/pages/nutritionist-portal";
import { useAuth } from "@/hooks/use-auth";
import { TrialModal } from "@/components/trial-modal";
import { UsernamePrompt } from "@/components/username-prompt";
import { AdBanner } from "@/components/ad-banner";
import { ActiveFlowProvider } from "@/contexts/active-flow-context";
import type { TrialInfo } from "@shared/trial";
import { Loader2 } from "lucide-react";

const InsightsPage = lazy(() => import("@/pages/insights"));
const DiaryPage = lazy(() => import("@/pages/diary"));
const MyLibraryPage = lazy(() => import("@/pages/my-library"));
const VitalityInsightsPage = lazy(() => import("@/pages/vitality-insights"));
const NutritionistPage = lazy(() => import("@/pages/nutritionist"));
const ClientMessagesPage = lazy(() => import("@/pages/client-messages"));

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

function TrialModalWrapper() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.isManagedClient) return null;
  const trialInfo = (user as any).trialInfo as TrialInfo | undefined;
  if (!trialInfo) return null;
  return <TrialModal trialInfo={trialInfo} showOnLogin={true} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RootRedirect} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/data-sources" component={DataSourcesPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/billing" component={BillingPage} />
      <Route path="/account" component={AccountPage} />
      <Route path="/nutritionist/register" component={NutritionistRegisterPage} />
      <Route path="/nutritionist/portal" component={NutritionistPortalPage} />
      <Route path="/insights">{() => <Suspense fallback={<LazyFallback />}><InsightsPage /></Suspense>}</Route>
      <Route path="/diary">{() => <Suspense fallback={<LazyFallback />}><DiaryPage /></Suspense>}</Route>
      <Route path="/my-library">{() => <Suspense fallback={<LazyFallback />}><MyLibraryPage /></Suspense>}</Route>
      <Route path="/vitality-insights">{() => <Suspense fallback={<LazyFallback />}><VitalityInsightsPage /></Suspense>}</Route>
      <Route path="/nutritionist">{() => <Suspense fallback={<LazyFallback />}><NutritionistPage /></Suspense>}</Route>
      <Route path="/messages">{() => <Suspense fallback={<LazyFallback />}><ClientMessagesPage /></Suspense>}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ActiveFlowProvider>
          <Toaster />
          <TrialModalWrapper />
          <UsernamePrompt />
          <Router />
          <AdBanner />
        </ActiveFlowProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
