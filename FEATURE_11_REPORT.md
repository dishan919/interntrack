# Feature 11/60 — authenticated change password

## Implementation

`PATCH /api/auth/password` uses the existing JWT authenticate middleware and exclusively selects `req.auth.userId`. It accepts exactly `currentPassword` and `newPassword`. Unknown fields, including confirmation, IDs, email, name, roles, hashes, owner, and security properties, are rejected with HTTP 400. JSON null is rejected by Express's existing strict parser before the controller.

The controller loads the authenticated user with the normally hidden password hash and verifies the exact current password with `bcrypt.compare`. Incorrect current passwords return HTTP 400 with `Current password is incorrect.`; this validation error does not invalidate the session. Missing/deleted users or invalid/expired JWTs return 401 and use the existing frontend session cleanup.

The new password follows registration policy: a string of at least 8 characters, not entirely whitespace, and at most 72 UTF-8 bytes. Same current/new values are rejected after current-password verification. Bcrypt-truncated current-password matches are also rejected. Passwords are never trimmed; meaningful whitespace is preserved.

The controller assigns the new password and calls the existing User model's `save()`. Its pre-save hook hashes the changed value once using bcrypt cost 12. It never writes plaintext to MongoDB or returns the hash. Success returns only `{ message: 'Password changed successfully.' }`. The existing JWT is preserved and remains usable until normal expiration; no refresh token, revocation, or multi-device management was introduced.

`authService.changePassword(accessToken, { currentPassword, newPassword })` supplies Bearer and JSON headers and sends exactly those two values. Confirmation and other form state never enter the request. The service returns minimal safe success, allowlists user-safe 400 messages, and sanitizes network/server/malformed responses. Its 401 behavior uses existing matching-token invalidation, so stale-token errors cannot terminate a newer session.

## Frontend behavior

Profile includes a separate Security card. Choose Change Password to reveal the labeled Current Password, New Password, and Confirm New Password form. It uses the existing visual styles and accessible visibility-control pattern. Each field is hidden initially and has its own keyboard-accessible type-button Show/Hide control, changing aria-label and aria-controls. Visibility changes never submit the form.

Client validation enforces required values, registration length/byte limits, different current/new values, and matching confirmation. Errors identify fields and focus the first invalid input. The form has a synchronous duplicate-submit guard, disabled controls and `Changing password...` while pending. On success it shows `Password changed successfully.`, clears all three inputs, resets visibility to hidden, and keeps the existing context user/session and protected navigation usable. Cancellation also clears the draft.

Passwords exist only in temporary local form/request state. They are not stored in AuthContext, application records, sessionStorage, or localStorage. AuthProvider, logout, profile editing, and Navbar continue to use their existing architecture; no new authentication mechanism was added.

## Files created

- `src/components/profile/ChangePassword.jsx`
- `src/utils/passwordChange.js`
- `tests/passwordChange.test.js`
- `tests/passwordChangeIntegration.jsx`
- `FEATURE_11_REPORT.md`

## Files modified

- `server/src/controllers/authController.js` — current-password verification, validation, safe save/success.
- `server/src/routes/authRoutes.js` — protected password endpoint.
- `server/tests/auth.test.js` — 21 new backend security/behavior tests.
- `src/services/authService.js` — password-change transport and safe errors.
- `src/pages/Profile.jsx` — embeds the separate Security component.
- `src/styles/profile.css` — responsive Security card spacing.
- `tests/profileIntegration.jsx` — updates supporting-text expectation while retaining Profile regression assertions.
- `tests/run-register-integration.mjs` — runs password-change integration suite.
- `tests/run-smoke.mjs` — real API password change, clear/hide behavior, old/new login and stable JWT checks.
- `README.md` — endpoint, verification/hashing, frontend-only confirmation, session behavior, and reset-flow exclusion.

## Validation results

| Command | Final result |
| --- | --- |
| `npm test` | 78 passed; 0 failed/cancelled/skipped |
| `npm run test:integration` | All 14 integration suites passed |
| `npm --prefix server test` | 148 passed; 0 failed/cancelled/skipped |
| `npm run test:smoke` | All 4 scenario groups passed |
| `npm run lint` | Passed; no diagnostics |
| `npm run build` | Passed; 86 modules transformed |
| `git diff --check` | Passed |

