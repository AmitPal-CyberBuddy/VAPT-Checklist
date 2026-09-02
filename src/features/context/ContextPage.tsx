import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  InlineAlert,
  LoadingPanel,
  Modal,
  ProgressBar,
  SectionHeading,
} from '../../ui/primitives';
import { IconAlert, IconCheck } from '../../ui/icons';
import { ContextForm, contextCompleteness } from './ContextForm';
import { useChecklist, useEngagement } from '../../hooks/useData';
import {
  applyApplicability,
  previewApplicability,
  type ApplicabilityDiff,
} from '../../persistence/repository';
import type { ApplicationContext, ContextFactKey } from '../../domain/context';
import { toast } from '../../ui/toast';

export default function ContextPage() {
  const { engagementId = '' } = useParams();
  const engagement = useEngagement(engagementId);
  const items = useChecklist(engagementId);

  const [draft, setDraft] = useState<ApplicationContext>({});
  const [diffs, setDiffs] = useState<ApplicabilityDiff[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (engagement) setDraft(engagement.context);
  }, [engagement?.id, engagement?.updatedAt]);

  const dirty = useMemo(
    () => engagement != null && JSON.stringify(draft) !== JSON.stringify(engagement.context),
    [draft, engagement],
  );

  const completeness = contextCompleteness(draft, engagement?.applicationType);

  function setFact(key: ContextFactKey, value: boolean | string | string[] | undefined) {
    setDraft((c) => {
      const next = { ...c };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return next;
    });
  }

  async function review() {
    const result = await previewApplicability(engagementId, draft);
    setDiffs(result);
  }

  async function commit(overrideManual: boolean) {
    setSaving(true);
    try {
      const changed = await applyApplicability(engagementId, draft, { overrideManual });
      toast.success(
        'Application context saved',
        changed === 0
          ? 'No applicability changes were needed.'
          : `${changed} test${changed === 1 ? '' : 's'} changed scope.`,
      );
      setDiffs(null);
    } catch (error) {
      toast.error('Could not save context', String(error));
    } finally {
      setSaving(false);
    }
  }

  if (!engagement || !items) return <LoadingPanel rows={6} label="Loading application context" />;

  const protectedDiffs = (diffs ?? []).filter((d) => d.hasRecordedWork && !d.to);
  const manualDiffs = (diffs ?? []).filter((d) => d.isManualOverride);
  const cleanDiffs = (diffs ?? []).filter((d) => !d.hasRecordedWork && !d.isManualOverride);

  return (
    <div className="space-y-5">
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <SectionHeading
            title="Application context"
            description="These facts decide which vulnerabilities belong in this engagement. You can override any individual decision in the workspace."
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="w-44">
            <div className="mb-1 flex justify-between text-micro text-ink-400">
              <span>Recorded</span>
              <span className="tabular-nums">
                {completeness.answered}/{completeness.total}
              </span>
            </div>
            <ProgressBar value={completeness.ratio} label="Context questions answered" />
          </div>
          <Button variant="primary" disabled={!dirty || saving} onClick={() => void review()}>
            {dirty ? 'Review & apply changes' : 'No changes'}
          </Button>
        </div>
      </Card>

      {dirty && (
        <InlineAlert tone="warn" icon={<IconAlert size={16} aria-hidden="true" />}>
          Unsaved context changes — applicability is recalculated only when you apply them.
        </InlineAlert>
      )}

      <ContextForm context={draft} onChange={setFact} applicationType={engagement.applicationType} />

      <Modal
        open={diffs !== null}
        onClose={() => setDiffs(null)}
        title="Apply context changes"
        description={
          diffs && diffs.length === 0
            ? 'The recorded facts changed, but no test changes applicability as a result.'
            : `${diffs?.length ?? 0} test${diffs?.length === 1 ? '' : 's'} would change applicability.`
        }
        width="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDiffs(null)}>
              Cancel
            </Button>
            {manualDiffs.length > 0 && (
              <Button variant="subtle" disabled={saving} onClick={() => void commit(true)}>
                Apply and reset manual overrides
              </Button>
            )}
            <Button variant="primary" disabled={saving} onClick={() => void commit(false)}>
              {saving ? 'Applying…' : 'Apply changes'}
            </Button>
          </>
        }
      >
        <div className="max-h-96 space-y-4 overflow-y-auto">
          {cleanDiffs.length > 0 && (
            <DiffList
              title="Applicability changes"
              tone="brand"
              note="These tests become Applicable or Not Applicable automatically."
              diffs={cleanDiffs}
            />
          )}
          {manualDiffs.length > 0 && (
            <DiffList
              title="Manual overrides — kept as they are"
              tone="warn"
              note="You previously set these by hand. They are preserved unless you choose to reset them."
              diffs={manualDiffs}
            />
          )}
          {protectedDiffs.length > 0 && (
            <DiffList
              title="Protected — work already recorded"
              tone="na"
              note="The new context would mark these Not Applicable, but they already carry a status or notes, so they stay Applicable. Change them by hand in the workspace if you want them removed."
              diffs={protectedDiffs}
            />
          )}
          {diffs?.length === 0 && (
            <InlineAlert tone="success" icon={<IconCheck size={16} aria-hidden="true" />}>
              Nothing to change — the test list already matches this context.
            </InlineAlert>
          )}
        </div>
      </Modal>
    </div>
  );
}

function DiffList({
  title,
  note,
  diffs,
  tone,
}: {
  title: string;
  note: string;
  diffs: ApplicabilityDiff[];
  tone: 'brand' | 'warn' | 'na';
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <Badge tone={tone}>{diffs.length}</Badge>
        <p className="text-sm font-medium text-ink-100">{title}</p>
      </div>
      <p className="mb-2 text-xs text-ink-500">{note}</p>
      <ul className="divide-y divide-ink-800 rounded-[--radius-control] border border-ink-700">
        {diffs.map((d) => (
          <li key={d.testId} className="flex items-center gap-3 px-3 py-1.5 text-sm">
            <span className="font-mono text-micro text-ink-500">{d.testId}</span>
            <span className="flex-1 truncate text-ink-200">{d.vulnerabilityName}</span>
            <Badge tone={d.to ? 'success' : 'na'}>
              {d.from ? 'Applicable' : 'Not Applicable'} → {d.to ? 'Applicable' : 'Not Applicable'}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}
