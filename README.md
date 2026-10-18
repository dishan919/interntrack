# InternTrack

## User profile (Feature 09/60)

Authenticated users can view their name and email on the protected `/profile` route (`/interntrack/profile` with the configured Vite base). Open **Profile** in the Student Workspace account menu. The page reads the verified user from AuthContext and reuses its existing Sign out action. Refresh restores the session through AuthProvider; Profile makes no additional `/api/auth/me` request. Logged-out visitors are redirected to login. Profile editing is not implemented yet.

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
