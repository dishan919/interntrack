# Feature 14/60: Secure account deletion

Implemented Feature 14 only. No push, deployment, soft-delete, recovery, admin endpoint,
refresh-token changes, or external email service.

## Created files

- `server/src/controllers/accountDeletionController.js`
- `server/src/middleware/existingAccount.js`
- `server/src/services/accountOperations.js`
- `server/tests/accountDeletion.test.js`
- `src/components/profile/DeleteAccount.jsx`
- `tests/accountDeletion.test.js`
- `tests/accountDeletionIntegration.jsx`
- `FEATURE_14_REPORT.md`

## Modified files

- `server/src/routes/authRoutes.js`: authenticated DELETE /api/auth/me.
- `server/src/routes/applicationRoutes.js`: existing-user checks within per-account queue.
- `src/services/authService.js`: deleteAccount(accessToken, currentPassword) and safe errors.
- `src/context/AuthProvider.jsx`: deletion action reuses logout with stale-session guard.
- `src/pages/Profile.jsx`: Danger Zone and disabled conflicting controls during deletion.
- `src/styles/profile.css`: isolated destructive-action styling and profile control group.
- `tests/run-register-integration.mjs`: account-deletion suite registration.
- `tests/run-smoke.mjs`: real API/UI deletion, old-JWT rejection and two-user isolation.
- `README.md`: endpoint, permanence, consistency limits, session cleanup and manual steps.

## Backend behavior and security

DELETE /api/auth/me uses existing authenticate middleware and accepts exactly
{ currentPassword }. Extra fields, including userId/id/email/reset/verification data,
are rejected; query identifiers do not select the account. Only req.auth.userId selects
both the User and Application.owner cleanup filter.

The current user is loaded with +password. The supplied password is not trimmed and
must match via bcrypt.compare; blank/nonstring/missing passwords and bcrypt truncation
matches are rejected. Wrong passwords make no data changes. Missing/deleted users or
invalid/expired JWTs receive safe 401 responses. Errors do not expose diagnostics.

After successful reauthentication, owned applications are removed first, followed by
User deletion with the same verified password hash in its predicate. A changed hash
prevents deletion using stale credentials. Success returns only the fixed account-deleted
message. User deletion naturally removes password/reset/verification fields. Other users,
their records and ownerless legacy applications are unaffected.

Old JWTs may remain cryptographically valid, but /me and all application CRUD routes
reject missing accounts with 401. Deleted users cannot log in, update their profile,
change their password or resend verification. Ownership is never inferred from token
reset/verification state or client identifiers.

## Consistency strategy and limits

Existing runtime/tests use standalone MongoDB, so no replica-set/transaction dependency
was introduced. A per-account in-process queue serializes account deletion and application
reads/writes in the current single Node process. Application requests check user existence
inside the queue; an in-flight creation finishes before cleanup, and creation waiting
behind deletion receives 401. Unrelated accounts use independent queues. Finally blocks
release queues after success/failure and idle entries are removed.

Application cleanup precedes user deletion, so cleanup failures do not intentionally
remove the user or report success. There is no rollback: cleanup may partially complete
before an error, and final user-delete failure or password-hash mismatch can leave the
retained user with fewer/no applications. A crash between steps has the same limitation.
Retry is supported. Tests cover both failure steps, retry, concurrent deletion, and both
creation/deletion orderings. The queue is process-local; multi-worker/direct database
writers require a database-level transaction strategy coordinated with creation before
scaling. This limitation is explicit in README, without adding distributed-system machinery.

## Frontend behavior

Danger Zone is separate from existing account/security panels. The first Delete Account
click only opens confirmation. Permanent account/application removal is stated clearly.
The form requires Current Password, offers accessible Show/Hide with type=button and
changing aria-label, and provides explicit Delete Account and Cancel actions. Cancel
clears/hides the password and makes no request. During deletion a ref blocks duplicate
submission; deletion controls and conflicting Profile controls are disabled with pending
feedback. Passwords remain only in form memory and the request, never storage.

HTTP lives in authService. Safe required/wrong-password, 401, conflict, network, server
and malformed-response handling is covered by unit tests. After confirmed success,
AuthProvider reuses logout: clears the JWT from sessionStorage and memory, clears user/auth
state, unmounts private application state and lets the existing protected-route guard
navigate to Login under the basename. No browser refresh is needed. Stale responses cannot
log out a newer session or repopulate private data. Wrong-password/network/server failures
retain current frontend user/application state; matching 401s follow existing cleanup.

## Validation

- Frontend unit tests: 88 passed, including three new service contract/error/session tests.
- All 17 frontend integration suites passed, including deletion confirmation/cancel,
  visibility/required validation, disabled controls/duplicate guard, safe errors with
  preserved state, auth/private-data clearing, public redirect, replacement account
  isolation, provider logout state and stale-response protection. Existing profile edit,
  password change, email verification, reset/login/register and application suites passed.
- Backend: 178 tests passed, including 13 new account-deletion tests with two accounts
  and A1/A2/B1. They cover JWT/reauthentication, no mutation on wrong password, bcrypt
  truncation, strict ownership/body allowlist, safe minimal responses, old JWT rejection,
  cleanup/final-delete failures and retries, creation/deletion concurrency, password
  changes during deletion, and independent operation of another account.
- Real API smoke passed: existing application CRUD/session/profile/password/reset/email
  verification flows plus deletion confirmation/reauthentication, A/A1/A2 removal,
  retained B/B1 login, session/private-data cleanup and old JWT creation rejection.
- ESLint passed. Production Vite build passed. git diff --check passed.

## Exact manual testing steps

README section "Feature 14: secure account deletion" contains steps 1-11: local startup,
two disposable accounts with A1/A2/B1, confirmation/no immediate request, required/visibility/
cancel checks, safe wrong-password/network failure, optional in-memory old JWT check,
final deletion/payload/loading/session cleanup, failed former login, surviving B/B1 and
all verification commands. No real password, token, hash or secret is documented.
