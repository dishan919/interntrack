# InternTrack UI Design System Report

Validated on 22 October 2026. This report describes the existing redesign and its completed automated/static review. Direct browser visual inspection was unavailable; no screenshot or device-rendering verification is claimed.

## 1. Visual direction

The interface uses a dark navy navigation sidebar, off-white workspace, white cards, compact header, and restrained teal interaction color. It retains InternTrack's identity and internship/application content. The supplied attachment contained the written direction but no reference image, so the implementation follows that direction without copying financial branding, text, or components.

The dashboard greets the current user, gives real summary metrics, and separates recent applications, application statistics, upcoming interviews/deadlines, follow-up reminders, skill matches, and recent activity. It does not introduce sample statistics into the live UI. Pending follow-ups count incomplete reminders with valid dates, including future reminders; application status counts reflect current state.

Cards use subtle borders, 12px corners, modest shadows, and consistent headings/padding. Stronger color is concentrated in primary actions, active navigation, selected controls, and semantic data.

## 2. Layout architecture

The existing React Router, authentication provider, application provider, API services, and protected workspace remain. Layout owns the sidebar's open state and supplies a stable close action. The main workspace contains the compact Navbar, route outlet, and footer.

Sidebar navigation includes Overview, Applications, Kanban, Companies, Statistics, and Settings. Kanban uses the existing Applications route with `?view=board`; the existing List/Board preference remains supported. The Applications screen honors the explicit view query and retains company/search/filter/sort controls. Switching views updates the URL and existing view preference. Exactly one item receives active styling and `aria-current="page"` for both List and Kanban navigation; Applications is explicitly non-current when the Kanban deep link is selected.

The sidebar footer uses the existing current-user avatar/initial fallback, profile link, and a named logout button. Header account access, export, profile/settings links, notifications, and session handling remain intact.

Dashboard overview/activity presentation is split into small components. Application Details places the existing information, notes, documents, skills, interview, follow-up, and timeline cards in a responsive grid; none of those features is removed or hidden. Profile, Settings, Companies, Statistics, application forms, and authentication pages share the design language.

## 3. Central design tokens and palette

`src/styles/tokens.css` is the palette/composition source. Other styles reference variables rather than introduce their own hex colors. Compatibility aliases such as `--primary`, `--card`, `--text`, and `--muted` keep existing feature components consistent.

| Token | Value | Purpose |
| --- | --- | --- |
| `--surface-sidebar` | `#172c36` | Navy navigation surface |
| `--surface-sidebar-hover` | `#223c47` | Sidebar hover/support surface |
| `--surface-sidebar-active` | `#15786f` | Active navigation |
| `--surface-page` | `#f3f6f7` | Light workspace |
| `--surface-card` | `#ffffff` | Cards and inputs |
| `--surface-muted` | `#edf2f4` | Quiet secondary surfaces |
| `--text-primary` | `#1d333e` | Main text |
| `--text-secondary` | `#576b76` | Supporting text |
| `--text-on-dark` | `#f0f6f7` | Sidebar text |
| `--text-sidebar-muted` | `#b0c3cb` | Secondary sidebar text |
| `--text-on-accent` | `#ffffff` | Primary/active action text |
| `--color-primary` | `#08766b` | Teal action/link color |
| `--color-primary-hover` | `#06665d` | Hover state |
| `--color-primary-soft` | `#e4f3ef` | Soft selection/unread surface |
| `--color-success` | `#267148` | Positive outcomes |
| `--color-warning` | `#89580c` | Urgent deadlines/reminders |
| `--color-danger` | `#b23538` | Destructive actions/errors |
| `--color-info` | `#265faa` | Informational state |
| `--color-interview` | `#6e4caa` | Interview state |
| `--border-default` | `#dce5e9` | Subtle card separation |
| `--border-strong` | `#7b909c` | Input/control boundaries |

Success, warning, danger, information, and interview colors each have a softer companion background. Shadow, overlay, radius, spacing, sidebar width (244px), and header height (72px) are also centralized.

Styles are divided into tokens, base, shared UI, shell, forms, collections/details, application features, Kanban, semantic statuses, dashboard, authentication, profile, and notifications. `global.css` is an import manifest rather than a large implementation file.

## 4. Color Theory usage

- **Hue:** teal supplies the recognizable action/selection hue; navy provides a quiet structural anchor.
- **Saturation:** solid teal is reserved for primary interactions. Desaturated backgrounds support badges and selected/read states without flooding the workspace with color.
- **Value:** dark text on light cards contrasts with light text on the dark sidebar. Card surfaces and the page differ subtly so borders and spacing carry much of the hierarchy.
- **Contrast:** tested normal text/action/badge pairs meet at least 4.5:1. Strong input boundaries meet 3:1 against white. Teal was darkened during implementation to keep text on the soft teal surface readable.
- **Analogous colors:** teal, blue-green navigation, and cool blue informational states support a coherent cool palette. These are accents rather than competing brand colors.
- **Warm colors:** amber is reserved for urgency/warnings; red is reserved for rejection, errors, expiration, and destructive actions.
- **Cool colors:** teal handles normal actions, blue identifies Applied/information, purple distinguishes interviews, and green communicates offers/success.

