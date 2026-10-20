# InternTrack

## Change password (Feature 11/60)

Authenticated users can open **Profile → Security → Change Password**. Provide the current password, a different new password, and matching confirmation. The form has independent Show/Hide controls, prevents duplicate submission, and clears/hides all password fields after success while keeping the current session signed in.

`PATCH /api/auth/password` requires the existing Bearer JWT and accepts only `currentPassword` and `newPassword`; unknown fields are rejected. The account is selected exclusively by verified JWT identity. The backend verifies the current password with bcrypt, applies the registration policy (at least 8 characters, nonblank, at most 72 UTF-8 bytes), and preserves exact password whitespace. It saves through the existing model hook so only a bcrypt hash is stored. Confirmation remains frontend-only and is never sent. Incorrect current passwords return safe HTTP 400 feedback; invalid/expired JWTs retain the existing 401 session cleanup. Success returns only `{ "message": "Password changed successfully." }`. Existing JWTs remain valid until normal expiry; no session revocation is introduced. No passwords are logged or persisted in browser storage or AuthContext. Forgot/reset password is not implemented yet.

## User profile (Feature 09/60)

Authenticated users can view their name and email on the protected `/profile` route (`/interntrack/profile` with the configured Vite base). Open **Profile** in the Student Workspace account menu. The page reads the verified user from AuthContext and reuses its existing Sign out action. Refresh restores the session through AuthProvider; viewing Profile makes no additional `/api/auth/me` request. Logged-out visitors are redirected to login.

### Edit profile (Feature 10/60)

Choose **Edit Profile**, change name/email, and choose **Save Changes** or **Cancel**. Saving calls authenticated `PATCH /api/auth/me` with an explicit name/email allowlist. Partial updates are supported by the API; names are trimmed (1–120 characters), emails are trimmed/lowercased and validated (maximum 254 characters), and duplicate emails return safe HTTP 409 feedback. Missing allowed fields or invalid data return 400; invalid/expired sessions return 401. Only the JWT user ID selects the account. Success returns `{ user: { id, name, email } }`, updates AuthContext and the account menu immediately, and preserves the existing JWT. Changes persist through refresh and the new email is used for future login. Password changes are intentionally not part of this feature.

A beginner-friendly React application for tracking internship and job applications. Uses Vite, JavaScript, React Router, Context API, CSS, and a MongoDB-backed Express REST API with backend registration and login credential verification.

## Run locally

Requires Node.js 22.12+ (or 20.19+) and npm.

