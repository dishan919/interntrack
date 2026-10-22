# Feature 18: In-App Notifications with Observer Pattern

## 1. Feature overview

The authenticated navbar now has a notification bell, total unread badge, and a compact panel. The panel shows titles, short messages, readable local timestamps, read/unread styling and text, and application links. Users can mark one notification or all their notifications as read, refresh, retry failures, and dismiss with Escape or the close button. Pending actions are disabled and read mutations have a duplicate-submit guard.

MongoDB is the source of truth. Notification state lives only in React memory and is keyed by authenticated user/session. Logout unmounts the private workspace; late responses cannot populate a newer session. No notification content is stored in localStorage or sessionStorage. JWT behavior is unchanged.

## 2. Observer Pattern

Observer separates an event publisher from the components interested in an event. A publisher announces what happened; subscribed handlers decide their side effects. `createEventPublisher()` exposes `subscribe(name, handler)` and asynchronous `publish(name, payload)`. Subscription returns an unsubscribe function. Multiple subscribers and asynchronous handlers are supported.

## 3. Why it fits InternTrack

Application controllers already save application changes inside a per-account operation queue. They should describe successful domain changes rather than contain notification persistence logic. A separate notification observer decides which events merit notifications. Another observer can be added without duplicating side effects across status, interview, or follow-up UI entry points.

The existing activity timeline remains separate and unchanged. Its client-side activity data is not trusted as a notification event source.

## 4. Publisher/subscriber architecture

```text
Application Controller / Follow-up Discovery
                 |
                 | publish explicit domain event
                 v
          Domain Event Publisher
                 |
           +-----+-------------------+
           |                         |
           v                         v
   NotificationObserver       Future Observer
           |
           | private notification persistence
           v
    Notification Model
           |
           v
        MongoDB
```

`applicationEvents.js` compares persisted before/after application fields and constructs a minimal payload. Controllers publish after the database operation succeeds. `domainEvents.js` delivers events and contains observer errors. `notificationObserver.js` owns notification creation and due-reminder deduplication. The observer is registered once at app module initialization, independently of the number of Express app instances.

## 5. Implemented events

| Event | Trigger | Notification policy |
| --- | --- | --- |
| `application.statusChanged` | Successful update changes status | Notify every genuine change between valid statuses, including reverse transitions into Applied or Saved. Unchanged saves do not publish status-change events. |
| `interview.scheduled` | Successful create/update introduces or changes a valid interview date or time | Notify initial scheduling and rescheduling. Read legacy `interviewDate` when structured date is absent. Invalid dates/times, notes-only or location/type-only edits do not notify. |
| `followUp.due` | A saved incomplete reminder is due, or list refresh discovers it has become due | Notify once per user/application/calendar date. Completed, future, and invalid dates are ignored. |

Status events contain only authenticated user ID, application ID, bounded company name, previous status and new status. Interview events add date/time instead of status fields. Follow-up events add only the due date. Raw requests, whole documents, private notes, passwords, JWTs, headers and account tokens are not published.

A single action that both enters Interview status and schedules an interview may produce two distinct notifications. Minor edits and unchanged saves do not independently produce alerts.

Due discovery occurs on `GET /api/notifications` and relevant saves. It uses UTC calendar days for server comparisons and revalidates stored date strings. There is no timer, cron job or background scheduler. A compound unique index and upsert preserve due-reminder deduplication across refreshes/restarts, including after marking the reminder read.

## 6. Notification model

`Notification` contains required `user`, `type`, `title`, `message`, and `read` (default false), optional related `application`, internal optional `eventKey`, and Mongoose timestamps. Supported types are status, interview, and followUp. Title/message lengths are bounded.

Indexes:

- `{ user: 1, createdAt: -1, _id: -1 }` supports the newest-first list and stable ordering for timestamp ties.
- `{ user: 1, read: 1 }` supports unread count and mark-all queries.
- Unique `{ user: 1, eventKey: 1 }`, partial to string event keys, deduplicates due reminders without preventing ordinary independent notifications.

The list returns at most 50 records sorted by createdAt descending, then ID descending. `unreadCount` covers all the user's unread records, including those outside the visible 50.

## 7. API endpoints

All endpoints require the existing Bearer JWT middleware and a live account check inside the existing account-operation queue.

| Endpoint | Behavior |
| --- | --- |
| `GET /api/notifications` | Discover due reminders; return `{ notifications, unreadCount }`, newest 50. |
| `PATCH /api/notifications/:id/read` | Mark one owned notification read; idempotent; return a safe fixed message. |
| `PATCH /api/notifications/read-all` | Mark all authenticated user's notifications read, including older records; return a safe fixed message. |

