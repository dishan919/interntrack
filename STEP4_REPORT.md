Step 4 is complete. No authentication, deployment, or GitHub push was performed.

**Architecture and persistence**

React component -> ApplicationContext -> applicationService (fetch) -> Express REST API -> MongoDB.

The service provides getApplications, getApplication, createApplication, updateApplication, and deleteApplication. VITE_API_URL is configured in the new frontend .env.example, with one centralized development fallback. No component calls fetch. No real .env files were created or committed.

Context loads applications asynchronously, serializes mutations, merges partial UI edits into the latest confirmed record, and sends a complete PUT payload to the existing replacement endpoint. React state uses the server response after successful writes. Add/Edit/Delete navigation waits for success. Existing deadline, interview, skills, document, activity, follow-up and unknown metadata survive API persistence. Document checkbox edits also retain unknown document metadata.

**Browser storage**

Application CRUD no longer reads or writes localStorage and no longer seeds sample applications. Preferences are preserved. Settings offers an explicit one-time import of the old interntrack_applications backup. Imported records retain legacyBrowserId for retry deduplication; a separate completion marker prevents repeated imports. The original backup remains untouched. Import requires valid IDs/company/position; use one tab at a time. A partial failure can be retried, skipping already imported IDs. Settings export and clear now operate on API records.

**Loading and errors**

The shared layout gates application pages during initial loading, shows safe errors and a retry control, and reports pending writes. Failed writes preserve confirmed state and keep Add/Edit forms open. Backend details and stack traces are never displayed. Tests cover network outages, non-2xx responses, malformed JSON, failed CRUD, loading and retry.

**Backend schema**

No backend production code or schema changes were needed. The existing flexible Mongoose schema already retains nested/optional JSON metadata; a new backend regression test exercises the frontend service through Express and real disposable MongoDB.

**Validation**

- Frontend unit tests: 63 passed.
- Frontend integration tests: 7 suites passed, including the existing deadline/interview/skills/search/board/drag-handler coverage and new async API checks.
- Backend tests: 44 passed; all use isolated resources rather than a personal MongoDB database.
- ESLint: passed with no errors or warnings.
- Production build: passed.
- Automated UI smoke: passed create -> refresh -> edit -> refresh -> Kanban status -> refresh -> delete -> refresh through real React DOM, Express, and disposable MongoDB. This uses jsdom, not a real-browser pointer session. Test resources are stopped automatically.
- Git whitespace check: passed.

**Run locally**

Install/start MongoDB Community Server first. If it is installed as a Windows service, run Start-Service MongoDB from an administrator PowerShell. Alternative mongod startup instructions are in README.md.

Backend terminal:

```powershell
cd 'C:\Users\Cyborg\OneDrive\Desktop\Intern Track\interntrack\server'
npm install
if (!(Test-Path .env)) { Copy-Item .env.example .env }
# Set MONGODB_URI in server/.env to your MongoDB connection.
npm run dev
```

Frontend terminal:

```powershell
cd 'C:\Users\Cyborg\OneDrive\Desktop\Intern Track\interntrack'
npm install
if (!(Test-Path .env)) { Copy-Item .env.example .env }
# Default: VITE_API_URL=http://localhost:5000/api
npm run dev
```

Open the Vite URL, normally http://localhost:5173. Backend defaults to port 5000. Restart Vite after changing VITE_API_URL.

Validation commands from interntrack/:

```powershell
npm test
npm run test:integration
npm run test:smoke
npm --prefix server test
npm run lint
npm run build
```

**Files created**

- .env.example
- tests/apiIntegration.jsx
- tests/apiMock.js
- tests/applicationService.test.js
- tests/contextHarness.jsx
- tests/run-smoke.mjs
- STEP4_REPORT.md

**Files modified**

- .gitignore
- README.md
- package-lock.json
- package.json
- server/tests/applications.test.js
- src/components/applications/ApplicationForm.jsx
- src/components/applications/DocumentsChecklist.jsx
- src/components/applications/FollowUpReminder.jsx
- src/components/applications/KanbanBoard.jsx
- src/components/layout/Layout.jsx
- src/context/ApplicationProvider.jsx
- src/pages/AddApplication.jsx
- src/pages/ApplicationDetails.jsx
- src/pages/EditApplication.jsx
- src/pages/Settings.jsx
- src/services/applicationService.js
- src/utils/documentUtils.js
- src/utils/followUpUtils.js
- src/utils/kanbanUtils.js
- tests/activity.test.js
- tests/deadlineIntegration.jsx
- tests/deadlines.test.js
- tests/documents.test.js
- tests/followUps.test.js
- tests/interviewIntegration.jsx
- tests/interviews.test.js
- tests/kanbanDragIntegration.jsx
- tests/kanbanIntegration.jsx
- tests/kanbanMove.test.js
- tests/run-integration.mjs
- tests/searchIntegration.jsx
- tests/skillIntegration.jsx
- tests/skills.test.js
- tests/viewPreference.test.js
