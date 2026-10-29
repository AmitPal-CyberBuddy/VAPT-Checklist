# Point-in-time reports

Dated audit and redesign reports. Each was true when written; together they are the
paper trail of how the product got its current shape. They are **historical record, not
living documentation** — numbers quoted in them (test counts, suite sizes) describe the
library as it was on that date and are deliberately not updated.

Living documentation lives one level up (`docs/*.md`) and in the project
[`README`](../../README.md); a test (`src/data/documentation.test.ts`) keeps every number
printed there recomputed from the bundled library so they cannot drift again.

| Report | What it covers |
| --- | --- |
| [`QA-FINDINGS.md`](QA-FINDINGS.md) | Final product QA over the complete user journey, the catalog dedup merge, and a UI/UX skill audit — defects found and fixed, with gates |
| [`UX-AUDIT.md`](UX-AUDIT.md) | UX, UI, security and product audit from four viewpoints (first-time user, practising tester, UI/UX expert, delivery manager) |
| [`VISUAL-REDESIGN.md`](VISUAL-REDESIGN.md) | The visual redesign pass: presentation-layer overhaul with no logic, workflow or data-model change |
| [`VISUAL-REDESIGN-REPORT.md`](VISUAL-REDESIGN-REPORT.md) | Full visual & UX redesign report — "Professional Security Assessment Workstation" direction |
| [`RESPONSIVE-VISUAL-QA.md`](RESPONSIVE-VISUAL-QA.md) | Responsive and visual QA across seven viewports (1440 → 375) |
