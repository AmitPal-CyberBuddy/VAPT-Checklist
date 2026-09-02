/**
 * VAPT Checklist — Application Context Schema
 * ---------------------------------------------------------------------------
 * The Application Context is the set of *facts* a tester records about the
 * target application. It is the ONLY input to the applicability engine.
 *
 * Design rules:
 *  - Facts are declarative properties of the target, never test decisions.
 *  - Every fact is tri-state aware: `true` / `false` / `unknown` (undefined).
 *    "Unknown" must never silently exclude a test (see applicability.ts).
 *  - The schema is data, not code, so the Context screen renders itself and
 *    the Excel export can label facts without duplicating strings.
 */

export type FactType = 'boolean' | 'single' | 'multi';

export interface FactOption {
  value: string;
  label: string;
  hint?: string;
}

export interface FactDefinition {
  key: ContextFactKey;
  label: string;
  /** Short helper shown under the control. */
  hint?: string;
  type: FactType;
  options?: FactOption[];
  section: ContextSectionId;
  /** Facts flagged as core are asked in the quick engagement wizard. */
  core?: boolean;
  /**
   * Only ask this question when the parent fact holds. Keeps setup short:
   * "Does it have MFA?" is noise once you have said there is no authentication.
   * A hidden question stays unrecorded, which the engine treats as unknown —
   * so hiding never silently narrows the checklist.
   */
  dependsOn?: { fact: ContextFactKey; equals: boolean | string };
  /**
   * Not asked: computed from the engagement's application type. Rules may read
   * it, the form never renders it.
   */
  derived?: boolean;
  /**
   * This answer is not read by any rule directly — it feeds the named derived
   * fact, which is. Declaring it keeps the "every question changes the
   * checklist" invariant honest instead of exempting the question.
   */
  feeds?: ContextFactKey;
  /**
   * Ask this question only for these application types. Absent means every
   * type. Keeps a mobile engagement from being asked about server-side
   * templating, and a SOAP engagement from being asked about SPA rendering.
   */
  appliesToTypes?: ApplicationTypeId[];
  /**
   * Recorded for the report only — never referenced by an applicability rule.
   * Everything else must drive at least one test, which the unit tests enforce
   * in both directions so the context form cannot fill up with dead questions.
   */
  metadataOnly?: boolean;
}

export interface ContextSection {
  id: ContextSectionId;
  title: string;
  description: string;
}

import type { ApplicationTypeId } from './applicationType';

export type ContextSectionId =
  | 'target'
  | 'auth'
  | 'data'
  | 'features'
  | 'integration'
  | 'infrastructure'
  | 'engagement';

export const CONTEXT_SECTIONS: ContextSection[] = [
  {
    id: 'target',
    title: 'Target & Surface',
    description: 'What kind of application is in scope and how is it exposed?',
  },
  {
    id: 'auth',
    title: 'Authentication & Identity',
    description: 'How do users prove who they are and what roles exist?',
  },
  {
    id: 'data',
    title: 'Data & Storage',
    description: 'What data does the application handle and where does it live?',
  },
  {
    id: 'features',
    title: 'Application Features',
    description: 'Feature-level facts that unlock specific vulnerability classes.',
  },
  {
    id: 'integration',
    title: 'Integrations & Protocols',
    description: 'Outbound calls, parsers and protocols the application speaks.',
  },
  {
    id: 'infrastructure',
    title: 'Infrastructure & Deployment',
    description: 'Where and how the application runs.',
  },
  {
    id: 'engagement',
    title: 'Engagement Parameters',
    description: 'Constraints of the assessment itself.',
  },
];

/** Canonical list of context fact keys. */
export type ContextFactKey =
  // target
  | 'assetTypes'
  | 'additionalSurfaces'
  | 'clientRendering'
  | 'internetFacing'
  // auth
  | 'hasAuthentication'
  | 'authMechanisms'
  | 'hasMfa'
  | 'hasSelfRegistration'
  | 'hasPasswordReset'
  | 'hasMultipleRoles'
  | 'hasAdminInterface'
  | 'hasSso'
  // data
  | 'datastore'
  | 'handlesPii'
  | 'handlesPayments'
  | 'handlesHealthData'
  | 'hasMultiTenancy'
  | 'hasUserOwnedResources'
  // features
  | 'hasFileUpload'
  | 'hasFileDownload'
  | 'hasUserGeneratedContent'
  | 'hasSearch'
  | 'hasDataExport'
  | 'hasEmailNotifications'
  | 'hasWorkflowOrTransactions'
  | 'hasCouponsOrPricing'
  // integration
  | 'acceptsUrlsFromUsers'
  | 'callsExternalServices'
  | 'parsesXml'
  | 'usesSerialization'
  | 'usesTemplating'
  | 'usesWebsockets'
  | 'usesCrossOriginRequests'
  | 'usesThirdPartyScripts'
  // infrastructure
  | 'hosting'
  | 'usesContainers'
  | 'usesCdnOrProxy'
  | 'hasSubdomains'
  // engagement
  | 'testingApproach'
  | 'environment'
  | 'credentialsProvided';

