/**
 * UI primitives — the product's design system.
 *
 * Every screen composes these; none rolls its own button, badge or panel.
 * Two rules the components enforce so the app reads as one tool:
 *
 *  1. **One vocabulary.** Status is always Not Tested / Tested / N/A and
 *     result is always Vulnerable / Not Vulnerable, rendered by
 *     StatusBadge / ResultBadge — no screen invents a synonym.
 *  2. **Never colour alone.** Every status, result and priority carries a
 *     glyph and a text label as well as a hue, so the UI works for colour-blind
 *     users, in greyscale print and in a screen reader.
 */
import { forwardRef, useEffect, useId, useRef } from 'react';
import clsx from 'clsx';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import type { Priority, TestResult, TestStatus } from '../domain/types';

/* ------------------------------------------------------------------ Button */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand-500 text-ink-950 hover:bg-brand-400 border border-brand-400/40 font-semibold',
  secondary: 'bg-ink-800 text-ink-100 hover:bg-ink-700 border border-ink-600',
  subtle: 'bg-ink-850 text-ink-200 hover:bg-ink-800 border border-ink-700',
  ghost: 'bg-transparent text-ink-300 hover:bg-ink-800 hover:text-ink-100 border border-transparent',
  danger: 'bg-vuln-500 text-white hover:bg-vuln-400 border border-vuln-400/30 font-semibold',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-xs gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
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
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        'inline-flex items-center justify-center rounded-[--radius-control] whitespace-nowrap',
        'transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-45',
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

/** Icon-only button. `label` is mandatory — it becomes the accessible name. */
export function IconButton({
  label,
  icon,
  variant = 'ghost',
  size = 'md',
  className,
  ...rest
}: Omit<ButtonProps, 'children' | 'icon'> & { label: string; icon: ReactNode }) {
  return (
    <Button
      variant={variant}
      size={size}
      aria-label={label}
      title={label}
      className={clsx(size === 'sm' ? 'w-8 px-0' : 'w-9 px-0', className)}
      {...rest}
    >
      {icon}
    </Button>
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
  brand: 'bg-brand-500/12 text-brand-400 border-brand-500/40',
  critical: 'bg-vuln-500/15 text-vuln-400 border-vuln-500/45',
  high: 'bg-orange-500/12 text-orange-300 border-orange-500/40',
  medium: 'bg-amber-400/12 text-amber-200 border-amber-400/35',
  low: 'bg-brand-500/10 text-brand-400 border-brand-500/30',
  vulnerable: 'bg-vuln-500/15 text-vuln-400 border-vuln-500/45',
  safe: 'bg-safe-500/12 text-safe-400 border-safe-500/40',
  na: 'bg-ink-800 text-ink-300 border-ink-600',
  warn: 'bg-amber-500/12 text-amber-300 border-amber-500/40',
  success: 'bg-safe-500/12 text-safe-400 border-safe-500/40',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
  title,
  glyph,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
  title?: string;
  /** Decorative shape shown before the label; hidden from assistive tech. */
  glyph?: string;
}) {
  return (
    <span
      title={title}
      className={clsx(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5',
        'text-[11px] leading-4 font-medium whitespace-nowrap',
        BADGE_TONES[tone],
        className,
      )}
    >
      {glyph && (
        <span aria-hidden="true" className="font-mono text-[10px] leading-none">
          {glyph}
        </span>
      )}
      {children}
    </span>
  );
}

/* -------------------------------------------- canonical status vocabulary */

const PRIORITY_TONE: Record<Priority, BadgeTone> = {
  Critical: 'critical',
  High: 'high',
  Medium: 'medium',
  Low: 'low',
};

/** Shape encodes severity without relying on hue. */
const PRIORITY_GLYPH: Record<Priority, string> = {
  Critical: '▰▰▰',
  High: '▰▰▱',
  Medium: '▰▱▱',
  Low: '▱▱▱',
};

export const priorityTone = (priority: string): BadgeTone =>
  PRIORITY_TONE[priority as Priority] ?? 'neutral';

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <Badge
      tone={PRIORITY_TONE[priority]}
      glyph={PRIORITY_GLYPH[priority]}
      className={className}
      title={`${priority} priority`}
    >
      {priority}
    </Badge>
  );
}

const STATUS_GLYPH: Record<TestStatus, string> = {
  'Not Tested': '○',
  Tested: '●',
  'N/A': '⊘',
};

