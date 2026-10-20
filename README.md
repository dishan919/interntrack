# InternTrack

InternTrack is a full-stack web application for organizing internship and job
applications. It brings application tracking, interviews, deadlines, and account
management into one personal workspace, with data stored in MongoDB.

## Tech stack

- **Frontend:** React 19, JavaScript, Vite, React Router, Context API, CSS.
- **Backend:** Node.js, Express 5, Mongoose, MongoDB.
- **Authentication:** JWT access tokens and bcrypt password hashing.
- **Testing:** Node.js test runner, JSDOM, mongodb-memory-server, ESLint.

## Main features

- Create, view, edit, and delete applications with account-based ownership.
- Track Saved, Applied, Interview, Offer, and Rejected statuses.
- Search and filter applications; switch between list and Kanban board views.
- Move applications between statuses with drag and drop.
- Manage application deadlines, interview details, and follow-up reminders.
- Track skills, document checklists, notes, and application activity.
- View dashboard summaries, company groups, and application statistics.
- Export applications as JSON and explicitly import legacy browser records.
- Register, sign in, restore sessions, and sign out of protected pages.
- View/edit a profile, change a password, and delete an account.
- View the latest 20 successful logins in the profile security panel.
- Password reset and email verification flows with test-only token delivery.

Email delivery is not connected to a provider yet. Reset and verification tokens
are captured only by automated tests; ordinary local use does not send emails.

## Simple architecture

```text
React pages and components
        |
Auth / Application Context -> HTTP services
        |
Express routes -> authentication -> controllers
        |
Mongoose models -> MongoDB
```

The frontend (`src/`) and backend (`server/src/`) run separately.
MongoDB stores users, applications, and login activity. Application API requests
use a Bearer JWT, and each user accesses their own application records.

## Local setup

Requires **Node.js 22.12+**, npm, and a running MongoDB instance.
Run these PowerShell commands from the project root.

1. Install dependencies and copy the environment templates:

   ```powershell
   npm install
   npm --prefix server install
   Copy-Item .env.example .env
   Copy-Item server/.env.example server/.env
   ```

2. Set `MONGODB_URI` and replace the `JWT_SECRET` placeholder in `server/.env`.
   Ensure MongoDB is running before starting the API.

3. Start the backend in one terminal:

   ```powershell
   cd server
   npm run dev
   ```

4. Start the frontend in another terminal, from the project root:

   ```powershell
   npm run dev
   ```

Open **http://localhost:5173/interntrack/**, or the URL printed by Vite with
`/interntrack/` appended. The API defaults to **http://localhost:5000/api**.
The current CORS configuration allows frontend origins on port 5173.

## Environment variables

| File | Variable | Purpose |
| --- | --- | --- |
| `.env` | `VITE_API_URL` | API base URL; defaults to `http://localhost:5000/api` |
| `server/.env` | `MONGODB_URI` | Required MongoDB connection string |
| `server/.env` | `JWT_SECRET` | Required secret for signing and verifying JWTs |
| `server/.env` | `PORT` | Optional API port; defaults to `5000` |

Use your own local values. Real `.env` files are ignored; never commit secrets.
Restart the relevant development server after changing its environment file.

## Important API endpoints

All paths below include the `/api` prefix.
Protected endpoints require `Authorization: Bearer <accessToken>`.

| Method | Endpoint | Purpose | Access |
| --- | --- | --- | --- |
| GET | `/api/health` | API health check | Public |
| POST | `/api/auth/register` | Create an account | Public |
| POST | `/api/auth/login` | Sign in and receive an access token | Public |
| GET / PATCH / DELETE | `/api/auth/me` | Read, edit, or delete your account | Protected |
| PATCH | `/api/auth/password` | Change your password | Protected |
| POST | `/api/auth/forgot-password` | Request password reset | Public |
| POST | `/api/auth/reset-password` | Reset password with a token | Public |
| POST | `/api/auth/verify-email` | Verify email with a token | Public |
| POST | `/api/auth/resend-verification` | Request verification again | Protected |
| GET | `/api/auth/login-activity` | Read recent successful logins | Protected |
| GET / POST | `/api/applications` | List or create applications | Protected |
| GET / PUT / DELETE | `/api/applications/:id` | Read, replace, or delete an application | Protected |

## Testing overview

Run these commands from the project root:

```powershell
npm test
npm run test:integration
npm --prefix server test
npm run test:smoke
npm run lint
npm run build
```

Tests cover application utilities, React integration, authentication, account
management, ownership isolation, persistence, and a real UI-to-API smoke flow.
Backend and smoke tests use disposable MongoDB instances; the first run may
need network access to download a MongoDB binary.
Use `npm run preview` to preview the frontend production build locally.

## Feature progress

**15/60 planned features completed (25%).** The numbered milestone covers
registration/login APIs and UI, JWT authentication, protected application routes,
per-user ownership, session management, profile viewing/editing, password change,
password reset, email verification, account deletion, and login activity.
Email delivery remains a foundation with test-only integration, as noted above.

## Author

Built by [@dishan919](https://github.com/dishan919).
Source: [dishan919/interntrack](https://github.com/dishan919/interntrack).
