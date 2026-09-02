# Robustness & Security Pass — Part 1

Input validation, state integrity, error handling and defensive rendering. No features added, no
workflow changed, no visual redesign.

Every issue below was reproduced against the running application before it was fixed, and each is
now pinned by a test in [`src/audit/robustness.audit.test.tsx`](../src/audit/robustness.audit.test.tsx).

---

## 1. Issues found

| # | Issue | Severity | How it showed up |
| --- | --- | --- | --- |
| 1 | **Failed saves looked like successful saves.** Twelve call sites wrote with `void updateTestState(...)` — a rejected promise vanished. A refused state change, a full quota or a closed database produced no message; the control snapped back with no explanation and a half-typed note was lost silently | **High** | Static: 12 unhandled writes, 0 `catch` |
| 2 | **`notes: null` crashed the workspace.** The filter calls `notes.toLowerCase()`, so one malformed row took down the whole screen | **High** | `CRASH … Cannot read properties of null (reading 'toLowerCase')` |
| 3 | **An unknown `applicationType` crashed the dashboard and wizard.** `COVERAGE_BY_TYPE[type].support` on a value outside the set | **High** | `CRASH … Cannot read properties of undefined (reading 'support')` |
| 4 | **A missing `context` object crashed applicability.** `effectiveContext` dereferenced it directly | **High** | `CRASH … Cannot read properties of undefined (reading 'additionalSurfaces')` |
| 5 | **Backup import accepted an arbitrary application type**, which then triggered #3 | **Medium** | `backup with bogus applicationType accepted? true` |
| 6 | **No length limit on any stored text.** A 40,000-character note exported a 40,000-character cell — Excel's hard limit is 32,767, so the workbook is truncated or refused | **Medium** | `longest exported cell = 40000` |
| 7 | **Writing to a non-existent test id returned silently**, so the caller believed the save succeeded | **Medium** | `OK  updateTestState with unknown test id` (no error) |
| 8 | **Three writes outside the workspace were unguarded** — engagement status changes and the startup repair pass | **Low** | Static |
| 9 | **Read-normalisation masked the repair pass** — introduced while fixing #2, caught by an existing test: repair saw clean rows and left the corruption on disk forever | **Medium** | Two audit tests failed |

---

## 2. Issues fixed

### Failed saves are now reported (#1, #8)

`src/features/workspace/recordState.ts` is the single write path for the workspace. It never throws
at the caller; it reports:

- A refused state change names the invariant it broke.
- `QuotaExceededError` becomes *"This browser is out of storage for the site. Export a JSON backup,
  then clear old engagements."*
- **A note that fails to save says so and keeps the text on screen**: *"Not saved — this note is
  only in the editor. Copy it before leaving the page."* Losing a finding you have just typed is the
  worst outcome this application has, so it is the one case with a persistent inline warning rather
  than a toast.

The three remaining writes elsewhere (engagement status ×2, the repair pass) now report too.

### Everything from storage is normalised on read (#2, #3, #4)

`normaliseState()` and `normaliseEngagement()` coerce a stored row into a shape the rest of the app
can rely on: status and result to the known sets, `notes` to a string, `applicable` to a boolean,
`context` to an object, `scope` to an array, `applicationType` to a supported value. Applied in
`listStates`, `listEngagements` and `getEngagement`, so **no screen has to defend itself**.

`coverageFor()` replaces every raw `COVERAGE_BY_TYPE[...]` lookup and falls back rather than
returning `undefined`.

**The subtle part (#9):** normalising on read hid the corruption from `repairIntegrity`, which then
fixed nothing and left the bad row on disk permanently. Repair now reads through `listRawStates()`
— normalised for consumers, raw for the repair pass. An existing audit test caught this
regression within a minute of introducing it.

### Input is bounded (#6)

`TEXT_LIMITS` in `src/domain/untrusted.ts` — engagement name 200, URL 2,048, client/tester 120,
scope entry 300 (max 50 entries), description 5,000, notes 20,000. Enforced in the repository, so a
crafted backup is bounded too, and mirrored as `maxLength` on the inputs. `safeSpreadsheetText`
additionally truncates at Excel's 32,767-character limit with a visible `[…truncated]` marker —
better than handing a client a workbook Excel will not open.

### Validation at the boundaries (#5, #7)

- `isApplicationTypeId()` / `toApplicationTypeId()`; `inspectBackup` now rejects an unknown
  application type and oversized name, URL, description or notes.
- Writing to a test id that is not in the engagement throws with a message that names the likely
  cause (needs a library sync) instead of returning quietly.

---

## 3. Security concerns

| Area | Status |
| --- | --- |
| **XSS / HTML injection** | React escapes all interpolated content; there is no `dangerouslySetInnerHTML`, `innerHTML`, `eval` or `new Function` anywhere in the source. A note containing `<img src=x onerror=…>` renders as text — asserted by test, including that no element is created and no global is set |
| **URL handling** | Only `http:` and `https:` reach an `href`. `javascript:`, `data:`, `vbscript:` and `file:` are displayed as plain text, never linked. The wizard now warns inline when a URL will not be linkable |
| **Spreadsheet formula injection** | Tester-controlled cells with a leading `=`, `+`, `-`, `@`, tab or CR are neutralised — the product ships INJ-017 for this, so its own export must not be vulnerable |
| **Search input** | Substring matching, never `new RegExp` on user input: no ReDoS, no crash on `(`, `[`, `\`. Verified against regex metacharacters, a 5,000-character term, SQL and script payloads, and astral-plane Unicode |
| **Untrusted import** | Shape, enums, timestamps, cross-references, duplicate ids, application type, field sizes and the state-machine invariants are all checked *before* the transaction opens. A rejected file changes nothing |
| **Dependencies** | `npm audit`: 0 vulnerabilities |
| **Data at rest** | Unencrypted in IndexedDB — appropriate for a local-first tool, and stated plainly in the UI. Anyone with the device profile can read it |

---

## 4. Remaining limitations

1. **Storage exhaustion is reported, not prevented.** The tester is told when a write fails and
   pointed at a backup, but there is no proactive quota warning as usage approaches the limit.
2. **Orphaned state rows are never reclaimed.** Rows for tests merged out of the library stay on
   disk deliberately (they are the tester's record) and are reported by sync, but they do consume
   quota.
3. **No cross-tab coordination.** Two tabs on the same engagement each write last-write-wins.
   Dexie's live queries keep both views current, so this is a narrow race, not silent corruption.
4. **Normalisation is silent.** A coerced row is repaired or read safely, but only the
   `repairIntegrity` pass tells the tester anything happened; a `notes: null` row is quietly read as
   `''`.
5. **`maxLength` truncates without explanation** on the optional fields. Only the engagement name
   shows "Maximum length reached".

---

## 5. Follow-up (separate work)

1. **Proactive storage headroom** — `navigator.storage.estimate()` is already read on the Settings
   screen; warn before writes start failing rather than after.
2. **Cross-tab locking or a "changed elsewhere" notice** via `BroadcastChannel`.
3. **A data-health screen** — orphaned rows, coerced fields and library drift in one place, with
   the option to reclaim space. The pieces exist (`repairIntegrity`, `syncLibrary`, the storage
   estimate); they are not surfaced together.
4. **Optional encryption at rest** for engagement data, with the key held by the tester. A real
   feature with real key-management consequences, not a hardening tweak.

---

## Workflow verified after the changes

Create Engagement → Application Type → Context → Applicable Tests → Status/Result → Notes →
Dashboard → Persistence, all exercised through the UI. **235 tests pass**; production build clean.