Three new unit tests cover validation, exact service payload/headers/minimal response, sanitized errors and stale/current token 401 handling. The new integration suite covers authenticated rendering, required/policy/confirmation/same-password validation, all three independent visibility controls, non-submit behavior, exact payload without confirmation, safe wrong-current/network/server errors, pending and duplicate guards, empty hidden fields after success, unchanged browser storage, usable protected navigation and 401 cleanup.

Twenty-one new backend tests cover missing/invalid/expired JWTs; correct changes and login replacement; exact whitespace and 72-byte boundaries; single bcrypt hashing at cost 12; safe responses; no persistence on invalid requests; incorrect/same/missing/short/blank/non-string/oversized/multibyte values; confirmation and unsupported-field rejection; account targeting restrictions; truncated-current-password rejection; deleted users; and generic database failures. Existing profile update, registration, login, restoration, ownership and application persistence checks remain passing.

Real API smoke drives React DOM → authService → Express → disposable MongoDB, changes the password, checks fields clear and hide, verifies the original JWT still works, rejects old-password login, and logs in with the new password. Existing profile edit/session/application CRUD scenario groups also pass. Tests use disposable databases, never the personal development database. UI checks use jsdom; physical browser layout/pointer testing is not claimed.

The first backend run had one assertion expecting a controller-specific message for JSON null; Express correctly returned its safe parser-level `Invalid request` instead. That expectation was corrected and the complete backend suite was rerun. Git may emit LF-to-CRLF normalization notices; these are not diff-check failures.

## Exact manual testing steps

Prerequisites: from the repository folder, install dependencies if needed (`npm install`, `npm --prefix server install`). Configure frontend `.env` with the API URL and backend `server/.env` with your local MongoDB URI and development JWT secret. Start MongoDB. Run `npm --prefix server run dev` in one terminal and `npm run dev` in another. Use Vite's printed port if it differs from 5173. Use a fictional test account and passwords you choose for this check; do not copy/share actual credentials or tokens.

1. **Login:** open `http://localhost:5173/interntrack/login` and sign in with your test account's current email/password. Expect the dashboard.
2. **Open Security:** use the Student Workspace account menu → Profile. At `/interntrack/profile`, open Security → Change Password. Confirm all three fields are empty and hidden. Toggle each Show/Hide independently; confirm the other fields remain hidden and no request is submitted.
3. **Wrong current password:** enter an incorrect current password, a different valid new password, and matching confirmation. Submit. Expect safe `Current password is incorrect.` feedback and continued signed-in state.
4. **Short new password:** enter the correct current password and a new value shorter than 8 characters, with matching confirmation. Submit. Expect a field error with no PATCH request. Empty fields and an unchanged old/new value should likewise be rejected locally.
5. **Mismatch:** enter a valid different new password and nonmatching confirmation. Submit. Expect `Passwords must match.` and no PATCH request.
6. **Successful change:** enter the correct current password, a different new password satisfying policy, and matching confirmation. Submit once. Expect `Changing password...`, disabled form controls, one PATCH `/api/auth/password` request carrying only current/new values, then `Password changed successfully.`.
7. **Clear/session check:** confirm all three fields are empty and hidden again; no password appears in browser storage. The token under sessionStorage `interntrack_access_token` should remain unchanged. Navigate to Applications or refresh Profile to confirm the session remains usable and the account name/email stay intact.
8. **Logout:** choose Sign out from Profile or the existing account menu. Expect `/interntrack/login`, token removal and no private content.
9. **Old password fails:** attempt login with the same email and old password. Expect `Invalid email or password` and no authenticated session.
10. **New password succeeds:** sign in with the new password exactly as entered, including intentional whitespace. Expect the dashboard and working Profile/application access.

No push, deployment, reset-password flow, or Feature 12 work was performed. These steps are a reproducible manual checklist; executed validation is listed above.
