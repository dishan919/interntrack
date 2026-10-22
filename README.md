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
Outside production, CORS allows exactly `http://localhost:5173` and
`http://127.0.0.1:5173`. Set `CLIENT_ORIGIN` to additionally allow your frontend
origin, for example `CLIENT_ORIGIN=https://example.com`.
With `NODE_ENV=production`, only the configured `CLIENT_ORIGIN` is allowed;
an empty value grants no browser origin access. Requests without an Origin
header continue normally, and CORS does not replace API authentication.
Use an exact HTTP/HTTPS origin with no trailing slash, path, credentials, query,
or fragment. Invalid nonempty configuration prevents startup with a safe error.
Restart the backend after changing this setting. No wildcard origins are allowed.

## Run the local Docker stack

Requires Docker Engine/Desktop running Linux containers and Docker Compose v2.
This uses production-built frontend/backend images locally; source changes need
an image rebuild. The native `npm run dev` workflow above remains available.

```powershell
Copy-Item .env.docker.example .env.docker
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Paste the generated value into `JWT_SECRET` in `.env.docker`. This file is ignored
by Git and both image contexts. Never put secrets in `VITE_*` values: those become
public browser code. Use `--env-file .env.docker` on every Compose command to keep
this configuration separate from the native Vite `.env`.

```powershell
docker compose --env-file .env.docker config --quiet
docker compose --env-file .env.docker build --pull
docker compose --env-file .env.docker up -d --wait
docker compose --env-file .env.docker ps
```

Open **http://localhost:8080/interntrack/**. Nginx serves SPA routes and proxies
`/api` to `backend:5000`; Express connects to `mongo:27017`. Only the frontend
publishes a host port, bound to loopback. The API health URL is
**http://localhost:8080/api/health**. Keep `CLIENT_ORIGIN` consistent with the exact
browser origin if changing the port/hostname; existing production CORS stays on.
`VITE_API_URL=/api` is a build-time value, so changing it requires rebuilding the
frontend image. Do not set it to Docker's internal `backend` hostname in a browser.

```powershell
Invoke-RestMethod http://localhost:8080/api/health
Invoke-WebRequest http://localhost:8080/interntrack/profile -UseBasicParsing
docker compose --env-file .env.docker logs --tail=50
docker compose --env-file .env.docker down
```

Normal `down` keeps the named MongoDB and profile-photo volumes. Do not add `-v`
for normal shutdown. These volumes start empty: native host data/photos are not
copied into the images. The local Mongo service is isolated and unauthenticated;
this Compose configuration is a local learning setup, not an internet deployment.
The backend image also supports the existing environment variables `NODE_ENV`,
`PORT`, `MONGODB_URI`, `JWT_SECRET`, and `CLIENT_ORIGIN`; Compose fixes production
mode and internal port 5000 to match its proxy.

See [DOCKER_ARCHITECTURE_REPORT.md](DOCKER_ARCHITECTURE_REPORT.md) for the beginner
architecture guide, verification commands, persistence details and validation limits.

## Environment variables

| File | Variable | Purpose |
| --- | --- | --- |
| `.env` | `VITE_API_URL` | API base URL; defaults to `http://localhost:5000/api` |
| `server/.env` | `MONGODB_URI` | Required MongoDB connection string |
| `server/.env` | `JWT_SECRET` | Required secret for signing and verifying JWTs |
| `server/.env` | `PORT` | Optional API port; defaults to `5000` |
| `server/.env` | `CLIENT_ORIGIN` | Optional exact frontend origin; required for browser access in production |

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
