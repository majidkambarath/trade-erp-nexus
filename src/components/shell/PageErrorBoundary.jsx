import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { isStaleBuildError } from "../../lib/staleBuild";

// A page that throws while it draws takes the whole React tree with it: with no boundary the
// person sees a white window and has no way back. This catches it, says so in plain words and
// offers the two ways out. The shell (rail, header, tabs) stays up around it, so navigating to
// another page works; `resetKey` is the route, and changing it clears the error.

export default class PageErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Page crashed:", error, info?.componentStack);
  }

  componentDidUpdate(prev) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const stale = isStaleBuildError(error);
    const wholeApp = this.props.scope === "app";
    return (
      <div role="alert" className={`flex items-center justify-center p-6 ${wholeApp ? "min-h-screen" : "py-16"}`}>
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-status-danger-soft text-status-danger">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-foreground">
            {stale ? "A newer version is available" : "Something went wrong on this page"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {stale
              ? "The app was updated while this page was open. Reload to continue with the new version. Nothing you saved is lost."
              : "The page could not be shown. Nothing you saved is lost. Reload the page; if it happens again, tell your administrator what you were doing."}
          </p>
          <div className="mt-5 flex flex-col-reverse justify-center gap-2 sm:flex-row">
            {!stale && (
              <a
                href="/dashboard"
                className="inline-flex h-11 items-center justify-center rounded-lg border border-input px-4 text-sm font-semibold text-foreground hover:bg-accent lg:h-10"
              >
                Go to dashboard
              </a>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 lg:h-10"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Reload page
            </button>
          </div>
          {!stale && (
            <details className="mt-5 text-start">
              <summary className="cursor-pointer text-xs text-muted-foreground">Technical details</summary>
              <p className="mt-2 break-words rounded-lg bg-secondary p-3 font-mono text-xs text-foreground">
                {error.message || String(error)}
              </p>
            </details>
          )}
        </div>
      </div>
    );
  }
}