export type FactValue = boolean | string | string[] | undefined;

/** The recorded facts for one engagement. */
export type ApplicationContext = Partial<Record<ContextFactKey, FactValue>>;

const yesNo = (key: ContextFactKey, section: ContextSectionId, label: string, hint?: string, core = false): FactDefinition => ({
  key,
  label,
  hint,
  type: 'boolean',
  section,
  core,
});

export const CONTEXT_FACTS: FactDefinition[] = [
  // ---------------------------------------------------------------- target
  {
    // Derived from the engagement's application type plus `additionalSurfaces`.
    // Rules read it; the tester is never asked it directly.
    key: 'assetTypes',
    derived: true,
    label: 'Asset types in scope',
    type: 'multi',
    section: 'target',
    options: [
      { value: 'web-app', label: 'Web Application' },
      { value: 'rest-api', label: 'REST API' },
      { value: 'graphql-api', label: 'GraphQL API' },
      { value: 'soap-api', label: 'SOAP / XML-RPC API' },
      { value: 'mobile-android', label: 'Android Application' },
      { value: 'mobile-ios', label: 'iOS Application' },
      { value: 'thick-client', label: 'Thick / Desktop Client' },
      { value: 'cloud', label: 'Cloud Environment' },
    ],
  },
  {
    key: 'additionalSurfaces',
    feeds: 'assetTypes',
    label: 'Other surfaces in scope',
    hint: 'Beyond the primary application type — a web app that also exposes an API, for example.',
    type: 'multi',
    section: 'target',
    core: true,
    appliesToTypes: ['web-app', 'rest-api', 'graphql-api', 'soap-api', 'mobile-android', 'mobile-ios'],
    options: [
      { value: 'web-app', label: 'Web Application' },
      { value: 'rest-api', label: 'REST API' },
      { value: 'graphql-api', label: 'GraphQL API' },
      { value: 'soap-api', label: 'SOAP / XML-RPC API' },
    ],
  },
  {
    key: 'clientRendering',
    appliesToTypes: ['web-app'],
    label: 'Front-end rendering model',
    type: 'single',
    section: 'target',
    options: [
      { value: 'spa', label: 'Single Page Application (React/Angular/Vue)' },
      { value: 'ssr', label: 'Server rendered / templated' },
      { value: 'hybrid', label: 'Hybrid' },
      { value: 'none', label: 'No browser front-end (API only)' },
    ],
  },
  yesNo('internetFacing', 'target', 'Internet facing', 'Reachable from the public internet.', true),

  // ------------------------------------------------------------------ auth
  yesNo('hasAuthentication', 'auth', 'Application has authentication', 'Any login or identity boundary exists.', true),
  {
    key: 'authMechanisms',
    dependsOn: { fact: 'hasAuthentication', equals: true },
    label: 'Authentication / session mechanisms',
    type: 'multi',
    section: 'auth',
    core: true,
    options: [
      { value: 'session-cookie', label: 'Server-side session cookie' },
      { value: 'jwt', label: 'JWT / bearer token' },
      { value: 'oauth2', label: 'OAuth 2.0 / OpenID Connect' },
      { value: 'saml', label: 'SAML' },
      { value: 'api-key', label: 'API key' },
      { value: 'basic', label: 'HTTP Basic / Digest' },
      { value: 'mtls', label: 'Mutual TLS / certificates' },
    ],
  },
  { ...yesNo('hasMfa', 'auth', 'Multi-factor authentication', 'OTP, TOTP, push, WebAuthn, etc.'), dependsOn: { fact: 'hasAuthentication', equals: true } },
  { ...yesNo('hasSelfRegistration', 'auth', 'Self-service registration'), dependsOn: { fact: 'hasAuthentication', equals: true } },
  { ...yesNo('hasPasswordReset', 'auth', 'Password reset / account recovery'), dependsOn: { fact: 'hasAuthentication', equals: true } },
  { ...yesNo('hasMultipleRoles', 'auth', 'Multiple roles or privilege levels', 'Admin vs user, RBAC, permissions.', true), dependsOn: { fact: 'hasAuthentication', equals: true } },
  { ...yesNo('hasAdminInterface', 'auth', 'Administrative interface'), dependsOn: { fact: 'hasAuthentication', equals: true } },
  { ...yesNo('hasSso', 'auth', 'Single sign-on / federated identity'), dependsOn: { fact: 'hasAuthentication', equals: true } },

  // ------------------------------------------------------------------ data
  {
    key: 'datastore',
    label: 'Primary datastore',
    type: 'single',
    section: 'data',
    core: true,
    options: [
      { value: 'sql', label: 'Relational / SQL' },
      { value: 'nosql', label: 'NoSQL (Mongo, Dynamo, ...)' },
      { value: 'both', label: 'Both SQL and NoSQL' },
      { value: 'none', label: 'No datastore' },
      { value: 'unknown', label: 'Unknown' },
    ],
  },
  yesNo('handlesPii', 'data', 'Handles personal data (PII)', undefined, true),
  yesNo('handlesPayments', 'data', 'Handles payments or card data', undefined, true),
  yesNo('handlesHealthData', 'data', 'Handles health or other regulated data'),
  yesNo('hasMultiTenancy', 'data', 'Multi-tenant', 'Multiple customers/organisations share the deployment.', true),
  yesNo(
    'hasUserOwnedResources',
    'data',
    'Users own individual records or objects',
    'Orders, documents, messages, profiles addressed by an identifier — the precondition for IDOR/BOLA.',
    true,
  ),

  // -------------------------------------------------------------- features
  { ...yesNo('hasFileUpload', 'features', 'File upload', undefined, true), appliesToTypes: ['web-app', 'rest-api', 'graphql-api', 'soap-api', 'mobile-android', 'mobile-ios'] },
  { ...yesNo('hasFileDownload', 'features', 'File download / document retrieval', undefined, true), appliesToTypes: ['web-app', 'rest-api', 'graphql-api', 'soap-api', 'mobile-android', 'mobile-ios'] },
  { ...yesNo('hasUserGeneratedContent', 'features', 'User generated content shown to others', 'Comments, profiles, messaging.'), appliesToTypes: ['web-app'] },
  { ...yesNo('hasSearch', 'features', 'Search or filtering functionality'), appliesToTypes: ['web-app', 'rest-api', 'graphql-api', 'soap-api', 'mobile-android', 'mobile-ios'] },
  { ...yesNo('hasDataExport', 'features', 'Data export (CSV / XLSX / PDF)', undefined, true), appliesToTypes: ['web-app', 'rest-api', 'graphql-api', 'soap-api', 'mobile-android', 'mobile-ios'] },
  { ...yesNo('hasEmailNotifications', 'features', 'Sends email / SMS notifications'), appliesToTypes: ['web-app', 'rest-api', 'graphql-api', 'soap-api', 'mobile-android', 'mobile-ios'] },
  { ...yesNo('hasWorkflowOrTransactions', 'features', 'Multi-step workflows or transactions', 'Checkout, approvals, wizards.', true), appliesToTypes: ['web-app', 'rest-api', 'graphql-api', 'soap-api', 'mobile-android', 'mobile-ios'] },
  { ...yesNo('hasCouponsOrPricing', 'features', 'Pricing, discounts, coupons or quantities'), appliesToTypes: ['web-app', 'rest-api', 'graphql-api', 'soap-api', 'mobile-android', 'mobile-ios'] },

  // ----------------------------------------------------------- integration
  { ...yesNo('acceptsUrlsFromUsers', 'integration', 'Accepts URLs / hostnames from users', 'Webhooks, imports, avatar-by-URL, PDF renderers.'), appliesToTypes: ['web-app', 'rest-api', 'graphql-api', 'soap-api', 'mobile-android', 'mobile-ios'] },
  yesNo('callsExternalServices', 'integration', 'Makes server-side calls to other services', undefined, true),
  { ...yesNo('parsesXml', 'integration', 'Parses XML, SVG, DOCX or XLSX input'), appliesToTypes: ['web-app', 'rest-api', 'graphql-api', 'soap-api'] },
  { ...yesNo('usesSerialization', 'integration', 'Accepts serialized objects', 'Java/PHP/.NET/Python serialized blobs, YAML, pickle.'), appliesToTypes: ['web-app', 'rest-api', 'graphql-api', 'soap-api'] },
  { ...yesNo('usesTemplating', 'integration', 'Renders server-side templates with user data'), appliesToTypes: ['web-app', 'rest-api', 'graphql-api', 'soap-api'] },
  { ...yesNo('usesWebsockets', 'integration', 'Uses WebSockets or SSE', undefined, true), appliesToTypes: ['web-app', 'rest-api', 'graphql-api', 'soap-api'] },
  { ...yesNo('usesCrossOriginRequests', 'integration', 'Browser calls a different origin', 'CORS is in play.'), appliesToTypes: ['web-app'] },
  { ...yesNo('usesThirdPartyScripts', 'integration', 'Loads third-party scripts / tag managers', undefined, true), appliesToTypes: ['web-app'] },

  // -------------------------------------------------------- infrastructure
  {
    key: 'hosting',
    label: 'Hosting model',
    type: 'single',
    section: 'infrastructure',
    core: true,
    options: [
      { value: 'cloud', label: 'Public cloud (AWS / Azure / GCP)' },
      { value: 'on-prem', label: 'On premises' },
      { value: 'hybrid', label: 'Hybrid' },
      { value: 'saas', label: 'Third-party SaaS' },
      { value: 'unknown', label: 'Unknown' },
    ],
  },
  {
    ...yesNo('usesContainers', 'infrastructure', 'Containers / Kubernetes in scope', undefined, true),
    dependsOn: { fact: 'hosting', equals: 'cloud' },
  },
  yesNo('usesCdnOrProxy', 'infrastructure', 'Behind a CDN, WAF or reverse proxy', undefined, true),
  yesNo('hasSubdomains', 'infrastructure', 'Multiple subdomains in scope'),

  // ------------------------------------------------------------ engagement
  {
    key: 'testingApproach',
    label: 'Testing approach',
    type: 'single',
    section: 'engagement',
    core: true,
    options: [
      { value: 'black-box', label: 'Black box' },
      { value: 'grey-box', label: 'Grey box' },
      { value: 'white-box', label: 'White box (source access)' },
    ],
  },
  {
    key: 'environment',
    label: 'Environment under test',
    hint: 'Recorded in the report; does not change which tests apply.',
    type: 'single',
    section: 'engagement',
    metadataOnly: true,
    options: [
      { value: 'production', label: 'Production' },
      { value: 'staging', label: 'Staging / UAT' },
      { value: 'development', label: 'Development' },
    ],
  },
  {
    ...yesNo(
      'credentialsProvided',
      'engagement',
      'Test credentials provided',
      'Affects how you test, not which vulnerabilities apply.',
    ),
    metadataOnly: true,
  },
];

