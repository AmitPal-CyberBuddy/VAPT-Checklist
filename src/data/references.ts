/**
 * VAPT Checklist — Reference resolution
 * ---------------------------------------------------------------------------
 * References are *derived* from the standards codes a test already declares,
 * not typed out per test. Hand-written link lists rot, drift between entries
 * and tempt placeholder content; a mapping from code to canonical URL gives
 * every test correct links for free and fails loudly when a code is malformed.
 */

import type { Reference, TestDefinition } from '../domain/types';

const TOP_10_2021: Record<string, string> = {
  'A01:2021': 'A01_2021-Broken_Access_Control',
  'A02:2021': 'A02_2021-Cryptographic_Failures',
  'A03:2021': 'A03_2021-Injection',
  'A04:2021': 'A04_2021-Insecure_Design',
  'A05:2021': 'A05_2021-Security_Misconfiguration',
  'A06:2021': 'A06_2021-Vulnerable_and_Outdated_Components',
  'A07:2021': 'A07_2021-Identification_and_Authentication_Failures',
  'A08:2021': 'A08_2021-Software_and_Data_Integrity_Failures',
  'A09:2021': 'A09_2021-Security_Logging_and_Monitoring_Failures',
  'A10:2021': 'A10_2021-Server-Side_Request_Forgery_%28SSRF%29',
};

const API_TOP_10_2023: Record<string, string> = {
  'API1:2023': '0xa1-broken-object-level-authorization',
  'API2:2023': '0xa2-broken-authentication',
  'API3:2023': '0xa3-broken-object-property-level-authorization',
  'API4:2023': '0xa4-unrestricted-resource-consumption',
  'API5:2023': '0xa5-broken-function-level-authorization',
  'API6:2023': '0xa6-unrestricted-access-to-sensitive-business-flows',
  'API7:2023': '0xa7-server-side-request-forgery',
  'API8:2023': '0xa8-security-misconfiguration',
  'API9:2023': '0xa9-improper-inventory-management',
  'API10:2023': '0xaa-unsafe-consumption-of-apis',
};

/** WSTG section prefix → the chapter it lives in, used to build the deep link. */
const WSTG_SECTIONS: Record<string, string> = {
  INFO: '01-Information_Gathering',
  CONF: '02-Configuration_and_Deployment_Management_Testing',
  IDNT: '03-Identity_Management_Testing',
  ATHN: '04-Authentication_Testing',
  ATHZ: '05-Authorization_Testing',
  SESS: '06-Session_Management_Testing',
  INPV: '07-Input_Validation_Testing',
  ERRH: '08-Testing_for_Error_Handling',
  CRYP: '09-Testing_for_Weak_Cryptography',
  BUSL: '10-Business_Logic_Testing',
  CLNT: '11-Client-side_Testing',
  APIT: '12-API_Testing',
};

const WSTG_BASE =
  'https://owasp.org/www-project-web-security-testing-guide/stable/4-Web_Application_Security_Testing';

export function isKnownStandardCode(code: string): boolean {
  if (code in TOP_10_2021 || code in API_TOP_10_2023) return true;
  if (/^WSTG-[A-Z]{4}-\d{2}$/.test(code)) return code.split('-')[1] in WSTG_SECTIONS;
  if (/^MASVS-[A-Z]+-\d$/.test(code)) return true;
  return false;
}

function standardUrl(code: string): string | null {
  if (code in TOP_10_2021) return `https://owasp.org/Top10/${TOP_10_2021[code]}/`;
  if (code in API_TOP_10_2023) {
    return `https://owasp.org/API-Security/editions/2023/en/${API_TOP_10_2023[code]}/`;
  }
  const wstg = /^WSTG-([A-Z]{4})-(\d{2})$/.exec(code);
  if (wstg && wstg[1] in WSTG_SECTIONS) {
    return `${WSTG_BASE}/${WSTG_SECTIONS[wstg[1]]}/`;
  }
  if (/^MASVS-/.test(code)) return 'https://mas.owasp.org/MASVS/';
  return null;
}

function cweUrl(code: string): string | null {
  const match = /^CWE-(\d+)$/.exec(code);
  return match ? `https://cwe.mitre.org/data/definitions/${match[1]}.html` : null;
}

/**
 * All external references for a test, resolved from its standards mapping.
 * Ordered: OWASP first (the framing a report reader expects), then CWE.
 */
export function resolveReferences(definition: TestDefinition): Reference[] {
  const refs: Reference[] = [];
  for (const code of definition.owasp ?? []) {
    const url = standardUrl(code);
    if (url) refs.push({ label: code, url });
  }
  for (const code of definition.cwe ?? []) {
    const url = cweUrl(code);
    if (url) refs.push({ label: code, url });
  }
  return refs;
}
