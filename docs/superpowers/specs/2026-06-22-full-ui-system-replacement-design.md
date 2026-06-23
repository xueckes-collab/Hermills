# Full UI System Replacement Design

## Goal

Replace the visible Hermills outreach desktop UI with a new professional AI outreach workbench. The rewrite keeps business logic, APIs, authentication, mail sending, local data, cloud sync, and Hermes integration intact, while removing the old `client-*` / `letter-*` visual shell from the main user experience.

## Product Direction

Hermills should feel like a Windows desktop sales workbench for export teams. The user should see a clear left navigation, a calm light-blue workspace, white task cards, one primary action per workflow, readable forms, structured AI progress, evidence, quality score, and recovery-oriented errors.

The UI must hide engineering concepts from daily pages. Users should not see Supabase, JWT, token, SMTP host, Scrapling, raw stack traces, or undefined relay URLs in normal workflows. Those details belong only in system settings or diagnostics.

## Replacement Scope

Replace the main outreach UI rendered by `DevelopmentLetterPage`:

- Today outreach
- Customers
- Single write
- Batch write
- Sales assets
- Mail setup
- Signature Logo
- Company profile
- Chat control
- System settings bridge

Keep the non-outreach advanced overlay, Hermes local assistant, backend APIs, login, onboarding data flow, and existing mail/generation functions.

## Technical Approach

The old page JSX inside `DevelopmentLetterPage` will be replaced with a new `hm-*` workbench shell. Existing state and handlers remain in place so backend behavior does not change. Reusable UI primitives will live in `apps/renderer/src/components/outreach-ui.tsx` and styles in the renderer stylesheet under a new `hm-` namespace.

The old `letter-app-shell`, `letter-sidebar`, `letter-main`, and daily-work page structures must no longer control the main UI. Legacy CSS can remain temporarily only if it supports non-main legacy screens, but the new workbench must not rely on it.

## Required UI Components

- App shell and sidebar
- Page header
- Primary, secondary, danger, ghost, and icon buttons
- Input, textarea, field wrapper
- Card and task card
- Status badge and alert
- Empty state
- Loading and AI progress timeline
- Quality score card
- Evidence card
- Customer row
- Email editor
- Upload dropzone
- Sticky action bar

## Page Acceptance

Each core page must expose a clear primary workflow:

- Today: stats, quick actions, pending work, email/cloud status
- Customers: search/filter, customer queue, detail/editor, draft review
- Single write: email + website, one generation button, timeline, draft, evidence, score
- Batch write: import/paste, queue, per-customer results, partial failure
- Mail: user-facing email + authorization code first, advanced settings folded
- Signature: text signature and logo upload only, with preview
- Company profile and sales assets: grouped by writing usefulness
- Chat control: platform binding states, no bad QR when relay is missing

## Test Strategy

Tests must first fail against old UI assumptions, then pass after the replacement:

- Main workbench uses `hm-outreach-shell`, not `letter-app-shell`
- Customer page has `hm-customer-workspace`, not old `letter-leads-workspace`
- Single write has timeline, score, evidence, and email editor
- Mail page hides advanced SMTP/API settings behind folded advanced settings
- Chat control explicitly handles missing relay and never emits `undefined/`
- CSS defines design tokens and new `hm-*` shell/components

## Safety Rules

Do not modify:

- Supabase schema or auth security
- API key or password storage
- SMTP/IMAP sending core
- Hermes runtime logic
- Scrapling/deep research backend logic
- Real user data files
- `.env` or production secrets

## Completion Evidence

Completion requires fresh output from:

- `npm run typecheck`
- `npm run test`
- `npm run build`

Windows installer and local installation are separate release steps after UI tests and build pass.
