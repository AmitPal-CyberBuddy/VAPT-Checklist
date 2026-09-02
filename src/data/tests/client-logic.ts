import type { TestDefinition } from '../../domain/types';
import { rule } from '../../domain/applicability';

const browser = rule.includes('assetTypes', 'web-app');

export const clientSideTests: TestDefinition[] = [
  {
    id: 'CLI-001',
    vulnerabilityName: 'DOM-Based Cross-Site Scripting',
    category: 'client-side',
    priority: 'High',
    description:
      'Client-side JavaScript passes attacker-controllable data from a source (location, postMessage, storage) into a dangerous sink (innerHTML, eval, document.write) without sanitisation.',
    testingGuidance: [
      'Map sources and sinks in the JavaScript bundles; pay attention to framework-specific sinks (dangerouslySetInnerHTML, v-html, bypassSecurityTrust*).',
      'Test fragment-based payloads (#) which never reach the server, plus query and storage-driven values.',
      'Confirm execution in the browser and identify whether CSP or Trusted Types mitigate it.',
    ],
    owasp: ['WSTG-CLNT-01'],
    cwe: ['CWE-79'],
    applicability: browser,
    tags: ['xss', 'client-side'],
  },
  {
    id: 'CLI-002',
    vulnerabilityName: 'Clickjacking / Missing Frame Protection',
    category: 'client-side',
    priority: 'Medium',
    description:
      'The application can be embedded in a third-party frame, allowing UI redress attacks that trick users into performing state-changing actions.',
    testingGuidance: [
      'Check for X-Frame-Options and CSP frame-ancestors on sensitive pages, not just the home page.',
      'Build a proof-of-concept page framing a state-changing screen and confirm it renders.',
      'Assess whether framing enables a realistic action (transfer, permission grant, deletion).',
    ],
    owasp: ['WSTG-CLNT-09'],
    cwe: ['CWE-1021'],
    applicability: browser,
    tags: ['client-side'],
  },
  {
    id: 'CLI-003',
    vulnerabilityName: 'Sensitive Data Stored in Browser Storage',
    category: 'client-side',
    priority: 'Medium',
    description:
      'Tokens, personal data or business secrets are written to localStorage, sessionStorage or IndexedDB where any script in the origin can read them and they persist after logout.',
    testingGuidance: [
      'Inspect all browser storage after login and after logout.',
      'Identify tokens, PII, API keys and cached responses; check whether logout clears them.',
      'Assess the XSS blast radius given what is stored.',
    ],
    owasp: ['WSTG-CLNT-12'],
    cwe: ['CWE-922'],
    applicability: browser,
    tags: ['client-side'],
  },
  {
    id: 'CLI-004',
    vulnerabilityName: 'CORS Misconfiguration',
    category: 'client-side',
    priority: 'High',
    description:
      'The Access-Control-Allow-Origin policy reflects arbitrary origins, trusts null, or permits credentials with an over-broad allow-list, letting malicious sites read authenticated responses.',
    testingGuidance: [
      'Send requests with an arbitrary Origin and observe whether it is reflected together with Allow-Credentials: true.',
      'Test Origin: null, sibling/suffix domains (evil-target.com, target.com.evil.com) and non-HTTPS origins.',
      'Confirm exploitability by reading an authenticated response cross-origin in a proof of concept.',
    ],
    owasp: ['WSTG-CLNT-07'],
    cwe: ['CWE-942'],
    applicability: rule.any(rule.is('usesCrossOriginRequests', true), rule.includes('assetTypes', 'rest-api', 'graphql-api')),
    tags: ['client-side', 'cors'],
  },
  {
    id: 'CLI-005',
    vulnerabilityName: 'Insecure Cross-Origin Messaging (postMessage)',
    category: 'client-side',
    priority: 'Medium',
    description:
      'postMessage handlers do not validate the sender origin, or messages containing sensitive data are sent to a wildcard target, enabling data theft or DOM XSS.',
    testingGuidance: [
      'Locate addEventListener("message") handlers and check origin validation.',
      'Send crafted messages from a foreign origin and observe handler behaviour.',
      'Check for postMessage(data, "*") carrying tokens or personal data.',
    ],
    owasp: ['WSTG-CLNT-11'],
    cwe: ['CWE-346'],
    applicability: browser,
    tags: ['client-side'],
  },
  {
    id: 'CLI-006',
    vulnerabilityName: 'Client-Side Prototype Pollution',
    category: 'client-side',
    priority: 'Medium',
    description:
      'Merge/clone routines allow __proto__ or constructor.prototype keys from user input, changing global object behaviour and often enabling DOM XSS gadget chains.',
    testingGuidance: [
      'Append ?__proto__[test]=polluted and JSON equivalents, then inspect Object.prototype.test in the console.',
      'Identify gadgets in the application or its libraries that turn pollution into script execution.',
      'Test both query-string parsers and JSON body handling.',
    ],
    owasp: ['WSTG-CLNT-*'],
    cwe: ['CWE-1321'],
    applicability: rule.all(browser, rule.is('clientRendering', 'spa')),
    tags: ['client-side'],
  },
  {
    id: 'CLI-007',
    vulnerabilityName: 'Client-Side URL Redirect (DOM Open Redirect)',
    category: 'client-side',
    priority: 'Medium',
    description:
      'JavaScript assigns a user-controlled value to location, href or a router navigation, enabling redirection to attacker sites or javascript: URI execution.',
    testingGuidance: [
      'Search for assignments to location/location.href/window.open sourced from URL data.',
      'Test external redirect targets and javascript:/data: schemes.',
      'Check SPA router navigation using unvalidated path parameters.',
    ],
    owasp: ['WSTG-CLNT-04'],
    cwe: ['CWE-601'],
    applicability: browser,
    tags: ['client-side'],
  },
  {
    id: 'CLI-008',
    vulnerabilityName: 'Client-Side Resource Manipulation',
    category: 'client-side',
    priority: 'Medium',
    description:
      'Script, stylesheet, iframe or WebSocket URLs are built from user input, letting an attacker load remote resources into the application origin.',
    testingGuidance: [
      'Identify parameters used to build resource URLs (script src, iframe src, ws endpoint, image src).',
      'Attempt to point them at an attacker-controlled origin.',
      'Assess whether CSP prevents loading and whether the loaded resource executes.',
    ],
    owasp: ['WSTG-CLNT-06'],
    cwe: ['CWE-494'],
    applicability: browser,
    tags: ['client-side'],
  },
  {
    id: 'CLI-009',
    vulnerabilityName: 'Reverse Tabnabbing',
    category: 'client-side',
    priority: 'Low',
    description:
      'Links opened with target="_blank" without rel="noopener" allow the destination page to rewrite the opener tab, enabling convincing phishing.',
    testingGuidance: [
      'Find user-controllable or third-party links opened in a new tab.',
      'Check for rel="noopener noreferrer" and modern browser defaults.',
      'Demonstrate opener manipulation where the pattern is present.',
    ],
    owasp: ['WSTG-CLNT-*'],
    cwe: ['CWE-1022'],
    applicability: rule.all(browser, rule.is('hasUserGeneratedContent', true)),
    tags: ['client-side'],
  },
  {
    id: 'CLI-010',
    vulnerabilityName: 'WebSocket Security Weakness',
    category: 'client-side',
    priority: 'Medium',
    description:
      'WebSocket handshakes lack origin validation or authentication (cross-site WebSocket hijacking), or messages bypass the authorisation applied to HTTP endpoints.',
    testingGuidance: [
      'Replay the handshake from a foreign origin and confirm whether the connection is accepted with the victim\'s cookies.',
      'Check that authentication/authorisation is enforced per message, not only at connect time.',
      'Fuzz message payloads for injection and access control gaps, and confirm wss:// is used.',
    ],
    owasp: ['WSTG-CLNT-10'],
    cwe: ['CWE-346'],
    applicability: rule.is('usesWebsockets', true),
    tags: ['client-side', 'websocket'],
  },
  {
    id: 'CLI-011',
    vulnerabilityName: 'Third-Party Script and Supply Chain Exposure',
    category: 'client-side',
    priority: 'Medium',
    description:
      'The origin loads analytics, chat and tag-manager scripts with full DOM access; a compromise of any provider yields client-side code execution and data capture on sensitive pages.',
    testingGuidance: [
      'Inventory all third-party origins loaded, per page, including those injected by tag managers.',
      'Determine whether they are present on login, payment and personal data pages.',
      'Check for CSP restriction, SRI and whether the vendor list is documented and reviewed.',
    ],
    owasp: ['A08:2021'],
    cwe: ['CWE-1104'],
    applicability: rule.all(browser, rule.is('usesThirdPartyScripts', true)),
    tags: ['client-side', 'supply-chain'],
  },
];

