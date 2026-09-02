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
    key: 'assetTypes',
    label: 'Asset types in scope',
    hint: 'Select every technology surface that will be tested.',
    type: 'multi',
    section: 'target',
    core: true,
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
    key: 'clientRendering',
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
  yesNo('handlesPayments', 'data', 'Handles payments or card data'),
  yesNo('handlesHealthData', 'data', 'Handles health or other regulated data'),
  yesNo('hasMultiTenancy', 'data', 'Multi-tenant', 'Multiple customers/organisations share the deployment.'),
  yesNo(
    'hasUserOwnedResources',
    'data',
    'Users own individual records or objects',
    'Orders, documents, messages, profiles addressed by an identifier — the precondition for IDOR/BOLA.',
    true,
  ),

  // -------------------------------------------------------------- features
  yesNo('hasFileUpload', 'features', 'File upload', undefined, true),
  yesNo('hasFileDownload', 'features', 'File download / document retrieval'),
  yesNo('hasUserGeneratedContent', 'features', 'User generated content shown to others', 'Comments, profiles, messaging.'),
  yesNo('hasSearch', 'features', 'Search or filtering functionality'),
  yesNo('hasDataExport', 'features', 'Data export (CSV / XLSX / PDF)'),
  yesNo('hasEmailNotifications', 'features', 'Sends email / SMS notifications'),
  yesNo('hasWorkflowOrTransactions', 'features', 'Multi-step workflows or transactions', 'Checkout, approvals, wizards.'),
  yesNo('hasCouponsOrPricing', 'features', 'Pricing, discounts, coupons or quantities'),

  // ----------------------------------------------------------- integration
  yesNo('acceptsUrlsFromUsers', 'integration', 'Accepts URLs / hostnames from users', 'Webhooks, imports, avatar-by-URL, PDF renderers.'),
  yesNo('callsExternalServices', 'integration', 'Makes server-side calls to other services'),
  yesNo('parsesXml', 'integration', 'Parses XML, SVG, DOCX or XLSX input'),
  yesNo('usesSerialization', 'integration', 'Accepts serialized objects', 'Java/PHP/.NET/Python serialized blobs, YAML, pickle.'),
  yesNo('usesTemplating', 'integration', 'Renders server-side templates with user data'),
  yesNo('usesWebsockets', 'integration', 'Uses WebSockets or SSE'),
  yesNo('usesCrossOriginRequests', 'integration', 'Browser calls a different origin', 'CORS is in play.'),
  yesNo('usesThirdPartyScripts', 'integration', 'Loads third-party scripts / tag managers'),

  // -------------------------------------------------------- infrastructure
  {
    key: 'hosting',
    label: 'Hosting model',
    type: 'single',
    section: 'infrastructure',
    options: [
      { value: 'cloud', label: 'Public cloud (AWS / Azure / GCP)' },
      { value: 'on-prem', label: 'On premises' },
      { value: 'hybrid', label: 'Hybrid' },
      { value: 'saas', label: 'Third-party SaaS' },
      { value: 'unknown', label: 'Unknown' },
    ],
  },
  yesNo('usesContainers', 'infrastructure', 'Containers / Kubernetes in scope'),
  yesNo('usesCdnOrProxy', 'infrastructure', 'Behind a CDN, WAF or reverse proxy'),
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
 * Should this question be asked given what has been answered so far?
 * A dependency only hides the child when the parent is explicitly false/other —
 * an unanswered parent keeps the child visible.
 */
export function isFactVisible(fact: FactDefinition, context: ApplicationContext): boolean {
  if (!fact.dependsOn) return true;
  const parent = context[fact.dependsOn.fact];
  if (parent === undefined || parent === '') return true;
  if (Array.isArray(parent)) return parent.includes(String(fact.dependsOn.equals));
  return parent === fact.dependsOn.equals;
}

/** Facts worth asking, in schema order, honouring conditional visibility. */
export function visibleFacts(
  context: ApplicationContext,
  options: { coreOnly?: boolean } = {},
): FactDefinition[] {
  return CONTEXT_FACTS.filter(
    (f) => (!options.coreOnly || f.core) && isFactVisible(f, context),
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
