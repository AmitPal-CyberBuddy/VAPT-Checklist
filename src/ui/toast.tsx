/** Lightweight toast system (zustand store + renderer). */
import { useEffect } from 'react';
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

const TONES: Record<ToastTone, { cls: string; rail: string; Icon: typeof IconCheck }> = {
  success: { cls: 'border-safe-500/40 text-safe-400', rail: 'rail-safe', Icon: IconCheck },
  error: { cls: 'border-vuln-500/40 text-vuln-400', rail: 'rail-vuln', Icon: IconAlert },
  info: { cls: 'border-brand-500/40 text-brand-400', rail: 'rail-brand', Icon: IconInfo },
};

function ToastItem({ item }: { item: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const { cls, rail, Icon } = TONES[item.tone];

  useEffect(() => {
    const timer = setTimeout(() => dismiss(item.id), 5000);
    return () => clearTimeout(timer);
  }, [item.id, dismiss]);

  return (
    <div
      className={clsx(
        'panel animate-toast flex w-80 max-w-full items-start gap-3 border p-3 pl-3.5',
        cls,
        rail,
      )}
    >
      <Icon size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-100">{item.message}</p>
        {item.detail && <p className="mt-0.5 text-xs break-words text-ink-400">{item.detail}</p>}
      </div>
      <button
        onClick={() => dismiss(item.id)}
        className="shrink-0 rounded text-ink-400 transition-colors hover:text-ink-100"
        aria-label="Dismiss notification"
      >
        <IconX size={14} />
      </button>
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
