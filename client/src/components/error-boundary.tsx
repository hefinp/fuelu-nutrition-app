import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, LayoutDashboard } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error);
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
  }

  handleRetry = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isDark = document.documentElement.classList.contains("dark");

      return (
        <div
          data-testid="error-boundary-fallback"
          className={`min-h-screen flex items-center justify-center px-4 ${isDark ? "bg-zinc-950 text-zinc-100" : "bg-white text-zinc-900"}`}
        >
          <div className="max-w-md w-full text-center space-y-6">
            <div className="flex justify-center">
              <div className={`rounded-full p-4 ${isDark ? "bg-red-500/10" : "bg-red-50"}`}>
                <AlertTriangle className="w-10 h-10 text-red-500" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
              <p className={`text-sm ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                An unexpected error occurred. You can try reloading the page or head back to the dashboard.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                data-testid="button-retry"
                onClick={this.handleRetry}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isDark
                    ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
                    : "bg-zinc-900 text-white hover:bg-zinc-800"
                }`}
              >
                <RefreshCw className="w-4 h-4" />
                Try again
              </button>

              <a
                data-testid="link-dashboard"
                href="/dashboard"
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isDark
                    ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Go to Dashboard
              </a>
            </div>

            {this.state.error && (
              <details className={`text-left text-xs mt-4 ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
                <summary className="cursor-pointer hover:underline">Error details</summary>
                <pre className={`mt-2 p-3 rounded-lg overflow-auto max-h-40 ${isDark ? "bg-zinc-900" : "bg-zinc-50"}`}>
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}