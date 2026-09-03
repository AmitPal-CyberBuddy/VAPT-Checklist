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
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import type {
  ButtonHTMLAttributes,
  CSSProperties,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import type { Priority, TestResult, TestStatus } from '../domain/types';
import {
  IconAlert,
  IconBan,
  IconCheck,
  IconCircle,
  IconCircleFilled,
  IconExternal,
} from './icons';

/* ------------------------------------------------------------------ Button */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  // Button surfaces live in styles.css (.btn-*) so gradients, borders, halos
  // and pressed states stay theme-aware in one place. Only the ink (text)
  // and weight ride along here.
  primary: 'btn-primary text-ink-950 font-semibold',
  secondary: 'btn-secondary text-ink-100',
  subtle: 'btn-subtle text-ink-200',
  ghost: 'btn-ghost text-ink-300 hover:text-ink-100',
  danger: 'btn-danger text-white font-semibold',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-2.5 text-xs gap-1.5',
  md: 'h-9 px-3 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
};

/** The single source of button styling — shared with LinkButton. */
export function buttonClass(
  variant: ButtonVariant = 'secondary',
  size: ButtonSize = 'md',
  full?: boolean,
  className?: string,
) {
  return clsx(
    'inline-flex items-center justify-center rounded-(--radius-control) whitespace-nowrap',
    // Variant surfaces (.btn-*) own the border, shadow, glow and the 1px
    // press sink; JSX never squeezes, lifts or nudges a button. Disabled
    // buttons drop their halo (pointer-events gated in styles.css) and dim.
    'disabled:cursor-not-allowed disabled:opacity-45',
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    full && 'w-full',
    className,
  );
}

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
    <button type={type} className={buttonClass(variant, size, full, className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}

/**
 * A navigation link that looks and behaves like a button. Screens must use this
 * rather than restyling an anchor, so link-buttons and buttons never diverge.
 */
export function LinkButton({
  to,
  variant = 'secondary',
  size = 'md',
  icon,
  full,
  className,
  children,
}: {
  to: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  full?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} className={buttonClass(variant, size, full, className)}>
      {icon}
      {children}
    </Link>
  );
}

/**
 * A button for an external URL (a real `href`, opens in a new tab). Same visual
 * system as `Button`/`LinkButton`, but scrolls off-site instead of navigating
 * within the app — used for LinkedIn, the issue tracker and other outbound
 * links that must not look like a second-class control.
 */
