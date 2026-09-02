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
import { FACT_BY_KEY, type ApplicationContext, type ContextFactKey } from '../../domain/context';
import { PRIORITY_ORDER, type Priority } from '../../domain/types';
import { createEngagement } from '../../persistence/repository';
import { toast } from '../../ui/toast';

const STEPS = [
  { id: 1, title: 'Basic information', hint: 'Name, URL and application type' },
  { id: 2, title: 'Application context', hint: 'What decides which tests apply' },
  { id: 3, title: 'Review checklist', hint: 'Confirm the generated scope' },
];

const APPLICATION_TYPES = FACT_BY_KEY.assetTypes.options ?? [];

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

  const applicationTypes = (context.assetTypes as string[] | undefined) ?? [];

  const setFact = (key: ContextFactKey, value: boolean | string | string[] | undefined) =>
    setContext((c) => {
      const next = { ...c };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return next;
    });

  function toggleApplicationType(value: string) {
    const next = applicationTypes.includes(value)
      ? applicationTypes.filter((v) => v !== value)
      : [...applicationTypes, value];
    setFact('assetTypes', next.length ? next : undefined);
  }

  const preview = useMemo(() => {
    const evaluated = TEST_LIBRARY.map((definition) => ({
      definition,
      suggestion: suggestApplicability(definition, context),
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
  }, [context]);

  const completeness = contextCompleteness(context);
  const canContinue = name.trim().length > 0;

  async function handleCreate() {
    if (!canContinue) return;
    setSaving(true);
    try {
      const engagement = await createEngagement({
        name,
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
        description="Describe the target once. The applicable test list is derived from it — and you stay free to override any decision later."
      />

      <ol className="grid gap-2 sm:grid-cols-3">
        {STEPS.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => (s.id === 1 || canContinue) && setStep(s.id)}
              disabled={s.id > 1 && !canContinue}
              aria-current={step === s.id ? 'step' : undefined}
              className={clsx(
                'w-full rounded-[--radius-control] border px-3 py-2 text-left transition-colors disabled:opacity-40',
                step === s.id
                  ? 'border-brand-500/50 bg-brand-500/10'
                  : 'border-ink-700 bg-ink-850 hover:border-ink-600',
              )}
            >
              <span className="flex items-center gap-2">
                <span
                  className={clsx(
                    'flex h-5 w-5 items-center justify-center rounded-full text-micro font-semibold',
                    step >= s.id ? 'bg-brand-500 text-ink-950' : 'bg-ink-700 text-ink-300',
                  )}
                >
                  {s.id}
                </span>
                <span className="text-sm font-medium text-ink-100">{s.title}</span>
              </span>
              <span className="mt-0.5 block pl-7 text-micro text-ink-400">{s.hint}</span>
            </button>
          </li>
        ))}
      </ol>

      {/* Step 1 — basic information -------------------------------------- */}
      {step === 1 && (
        <Card className="space-y-4">
          <SectionHeading
            title="Basic information"
            description="Three fields to get started. Everything else is optional and editable later."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Engagement name" required>
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ABC Web Application — Q3 Assessment"
              />
            </Field>
            <Field label="Application URL" hint="The primary target this assessment covers.">
              <Input
                type="url"
                value={applicationUrl}
                onChange={(e) => setApplicationUrl(e.target.value)}
                placeholder="https://app.example.com"
                className="font-mono text-xs"
              />
            </Field>
          </div>

          <Field
            label="Application type"
            hint="Drives which whole families of tests apply — GraphQL, mobile, SOAP, and so on."
          >
            <div className="flex flex-wrap gap-1.5">
              {APPLICATION_TYPES.map((option) => {
                const active = applicationTypes.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleApplicationType(option.value)}
                    aria-pressed={active}
                    className={clsx(
                      'rounded-[--radius-control] border px-3 py-1.5 text-xs transition-colors',
                      active
                        ? 'border-brand-500/60 bg-brand-500/15 text-brand-400'
                        : 'border-ink-600 bg-ink-850 text-ink-300 hover:border-ink-500 hover:text-ink-100',
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </Field>

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
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="ABC Ltd"
                  />
                </Field>
                <Field label="Tester">
                  <Input
                    value={testerName}
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
                  onChange={(e) => setScopeText(e.target.value)}
                  placeholder={'api.example.com/v2\ncom.example.android'}
                  className="font-mono text-xs"
                />
              </Field>
              <Field label="Notes / rules of engagement">
                <Textarea
                  rows={3}
                  value={description}
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
              Define application context
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2 — context ------------------------------------------------- */}
      {step === 2 && (
        <div className="space-y-5">
          <Card className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-ink-100">
                {completeness.answered} of {completeness.total} questions answered
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

          <ContextForm context={context} onChange={setFact} coreOnly={!showAllFacts} />

          <Card className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-sm">
              <IconShield size={18} className="text-brand-400" />
              <span className="text-ink-200">
                <strong className="text-ink-50">{preview.applicable.length}</strong> of{' '}
                {TEST_LIBRARY.length} tests currently applicable
              </span>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button variant="primary" onClick={() => setStep(3)}>
                Review checklist
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Step 3 — review -------------------------------------------------- */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-4">
            {(['Critical', 'High', 'Medium', 'Low'] as Priority[]).map((p) => (
              <Card key={p} className="py-3">
                <p className="text-micro tracking-wider text-ink-400 uppercase">{p}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-ink-50">
                  {preview.byPriority[p]}
                </p>
              </Card>
            ))}
          </div>

          <Card className="space-y-3">
            <SectionHeading
              title="Generated checklist"
              description={`${preview.applicable.length} applicable · ${preview.excluded.length} Not Applicable by context · ${preview.uncertain.length} kept because facts are unknown`}
              actions={
                <Button size="sm" variant="subtle" onClick={() => setStep(2)}>
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
                            <span className="text-amber-400">Context incomplete</span>
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
            <Button variant="ghost" onClick={() => setStep(2)}>
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
