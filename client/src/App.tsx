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
import InsightsPage from "@/pages/insights";
import DiaryPage from "@/pages/diary";
import { useAuth } from "@/hooks/use-auth";

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
      <Route path="/insights" component={InsightsPage} />
      <Route path="/diary" component={DiaryPage} />
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
