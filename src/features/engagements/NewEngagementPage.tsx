import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  PriorityBadge,
  ProgressBar,
  SectionHeading,
  Textarea,
} from '../../ui/primitives';
import { IconChevron, IconShield } from '../../ui/icons';
import { ContextForm, contextCompleteness } from '../context/ContextForm';
import { TEST_LIBRARY } from '../../data/library';
import { suggestApplicability } from '../../domain/applicability';
import {
  effectiveContext,
  type ApplicationContext,
  type ContextFactKey,
} from '../../domain/context';
import type { ApplicationTypeId } from '../../domain/applicationType';
import { safeExternalUrl, TEXT_LIMITS } from '../../domain/untrusted';
import { coverageFor } from '../../data/typeCoverage';
import { ApplicationTypeDetail, ApplicationTypePicker } from './ApplicationTypeStep';
import { PRIORITY_ORDER, type Priority } from '../../domain/types';
import { createEngagement } from '../../persistence/repository';
import { toast } from '../../ui/toast';

const STEPS = [
  { id: 1, title: 'Engagement', hint: 'Name and target' },
  { id: 2, title: 'Application type', hint: 'Establishes the testing domain' },
  { id: 3, title: 'Context', hint: 'Questions for that domain' },
  { id: 4, title: 'Review', hint: 'Confirm the generated checklist' },
];