Meaning is never conveyed solely by color: status names, read/unread text, counts, dates, warning/error messages, and action labels remain visible.

## 5. Semantic application status colors

`status.css` centralizes status badge and chart colors:

| Existing status | Semantic treatment |
| --- | --- |
| Saved | Neutral gray-blue text and muted background |
| Applied | Cool informational blue |
| Interview | Purple |
| Offer | Success green |
| Rejected | Danger red |

No new status such as Withdrawn was added. The dashboard legend and Statistics chart show text/counts alongside color. Kanban headings retain the textual StatusBadge. Deadlines and follow-ups retain their descriptive labels.

## 6. Reusable UI components

- `PageHeader`: consistent title, eyebrow, description, and optional action slot across existing pages.
- `Icon`: small local SVG path collection, decorative/hidden from assistive technology; no added icon dependency.
- `StatCard`: shared real-data metric card with label, value, semantic icon tone, and optional description.
- Existing `StatusBadge`, `UserAvatar`, `SearchBar`, `EmptyState`, form controls and feature cards remain reused.
- `ApplicationOverview`: real status distribution with a labeled total and visible status/count legend; empty data has a neutral chart state.
- `RecentActivity`: the newest five existing application timeline entries, with safe internal application links and timestamps.

No general-purpose component-library framework was introduced.

## 7. Responsive static review

Reviewed shell, dashboard, forms, collection/detail, notification, and Kanban CSS:

- **Desktop:** fixed 244px sidebar and corresponding workspace margin; flexible, bounded main content; compact sticky header. Long identity text truncates within its container.
- **Tablet (up to 1150px):** reduced workspace padding, wrapping filter toolbar, narrower metric cards, two-column Companies collection, and single-column detail cards.
- **Navigation (up to 960px):** sidebar transforms off-canvas and is hidden while closed; workspace margin is removed. The menu button/close control and overlay become available. Open navigation locks background scrolling and supports focus containment, Escape, and focus restoration.
- **Dashboard (up to 760px):** the main and attention grids become single-column; recent activity becomes single-column; metrics use fewer columns. At 640px, metrics use two columns and headers/rows adapt.
- **Forms (up to 640px):** fields/toolbars become single-column; controls use readable 16px text; buttons/actions can wrap. Details and company cards collapse to one column.
- **Notifications:** width is constrained to the viewport minus 32px, height is bounded with internal vertical scrolling, and narrow screens use a fixed panel position.
- **Overflow:** flexible shells/cards use `min-width: 0`, grid tracks use `minmax(0, ...)`, long content has wrapping/truncation rules, and mobile sidebar margin removal avoids retaining desktop width. No accidental global horizontal overflow was identified statically for the supported minimum 320px viewport. This is not a pixel-rendered overflow claim.
- **Kanban:** horizontal scrolling is deliberately confined to the focusable board with `overflow-x: auto`, `max-width: 100%`, and inline overscroll containment. Columns remain 272px on desktop and 260px on narrow screens; existing responsive/keyboard-focus assertions pass.

These conclusions are based on source review and automated DOM/CSS checks, not direct browser/device visual inspection.

## 8. Accessibility review

- Links remain links and actions remain buttons. Existing labels, validation messages, input relationships, password visibility controls, disabled/loading states, and external-link protections are retained.
- Global focus-visible outlines cover links/buttons/controls. Search uses a visible focus-within outline; sidebar focus outlines are light against navy. Reduced-motion preference disables transitions.
- A skip link targets focusable main content. The navigation toggle exposes expanded state and controls relationship.
- The sidebar focus loop, Escape dismissal, background scroll restoration, and toggle-focus restoration are exercised in the DOM integration suite.
- Decorative SVG icons are hidden from accessibility APIs. Icon-only close/logout/navigation controls have meaningful accessible names.
- Applications and Kanban each expose exactly one active navigation item and exactly one `aria-current="page"`; both view states have explicit regression assertions.
- Status/read meaning is textual, not color-only. Profile photos retain the existing alternative text and safe initials fallback.
- Automated contrast checks cover 13 foreground/background pairs at >=4.5:1 and the input boundary at >=3:1. Sample computed ratios: primary text/card 13.16:1; secondary text/page 5.13:1; sidebar secondary text/navy 7.94:1; white/primary teal 5.51:1; teal/soft teal 4.82:1; strong input border/white 3.33:1.

