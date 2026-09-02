/**
 * UI primitives — the product's design system.
 * Small, dependency-free components so every screen looks and behaves the same.
 */
import clsx from 'clsx';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';

/* ------------------------------------------------------------------ Button */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-500 text-ink-950 hover:bg-brand-400 border border-brand-400/40 shadow-sm shadow-brand-500/20 font-semibold',
  secondary:
    'bg-ink-800 text-ink-100 hover:bg-ink-700 border border-ink-600',
  ghost: 'bg-transparent text-ink-200 hover:bg-ink-800 border border-transparent',
  subtle: 'bg-ink-850/60 text-ink-200 hover:bg-ink-800 border border-ink-700',
  danger: 'bg-rose-600/90 text-white hover:bg-rose-500 border border-rose-400/30 font-semibold',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-9.5 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-5 text-sm gap-2 rounded-xl',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  full?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  full,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center whitespace-nowrap transition-colors duration-150',
        'disabled:cursor-not-allowed disabled:opacity-45',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        full && 'w-full',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------- Badge */

type BadgeTone =
  | 'neutral'
  | 'brand'
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'vulnerable'
  | 'safe'
  | 'na'
  | 'warn'
  | 'success';

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'bg-ink-800 text-ink-200 border-ink-600',
  brand: 'bg-brand-500/12 text-brand-400 border-brand-500/35',
  critical: 'bg-rose-500/12 text-rose-300 border-rose-500/35',
  high: 'bg-orange-500/12 text-orange-300 border-orange-500/35',
  medium: 'bg-yellow-400/12 text-yellow-200 border-yellow-400/30',
  low: 'bg-sky-500/12 text-sky-300 border-sky-500/30',
  vulnerable: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
  safe: 'bg-emerald-500/12 text-emerald-300 border-emerald-500/35',
  na: 'bg-ink-700/60 text-ink-300 border-ink-600',
  warn: 'bg-amber-500/12 text-amber-300 border-amber-500/35',
  success: 'bg-emerald-500/12 text-emerald-300 border-emerald-500/35',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
  title,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={clsx(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-4 tracking-wide',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export const priorityTone = (priority: string): BadgeTone =>
  ({ Critical: 'critical', High: 'high', Medium: 'medium', Low: 'low' } as const)[
    priority as 'Critical'
  ] ?? 'neutral';

export const resultTone = (result: string | null): BadgeTone =>
  result === 'Vulnerable' ? 'vulnerable' : result === 'Not Vulnerable' ? 'safe' : 'neutral';

/* -------------------------------------------------------------------- Card */

export function Card({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
}) {
  return <Tag className={clsx('panel p-4', className)}>{children}</Tag>;
}

export function SectionHeading({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('flex flex-wrap items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold tracking-wide text-ink-100 uppercase">{title}</h2>
        {description && <p className="mt-1 text-sm text-ink-400">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ Inputs */

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={clsx('block', className)}>
      {label && (
        <span className="mb-1.5 block text-xs font-medium tracking-wide text-ink-300 uppercase">
          {label}
          {required && <span className="ml-1 text-rose-400">*</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-rose-400">{error}</span>}
    </label>
  );
}

const CONTROL =
  'w-full rounded-lg border border-ink-600 bg-ink-900/70 px-3 py-2 text-sm text-ink-100 ' +
  'placeholder:text-ink-500 transition-colors hover:border-ink-500 focus:border-brand-500 ' +
  'focus:outline-none focus:ring-1 focus:ring-brand-500/40 disabled:opacity-50';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(CONTROL, className)} {...rest} />;
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx(CONTROL, 'resize-y leading-relaxed', className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx(CONTROL, 'cursor-pointer pr-8', className)} {...rest}>
      {children}
    </select>
  );
}

/* ------------------------------------------------------------- SegmentedControl */

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  tone?: 'default' | 'vulnerable' | 'safe' | 'na';
  title?: string;
}

const SEGMENT_ACTIVE: Record<string, string> = {
  default: 'bg-brand-500 text-ink-950 border-brand-400',
  vulnerable: 'bg-rose-500/90 text-white border-rose-400',
  safe: 'bg-emerald-500/90 text-ink-950 border-emerald-400',
  na: 'bg-ink-500 text-ink-50 border-ink-400',
};

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
  className,
  disabled,
}: {
  value: T | null;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div
      role="group"
      className={clsx(
        'inline-flex overflow-hidden rounded-lg border border-ink-600 bg-ink-900/70 p-0.5',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            title={option.title}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={clsx(
              'rounded-md border border-transparent font-medium transition-colors duration-150',
              size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
              active
                ? SEGMENT_ACTIVE[option.tone ?? 'default']
                : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ Toggle */

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'inline-flex items-center gap-2 text-sm transition-opacity',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span
        className={clsx(
          'relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-150',
          checked ? 'border-brand-400 bg-brand-500/80' : 'border-ink-600 bg-ink-800',
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-all duration-150',
            checked ? 'left-4.5' : 'left-0.5',
          )}
        />
      </span>
      {label && <span className="text-ink-200">{label}</span>}
    </button>
  );
}

/* ------------------------------------------------------------------- Meter */

export function ProgressBar({
  value,
  tone = 'brand',
  className,
  height = 'md',
}: {
  value: number;
  tone?: 'brand' | 'safe' | 'warn' | 'vuln';
  className?: string;
  height?: 'sm' | 'md';
}) {
  const tones = {
    brand: 'bg-brand-500',
    safe: 'bg-emerald-500',
    warn: 'bg-amber-500',
    vuln: 'bg-rose-500',
  };
  return (
    <div
      className={clsx(
        'w-full overflow-hidden rounded-full bg-ink-800',
        height === 'sm' ? 'h-1.5' : 'h-2',
        className,
      )}
      role="progressbar"
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={clsx('h-full rounded-full transition-[width] duration-500', tones[tone])}
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
      />
    </div>
  );
}

/* --------------------------------------------------------------- EmptyState */

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-ink-700 bg-ink-900/40 px-6 py-14 text-center">
      {icon && <div className="text-ink-500">{icon}</div>}
      <div>
        <p className="text-sm font-semibold text-ink-100">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-md text-sm text-ink-400">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/* -------------------------------------------------------------------- Modal */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  width?: 'sm' | 'md' | 'lg';
}) {
  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/80 p-4 pt-[8vh] backdrop-blur-sm">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden
        role="presentation"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={clsx(
          'panel animate-in relative w-full p-5 shadow-2xl shadow-ink-950/60',
          widths[width],
        )}
      >
        <div className="mb-4">
          <h3 className="text-base font-semibold text-ink-50">{title}</h3>
          {description && <p className="mt-1 text-sm text-ink-400">{description}</p>}
        </div>
        {children}
        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------- Stat */

export function Stat({
  label,
  value,
  hint,
  tone = 'neutral',
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'neutral' | 'vuln' | 'safe' | 'warn' | 'brand';
  className?: string;
}) {
  const tones = {
    neutral: 'text-ink-50',
    vuln: 'text-rose-400',
    safe: 'text-emerald-400',
    warn: 'text-amber-400',
    brand: 'text-brand-400',
  };
  return (
    <div className={clsx('panel-muted px-4 py-3', className)}>
      <p className="text-[11px] font-medium tracking-wider text-ink-400 uppercase">{label}</p>
      <p className={clsx('mt-1 text-2xl font-semibold tabular-nums', tones[tone])}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}
