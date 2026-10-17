# InternTrack

A beginner-friendly React application for tracking internship and job applications. Uses Vite, JavaScript, React Router, Context API, CSS, and a MongoDB-backed Express REST API; there is no authentication.

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

Example PowerShell API flow with the backend running:

```powershell
$base = 'http://localhost:5000/api/applications'
$body = @{ company = 'IFS'; position = 'Software Engineer Intern' } | ConvertTo-Json
$app = Invoke-RestMethod $base -Method Post -ContentType 'application/json' -Body $body
Invoke-RestMethod "$base/$($app.id)"
$body = @{ company = 'IFS'; position = 'Software Engineer Intern'; status = 'Interview' } | ConvertTo-Json
Invoke-RestMethod "$base/$($app.id)" -Method Put -ContentType 'application/json' -Body $body
Invoke-RestMethod "$base/$($app.id)" -Method Delete
Invoke-RestMethod $base
```

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

Applications load asynchronously from the API. The shared layout shows loading feedback before rendering data pages and a safe retry message on failure. Mutations serialize requests, merge edits with the latest server-confirmed record, and publish server responses to React state only after success. Failed add/edit/delete requests retain existing data; forms navigate only on success. PUT sends the complete merged record because the existing endpoint replaces optional fields. Nested and unknown metadata remain intact; the existing flexible Mongoose schema needs no changes.

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
