import type { TestDefinition } from '../../domain/types';
import { rule } from '../../domain/applicability';

export const cryptoTests: TestDefinition[] = [
  {
    id: 'CRYPTO-001',
    vulnerabilityName: 'Weak Password Hashing and Credential Storage',
    category: 'cryptography',
    priority: 'Critical',
    description:
      'Passwords are stored in plaintext, reversibly encrypted, or hashed with fast/unsalted algorithms (MD5, SHA-1), making mass credential recovery trivial after a database compromise.',
    testingGuidance: [
      'Where source or database access exists, verify use of bcrypt, scrypt, Argon2 or PBKDF2 with adequate cost and unique salts.',
      'Look for password recovery flows that email the original password — proof of reversible storage.',
      'Check that password comparison is constant time and that hashes are never returned by APIs.',
    ],
    owasp: ['A02:2021', 'WSTG-CRYP-*'],
    cwe: ['CWE-916', 'CWE-256'],
    applicability: rule.is('hasAuthentication', true),
    tags: ['crypto'],
  },
  {
    id: 'CRYPTO-002',
    vulnerabilityName: 'Use of Weak or Deprecated Cryptographic Algorithms',
    category: 'cryptography',
    priority: 'High',
    description:
      'The application relies on broken primitives or unsafe modes — DES/3DES, RC4, MD5/SHA-1 for signatures, ECB mode, static IVs — undermining confidentiality or integrity.',
    testingGuidance: [
      'Identify cryptographic use in tokens, cookies, exports and stored data.',
      'Inspect ciphertext for ECB patterns (repeating blocks) and reused IVs across messages.',
      'Where code is available, review algorithm, mode, key length and IV generation.',
    ],
    owasp: ['A02:2021', 'WSTG-CRYP-04'],
    cwe: ['CWE-327'],
    applicability: rule.always(),
    tags: ['crypto'],
  },
  {
    id: 'CRYPTO-003',
    vulnerabilityName: 'Hardcoded Secrets and Cryptographic Keys',
    category: 'cryptography',
    priority: 'Critical',
    description:
      'API keys, signing keys, database credentials or encryption keys are embedded in client code, mobile packages, configuration files or repositories.',
    testingGuidance: [
      'Grep JavaScript bundles, mobile packages and exposed config files for key material and credential patterns.',
      'Test any discovered key against the corresponding service to confirm validity and privilege.',
      'Check git history and source maps where available.',
    ],
    owasp: ['A02:2021'],
    cwe: ['CWE-798'],
    applicability: rule.always(),
    tags: ['crypto', 'secrets'],
  },
  {
    id: 'CRYPTO-004',
    vulnerabilityName: 'Insufficient Randomness in Security Tokens',
    category: 'cryptography',
    priority: 'High',
    description:
      'Tokens for password reset, invitations, API keys, MFA or CSRF are generated with predictable sources (timestamps, sequential counters, Math.random), allowing prediction.',
    testingGuidance: [
      'Collect many tokens and analyse structure, character set and entropy.',
      'Look for embedded timestamps, incrementing components or user data.',
      'Attempt to predict a token generated at a known time for a known account.',
    ],
    owasp: ['WSTG-CRYP-*'],
    cwe: ['CWE-330', 'CWE-338'],
    applicability: rule.is('hasAuthentication', true),
    tags: ['crypto'],
  },
  {
    id: 'CRYPTO-005',
    vulnerabilityName: 'Padding Oracle / Cryptographic Oracle',
    category: 'cryptography',
    priority: 'High',
    description:
      'Differing responses to malformed ciphertext allow an attacker to decrypt or forge encrypted values such as cookies, tokens and view state.',
    testingGuidance: [
      'Identify encrypted blobs handled by the application and tamper with the final block.',
      'Compare error messages, status codes and timing across malformed inputs.',
      'Where an oracle is confirmed, demonstrate decryption of a benign value only.',
    ],
    owasp: ['WSTG-CRYP-02'],
    cwe: ['CWE-209', 'CWE-347'],
    applicability: rule.always(),
    tags: ['crypto'],
  },
  {
    id: 'CRYPTO-006',
    vulnerabilityName: 'Sensitive Data Stored Without Encryption',
    category: 'cryptography',
    priority: 'High',
    description:
      'Personal, financial or authentication data is stored unencrypted at rest in databases, object storage, backups, caches or client-side storage.',
    testingGuidance: [
      'Determine which sensitive fields are stored and whether field or volume level encryption is applied.',
      'Check backups, log stores, message queues and analytics pipelines — commonly overlooked copies.',
      'For mobile and browser clients, inspect local databases and preference files.',
    ],
    owasp: ['A02:2021'],
    cwe: ['CWE-311'],
    applicability: rule.any(rule.is('handlesPii', true), rule.is('handlesPayments', true), rule.is('handlesHealthData', true)),
    tags: ['crypto'],
  },
  {
    id: 'CRYPTO-007',
    vulnerabilityName: 'Missing Integrity Verification of Signed Data',
    category: 'cryptography',
    priority: 'High',
    description:
      'Signed or MAC-protected values (tokens, cookies, webhooks, licence data) are accepted without verifying the signature, or verification can be skipped by removing it.',
    testingGuidance: [
      'Strip the signature component and resubmit; also submit an invalid signature.',
      'Test whether the algorithm or key identifier can be attacker-selected.',
      'For webhooks, replay a modified payload without a valid signature header.',
    ],
    owasp: ['A08:2021'],
    cwe: ['CWE-345', 'CWE-347'],
    applicability: rule.any(rule.includes('authMechanisms', 'jwt'), rule.is('callsExternalServices', true)),
    tags: ['crypto'],
  },
  {
    id: 'CRYPTO-008',
    vulnerabilityName: 'Encrypted Value Tampering (Bit Flipping)',
    category: 'cryptography',
    priority: 'Medium',
    description:
      'Ciphertext without integrity protection can be modified in predictable ways (CBC bit flipping, ECB block shuffling) to change the decrypted plaintext.',
    testingGuidance: [
      'Locate encrypted parameters that map to structured plaintext (user=alice;role=user).',
      'Flip bits in preceding blocks or reorder ECB blocks and observe the resulting behaviour.',
      'Report the absence of authenticated encryption where tampering is accepted.',
    ],
    owasp: ['WSTG-CRYP-*'],
    cwe: ['CWE-353'],
    applicability: rule.always(),
    tags: ['crypto'],
  },
];