Mutation requests need no body. Nonempty payloads, including supplied ownership, are rejected with 400. Missing/foreign/malformed individual IDs return the same safe 404. Invalid/missing JWTs and deleted users return 401. Unexpected persistence failures use the existing generic error handler. There is no public notification-creation API.

Safe list items contain only id, type, title, message, read, createdAt, and optional applicationId. The API checks current application ownership/existence before including a navigation reference. Deleted or inconsistent foreign references do not create links. Application Details independently retains its existing ownership rules.

## 8. Authentication and ownership isolation

Every notification query and mutation explicitly scopes `user` to `req.auth.userId`. Event ownership is derived from that same identity, never from body fields. List query parameters cannot redirect ownership. Notification responses use Cache-Control: no-store. No owner IDs, internal event keys, account secrets or filesystem paths are returned.

The frontend service uses Bearer authentication, allowlists response fields, validates IDs and list shapes, rejects unsafe application links, and sanitizes server/network errors. A stale 401 cannot invalidate a newer session. React renders messages as text, including HTML-looking company names.

Existing production CORS configuration, profile-photo storage strategy/security, password security, login activity, and safe account responses are unchanged.

## 9. Observer failures and consistency

The publisher awaits each observer, catches synchronous and asynchronous failures individually, logs only `Domain event observer failed.`, and continues to later subscribers. A notification database failure does not undo a successfully saved application or turn its response into a failure. No fire-and-forget promise or unhandled observer rejection is introduced.

This is best-effort, in-process delivery, not a transactional outbox. A process crash between application save and publication, or a failed status/interview observer write, can lose the notification. There is no durable replay/retry for those events. Due reminders can be retried by later discovery; their unique event keys prevent repeat records. Observer work is awaited and therefore adds request latency. Failed follow-up discovery logs a fixed warning while existing notification history remains available.

## 10. Account deletion cleanup

The existing password reauthentication and conditional user deletion remain intact. Deletion cleans owned applications, login activity, notifications, and the managed profile photo before removing the user. Cleanup failures keep the account and return a generic error so deletion can be retried.

Application writes, notification reads/mutations/discovery, and account deletion share the existing per-account queue. An observer already running finishes before deletion cleanup, and requests queued behind deletion recheck account existence. Tests verify an in-flight observer cannot recreate notifications after account removal.

Cleanup is non-atomic, as before: earlier cleanup can have succeeded when a later step or final user deletion fails. The queue is local to one Node process; it is not a distributed lock or MongoDB transaction.

## 11. Files changed

Backend additions:

- `server/src/services/domainEvents.js`
- `server/src/services/applicationEvents.js`
- `server/src/services/notificationObserver.js`
- `server/src/models/Notification.js`
- `server/src/controllers/notificationController.js`
- `server/src/routes/notificationRoutes.js`
- `server/tests/domainEvents.test.js`
- `server/tests/notifications.test.js`

Backend integration changes: `server/src/app.js`, `server/src/controllers/applicationController.js`, and `server/src/controllers/accountDeletionController.js`.

Frontend additions: `src/components/layout/NotificationBell.jsx`, `src/services/notificationService.js`, and `src/styles/notifications.css`. `Navbar.jsx` mounts the bell without redesigning existing account/avatar controls.

Test additions/integration: `tests/notifications.test.js`, `tests/notificationIntegration.jsx`, `tests/run-register-integration.mjs`, and `tests/run-smoke.mjs`. Existing protected-page integration fetch doubles and `tests/apiMock.js` explicitly return an empty notification response for the new independent header request; all their existing feature assertions remain. The API loading harness distinguishes notification requests from application requests.

No dependency changes were necessary.

## 12. Validation results (22 October 2026)

- `npm test`: 102 passed, 0 failed.
- `npm run test:integration`: 21 scenario groups passed, including the new notification UI scenario.
- `npm --prefix server test`: 232 passed, 0 failed (including 2 publisher tests and 17 notification API/event/cleanup tests).
- `npm run test:smoke`: 12 real API/UI scenario groups passed, including event-to-notification creation, badge, mark-read persistence, safe application navigation, logout and deletion cleanup.
- `npm run lint`: passed with 0 errors and 0 warnings.
- `npm run build`: passed.
- `git diff --check`: passed.

Smoke tests emit non-failing React act timing warnings from asynchronous component updates; assertions pass. No existing tests were weakened. Database tests use disposable MongoDB instances, never the personal application database.

Observer tests cover routing, unrelated subscribers, multiple subscribers, unsubscribe, asynchronous completion, and safe continuation after synchronous/asynchronous failures. Backend tests cover auth/deleted users, ownership, ordering/ties/limit/count, read state, mark-one/all, malformed IDs, event payload allowlists, status/interview creation, unchanged-status minor-edit noise, due discovery/deduplication, safe navigation, persistence failure behavior, and secure cleanup including failure/race cases. Frontend tests cover the requested bell, count, loading/list/read/empty/error/retry, read actions/pending/duplicates, timestamps, navigation, plain-text safety, dismissal, browser-storage privacy, late-response account isolation, and logout.

