import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, InlineAlert } from '../ui/primitives';
import { IconAlert } from '../ui/icons';

/**
 * Error boundary.
 *
 * On a static deploy there is no server-side logging and no operator to notice
 * a crash: an unhandled render error is a white page, and a tester mid-
 * assessment has no idea whether their work survived. It did — every recorded
 * status, result and note is already in IndexedDB — but nothing on a blank
 * screen says so.
 *
 * This catches the render, says what happened, states plainly that the data is
 * safe, and offers a way out that does not involve losing the tab.
 */

interface Props {
  children: ReactNode;
  /** Identifies which part of the app failed, for the message. */
  area?: string;
  /** Changing this value clears the error — used to recover on navigation. */
  resetKey?: string;
}

interface State {
  error: Error | null;
  componentStack: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? null });
    // No telemetry by design; the console is the only place to leave a trace.
    console.error('[VAPT Checklist] render error', error, info.componentStack);
  }

  componentDidUpdate(previous: Props) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null, componentStack: null });
    }
  }

  render() {
    const { error, componentStack } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="mx-auto max-w-2xl py-8">
        <InlineAlert
          tone="error"
          icon={<IconAlert size={20} aria-hidden="true" />}
          title={`Something went wrong${this.props.area ? ` in the ${this.props.area}` : ''}`}
        >
          <p className="text-ink-200">
            <strong className="text-ink-100">Your assessment is safe.</strong> Every status, result
            and note you recorded is already stored in this browser — this failure is in the
            interface, not the data.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => this.setState({ error: null, componentStack: null })}
            >
              Try again
            </Button>
            <Button
              size="sm"
              onClick={() => {
                window.location.hash = '#/';
                this.setState({ error: null, componentStack: null });
              }}
            >
              Back to engagements
            </Button>
            <Button size="sm" variant="subtle" onClick={() => window.location.reload()}>
              Reload the page
            </Button>
          </div>

          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-ink-400 hover:text-ink-200">
              Technical detail
            </summary>
            <pre className="mt-2 max-h-56 overflow-auto rounded-(--radius-control) border border-ink-700 bg-ink-950 p-3 text-micro whitespace-pre-wrap text-ink-300">
              {error.message}
              {componentStack}
            </pre>
          </details>
        </InlineAlert>
      </div>
    );
  }
}
