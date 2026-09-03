import type { CSSProperties } from 'react';
import { CATEGORIES } from '../../data/categories';
import { LIBRARY_VERSION, TEST_LIBRARY } from '../../data/library';
import { Card, LinkButton, PriorityBadge, SectionHeading, Stat, StatusBadge } from '../../ui/primitives';
import {
  IconArrowRight,
  IconBook,
  IconCheckCircle,
  IconDownload,
  IconExternal,
  IconGithub,
  IconLayers,
  IconLinkedIn,
  IconList,
  IconLock,
  IconShield,
  IconTarget,
} from '../../ui/icons';

/**
 * Landing page (route `/`): what a visitor needs before opening the tool —
 * what it is, how it works, the methodology behind it, the privacy guarantee,
 * and how to connect with the maintainer. No marketing fluff; the headline
 * numbers are read live from the library so they can never drift from reality,
 * and the sample checklist below is real data from the bundled library.
 */

const STEPS = [
  {
    title: 'Define the engagement',
    body: 'Name, client, application URL and scope — then choose the application type: web application, REST, GraphQL, SOAP, Android, iOS or cloud.',
  },
  {
    title: 'Answer the scoping questions',
    body: 'Around twenty questions derived from the library itself, each showing how many checks it affects. Answer what you know; anything unrecorded stays in the checklist, flagged as unconfirmed, rather than being silently dropped.',
  },
  {
    title: 'Run the checklist',
    body: 'Work through checks grouped by category, open any check for its guidance and applicability reasons, and record status, result and evidence notes as you go.',
  },
  {
    title: 'Export the report',
    body: 'One click produces a five-sheet Excel workbook — summary, assessment, vulnerable tests, not-applicable and coverage — straight from local data. Backup and restore as JSON anytime.',
  },
];

const METHODOLOGY = [
  'OWASP Top 10 (2021)',
  'OWASP Web Security Testing Guide',
  'OWASP API Top 10 (2023)',
  'OWASP MASVS screening',
  'CWE references',
];

/** Real tests pulled from the library, shown as a sample of what ships. */
const FEATURED_IDS = ['INJ-001', 'AUTHZ-002', 'SESS-010', 'INJ-022'];

