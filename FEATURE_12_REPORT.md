# Feature 12/60: Forgot password and secure password reset

Implemented only Feature 12. No push or deployment.

## Created files

- `server/src/controllers/passwordResetController.js`
- `server/src/services/passwordPolicy.js`
- `server/src/services/passwordResetDelivery.js`
- `server/tests/passwordReset.test.js`
- `src/pages/PasswordReset.jsx`
- `src/utils/passwordReset.js`
- `tests/passwordReset.test.js`
- `tests/passwordResetIntegration.jsx`
- `FEATURE_12_REPORT.md`

## Modified files

- `server/src/controllers/authController.js`: shared registration/change/reset password validation.
- `server/src/models/User.js`: hidden reset hash/expiry fields, JSON sanitization, expiry check after bcrypt.
- `server/src/routes/authRoutes.js`: public POST forgot-password/reset-password endpoints.
- `src/services/authService.js`: requestPasswordReset(email), resetPassword(token, newPassword), safe response/error contracts.
- `src/pages/Login.jsx`: Forgot password link.
- `src/App.jsx`: public basename-aware forgot/reset routes.
- `tests/run-register-integration.mjs`: reset integration suite.
- `tests/run-smoke.mjs`: real React/service/Express/MongoDB reset flow.
- `README.md`: endpoint contracts, security architecture, delivery limits and exact manual testing steps.

## Behavior and security

Forgot-password normalizes email and returns the same HTTP 200 message for known/unknown
valid addresses, without creating unknown users. Invalid email syntax receives a safe 400.
Tokens use Node crypto randomBytes(32), SHA-256 hashing, and a centralized 15-minute expiry.
Only token hash and expiry are stored. New requests replace prior tokens.

Reset accepts only token/newPassword; user IDs and confirmation fields are rejected.
Invalid/expired/replaced/consumed tokens share a generic error. The model save hook hashes
passwords once with bcrypt cost 12. An atomic token-and-expiry predicate prevents concurrent
reuse or overwriting a newer reset request; expiry is checked again after hashing.
Successful writes clear hash and expiry. No automatic login occurs.

User model queries hide reset fields and JSON removes them even when explicitly selected.
Auth responses allowlist safe fields. The UI stores no reset token in browser storage or
AuthContext, clears password fields and removes the query token on success. Password forms
validate policy/confirmation, offer independent accessible Show/Hide controls and block
duplicate submissions. Routes preserve the Vite basename.

Delivery is a separate service, intentionally a no-op in production/development until an
email provider is added. Tests capture delivery details in memory with setTestResetCapture,
which can only be configured under NODE_ENV=test; invocation rechecks the environment.
No token delivery endpoint, normal token logging, SMTP, or email provider was added.
A local debugger can inspect delivery arguments for manual development testing; see README.

## Validation

- Frontend unit tests: 80 passed.
- Frontend integration: all 15 suites passed, including existing login/register/profile,
  password changes, application workflows and the new reset suite.
- Backend: 154 tests passed, including six new reset tests covering known/unknown behavior,
  normalization, hash-only persistence/expiry, invalid/expired/replaced/reused tokens,
  password hashing/login changes, invalid policy/userId, concurrent consumption, safe
  serialization/API responses and production capture isolation.
- Real API smoke: passed, including existing CRUD/profile/password/session workflows and
  full forgot/reset UI, in-memory test delivery, removed query token and explicit login.
- ESLint: passed. Production build: passed. git diff --check: passed.

The initial backend run caught an encoding issue in the multibyte test fixture; replacing
it with a Unicode escape fixed the fixture. The corrected reset suite and full backend
suite passed. No application policy was weakened.

Exact manual testing steps are in README under Feature 12, including local debugger delivery,
known/unknown email comparisons, form validation, reset/login, reuse/replacement/expiry,
browser storage/payload inspection and all verification commands.