export const businessLogicTests: TestDefinition[] = [
  {
    id: 'LOGIC-001',
    vulnerabilityName: 'Workflow Sequence Bypass',
    category: 'business-logic',
    priority: 'High',
    description:
      'Multi-step processes can be completed out of order or with steps skipped, allowing users to reach an end state without satisfying required conditions (payment, approval, verification).',
    testingGuidance: [
      'Map the intended step sequence and the request that completes each step.',
      'Submit the final step directly, replay steps out of order, and repeat completed steps.',
      'Confirm the server re-validates prerequisites at each step rather than trusting client state.',
    ],
    owasp: ['WSTG-BUSL-06'],
    cwe: ['CWE-841'],
    applicability: rule.is('hasWorkflowOrTransactions', true),
    tags: ['business-logic'],
  },
  {
    id: 'LOGIC-002',
    vulnerabilityName: 'Price and Quantity Manipulation',
    category: 'business-logic',
    priority: 'Critical',
    description:
      'Amounts, prices, currencies or quantities supplied by the client are trusted, letting an attacker alter the value of a transaction.',
    testingGuidance: [
      'Intercept checkout/order requests and modify price, currency, tax, shipping and total fields.',
      'Test negative, zero, fractional and extremely large quantities, and integer overflow boundaries.',
      'Verify the final charge is computed server-side from authoritative data.',
    ],
    owasp: ['WSTG-BUSL-01'],
    cwe: ['CWE-807'],
    applicability: rule.any(rule.is('hasCouponsOrPricing', true), rule.is('handlesPayments', true)),
    tags: ['business-logic'],
  },
  {
    id: 'LOGIC-003',
    vulnerabilityName: 'Discount and Coupon Abuse',
    category: 'business-logic',
    priority: 'High',
    description:
      'Promotional logic permits stacking, reuse of single-use codes, application after payment, or brute forcing of valid codes.',
    testingGuidance: [
      'Apply the same code repeatedly, stack multiple codes and reapply after order confirmation.',
      'Race parallel redemptions of a single-use code.',
      'Attempt to enumerate valid codes and check for rate limiting on validation endpoints.',
    ],
    owasp: ['WSTG-BUSL-*'],
    cwe: ['CWE-840'],
    applicability: rule.is('hasCouponsOrPricing', true),
    tags: ['business-logic'],
  },
  {
    id: 'LOGIC-004',
    vulnerabilityName: 'Race Condition (TOCTOU)',
    category: 'business-logic',
    priority: 'High',
    description:
      'Concurrent requests bypass limits that are checked and then applied non-atomically — enabling double spending, duplicate redemption, over-withdrawal or limit evasion.',
    testingGuidance: [
      'Identify limit-bound operations (redeem, withdraw, vote, apply, invite).',
      'Fire many parallel requests with the same session using single-packet or grouped concurrency.',
      'Verify final state against expectation and repeat to confirm reproducibility.',
    ],
    owasp: ['WSTG-BUSL-*'],
    cwe: ['CWE-362'],
    applicability: rule.is('hasWorkflowOrTransactions', true),
    tags: ['business-logic'],
  },
  {
    id: 'LOGIC-005',
    vulnerabilityName: 'Insufficient Anti-Automation',
    category: 'business-logic',
    priority: 'Medium',
    description:
      'Business functions can be driven at machine speed — mass account creation, scraping of records, bulk lookups — because no CAPTCHA, throttling or behavioural control exists.',
    testingGuidance: [
      'Automate a business function (registration, search, lookup) and measure how many operations succeed.',
      'Test whether controls can be bypassed by rotating IP, session or user agent.',
      'Quantify the business impact (data harvested per hour, accounts created).',
    ],
    owasp: ['WSTG-BUSL-05', 'API6:2023'],
    cwe: ['CWE-799'],
    applicability: rule.always(),
    tags: ['business-logic'],
  },
  {
    id: 'LOGIC-006',
    vulnerabilityName: 'Client-Side Enforcement of Server-Side Security',
    category: 'business-logic',
    priority: 'High',
    description:
      'Restrictions implemented as disabled fields, hidden inputs, client validation or feature flags are not re-checked on the server.',
    testingGuidance: [
      'Enumerate hidden/disabled fields and client-only limits, then submit values directly to the API.',
      'Toggle feature flags in client state and see whether the backend honours the unlocked feature.',
      'Test read-only fields for server-side write acceptance.',
    ],
    owasp: ['WSTG-BUSL-07'],
    cwe: ['CWE-602'],
    applicability: rule.always(),
    tags: ['business-logic'],
  },
  {
    id: 'LOGIC-007',
    vulnerabilityName: 'Parameter Tampering of Trusted Values',
    category: 'business-logic',
    priority: 'High',
    description:
      'Security-relevant values (user ID, account status, tier, expiry, tenant) are accepted from the client and used without verification.',
    testingGuidance: [
      'Catalogue parameters that encode identity, entitlement or state.',
      'Modify each and observe whether the server re-derives the value from the session.',
      'Include values embedded in tokens, cookies and hidden fields.',
    ],
    owasp: ['WSTG-BUSL-01'],
    cwe: ['CWE-472'],
    applicability: rule.always(),
    tags: ['business-logic'],
  },
  {
    id: 'LOGIC-008',
    vulnerabilityName: 'Insufficient Transaction and Value Limits',
    category: 'business-logic',
    priority: 'Medium',
    description:
      'The application accepts values outside sensible business bounds — negative amounts, transfers exceeding balance, dates in the past/future — leading to financial or data integrity impact.',
    testingGuidance: [
      'Submit boundary and out-of-range values for amounts, dates, counts and durations.',
      'Test negative and reversed transfers between owned accounts.',
      'Confirm limits are enforced server-side and cannot be bypassed by a different endpoint.',
    ],
    owasp: ['WSTG-BUSL-03'],
    cwe: ['CWE-1284'],
    applicability: rule.any(rule.is('handlesPayments', true), rule.is('hasWorkflowOrTransactions', true)),
    tags: ['business-logic'],
  },
  {
    id: 'LOGIC-009',
    vulnerabilityName: 'Unexpected File Type Accepted by Business Function',
    category: 'business-logic',
    priority: 'Medium',
    description:
      'Functions that expect a specific document type accept other types, causing downstream processing errors, storage abuse or bypass of content checks.',
    testingGuidance: [
      'Upload legitimate-but-wrong types (ZIP where PDF expected, XLSX where CSV expected).',
      'Observe whether the application processes, quarantines or rejects them.',
      'Check whether downstream consumers of the file behave unsafely.',
    ],
    owasp: ['WSTG-BUSL-08'],
    cwe: ['CWE-434'],
    applicability: rule.is('hasFileUpload', true),
    tags: ['business-logic'],
  },
  {
    id: 'LOGIC-010',
    vulnerabilityName: 'Segregation of Duties Bypass',
    category: 'business-logic',
    priority: 'High',
    description:
      'A single user can both initiate and approve a sensitive operation, defeating maker-checker controls through self-approval or role-switching.',
    testingGuidance: [
      'Attempt to approve a request created by the same account, directly via the approval endpoint.',
      'Test whether an account holding two roles can complete both steps.',
      'Check whether approval state can be set during creation via mass assignment.',
    ],
    owasp: ['WSTG-BUSL-*'],
    cwe: ['CWE-863'],
    applicability: rule.all(rule.is('hasWorkflowOrTransactions', true), rule.is('hasMultipleRoles', true)),
    tags: ['business-logic'],
  },
  {
    id: 'LOGIC-011',
    vulnerabilityName: 'Function Abuse for Unintended Purposes',
    category: 'business-logic',
    priority: 'Medium',
    description:
      'Legitimate features are repurposed against the business — using file storage as a CDN, invites as a spam channel, or search as a data extraction tool.',
    testingGuidance: [
      'For each feature, consider how it benefits an attacker at scale rather than whether it is broken.',
      'Test resource-consuming and outbound-messaging features specifically.',
      'Record realistic abuse scenarios with the volume achievable.',
    ],
    owasp: ['WSTG-BUSL-09'],
    cwe: ['CWE-840'],
    applicability: rule.always(),
    tags: ['business-logic'],
  },
];
