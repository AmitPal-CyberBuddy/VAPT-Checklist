/**
 * Application type — the testing domain of an engagement.
 *
 * This is the first decision a tester makes and it is architectural, not a
 * filter: it establishes *what kind of assessment this is*, which question set
 * is asked, and which part of the library is genuinely in play.
 *
 * The support level of each type is a statement about the bundled library, so
 * it is derived from the library at runtime (see `applicationTypeCoverage`)
 * rather than hard-coded. If someone adds ten iOS tests, the product stops
 * describing iOS as limited on its own — and if someone removes them, it stops
 * claiming support. A dropdown entry must never imply coverage that the
 * knowledge base cannot back.
 */

export type ApplicationTypeId =
  | 'web-app'
  | 'rest-api'
  | 'graphql-api'
  | 'soap-api'
  | 'mobile-android'
  | 'mobile-ios'
  | 'thick-client'
  | 'cloud';

export type SupportLevel = 'supported' | 'limited' | 'unsupported';

export interface ApplicationTypeDefinition {
  id: ApplicationTypeId;
  label: string;
  /** One line describing the target, in the tester's words. */
  description: string;
  /** What the library genuinely covers for this domain. */
  covers: string;
  /** What it does not cover. Stated plainly, never omitted to look better. */
  limitations?: string[];
  /**
   * Types whose surfaces can additionally be in scope for this engagement —
   * a web application that also exposes a REST API, for example.
   */
  additionalSurfaces?: ApplicationTypeId[];
  /** Where a type is unsupported, the honest thing to do instead. */
  alternative?: string;
}

export const APPLICATION_TYPES: ApplicationTypeDefinition[] = [
  {
    id: 'web-app',
    label: 'Web Application',
    description: 'A browser-delivered application, server-rendered or a single-page app.',
    covers:
      'The full web assessment surface: injection, XSS, authentication, session management, access control, business logic, client-side, configuration, transport, disclosure and privacy.',
    additionalSurfaces: ['rest-api', 'graphql-api', 'soap-api'],
  },
  {
    id: 'rest-api',
    label: 'REST API',
    description: 'An HTTP/JSON API consumed by a client you may or may not control.',
    covers:
      'The OWASP API Security Top 10 in full — object and function level authorization, excessive data exposure, resource consumption, inventory management, unsafe consumption — plus injection, authentication, token security and transport.',
    additionalSurfaces: ['web-app', 'graphql-api', 'soap-api'],
  },
  {
    id: 'graphql-api',
    label: 'GraphQL API',
    description: 'A GraphQL endpoint, typically a single POST route with a schema.',
    covers:
      'GraphQL-specific testing — introspection, query depth and complexity, batching and alias abuse, field-level authorization, resolver injection, error disclosure and transport CSRF — on top of the full API surface.',
    additionalSurfaces: ['web-app', 'rest-api'],
  },
  {
    id: 'soap-api',
    label: 'SOAP / XML-RPC API',
    description: 'An XML web service described by a WSDL.',
    covers:
      'XML-layer testing (XXE, XPath, parser abuse), WSDL and operation exposure, and the shared HTTP, authentication and authorization surface.',
    limitations: [
      'One SOAP-specific test (WSDL and operation abuse); the rest of the coverage is the generic API and XML surface.',
      'No dedicated WS-Security, WS-Addressing or SAML-in-SOAP testing.',
      'No WSDL-driven operation fuzzing.',
    ],
    additionalSurfaces: ['web-app', 'rest-api'],
  },
  {
    id: 'mobile-android',
    label: 'Android Application',
    description: 'An Android package, usually with a server-side API behind it.',
    covers:
      'A MASVS-aligned subset: local data storage, hardcoded secrets, IPC and exported components, WebView configuration, certificate pinning, logging, deep links and binary resilience — plus the full server-side surface of the API it talks to.',
    limitations: [
      'Ten mobile tests. This is a screening set, not a MASTG-depth mobile assessment.',
      'No platform-specific split — the guidance covers Android and iOS together rather than, say, Keystore versus Keychain in detail.',
      'No runtime instrumentation, no reverse-engineering workflow, no third-party SDK inventory.',
    ],
    additionalSurfaces: ['rest-api', 'graphql-api'],
  },
  {
    id: 'mobile-ios',
    label: 'iOS Application',
    description: 'An iOS application package, usually with a server-side API behind it.',
    covers:
      'A MASVS-aligned subset: local data storage, hardcoded secrets, IPC, WebView configuration, certificate pinning, logging, deep links and binary resilience — plus the full server-side surface of the API it talks to.',
    limitations: [
      'Ten mobile tests. This is a screening set, not a MASTG-depth mobile assessment.',
      'The guidance is shared with Android rather than being iOS-specific.',
      'No runtime instrumentation, no reverse-engineering workflow, no third-party SDK inventory.',
    ],
    additionalSurfaces: ['rest-api', 'graphql-api'],
  },
  {
    id: 'cloud',
    label: 'Cloud Environment',
    description: 'Cloud account and infrastructure in scope as an assessment target in its own right.',
    covers:
      'Externally observable cloud exposure: public object storage, instance metadata reachable through SSRF, exposed management services, container and orchestration configuration, and subdomain takeover.',
    limitations: [
      'This is exposure testing, not a cloud configuration review. There is no CIS-benchmark pass, no full IAM policy analysis, no serverless, no cloud logging or detection coverage.',
      'IAM and container findings assume grey or white box access; black-box engagements will see far less.',
      'For a cloud-hosted web application, select the application type and record the hosting model instead — you do not need this type.',
    ],
  },
  {
    id: 'thick-client',
    label: 'Thick / Desktop Client',
    description: 'A native desktop application.',
    covers: '',
    limitations: [
      'The library contains no thick-client tests at all: no binary or memory analysis, no local privilege or DLL hijacking, no local storage or configuration review, no IPC, no update-channel integrity, no anti-tampering.',
      'Selecting it would produce a checklist of web and API tests that assume an HTTP application — an inaccurate assessment presented as a complete one.',
    ],
    alternative:
      'If the client talks to a server, assess that instead: choose REST API, SOAP / XML-RPC or Web Application for the backend. The desktop binary itself needs a dedicated thick-client methodology this product does not yet carry.',
  },
];

export const APPLICATION_TYPE_BY_ID = Object.fromEntries(
  APPLICATION_TYPES.map((t) => [t.id, t]),
) as Record<ApplicationTypeId, ApplicationTypeDefinition>;

export function applicationTypeLabel(id: ApplicationTypeId | undefined): string {
  return id ? (APPLICATION_TYPE_BY_ID[id]?.label ?? id) : 'Not recorded';
}

/** The default domain for data that arrives without a usable one. */
export const FALLBACK_APPLICATION_TYPE: ApplicationTypeId = 'web-app';

export function isApplicationTypeId(value: unknown): value is ApplicationTypeId {
  return typeof value === 'string' && value in APPLICATION_TYPE_BY_ID;
}

/**
 * Coerces a stored value to a known type. A hand-edited database or a crafted
 * backup must not be able to put the UI into a state where a coverage lookup
 * returns undefined.
 */
export function toApplicationTypeId(value: unknown): ApplicationTypeId {
  return isApplicationTypeId(value) ? value : FALLBACK_APPLICATION_TYPE;
}
