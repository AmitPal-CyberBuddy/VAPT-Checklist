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

const TONES: Record<ToastTone, { cls: string; Icon: typeof IconCheck }> = {
  success: { cls: 'border-emerald-500/40 text-emerald-300', Icon: IconCheck },
  error: { cls: 'border-rose-500/40 text-rose-300', Icon: IconAlert },
  info: { cls: 'border-brand-500/40 text-brand-400', Icon: IconInfo },
};

function ToastItem({ item }: { item: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss);
  const { cls, Icon } = TONES[item.tone];

  useEffect(() => {
    const timer = setTimeout(() => dismiss(item.id), 5000);
    return () => clearTimeout(timer);
  }, [item.id, dismiss]);

  return (
    <div
      className={clsx(
        'panel animate-in flex w-80 items-start gap-3 border p-3 shadow-xl shadow-ink-950/60',
        cls,
      )}
      role="status"
    >
      <Icon size={16} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-100">{item.message}</p>
        {item.detail && <p className="mt-0.5 text-xs break-words text-ink-400">{item.detail}</p>}
      </div>
      <button
        onClick={() => dismiss(item.id)}
        className="shrink-0 text-ink-500 hover:text-ink-200"
        aria-label="Dismiss"
      >
        <IconX size={14} />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="no-print pointer-events-none fixed right-4 bottom-4 z-[60] flex flex-col items-end gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem item={t} />
        </div>
      ))}
    </div>
  );
}
