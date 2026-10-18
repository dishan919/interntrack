# Feature 08/60 — authentication state and sessions

Completed and validated on 2026-10-18. Existing modified/untracked Feature 08 work was preserved. No push, deployment, or Feature 09 work was performed.

## Files created

- `src/components/layout/AuthenticatedWorkspace.jsx`
- `src/context/AuthContext.js`
- `src/context/AuthProvider.jsx`
- `src/services/authSession.js`
- `tests/authFixture.jsx`
- `tests/authIntegration.jsx`
- `tests/authSession.test.js`
- `FEATURE_08_REPORT.md`

## Files modified

- `README.md`
- `src/App.jsx`
- `src/components/layout/Navbar.jsx`
- `src/context/ApplicationProvider.jsx`
- `src/pages/Login.jsx`
- `src/services/applicationService.js`
- `src/services/authService.js`
- `tests/apiIntegration.jsx`
- `tests/contextHarness.jsx`
- `tests/loginIntegration.jsx`
- `tests/routerIntegration.jsx`
- `tests/run-register-integration.mjs`
- `tests/run-smoke.mjs`

No backend source changes were needed.

## Behavior

AuthProvider wraps the routes. AuthContext/useAuth exposes `user`, `accessToken`, `isAuthenticated`, `isAuthLoading`, `login`, and `logout`; useAuth outside the provider throws a clear error. Authentication requires both a safe user and token. Request generations prevent late restoration/login results from reviving a cancelled session.

Only the JWT is stored in sessionStorage under `interntrack_access_token`. Passwords and user objects are not persisted for authentication, and JWTs are not stored in localStorage, displayed, or logged. Blocked storage produces a friendly login error.

Login calls the existing login service, persists the token, updates context, clears the password, and navigates to `/` with replacement. With the configured basename, the dashboard URL is `/interntrack/`. An authenticated visit to `/login` also redirects to the dashboard. Registration remains public without automatic login.

On initialization, no saved token means unauthenticated state without protected API calls. A saved token is verified by `GET /api/auth/me` with `Authorization: Bearer <token>`. Only verified safe user fields restore the session. Session loading displays `Checking your session...`; private application content does not mount during verification.

Dashboard, application list/add/detail/edit, companies, statistics, and settings require authentication. Unauthenticated access redirects to `/login`. Application state is mounted only for a verified session and keyed by user/token. Logout/account changes remove old data; queued provider operations stop after unmount and late results cannot populate another session.

The centralized application service supplies Bearer headers for list/read/create/update/delete and legacy import. Operations retain their original token. Application HTTP 401 invalidates the matching current session; a stale 401 for an older token cannot sign out a newer session. Other errors retain safe retry feedback.

Sign out in the Student Workspace menu clears stored/in-memory token and user state and removes the private workspace. It does not revoke a JWT on the server or undo requests already accepted by the server.

Invalid/expired tokens fail backend verification. Restoration failures, including network/server failures, clear the stored session and return to login. Application 401 responses do the same. Expiration is enforced when the backend receives a request; there is no local expiration timer, refresh-token flow, or automatic credential retry.

## Validation results

All final commands exited successfully, with no skipped tests in the unit/backend runs.

| Command | Result |
| --- | --- |
| `npm test` | 72 tests passed; 0 failed/cancelled/skipped |
| `npm run test:integration` | All 11 integration suites passed |
| `npm --prefix server test` | 107 tests passed; 0 failed/cancelled/skipped |
| `npm run test:smoke` | Both scenario groups passed against real Express and disposable MongoDB |
| `npm run lint` | Passed; no ESLint diagnostics |
| `npm run build` | Passed; 81 modules transformed |
| `git diff --check` | Passed |

Integration suites: deadline, interview, Kanban, Kanban drag, skills, search, API, registration, login, router, and authentication. These custom assertion suites report suite passes rather than individual test counts.

Real API smoke groups cover (1) verified restoration, UI logout/login to dashboard, and invalid-token cleanup; (2) React DOM create/refresh/edit/refresh/Kanban status/refresh/delete/refresh through Express and MongoDB. Production Bearer headers are asserted rather than injected. Backend coverage includes expired, forged, unsigned, wrong-algorithm, invalid-claim, and deleted-user tokens, ownership isolation, and persistence across Express restarts. All database tests use disposable MongoDB, not the personal development database.

The first extended smoke run used the old assertion expecting the original pre-logout JWT and timed out after a new login. The assertion now checks the current stored session token, and the complete smoke command passed on rerun. Automated UI validation uses jsdom, not a real browser pointer session.

## Exact manual testing steps

1. From the repository folder, install dependencies if needed: `npm install` and `npm --prefix server install`.
2. Configure frontend `.env` from `.env.example` with `VITE_API_URL=http://localhost:5000/api`. Configure `server/.env` from its example with a local `MONGODB_URI` and a non-placeholder development `JWT_SECRET`. Start your local MongoDB.
3. In terminal 1 run `npm --prefix server run dev`. In terminal 2 run `npm run dev`.
4. Open `http://localhost:5173/interntrack/` in a fresh tab (use Vite's printed port if different). Remove only `interntrack_access_token` from this tab's sessionStorage if present, then reload. Expect `/interntrack/login`, with no application API request in Network tools.
5. Follow Create an account, register a fresh fictional account such as `feature08.demo@example.com` with password `ExamplePassword123`, and confirm registration success does not log in or create a token. Follow Sign in.
6. Submit empty/invalid fields and an incorrect password of at least eight characters. Confirm validation/safe credential feedback, Show/Hide behavior, and no session creation. Submit correct credentials. Expect `/interntrack/` and the dashboard.
7. Inspect browser storage without copying/sharing the JWT. Authentication should save only `interntrack_access_token` in sessionStorage; no password/user object or JWT should be in localStorage. Inspect Network: application requests must carry `Authorization: Bearer <token>`.
8. Open Applications, add a fictional company/position, reload, edit, reload, move its board status, reload, delete, and reload. Confirm each server-confirmed change persists.
9. Refresh the dashboard with Network tools open. Confirm `/api/auth/me` succeeds before application loading, and the safe session restores. Visit `/interntrack/login` while authenticated; expect the dashboard.
10. Open the Student Workspace avatar menu and choose Sign out. Expect `/interntrack/login`, no saved session token, and no private data. Directly visit `/interntrack/applications`, `/interntrack/applications/new`, `/interntrack/applications/example`, `/interntrack/applications/example/edit`, `/interntrack/companies`, `/interntrack/statistics`, and `/interntrack/settings`; each must return to login.
11. Set this tab's sessionStorage `interntrack_access_token` to `invalid-test-token` using browser Application tools. Reload a private URL. Expect `/api/auth/me` HTTP 401, token removal, and login without private content.
12. For real expiration, log in again, leave the session idle for over one hour (the backend JWT lifetime), then reload a private URL. Expect HTTP 401 restoration failure, token removal, and login. To exercise expiration during an open workspace instead, leave it idle past expiry and then trigger application loading or a mutation; the application 401 must clear the session and redirect. Backend automated tests already verify expiration without this wait.
13. Log in, stop the backend, and refresh. Expect session restoration to fail closed, clear the token, and show login. Restart the backend and sign in again.
14. Sign out, register/sign in as a second fictional account, and verify the first account's application data is absent. Sign out and sign back in as the first account to verify its own records remain isolated.

Manual steps above are a reproducible browser checklist; they are not claimed as executed browser testing.
