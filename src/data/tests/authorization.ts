import type { TestDefinition } from '../../domain/types';
import { rule } from '../../domain/applicability';

const auth = rule.is('hasAuthentication', true);
const roles = rule.is('hasMultipleRoles', true);

export const authorizationTests: TestDefinition[] = [
  {
    id: 'AUTHZ-001',
    vulnerabilityName: 'Broken Access Control',
    category: 'authorization',
    priority: 'Critical',
    description:
      'The application fails to enforce, or enforces inconsistently, restrictions on what authenticated users can do — permitting access to functions and data outside their permission set.',
    testingGuidance: [
      'Build an access matrix: role × function × expected outcome, from the roles supplied for the engagement.',
      'Replay every privileged request with each lower-privileged session and with no session.',
      'Compare responses carefully — a 200 with empty data is different from a 403 and may still leak existence.',
      'Test both the UI route and the underlying API for each function.',
    ],
    owasp: ['A01:2021', 'WSTG-ATHZ-02'],
    cwe: ['CWE-284', 'CWE-862'],
    applicability: auth,
    tags: ['authorization'],
  },
  {
    id: 'AUTHZ-002',
    vulnerabilityName: 'IDOR / Broken Object Level Authorization (BOLA)',
    category: 'authorization',
    priority: 'Critical',
    description:
      'Object identifiers supplied by the client are used to retrieve or modify records without verifying that the requester owns them, exposing other users\' data.',
    testingGuidance: [
      'Enumerate every request carrying an object reference (id, uuid, filename, account number, hash).',
      'Substitute identifiers belonging to a second test account and observe read, update and delete outcomes.',
      'Test indirect references too: exports, print views, attachments, notification links and bulk endpoints.',
      'Where identifiers are UUIDs, look for leakage of other users\' identifiers elsewhere in the application.',
    ],
    owasp: ['API1:2023', 'WSTG-ATHZ-04'],
    cwe: ['CWE-639', 'CWE-566'],
    applicability: auth,
    tags: ['authorization', 'idor'],
  },
  {
    id: 'AUTHZ-003',
    vulnerabilityName: 'Vertical Privilege Escalation',
    category: 'authorization',
    priority: 'Critical',
    description:
      'A lower-privileged user can invoke functionality reserved for higher-privileged roles such as administrators.',
    testingGuidance: [
      'Capture administrative requests with an admin session, then replay them with a standard user session.',
      'Manipulate role indicators in requests, tokens and profile updates (role=admin, isAdmin=true, group IDs).',
      'Test admin-only UI routes directly and check whether the API enforces the restriction independently.',
    ],
    owasp: ['WSTG-ATHZ-03', 'A01:2021'],
    cwe: ['CWE-269'],
    applicability: rule.all(auth, roles),
    tags: ['authorization'],
  },
  {
    id: 'AUTHZ-004',
    vulnerabilityName: 'Horizontal Privilege Escalation',
    category: 'authorization',
    priority: 'High',
    description:
      'A user can act on resources belonging to another user of the same privilege level, typically through identifier manipulation in state-changing operations.',
    testingGuidance: [
      'Create two same-role accounts and attempt cross-account read, update, delete and export.',
      'Include workflow actions such as approve, cancel, share and transfer.',
      'Test parameter pollution and array/JSON forms of the identifier (id=1&id=2, "id":[1,2]).',
    ],
    owasp: ['WSTG-ATHZ-04'],
    cwe: ['CWE-639'],
    applicability: auth,
    tags: ['authorization'],
  },
  {
    id: 'AUTHZ-005',
    vulnerabilityName: 'Forced Browsing to Restricted Resources',
    category: 'authorization',
    priority: 'High',
    description:
      'Restricted pages, files and endpoints are protected only by not being linked, and can be reached by requesting the URL directly.',
    testingGuidance: [
      'Collect privileged URLs from JS bundles, sitemaps, API schemas and admin sessions.',
      'Request each unauthenticated and as a low-privileged user.',
      'Include static assets that contain sensitive data (reports, invoices, exports).',
    ],
    owasp: ['WSTG-ATHZ-01'],
    cwe: ['CWE-425'],
    applicability: rule.always(),
    tags: ['authorization'],
  },
  {
    id: 'AUTHZ-006',
    vulnerabilityName: 'Path Traversal in Access Control',
    category: 'authorization',
    priority: 'High',
    description:
      'Traversal sequences or URL encoding tricks in the request path bypass proxy, gateway or framework access control rules that match on prefixes.',
    testingGuidance: [
      'Test path normalisation bypasses: /admin/..;/, //admin, /%2e%2e/admin, /./admin, trailing dot/slash variants.',
      'Where a reverse proxy or WAF enforces rules, test whether the origin applies the same restriction.',
      'Test case sensitivity differences between the gateway and the application.',
    ],
    owasp: ['WSTG-ATHZ-01'],
    cwe: ['CWE-22', 'CWE-288'],
    applicability: rule.any(rule.is('usesCdnOrProxy', true), rule.is('hasAdminInterface', true)),
    tags: ['authorization'],
  },
  {
    id: 'AUTHZ-007',
    vulnerabilityName: 'Mass Assignment / Broken Object Property Level Authorization',
    category: 'authorization',
    priority: 'High',
    description:
      'The application binds client-supplied fields directly to internal objects, letting an attacker set properties they should not control (role, balance, verified, tenantId).',
    testingGuidance: [
      'Compare object properties returned by GET with those accepted by POST/PUT/PATCH.',
      'Add sensitive properties to update requests and confirm whether they persist.',
      'Test nested objects and array forms, which are frequently missed by allow-lists.',
    ],
    owasp: ['API3:2023'],
    cwe: ['CWE-915'],
    applicability: rule.all(auth, rule.includes('assetTypes', 'rest-api', 'graphql-api', 'web-app')),
    tags: ['authorization', 'api'],
  },
  {
    id: 'AUTHZ-008',
    vulnerabilityName: 'Multi-Tenant Data Segregation Failure',
    category: 'authorization',
    priority: 'Critical',
    description:
      'Tenant scoping is missing or client-controlled, so a user of one organisation can read or modify another organisation\'s data.',
    testingGuidance: [
      'Identify how the tenant is determined (subdomain, header, claim, path) and attempt to change it.',
      'With two tenant accounts, cross-test every data-bearing endpoint including search, reports and exports.',
      'Check shared resources: file storage paths, cached responses, background jobs and notification content.',
    ],
    owasp: ['A01:2021', 'API1:2023'],
    cwe: ['CWE-653', 'CWE-639'],
    applicability: rule.is('hasMultiTenancy', true),
    tags: ['authorization', 'multi-tenant'],
  },
  {
    id: 'AUTHZ-009',
    vulnerabilityName: 'Broken Function Level Authorization (BFLA)',
    category: 'authorization',
    priority: 'Critical',
    description:
      'API operations are exposed without per-operation authorisation, so any authenticated caller can invoke administrative or privileged functions.',
    testingGuidance: [
      'Extract the complete operation list from the API schema or JS client, including undocumented ones.',
      'Call each administrative operation with a low-privileged token.',
      'Test HTTP verb variations on the same path (GET allowed, DELETE unprotected).',
    ],
    owasp: ['API5:2023'],
    cwe: ['CWE-285'],
    applicability: rule.includes('assetTypes', 'rest-api', 'graphql-api', 'soap-api'),
    tags: ['authorization', 'api'],
  },
  {
    id: 'AUTHZ-010',
    vulnerabilityName: 'Privilege Escalation via Role or Group Manipulation',
    category: 'authorization',
    priority: 'High',
    description:
      'Role assignment functions can be invoked by unprivileged users, or role values inside tokens, cookies and hidden fields are trusted without verification.',
    testingGuidance: [
      'Attempt self-assignment of privileged roles via user profile, invitation and group membership endpoints.',
      'Modify role claims in tokens/cookies and observe whether the server re-derives permissions.',
      'Test the invite flow: can a standard user invite a new administrator?',
    ],
    owasp: ['WSTG-ATHZ-03'],
    cwe: ['CWE-269'],
    applicability: rule.all(auth, roles),
    tags: ['authorization'],
  },
  {
    id: 'AUTHZ-011',
    vulnerabilityName: 'Access Control Based on Untrusted Headers or Referer',
    category: 'authorization',
    priority: 'High',
    description:
      'Authorisation decisions rely on client-controllable inputs such as Referer, X-Forwarded-For, custom role headers or the requesting hostname.',
    testingGuidance: [
      'Remove or forge Referer on protected requests and observe the outcome.',
      'Test internal-only headers (X-Forwarded-For: 127.0.0.1, X-Internal: true, X-Original-URL, X-Rewrite-URL).',
      'Attempt to reach internal-only endpoints by spoofing the host or origin.',
    ],
    owasp: ['WSTG-ATHZ-01'],
    cwe: ['CWE-807', 'CWE-290'],
    applicability: rule.any(rule.is('usesCdnOrProxy', true), auth),
    tags: ['authorization'],
  },
  {
    id: 'AUTHZ-012',
    vulnerabilityName: 'Unauthorised Access to Generated Files and Exports',
    category: 'authorization',
    priority: 'High',
    description:
      'Reports, invoices, attachments and exported datasets are stored at predictable or unauthenticated URLs, bypassing application-level access control.',
    testingGuidance: [
      'Generate an export as one user and request its URL unauthenticated and as another user.',
      'Assess predictability of the generated file name or identifier.',
      'Check object storage links (pre-signed URLs) for excessive lifetime and missing scoping.',
    ],
    owasp: ['A01:2021'],
    cwe: ['CWE-425', 'CWE-548'],
    applicability: rule.any(rule.is('hasDataExport', true), rule.is('hasFileDownload', true)),
    tags: ['authorization'],
  },
];
