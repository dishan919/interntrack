# Feature 15/60: Login activity / security history

Implemented Feature 15 only. Authentication/JWT architecture is preserved. No push,
deployment, failed-login tracking, geolocation, fingerprinting, session revocation,
refresh tokens, MFA/OAuth, production email or distributed-system services were added.

## Files created

- `server/src/models/LoginActivity.js`
- `server/src/services/loginActivity.js`
- `server/src/controllers/loginActivityController.js`
- `server/tests/loginActivity.test.js`
- `src/components/profile/RecentLoginActivity.jsx`
- `src/utils/loginActivity.js`
- `tests/loginActivity.test.js`
- `tests/loginActivityIntegration.jsx`
- `FEATURE_15_REPORT.md`

## Files modified

- `server/src/controllers/authController.js`: successful login attempts best-effort history recording.
- `server/src/controllers/accountDeletionController.js`: owner-scoped activity cleanup before User deletion.
- `server/src/routes/authRoutes.js`: authenticated existing-account activity endpoint.
- `server/src/services/accountOperations.js`: documents shared activity/deletion coordination.
- `src/services/authService.js`: authenticated getLoginActivity with safe mapping and 401 handling.
- `src/pages/Profile.jsx`: Recent Login Activity under existing Security area.
- `src/styles/profile.css`: contained responsive list styling.
- `tests/profileIntegration.jsx`: separate activity fetch allowed; account details still consume context with no duplicate /me.
- `tests/profileEditIntegration.jsx`: empty-history fixture alongside existing profile mock.
- `tests/passwordChangeIntegration.jsx`: empty-history fixture alongside password regression coverage.
- `tests/emailVerificationIntegration.jsx`: empty-history fixture alongside verification regression coverage.
- `tests/accountDeletionIntegration.jsx`: empty-history fixture alongside deletion regression coverage.
- `tests/routerIntegration.jsx`: explicit empty history for the Profile route fixture.
- `tests/run-register-integration.mjs`: registers new activity suite.
- `tests/run-smoke.mjs`: real metadata/history/query/refresh/isolation/deletion checks.
- `README.md`: API, metadata/privacy, bounded query/retention, best effort, cleanup limits and manual steps.

## Schema and recording flow

LoginActivity has user (required ObjectId reference to User), loggedInAt (server Date),
ipAddress and userAgent. Index { user: 1, loggedInAt: -1, _id: -1 } supports recent history
per user with stable newest-first order. No timestamps/version/security fields are added
beyond the required activity metadata. Model JSON allowlists only id/date/IP/agent.

Login records only after bcrypt credential verification, JWT configuration and token
creation succeed. Failed passwords, unknown email, invalid credentials, registration,
/me restoration and missing JWT configuration create no successful-login record. The
existing login response remains the same safe { user, accessToken } contract.

IP comes from Express req.ip and is validated by node:net.isIP. The existing trust-proxy
setting remains false, so arbitrary forwarded IP headers and body fields are ignored.
User-Agent comes only from the HTTP header, control characters are replaced, and length
is bounded to 512 characters. No password, JWT, cookie, Authorization, token/hash or
unnecessary headers are collected. Metadata is untrusted and provides no exact location
or authoritative device identity.

Recording awaits one best-effort write attempt. Errors are caught separately and emit
only a fixed warning without diagnostics/metadata/secrets; login still succeeds. There
are no retries/background workers. Database latency may delay the attempt, and complete
audit delivery is not guaranteed. Authentication failures retain their existing behavior.

## Endpoint, ownership and bounds

GET /api/auth/login-activity uses authenticate plus existingAccount, selecting only
req.auth.userId. Query/body user IDs and requested limits cannot change ownership or the
server bound. Deleted-account JWTs receive 401. Query sorts by loggedInAt descending and
_id descending, limiting to RECENT_LOGIN_ACTIVITY_LIMIT=20. Safe responses contain only
{ activities: [{ id, loggedInAt, ipAddress, userAgent }] }, with no user reference or
security fields. Empty results return an empty array. Unexpected errors stay generic.

The limit bounds query/response size; it is not a storage retention policy. Records
persist until account deletion; no TTL, pagination or history purge feature is added.

## Account deletion and consistency

Feature 14 now removes applications, then login activity, then the User, always by the
JWT identity. Other users' activity/data remain untouched. History reads and recording
share the existing per-account queue with deletion/application operations. In-flight
recording finishes before cleanup; recording behind deletion rechecks User existence and
cannot recreate history for a deleted account. Concurrency tests cover both orderings.

Standalone MongoDB still has no rollback guarantee. History cleanup failure retains the
account and returns an error, although applications may already have been removed. If
final user deletion fails or the password hash changed, preceding application/history
cleanup may already have completed. Retry remains supported. The queue coordinates only
the current API process; multiple workers/direct writers require a database-level
strategy before scaling. README documents these limits without introducing transactions
or distributed machinery incompatible with the existing standalone setup.

## Frontend Security UI and privacy

Recent Login Activity is an isolated Profile component with loading, empty, friendly
error/retry, list and Refresh states. Dates/times use the browser's locale/timezone.
A small dependency-free helper recognizes common Chrome/Firefox/Safari/Edge/Opera and
platform hints, otherwise Unknown browser/device. Missing IP displays Unavailable. Raw
user-agent strings are not rendered as markup or presented as authoritative identity.

HTTP remains in authService; response mapping keeps only display fields. Refresh keeps
server order, does not refetch /me, prevents duplicate pending requests and does not poll.
StrictMode effect replay reuses the pending request. Activity failures leave Profile
controls functional; matching 401 responses use existing auth cleanup.

History stays only in request/component state, keyed to user/session, with unmount/late
response guards. It never enters localStorage, sessionStorage or AuthContext. Logout and
account deletion remove the UI immediately; responses for a former account cannot populate
a newer session. Existing AuthContext remains the user/session source of truth.

## Validation

- Frontend unit tests: 93 passed, including five new formatter/service/privacy/error tests.
- All 18 frontend integration suites passed, including history loading/order/empty/error,
  refresh/retry/duplicate prevention, StrictMode, common/fallback agent labels, no secrets/
  storage, protected Profile, usable profile editing during history failure, logout/deletion
  privacy, account replacement/late response isolation and existing Features 01-14 flows.
- Backend: 190 tests passed, including 12 new activity tests for ObjectId/index, successful
  login metadata, no failed-login records, best-effort errors/safe warnings, metadata
  bounds/fallbacks, JWT, A/B/query/GET-body isolation, ordering/ties/limit, safe JSON,
  empty/error responses, deletion/cleanup failure/retry and recording/deletion races.
- Real React -> authService -> Express -> disposable MongoDB smoke passed, including
  history recording/order/refresh, failed-login exclusion, two-user isolation, activity
  deletion cleanup/old JWT rejection and private UI removal, alongside prior CRUD/auth/
  profile/password/reset/verification/deletion workflows.
- ESLint passed. Production Vite build passed. git diff --check passed.

## Exact manual testing steps

README section "Feature 15: login activity / security history" contains steps 1-11:
local startup, successful/failed login comparison, safe endpoint contract/order/limit,
refresh/loading/duplicate guards, offline error/retry, empty history, two-browser account
isolation/query spoofing, no storage/logout/late response privacy, account deletion and
all verification commands. All examples use placeholders/disposable metadata, with no
real passwords, JWTs, reset/verification tokens or secrets.
