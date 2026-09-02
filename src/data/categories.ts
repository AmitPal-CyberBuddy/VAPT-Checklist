import type { Category, CategoryId } from '../domain/types';

/**
 * The security taxonomy.
 *
 * Two levels only:
 *   Category      — the area of the application a tester works through
 *   Subcategory   — the specific concern inside it
 *
 * A deeper tree would look tidy and be useless during testing; two levels keep
 * grouping meaningful without turning navigation into a chore. Every test
 * declares a subcategory drawn from its category's list (enforced by
 * `validateLibrary()`).
 */
export const CATEGORIES: Category[] = [
  {
    id: 'recon',
    code: 'INFO',
    name: 'Information Gathering',
    description: 'Reconnaissance and mapping of the attack surface.',
    subcategories: [
      'OSINT & Exposure',
      'Technology Fingerprinting',
      'Content Discovery',
      'Client-Side Artefacts',
      'Attack Surface Mapping',
    ],
  },
  {
    id: 'config',
    code: 'CONF',
    name: 'Configuration & Deployment',
    description: 'Server, framework and platform hardening issues.',
    subcategories: [
      'Security Headers',
      'Platform Hardening',
      'Component Management',
      'Response Caching',
      'Logging & Monitoring',
      'Supply Chain',
    ],
  },
  {
    id: 'transport',
    code: 'TLS',
    name: 'Transport Security',
    description: 'TLS configuration and data-in-transit protection.',
    subcategories: ['TLS Configuration', 'Certificate Validation', 'Data in Transit'],
  },
  {
    id: 'authentication',
    code: 'AUTH',
    name: 'Authentication',
    description: 'Identity proofing, credentials, MFA and recovery flows.',
    subcategories: [
      'Authentication Logic',
      'Credential Security',
      'Password Policy',
      'Login Controls',
      'Multi-Factor Authentication',
      'Account Recovery',
      'Account Registration',
      'Federated Identity',
    ],
  },
  {
    id: 'session',
    code: 'SESS',
    name: 'Session Management',
    description: 'Session and token lifecycle weaknesses.',
    subcategories: ['Session Lifecycle', 'Cookie Security', 'Token Security', 'Request Forgery'],
  },
  {
    id: 'authorization',
    code: 'AUTHZ',
    name: 'Authorization & Access Control',
    description: 'Horizontal and vertical privilege boundaries.',
    subcategories: [
      'Access Control Enforcement',
      'Object Level Authorization',
      'Function Level Authorization',
      'Privilege Escalation',
      'Tenant Isolation',
    ],
  },
  {
    id: 'input-validation',
    code: 'INJ',
    name: 'Input Validation & Injection',
    description: 'Untrusted input reaching an interpreter.',
    subcategories: [
      'Database Injection',
      'Query Language Injection',
      'Command & Code Injection',
      'Cross-Site Scripting',
      'XML & Parser Injection',
      'Path & File Injection',
      'Protocol & Header Injection',
      'Object Injection',
      'Server-Side Request Forgery',
      'Data Validation',
    ],
  },
  {
    id: 'client-side',
    code: 'CLI',
    name: 'Client-Side Security',
    description: 'Browser-side execution, storage and framing issues.',
    subcategories: [
      'DOM Security',
      'Browser Storage',
      'Cross-Origin Policy',
      'UI Redressing',
      'Real-Time Channels',
      'Third-Party Content',
    ],
  },
  {
    id: 'business-logic',
    code: 'LOGIC',
    name: 'Business Logic',
    description: 'Abuse of legitimate functionality and workflow flaws.',
    subcategories: [
      'Workflow Integrity',
      'Transaction Integrity',
      'Authorisation Workflow',
      'Anti-Automation',
      'Trust Boundary',
    ],
  },
  {
    id: 'cryptography',
    code: 'CRYPTO',
    name: 'Cryptography',
    description: 'Weak, misused or missing cryptographic controls.',
    subcategories: [
      'Credential Storage',
      'Algorithm Strength',
      'Key Management',
      'Randomness',
      'Data at Rest',
      'Integrity Protection',
    ],
  },
  {
    id: 'file-handling',
    code: 'FILE',
    name: 'File Handling',
    description: 'Upload, download, storage and parsing of files.',
    subcategories: ['Upload Validation', 'Upload Storage', 'Content Processing', 'Resource Limits'],
  },
  {
    id: 'api',
    code: 'API',
    name: 'API Security',
    description: 'REST/SOAP API specific weaknesses.',
    subcategories: [
      'API Authentication',
      'API Data Exposure',
      'API Resource Controls',
      'API Surface Management',
      'Request Handling',
      'Third-Party Integration',
      'SOAP Services',
    ],
  },
  {
    id: 'graphql',
    code: 'GQL',
    name: 'GraphQL',
    description: 'GraphQL schema and resolver specific weaknesses.',
    subcategories: [
      'Schema Exposure',
      'Query Controls',
      'GraphQL Authorization',
      'GraphQL Injection',
      'Transport Security',
    ],
  },
  {
    id: 'disclosure',
    code: 'DISC',
    name: 'Information Disclosure',
    description: 'Leakage of sensitive data through the application.',
    subcategories: [
      'Error Handling',
      'Response Data Exposure',
      'Artefact Exposure',
      'Metadata & Logs',
      'Enumeration',
    ],
  },
  {
    id: 'availability',
    code: 'DOS',
    name: 'Availability & Rate Limiting',
    description: 'Resource exhaustion and abuse-prevention controls.',
    subcategories: ['Rate Limiting', 'Resource Exhaustion', 'Abuse Prevention'],
  },
  {
    id: 'cloud',
    code: 'CLOUD',
    name: 'Cloud & Infrastructure',
    description: 'Cloud service, container and network exposure issues.',
    subcategories: [
      'Storage Exposure',
      'Identity & Access',
      'Network Exposure',
      'Container Security',
      'Orchestration',
      'DNS & Domains',
    ],
  },
  {
    id: 'mobile',
    code: 'MOB',
    name: 'Mobile Application',
    description: 'Android/iOS client-side and platform issues.',
    subcategories: [
      'Local Data Storage',
      'Binary & Secrets',
      'Platform Integration',
      'Network Security',
      'Resilience',
    ],
  },
  {
    id: 'privacy',
    code: 'PRIV',
    name: 'Privacy & Data Protection',
    description: 'Handling of personal and regulated data.',
    subcategories: [
      'Data Minimisation',
      'Third-Party Sharing',
      'Consent Management',
      'Data Presentation',
      'Regulated Data',
      'Data Subject Rights',
    ],
  },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<
  CategoryId,
  Category
>;

export function categoryName(id: string): string {
  return CATEGORY_BY_ID[id as CategoryId]?.name ?? id;
}

/** Flat `category → subcategory` list, used to populate filter dropdowns. */
export interface SubcategoryRef {
  category: CategoryId;
  categoryName: string;
  subcategory: string;
}

export const SUBCATEGORIES: SubcategoryRef[] = CATEGORIES.flatMap((c) =>
  c.subcategories.map((subcategory) => ({
    category: c.id,
    categoryName: c.name,
    subcategory,
  })),
);
