import type { CSSProperties } from 'react';
import { CATEGORIES } from '../../data/categories';
import { LIBRARY_VERSION, TEST_LIBRARY } from '../../data/library';
import { Card, LinkButton, PriorityBadge, SectionHeading, StatusBadge } from '../../ui/primitives';
import {
  IconArrowRight,
  IconBook,
  IconCheckCircle,
  IconChevron,
  IconDownload,
  IconExternal,
  IconGauge,
  IconGithub,
  IconGrid,
  IconLayers,
  IconLinkedIn,
  IconList,
  IconLock,
  IconShield,
  IconShieldCheck,
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

/** The capability ticker — real checks from the library, nothing invented. */
const MARQUEE_IDS = [
  'INJ-001',
  'INJ-004',
  'INJ-010',
  'INJ-007',
  'INJ-016',
  'INJ-015',
  'INJ-022',
  'INJ-003',
  'INJ-014',
  'AUTHZ-001',
  'AUTHZ-002',
  'AUTHZ-004',
  'SESS-001',
  'API-001',
  'API-002',
  'CLOUD-002',
];

/** The assessment lifecycle, made explicit — the workstation's spine. */
const PIPELINE = [
  { label: 'Engagement', icon: IconGrid },
  { label: 'Target & context', icon: IconTarget },
  { label: 'Applicable tests', icon: IconList },
  { label: 'Active testing', icon: IconGauge },
  { label: 'Results', icon: IconShieldCheck },
  { label: 'Report', icon: IconDownload },
];

export default function LandingPage() {
  const featured = FEATURED_IDS.map((id) => TEST_LIBRARY.find((t) => t.id === id)).filter(
    (t): t is NonNullable<typeof t> => Boolean(t),
  );
  const marquee = MARQUEE_IDS.map((id) => TEST_LIBRARY.find((t) => t.id === id)).filter(
    (t): t is NonNullable<typeof t> => Boolean(t),
  );

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------------ Hero */}
      <section className="hero-stage panel-accent space-y-7 rounded-[--radius-panel] border p-6 sm:p-10">
        <div className="space-y-5">
          <p
            className="stagger-item flex flex-wrap items-center gap-2.5 font-mono text-micro font-medium tracking-[0.18em] text-brand-400 uppercase"
            style={{ '--d': 0 } as CSSProperties}
          >
            <span aria-hidden="true" className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-safe-400 opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-safe-400" />
            </span>
            Local-first · OWASP-aligned · No account required
          </p>
          <h1 className="stagger-item display-hero" style={{ '--d': 1 } as CSSProperties}>
            <span className="text-ink-50">Penetration testing methodology,</span>{' '}
            <span className="gradient-heading">every check your assessment needs.</span>
          </h1>
          <p
            className="stagger-item max-w-2xl text-sm leading-relaxed text-ink-300 sm:text-base"
            style={{ '--d': 2 } as CSSProperties}
          >
            A few scoping answers become a complete, prioritised checklist —{' '}
            {TEST_LIBRARY.length} security objectives across {CATEGORIES.length} categories —
            tracked from first probe to a five-sheet report. Everything runs in your browser;
            nothing is uploaded.
          </p>
          <div
            className="stagger-item flex flex-wrap items-center gap-3 pt-1"
            style={{ '--d': 3 } as CSSProperties}
          >
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

        <div className="grid items-stretch gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          {/* A session, told the way the tool actually behaves — the console
              is decorative (aria-hidden) so no fake statuses reach a screen
              reader. */}
          <div
            className="stagger-item terminal corner-frame"
            style={{ '--d': 4 } as CSSProperties}
            aria-hidden="true"
          >
            <div className="flex items-center gap-2 border-b border-ink-800/70 px-4 py-2.5">
              <span className="flex gap-1.5">
                <span className="h-2 w-2 rounded-full bg-vuln-500/80" />
                <span className="h-2 w-2 rounded-full bg-warn-400/80" />
                <span className="h-2 w-2 rounded-full bg-safe-500/80" />
              </span>
              <span className="font-mono text-micro tracking-widest text-ink-500 uppercase">
                vapt-checklist · local session
              </span>
            </div>
            <div className="space-y-2.5 px-4 py-4 font-mono text-xs leading-relaxed sm:px-5 sm:text-sm">
              <p>
                <span className="text-brand-400">$</span>{' '}
                <span className="text-ink-100">vapt new "ACME Portal" --type web-app</span>
              </p>
              <p className="text-safe-400">
                ✓ engagement created — 68 of {TEST_LIBRARY.length} checks applicable
              </p>
              <p>
                <span className="text-brand-400">$</span>{' '}
                <span className="text-ink-100">vapt status</span>
              </p>
              <p className="text-ink-300">
                ▌ testing <span className="font-semibold text-ink-50">42/68</span> ·{' '}
                <span className="text-vuln-400">3 vulnerable</span> ·{' '}
                <span className="text-warn-300">23 not tested</span>
              </p>
              <p>
                <span className="text-brand-400">$</span>{' '}
                <span className="text-ink-100">vapt export --xlsx</span>
              </p>
              <p className="text-safe-400">
                ✓ acme-portal-assessment.xlsx — 5 sheets, written locally
                <span className="terminal-cursor" />
              </p>
            </div>
          </div>

          {/* A real slice of the library, rendered with the same badges the
              workspace uses — so a visitor sees the product, not a mock. */}
          <aside
            aria-label="Sample checks from the library"
            className="stagger-item panel glow-border scan-edge overflow-hidden"
            style={{ '--d': 5 } as CSSProperties}
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

        {/* The headline numbers, read live from the library — a bold band,
            not four small cards. */}
        <dl
          className="stagger-item grid grid-cols-2 gap-px overflow-hidden rounded-[--radius-control] border border-ink-700 bg-ink-700 lg:grid-cols-4"
          style={{ '--d': 6 } as CSSProperties}
        >
          <div className="bg-ink-900 p-4">
            <dt className="font-mono text-micro font-medium tracking-widest text-ink-400 uppercase">
              Methodology checks
            </dt>
            <dd className="stat-band-value mt-1 text-ink-50">{TEST_LIBRARY.length}</dd>
            <p className="mt-1 text-micro text-ink-500">one objective per check</p>
          </div>
          <div className="bg-ink-900 p-4">
            <dt className="font-mono text-micro font-medium tracking-widest text-ink-400 uppercase">
              Categories
            </dt>
            <dd className="stat-band-value mt-1 text-ink-50">{CATEGORIES.length}</dd>
            <p className="mt-1 text-micro text-ink-500">recon to cloud &amp; mobile</p>
          </div>
          <div className="bg-ink-900 p-4">
            <dt className="font-mono text-micro font-medium tracking-widest text-ink-400 uppercase">
              Library version
            </dt>
            <dd className="stat-band-value mt-1 text-brand-400">{LIBRARY_VERSION}</dd>
            <p className="mt-1 text-micro text-ink-500">mapped to OWASP &amp; CWE</p>
          </div>
          <div className="bg-ink-900 p-4">
            <dt className="font-mono text-micro font-medium tracking-widest text-ink-400 uppercase">
              Report sheets
            </dt>
            <dd className="stat-band-value mt-1 text-ink-50">5</dd>
            <p className="mt-1 text-micro text-ink-500">in the Excel export</p>
          </div>
        </dl>
      </section>

      {/* --------------------------------------------- Capability ticker */}
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[...marquee, ...marquee].map((t, index) => (
            <span
              key={`${t.id}-${index}`}
              className="mr-3 inline-flex items-center gap-1.5 rounded-full border border-ink-700 bg-ink-900 px-2.5 py-1 font-mono text-micro whitespace-nowrap text-ink-300"
            >
              <span className="text-brand-500/80">◆</span>
              {t.vulnerabilityName}
            </span>
          ))}
        </div>
      </div>

      {/* --------------------------------------------- Assessment pipeline */}
      <section
        aria-labelledby="landing-flow"
        className="stagger-item panel space-y-3 p-4 sm:p-5"
        style={{ '--d': 6 } as CSSProperties}
      >
        <h2 id="landing-flow" className="section-kicker">
          Assessment workflow
        </h2>
        <ol className="flex flex-wrap items-center gap-y-2">
          {PIPELINE.map((stage, index) => (
            <li key={stage.label} className="flex items-center gap-2">
              <span className="flex items-center gap-2 rounded-[--radius-control] border border-ink-700 bg-ink-850 px-2.5 py-1.5">
                <span aria-hidden="true" className="font-mono text-micro tabular-nums text-brand-400">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <stage.icon size={14} aria-hidden="true" className="text-ink-300" />
                <span className="text-xs font-medium text-ink-200">{stage.label}</span>
              </span>
              {index < PIPELINE.length - 1 && (
                <IconChevron size={14} aria-hidden="true" className="shrink-0 text-ink-600" />
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* ----------------------------------------------- What it does */}
      <section aria-labelledby="landing-what" className="scroll-reveal space-y-4">
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
            <p className="flex flex-wrap gap-1.5 pt-1">
              {['application type', 'context facts', 'applicability rules'].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-ink-700 bg-ink-900 px-2 py-0.5 font-mono text-micro text-ink-400"
                >
                  {tag}
                </span>
              ))}
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
            <p className="flex flex-wrap gap-1.5 pt-1">
              {['CWE', 'OWASP WSTG', 'testing guidance'].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-ink-700 bg-ink-900 px-2 py-0.5 font-mono text-micro text-ink-400"
                >
                  {tag}
                </span>
              ))}
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
            <p className="flex flex-wrap gap-1.5 pt-1">
              {['status · result · notes', 'Excel workbook', 'JSON backup'].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-ink-700 bg-ink-900 px-2 py-0.5 font-mono text-micro text-ink-400"
                >
                  {tag}
                </span>
              ))}
            </p>
          </Card>
        </div>
      </section>

      {/* ----------------------------------------------- How it works */}
      <section aria-labelledby="landing-how" className="scroll-reveal space-y-4">
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
      <section aria-labelledby="landing-method" className="scroll-reveal space-y-4">
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
      <section aria-labelledby="landing-connect" className="scroll-reveal space-y-4">
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