export const FACT_BY_KEY: Record<string, FactDefinition> = Object.fromEntries(
  CONTEXT_FACTS.map((f) => [f.key, f]),
);

/** Human readable rendering of a stored fact value, used by UI + export. */
/**
 * The asset surface an engagement actually covers: its application type plus
 * any additional surfaces recorded. This is the single derivation point — the
 * value is never stored, so it cannot drift from the application type.
 */
export function effectiveAssetTypes(
  applicationType: ApplicationTypeId,
  context: ApplicationContext,
): string[] {
  const extra = (context.additionalSurfaces as string[] | undefined) ?? [];
  return [applicationType, ...extra.filter((s) => s !== applicationType)];
}

/**
 * The context the applicability engine sees: what the tester recorded, plus
 * the derived asset types. Every caller that evaluates rules for an engagement
 * must use this rather than the raw context.
 */
export function effectiveContext(engagement: {
  applicationType: ApplicationTypeId;
  context: ApplicationContext;
}): ApplicationContext {
  return {
    ...engagement.context,
    assetTypes: effectiveAssetTypes(engagement.applicationType, engagement.context),
  };
}

/**
 * Should this question be asked given what has been answered so far?
 * A dependency only hides the child when the parent is explicitly false/other —
 * an unanswered parent keeps the child visible.
 */
