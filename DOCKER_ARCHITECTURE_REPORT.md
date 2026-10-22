# InternTrack Docker Architecture Report

First DevOps phase, 22 October 2026. This adds a local Compose stack and production-oriented images. It does not add Jenkins, GitHub Actions, AWS, S3, deployment configuration, or a product feature.

## 1. What Docker is

Docker packages an application with the operating-system libraries and runtime it needs, then runs that package in an isolated process environment called a container. It helps developers use a consistent runtime rather than depending on every host having the same Node, Nginx, and MongoDB installation. Containers share the host kernel; they are not complete virtual machines.

This phase uses Linux containers. Windows users need Docker Desktop configured for Linux containers, or another working Linux-container Docker Engine with Compose v2.

## 2. Image vs container

An image is the built, reusable filesystem/runtime template. A container is a running or stopped instance of an image. Rebuilding an image does not automatically update an already-running container; Compose recreates affected containers when applying the new image. Container writable layers are disposable, which is why persistent application data belongs in volumes.

## 3. Dockerfile

A Dockerfile is the recipe for an image. `FROM` chooses a base, `WORKDIR` sets the working directory, `COPY` adds selected files, `RUN` performs build work, `USER` selects the runtime identity, and `CMD` supplies the startup command. `EXPOSE` documents a container port; it does not publish that port to the host.

The frontend uses separate build/runtime stages. The backend separates production dependency installation from its final runtime. Both install from the existing lockfile with `npm ci`. Docker-specific ignore files keep local dependencies, environment files, uploads, Git metadata, coverage and test output out of build contexts.

## 4. Docker Compose

`compose.yaml` defines the three local services, their builds, environment, volumes, health checks, and dependencies. Compose creates their shared network and coordinates startup. This is one application with its database, not a new microservice architecture.