export function StatusBadge({ status, className }: { status: TestStatus; className?: string }) {
  return (
    <Badge
      tone={status === 'Tested' ? 'brand' : status === 'N/A' ? 'na' : 'neutral'}
      glyph={STATUS_GLYPH[status]}
      className={className}
      title={`Status: ${status}`}
    >
      {status}
    </Badge>
  );
}

const RESULT_GLYPH: Record<TestResult, string> = {
  Vulnerable: '▲',
  'Not Vulnerable': '✓',
};

export function ResultBadge({
  result,
  className,
}: {
  result: TestResult | null;
  className?: string;
}) {
  if (!result) return null;
  return (
    <Badge
      tone={result === 'Vulnerable' ? 'vulnerable' : 'safe'}
      glyph={RESULT_GLYPH[result]}
      className={className}
      title={`Result: ${result}`}
    >
      {result}
    </Badge>
  );
}

export const resultTone = (result: string | null): BadgeTone =>
  result === 'Vulnerable' ? 'vulnerable' : result === 'Not Vulnerable' ? 'safe' : 'neutral';

/* ------------------------------------------------------------ layout parts */

export function Card({
  children,
  className,
  as: Tag = 'div',
  padded = true,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'aside';
  padded?: boolean;
} & { 'aria-labelledby'?: string }) {
  return (
    <Tag className={clsx('panel', padded && 'p-4', className)} {...rest}>
      {children}
    </Tag>
  );
}

/** Page-level title block. Every top-level screen starts with one. */
export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {breadcrumb && <div className="mb-1 text-xs text-ink-400">{breadcrumb}</div>}
        <h1 className="text-xl font-semibold tracking-tight text-ink-50 sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-ink-400">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionHeading({
  title,
  description,
  actions,
  className,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div className={clsx('flex flex-wrap items-start justify-between gap-x-4 gap-y-2', className)}>
      <div className="min-w-0">
        <h2 id={id} className="text-sm font-semibold tracking-wide text-ink-100 uppercase">
          {title}
        </h2>
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
          {required && (
            <>
              <span aria-hidden="true" className="ml-1 text-vuln-400">
                *
              </span>
              <span className="sr-only"> (required)</span>
            </>
          )}
        </span>
      )}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-400">{hint}</span>}
      {error && (
        <span role="alert" className="mt-1 block text-xs text-vuln-400">
          {error}
        </span>
      )}
    </label>
  );
}

const CONTROL =
  'w-full rounded-[--radius-control] border border-ink-600 bg-ink-950/60 px-3 py-2 text-sm ' +
  'text-ink-100 placeholder:text-ink-500 transition-colors hover:border-ink-500 ' +
  'focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/40 ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={clsx(CONTROL, className)} {...rest} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return (
      <textarea ref={ref} className={clsx(CONTROL, 'resize-y leading-relaxed', className)} {...rest} />
    );
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select ref={ref} className={clsx(CONTROL, 'cursor-pointer pr-8', className)} {...rest}>
        {children}
      </select>
    );
  },
);

/** Labelled select for toolbars, where a visible label would cost too much room. */
export function FilterSelect({
  label,
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <Select aria-label={label} title={label} className={className} {...rest}>
      {children}
    </Select>
  );
}

/* ------------------------------------------------------- SegmentedControl */

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  tone?: 'default' | 'vulnerable' | 'safe' | 'na';
  title?: string;
  glyph?: string;
}

