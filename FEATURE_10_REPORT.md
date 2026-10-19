# Feature 10/60 — edit authenticated user profile

## Implementation

`PATCH /api/auth/me` runs the existing JWT authenticate middleware. The target is exclusively `req.auth.userId`. The controller builds an explicit `$set` containing only provided `name` and `email` fields, performs one atomic MongoDB update with schema validation, and returns only `{ user: { id, name, email } }`. Name-only, email-only, and combined changes are supported; omitted fields are preserved. Keeping the current email is allowed. No token regeneration is necessary because JWT identity uses the stable user ID.

Names must be strings, trimmed, nonempty, and at most 120 characters. Emails must be strings, trimmed, lowercased, match the existing registration pattern, and be at most 254 characters. Malformed bodies, invalid values, and requests with neither allowed field return HTTP 400. Unsupported fields are ignored when allowed fields are present; unsupported-only requests return 400. Client IDs, passwords/hashes, roles, owners, security fields, and MongoDB operators cannot enter the update.

The existing unique email index is initialized before updating. Duplicate-key conflicts, including concurrent requests for the same normalized email, return safe HTTP 409 feedback without database internals. A conflict cannot partially save the name. Missing/deleted users and invalid/expired authentication return 401; unexpected failures use the existing generic error handler.

`authService.updateProfile(accessToken, updates)` sends PATCH with Bearer and JSON headers, includes only allowed fields, filters the response to safe user properties, and maps 400/401/409/network/server/malformed-response failures to friendly errors. HTTP 401 uses the existing matching-token invalidation mechanism; an older token cannot terminate a newer session.

AuthProvider exposes `updateProfile(updates)` through the existing AuthContext value. It uses the current token, replaces global user data after success, preserves the token and authentication state, and rejects late results after logout/account changes. AuthContext remains the source of truth. Neither the context definition file nor Navbar required source changes: Navbar already consumes context and automatically renders the new account name/initial. Application state stays mounted for the same user ID/token.

Profile keeps the read-only name/email display and adds Edit Profile. Edit mode uses a temporary form draft prefilled from the current context user. Cancel discards it without an API request. Client validation supplies labeled field errors and focuses the first invalid field. Saving disables the form controls, displays Saving..., and uses a synchronous guard against duplicate requests. Success returns to view mode, shows `Profile updated successfully.`, and updates Profile and Navbar without reloading. The existing logout actions remain available and authoritative. No password-change or later-feature functionality was added.

## Files created

- `src/utils/profile.js`
- `tests/profile.test.js`
- `tests/profileEditIntegration.jsx`
- `FEATURE_10_REPORT.md`

## Files modified

- `server/src/controllers/authController.js` — update controller and validation.
- `server/src/routes/authRoutes.js` — protected PATCH route.
- `server/tests/auth.test.js` — 20 profile security/behavior tests.
- `src/services/authService.js` — authenticated update transport and safe errors.
- `src/context/AuthProvider.jsx` — global profile update action and session protection.
- `src/pages/Profile.jsx` — edit/save/cancel, validation, pending and result feedback.
- `src/styles/profile.css` — responsive edit-form styles.
- `tests/profileIntegration.jsx` — preserve Feature 09 checks with the new edit interaction.
- `tests/run-register-integration.mjs` — runs the new suite.
- `tests/run-smoke.mjs` — real API edit, same-token preservation, refresh, updated-email login.
- `README.md` — documents PATCH, editing behavior, and password-change exclusion.

## Validation

| Command | Result |
| --- | --- |
| `npm test` | 75 passed; 0 failed/cancelled/skipped |
| `npm run test:integration` | All 13 suites passed |
| `npm --prefix server test` | 127 passed; 0 failed/cancelled/skipped |
| `npm run test:smoke` | All 3 scenario groups passed |
| `npm run lint` | Passed, no diagnostics |
| `npm run build` | Passed, 84 modules transformed |
| `git diff --check` | Passed |

Three new frontend unit tests cover validation, the PATCH allowlist/headers/safe response, and errors including stale/matching-token 401 handling. The new integration suite covers initial context values, edit/prefill/cancel, validation, payload, duplicate submission, pending controls, success, live Navbar changes, updated restoration, safe 400/409/network/500 feedback, 401 cleanup, and a late update after logout. Existing authentication, route/basename, application, registration, login, and Profile suites remain passing.

Twenty new backend tests cover protected/expired JWTs, partial/combined updates, unchanged normalized email, unchanged password hashes and stable JWT identity, identity-spoofing and sensitive-field exclusion, invalid/empty requests without persistence, atomic duplicate conflicts, a real unique-index race, deleted users, and generic database errors. Safe responses are asserted exactly.

Real API smoke uses React DOM, Express, and disposable MongoDB. It verifies profile edit persistence, immediate account initial changes, token preservation, refresh, logout, and successful login with the updated email, alongside existing session and application CRUD/status scenarios. These are jsdom checks, not a claimed physical browser layout/pointer test. Tests never use the personal development database. Git may print LF-to-CRLF normalization notices; these are not whitespace-check failures.

## Exact manual testing steps

Prerequisites: from the `interntrack` folder install dependencies if needed with `npm install` and `npm --prefix server install`. Configure frontend `.env` with `VITE_API_URL=http://localhost:5000/api` and backend `server/.env` with a local MongoDB URI and development JWT secret. Start MongoDB. Run `npm --prefix server run dev` in terminal 1 and `npm run dev` in terminal 2. Use Vite's printed port if it differs from 5173. Have two fictional registered accounts with distinct emails available for the conflict check.

1. **Login:** open `http://localhost:5173/interntrack/login` and sign in as the first account. Expect the dashboard at `/interntrack/`.
2. **Open Profile:** open the Student Workspace account menu and select Profile. Confirm `/interntrack/profile` shows your current name/email.
3. **Edit:** click Edit Profile. Confirm both fields are prefilled. Optionally change a draft and Cancel, then reopen to verify the original values remain.
4. **Change name:** enter a new name, such as `Updated Example User`, leaving email unchanged. A whitespace-only name must show a field error without a PATCH request.
5. **Save:** click Save Changes with a valid name. Expect Saving..., disabled form controls, a single PATCH request, then view mode and `Profile updated successfully.`.
6. **Navbar:** before refreshing, open the account menu. Confirm its name and avatar initial immediately reflect the saved name. Confirm the session stays signed in and the stored JWT is unchanged; do not copy/share it.
7. **Change email:** reopen Edit Profile, enter a fresh fictional email such as `updated.feature10@example.com`, and save. Expect the normalized email in Profile. Invalid email text must show a field error.
8. **Refresh:** reload `http://localhost:5173/interntrack/profile`. Expect AuthProvider to verify through GET `/api/auth/me` and restore the session.
9. **Persistence:** confirm the saved name and email remain in Profile and the account menu after refresh.
10. **Duplicate email:** edit the email to the second account's existing email, including different casing if desired, and save. Expect HTTP 409 with `An account with this email already exists.`; no stack/database details, no forced logout, and no changes to the saved context values. Cancel to view the retained values. Network failure can be checked by stopping the backend during an edit: saving must show friendly connection feedback and retain the form for retry.
11. **Updated-email login:** restart the backend if stopped, choose Sign out, and sign in using the successfully updated email and the unchanged original password. Expect the dashboard and the updated profile values. The original email should no longer sign in unless assigned separately later.

No push, deployment, or Feature 11 work was performed. Manual steps are supplied for browser verification; automated checks above were executed.
