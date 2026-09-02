import type { Category } from '../domain/types';

/**
 * Categories of the bundled VAPT knowledge base.
 * The `code` is the ID prefix for every test in the category and is stable.
 */
export const CATEGORIES: Category[] = [
  {
    id: 'recon',
    code: 'INFO',
    name: 'Information Gathering',
    description: 'Reconnaissance and mapping of the attack surface.',
  },
  {
    id: 'config',
    code: 'CONF',
    name: 'Configuration & Deployment',
    description: 'Server, framework and platform hardening issues.',
  },
  {
    id: 'transport',
    code: 'TLS',
    name: 'Transport Security',
    description: 'TLS configuration and data-in-transit protection.',
  },
  {
    id: 'authentication',
    code: 'AUTH',
    name: 'Authentication',
    description: 'Identity proofing, credentials, MFA and recovery flows.',
  },
  {
    id: 'session',
    code: 'SESS',
    name: 'Session Management',
    description: 'Session and token lifecycle weaknesses.',
  },
  {
    id: 'authorization',
    code: 'AUTHZ',
    name: 'Authorization & Access Control',
    description: 'Horizontal and vertical privilege boundaries.',
  },
  {
    id: 'input-validation',
    code: 'INJ',
    name: 'Input Validation & Injection',
    description: 'Untrusted input reaching an interpreter.',
  },
  {
    id: 'client-side',
    code: 'CLI',
    name: 'Client-Side Security',
    description: 'Browser-side execution, storage and framing issues.',
  },
  {
    id: 'business-logic',
    code: 'LOGIC',
    name: 'Business Logic',
    description: 'Abuse of legitimate functionality and workflow flaws.',
  },
  {
    id: 'cryptography',
    code: 'CRYPTO',
    name: 'Cryptography',
    description: 'Weak, misused or missing cryptographic controls.',
  },
  {
    id: 'file-handling',
    code: 'FILE',
    name: 'File Handling',
    description: 'Upload, download, storage and parsing of files.',
  },
  {
    id: 'api',
    code: 'API',
    name: 'API Security',
    description: 'REST/SOAP API specific weaknesses.',
  },
  {
    id: 'graphql',
    code: 'GQL',
    name: 'GraphQL',
    description: 'GraphQL schema and resolver specific weaknesses.',
  },
  {
    id: 'disclosure',
    code: 'DISC',
    name: 'Information Disclosure',
    description: 'Leakage of sensitive data through the application.',
  },
  {
    id: 'availability',
    code: 'DOS',
    name: 'Availability & Rate Limiting',
    description: 'Resource exhaustion and abuse-prevention controls.',
  },
  {
    id: 'cloud',
    code: 'CLOUD',
    name: 'Cloud & Infrastructure',
    description: 'Cloud service, container and network exposure issues.',
  },
  {
    id: 'mobile',
    code: 'MOB',
    name: 'Mobile Application',
    description: 'Android/iOS client-side and platform issues.',
  },
  {
    id: 'privacy',
    code: 'PRIV',
    name: 'Privacy & Data Protection',
    description: 'Handling of personal and regulated data.',
  },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<
  Category['id'],
  Category
>;

export function categoryName(id: string): string {
  return CATEGORY_BY_ID[id as Category['id']]?.name ?? id;
}
