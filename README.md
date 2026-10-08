# InternTrack

A beginner-friendly React application for tracking internship and job applications. Uses Vite, JavaScript, React Router, Context API, CSS, and browser localStorage. There is no backend or authentication.

## Run locally

Requires Node.js 22.12+ (or 20.19+) and npm.

1. Open a terminal in this folder.
2. Run npm install.
3. Run npm run dev.
4. Open the local URL printed by Vite (usually http://localhost:5173).

Run npm run lint for ESLint. Run npm run build for a production build. Run npm run preview to preview the built app locally.

## Source structure

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
