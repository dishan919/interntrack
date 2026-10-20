# Feature 13/60: Email verification foundation

Implemented Feature 13 only. No production email provider, authentication redesign,
login restriction, push, or deployment was added.

## Files created

- `server/src/controllers/emailVerificationController.js`
- `server/src/services/emailVerification.js`
- `server/src/services/testTokenDelivery.js`
- `server/tests/emailVerification.test.js`
- `src/components/profile/EmailVerification.jsx`
- `src/pages/VerifyEmail.jsx`
- `tests/emailVerification.test.js`
- `tests/emailVerificationIntegration.jsx`
- `FEATURE_13_REPORT.md`

## Files modified

- `server/src/models/User.js`: default false verification status and hidden hash/expiry;
  sensitive fields are removed from JSON even when explicitly selected.
- `server/src/controllers/authController.js`: registration token creation, consistent safe
  user serialization, and atomic email-change verification invalidation.
- `server/src/routes/authRoutes.js`: public verification and authenticated resend routes.
- `server/src/services/passwordResetDelivery.js`: uses shared delivery factory while
  preserving Feature 12 public exports and production isolation.
- `server/tests/auth.test.js`: existing assertions include the added safe boolean field.
- `server/tests/passwordReset.test.js`: safe user field assertions include emailVerified.
- `src/services/authService.js`: safe boolean propagation and verification/resend functions.
- `src/context/AuthProvider.jsx`: refreshCurrentUser action, guarded against stale sessions.
- `src/pages/Profile.jsx`: existing layout gains email status/resend component.
- `src/App.jsx`: public basename-aware verify-email route.
- `tests/run-register-integration.mjs`: includes verification integration suite.
- `tests/run-smoke.mjs`: exercises real verification/resend and email-change behavior.
- `README.md`: API/security/backward compatibility/delivery documentation and exact manual steps;
  Feature 12 debugger instructions now point to the shared delivery implementation.

## User state and compatibility

User adds emailVerified (Boolean, default false), emailVerificationTokenHash, and
emailVerificationExpiresAt. New registrations ignore client verification claims and store
unverified state with a generated verification hash/expiry. Safe registration/login/me/profile
responses contain exactly id, name, email, emailVerified.

Old records missing verification fields read as unverified without bulk rewriting, deleting,
or automatically verifying accounts. Login, JWTs, password resets, application ownership,
and workspace access remain available to unverified and legacy users. A real legacy-record
test confirms login/me do not rewrite storage and resend can initiate verification.

## Tokens, delivery, and endpoints

Tokens use Node crypto.randomBytes(32), encoded as 64 hexadecimal characters (256 bits).
SHA-256 hashes and expiry dates are persisted, never raw tokens. VERIFICATION_TTL_MS
centralizes the 24-hour lifetime. Normal queries hide hash/expiry; JSON serialization and
explicit response allowlists prevent disclosure.

POST /api/auth/verify-email accepts only token. One atomic write matches the hash,
unverified state and future expiry, sets emailVerified=true, and unsets both token fields.
This provides one-time consumption even under concurrency. Invalid, expired, replaced and
used tokens all return the same safe HTTP 400. Success returns only a fixed message.

POST /api/auth/resend-verification requires the existing authenticate middleware and an
empty JSON object. Identity comes exclusively from req.auth.userId. Extra fields/userId
are rejected. Unverified accounts get a new token/expiry; old links stop working. Verified
accounts receive an appropriate message without generating or delivering another token.
The atomic resend predicate prevents it from downgrading an account verified concurrently.

The shared createTokenDelivery factory preserves separate reset/verification capture sinks.
setTestVerificationCapture(callback) and setTestResetCapture(callback) can be configured only
under NODE_ENV=test, and delivery checks the environment again. Tests obtain raw tokens in
memory. Production/development delivery intentionally does nothing; no email is actually
sent. A local debugger can inspect delivery arguments for manual development testing.
No HTTP capture endpoint, token logs, SMTP, Gmail, SendGrid or SES was introduced.

## Profile changes and security

PATCH /api/auth/me still allows only name/email. Verification input alone is rejected;
verification fields accompanying valid profile updates are ignored under the existing
allowlist behavior. Client-supplied status cannot verify an account.

A different normalized email atomically resets status and replaces verification hash/expiry,
and delivery targets the new email. Name-only and unchanged normalized email updates retain
status and tokens. Duplicate-email failures preserve the prior user. Conditional email
matching and bounded retries handle concurrent profile updates; concurrent verification
cannot verify the new email with a token from the old email. Both race directions are tested.

Password hashes, raw tokens, verification hashes/expiry, JWT secrets and database diagnostics
are absent from public user responses. No user ID grants verification/reset authority.

## Frontend and AuthContext

Auth services retain the boolean status while discarding sensitive response fields.
verifyEmail(token) sends only token without a Bearer header. resendEmailVerification(token)
sends an empty body with the current JWT, sanitizes failures and preserves existing 401
session invalidation behavior.

Profile displays Verified / Not verified and provides Resend Verification only when needed.
It has pending feedback, duplicate-submit guards and safe success/error messages. Email
changes update AuthContext and therefore immediately show Not verified.

Public /verify-email?token=... honors the Vite basename and shows missing, invalid,
verifying and success states. StrictMode effect replay reuses the request rather than
consuming a token twice. Success clears the URL query, shows safe navigation and refreshes
the current user through AuthProvider without a browser reload. A safe retry is available
if refreshing status fails. Tokens never enter browser storage or AuthContext; JWT storage
continues to use the existing sessionStorage contract. Session restoration uses GET /me.

## Validation

- Frontend unit tests: 85 passed (five new verification service/privacy tests).
- All 16 frontend integration suites passed, including registration/login/profile/navbar,
  password changes/resets, application workflows, and verification UI/StrictMode behavior.
- Backend full suite: 165 passed, including 11 new verification tests covering registration,
  hash/expiry, safe serialization/responses, unverified login/me, legacy users, atomic
  one-time consumption, expiry, resend authentication/replacement, identity spoofing,
  profile allowlists, name/email changes, duplicate email failures, production capture
  isolation, deleted accounts, generic database errors, and concurrency races.
- Real React -> service -> Express -> disposable MongoDB smoke passed, including existing
  application CRUD/session/profile/password flows, reset, verification, resend replacement,
  live verification refresh/restoration and verified email-change invalidation.
- ESLint passed. Production Vite build passed. git diff --check passed.

Initial validation caught a syntax error introduced while extending frontend response
mapping; the destructuring declarations were corrected. All final checks passed.

## Exact manual testing steps

See README, section "Feature 13: email verification foundation", steps 1-12. These specify
local startup/debugger capture, registration/unverified login, resend/replaced links,
authenticated verification/status refresh, reused/missing/expired links, name/email edits,
storage/payload inspection, safe connection errors, and every verification command.
No real token or secret is included in this report or README.
