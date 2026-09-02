import { toast } from '../ui/toast';

/**
 * Background failures used to disappear entirely: a rejected promise outside a
 * component, or an error thrown from a timer or event handler, produced a
 * console entry nobody was reading and no sign in the interface.
 *
 * These handlers surface them once, without turning a repeating failure into a
 * wall of toasts.
 */

const RECENT_WINDOW_MS = 10_000;
const recent = new Map<string, number>();

function reportOnce(title: string, detail: string) {
  const now = Date.now();
  for (const [key, at] of recent) if (now - at > RECENT_WINDOW_MS) recent.delete(key);
  const key = `${title}:${detail}`;
  if (recent.has(key)) return;
  recent.set(key, now);
  toast.error(title, detail);
}

function describe(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (typeof reason === 'string') return reason;
  try {
    return JSON.stringify(reason).slice(0, 200);
  } catch {
    return String(reason);
  }
}

/** Installed once at start-up. Returns a teardown for tests. */
export function installGlobalErrorHandlers(): () => void {
  const onRejection = (event: PromiseRejectionEvent) => {
    console.error('[VAPT Checklist] unhandled rejection', event.reason);
    reportOnce('Something failed in the background', describe(event.reason));
  };

  const onError = (event: ErrorEvent) => {
    // Resource load failures (a missing asset) arrive here with no message.
    if (!event.message) return;
    console.error('[VAPT Checklist] uncaught error', event.error ?? event.message);
    reportOnce('Unexpected error', event.message);
  };

  window.addEventListener('unhandledrejection', onRejection);
  window.addEventListener('error', onError);
  return () => {
    window.removeEventListener('unhandledrejection', onRejection);
    window.removeEventListener('error', onError);
  };
}