export const fileTests: TestDefinition[] = [
  {
    id: 'FILE-001',
    vulnerabilityName: 'Unrestricted File Upload',
    category: 'file-handling',
    priority: 'Critical',
    description:
      'The upload function does not adequately restrict file type, content or destination, allowing dangerous files to be stored and potentially executed.',
    testingGuidance: [
      'Test extension allow/deny lists with double extensions, case variation, trailing characters, null bytes and alternate executable extensions.',
      'Spoof Content-Type and magic bytes to defeat weak content checks.',
      'Confirm whether validation happens server-side by bypassing the UI entirely.',
    ],
    owasp: ['WSTG-BUSL-08', 'WSTG-BUSL-09'],
    cwe: ['CWE-434'],
    applicability: rule.is('hasFileUpload', true),
    tags: ['file-upload'],
  },
  {
    id: 'FILE-002',
    vulnerabilityName: 'Remote Code Execution via File Upload',
    category: 'file-handling',
    priority: 'Critical',
    description:
      'An uploaded file lands in a location where the server will execute it, giving the attacker code execution (web shell).',
    testingGuidance: [
      'Determine the storage path and whether it is served by the web server with execution enabled.',
      'Upload a benign script that echoes a marker (never a full shell) and request it.',
      'Test alternate execution vectors: .htaccess/web.config upload, path traversal in the filename, archive extraction paths.',
    ],
    owasp: ['WSTG-BUSL-09'],
    cwe: ['CWE-434', 'CWE-94'],
    applicability: rule.is('hasFileUpload', true),
    tags: ['file-upload', 'rce'],
  },
  {
    id: 'FILE-003',
    vulnerabilityName: 'Missing Malware Scanning of Uploads',
    category: 'file-handling',
    priority: 'Medium',
    description:
      'Uploaded files are stored and redistributed without anti-malware inspection, allowing the platform to be used to host or spread malicious content.',
    testingGuidance: [
      'Upload the EICAR test file and confirm whether it is detected, quarantined or stored.',
      'Check whether files are scanned before being made available for download.',
      'Verify scanning applies to all upload paths including API and bulk import.',
    ],
    owasp: ['WSTG-BUSL-09'],
    cwe: ['CWE-509'],
    applicability: rule.all(rule.is('hasFileUpload', true), rule.is('hasFileDownload', true)),
    tags: ['file-upload'],
  },
  {
    id: 'FILE-004',
    vulnerabilityName: 'Path Traversal via Uploaded File Name',
    category: 'file-handling',
    priority: 'High',
    description:
      'The supplied file name is used to build the storage path, allowing files to be written outside the intended directory and to overwrite application files.',
    testingGuidance: [
      'Submit filenames containing ../, absolute paths and encoded traversal sequences.',
      'Test archive uploads containing traversal entries (zip slip).',
      'Confirm whether the stored name is sanitised or regenerated server-side.',
    ],
    owasp: ['WSTG-BUSL-09'],
    cwe: ['CWE-22'],
    applicability: rule.is('hasFileUpload', true),
    tags: ['file-upload', 'traversal'],
  },
  {
    id: 'FILE-005',
    vulnerabilityName: 'Insecure Access Control on Stored Files',
    category: 'file-handling',
    priority: 'High',
    description:
      'Uploaded files are retrievable by anyone who knows or can guess the URL, without authentication or ownership checks.',
    testingGuidance: [
      'Upload a file as one user and request it unauthenticated and as another user.',
      'Assess name predictability (sequential IDs, original filenames, weak hashes).',
      'Check direct object storage URLs and pre-signed link scope and expiry.',
    ],
    owasp: ['A01:2021'],
    cwe: ['CWE-284'],
    applicability: rule.is('hasFileUpload', true),
    tags: ['file-upload'],
  },
  {
    id: 'FILE-006',
    vulnerabilityName: 'Arbitrary File Download',
    category: 'file-handling',
    priority: 'Critical',
    description:
      'A download endpoint takes a file identifier or path from the client and returns any file readable by the application user.',
    testingGuidance: [
      'Manipulate the file parameter with traversal, absolute paths and known system files.',
      'Attempt to retrieve application source and configuration files.',
      'Test identifier substitution to reach other users\' documents.',
    ],
    owasp: ['WSTG-ATHZ-01'],
    cwe: ['CWE-22', 'CWE-548'],
    applicability: rule.is('hasFileDownload', true),
    tags: ['file-download'],
  },
  {
    id: 'FILE-007',
    vulnerabilityName: 'Malicious Content in Rendered Files (SVG / HTML / Document Parsers)',
    category: 'file-handling',
    priority: 'High',
    description:
      'Uploaded SVG, HTML or office documents are rendered by the browser or processed by image/document libraries, producing stored XSS, XXE or parser-level code execution.',
    testingGuidance: [
      'Upload an SVG containing script and confirm whether it is served inline with an image content type.',
      'Upload an XLSX/DOCX containing an external entity or remote template reference.',
      'Check server-side processing libraries (ImageMagick, ghostscript, PDF renderers) for known exploitable behaviour.',
    ],
    owasp: ['WSTG-INPV-02'],
    cwe: ['CWE-79', 'CWE-611'],
    applicability: rule.is('hasFileUpload', true),
    tags: ['file-upload'],
  },
  {
    id: 'FILE-008',
    vulnerabilityName: 'Missing File Size and Rate Limits on Uploads',
    category: 'file-handling',
    priority: 'Medium',
    description:
      'Uploads are not bounded in size, count or rate, allowing storage exhaustion and denial of service, or use of the platform as free file hosting.',
    testingGuidance: [
      'Upload progressively larger files and confirm the enforced ceiling is server-side.',
      'Upload many files in parallel and measure throttling.',
      'Test decompression bombs where archives are expanded server-side.',
    ],
    owasp: ['WSTG-BUSL-09'],
    cwe: ['CWE-400', 'CWE-770'],
    applicability: rule.is('hasFileUpload', true),
    tags: ['file-upload', 'dos'],
  },
];
