# Full UI System Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old Hermills outreach UI shell and pages with a new professional AI outreach workbench while preserving existing business behavior.

**Architecture:** Keep `DevelopmentLetterPage` state and handlers, replace its returned JSX with a new `hm-*` workbench shell. Extend the shared outreach component library where needed and add a new CSS namespace so the new UI no longer depends on old `letter-*` layout classes.

**Tech Stack:** React 19, TypeScript, Vite, Electron, Vitest, CSS modules by global stylesheet, lucide-react icons.

---

### Task 1: Add Red Tests For Full Replacement

**Files:**
- Create: `tests/renderer/full-ui-replacement.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectFile = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url));

function sourceWindow(source: string, marker: string, length: number) {
  const index = source.indexOf(marker);
  expect(index, `Missing marker: ${marker}`).toBeGreaterThanOrEqual(0);
  return source.slice(index, index + length);
}

describe("full Hermills UI replacement contract", () => {
  it("uses the new hm workbench shell instead of the old letter shell", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");
    const pageSource = sourceWindow(appSource, "function DevelopmentLetterPage", 90000);

    expect(pageSource).toContain('className="hm-outreach-shell"');
    expect(pageSource).not.toContain('className="letter-app-shell"');
    expect(pageSource).not.toContain('className="letter-sidebar"');
    expect(pageSource).not.toContain('className="letter-main"');
  });

  it("defines new page workspaces for every daily outreach module", async () => {
    const appSource = await readFile(projectFile("apps/renderer/src/App.tsx"), "utf8");
    const pageSource = sourceWindow(appSource, "function DevelopmentLetterPage", 90000);

    for (const className of [
      "hm-today-workspace",
      "hm-customer-workspace",
      "hm-single-workspace",
      "hm-batch-workspace",
      "hm-mail-workspace",
      "hm-signature-workspace",
      "hm-company-workspace",
      "hm-assets-workspace",
      "hm-chat-workspace",
    ]) {
      expect(pageSource).toContain(className);
    }
  });

  it("ships the visual tokens and replacement shell CSS", async () => {
    const stylesSource = await readFile(projectFile("apps/renderer/src/styles.css"), "utf8");

    expect(stylesSource).toContain("--hm-bg-page: #f3f7fb");
    expect(stylesSource).toContain(".hm-outreach-shell");
    expect(stylesSource).toContain(".hm-sidebar");
    expect(stylesSource).toContain(".hm-primary-button");
    expect(stylesSource).toContain(".hm-ai-timeline");
    expect(stylesSource).toContain(".hm-quality-card");
    expect(stylesSource).toContain(".hm-evidence-card");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config vitest.config.ts tests/renderer/full-ui-replacement.test.ts`

Expected: FAIL because the current UI still renders `letter-app-shell` and lacks `hm-*` workspaces.

- [ ] **Step 3: Commit red test**

```bash
git add tests/renderer/full-ui-replacement.test.ts docs/superpowers/specs/2026-06-22-full-ui-system-replacement-design.md docs/superpowers/plans/2026-06-22-full-ui-system-replacement.md
git commit -m "test: define full UI replacement contract"
```

### Task 2: Replace Main Outreach Shell

**Files:**
- Modify: `apps/renderer/src/App.tsx`
- Modify: `apps/renderer/src/styles.css`

- [ ] **Step 1: Replace shell classes**

In `DevelopmentLetterPage`, replace the outer return shell with:

```tsx
<div className="hm-outreach-shell">
  <aside className="hm-sidebar" aria-label="Hermills 外联导航">...</aside>
  <main className="hm-main">...</main>
</div>
```

Do not leave `letter-app-shell`, `letter-sidebar`, or `letter-main` in the `DevelopmentLetterPage` returned JSX.

- [ ] **Step 2: Add token CSS**

Add `:root` variables for the `--hm-*` color system and base `hm` shell layout.

- [ ] **Step 3: Run the red test**

Run: `npx vitest run --config vitest.config.ts tests/renderer/full-ui-replacement.test.ts`

Expected: Still FAIL until all page workspace classes exist.

### Task 3: Replace Daily Pages

**Files:**
- Modify: `apps/renderer/src/App.tsx`
- Modify: `apps/renderer/src/styles.css`

- [ ] **Step 1: Replace dashboard page with `hm-today-workspace`**

Use stats, quick actions, and cloud/email status from existing computed values.

- [ ] **Step 2: Replace customers page with `hm-customer-workspace`**

Use existing `filteredLetterLeads`, `selectedLead`, `leadDraft`, and draft review state.

- [ ] **Step 3: Replace single write page with `hm-single-workspace`**

Use existing `quickEmail`, `quickWebsite`, `autoGenerateDraft`, `draftSubject`, `draftBody`, quality review, evidence, and timeline data.

- [ ] **Step 4: Replace batch write page with `hm-batch-workspace`**

Use existing bulk import text, selected campaign leads, campaigns, current campaign, and campaign generation handlers.

- [ ] **Step 5: Run test**

Run: `npx vitest run --config vitest.config.ts tests/renderer/full-ui-replacement.test.ts`

Expected: PASS for shell and page workspace markers.

### Task 4: Replace Supporting Pages

**Files:**
- Modify: `apps/renderer/src/App.tsx`
- Modify: `apps/renderer/src/styles.css`

- [ ] **Step 1: Replace sales assets with `hm-assets-workspace`**

- [ ] **Step 2: Replace mail setup with `hm-mail-workspace`**

The first screen shows sender email, authorization code/password, display name, test recipient, and save/test actions. Advanced SMTP/API settings must be in collapsed `<details>`.

- [ ] **Step 3: Replace signature with `hm-signature-workspace`**

Only text signature and logo upload are primary. HTML signature, logo width, alt text, and toggle controls must not be visible as primary fields.

- [ ] **Step 4: Replace company profile with `hm-company-workspace`**

- [ ] **Step 5: Replace chat control with `hm-chat-workspace`**

Show missing relay state without bad QR URLs.

### Task 5: Expand CSS And Regression Tests

**Files:**
- Modify: `apps/renderer/src/styles.css`
- Modify: existing `tests/renderer/*page.test.ts`

- [ ] **Step 1: Update tests from `letter-*` expectations to `hm-*` expectations**

- [ ] **Step 2: Add CSS for responsive desktop sizes**

Cover 1366x768, 1440x900, 1280x720, and 920px wide behavior.

- [ ] **Step 3: Run renderer tests**

Run: `npm run test`

Expected: all tests pass.

### Task 6: Verify Build And Package

**Files:**
- Modify: `docs/ai-control/05_TEST_RESULTS.md`

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck`

- [ ] **Step 2: Run test**

Run: `npm run test`

- [ ] **Step 3: Run build**

Run: `npm run build`

- [ ] **Step 4: Record results**

Append command output summaries to `docs/ai-control/05_TEST_RESULTS.md`.

- [ ] **Step 5: Build Windows installer**

Run: `npm run build:win`

- [ ] **Step 6: Install locally**

Run the generated installer silently and open `D:\hermills\Hermills.exe`.