export function ExternalButton({
  href,
  variant = 'secondary',
  size = 'md',
  icon,
  full,
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  full?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={buttonClass(variant, size, full, className)}
    >
      {icon}
      {children}
      {/* An outbound glyph so a new tab is never a surprise. */}
      <IconExternal size={13} aria-hidden="true" className="opacity-70" />
    </a>
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
  // Quiet tint chips — pills, not plaques. Only the two strongest states
  // (vulnerable, critical) earn a border, so red reads as an event without
  // the whole surface shouting. Text steps flip with the theme.
  neutral: 'bg-ink-800/70 text-ink-300',
  brand: 'bg-brand-500/12 text-brand-400',
  critical: 'bg-vuln-500/15 text-vuln-400 border-vuln-500/45',
  high: 'bg-high-500/12 text-high-300',
  medium: 'bg-medium-400/12 text-medium-200',
  low: 'bg-ink-800/70 text-ink-400',
  vulnerable: 'bg-vuln-500/15 text-vuln-400 border-vuln-500/45',
  safe: 'bg-safe-500/12 text-safe-400',
  na: 'bg-ink-850 text-ink-400',
  warn: 'bg-warn-500/12 text-warn-300',
  success: 'bg-safe-500/12 text-safe-400',
};;

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
  /** Decorative icon shown before the label; hidden from assistive tech. */
  glyph?: ReactNode;
}) {
  return (
    <span
      title={title}
      className={clsx(
        // A pill with a transparent border slot, so bordered (strong) and
        // borderless (quiet) tones keep identical metrics.
        'inline-flex items-center gap-1 rounded-full border border-transparent px-2 py-0.5',
        'text-micro leading-4 font-medium whitespace-nowrap',
        BADGE_TONES[tone],
        className,
      )}
    >
      {glyph && (
        <span aria-hidden="true" className="flex shrink-0 items-center leading-none">
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

/** Bar count encodes severity without relying on hue. */
const PRIORITY_BARS: Record<Priority, number> = {
  Critical: 3,
  High: 2,
  Medium: 1,
  Low: 0,
};

const PRIORITY_BAR_FILL: Record<Priority, string> = {
  Critical: 'bg-vuln-500',
  High: 'bg-high-500',
  Medium: 'bg-medium-400',
  Low: 'bg-ink-500',
};

/** A three-bar signal meter — severity at a glance, in shape as well as hue.
 *  Rendered small enough to sit inside a micro badge. */
function PriorityMeter({ priority }: { priority: Priority }) {
  const active = PRIORITY_BARS[priority];
  return (
    <span aria-hidden="true" className="flex shrink-0 items-end gap-px">
      {[1, 2, 3].map((bar) => (
        <span
          key={bar}
          className={clsx(
            'w-[3px] rounded-[1px]',
            bar === 1 ? 'h-1.5' : bar === 2 ? 'h-2' : 'h-2.5',
            bar <= active ? PRIORITY_BAR_FILL[priority] : 'bg-ink-600',
          )}
        />
      ))}
    </span>
  );
}

export const priorityTone = (priority: string): BadgeTone =>
  PRIORITY_TONE[priority as Priority] ?? 'neutral';

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <Badge
      tone={PRIORITY_TONE[priority]}
      glyph={<PriorityMeter priority={priority} />}
      className={className}
      title={`${priority} priority`}
    >
      {priority}
    </Badge>
  );
}

/** Status iconography — one drawn icon per state, stroked heavier for badge
 *  size. Never colour alone: icon + label + hue together. */
const STATUS_ICON: Record<TestStatus, ReactNode> = {
  'Not Tested': <IconCircle size={11} strokeWidth={2.5} />,
  Tested: <IconCircleFilled size={11} />,
  'N/A': <IconBan size={11} strokeWidth={2.5} />,
};

/**
 * Status tooltips. The status axis is about the *outcome of testing one test
 * that is already in the checklist*, which is a different question from whether
 * the test belongs in the checklist at all (Applicability). The N/A hint spells
 * that out so it never reads as a synonym for the "Not Applicable" scope value.
 */
const STATUS_HINT: Record<TestStatus, string> = {
  'Not Tested': 'Status: Not Tested',
  Tested: 'Status: Tested',
  'N/A': 'N/A — assessed, and this target does not exercise it in practice.',
};

export function StatusBadge({ status, className }: { status: TestStatus; className?: string }) {
  return (
    <Badge
      tone={status === 'Tested' ? 'brand' : status === 'N/A' ? 'na' : 'neutral'}
      glyph={STATUS_ICON[status]}
      className={className}
      title={STATUS_HINT[status]}
    >
      {status}
    </Badge>
  );
}

const RESULT_ICON: Record<TestResult, ReactNode> = {
  Vulnerable: <IconAlert size={11} strokeWidth={2.5} />,
  'Not Vulnerable': <IconCheck size={11} strokeWidth={3} />,
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
      glyph={RESULT_ICON[result]}
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
  style,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article' | 'aside';
  padded?: boolean;
  style?: CSSProperties;
} & { 'aria-labelledby'?: string }) {
  return (
    <Tag className={clsx('panel', padded && 'p-4', className)} style={style} {...rest}>
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
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: ReactNode;
  /** Small mono kicker above the title — the screen's section in the tool. */
  eyebrow?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1.5 font-mono text-micro tracking-widest text-brand-400 uppercase">
            {eyebrow}
          </p>
        )}
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
        <h2
          id={id}
          className="flex items-center gap-2 text-sm font-semibold tracking-wide text-ink-100 uppercase"
        >
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-ink-400">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ Inputs */

/**
 * A labelled single form control.
 *
 * The wrapping `<label>` implicitly labels the FIRST labellable descendant, so
 * this must never wrap a group of controls: the first one would inherit the
 * label, the hint and every sibling's text as its accessible name. Use
 * `FieldGroup` for anything with more than one control.
 */
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

/**
 * A labelled *group* of controls — chips, toggles, segmented choices.
 * `fieldset`/`legend` names the group without hijacking the first child.
 */
export function FieldGroup({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={clsx('block min-w-0 border-0 p-0', className)}>
      <legend className="mb-1.5 block text-xs font-medium tracking-wide text-ink-300 uppercase">
        {label}
      </legend>
      {children}
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </fieldset>
  );
}

const CONTROL =
  'w-full rounded-(--radius-control) border border-ink-600 bg-ink-950/60 px-3 py-2 text-sm ' +
  'text-ink-100 placeholder:text-ink-500 transition-[border-color,box-shadow] duration-150 hover:border-ink-500 ' +
  // Form controls focus with the same halo language as the buttons (the
  // global :focus-visible outline is suppressed on them, so it cannot weaken
  // here).
  'focus:border-brand-400 focus:outline-none focus:shadow-(--glow-brand) ' +
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
      <select
        ref={ref}
        className={clsx(CONTROL, 'select-chevron cursor-pointer pr-8', className)}
        {...rest}
      >
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
  glyph?: ReactNode;
}

