# Feature 09/60 — authenticated user profile

## Implementation

The protected `/profile` route is nested under the existing `AuthenticatedWorkspace` guard and maps to `/interntrack/profile` through the existing BrowserRouter basename. Logged-out visitors redirect to `/interntrack/login`; session restoration remains owned by AuthProvider.

Profile reads `user.name`, `user.email`, and `logout` through `useAuth()` from AuthContext. It makes no API request and stores no additional state. Only name and email are rendered; passwords, hashes, access tokens, and other user fields are excluded. Refresh verification uses the existing `/api/auth/me` flow.

The page uses the existing panel, heading, button, and setting-row styles, with responsive field spacing and wrapping for long account values. Semantic headings and definition-list labels identify account information. Native links/buttons retain keyboard access and focus styles. It explicitly states that profile editing is not available yet.

The account menu now includes a basename-aware Profile link. Opening it focuses Profile, its first link. The menu heading displays the authenticated user's name, and the avatar uses their initial in place of the hard-coded `S`. The generic Student Workspace accessible trigger label is retained. No fabricated name/email values were present or added.

Profile and the account menu both call the existing AuthContext logout action. No second logout mechanism was introduced. Logout clears the stored/in-memory token, user, and mounted private application state, then the route guard returns to login. Regression checks verify private profile access remains blocked afterward.

No backend source, authentication architecture, deployment configuration, or later-feature functionality was changed. No push or deployment was performed, and Feature 10 was not started.

## Files created

- `src/pages/Profile.jsx`
- `src/styles/profile.css`
- `tests/profileIntegration.jsx`
- `FEATURE_09_REPORT.md`

## Files modified

- `src/App.jsx` — protected Profile route.
- `src/components/layout/Navbar.jsx` — Profile link, real account name/initial, existing menu logout retained.
- `tests/authIntegration.jsx` — `/profile` included in unauthenticated route checks.
- `tests/routerIntegration.jsx` — `/interntrack/profile` route regression.
- `tests/run-register-integration.mjs` — runs the new Profile suite.
- `tests/run-smoke.mjs` — real API Profile navigation, account values, refresh, secret exclusion, and shared logout.
- `README.md` — protected Profile route, AuthContext behavior, and editing limitation.

## Tests and validation

| Check | Final result |
| --- | --- |
| `npm test` | 72 passed, 0 failed/cancelled/skipped |
| `npm run test:integration` | All 12 suites passed |
| `npm --prefix server test` | 107 passed, 0 failed/cancelled/skipped |
| `npm run test:smoke` | All 3 scenario groups passed |
| `npm run lint` | Passed, no diagnostics |
| `npm run build` | Passed, 83 modules transformed |
| `git diff --check` | Passed |

The 12 integration suites cover deadlines, interviews, Kanban, Kanban drag, skills, search, API behavior, registration, login, routing, authentication, and Profile. Custom integration suites use assertions and report suite passes rather than individual test counts.

The new focused Profile suite verifies context-supplied name/email, password/token exclusion even when present in context, no editable inputs, reuse of context logout, logged-out protection, account-menu visibility/focus, basename navigation, no additional `/me` on navigation, one provider verification on refresh, private data removal, and logout via both Profile and account menu.

The three smoke groups exercise real React DOM against Express and disposable MongoDB: Profile navigation/refresh/logout; session restoration/login/logout/invalid-token cleanup; and existing application CRUD/status changes with refresh persistence. Tests never use the personal development database. UI automation uses jsdom; physical browser layout and pointer testing are not claimed.

## Exact manual testing steps

Prerequisites: from the `interntrack` repository folder, install dependencies if needed with `npm install` and `npm --prefix server install`. Configure frontend `.env` from its example with `VITE_API_URL=http://localhost:5000/api`; configure `server/.env` with a local MongoDB URI and development JWT secret. Start MongoDB. In terminal 1 run `npm --prefix server run dev`; in terminal 2 run `npm run dev`. Use Vite's printed port if it differs from 5173.

1. **Logged-out access:** in a fresh browser tab, remove only `interntrack_access_token` from this tab's sessionStorage if present. Open `http://localhost:5173/interntrack/profile`. Expect `/interntrack/login`, no Profile account values, and no protected application request.
2. **Login:** if needed, register fictional credentials at `/interntrack/register` and return to Sign in. Submit the registered email/password at `/interntrack/login`. Expect the dashboard at `/interntrack/`.
3. **Open Profile:** activate the Student Workspace avatar menu with mouse or keyboard. Confirm Profile is available and keyboard focused when the menu opens. Activate Profile. Expect `/interntrack/profile` and the Profile heading. In Network tools, navigating here after login/restoration must not add a new `/api/auth/me` request.
4. **Check information:** confirm Full name and Email address match the account you registered. Confirm no password or JWT is displayed and there are no edit controls. Confirm the editing-unavailable note. Resize to mobile width and verify the card, long values, and Sign out button remain readable and usable.
5. **Refresh:** reload `/interntrack/profile`. Expect session checking, successful `/api/auth/me` verification through AuthProvider, and the same account information. Profile itself must not issue another verification request.
6. **Sign out:** open the account menu and choose Sign out while viewing Profile. Expect `/interntrack/login`, removal of `interntrack_access_token`, and no private account/application information. Log in again, reopen Profile, and click its own Sign out button to confirm the same behavior through the shared action.
7. **Retry after logout:** directly open `http://localhost:5173/interntrack/profile` again. Expect redirect to `/interntrack/login` with no previous user's name/email shown. Browser Back must not restore authenticated access.

These steps are supplied for manual browser testing; automated checks above were executed.
