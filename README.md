# InternTrack

A beginner-friendly React application for tracking internship and job applications. Uses Vite, JavaScript, React Router, Context API, CSS, and browser localStorage. An independent Express backend provides a health check only; there is no authentication.

## Run locally

Requires Node.js 22.12+ (or 20.19+) and npm.

1. Open a terminal in this folder.
2. Run npm install.
3. Run npm run dev.
4. Open the local URL printed by Vite (usually http://localhost:5173).

Run npm run lint for ESLint. Run npm run build for a production build. Run npm run preview to preview the built app locally.

## Backend foundation

The frontend and backend run independently. Application persistence still uses browser localStorage; the frontend does not call the backend.

In a separate terminal, from this repository folder:

```powershell
cd server
npm install
Copy-Item .env.example .env
npm run dev
```

The backend requires Node.js 22.12+ and uses Node's built-in environment-file loading and watch mode. `npm start` runs without watch mode. `.env` is optional and ignored by Git; `PORT` defaults to `5000`.

Backend URL: http://localhost:5000. GET http://localhost:5000/api/health returns HTTP 200 with `{"status":"ok","message":"InternTrack API is running"}`. Unknown routes return JSON with HTTP 404. CORS allows the default Vite origins http://localhost:5173 and http://127.0.0.1:5173; update the origin list in `server/src/app.js` if using another frontend port.

Run backend checks with `npm test` from `server/`. Run all existing frontend checks from the repository folder:

```powershell
node --test tests/*.test.js
node tests/run-integration.mjs
npm run lint
npm run build
```

The backend lives in `server/src/app.js`, `server/src/server.js`, and `server/src/routes/healthRoutes.js`. It has no database or application CRUD routes.

## Frontend source structure

- src/components/common: shared badges, cards, search, filters, empty states.
- src/components/layout: sidebar, header, and route layout.
- src/components/applications: application rows and shared add/edit form.
- src/pages: all eight pages.
- src/context: application state and mutations.
- src/services/applicationService.js: localStorage reads and writes.
- src/utils/applications.js: statuses, date formatting, counts, and sample data.
- src/styles/global.css: responsive layout and styles.
- src/App.jsx: routes; src/main.jsx: React entry point.

Data is stored under interntrack_applications. Samples appear only when the key does not exist. An empty saved array stays empty after refresh. Mutations save immediately. Settings exports JSON backups and clears data after confirmation. Storage failures show a visible warning. No data is sent to a server.

For production hosting, configure your server to serve index.html for unknown paths so direct links to React Router pages work.

## Application deadlines

Add or edit an application to set its optional Application Deadline. The Applications and Details pages show the date and a calendar-day indicator: days left, Tomorrow, Deadline today, or Expired. Indicators refresh while the page stays open and when the browser window regains focus.

The dashboard shows the closest five deadlines due today or later. Expired deadlines never change application status. Use Deadline: Soonest or Deadline: Latest alongside search and status filters; records without valid deadlines appear last. Clearing a deadline removes its indicator.

Existing records without deadlines continue to work. Missing optional legacy fields receive display defaults in memory; merely loading the app never rewrites existing localStorage data.

Run deadline regression checks:

```powershell
node --test tests/deadlines.test.js
node tests/run-integration.mjs
```

The integration checks use React server rendering and isolated mock storage; they never read or modify your browser's application data.

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

These tests use isolated storage and React server rendering. No test accesses or resets your browser's saved applications.

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