Dependencies use `condition: service_healthy`, rather than treating process creation as readiness. MongoDB must pass its ping check before the backend starts; the backend must pass its HTTP check before the frontend starts. This is startup coordination, not continuous failure recovery or a transactional deployment. [Docker startup-order documentation](https://docs.docker.com/compose/how-tos/startup-order/).

## 5. Container networking

Compose services discover each other by service name on the project network. Nginx reaches `backend:5000`; the backend reaches `mongo:27017`. Docker handles the network addresses, so application configuration does not need fixed container IPs. Nginx uses Docker DNS with a variable upstream so it can resolve a recreated backend's address.

Only `127.0.0.1:8080` is published by default. Neither Express nor MongoDB is published to the host. `EXPOSE 5000` in the backend image is metadata for its internal port, not a host port mapping. [Docker networking documentation](https://docs.docker.com/compose/how-tos/networking/).

## 6. Why localhost differs inside a container

Inside the backend, localhost means that backend container. It does not mean the Mongo container or the developer's computer. Consequently the default Docker connection string is `mongodb://mongo:27017/interntrack`, while the existing native setup can continue using `mongodb://127.0.0.1:27017/interntrack`.

The browser runs outside this container network. It cannot resolve Docker's `backend` hostname. Its API base is `/api`, sent to the same origin serving the frontend; Nginx forwards that request internally. The localhost URLs used in health checks refer deliberately to the service being checked, not to another container.

## 7. Volumes

Named volumes store data outside a container's disposable writable layer:

- `mongo_data` mounts at `/data/db` for database records.
- `profile_photos` mounts at `/app/uploads/profile-photos` for Feature 17 files.

With the default project name, Docker normally names these `interntrack_mongo_data` and `interntrack_profile_photos`. Keep the same Compose project name when returning to existing data. Changing `-p` creates a separate project/volume namespace.

Normal `docker compose down` removes containers/network but keeps these named volumes. Do not use `down -v` during normal shutdown or validation. Database files live in Docker-managed storage outside the repository. Volumes are persistence, not backups; back up MongoDB and photo files together when moving data.

## 8. Environment variables and secrets

Copy `.env.docker.example` to ignored `.env.docker`, then supply your own random `JWT_SECRET`. Its committed example is intentionally empty. Compose uses `${JWT_SECRET:?...}` to reject an unset/empty secret. No real JWT secret or database credential is included in a Dockerfile or committed Compose configuration. Both build contexts exclude all `.env`/`.env.*` files, including templates.

Use `--env-file .env.docker` consistently. This keeps the Docker workflow separate from native root `.env` and `server/.env`. Existing shell variables can override Compose interpolation values, so avoid conflicting exported values. `config --quiet` validates without printing the interpolated secret. Do not publish full `docker compose config` output containing local values. [Compose interpolation rules](https://docs.docker.com/reference/compose-file/interpolation/).

| Variable | Docker use |
| --- | --- |
| `JWT_SECRET` | Required runtime backend secret supplied by the developer |
| `MONGODB_URI` | Runtime backend connection; default `mongodb://mongo:27017/interntrack` |
| `CLIENT_ORIGIN` | Runtime exact browser origin; default `http://localhost:8080`, without path/trailing slash |
| `VITE_API_URL` | Public frontend build argument; default `/api`; changing it requires an image rebuild |
| `NODE_ENV` | Backend image/Compose use `production`; existing production CORS rules apply |
| `PORT` | Backend image supports it; Compose fixes internal port `5000` to match Nginx |
| `FRONTEND_PORT` | Local loopback host port; default `8080` |

Vite settings are compiled into public JavaScript. They are not a secret-storage mechanism and cannot be changed merely by setting an environment variable on an already-built Nginx container. The final frontend image contains static output and Nginx, not a Node application that rewrites settings at startup.

If changing `FRONTEND_PORT`, update `CLIENT_ORIGIN` to match the exact URL you will open. Opening `127.0.0.1` instead of `localhost` is a different origin. Production CORS was not widened; it continues to reject unconfigured origins. No Nginx wildcard CORS headers were added.

## 9. InternTrack architecture

```text
Browser: http://localhost:8080/interntrack/
                  |
                  | host loopback port 8080
                  v
        Frontend container (Nginx, UID nginx)
          | /interntrack/* -> built React SPA
          |
          | /api/* -> HTTP backend:5000
          v
        Backend container (Node 22, UID node)
          | Express / existing auth / ownership / observers
          | local photo strategy -> profile_photos volume
          |
          | mongodb://mongo:27017/interntrack
          v
        MongoDB container
          |
          v
        mongo_data volume
```

JWT validation, ownership, application queues, safe responses, photo validation/storage abstraction, and notification Observer logic are unchanged. Requests still pass through the existing Express middleware/controllers. MongoDB remains the application source of truth.

## 10. Frontend container

Root `Dockerfile` builds with `node:22-bookworm-slim`, installs the lockfile dependencies, copies the required frontend sources/assets/configuration, and runs `npm run build` with the public API build argument. Node 22 satisfies the project's >=22.12 requirement when the current 22 image is pulled.

The final `nginx:stable-alpine` stage contains only the web server, custom config, and generated files under `/usr/share/nginx/html/interntrack`. Host node_modules, source tests, `.env`, backend data, and Git are not copied into it. Nginx runs as its non-root `nginx` user on unprivileged port 8080. The root-oriented image entrypoint is replaced by the direct Nginx command; temporary files and PID use `/tmp`.

`docker/nginx.conf` preserves `/interntrack/`. `/` redirects there, `/interntrack` redirects to its trailing-slash form, and nested routes fall back to `/interntrack/index.html`. Missing hashed assets return 404. API paths are proxied separately and never fall back to SPA HTML. The browser's actual host/port is preserved through relative redirects. [Nginx try_files documentation](https://nginx.org/en/docs/http/ngx_http_core_module.html#try_files).

API proxying preserves `/api`, query strings, and normal authentication headers. The proxy permits multipart overhead up to 3 MB; Express still enforces its existing 2 MB photo-file limit. Access-log format excludes query strings and auth headers. The existing profile-photo endpoint remains the only route serving photo files; the upload volume is not mounted into Nginx. [Nginx proxy documentation](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass).

The frontend health check fetches its built index through Nginx. It verifies static serving, not database readiness.

## 11. Backend container

`server/Dockerfile` builds from `server/`. Its dependency stage runs `npm ci --omit=dev`; the final Node 22 Bookworm slim image receives production node_modules, package files, and `src/`. The matching Debian-based stages avoid mixing native Sharp binaries across incompatible libc environments.

Runtime is the non-root `node` user. Startup uses the existing `npm start` script (`node --env-file-if-exists=.env src/server.js`); no development watcher is used. Compose supplies an init process and a 20-second stop grace period. Existing server SIGINT/SIGTERM handlers remain unchanged.

Compose gives frontend/backend read-only root filesystems, writable temporary `/tmp`, dropped Linux capabilities, and no-new-privileges. Only the backend's photo mount is persistently writable. npm's cache is directed to `/tmp/.npm` for compatibility with the read-only root. [Node image best-practice guidance](https://github.com/nodejs/docker-node/blob/main/docs/BestPractices.md).

The backend health check uses built-in Node fetch against `/api/health`, checking HTTP success and `status: ok`. The existing server connects to MongoDB before listening, so this is useful for initial startup coordination. After startup that endpoint is liveness only: it does not continuously check MongoDB availability. No readiness claim beyond that behavior is made. Express trust-proxy settings are unchanged; login-activity IP metadata can therefore reflect the internal Nginx peer rather than the browser IP. Choosing trusted proxy hops is a separate deployment decision.

## 12. MongoDB container

Compose uses the standard `mongo:8.0` image and persistent `/data/db` volume. Its mongosh ping health check does not output credentials. Mongo has no host-published port. This local learning service is unauthenticated and accessible to other services on the private Compose network; it is not a production database security configuration. Keep it local rather than exposing port 27017.

The images use maintained major/stable tags instead of immutable digests in this first learning phase. Lockfiles make dependency installation consistent, but floating base tags mean builds are not bit-for-bit pinned. Review/pin image digests and scan images in a later deployment/CI phase.

## 13. Feature 17 photo persistence

The managed path resolves to `/app/uploads/profile-photos` in the backend image. The Dockerfile creates that empty directory with `node` ownership; Docker's normal new-volume population preserves the image directory's ownership for the non-root runtime. An existing manually-created volume with different ownership may require explicit repair; no arbitrary host-directory mount is used.

The volume preserves files over container restarts/recreation, while Mongo preserves their references. Images do not contain host uploads, and new volumes do not import the native host database/photos automatically. Upload, replacement, safe cleanup, and serving still use LocalPhotoStorage through the existing Strategy contract.

S3 is not implemented. A later AWS phase can replace the local strategy behind the contract, with an explicit data migration and deployment plan. It must not assume files in this local Docker volume appear automatically in S3.

## 14. Build, start, verify and stop

From the repository root in PowerShell:

```powershell
Copy-Item .env.docker.example .env.docker
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Paste that fresh generated value into `JWT_SECRET` in `.env.docker`. Generating this value needs local Node; an equivalent trusted random generator is fine on a Docker-only host.

```powershell
docker compose --env-file .env.docker config --quiet
docker compose --env-file .env.docker build --pull
docker compose --env-file .env.docker up -d --wait
docker compose --env-file .env.docker ps

Invoke-WebRequest http://localhost:8080/interntrack/ -UseBasicParsing
Invoke-RestMethod http://localhost:8080/api/health
# SPA fallback returns the entry HTML; React still protects the Profile page.
Invoke-WebRequest http://localhost:8080/interntrack/profile -UseBasicParsing

docker compose --env-file .env.docker exec -T mongo mongosh --quiet --eval "db.adminCommand('ping').ok"
docker compose --env-file .env.docker exec -T backend node -e "fetch('http://127.0.0.1:5000/api/health').then(r => r.json()).then(console.log)"
docker compose --env-file .env.docker logs --tail=50
```

Verify missing `/interntrack/assets/not-found.js` returns 404 and `/api/not-found` returns the backend JSON 404, not SPA HTML. Then register a disposable local test user through the UI, sign in, and check protected application/notification/profile actions. Upload a test photo, recreate the services with `up -d --force-recreate --wait`, sign in again, and confirm the database records and photo remain. This procedure is documented for a Docker-enabled host; it was not executed here.

For an API authentication check without printing the JWT:

```powershell
# Substitute credentials for a disposable LOCAL user you have registered.
$dockerCredentials = @{ email = 'your-local-test-email'; password = 'your-local-test-password' } | ConvertTo-Json
$dockerSession = Invoke-RestMethod -Method Post -Uri http://localhost:8080/api/auth/login -ContentType application/json -Body $dockerCredentials
Invoke-RestMethod -Uri http://localhost:8080/api/auth/me -Headers @{ Authorization = "Bearer $($dockerSession.accessToken)" }
```

Stop cleanly using the same env file/project:

```powershell
docker compose --env-file .env.docker down
```

Do not add `-v`. No persistent volumes were deleted during this work. This production-oriented local workflow rebuilds code changes (`build` then `up`); it does not bind-mount sources or provide HMR. The original native npm development workflow remains available.

## 15. Files changed

- New root `Dockerfile`: frontend build and non-root Nginx runtime.
- New `docker/nginx.conf`: base-path static/SPA serving, API proxy, writable-temp layout.
- New root `.dockerignore`: focused frontend context exclusions.
- New `server/Dockerfile`: production dependency stage and non-root runtime using existing startup.
- New `server/.dockerignore`: backend context excludes host dependencies, tests, environment and uploads.
- New `compose.yaml`: local service network, environment, health dependencies, persistence and port control.
- New `.env.docker.example`: safe placeholders/public local configuration.
- Modified `.gitignore`: allows tracking only the new example while filled `.env.docker` stays ignored.
- Modified `README.md`: setup/build/start/verify/stop instructions and configuration guidance.
- New `DOCKER_ARCHITECTURE_REPORT.md`: this beginner guide and validation record.

No application source, API, test, package manifest/lock, CI workflow, or existing storage/notification strategy was changed.

## 16. Validation results

The existing non-Docker suite was run successfully BEFORE adding Docker files:

| Command | Result |
| --- | --- |
| `npm test` | 103 tests passed, 0 failed |
| `npm run test:integration` | 22 scenario groups passed |
| `npm --prefix server test` | 232 tests passed, 0 failed |
| `npm run test:smoke` | 12 real API/UI/disposable-MongoDB scenario groups passed |
| `npm run lint` | Passed, 0 errors/warnings |
| `npm run build` | Passed, 105 modules transformed |
| `git diff --check` | Passed before Docker additions and after them |

Non-failing React act timing warnings remain visible in the smoke harness; none was suppressed. Feature 17 photo and Feature 18 notification/auth/ownership coverage are included in these tests.

Additional checks after implementation:

- Native build with `VITE_API_URL=/api`: passed. Generated entry HTML retains `/interntrack/assets/` and generated JavaScript contains no `http://localhost:5000/api` fallback. This is NOT a Docker image build.
- Explicit Dockerfile local COPY sources: checked to exist. Runtime source selections, non-root users, production dependency installation, volume targets, ports, proxy URI/base-path handling, required-secret interpolation, ignore exclusions, and health/dependency wiring were reviewed statically.
- Git confirms `.env.docker` and runtime uploads are ignored. The committed example contains an empty JWT secret, not a usable secret. No real local secret was generated or written by this task.
- `docker compose --env-file .env.docker.example config --quiet`: attempted, but could not execute because the `docker` command is not installed/available. Docker is absent from PATH and the standard Docker Desktop CLI location.
- Compose interpolation/schema validation, image builds, Nginx `-t`, container startup, container frontend/API/Mongo communication, Docker authentication checks, Docker SPA fallback, persistence across Docker recreation, and clean container shutdown are **not runtime-validated** in this environment. No stack was started and no volumes were removed.
- No YAML parser was preinstalled. An isolated attempt to obtain PyYAML in the ignored local cache found no available distribution, so no independent YAML-parser validation is claimed. Application dependencies were not modified. Static review does not substitute for `docker compose config`.

Run the section 14 commands on a Docker-enabled host to complete those checks. The required secret must be supplied; the deliberately blank example by itself is not a runnable environment file.

## 17. Preparation for Jenkins

A later Jenkins pipeline can run the existing validation commands, build these Dockerfiles from the lockfiles, scan/tag images, and test them before any registry/deployment step. Runtime secrets can then be supplied through the appropriate CI/runtime credential mechanism rather than Docker build arguments. No Jenkinsfile, Jenkins installation, credentials, registry push, or pipeline is added now.

## 18. Later AWS connection

A later deployment phase can publish the images to a registry such as ECR, select a container runtime, configure HTTPS/domain routing, supply managed runtime secrets, and choose a production MongoDB service/network policy. Those are future design/deployment decisions, not implemented resources.

Local photo storage will later move to the S3 strategy described by Feature 17. Local Docker volumes, an unauthenticated Mongo service, a loopback HTTP port, and this Compose networking configuration must not be treated as an AWS production deployment. Nothing was pushed or deployed.
