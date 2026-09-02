# Robustness & Security Pass

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
Dashboard → Persistence, all exercised through the UI.

---
---

# Part 2 — data integrity, export and production behaviour

Pinned by [`src/audit/production-behaviour.audit.test.tsx`](../src/audit/production-behaviour.audit.test.tsx).

## Important issues found and fixed

### 1. A render failure was a white page — *high*

There was no error boundary. On a static deploy there is no server-side logging and no operator to
notice: an unhandled render error left a blank page, and a tester mid-assessment had no way to know
whether their work survived. It always had — every status, result and note is written to IndexedDB
immediately — but nothing on a blank screen says so.

**Fixed.** `ErrorBoundary` wraps both the shell and the routed screens. It states plainly that the
assessment is safe, offers *Try again* / *Back to engagements* / *Reload*, and puts the stack behind
a `<details>` rather than in the tester's face. Because the routed boundary resets on navigation, a
single broken screen never strands the session — the header and navigation stay usable.

### 2. Background failures vanished — *medium*

A promise rejected outside a component, or an error thrown from a timer or listener, produced a
console entry nobody was reading. **Fixed:** `installGlobalErrorHandlers()` surfaces both, with a
ten-second de-duplication window so a repeating failure does not become a wall of toasts.

### 3. "Storage unavailable" was not actionable — *medium*

Every `db.open()` failure produced the same message regardless of cause. **Fixed:** `checkStorage()`
classifies the failure — blocked origin, version mismatch, upgrade blocked by another tab,
corruption, unknown — and the banner says what to do about each, with the underlying error shown
underneath.

## Verified sound — no change needed

Things worth checking that turned out already correct. Recorded so the next audit does not redo them:

| Area | Evidence |
| --- | --- |
| **Export fidelity** | Quotes, ampersands, angle brackets, `]]>`, CRLF, tabs, CJK, Arabic, Devanagari, emoji and astral-plane characters all round-trip byte-identical into the workbook |
| **Illegal XML characters** | `write-excel-file` strips control characters (`\x00`–`\x1f`) itself, so a pasted payload cannot produce a workbook Excel refuses. Every XML part of a generated file passes a strict parser |
| **Large engagements** | 173 applicable tests each carrying a 1,800-character note: plan 5 ms, write 154 ms, 60 KB. No stalling |
| **Export failure** | Already surfaced with a retry and a pointer to the JSON backup; now covered by a test that breaks the writer |
| **Dexie version handling** | A database left at a higher native version by a newer deploy does **not** throw for the older bundle — Dexie adapts. The cached-bundle hazard I expected is not real here |
| **Console cleanliness** | Zero `console.error` and zero `console.warn` across engagement creation, all four engagement screens and a status change |
| **GitHub Pages** | Served from `/VAPT-Checklist/`: index 200, every asset 200, `.nojekyll` present, all six deep hash routes 200 on refresh, zero absolute or remote references, zero runtime fetches to a remote origin, no dev plumbing |
| **Dependencies** | Ten runtime dependencies, `npm audit` clean, nothing outdated. No CDN at runtime |
| **Navigation data loss** | A note typed and abandoned mid-debounce is flushed both when switching tests and on `pagehide` |

## Remaining limitations

1. **The error boundary cannot catch everything.** Errors thrown inside event handlers and async
   callbacks bypass React's boundary; they land in the global handler as a toast, which is a weaker
   experience than the recovery panel.
2. **No crash telemetry, by design.** A crash leaves a console entry and nothing else. For a
   local-first tool with no backend that is the correct trade, but it does mean field failures are
   invisible unless a tester reports them.
3. **Corruption severe enough to prevent `db.open()` is diagnosed, not repaired.** The banner
   explains the likely cause and points at import; there is no in-app rebuild.
4. **Export holds the whole workbook in memory.** Fine at the measured size (60 KB for a fully
   recorded engagement) but there is no streaming path if the library grows by an order of magnitude.
5. **Cross-tab behaviour is still last-write-wins** (carried over from Part 1).
