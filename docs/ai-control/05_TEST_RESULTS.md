# Hermills UI Test Results

## 2026-06-22 UI Foundation Pass

### Command: `npm run test -- tests/renderer/ui-harness-docs.test.ts tests/renderer/outreach-form.test.ts`

- Result: Passed after implementation.
- Coverage: split UI spec contract and single-write form validation.
- Final output: 2 test files passed, 9 tests passed.

### Command: `npm run test -- tests/renderer/outreach-ui-components.test.ts`

- Result: Passed after adding missing reusable components and CSS.
- Coverage: shell, sidebar, page header, buttons, fields, status banners, cards, rows, timeline, badge, textarea, skeleton, error state, upload dropzone, evidence card, email editor, sticky action bar.
- Final output: 1 test file passed, 4 tests passed.

### Command: `npm run test -- tests/renderer/outreach-ui-components.test.ts tests/renderer/ui-harness-docs.test.ts tests/renderer/outreach-form.test.ts tests/renderer/usability-contract.test.ts`

- Result: Passed.
- Coverage: UI component contract, UI harness docs, form validation, renderer usability contract.
- Final output: 4 test files passed, 35 tests passed.

### Command: `npm run typecheck`

- Result: Passed.
- Coverage: TypeScript project check via `tsconfig.check.json`.
- Final output: exit code 0.

### Command: `npm run test`

- Result: Passed.
- Coverage: full Vitest suite.
- Final output: 19 test files passed, 164 tests passed, 1 skipped.

### Command: `npm run build`

- Result: Passed.
- Coverage: typecheck, core, agent-builder, runtime, permission helper, server, renderer production build.
- Final output: exit code 0.
- Warning: Vite reported the existing renderer chunk is larger than 500 kB after minification. This is not a build failure, but future UI/page splitting should consider dynamic imports or manual chunks.

## Remaining Verification

- Browser or desktop screenshot QA has not been run in this pass.
- Windows installer build was not run in this pass.
- GitHub push or release was not performed in this pass.