const SEGMENT_ACTIVE: Record<string, string> = {
  default: 'bg-brand-500 text-ink-950 border-brand-400',
  vulnerable: 'bg-vuln-500 text-white border-vuln-400',
  safe: 'bg-safe-500 text-ink-950 border-safe-400',
  na: 'bg-ink-600 text-ink-50 border-ink-500',
};

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  size = 'md',
  className,
  disabled,
  label,
}: {
  value: T | null;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  className?: string;
  disabled?: boolean;
  /** Accessible name for the group of choices. */
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={clsx(
        'inline-flex overflow-hidden rounded-[--radius-control] border border-ink-600 bg-ink-950/60 p-0.5',
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
            role="radio"
            aria-checked={active}
            tabIndex={active || (value === null && options[0] === option) ? 0 : -1}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={clsx(
              'inline-flex items-center gap-1 rounded-[calc(var(--radius-control)-2px)] border',
              'border-transparent font-medium transition-colors duration-150',
              size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs',
              active
                ? SEGMENT_ACTIVE[option.tone ?? 'default']
                : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100',
            )}
          >
            {option.glyph && (
              <span aria-hidden="true" className="font-mono text-[10px] leading-none">
                {option.glyph}
              </span>
            )}
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
  const id = useId();
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={typeof label === 'string' ? label : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'inline-flex items-center gap-2 text-sm',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <span
        className={clsx(
          'relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-150',
          checked ? 'border-brand-400 bg-brand-500' : 'border-ink-600 bg-ink-800',
        )}
      >
        <span
          className={clsx(
            'absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all duration-150',
            checked ? 'left-4.5 bg-ink-950' : 'left-0.5 bg-ink-400',
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
  label,
}: {
  value: number;
  tone?: 'brand' | 'safe' | 'warn' | 'vuln';
  className?: string;
  height?: 'sm' | 'md';
  label?: string;
}) {
  const tones = {
    brand: 'bg-brand-500',
    safe: 'bg-safe-500',
    warn: 'bg-amber-500',
    vuln: 'bg-vuln-500',
  };
  const percent = Math.round(Math.min(100, Math.max(0, value * 100)));
  return (
    <div
      className={clsx(
        'w-full overflow-hidden rounded-full bg-ink-800',
        height === 'sm' ? 'h-1.5' : 'h-2',
        className,
      )}
      role="progressbar"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={`${percent}% complete`}
    >
      <div
        className={clsx('h-full rounded-full transition-[width] duration-500', tones[tone])}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

/* --------------------------------------------------------------- Feedback */

export function EmptyState({
  title,
  description,
  action,
  icon,
  compact,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center gap-3 rounded-[--radius-panel]',
        'border border-dashed border-ink-700 bg-ink-900/50 px-6 text-center',
        compact ? 'py-8' : 'py-14',
      )}
    >
      {icon && <div className="text-ink-500">{icon}</div>}
      <div>
        <p className="text-sm font-semibold text-ink-100">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-md text-sm text-ink-400">{description}</p>}
      </div>
      {action}
    </div>
  );
}

const ALERT_TONES = {
  info: 'border-brand-500/30 bg-brand-500/5 text-brand-400',
  warn: 'border-amber-500/30 bg-amber-500/5 text-amber-300',
  error: 'border-vuln-500/35 bg-vuln-500/5 text-vuln-400',
  success: 'border-safe-500/30 bg-safe-500/5 text-safe-400',
} as const;

export function InlineAlert({
  tone = 'info',
  icon,
  title,
  children,
  action,
  className,
}: {
  tone?: keyof typeof ALERT_TONES;
  icon?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className={clsx(
        'flex items-start gap-3 rounded-[--radius-panel] border p-3',
        ALERT_TONES[tone],
        className,
      )}
    >
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1 text-sm">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className="mt-0.5 text-ink-300">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ Modal */

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
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/85 p-4 pt-[8vh]">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={clsx('panel animate-in relative w-full p-5 outline-none', widths[width])}
      >
        <div className="mb-4">
          <h2 id={titleId} className="text-base font-semibold text-ink-50">
            {title}
          </h2>
          {description && <p className="mt-1 text-sm text-ink-400">{description}</p>}
        </div>
        {children}
        {footer && <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div>}
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
  glyph,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'neutral' | 'vuln' | 'safe' | 'warn' | 'brand';
  className?: string;
  glyph?: string;
}) {
  const tones = {
    neutral: 'text-ink-50',
    vuln: 'text-vuln-400',
    safe: 'text-safe-400',
    warn: 'text-amber-400',
    brand: 'text-brand-400',
  };
  return (
    <div className={clsx('panel-inset px-3 py-2.5', className)}>
      <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-wider text-ink-400 uppercase">
        {glyph && (
          <span aria-hidden="true" className="font-mono text-[10px]">
            {glyph}
          </span>
        )}
        {label}
      </p>
      <p className={clsx('mt-1 text-2xl leading-tight font-semibold tabular-nums', tones[tone])}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------- Skeleton */

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded bg-ink-800', className)} aria-hidden="true" />;
}

/** Consistent loading placeholder. Announced once, not per element. */
export function LoadingPanel({ rows = 4, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div className="panel space-y-3 p-4" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-4 w-40" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}
