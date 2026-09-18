/**
 * Per-panel error containment.
 *
 * The router's `errorComponent` only catches what escapes the whole tree, so a
 * single malformed message or a broken media element used to blank the entire
 * workspace. Each region of the shell is wrapped instead: a thrown render in
 * the message list leaves the sidebar, the composer and the panels usable, and
 * the failed region offers a retry rather than a lost session.
 */

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

/** The card shows one line; the console keeps the stack. */
function summarize(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error.trim();
  return "Unexpected error";
}

interface PanelErrorBoundaryProps {
  /** Human name of the region, used in the fallback copy and in reports. */
  label: string;
  children: ReactNode;
  /**
   * Changing this value clears a stuck error. Passing the active room id means
   * switching conversations recovers from a message that cannot be rendered,
   * instead of stranding the user on the fallback.
   */
  resetKey?: string | number;
  /** Replaces the default card, e.g. for a compact rail. */
  fallback?: (retry: () => void, message: string) => ReactNode;
}

interface PanelErrorBoundaryState {
  error: unknown;
  resetKey: string | number | undefined;
}

export class PanelErrorBoundary extends Component<
  PanelErrorBoundaryProps,
  PanelErrorBoundaryState
> {
  override state: PanelErrorBoundaryState = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: unknown): Partial<PanelErrorBoundaryState> {
    return { error };
  }

  static getDerivedStateFromProps(
    props: PanelErrorBoundaryProps,
    state: PanelErrorBoundaryState,
  ): Partial<PanelErrorBoundaryState> | null {
    if (props.resetKey !== state.resetKey) {
      return { error: null, resetKey: props.resetKey };
    }
    return null;
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    // Keep the stack in the console: the fallback deliberately shows only a
    // one-line summary to the user.
    console.error(`[${this.props.label}] render failed`, error, info.componentStack);
  }

  private retry = () => this.setState({ error: null });

  override render() {
    if (!this.state.error) return this.props.children;

    const message = summarize(this.state.error);
    if (this.props.fallback) return this.props.fallback(this.retry, message);

    return (
      <div
        role="alert"
        className="flex h-full min-h-[160px] w-full items-center justify-center bg-background p-6"
      >
        <div className="glass flex max-w-sm flex-col items-center rounded-xl border border-border p-6 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <h3 className="mt-3 text-sm font-semibold">This panel stopped responding</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {this.props.label} could not be displayed. The rest of your workspace is still working.
          </p>
          <p className="mt-2 max-w-full break-words text-[11px] text-muted-foreground/80">
            {message}
          </p>
          <button
            type="button"
            onClick={this.retry}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Try again
          </button>
        </div>
      </div>
    );
  }
}
