/** Lightweight toast system (zustand store + renderer). */
import { useCallback, useEffect, useRef, useState } from 'react';
import { create } from 'zustand';
import clsx from 'clsx';
import { IconAlert, IconCheck, IconInfo, IconX } from './icons';

export type ToastTone = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
  detail?: string;
}

interface ToastStore {
  toasts: Toast[];
  push: (tone: ToastTone, message: string, detail?: string) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (tone, message, detail) =>
    set((s) => ({ toasts: [...s.toasts, { id: ++seq, tone, message, detail }] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (message: string, detail?: string) =>
    useToastStore.getState().push('success', message, detail),
  error: (message: string, detail?: string) =>
    useToastStore.getState().push('error', message, detail),
  info: (message: string, detail?: string) =>
    useToastStore.getState().push('info', message, detail),
};

const TONES: Record<ToastTone, { cls: string; rail: string; bar: string; Icon: typeof IconCheck }> = {
  success: {
    cls: 'border-safe-500/40 text-safe-400',
    rail: 'rail-safe',
    bar: 'bg-safe-500',
    Icon: IconCheck,
  },
  error: {
    cls: 'border-vuln-500/40 text-vuln-400',
    rail: 'rail-vuln',
    bar: 'bg-vuln-500',
    Icon: IconAlert,
  },
  info: {
    cls: 'border-brand-500/40 text-brand-400',
    rail: 'rail-brand',
    bar: 'bg-brand-500',
    Icon: IconInfo,
  },
};

/** Auto-dismiss window, shared by the JS timer and the countdown bar. */
const TOAST_DURATION = 5000;

function ToastItem({ item }: { item: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Time left until auto-dismiss; survives pause/resume cycles. */
  const remaining = useRef(TOAST_DURATION);

  /**
   * Dismissal is a two-beat exit: mark the toast as leaving so it can sink
   * and fade, then drop it from the store once the animation has had its
   * (very short) say. A second request is a no-op.
   */
  const beginDismiss = useCallback(() => {
    if (leaveTimer.current) return;
    setLeaving(true);
    leaveTimer.current = setTimeout(() => dismiss(item.id), 150);
  }, [dismiss, item.id]);

  /**
   * The auto-dismiss clock. Hovering or focusing the toast pauses it — and
   * the countdown bar pauses with it, because both read this one state.
   */
  useEffect(() => {
    if (paused || leaving) return;
    const startedAt = Date.now();
    const timer = setTimeout(beginDismiss, remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt));
    };
  }, [paused, leaving, beginDismiss, item.id]);

  useEffect(
    () => () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    },
    [],
  );

  const { cls, rail, bar, Icon } = TONES[item.tone];

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={clsx(
        'toast panel floating relative flex w-80 max-w-full items-start gap-3 overflow-hidden border p-3 pl-3.5',
        leaving ? 'toast-out' : 'animate-toast',
        cls,
        rail,
      )}
    >
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-current bg-ink-900/60">
        <Icon size={14} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-100">{item.message}</p>
        {item.detail && <p className="mt-0.5 text-xs break-words text-ink-400">{item.detail}</p>}
      </div>
      <button
        onClick={beginDismiss}
        className="shrink-0 rounded text-ink-400 transition-colors hover:text-ink-100"
        aria-label="Dismiss notification"
      >
        <IconX size={14} />
      </button>
      {/* The countdown: drains over the auto-dismiss window, pausing on
          hover/focus exactly when the timer does. */}
      <span
        aria-hidden="true"
        className={clsx('toast-countdown absolute bottom-0 left-0 h-0.5 w-full origin-left', bar)}
        style={{ animationDuration: `${TOAST_DURATION}ms` }}
      />
    </div>
  );
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="no-print pointer-events-none fixed right-3 bottom-3 z-[60] flex max-w-[calc(100vw-1.5rem)] flex-col items-end gap-2 sm:right-4 sm:bottom-4">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem item={t} />
        </div>
      ))}
    </div>
  );
}
