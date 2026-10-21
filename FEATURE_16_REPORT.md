# Feature 16/60: Application Notes

Implemented and validated on 2026-10-21. Scope is Application Notes only.

## Implementation

- Added `applicationNotes` as a strictly defined embedded Application subdocument array. Each serialized entry has only `id`, `text`, `createdAt`, and `updatedAt`.
- IDs and timestamps are server-managed. Text is required, trimmed, nonempty, and limited to 2000 characters. Note requests accept only a `text` field; arbitrary metadata and identity fields are rejected.
- Preserved the existing free-text `notes` field for backward compatibility. Application Details displays it as a Legacy note; existing Edit application controls still manage that earlier field. No data migration is required.
- New structured notes use dedicated endpoints. Generic application creation ignores client-supplied structured notes; ordinary application updates preserve existing structured notes, including when stale payloads include them. Atomic field updates prevent a form replacement from erasing notes.
- Added a Notes panel with plain-text display, created/updated times, textarea, character count/help, Save/Edit/Delete/Cancel, empty state, pending feedback, safe errors, retained drafts on failure, and duplicate-submit protection.
- API-confirmed application responses update ApplicationProvider state immediately without a page reload. No note data is written to localStorage or sessionStorage.

## API

| Method | Endpoint | Result |
| --- | --- | --- |
| POST | `/api/applications/:id/notes` | 201 with updated application |
| PATCH | `/api/applications/:id/notes/:noteId` | 200 with updated application |
| DELETE | `/api/applications/:id/notes/:noteId` | 200 with updated application |

POST/PATCH body: `{ "text": "A private note" }`.
Existing authenticated application GET/list endpoints include structured notes.
Older applications without `applicationNotes` render an empty notes state.

## Ownership and security

- All note routes use existing JWT authentication and the existing-account operation queue.
- Reads and writes are scoped to Application `_id` and `owner: req.auth.userId`; edits/deletions additionally match the embedded note ID.
- Foreign/missing applications or notes and invalid IDs return safe JSON 404 responses. Access is checked before body validation on valid IDs.
- Client owner/user fields cannot select ownership or override a note's ID/timestamps. Generic application writes cannot overwrite `applicationNotes`, including dotted-path attempts.
- Notes belong to their Application and are removed with application/account deletion; no independent ownership or orphan-note collection exists.
- Content is stored as a plain-text string and rendered through React text escaping, never HTML or `dangerouslySetInnerHTML`. Markup-looking text displays literally.
- Existing auth/session behavior and configurable CORS hardening are unchanged. Server errors continue through the existing safe JSON error handler.

## Files changed

- `server/src/models/Application.js`
- `server/src/controllers/applicationController.js`
- `server/src/controllers/applicationNoteController.js` (new)
- `server/src/routes/applicationRoutes.js`
- `server/tests/applications.test.js`
- `src/components/applications/ApplicationNotes.jsx` (new)
- `src/context/ApplicationProvider.jsx`
- `src/pages/ApplicationDetails.jsx`
- `src/services/applicationService.js`
- `src/styles/global.css`
- `tests/notes.test.js` (new)
- `tests/notesIntegration.jsx` (new)
- `tests/run-register-integration.mjs`
- `tests/run-smoke.mjs`
- `FEATURE_16_REPORT.md` (new)

## Validation results

| Command | Result |
| --- | --- |
| `npm test` | PASS: 95/95 |
| `npm run test:integration` | PASS, including new Notes suite and all existing suites |
| `npm --prefix server test` | PASS: 201/201, including existing CORS tests |
| `npm run test:smoke` | PASS, including new real React/service/Express/MongoDB note CRUD and refresh checks |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `git diff --check` | PASS |

Backend tests cover owner CRUD, trim/boundaries, invalid payloads, strict schema, timestamps, JWT/deleted-account rejection, cross-user read/write isolation, spoofing, malformed/missing IDs, cross-application note IDs, concurrent additions, ordinary-update preservation, and application deletion.

Frontend tests cover authenticated details rendering, empty/add/edit/delete/cancel flows, text validation, character limit, pending/duplicate protection, safe errors and retained drafts, escaped markup-looking text, refresh persistence, no note storage, and late-response isolation after logout. Service tests cover encoded IDs, exact request payloads, Bearer headers, safe failures, and existing stale/current-token invalidation behavior.

No packages installed, secrets changed, Feature 17 implemented, commits pushed, or deployments performed.