## 13. Known limitations

- No WebSockets, polling or cross-tab synchronization. Counts refresh when application context changes or the user clicks Refresh notifications. Other sessions require refresh; closing/opening the panel alone does not fetch.
- Follow-ups become notifications when checked, rather than exactly at midnight. UTC server days can differ from the browser's local calendar near midnight.
- The list is capped at 50 without history pagination or retention cleanup. Total unread can therefore exceed the number of visible unread records; Mark all as read includes those older records.
- Due discovery scans the authenticated user's due incomplete reminders using the existing application-owner index; a dedicated due-date index/batched worker could be considered at larger scale.
- A completed/removed reminder does not retract an already-created notification. Reusing the same application/date will not issue another due alert. Deleted application notification text remains as history, without a navigation link.
- Event delivery and account cleanup have the best-effort and non-atomic limitations described above. No transactionality or production delivery guarantee is claimed.

## 14. Future observer example

A future `EmailNotificationObserver` can call `domainEvents.subscribe(EVENTS.INTERVIEW_SCHEDULED, async event => { /* invoke an email service */ })` and unsubscribe through the returned function. Controllers need no email-specific logic. Production email, durable retry and delivery policy would be separate work; none is implemented here.

No Feature 19, AWS services, brokers, sockets, production email delivery, push, or deployment was added. Nothing was pushed or deployed.


## 15. Status-transition regression investigation and fix

Reported behavior: Interview -> Applied saved successfully but produced no visible notification.

Trace and reproduced root cause:

1. ApplicationProvider merges the new status and sends the existing authenticated PUT. The account queue preserves the stored previous application for the comparison.
2. The application controller awaits findOneAndUpdate and checks success before calling publishApplicationEvents. The publisher already compares before.status !== after.status and includes the correct previousStatus/newStatus.
3. The notification observer contained a destination allowlist: only Interview, Offer and Rejected were accepted. The correctly published Interview -> Applied event was discarded there. Saved destinations were affected too.
4. Status notifications use ordinary creation without eventKey; follow-up deduplication was not suppressing the transition. The list API scopes to the authenticated user and does not filter by status. The navbar already refreshes when server-confirmed application context changes and through its Refresh notifications action.
5. The new reverse-transition regression was run before the fix: it confirmed the correct event and committed Applied status, then failed because MongoDB contained zero notifications instead of one. This isolates the defect to observer filtering, rather than an assumed UI refresh issue.

Exact production fix: remove the observer's destination allowlist. Every genuine persisted status-change event now creates a notification. The existing publisher's unchanged-status check remains the guard against noisy saves. No controller, publisher, API, deduplication, queue, CORS, authentication, photo-security, or navbar production behavior was changed for this fix.

Regression coverage:

- Interview -> Applied asserts the exact trusted event payload and verifies Applied is already committed when a subscriber receives the event. It checks exactly one unread private MongoDB notification, its title/message, API visibility, another account's empty list, and no duplicate after unchanged save/list refresh.
- A matrix covers all 20 genuine transitions among the five valid statuses, including Applied -> Interview, Interview -> Applied, Interview -> Offer, and Offer -> Rejected. Unchanged saves remain single-notification histories. Repeating the reverse transition after an intervening real change creates a new notification, independent of due-reminder deduplication.
- Validation, foreign ownership, and forced database update failures assert no published status event, no notification, and unchanged persisted status.
- The previous test that intentionally treated Applied as non-actionable was corrected to assert no notification for an unchanged-status minor edit. The expanded matrix tests its new required behavior explicitly.
- The real React/Express/disposable-MongoDB smoke scenario changes Interview -> Applied through the board, observes automatic badge refresh, checks the stored message and exactly one reverse notification, explicitly refreshes the open navbar panel, and confirms one visible notification without duplicate persistence. Existing Offer/read-state/navigation checks remain, with totals adjusted for the two extra legitimate transitions.

Focused checks: the pre-fix reverse regression failed as expected (0 notifications, expected 1). After the fix, publisher/notification tests pass: 19 tests, 0 failures. The real API/UI smoke suite passes 12 scenario groups. Full validation results are recorded in section 12.

Only notificationObserver.js, the notification backend tests, the smoke regression scenario, and this report were changed for the bug fix, on top of the existing Feature 18 workspace changes. Previously missed status notifications are not backfilled. Event delivery retains the documented best-effort limitation; exactly-one assertions apply to a successfully handled genuine update, not crash-proof distributed delivery.