export function isFactVisible(
  fact: FactDefinition,
  context: ApplicationContext,
  applicationType?: ApplicationTypeId,
): boolean {
  // Derived facts are computed, never asked.
  if (fact.derived) return false;
  // Questions that do not apply to this testing domain are not asked at all.
  if (applicationType && fact.appliesToTypes && !fact.appliesToTypes.includes(applicationType)) {
    return false;
  }
  if (!fact.dependsOn) return true;
  const parent = context[fact.dependsOn.fact];
  if (parent === undefined || parent === '') return true;
  if (Array.isArray(parent)) return parent.includes(String(fact.dependsOn.equals));
  return parent === fact.dependsOn.equals;
}

/** Facts worth asking, in schema order, honouring conditional visibility. */
export function visibleFacts(
  context: ApplicationContext,
  options: { coreOnly?: boolean; applicationType?: ApplicationTypeId } = {},
): FactDefinition[] {
  return CONTEXT_FACTS.filter(
    (f) => (!options.coreOnly || f.core) && isFactVisible(f, context, options.applicationType),
  );
}

export function formatFactValue(key: ContextFactKey, value: FactValue): string {
  const def = FACT_BY_KEY[key];
  if (value === undefined || value === null || (Array.isArray(value) && value.length === 0)) {
    return 'Unknown';
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  const label = (v: string) => def?.options?.find((o) => o.value === v)?.label ?? v;
  if (Array.isArray(value)) return value.map(label).join(', ');
  return label(value);
}

export function emptyContext(): ApplicationContext {
  return {};
}