/* The active segment is a tinted glass chip with its own small halo —
   defined in styles.css (.seg-on-*) so each theme gets a properly
   contrasted surface. Solid fills made every choice look like a toy
   button; the tint reads as a state, which is what a segment is. */
const SEGMENT_ACTIVE: Record<string, string> = {
  default: 'seg-on-brand',
  vulnerable: 'seg-on-vuln',
  safe: 'seg-on-safe',
  na: 'seg-on-neutral',
};

/* The active label sits ON the sliding indicator, so it only needs its
   foreground colour — the indicator carries the surface and border. */
const SEGMENT_ACTIVE_TEXT: Record<string, string> = {
  default: 'text-seg-brand',
  vulnerable: 'text-seg-vuln',
  safe: 'text-seg-safe',
  na: 'text-seg-neutral',
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
  const activeIndex = options.findIndex((option) => option.value === value);
  const segmentWidth = 100 / Math.max(1, options.length);

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={clsx(
        'relative inline-grid auto-cols-fr grid-flow-col overflow-hidden rounded-(--radius-control) border border-ink-600 bg-ink-950/60 p-0.5',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
    >
      {/* The sliding indicator: one surface that travels between the equal
          segments, so the choice change reads as one motion, not two states.
          Hidden while no value is set, exactly like the labels. */}
      {activeIndex >= 0 && (
        <span
          aria-hidden="true"
          className={clsx(
            'top-0.5 bottom-0.5 rounded-[calc(var(--radius-control)-2px)] border transition-[left] duration-200',
            SEGMENT_ACTIVE[options[activeIndex].tone ?? 'default'],
          )}
          style={{
            left: `calc(${activeIndex * segmentWidth}% + 2px)`,
            width: `calc(${segmentWidth}% - 4px)`,
            transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      )}
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
              'relative z-10 inline-flex items-center justify-center gap-1 rounded-[calc(var(--radius-control)-2px)] border border-transparent font-medium transition-[color,background-color] duration-150',
              size === 'sm' ? 'px-2 py-1 text-micro' : 'px-2.5 py-1.5 text-xs',
              active
                ? SEGMENT_ACTIVE_TEXT[option.tone ?? 'default']
                : 'text-ink-300 hover:bg-ink-800/60 hover:text-ink-100',
            )}
          >
            {option.glyph && (
              <span aria-hidden="true" className="flex shrink-0 items-center leading-none">
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
  height?: 'sm' | 'md' | 'lg';
  label?: string;
}) {
  const tones = {
    brand: 'bg-brand-500',
    safe: 'bg-safe-500',
    warn: 'bg-warn-500',
    vuln: 'bg-vuln-500',
  };
  const percent = Math.round(Math.min(100, Math.max(0, value * 100)));
  return (
    <div
      className={clsx(
        'progress-track w-full overflow-hidden rounded-full',
        height === 'sm' ? 'h-1.5' : height === 'md' ? 'h-2' : 'h-3',
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
        className={clsx(
          'progress-sheen h-full rounded-full transition-[width] duration-500',
          tones[tone],
        )}
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
  children,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  compact?: boolean;
  /** Optional supporting content below the action (e.g. a how-it-works grid). */
  children?: ReactNode;
}) {
  return (
    <div
      className={clsx(
        'animate-in flex flex-col items-center justify-center gap-3 rounded-(--radius-panel)',
        'border border-dashed border-ink-600 bg-ink-900/40 px-6 text-center',
        compact ? 'py-8' : 'py-14',
      )}
    >
      {icon && (
        <div className="icon-tile">
          <div className="flex h-12 w-12 items-center justify-center rounded-(--radius-control) border border-ink-600 bg-ink-850 text-ink-300 shadow-[inset_0_1px_0_rgb(141_156_178/0.06)]">
            {icon}
          </div>
        </div>
      )}
      <div>
        <p className="text-sm font-semibold text-ink-100">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-md text-sm text-ink-400">{description}</p>}
      </div>
      {action}
      {children}
    </div>
  );
}

const ALERT_TONES = {
  info: 'border-brand-500/30 bg-brand-500/5 text-brand-400',
  warn: 'border-warn-500/30 bg-warn-500/5 text-warn-300',
  error: 'border-vuln-500/35 bg-vuln-500/5 text-vuln-400',
  success: 'border-safe-500/30 bg-safe-500/5 text-safe-400',
} as const;

/* A 2px accent rail at the scan edge anchors each alert's meaning. */
const ALERT_RAIL = {
  info: 'border-l-brand-500/70',
  warn: 'border-l-warn-500/70',
  error: 'border-l-vuln-500/70',
  success: 'border-l-safe-500/70',
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
        'flex items-start gap-3 rounded-(--radius-panel) border border-l-2 p-3',
        ALERT_TONES[tone],
        ALERT_RAIL[tone],
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
    const previous = document.activeElement as HTMLElement | null;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      // Focus trap: cycle within the dialog instead of escaping to the page.
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeEl = document.activeElement;
      if (event.shiftKey && (activeEl === first || activeEl === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeEl === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' };

  return (
    <div className="animate-in fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/85 p-4 pt-[8vh] backdrop-blur-sm">
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
        className={clsx('panel floating animate-rise relative w-full p-5 outline-none', widths[width])}
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
  featured,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'neutral' | 'vuln' | 'safe' | 'warn' | 'brand';
  className?: string;
  glyph?: ReactNode;
  /** Featured metrics are larger and carry a meaning-tinted surface. */
  featured?: boolean;
}) {
  const tones = {
    neutral: 'text-ink-50',
    vuln: 'text-vuln-400',
    safe: 'text-safe-400',
    warn: 'text-warn-300',
    brand: 'text-brand-400',
  };
  /* The semantic rail at the scan edge — colour plus the glyph and label. */
  const rails: Record<typeof tone, string> = {
    neutral: '',
    vuln: 'rail-vuln',
    safe: 'rail-safe',
    warn: 'rail-warn',
    brand: 'rail-brand',
  };
  const tint = featured
    ? tone === 'vuln'
      ? 'tile-vuln'
      : tone === 'warn'
        ? 'tile-warn'
        : tone === 'brand'
          ? 'tile-brand'
          : tone === 'safe'
            ? 'tile-safe'
            : ''
    : '';
  return (
    <div
      className={clsx(
        featured ? 'featured-metric' : 'metric-tile',
        'relative overflow-hidden',
        tone !== 'neutral' && rails[tone],
        tint,
        className,
      )}
    >
      <p className="flex items-center gap-1.5 text-micro font-medium tracking-wider text-ink-400 uppercase">
        {glyph && (
          <span aria-hidden="true" className="flex shrink-0 items-center leading-none">
            {glyph}
          </span>
        )}
        {label}
      </p>
      <p
        className={clsx(
          featured
            ? 'metric-featured-value'
            : 'text-2xl leading-tight font-semibold tracking-tight tabular-nums',
          tones[tone],
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------- Skeleton */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx('skeleton-sheen animate-pulse rounded-md bg-ink-800', className)}
      aria-hidden="true"
    />
  );
}

/** Politely announces a message to screen readers without showing it. */
export function LiveAnnouncement({ message }: { message: string }) {
  return (
    <p aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </p>
  );
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