export default function LandingPage() {
  const featured = FEATURED_IDS.map((id) => TEST_LIBRARY.find((t) => t.id === id)).filter(
    (t): t is NonNullable<typeof t> => Boolean(t),
  );

  return (
    <div className="space-y-10">
      {/* ------------------------------------------------------------ Hero */}
      <section className="hero-stage panel-accent space-y-6 rounded-[--radius-panel] border p-6 sm:p-10">
        <div className="grid items-start gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <p className="font-mono text-micro font-medium tracking-[0.18em] text-brand-400 uppercase">
              Local-first · OWASP-aligned · No account required
            </p>
            <h1 className="gradient-heading text-2xl font-semibold tracking-tight">
              Penetration testing methodology, tailored to every engagement.
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-ink-300 sm:text-base">
              VAPT Checklist turns a few scoping answers into a complete,
              prioritised testing checklist — {TEST_LIBRARY.length} distinct
              security objectives across {CATEGORIES.length} categories — and
              tracks each one to a professional report. Everything runs in your
              browser; nothing is uploaded.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <LinkButton
                to="/engagements/new"
                variant="primary"
                size="lg"
                icon={<IconArrowRight size={16} aria-hidden="true" />}
              >
                Start an assessment
              </LinkButton>
              <LinkButton
                to="/library"
                variant="secondary"
                size="lg"
                icon={<IconBook size={16} aria-hidden="true" />}
              >
                Explore the test library
              </LinkButton>
            </div>
          </div>

          {/* A real slice of the library, rendered with the same badges the
              workspace uses — so a visitor sees the product, not a mock. */}
          <aside
            aria-label="Sample checks from the library"
            className="panel glow-border scan-edge overflow-hidden"
          >
            <div className="flex items-center gap-2 border-b border-ink-800 bg-ink-850/60 px-4 py-2">
              <IconCheckCircle size={14} aria-hidden="true" className="text-safe-400" />
              <span className="font-mono text-micro font-medium tracking-widest text-ink-400 uppercase">
                Sample checks · live from the library
              </span>
            </div>
            <ul className="divide-y divide-ink-800">
              {featured.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-200">
                    {t.vulnerabilityName}
                  </span>
                  <PriorityBadge priority={t.priority} />
                  <StatusBadge status="Not Tested" />
                </li>
              ))}
            </ul>
            <div className="border-t border-ink-800 px-4 py-2 font-mono text-micro text-ink-500">
              …and {TEST_LIBRARY.length - featured.length} more checks across{' '}
              {CATEGORIES.length} categories
            </div>
          </aside>
        </div>

        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Methodology checks" value={TEST_LIBRARY.length} hint="one objective per check" />
          <Stat label="Categories" value={CATEGORIES.length} hint="recon to cloud & mobile" />
          <Stat label="Library version" value={LIBRARY_VERSION} hint="mapped to OWASP & CWE" />
          <Stat label="Report sheets" value="5" hint="in the Excel export" />
        </dl>
      </section>

      {/* ----------------------------------------------- What it does */}
      <section aria-labelledby="landing-what" className="space-y-4">
        <SectionHeading
          id="landing-what"
          title="What it does"
          description="Not a wall of generic checks — a methodology that reacts to the target."
        />
        <div className="grid gap-3 lg:grid-cols-3">
          <Card
            className="stagger-item scan-edge card-lift space-y-3 p-5"
            style={{ '--d': 0 } as CSSProperties}
          >
            <span className="icon-tile flex h-9 w-9 items-center justify-center rounded-[--radius-control] border border-ink-700 bg-ink-900 text-brand-400">
              <IconTarget size={18} aria-hidden="true" />
            </span>
            <h3 className="text-sm font-semibold tracking-wide text-ink-100">Checklists built from context</h3>
            <p className="text-sm leading-relaxed text-ink-400">
              Application type, authentication, MFA, uploads, tenants, payments —
              each scoping answer includes or excludes checks, and every check
              explains why it is here ({'Applicable because…'}). Facts you have
              not answered keep their checks in the checklist, flagged as unconfirmed.
            </p>
          </Card>
          <Card
            className="stagger-item scan-edge card-lift space-y-3 p-5"
            style={{ '--d': 1 } as CSSProperties}
          >
            <span className="icon-tile flex h-9 w-9 items-center justify-center rounded-[--radius-control] border border-ink-700 bg-ink-900 text-brand-400">
              <IconLayers size={18} aria-hidden="true" />
            </span>
            <h3 className="text-sm font-semibold tracking-wide text-ink-100">One objective per check</h3>
            <p className="text-sm leading-relaxed text-ink-400">
              Each check is a single security-testing objective with its own CWE
              and OWASP references and practical guidance: what to test, how,
              what to observe and what counts as vulnerable. No duplicated
              methodology to grind through twice.
            </p>
          </Card>
          <Card
            className="stagger-item scan-edge card-lift space-y-3 p-5"
            style={{ '--d': 2 } as CSSProperties}
          >
            <span className="icon-tile flex h-9 w-9 items-center justify-center rounded-[--radius-control] border border-ink-700 bg-ink-900 text-brand-400">
              <IconDownload size={18} aria-hidden="true" />
            </span>
            <h3 className="text-sm font-semibold tracking-wide text-ink-100">Assessment-grade tracking and reporting</h3>
            <p className="text-sm leading-relaxed text-ink-400">
              Record status, result and evidence notes per check; the dashboard
              surfaces high-value work next. Export a five-sheet Excel workbook —
              summary, assessment, vulnerable tests, not-applicable and coverage.
            </p>
          </Card>
        </div>
      </section>

      {/* ----------------------------------------------- How it works */}
      <section aria-labelledby="landing-how" className="space-y-4">
        <SectionHeading
          id="landing-how"
          title="How it works"
          description="Four steps from a blank browser to a report."
        />
        <ol className="grid gap-3 md:grid-cols-2">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="stagger-item panel scan-edge card-lift flex gap-4 rounded-[--radius-panel] p-5"
              style={{ '--d': i } as CSSProperties}
            >
              <span
                aria-hidden="true"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-[--radius-control] border border-brand-500/40 bg-brand-500/10 font-mono text-sm font-semibold text-brand-400"
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold tracking-wide text-ink-100">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-400">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ----------------------------------------------- Methodology */}
      <section aria-labelledby="landing-method" className="space-y-4">
        <SectionHeading
          id="landing-method"
          title="Built on recognised methodology"
          description="Every check carries its OWASP and CWE references — the mapping is part of the data, exposed in the library and the export."
        />
        <div className="flex flex-wrap items-center gap-2">
          {METHODOLOGY.map((method) => (
            <span
              key={method}
              className="inline-flex items-center gap-1.5 rounded-[--radius-control] border border-ink-700 bg-ink-900 px-2.5 py-1 font-mono text-micro text-ink-300 transition-colors duration-150 hover:border-ink-600"
            >
              <IconShield size={11} aria-hidden="true" className="text-brand-500/80" />
              {method}
            </span>
          ))}
        </div>
      </section>

      {/* ----------------------------------------------- Privacy */}
      <Card className="panel-accent scan-edge flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-2xl space-y-1.5">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-wide text-ink-100">
            <IconLock size={15} aria-hidden="true" className="text-brand-400" />
            Your data never leaves the browser
          </h2>
          <p className="text-sm leading-relaxed text-ink-400">
            No backend, no account, no telemetry. Engagements live in this
            browser&apos;s local database and can be backed up or restored as
            JSON — the whole tool runs from a static deployment, offline once
            loaded.
          </p>
        </div>
        <LinkButton to="/settings" variant="subtle" size="md" icon={<IconShield size={15} aria-hidden="true" />}>
          Backup &amp; restore
        </LinkButton>
      </Card>

      {/* ----------------------------------------------- Connect */}
      <section aria-labelledby="landing-connect" className="space-y-4">
        <SectionHeading
          id="landing-connect"
          title="Connect & feedback"
          description="Questions, missing checks, or an upgrade you need from your own engagements — the library is maintained and shaped by that feedback."
        />
        <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="flex items-center gap-2 text-sm font-medium text-ink-100">
              <IconList size={15} aria-hidden="true" className="text-brand-400" />
              Built and maintained by Amit Pal.
            </p>
            <p className="text-sm leading-relaxed text-ink-400">
              Application security engineer — connect to discuss an engagement,
              or open an issue to suggest a check or an upgrade.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="https://www.linkedin.com/in/amitpal-wb/"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[--radius-control] border border-ink-600 bg-ink-800 px-3 text-sm text-ink-100 transition-colors duration-150 hover:bg-ink-700 active:translate-y-px"
            >
              <IconLinkedIn size={15} aria-hidden="true" />
              Connect on LinkedIn
              <IconExternal size={13} aria-hidden="true" className="text-ink-500" />
            </a>
            <a
              href="https://github.com/AmitPal-CyberBuddy/VAPT-Checklist/issues"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[--radius-control] border border-ink-600 bg-ink-800 px-3 text-sm text-ink-100 transition-colors duration-150 hover:bg-ink-700 active:translate-y-px"
            >
              <IconGithub size={15} aria-hidden="true" />
              Suggest an upgrade or report a problem
              <IconExternal size={13} aria-hidden="true" className="text-ink-500" />
            </a>
          </div>
        </Card>
      </section>
    </div>
  );
}