The original app had no working theme toggle or persisted theme-selection system. The light workspace remains explicit; existing browser preferences are not overwritten, and an integration assertion verifies an unrelated stored theme key is untouched. No removed dark-theme feature is claimed.

## 9. Feature 17 preservation

The existing UserAvatar and photo upload/removal service/AuthContext logic are unchanged. Integration tests verify selection, validation, pending/error states, duplicate protection, upload, replacement/removal, immediate Profile/Navbar/Sidebar image updates, restoration, image-load fallback, and session/account isolation. Real API smoke tests verify actual multipart upload, replacement, refresh persistence, and old managed-file cleanup. The full backend profile-photo/storage safety tests also pass.

The redesign changes only the photo's surrounding presentation and sizing. Image data is not introduced into browser storage. No backend storage strategy, validation or ownership logic is changed.

## 10. Feature 18 preservation

Notification business logic, Observer architecture, APIs, ownership checks, follow-up deduplication, and failure isolation are unchanged.

The full notification integration scenario confirms the bell, unread count, panel, loading/error/empty states, mark-one, mark-all, duplicate/pending protection, application navigation, read/unread distinction, keyboard dismissal, no notification browser persistence, and logout/late-response account privacy. Real API smoke scenarios verify event-created notifications, automatic/manual refresh, persisted read state, application links, logout cleanup, and the Interview -> Applied regression with exactly one notification. All backend Observer/notification/security tests pass.

## 11. Files changed

New shared/dashboard components:

- `src/components/common/Icon.jsx`
- `src/components/common/PageHeader.jsx`
- `src/components/dashboard/ApplicationOverview.jsx`
- `src/components/dashboard/RecentActivity.jsx`

Modified components:

- `src/components/common/SearchBar.jsx`, `StatCard.jsx`
- `src/components/layout/Layout.jsx`, `Navbar.jsx`, `Sidebar.jsx`

Modified pages:

- `src/pages/AddApplication.jsx`, `ApplicationDetails.jsx`, `Applications.jsx`, `Companies.jsx`, `Dashboard.jsx`, `EditApplication.jsx`, `Profile.jsx`, `Settings.jsx`, `Statistics.jsx`

New style modules:

- `src/styles/tokens.css`, `base.css`, `ui.css`, `shell.css`, `forms.css`, `collections.css`, `features.css`, `kanban.css`, `status.css`

Modified style modules:

- `src/styles/global.css`, `dashboard.css`, `notifications.css`, `profile.css`, `register.css`

Tests/documentation:

- New `tests/designTokens.test.js` and `tests/designSystemIntegration.jsx`.
- Updated `tests/run-register-integration.mjs`, `tests/run-smoke.mjs`.
- Adjusted intentional navigation/heading/style-location assertions in `tests/accountDeletionIntegration.jsx`, `deadlineIntegration.jsx`, `emailVerificationIntegration.jsx`, `kanbanIntegration.jsx`, `loginActivityIntegration.jsx`, `loginIntegration.jsx`, `passwordChangeIntegration.jsx`, `profileIntegration.jsx`, `routerIntegration.jsx`.
- New `UI_DESIGN_SYSTEM_REPORT.md`.

Test adjustments scope account-menu links separately from the new sidebar profile link, while verification-page return links are scoped to main content. Deadline exclusion assertions are bounded to the deadline card now that a separate recent-activity card can legitimately mention the same company. Existing behavior assertions remain. Kanban CSS checks read its new dedicated module.

No backend files, API contracts, dependencies, package locks, or deployment configuration were changed. The continuation required no additional production fix; it reran validation, strengthened active-navigation assertions, and completed this report.

## 12. Exact final validation results

| Command | Result |
| --- | --- |
| `npm run test:integration` | 22 scenario groups passed, 0 failures; includes strengthened Applications/Kanban active-page checks. |
| `npm run test:smoke` | 12 real React/API/disposable-MongoDB scenario groups passed, exit 0. |
| `npm test` | 103 tests passed, 0 failed. |
| `npm --prefix server test` | 232 tests passed, 0 failed. |
| `npm run lint` | Passed, 0 errors, 0 warnings. |
| `npm run build` | Passed; 105 modules transformed. |
| `git diff --check` | Passed, exit 0. |

Smoke output includes non-failing React act timing warnings from asynchronous updates in the test harness. These are not suppressed and are not treated as direct visual verification. Tests use disposable databases rather than personal application records.

## 13. Scope and verification limits

Automated functional, integration, real API smoke, contrast, build, lint, and static responsive/accessibility validation were completed as recorded above. Direct browser visual inspection was unavailable, so pixel layout, screenshot matching, and real-device rendering have not been claimed.

The redesign is preserved in the working tree. No Feature 19 or other feature, backend business change, Docker, Jenkins, AWS, or deployment configuration was introduced. Nothing was pushed or deployed.
