# Feature 17: User Profile Photo

## Feature
Authenticated users can upload, replace, or remove a profile photo from Profile. JPEG, PNG, and WebP are accepted up to 2 MB. Accessible file selection, validation, pending states, safe errors, and duplicate-submit protection are included. AuthContext updates Profile, Navbar/account menu, and Sidebar immediately. Broken images fall back to the existing initial. Browser storage continues to contain only session tokens, never image data.

## Strategy Pattern and why it fits
The controller validates and transforms images, then calls the profile photo storage contract. It does not know the filesystem directory or file operations. `createProfilePhotoStorage(strategy)` delegates `save(buffer)`, `read(reference)`, and `remove(reference)` to a selected strategy. `LocalPhotoStorage` is the only production implementation. A test substitutes an in-memory strategy to demonstrate the contract independently of local storage.

This is a small Strategy implementation: the storage behavior varies, while the photo workflow stays the same. There is no inheritance framework or S3 implementation.

## LocalPhotoStorage
The composition point in `server/src/services/profilePhotoStorage.js` selects LocalPhotoStorage. It writes generated UUID WebP keys exclusively, uses restrictive file permissions where supported, cleans partial writes, and treats missing-file removal as idempotent. Only validated generated keys can be read or removed. Client filenames and paths are never used. Runtime uploads are ignored by Git; only `.gitkeep` is retained.

## Future S3PhotoStorage
Implement the same three asynchronous operations using object storage and select it at the composition point. Preserve opaque UUID object keys and the stable `/api/profile-photos/:filename` public URL contract; image serving already calls the strategy's read operation. The User model, authentication response, AuthContext, and Profile UI need no storage-specific changes. Credentials, bucket configuration, streaming optimizations, and deployment are future work.

## Security and failure handling
- Authentication and existing-account checks precede multipart handling. Only the JWT subject selects the user; extra identity fields are rejected.
- Multer bounds size, file count, multipart parts, and fields. MIME type, image signatures, successful Sharp decoding, format agreement, single-page content, and a 16-million-pixel limit are checked.
- Images are resized to fit 1024 by 1024 and reencoded as WebP, stripping original metadata and filenames.
- Replacement validates, stores a new file, commits its reference, then removes the old file. Database failure attempts rollback of the new file and preserves the old reference.
- Removal clears the reference before cleanup. Cleanup failure emits a fixed warning without exposing paths; committed changes stay usable. Failed cleanup can leave an orphan requiring manual cleanup; no durable retry queue is implemented.
- Photo operations use the existing per-account queue, shared with deletion and application/login-activity operations. This serialization is for the current single-process server.
- Account deletion retains password reauthentication and ownership rules, deletes applications and login activity, and removes the managed photo before final conditional user deletion. Photo cleanup failure prevents account deletion. A subsequent database deletion failure can leave a cleared physical photo with the old reference; the avatar safely falls back, and deletion can be retried.
- Responses allowlist safe user fields and expose only a public photo URL. Passwords, JWTs, hashes, internal references, and filesystem paths are absent from photo responses. Public photos use unguessable URLs and are accessible to anyone possessing the URL; they are not private documents. Responses use WebP content type, nosniff, and no-store.
- Configurable production CORS logic is unchanged and its existing tests remain intact.

## API endpoints
- `POST /api/auth/me/photo`: Bearer authentication; multipart field `photo`; returns `{ user }`. Validation errors return 400, files exceeding 2 MB return 413, missing/invalid authentication returns 401.
- `DELETE /api/auth/me/photo`: Bearer authentication, no identity/path payload; returns updated safe `{ user }`. Idempotent when no photo exists.
- `GET /api/profile-photos/:filename`: reads through the storage strategy; invalid/missing keys return 404.

## Files changed
Backend: `server/package.json`, lockfile, `src/app.js`, User model, auth routes, profile photo controller, account deletion controller, profile photo storage service, and safe-user serialization in emailVerification service.

Frontend: AuthProvider, authService, new profilePhotoService and profilePhoto utilities, Profile page, new ProfilePhoto and UserAvatar components, Navbar, Sidebar, global/profile styles.

Verification: backend profilePhoto and photoStorage tests; frontend profilePhoto unit/integration tests; profile integration assertions; integration runner; real API smoke runner. Existing profile assertions were adapted to the new avatar placement without dropping their checks. `.gitignore` and `server/uploads/profile-photos/.gitkeep` handle runtime storage.

## Validation (22 October 2026)
- `npm test`: passed.
- `npm run test:integration`: passed, including photo selection, upload/replacement/removal, validation/errors/pending/duplicates, immediate shared avatar updates, broken-image fallback, token-only storage, and session isolation.
- `npm --prefix server test`: passed: 213 tests, 0 failures, including the expanded failure-handling and storage contract tests.
- `npm run test:smoke`: passed, including real multipart API, persistence after refresh, replacement/removal, avatar propagation, and physical file cleanup. Non-failing React act warnings occurred in the login-history test harness.
- `npm run lint`: passed.
- `npm run build`: passed.
- `git diff --check`: passed; Git emits existing LF/CRLF conversion notices for server package files.

Backend coverage includes authentication, supported formats, unsupported/mismatched/corrupt/truncated/empty/oversized images, missing/malformed multipart, spoofed identity rejection, ownership, safe responses, replacement/removal, database rollback, storage/cleanup failures, account deletion, path safety, and strategy substitution.

No S3, Feature 18, push, or deployment was performed.