export default function NewEngagementPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const [showAllFacts, setShowAllFacts] = useState(false);

  const [name, setName] = useState('');
  const [applicationUrl, setApplicationUrl] = useState('');
  const [clientName, setClientName] = useState('');
  const [testerName, setTesterName] = useState('');
  const [scopeText, setScopeText] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [context, setContext] = useState<ApplicationContext>({});
  const [applicationType, setApplicationType] = useState<ApplicationTypeId | null>(null);

  const coverage = applicationType ? coverageFor(applicationType) : null;
  const typeUsable = coverage !== null && coverage.support !== 'unsupported';

  const setFact = (key: ContextFactKey, value: boolean | string | string[] | undefined) =>
    setContext((c) => {
      const next = { ...c };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return next;
    });

  /** What the engine sees: the recorded context plus the derived asset types. */
  const resolvedContext = useMemo(
    () => (applicationType ? effectiveContext({ applicationType, context }) : context),
    [applicationType, context],
  );

  const preview = useMemo(() => {
    const evaluated = TEST_LIBRARY.map((definition) => ({
      definition,
      suggestion: suggestApplicability(definition, resolvedContext),
    }));
    const applicable = evaluated.filter((i) => i.suggestion.applicable);
    const byPriority = { Critical: 0, High: 0, Medium: 0, Low: 0 } as Record<Priority, number>;
    for (const i of applicable) byPriority[i.definition.priority] += 1;
    return {
      applicable,
      excluded: evaluated.filter((i) => !i.suggestion.applicable),
      uncertain: applicable.filter((i) => i.suggestion.uncertain),
      byPriority,
    };
  }, [resolvedContext]);

  // Matches the questions actually rendered, which the "show all" toggle changes.
  const completeness = contextCompleteness(context, applicationType ?? undefined, {
    coreOnly: !showAllFacts,
  });
  const canContinue = name.trim().length > 0;
  const canReachContext = canContinue && typeUsable;

  async function handleCreate() {
    if (!canContinue || !applicationType || !typeUsable || saving) return;
    setSaving(true);
    try {
      const engagement = await createEngagement({
        name,
        applicationType,
        applicationUrl,
        clientName,
        testerName,
        description,
        startDate,
        endDate,
        scope: scopeText.split('\n').map((s) => s.trim()).filter(Boolean),
        context,
      });
      toast.success('Engagement created', `${preview.applicable.length} applicable tests seeded.`);
      navigate(`/e/${engagement.id}`);
    } catch (error) {
      toast.error('Could not create engagement', String(error));
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        breadcrumb={
          <button onClick={() => navigate('/')} className="rounded hover:text-ink-200">
            ← Back to engagements
          </button>
        }
        title="New engagement"
        eyebrow="New assessment"
        description="Describe the target once. The applicable test list is derived from it — and you stay free to override any decision later."
      />

      <ol className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-0">
        {STEPS.map((s, index) => {
          const done = step > s.id;
          const current = step === s.id;
          const reachable =
            s.id === 1 || (s.id === 2 && canContinue) || (s.id > 2 && canReachContext);
          return (
            <li key={s.id} className="flex flex-1 flex-col gap-0 sm:min-w-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (s.id === 1) setStep(1);
                    else if (s.id === 2 && canContinue) setStep(2);
                    else if (s.id > 2 && canReachContext) setStep(s.id);
                  }}
                  disabled={!reachable}
                  aria-current={current ? 'step' : undefined}
                  className={clsx(
                    'flex shrink-0 items-center gap-2.5 text-left transition-opacity',
                    reachable ? 'cursor-pointer opacity-100' : 'cursor-not-allowed opacity-40',
                  )}
                >
                  <span
                    className={clsx(
                      'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all duration-150',
                      done
                        ? 'bg-safe-500 text-ink-950'
                        : current
                          ? 'glow-active bg-brand-500 text-ink-950'
                          : 'border border-ink-600 bg-ink-850 text-ink-400',
                    )}
                    aria-hidden="true"
                  >
                    {done ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4.5 12.5l5 5 10-11" />
                      </svg>
                    ) : (
                      s.id
                    )}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={clsx(
                        'block truncate text-sm font-medium',
                        current ? 'text-ink-50' : done ? 'text-ink-200' : 'text-ink-300',
                      )}
                    >
                      {s.title}
                    </span>
                    <span className="block truncate text-micro text-ink-400">{s.hint}</span>
                  </span>
                </button>
                {index < STEPS.length - 1 && (
                  <div
                    aria-hidden="true"
                    className={clsx('step-line mt-3.5 hidden sm:block', done && 'step-line-done')}
                  />
                )}
              </div>
              {index < STEPS.length - 1 && (
                <div
                  aria-hidden="true"
                  className={clsx(
                    'ml-3.5 h-4 w-px bg-ink-700 sm:hidden',
                    done && 'bg-safe-500',
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>

      {/* Step 1 — basic information -------------------------------------- */}
      {step === 1 && (
        <Card className="animate-in space-y-4">
          <SectionHeading
            title="Basic information"
            description="Three fields to get started. Everything else is optional and editable later."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Engagement name"
              required
              error={name.length >= TEXT_LIMITS.engagementName ? 'Maximum length reached.' : undefined}
            >
              <Input
                autoFocus
                value={name}
                maxLength={TEXT_LIMITS.engagementName}
                onChange={(e) => setName(e.target.value)}
                placeholder="ABC Web Application — Q3 Assessment"
              />
            </Field>
            <Field
              label="Application URL"
              hint="The primary target this assessment covers."
              error={
                applicationUrl.trim() && !safeExternalUrl(applicationUrl)
                  ? 'Not a linkable http(s) address — it will be recorded as plain text.'
                  : undefined
              }
            >
              <Input
                type="url"
                value={applicationUrl}
                maxLength={TEXT_LIMITS.applicationUrl}
                onChange={(e) => setApplicationUrl(e.target.value)}
                placeholder="https://app.example.com"
                className="font-mono text-xs"
              />
            </Field>
          </div>

          <button
            type="button"
            onClick={() => setShowOptional((v) => !v)}
            className="text-xs text-ink-400 hover:text-brand-400"
          >
            {showOptional ? '− Hide' : '+ Add'} client, tester, dates and scope notes
          </button>

          {showOptional && (
            <div className="animate-in space-y-4 border-t border-ink-800 pt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Client / organisation">
                  <Input
                    value={clientName}
                    maxLength={TEXT_LIMITS.clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="ABC Ltd"
                  />
                </Field>
                <Field label="Tester">
                  <Input
                    value={testerName}
                    maxLength={TEXT_LIMITS.testerName}
                    onChange={(e) => setTesterName(e.target.value)}
                    placeholder="Your name"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Start date">
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </Field>
                  <Field label="End date">
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </Field>
                </div>
              </div>
              <Field
                label="Additional in-scope targets"
                hint="One per line — extra hosts, API base paths, package names."
              >
                <Textarea
                  rows={3}
                  value={scopeText}
                  maxLength={TEXT_LIMITS.scopeEntry * 50}
                  onChange={(e) => setScopeText(e.target.value)}
                  placeholder={'api.example.com/v2\ncom.example.android'}
                  className="font-mono text-xs"
                />
              </Field>
              <Field label="Notes / rules of engagement">
                <Textarea
                  rows={3}
                  value={description}
                  maxLength={TEXT_LIMITS.description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Testing window, restrictions, credentials provided, contacts…"
                />
              </Field>
            </div>
          )}

          <div className="flex justify-end">
            <Button
              variant="primary"
              disabled={!canContinue}
              onClick={() => setStep(2)}
              icon={<IconChevron size={15} />}
            >
              Choose application type
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2 — application type ----------------------------------------- */}
      {step === 2 && (
        <div className="animate-in space-y-4">
          <Card className="space-y-3">
            <SectionHeading
              title="What kind of assessment is this?"
              description="The application type sets the testing domain: it decides which questions you are asked next and which part of the library is in play. Each option states the coverage this product actually has."
            />
            <ApplicationTypePicker value={applicationType} onChange={setApplicationType} />
          </Card>

          {applicationType && <ApplicationTypeDetail type={applicationType} />}

          <Card className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-400">
              {!applicationType
                ? 'Select an application type to continue.'
                : typeUsable
                  ? `${preview.applicable.length} of ${TEST_LIBRARY.length} tests are in play before any context is recorded.`
                  : 'This engagement cannot be created — choose a supported type instead.'}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button variant="primary" disabled={!typeUsable} onClick={() => setStep(3)}>
                Continue
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Step 3 — context --------------------------------------------------- */}
      {step === 3 && (
        <div className="animate-in space-y-5">
          <Card className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-ink-100">
                {completeness.answered} of {completeness.total}{' '}
                {showAllFacts ? 'questions' : 'key questions'} answered
              </p>
              <p className="mt-0.5 text-xs text-ink-500">
                Follow-up questions appear only when they are relevant. Anything left unknown keeps
                its tests in scope.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-40">
                <ProgressBar value={completeness.ratio} label="Context questions answered" />
              </div>
              <Button size="sm" variant="subtle" onClick={() => setShowAllFacts((v) => !v)}>
                {showAllFacts ? 'Key questions only' : 'Show all questions'}
              </Button>
            </div>
          </Card>

          <ContextForm
            context={context}
            onChange={setFact}
            coreOnly={!showAllFacts}
            applicationType={applicationType ?? undefined}
          />

          <Card className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-sm">
              <IconShield size={18} className="text-brand-400" />
              <span className="text-ink-200">
                <strong className="text-ink-50">{preview.applicable.length}</strong> of{' '}
                {TEST_LIBRARY.length} tests applicable
                {preview.uncertain.length > 0 && (
                  <>
                    {' · '}
                    <span className="text-warn-300">
                      {preview.uncertain.length} unconfirmed
                    </span>
                  </>
                )}
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button variant="primary" onClick={() => setStep(4)}>
                Review checklist
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Step 4 — review -------------------------------------------------- */}
      {step === 4 && (
        <div className="animate-in space-y-5">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink-100">Checklist shape</h3>
              <span className="font-mono text-micro text-ink-400">
                {preview.applicable.length} of {TEST_LIBRARY.length} tests applicable
              </span>
            </div>
            <div
              aria-hidden="true"
              className="flex h-2.5 w-full overflow-hidden rounded-full bg-ink-800"
            >
              {(['Critical', 'High', 'Medium', 'Low'] as Priority[]).map((p) =>
                preview.byPriority[p] > 0 ? (
                  <span
                    key={p}
                    className={clsx(
                      'h-full',
                      p === 'Critical' && 'bg-vuln-500',
                      p === 'High' && 'bg-high-500',
                      p === 'Medium' && 'bg-medium-400',
                      p === 'Low' && 'bg-brand-500/70',
                    )}
                    style={{
                      width: `${(preview.byPriority[p] / Math.max(1, preview.applicable.length)) * 100}%`,
                    }}
                  />
                ) : null,
              )}
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-5">
              {(['Critical', 'High', 'Medium', 'Low'] as Priority[]).map((p) => (
                <div key={p} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={clsx(
                      'h-2 w-2 shrink-0 rounded-full',
                      p === 'Critical' && 'bg-vuln-500',
                      p === 'High' && 'bg-high-500',
                      p === 'Medium' && 'bg-medium-400',
                      p === 'Low' && 'bg-brand-500/70',
                    )}
                  />
                  <span className="text-xs text-ink-400">{p}</span>
                  <span className="ml-auto font-mono text-xs tabular-nums text-ink-200">
                    {preview.byPriority[p]}
                  </span>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-ink-500" />
                <span className="text-xs text-ink-400">Not applicable</span>
                <span className="ml-auto font-mono text-xs tabular-nums text-ink-200">
                  {preview.excluded.length}
                </span>
              </div>
            </div>
          </Card>

          <div className="grid gap-3 sm:grid-cols-5">
            {(['Critical', 'High', 'Medium', 'Low'] as Priority[]).map((p) => (
              <Card key={p} className="py-3">
                <p className="text-micro tracking-wider text-ink-400 uppercase">{p}</p>
                <p
                  className={clsx(
                    'mt-1 text-2xl font-semibold tabular-nums',
                    p === 'Critical' && 'text-vuln-400',
                    p === 'High' && 'text-high-300',
                    p === 'Medium' && 'text-medium-200',
                    p === 'Low' && 'text-brand-400',
                  )}
                >
                  {preview.byPriority[p]}
                </p>
              </Card>
            ))}
            <Card className="border-brand-500/30 py-3">
              <p className="text-micro tracking-wider text-ink-400 uppercase">Total applicable</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-brand-400">
                {preview.applicable.length}
              </p>
            </Card>
          </div>

          <Card className="space-y-3">
            <SectionHeading
              title="Generated checklist"
              description={
                `${preview.applicable.length} of ${TEST_LIBRARY.length} tests applicable · ` +
                `${preview.excluded.length} ruled out by the context you recorded · ` +
                `${preview.uncertain.length} of the applicable ones are unconfirmed`
              }
              actions={
                <Button size="sm" variant="subtle" onClick={() => setStep(3)}>
                  Adjust context
                </Button>
              }
            />
            <div className="max-h-96 overflow-x-auto overflow-y-auto rounded-[--radius-control] border border-ink-700">
              <table className="w-full min-w-[46rem] text-left text-sm">
                <caption className="sr-only">
                  Tests that will be seeded as applicable for this engagement
                </caption>
                <thead className="sticky top-0 bg-ink-900 text-micro tracking-wider text-ink-400 uppercase">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">
                      ID
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Vulnerability
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Subcategory
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Priority
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Why applicable
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...preview.applicable]
                    .sort(
                      (a, b) =>
                        PRIORITY_ORDER[a.definition.priority] -
                          PRIORITY_ORDER[b.definition.priority] ||
                        a.definition.id.localeCompare(b.definition.id),
                    )
                    .map(({ definition, suggestion }) => (
                      <tr key={definition.id} className="border-t border-ink-800">
                        <td className="px-3 py-1.5 font-mono text-micro text-ink-500">
                          {definition.id}
                        </td>
                        <td className="px-3 py-1.5 text-ink-100">{definition.vulnerabilityName}</td>
                        <td className="px-3 py-1.5 text-xs text-ink-500">
                          {definition.subcategory}
                        </td>
                        <td className="px-3 py-1.5">
                          <PriorityBadge priority={definition.priority} />
                        </td>
                        <td className="px-3 py-1.5 text-xs text-ink-500">
                          {suggestion.uncertain ? (
                            <span className="text-warn-400">Context incomplete</span>
                          ) : (
                            suggestion.conditions
                              .filter((c) => c.outcome === 'met')
                              .map((c) => c.label)
                              .join(', ') || 'Baseline test'
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setStep(3)}>
              Back
            </Button>
            <Button variant="primary" disabled={saving} onClick={() => void handleCreate()}>
              {saving ? 'Creating…' : 'Create engagement'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