1. Open a terminal in this folder.
2. Run `npm install` and `Copy-Item .env.example .env`.
3. Start the backend as described below, then run `npm run dev`.
4. Open the local URL printed by Vite (usually http://localhost:5173).

Run npm run lint for ESLint. Run npm run build for a production build. Run npm run preview to preview the built app locally.

## Backend foundation

The frontend and backend run independently. React components use ApplicationContext, which calls applicationService over HTTP. MongoDB is the application source of truth. Configure `VITE_API_URL=http://localhost:5000/api` in the frontend `.env` (restart Vite after changing it). Real `.env` files are ignored.

In a separate terminal, from this repository folder:

```powershell
cd server
npm install
Copy-Item .env.example .env
npm run dev
```

The backend requires Node.js 22.12+ and uses Node's built-in environment-file loading and watch mode. `npm start` runs without watch mode. `PORT` defaults to `5000`. Set `MONGODB_URI` in the ignored `server/.env` file (or your environment):

```dotenv
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/interntrack
JWT_SECRET=replace-with-a-long-random-development-secret
```

Install MongoDB Community Server separately. If it is installed as a Windows service, start it with `Start-Service MongoDB` in an administrator PowerShell. Alternatively, with `mongod` on PATH, run the following from the repository folder in a separate terminal (keep the data directory between restarts):

```powershell
New-Item -ItemType Directory -Force "$env:LOCALAPPDATA/InternTrack/mongodb"
mongod --dbpath "$env:LOCALAPPDATA/InternTrack/mongodb" --bind_ip 127.0.0.1 --port 27017
```

The backend connects before listening and exits with a clear, credential-free error if MongoDB is unavailable or `MONGODB_URI` is missing. No personal database or MongoDB service is installed or configured by this repository.

Backend URL: http://localhost:5000. GET http://localhost:5000/api/health returns HTTP 200 with `{"status":"ok","message":"InternTrack API is running"}`. Unknown routes return JSON with HTTP 404. CORS allows the default Vite origins http://localhost:5173 and http://127.0.0.1:5173; update the origin list in `server/src/app.js` if using another frontend port.

Run backend checks with `npm test` from `server/`. Run all existing frontend checks from the repository folder:

```powershell
node --test tests/*.test.js
node tests/run-integration.mjs
npm run lint
npm run build
```

The backend separates routes, controllers, the Mongoose model (`server/src/models/Application.js`), and database connection configuration (`server/src/config/database.js`).

Backend tests use development-only `mongodb-memory-server` to launch disposable real MongoDB processes. They never use your `MONGODB_URI` or personal database. The first test run needs network access to download a MongoDB binary, cached under `server/node_modules/.cache/`. Tests clear only their own temporary database and stop it afterward. The persistence smoke test starts the actual Express entry point and verifies records survive two Express process restarts.

### Applications REST API

Feature 04/60 applies the existing `authenticate` middleware once with `router.use(authenticate)` before all application routes. Every application endpoint in the table below requires `Authorization: Bearer <accessToken>`. With JWT configuration present, missing/malformed headers and invalid/expired JWTs return HTTP 401 with `{ "message": "Unauthorized" }` before application controllers execute. Valid tokens continue to the existing controller and its normal success/validation/not-found behavior. Tokens in query parameters and client-supplied identity do not authenticate requests. Health remains public.

**Ownership (Feature 05/60):** every newly created application has a required, indexed `owner` ObjectId reference to `User`. The backend assigns it exclusively from verified `req.auth.userId`; body/query `owner`, `ownerId`, and `userId` cannot select or change ownership. Normal JSON responses omit `owner` to preserve the API shape. All list queries filter by owner; single-record reads, replacement updates, and deletes match both `_id` and owner. Cross-user access returns the same HTTP 404 `{ "message": "Application not found" }` as a missing record, including update requests with invalid fields. PUT preserves ownership while retaining its existing replacement semantics for editable fields.

**Legacy development data:** existing ownerless applications remain in MongoDB unchanged, but no user can list, read, update, delete, or claim them through this API. Adding a required schema field does not backfill existing documents. No automatic assignment or migration runs. For local recovery, keep a backup, review the records outside the API, and explicitly recreate selected editable application data through authenticated POST requests for the intended account. The backend assigns the new owner and ID; old records remain inaccessible. No personal database is modified by tests.

The frontend uses AuthProvider/AuthContext as of Feature 08. Registration and login are public routes; the workspace requires a verified session. Application requests send the current JWT in the Authorization header. Frontend mock suites remain isolated, and the real API smoke test checks production Bearer headers against disposable MongoDB.

MongoDB is now used by the Express Applications API. Records survive backend restarts when using the same MongoDB database. The React frontend uses this API for application persistence. Legacy browser records are imported only on an explicit Settings action.

| Method | Endpoint | Success |
| --- | --- | --- |
| GET | `/api/health` | 200 health JSON |
| GET | `/api/applications` | 200 array (including `[]`) |
| GET | `/api/applications/:id` | 200 application |
| POST | `/api/applications` | 201 created application |
| PUT | `/api/applications/:id` | 200 replaced application |
| DELETE | `/api/applications/:id` | 204, no response body |

POST and PUT require non-empty string `company` and `position` values, which are trimmed. Status must be `Saved`, `Applied`, `Interview`, `Offer`, or `Rejected`; omitted status defaults to `Saved`. Invalid input returns JSON 400. Missing application IDs return JSON 404 with `Application not found`.

PUT replaces all editable data: omitted optional fields are removed, and omitted status resets to `Saved`. MongoDB generates `_id`; API JSON exposes it as a string `id` and omits `_id` and `__v`. Client-supplied `id`, `_id`, and `__v` are ignored on POST and PUT. Malformed and nonexistent IDs return the same application-specific 404. Imported browser records receive MongoDB IDs and retain their old IDs only as import markers.

The schema requires trimmed company/position strings and an allowed status. Optional JSON fields (including interviews, skills, documents, activity, follow-ups, created date, and other metadata) are retained using flexible schema fields without additional validation, date coercion, generated nested IDs, or generated timeline events. Only database identity is server-managed; `createdAt` remains optional editable metadata for Step 2 compatibility.

Example PowerShell API flow with the backend running (first obtain `$accessToken` using the login example below):

```powershell
$base = 'http://localhost:5000/api/applications'
$headers = @{ Authorization = "Bearer $accessToken" }
$body = @{ company = 'IFS'; position = 'Software Engineer Intern' } | ConvertTo-Json
$app = Invoke-RestMethod $base -Headers $headers -Method Post -ContentType 'application/json' -Body $body
Invoke-RestMethod "$base/$($app.id)" -Headers $headers
$body = @{ company = 'IFS'; position = 'Software Engineer Intern'; status = 'Interview' } | ConvertTo-Json
Invoke-RestMethod "$base/$($app.id)" -Headers $headers -Method Put -ContentType 'application/json' -Body $body
Invoke-RestMethod "$base/$($app.id)" -Headers $headers -Method Delete
Invoke-RestMethod $base -Headers $headers
```

## Registration API (Authentication Step 1)

With MongoDB and the backend running, create a local test user from PowerShell:

```powershell
$registration = @{
  name = 'Test User'
  email = 'test.user@example.com'
  password = 'LocalTestPassword123'
} | ConvertTo-Json
Invoke-RestMethod 'http://localhost:5000/api/auth/register' -Method Post -ContentType 'application/json' -Body $registration
```

Use test data for this local example. `POST /api/auth/register` returns HTTP 201 with only `{ "user": { "id": "...", "name": "Test User", "email": "test.user@example.com" } }`. Names are trimmed (maximum 120 characters); emails are trimmed, lowercased, format-checked, and unique (maximum 254 characters). Passwords require at least 8 characters, cannot be entirely whitespace, and must fit within 72 UTF-8 bytes; passwords are preserved exactly rather than trimmed.

The User model stores only name, email, a salted bcrypt password hash, and created/updated timestamps. [bcryptjs](https://github.com/dcodeIO/bcrypt.js/) hashes new or changed passwords before saving with cost 12. Passwords are excluded from default queries and JSON serialization; the endpoint explicitly returns only safe user fields. Invalid registration data returns 400, duplicate normalized email returns 409 (including concurrent registrations), and unexpected server failures return a generic 500. No new environment variables or secrets are required.

Registration tests run with `npm --prefix server test` and use the existing disposable MongoDB setup.

## Login API (Feature 02/60)

With the backend running, log in using the disposable example account registered above:

```powershell
$login = @{ email = 'test.user@example.com'; password = 'LocalTestPassword123' } | ConvertTo-Json
Invoke-RestMethod 'http://localhost:5000/api/auth/login' -Method Post -ContentType 'application/json' -Body $login
```

These are fictional development credentials. `POST /api/auth/login` trims and lowercases the email, explicitly selects the normally hidden password hash, and uses `bcrypt.compare()` with the exact submitted password. As of Feature 03, HTTP 200 returns `{ "user": { "id": "...", "name": "Test User", "email": "test.user@example.com" }, "accessToken": "..." }`. Passwords and hashes are never returned or logged.

Missing or invalid email and missing/blank/non-string passwords return 400. Unknown emails and incorrect passwords both return 401 with `{ "message": "Invalid email or password" }`. Passwords exceeding 72 UTF-8 bytes also return that 401 to prevent bcrypt truncation matches. Unexpected failures return generic 500 responses. Login and registration tests share the disposable MongoDB setup.

## JWT access token foundation (Feature 03/60)

Local token functionality requires `JWT_SECRET` in the ignored `server/.env` or environment. Replace the placeholder in `server/.env.example` with a long random development secret in your own `.env`; never commit that file or share the secret. No real secret is included in this repository. Restart the backend after configuration changes. Missing or blank configuration returns HTTP 503 with `Authentication is not configured` when issuing or verifying tokens; other API functionality remains available.

After bcrypt verification, login uses [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) to sign an HS256 access token containing only `sub` (user id), `iat` (issued at), and `exp` (expiration), with a one-hour lifetime. The reusable `authenticate` middleware expects `Authorization: Bearer <token>`, verifies the signature with an explicit HS256 allowlist, checks expiration and required identity/time claims, and sets `req.auth.userId` without accessing MongoDB. Missing/malformed credentials and invalid/expired tokens return HTTP 401 with `Unauthorized`.

`GET /api/auth/me` uses this middleware alongside the application router. It loads the current user by verified id and returns HTTP 200 with only `{ "user": { "id": "...", "name": "...", "email": "..." } }`; deleted/nonexistent users return the same safe 401. Database failures return generic 500 responses. Application routes require authentication as of Feature 04, with per-user ownership enforced as of Feature 05. Frontend registration/login and session management are described below; refresh tokens remain deferred.

With the backend running and the fictional account above registered, manually log in, capture the access token, and verify it from PowerShell:

```powershell
$loginBody = @{ email = 'test.user@example.com'; password = 'LocalTestPassword123' } | ConvertTo-Json
$loginResponse = Invoke-RestMethod 'http://localhost:5000/api/auth/login' -Method Post -ContentType 'application/json' -Body $loginBody
$accessToken = $loginResponse.accessToken
Invoke-RestMethod 'http://localhost:5000/api/auth/me' -Method Get -Headers @{ Authorization = "Bearer $accessToken" }
```

Run `npm --prefix server test` for registration, login, and JWT checks. Tests set a dedicated test-only JWT secret and use disposable MongoDB; they never depend on your development secret or personal database.

## Frontend source structure

- src/components/common: shared badges, cards, search, filters, empty states.
- src/components/layout: sidebar, header, and route layout.
- src/components/applications: application rows and shared add/edit form.
- src/pages: all eight pages.
- src/context: application state and mutations.
- src/services/applicationService.js: centralized fetch CRUD, safe HTTP/network errors, and explicit legacy import.
- src/utils/applications.js: statuses, date formatting, counts, and sample data.
- src/styles/global.css: responsive layout and styles.
- src/App.jsx: routes; src/main.jsx: React entry point.

Applications load asynchronously from the API. The shared layout shows loading feedback before rendering data pages and a safe retry message on failure. Mutations serialize requests, merge edits with the latest server-confirmed record, and publish server responses to React state only after success. Failed add/edit/delete requests retain existing data; forms navigate only on success. PUT sends the complete merged record because the existing endpoint replaces optional fields. Nested and unknown metadata remain intact; the flexible Mongoose metadata fields remain unchanged alongside the required owner field.

### Previous browser data

No automatic startup merge or sample-data seeding occurs. In Settings, choose **Import browser records** once to preserve records from this browser's old `interntrack_applications` backup. Import requires valid company, position, and string ID values; fix missing required values in your backup before import. Each POST carries `legacyBrowserId`; retries fetch existing server IDs and skip completed records after a partial failure. A separate `interntrack_api_import_complete` marker stops further imports after success, including after database records are deleted. The original browser key is retained as a backup and never read for live application state or written by CRUD. Run the import in one tab at a time. View/theme preferences remain independent. Browser storage must be available to mark completion. Export/clear in Settings now operates on API data; clear deletes records individually and retains an accurate view if a later deletion fails.

For production hosting, configure your server to serve index.html for unknown paths so direct links to React Router pages work.

## Application deadlines

Add or edit an application to set its optional Application Deadline. The Applications and Details pages show the date and a calendar-day indicator: days left, Tomorrow, Deadline today, or Expired. Indicators refresh while the page stays open and when the browser window regains focus.

The dashboard shows the closest five deadlines due today or later. Expired deadlines never change application status. Use Deadline: Soonest or Deadline: Latest alongside search and status filters; records without valid deadlines appear last. Clearing a deadline removes its indicator.

Existing records without deadlines continue to work. Missing optional legacy fields receive display defaults in memory; merely loading the app never rewrites API records or the legacy browser backup.

Run deadline regression checks:

```powershell
node --test tests/deadlines.test.js
node tests/run-integration.mjs
```

The integration checks use React server rendering and isolated mock REST records; they never read or modify your browser's application data.

## Interview Tracker

The optional Interview Details section in Add/Edit Application supports a date, time, HR/Technical/Final/Other stage, Online/On-site/Phone type, and notes. Online interviews show a meeting-link input; On-site interviews show a location input. Empty fields are hidden on the Details page.

Upcoming Interviews shows the closest five future interviews in the existing dashboard panel. Application rows display a subtle indicator for upcoming interviews. Labels include Today, Tomorrow, In N days, and Past. Interviews never automatically change the application's status.

Dates and times use your browser's local timezone. A scheduled interview becomes past after its time; a date-only interview remains upcoming through that calendar day. Indicators refresh each minute and when the window regains focus. Time-zone changes can therefore affect timed interviews.

Older interviewDate values remain readable without storage migration. Editing an application keeps interviewDate synchronized with interview.date for compatibility. Clearing all interview fields removes the optional interview object. Existing records without a position receive an empty display default in memory; Add/Edit still requires a position.

Run all regression checks:

```powershell
node --test tests/deadlines.test.js tests/interviews.test.js
node tests/run-integration.mjs
npm run lint
npm run build
```

These tests use isolated REST doubles, a DOM-based Context harness and React server rendering. No test accesses or resets your browser's saved applications.

## Applications Board View

Use List View / Board View on the Applications page. List View keeps the existing application rows; Board View groups the same searched, filtered, and deadline-sorted results into Saved, Applied, Interview, Offer, and Rejected columns. Column counts reflect the visible results. Cards link to Application Details and show available deadlines and upcoming interviews, including legacy interview dates.

The separate interntrack_application_view key stores only list or board. With no saved preference, List View is selected. Reading or switching views never writes application records. If browser storage is blocked, view switching still works for the current session and a preference-save notice appears.

Board columns scroll horizontally on desktop and mobile. Tab to the board region to scroll with the keyboard; the view buttons and card links use native keyboard behavior and visible focus states. Change statuses through Edit Application, native drag-and-drop, or the keyboard/touch-friendly Move to select on each board card. No additional dependencies are used.

Run all unit and React-rendering integration checks:

```powershell
node --test tests/deadlines.test.js tests/interviews.test.js tests/viewPreference.test.js
node tests/run-integration.mjs
```

Kanban checks cover grouping/counts, shared search results, filtered/sorted board input, deadline/interview display, detail links, preference reloads, application-data isolation, status-update counts, and desktop/mobile scroll CSS. Tests use isolated storage and do not modify your browser data.

## Drag-and-drop status changes

Drag a board card into Saved, Applied, Interview, Offer, or Rejected. The dragged card becomes slightly transparent, and a different destination column uses the existing soft accent. Dropping updates status through ApplicationContext.updateApplication; deadline, interview, notes, and all other fields are preserved. Counts, List View, dashboard statistics, and saved data use the same Context state. Dropping into the existing column does not write data.

Use the labeled Move to select on each card for keyboard or touch access. Successful moves are announced through a polite screen-reader status region. Native drag-and-drop support varies on touch devices; the select fallback provides the same update flow. Moving under an active status filter can hide the card when it no longer matches that filter.

Run all checks:

```powershell
node --test tests/deadlines.test.js tests/interviews.test.js tests/viewPreference.test.js tests/kanbanMove.test.js
node tests/run-integration.mjs
npm run lint
npm run build
```

Drag integration tests invoke the real card, board, drop, and fallback event handlers with simulated DataTransfer. They verify Context/service persistence by remounting the provider, requested transitions, same-column no-op, counts, List View synchronization, preserved metadata and unknown fields, rejected external drags, and feedback classes. These are isolated automated checks rather than browser pointer-gesture tests.

## Step 4 validation

```powershell
# Frontend folder
npm test
npm run test:integration
npm run test:smoke
npm run lint
npm run build
# Separate backend terminal
cd server
npm test
```

Frontend integration checks mount the real provider in jsdom to exercise asynchronous React effects, then retain the existing UI rendering/drag-handler assertions. Service tests cover safe HTTP/network/JSON failures and resumable explicit migration. Backend tests include frontend-service CRUD and nested metadata through a disposable real MongoDB database. No test reads your personal MongoDB database. The development smoke sequence can be run with the local commands above: create, refresh, edit, refresh, change board status, refresh, delete, refresh.

`npm run test:smoke` drives the real React DOM in jsdom through create/refresh/edit/refresh/board-status/refresh/delete/refresh with the actual Express API and disposable MongoDB. It starts and stops all test resources automatically; it is not a real-browser pointer test.

## Feature 04 manual authentication check

With the backend running, JWT_SECRET configured, and the fictional `test.user@example.com` account registered using the registration example above:

```powershell
# 1. Login; keep the returned token in memory without printing it.
$api = 'http://localhost:5000/api'
$loginBody = @{ email = 'test.user@example.com'; password = 'LocalTestPassword123' } | ConvertTo-Json
$loginResponse = Invoke-RestMethod "$api/auth/login" -Method Post -ContentType 'application/json' -Body $loginBody
$accessToken = $loginResponse.accessToken

# 2. No token: expect 401 (works with Windows PowerShell and PowerShell 7).
try {
    Invoke-RestMethod "$api/applications" -Method Get
    throw 'Expected HTTP 401'
} catch {
    if ($null -eq $_.Exception.Response) { throw }
    $status = [int]$_.Exception.Response.StatusCode
    if ($status -ne 401) { throw }
    Write-Output "Confirmed HTTP $status"
}

# 3. Valid Bearer token: expect 200 and your own collection (possibly empty).
Invoke-RestMethod "$api/applications" -Method Get -Headers @{ Authorization = "Bearer $accessToken" }
```

## Feature 05 two-user manual test

Run from PowerShell with the backend and MongoDB running and JWT_SECRET configured. Use fresh fictional emails for each run; register only once for each email.

```powershell
$api = 'http://localhost:5000/api'
# 1. Register/login User A.
$aCredentials = @{ name = 'Example User A'; email = 'feature05.a@example.com'; password = 'ExamplePassword123' } | ConvertTo-Json
Invoke-RestMethod "$api/auth/register" -Method Post -ContentType 'application/json' -Body $aCredentials
$aLogin = Invoke-RestMethod "$api/auth/login" -Method Post -ContentType 'application/json' -Body $aCredentials
$aHeaders = @{ Authorization = "Bearer $($aLogin.accessToken)" }
# 2. Register/login User B.
$bCredentials = @{ name = 'Example User B'; email = 'feature05.b@example.com'; password = 'ExamplePassword456' } | ConvertTo-Json
Invoke-RestMethod "$api/auth/register" -Method Post -ContentType 'application/json' -Body $bCredentials
$bLogin = Invoke-RestMethod "$api/auth/login" -Method Post -ContentType 'application/json' -Body $bCredentials
$bHeaders = @{ Authorization = "Bearer $($bLogin.accessToken)" }
# 3. A creates an application.
$aBody = @{ company = 'Example Company A'; position = 'Engineering Intern' } | ConvertTo-Json
$aApp = Invoke-RestMethod "$api/applications" -Method Post -Headers $aHeaders -ContentType 'application/json' -Body $aBody
# 4. B creates a different application.
$bBody = @{ company = 'Example Company B'; position = 'Design Intern' } | ConvertTo-Json
$bApp = Invoke-RestMethod "$api/applications" -Method Post -Headers $bHeaders -ContentType 'application/json' -Body $bBody
# 5. A sees A's applications only.
Invoke-RestMethod "$api/applications" -Headers $aHeaders
# 6. B sees B's applications only.
Invoke-RestMethod "$api/applications" -Headers $bHeaders
# 7. A cannot read, update, or delete B's application: all return 404.
foreach ($method in @('Get', 'Put', 'Delete')) {
    $request = @{ Uri = "$api/applications/$($bApp.id)"; Method = $method; Headers = $aHeaders }
    if ($method -eq 'Put') { $request.ContentType = 'application/json'; $request.Body = $aBody }
    try {
        Invoke-RestMethod @request
        throw 'Expected HTTP 404'
    } catch {
        if ($null -eq $_.Exception.Response) { throw }
        $status = [int]$_.Exception.Response.StatusCode
        if ($status -ne 404) { throw }
        Write-Output "$method confirmed HTTP $status"
    }
}
```

Feature 05 regression checks use two disposable users to verify isolated lists, cross-user GET/PUT/DELETE in both directions, ignored ownership spoofing, ownerless-record exclusion, required/indexed schema ownership, and ownership isolation across backend restarts. Existing authenticated CRUD, metadata, validation, authentication, frontend integration, and real API UI smoke checks remain in place.

## Frontend registration (Feature 06/60)

Open `/interntrack/register` to create an account using the existing `POST /api/auth/register` endpoint. This public page runs outside the application-data provider, so protected application API requests cannot block registration. Name, email, password, and matching confirmation are validated locally; backend validation remains authoritative. The auth service uses `VITE_API_URL` (default `http://localhost:5000/api`), sends only name/email/password, and displays safe validation, duplicate-email, and connection errors.

Submission disables controls and prevents duplicate requests. Success displays ?Account created successfully.? and clears password fields. It does not log in, store tokens/passwords, or create authentication state. The Sign in link opens `/login`; session management is handled centrally by AuthProvider (Feature 08).

Manual test from the repository folder:

1. If dependencies are not installed, run `npm install` and `npm --prefix server install`.
2. Configure `server/.env` from `server/.env.example` with your development MongoDB URI and JWT secret, and start MongoDB.
3. Run `npm --prefix server run dev` in one PowerShell terminal.
4. In another, run `npm run dev` and open `http://localhost:5173/interntrack/register` (or the port Vite prints).
5. Submit empty fields; try an invalid email, short password, and mismatched confirmation. Correct them and use a fresh fictional address such as `register.demo@example.com` with a password of at least eight characters. Confirm the success message without navigation or automatic login.
6. Reload `/register`, submit the same email, and confirm the duplicate-email message. Stop the backend and submit a valid form to check the friendly connection error. No password or token should appear in browser storage.

## Frontend login (Feature 07/60)

Open `/interntrack/login` with the configured Vite base (`/login` relative to `import.meta.env.BASE_URL`). Login and registration are public routes outside application-data loading; each page links to the other through React Router. The Login page reuses the responsive registration card, controls, and accessible Show/Hide password styling.

Email and password are required, email format is checked, and passwords require at least eight characters. Email is trimmed; passwords retain their exact whitespace. `authService.login()` calls the real existing `POST /api/auth/login` using `VITE_API_URL` (default `http://localhost:5000/api`). Backend validation and bcrypt verification remain authoritative. Missing/incorrect credentials display safe feedback; network/server failures show friendly messages without backend diagnostics. Submission disables controls and prevents duplicate requests.

As of Feature 08, successful login hands the safe user/token response to AuthProvider, clears the password, and navigates to the dashboard. The provider persists only the access token in sessionStorage. The token and password are never displayed or logged. Registration still does not log in automatically. See session lifecycle and manual checks below.

Manual test from the repository folder:

```powershell
# Terminal 1: MongoDB running; server/.env configured.
npm --prefix server run dev
# Terminal 2:
npm run dev
```

1. Open `http://localhost:5173/interntrack/register` (use Vite's printed port if different) and register a fresh fictional account such as `login.demo@example.com`.
2. Follow Sign in to `http://localhost:5173/interntrack/login`. Check empty fields, an invalid email, a short password, and Show/Hide without submission.
3. Submit an incorrect password of at least eight characters and confirm ?Invalid email or password?. Stop the backend temporarily to verify the friendly connection error.
4. Restart the backend and submit the correct credentials. Confirm navigation to the dashboard, no token displayed, and only the access token stored in sessionStorage (no password/user credentials, no JWT in localStorage). Refresh to confirm session restoration.
5. Sign out from the account menu, then follow Create an account to return to registration. Existing dashboard/application routes retain their configured basename and protected API behavior.

Focused tests cover login validation, the service request/response contract, safe errors and malformed responses, real input and visibility controls, duplicate submission, session persistence, dashboard redirect, auth links under the basename, and the frontend login service against the real Express API using disposable MongoDB. Run `npm test`, `npm run test:integration`, `npm --prefix server test`, `npm run test:smoke`, `npm run lint`, and `npm run build`.

## Authentication state and sessions (Feature 08/60)

`AuthProvider` surrounds the routes and exposes safe user state, accessToken, isAuthenticated, isAuthLoading, login, and logout through `AuthContext`. Login calls the existing service once, stores only the access token under **`interntrack_access_token` in sessionStorage**, and navigates with React Router `navigate('/')`. The existing Vite basename maps that to `/interntrack/`. Already-authenticated visits to `/login` redirect to the dashboard. Registration remains public and never authenticates a newly created account automatically.

On initialization the provider checks centralized session storage. With no token it finishes unauthenticated without calling protected APIs. With a stored token it calls `GET /api/auth/me` using `Authorization: Bearer <accessToken>` and restores the safe user only after the backend verifies the session. Private routes show "Checking your session..." during restoration. Invalid/expired tokens and restoration failures (including an unavailable backend) clear the stored token and fail closed to login; stored user objects are never trusted. If storage is unavailable, login displays a friendly error rather than claiming a persisted session.

All workspace routes (`/`, applications and its add/detail/edit routes, companies, statistics, settings) are guarded. Unauthenticated visits redirect to `/login`. ApplicationProvider mounts only after authentication is known and keys its state to the current user/session. Logout or account changes unmount and clear previous application data. Queued operations stop after unmount, late responses cannot repopulate another session, and each operation retains its original token rather than switching identities mid-request.

`applicationService` attaches Bearer headers centrally for every application CRUD/import request. Application 401 responses invalidate the matching current session, clear its token/user, and return the user to login. A delayed 401 from an older token cannot terminate a newer session. There are no refresh tokens or automatic retry with new credentials. Non-401 application errors keep the existing safe retry behavior.

Use **Sign out** in the existing Student Workspace account menu. It removes the session token, clears user/authentication state, and removes the private workspace. Requests already accepted by the server cannot be undone by frontend logout; subsequent queued writes are stopped, and stale results are discarded.

SessionStorage is a learning-stage, per-tab persistence choice, not a claim of final production authentication design. It stores no password, confirmation, email, or user object, and JWTs never appear in URLs or UI. Backend JWT verification and per-user ownership remain authoritative. No refresh tokens, HttpOnly cookies, remember-me, roles, or deployment changes are included.

### Manual session test

From the repository folder, with MongoDB running and `server/.env` configured:

```powershell
# Terminal 1
npm --prefix server run dev
# Terminal 2
npm run dev
```

Use the port printed by Vite if it differs from 5173.

1. In a fresh browser tab/session with no saved token, visit `http://localhost:5173/interntrack/`. Confirm redirect to `/interntrack/login` without an application API request.
2. If needed, follow Create an account and register fictional credentials at `/interntrack/register`, then intentionally return to Sign in. Registration alone must not create a session.
3. Log in with that account. Confirm the URL becomes `http://localhost:5173/interntrack/` and the dashboard loads.
4. Open Applications, create a fictional record, and reload. In browser Network tools confirm protected requests return success with an Authorization Bearer header; do not copy or share the token. A second account must see only its own data.
5. Refresh while logged in. Confirm `/api/auth/me` verifies the session before application data loads and the dashboard remains accessible. Only `interntrack_access_token` is saved for authentication in sessionStorage, with no password or JWT in localStorage.
6. Open the Student Workspace avatar menu and choose Sign out. Confirm redirect to `/interntrack/login`, removal of the saved token, and no previous application data displayed.
7. Visit `http://localhost:5173/interntrack/applications` after logout. Confirm redirect to login. To check invalid-session cleanup, set `interntrack_access_token` in browser sessionStorage to fictional text such as `invalid-test-token`, then refresh a private route; it must clear the token and stay unauthenticated.

Validation commands: `npm test`, `npm run test:integration`, `npm --prefix server test`, `npm run test:smoke`, `npm run lint`, `npm run build`. Auth tests cover token-only storage, verified restoration, safe loading, logout, account changes and late responses, guarded routes, basename links, 401 cleanup, and production Bearer headers. Real API tests use disposable MongoDB only.


### Feature 12: forgot password and secure reset

- `POST /api/auth/forgot-password` accepts `{ "email": "user@example.com" }`.
  Valid known and unknown addresses receive HTTP 200 with the identical message:
  "If an account exists for that email, password reset instructions have been sent."
  Email is trimmed/lowercased. Invalid email syntax receives a safe 400.
- `POST /api/auth/reset-password` accepts only `{ "token": "<temporary-token>", "newPassword": "<new-password>" }`.
  Success returns a message and requires explicit login. Invalid, expired, replaced,
  or consumed tokens return a generic 400. User IDs and extra fields are rejected.
- Tokens use `crypto.randomBytes(32)` (256 bits), encoded as 64 hex characters.
  Only SHA-256 hashes and expiry dates are persisted; expiry is centralized in
  `RESET_TTL_MS` (15 minutes). A new request replaces the previous token.
  Reset uses the existing bcrypt save hook and a conditional atomic write so
  concurrent requests cannot consume the same token twice. Success clears both fields.
- Reset fields have `select: false` and are removed by User JSON serialization.
  Public auth responses allowlist user fields. Tokens never enter browser storage,
  AuthContext, or normal logs. The reset URL query is removed on success.
- Public React Router routes `/forgot-password` and `/reset-password?token=...`
  honor the existing Vite basename. Login includes a Forgot password link.
- Password policy remains at least 8 characters, nonblank, at most 72 UTF-8 bytes.
  Backend registration/change/reset share validation; the reset UI reuses change validation.
- Production email delivery is intentionally unimplemented. The delivery service is
  a no-op outside tests; the generic response does not mean an email was actually sent.
  This is a foundation, not a working production email recovery service.
  No SMTP/provider integration is included.
- Automated tests set `NODE_ENV=test` and call `setTestResetCapture(callback)` from
  `server/src/services/passwordResetDelivery.js`. The callback receives `{ email, token,
  expiresAt }` in memory. Configuration throws outside test mode; delivery checks test
  mode again at invocation. There is no HTTP token-capture endpoint or token logging.

Manual testing (use a disposable local database/account):

1. Configure the existing server `.env` and frontend `.env` as described above.
   Start the API from `server` with
   `node --inspect --env-file-if-exists=.env src/server.js`, and run `npm run dev`
   from the project root. Open the Vite URL with its configured basename.
2. Register a disposable account, then open Login and choose Forgot password.
   Submit an empty email and an invalid email; validation should prevent requests.
3. Attach your local JavaScript debugger to the API. Set a breakpoint inside
   `deliver(details)` in `server/src/services/testTokenDelivery.js` (the shared
   delivery implementation used by `passwordResetDelivery.js`).
   Submit the registered email with uppercase letters and surrounding spaces.
   At the breakpoint inspect `details.token` in debugger memory, then resume.
   Do not paste the token into logs, source control, or shared screenshots.
4. Confirm the generic success message. Submit an unknown address and verify the
   identical response/status/message and no delivery breakpoint for that address.
5. Open the Vite app's `reset-password?token=<value from debugger>` URL under the
   configured basename. Check empty fields, a short password, and mismatched
   confirmation. Check each Show/Hide button independently.
6. Enter a valid matching new password and submit. While pending, controls should
   be disabled. Success removes the form and query token and links back to Login.
   Login with the old password must fail; the new password must succeed.
7. Reopen the consumed link; submitting must fail with the generic invalid/expired
   message. Request two new links; the first must fail and the latest must work.
   Wait 15 minutes with an unused link and verify it expires. A missing token URL
   must show a safe message and link to request another reset.
8. In browser DevTools verify reset requests include only token/newPassword and no
   confirmation/userId, and neither localStorage nor sessionStorage contains a reset
   token. Normal API user JSON must contain no password/reset fields.
9. Run `npm test`, `npm run test:integration`, `npm --prefix server test`,
   `npm run test:smoke`, `npm run lint`, `npm run build`, and `git diff --check`.
   Smoke tests run against disposable MongoDB and exercise the full real reset UI/API.


### Feature 13: email verification foundation

New accounts start with `emailVerified: false`. Registration, login, current-user,
and profile-update responses all expose the safe user contract:
`{ id, name, email, emailVerified }`. Unverified users may still log in and use
all existing workspace features. No verification enforcement is introduced here.

**Existing records:** missing verification state is treated as false via the model
and safe user serializer. No bulk migration, automatic verification, destructive
rewrite, or login restriction is applied. Existing accounts can request a token
from Profile; reading/login does not write a migration into the database.

- Registration creates a 256-bit verification token with Node `crypto.randomBytes(32)`.
  Only its SHA-256 hash (`emailVerificationTokenHash`) and date
  (`emailVerificationExpiresAt`) are persisted. Expiry is centralized in
  `VERIFICATION_TTL_MS`, currently **24 hours**.
- `POST /api/auth/verify-email` is public and accepts only
  `{ "token": "<temporary-verification-token>" }`. An atomic conditional write
  matches an unverified account with the hash and future expiry, marks it verified,
  and clears both token fields. Success: `{ "message": "Email verified successfully." }`.
  Invalid/expired/replaced/used links receive the same safe HTTP 400 message:
  "Email verification link is invalid or has expired."
- `POST /api/auth/resend-verification` requires the existing Bearer JWT and an empty
  JSON body `{}`. Identity comes only from `req.auth.userId`; body fields (including
  userId) are rejected. Unverified accounts receive a fresh hash and 24-hour expiry,
  invalidating the previous token. Success says "Verification instructions have been
  requested." Already verified accounts receive "Your email is already verified."
  without creating or delivering a token. Deleted/invalid sessions receive 401.
- Profile PATCH continues to allowlist name/email. Direct verification fields cannot
  be written by clients (unsupported-only requests receive 400; extra fields beside
  valid profile updates are ignored, as in earlier features).
- A changed normalized email atomically becomes unverified and receives a replacement
  verification hash/expiry delivered for the new email. Name-only edits and the same
  normalized email preserve status and token. Duplicate-email errors leave the account
  untouched. Conditional email matching handles concurrent profile/verification edits.
- Hidden token fields are excluded from normal model queries and JSON serialization.
  Public responses never contain the raw token, hash, expiry, password hash, or secrets.
- Profile displays Verified / Not verified and offers Resend Verification when needed,
  with pending/duplicate-submit protection and safe feedback.
- Public React Router route `/verify-email?token=...` uses the existing Vite basename.
  It shows missing/invalid/verifying/success states, consumes a token automatically,
  and avoids duplicate effect requests under React StrictMode. It clears the query
  on success and links to Profile or Login. No token enters browser storage or AuthContext.
- AuthProvider's `refreshCurrentUser()` refetches the safe `/me` endpoint after verification
  in an active session; AuthContext remains the user-state source of truth. Late refresh
  results cannot resurrect a logged-out or replaced session. A failed refresh offers a
  safe retry without a browser reload. Session restoration always obtains status from `/me`.
- Production email is intentionally **not implemented**. The delivery seam is a no-op
  outside tests; no email is actually sent. Feature 12 and verification share
  `createTokenDelivery()`. Under `NODE_ENV=test`, automated tests call
  `setTestVerificationCapture(callback)` to inspect `{ email, token, expiresAt }` in memory.
  Setter and delivery both enforce test mode. There is no capture HTTP endpoint or normal
  token logging, and no SMTP/Gmail/SendGrid/SES integration.

Manual testing for Feature 13 (use a disposable local account/database):

1. Configure the existing server `.env` and frontend `.env`. From `server`, run
   `node --inspect --env-file-if-exists=.env src/server.js`. From the project root,
   run `npm run dev`. Open the Vite URL under its configured basename (normally
   `http://localhost:5173/interntrack/`).
2. Attach a local JavaScript debugger to the Node process. In
   `server/src/services/testTokenDelivery.js`, set a breakpoint in `deliver(details)`.
   The callback is a no-op during normal development; debugger inspection allows
   local manual testing without adding token logging or a public capture endpoint.
3. Register a new disposable account. At the verification delivery breakpoint,
   inspect `details.email`, `details.token`, and `details.expiresAt`, then resume.
   Keep the token only temporarily for constructing the local link. Registration
   must return emailVerified=false without any token/hash/expiry in the response.
4. Log in before verifying. All existing workspace features must remain accessible.
   Open Profile: status is Not verified and Resend Verification is available.
5. Click Resend Verification; inspect the new token in the debugger and resume.
   Verify the pending button prevents repeat clicks. The success message contains
   no token. Open the earlier registration link under
   `<Vite base URL>verify-email?token=<earlier token>`: it must fail safely.
6. Open `<Vite base URL>verify-email?token=<latest token>` in the same authenticated
   browser. Observe verifying then success; the query is removed. Choose Back to
   profile: status is Verified and resend is absent, without a whole-browser reload.
   Reload Profile to confirm `/me` restores Verified.
7. Reopen the consumed link: it must return the generic invalid/expired message.
   Open `/verify-email` under the basename without a token: it must show the safe
   missing-token message without making a verification request.
8. Change only the profile name: Verified remains. Submit the same email with
   different case/outer spaces: Verified remains and no new delivery occurs.
   Change to a different email: Not verified returns, a new delivery targets the
   new address, and the old token cannot verify it. Verify the newest token again.
9. For expiry, request another token for an unverified account and wait 24 hours,
   or use disposable MongoDB tests below to exercise expiry without waiting.
   The expired token must receive the same generic invalid/expired response.
10. Inspect browser requests/storage: verification sends only token, resend sends
    `{}` with the current Bearer JWT, and token values never enter localStorage,
    sessionStorage, or AuthContext. PATCH `{ "emailVerified": true }` must fail;
    adding that field to a valid name edit must not verify the account.
11. To test safe errors, stop the local API and try resend on an unverified Profile;
    show a connection message without diagnostics. Restart it and retry. Existing
    login/register/profile/password-change/password-reset flows should still work.
12. Run `npm test`, `npm run test:integration`, `npm --prefix server test`,
    `npm run test:smoke`, `npm run lint`, `npm run build`, and `git diff --check`.
    Backend/smoke suites use disposable MongoDB and test-only in-memory delivery.


### Feature 14: secure account deletion

`DELETE /api/auth/me` requires the existing `Authorization: Bearer <accessToken>`
header, `Content-Type: application/json`, and exactly:

```json
{ "currentPassword": "<current-password>" }
```

The account identity comes exclusively from verified `req.auth.userId`. Unknown
body fields, including userId/id/email/reset/verification fields, receive HTTP 400.
The current password is required and verified against the stored bcrypt hash without
trimming; bcrypt truncation matches are rejected. Wrong passwords receive the safe
400 message "Current password is incorrect." Missing/deleted/invalid sessions receive
401. Successful deletion returns only `{ "message": "Account deleted successfully." }`.
No deleted user, password, hash, reset/verification token, or secret is returned.

Deletion is permanent. All applications matching the existing `owner` field for the
JWT user are removed, followed by their login activity and then the user. Other users, their applications,
and unrelated ownerless legacy records remain untouched. Reset/verification state
disappears with the user. Login and `/me` reject the deleted account. Application
routes now check that the JWT's user still exists, so a cryptographically unexpired
old token cannot list/create/read/update/delete applications after deletion.

**Consistency strategy:** the existing development/test setup uses standalone MongoDB,
so this feature does not require replica sets or introduce transactions. A small
per-account in-process queue serializes deletion, application operations and login
activity recording/queries in the
current single Node API process. An operation already running finishes before deletion
and its data is included in cleanup; operations waiting behind successful deletion
recheck user existence and receive 401. Other accounts are not blocked. Queue entries
are released on failures and discarded when idle.

Application cleanup runs before user deletion. If cleanup throws, user deletion is
not attempted and success is not returned. If the final user removal fails, the account
is retained but application data may already have been deleted. A concurrent password
change/reset is checked by matching the previously verified password hash in the final
user delete; a mismatch returns 409 and retains the account, with the same possible
partial application cleanup. The operation can be retried with the current password.
There is no rollback guarantee on standalone MongoDB, and a process crash between
steps can leave a retained account with fewer applications. The queue coordinates this
single API process only; it does not protect multiple API workers or direct database
writers. Before scaling to multiple writers, use a database-level transactional strategy
that coordinates application creation with deletion. No soft-delete or recovery state
is added here.

Profile now has a separate Danger Zone. The first Delete Account click only opens an
explicit warning/confirmation form with Current Password, accessible Show/Hide, a final
Delete Account action and Cancel. Cancel makes no request and clears the field. Required
validation blocks blank passwords. Pending deletion disables its controls and other
Profile account/password/verification controls and prevents duplicate submissions.

`authService.deleteAccount(accessToken, currentPassword)` owns the HTTP contract and
sanitizes errors. AuthProvider's deleteAccount action calls the service and reuses logout
only after confirmed success. This removes the sessionStorage JWT, clears user/auth
state, unmounts and clears the private ApplicationProvider, and redirects to the existing
public Login route without reloading the browser. A stale deletion response cannot log
out a newer session. Wrong-password/network/server failures preserve the current frontend
user and application state; matching 401 responses use normal expired-session cleanup.
A network failure after the server commits can leave an uncertain result: no success is
claimed; the next authenticated account check will reject an already deleted account.

Manual testing (use only disposable local accounts and applications):

1. Configure the existing server/frontend `.env` files and a local test database.
   From the project root run `npm --prefix server run dev` in one terminal and
   `npm run dev` in another. Open the Vite URL under its configured basename,
   normally `http://localhost:5173/interntrack/`.
2. In the main browser, register/log in as disposable User A and create applications
   A1 and A2. In a separate private browser session, register/log in as disposable
   User B and create B1. Confirm each account sees only its own records.
3. In A's session open Profile. Confirm existing profile edit, password change, and
   email verification controls remain present. Scroll to Danger Zone. Click Delete
   Account once: a permanent-deletion warning and confirmation form should open,
   with no DELETE request in browser Network tools.
4. Submit without a password: required feedback appears and no DELETE request is
   sent. Use Show/Hide: the control changes its accessible label/input type without
   submitting. Type a value and click Cancel: no DELETE request occurs. Reopen and
   confirm the password is empty and hidden again.
5. Enter an incorrect password and submit. Expect safe wrong-password feedback,
   continued authentication, and unchanged A1/A2 on Applications. Return to Profile.
   Stop the API and try again to check safe connection feedback without logging out
   or clearing the currently loaded application state; restart the API afterward.
6. Optional old-JWT check: before deletion, in browser DevTools Console assign
   `const deletionTestJwt = sessionStorage.getItem('interntrack_access_token')`.
   Keep this value only in that local console's memory; do not print or share it.
7. Return to Danger Zone and submit A's exact current password. Inspect Network:
   DELETE `/api/auth/me` sends only currentPassword and the Bearer header. While it
   is pending, the form and conflicting Profile controls are disabled. Slow the
   request with DevTools throttling if needed to inspect duplicate-submit protection.
8. On success the app goes to Login under the basename without a browser refresh;
   A's profile/applications disappear, and sessionStorage no longer contains the JWT.
   Network response must contain only the fixed success message. Attempting login
   with A's former credentials must fail.
9. For the optional old-JWT check, after deletion run the following local console
   expression (adjust the API origin if configured differently):
   `await fetch('http://localhost:5000/api/auth/me', { headers: { Authorization: 'Bearer ' + deletionTestJwt } }).then(response => response.status)`.
   It must return 401 without printing the token. The same old header on GET/POST
   `/api/applications` must also receive 401 and must not create any data.
10. In B's separate session reload Applications: B1 remains, Profile still exists,
    and B can log out and back in. Log B into the main session as well and confirm
    no stale A1/A2 data appears. In the disposable database verify A/A1/A2 are gone,
    while B/B1 remain. Do not run these destructive checks against real user data.
11. Run `npm test`, `npm run test:integration`, `npm --prefix server test`,
    `npm run test:smoke`, `npm run lint`, `npm run build`, and `git diff --check`.
    Backend tests exercise cleanup/final-delete failures, retries and concurrency
    using disposable MongoDB; the smoke test covers real UI/API two-user isolation.


### Feature 15: login activity / security history

Successful credential logins now create a `LoginActivity` record. This is a separate
one-to-many collection with `user` (required ObjectId reference to User), server
`loggedInAt`, `ipAddress`, and `userAgent`. A compound index on
`{ user: 1, loggedInAt: -1, _id: -1 }` supports each user's newest records with stable
ordering when timestamps tie. Registration, `/me` restoration, failed passwords,
unknown emails, and failed authentication configuration do not create successful-login
history. The existing successful login response stays `{ user, accessToken }`.

Metadata is deliberately limited:

- IP comes from Express `req.ip`, validated as IPv4/IPv6. The existing default
  `trust proxy=false` remains; arbitrary `X-Forwarded-For` headers and JSON ipAddress
  fields are not trusted. Behind an unconfigured proxy this may be the proxy IP,
  rather than an originating client address. Missing/invalid IP becomes an empty value.
- User-Agent comes only from the HTTP header, with control characters replaced and
  a maximum of 512 characters. JSON userAgent/device/identity fields are not used.
- No password, JWT, cookie, Authorization header, reset/verification token/hash,
  unrelated headers, GPS, advertising identifier, geolocation or fingerprint is
  collected in these records. IP/User-Agent remain untrusted metadata, not proof
  of device identity, a person's identity, or exact physical location.

**Best-effort recording:** after credentials and JWT configuration succeed, the login
flow awaits an attempt to create the record. Audit errors are caught separately and
emit only the fixed warning "Login activity could not be recorded." without error
objects, request metadata or secrets. A temporary audit-write failure still returns
normal successful login; failed authentication keeps its existing safe failure behavior.
There is no automatic retry, background queue, failed-login tracking or security alerting.
The write attempt may add database latency; this is not a claim of guaranteed delivery.

`GET /api/auth/login-activity` requires the existing Bearer JWT and an existing account.
Ownership comes only from `req.auth.userId`; query/body user IDs and client limits cannot
select other accounts or increase the bound. It returns:

```json
{
  "activities": [
    {
      "id": "<activity-id>",
      "loggedInAt": "<ISO-date-time>",
      "ipAddress": "<request-IP-or-empty>",
      "userAgent": "<bounded-reported-agent-or-empty>"
    }
  ]
}
```

The response is newest first, with `_id` descending as a tie-breaker, and capped by
`RECENT_LOGIN_ACTIVITY_LIMIT` (currently **20**). Each item has only these four safe
fields; it does not expose its User ObjectId or user security fields. An account with
no recorded successful logins receives `{ "activities": [] }`. Invalid/deleted sessions
receive 401, and unexpected failures use the existing safe generic error contract.
The cap limits the query/response, not total persisted retention: records are retained
until account deletion; no TTL purge or pagination is introduced by this feature.

**Account deletion:** Feature 14 now cleans Application.owner records, then LoginActivity.user
records, then the User. Every filter uses the verified JWT identity. If history cleanup
fails, the user is retained and success is not reported, but preceding application cleanup
may already have completed. If final user deletion fails or the verified password changes,
prior application/history cleanup is not rolled back. Retry remains possible. Recording,
activity queries, deletion and application operations share the existing per-account queue:
recording already running finishes before cleanup; recording waiting behind deletion
rechecks existence and cannot recreate history. A deleted user's old JWT cannot fetch
history. The same standalone-MongoDB limitations apply: no multi-document rollback and
coordination only within the current single API process. Multiple writers/workers need
an appropriate database-level strategy before scaling; no distributed machinery is added.

Profile/Security now includes **Recent Login Activity**, with local date/time, a conservative
browser/platform label and IP or Unavailable. A small dependency-free helper recognizes
common Chrome, Firefox, Safari, Edge and Opera/platform hints and falls back to
Unknown browser/device. Raw user-agent strings are not rendered as markup or as authoritative
identity. The panel has loading, empty, friendly error/retry and Refresh states, prevents
duplicate pending requests (including StrictMode effect replay), and does not poll.
History failure does not disable account/profile/password features. Matching 401s use the
existing expired-session cleanup.

`authService.getLoginActivity(accessToken)` owns HTTP and safe response/error mapping.
History lives only in the panel's request/component state, keyed to user/session, never
localStorage/sessionStorage or AuthContext. Logout/account deletion unmount the panel;
late results cannot populate a new account. AuthContext remains the existing user/session
source of truth and routing keeps the Vite basename.

Manual testing (use disposable local accounts/data):

1. Start the configured local MongoDB/API with `npm --prefix server run dev` and Vite
   with `npm run dev` from the repository root. Open the printed Vite URL under the
   configured basename, normally `http://localhost:5173/interntrack/`.
2. Register a disposable User A, then log in. Open Profile and locate Recent Login
   Activity below Security. A successful login should show its date/time, a browser
   label (or conservative fallback), and request IP. In local development, a loopback
   IP is expected. It is not a physical location.
3. In browser Network tools inspect GET `/api/auth/login-activity`: it must use the
   current Bearer JWT. Each returned item must contain only id/loggedInAt/ipAddress/
   userAgent, ordered newest first, with at most 20 items. Do not print/share the JWT.
4. Sign out, attempt login with an incorrect password, then log in correctly. Open
   Profile again: only the successful login added an entry. Reloading the page or
   selecting Refresh must not itself create a login record.
5. Choose Refresh. With network throttling enabled, confirm the loading message and
   disabled Refresh button prevent duplicate pending requests. The panel should keep
   server order. No requests should repeat continuously while idle.
6. Stop the API while Profile remains open, then choose Refresh. Expect a friendly
   error and Retry, without diagnostic details or loss of current profile/account
   controls. Restart the API, choose Retry and confirm history returns.
7. For an empty state, use a disposable account that predates recording, or clear only
   that account's LoginActivity documents in the disposable database; choose Refresh
   and confirm "No login activity available." Automated tests cover the same case.
8. In a separate private browser session create/log in as User B. Compare Profile
   activity: A and B must see only their own entries. To test query spoofing in A's
   local console without printing the JWT, use the following with B's disposable ID:
   `await fetch('http://localhost:5000/api/auth/login-activity?userId=<B-id>&limit=99999', { headers: { Authorization: 'Bearer ' + sessionStorage.getItem('interntrack_access_token') } }).then(response => response.json())`.
   It must return only A's bounded history. GET-body spoofing is also tested over real
   HTTP by the backend suite, since browser fetch prohibits GET bodies.
9. Confirm browser storage contains no activity list, loggedInAt, IP or user-agent
   fields. Only the existing session JWT should be stored for authentication. Sign
   out: the history panel and its private metadata must disappear. Log B into the
   same tab: A's history must never reappear, even if a prior request finishes late.
10. Delete disposable A using the Feature 14 confirmation flow. In the disposable
    database confirm A's history and applications are gone while B's remain. A's old
    JWT must receive 401 from the activity endpoint (use the in-memory old-JWT method
    documented in Feature 14). Do not run destructive checks against real user data.
11. Run `npm test`, `npm run test:integration`, `npm --prefix server test`,
    `npm run test:smoke`, `npm run lint`, `npm run build`, and `git diff --check`.
    Automated suites exercise the 20-record cap, safe metadata, audit-write failure,
    deleted-account races, UI privacy and prior feature regressions with disposable data.
