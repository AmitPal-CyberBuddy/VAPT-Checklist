import clsx from 'clsx';
import {
  CONTEXT_FACTS,
  CONTEXT_SECTIONS,
  isFactVisible,
  type ApplicationContext,
  type ContextFactKey,
  type FactDefinition,
} from '../../domain/context';
import { Badge, Card, SectionHeading, Select } from '../../ui/primitives';
import { FACT_IMPACT } from '../../data/library';

/**
 * Renders the Application Context form directly from the schema, so adding a
 * fact in src/domain/context.ts is enough to expose it everywhere.
 * Every fact is tri-state: Yes / No / Unknown (unknown = keep the test in).
 */

type Tri = 'yes' | 'no' | 'unknown';

function triOf(value: unknown): Tri {
  if (value === true) return 'yes';
  if (value === false) return 'no';
  return 'unknown';
}

function TriControl({
  value,
  onChange,
}: {
  value: Tri;
  onChange: (v: boolean | undefined) => void;
}) {
  const options: { key: Tri; label: string; active: string; next: boolean | undefined }[] = [
    { key: 'yes', label: 'Yes', active: 'bg-safe-500 text-ink-950 border-safe-400', next: true },
    { key: 'no', label: 'No', active: 'bg-ink-600 text-ink-50 border-ink-500', next: false },
    { key: 'unknown', label: 'Unknown', active: 'bg-amber-500 text-ink-950 border-amber-400', next: undefined },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Answer"
      className="inline-flex rounded-[--radius-control] border border-ink-600 bg-ink-950/60 p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={value === o.key}
          tabIndex={value === o.key ? 0 : -1}
          onClick={() => onChange(o.next)}
          className={clsx(
            'rounded-md border border-transparent px-2.5 py-1 text-micro font-medium transition-colors',
            value === o.key ? o.active : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function MultiControl({
  fact,
  value,
  onChange,
}: {
  fact: FactDefinition;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {fact.options?.map((o) => {
        const active = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() =>
              onChange(active ? value.filter((v) => v !== o.value) : [...value, o.value])
            }
            aria-pressed={active}
            className={clsx(
              'rounded-[--radius-control] border px-2.5 py-1 text-xs transition-colors',
              active
                ? 'border-brand-500/60 bg-brand-500/15 text-brand-400'
                : 'border-ink-600 bg-ink-950/40 text-ink-300 hover:border-ink-500 hover:text-ink-100',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function FactRow({
  fact,
  context,
  onChange,
}: {
  fact: FactDefinition;
  context: ApplicationContext;
  onChange: (key: ContextFactKey, value: boolean | string | string[] | undefined) => void;
}) {
  const value = context[fact.key];
  const unknown =
    value === undefined || (Array.isArray(value) && value.length === 0) || value === '';
  const impact = FACT_IMPACT.get(fact.key) ?? 0;

  return (
    <div
      className={clsx(
        'flex flex-col gap-2 rounded-[--radius-control] border px-3 py-2 transition-colors sm:flex-row sm:items-center sm:justify-between',
        unknown ? 'border-ink-800 bg-ink-950/30' : 'border-ink-700 bg-ink-850',
      )}
    >
      <div className="min-w-0 sm:pr-6">
        <p className="flex flex-wrap items-center gap-2 text-sm text-ink-100">
          {fact.label}
          {fact.metadataOnly ? (
            <Badge tone="neutral" title="Recorded in the report; does not change applicability">
              Report only
            </Badge>
          ) : (
            impact > 0 && (
              <Badge tone="brand" title={`This answer decides ${impact} test(s)`}>
                {impact} tests
              </Badge>
            )
          )}
        </p>
        {fact.hint && <p className="mt-0.5 text-xs text-ink-400">{fact.hint}</p>}
      </div>
      <div className="shrink-0">
        {fact.type === 'boolean' && (
          <TriControl value={triOf(value)} onChange={(v) => onChange(fact.key, v)} />
        )}
        {fact.type === 'single' && (
          <Select
            aria-label={fact.label}
            value={(value as string) ?? ''}
            onChange={(e) => onChange(fact.key, e.target.value || undefined)}
            className="w-full sm:w-64"
          >
            <option value="">Unknown</option>
            {fact.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        )}
        {fact.type === 'multi' && (
          <MultiControl
            fact={fact}
            value={(value as string[]) ?? []}
            onChange={(v) => onChange(fact.key, v.length ? v : undefined)}
          />
        )}
      </div>
    </div>
  );
}

export function ContextForm({
  context,
  onChange,
  coreOnly = false,
}: {
  context: ApplicationContext;
  onChange: (key: ContextFactKey, value: boolean | string | string[] | undefined) => void;
  coreOnly?: boolean;
}) {
  // Conditional questions: a fact whose parent is answered "no" is not asked.
  const sections = CONTEXT_SECTIONS.map((section) => ({
    section,
    facts: CONTEXT_FACTS.filter(
      (f) => f.section === section.id && (!coreOnly || f.core) && isFactVisible(f, context),
    ),
  })).filter((s) => s.facts.length > 0);

  return (
    <div className="space-y-5">
      {sections.map(({ section, facts }) => (
        <Card key={section.id} className="space-y-3">
          <SectionHeading title={section.title} description={section.description} />
          <div className="space-y-2">
            {facts.map((fact) => (
              <FactRow key={fact.key} fact={fact} context={context} onChange={onChange} />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

export function contextCompleteness(context: ApplicationContext): {
  answered: number;
  total: number;
  ratio: number;
} {
  const total = CONTEXT_FACTS.length;
  const answered = CONTEXT_FACTS.filter((f) => {
    const v = context[f.key];
    return v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);
  }).length;
  return { answered, total, ratio: total === 0 ? 0 : answered / total };
}
