# Profile editing API (Issue #116)

## Authentication and requests

`GET /users/me` and `PATCH /users/me` require `Authorization: Bearer <JWT>`.
The server verifies the signature and derives the account ID from the JWT subject.
PATCH accepts only these optional fields; omitted fields are preserved:

```json
{
  "displayName": "Campus Player",
  "bio": "Looking for a weekend squad.",
  "favoriteGames": ["Valorant", "Minecraft"],
  "skillLevel": "Intermediate"
}
```

- `displayName`: trimmed string, 1–100 characters when supplied.
- `bio`: string, at most 500 characters, trimmed on save; `""` clears it.
- `favoriteGames`: 0–10 trimmed, case-insensitively unique strings, each 1–50 characters;
  `[]` clears the list.
- `skillLevel`: `""`, `Beginner`, `Intermediate`, or `Advanced`.
- Null values, invalid types, unknown fields, IDs, username, email, passwords and
  verification properties are rejected with 400. An empty object is a read-only no-op.

Both endpoints return 200 with `id`, `username`, `email`, `displayName`, `bio`,
`favoriteGames`, and `skillLevel`. No password, verification metadata, JWT or other
security fields are included. Public `GET /users` and `GET /users/:id` retain their
routes but now return only `id`, `username` and the four profile fields; private email
and authentication metadata are excluded. In-repository callers do not require those
private fields. External consumers of the old public email field must use authenticated
`GET /users/me` for their own account instead.

Errors follow NestJS `{ "message": "..." }` or a message array: 400 invalid input,
401 absent/invalid/expired JWT, 404 missing account, 5xx server failure.

## Database migration and deployment

Run from `campusgg-backend` using Node 22.23+ and the existing `DATABASE_URL`:

```sh
npm run migration:show
npm run migration:run
```

The CLI reads `.env` if present (existing process environment takes precedence).
`src/database/data-source.ts` disables synchronization. The versioned
`add-user-profile-fields.ts` migration (`AddUserProfile`) adds `bio varchar(500) NOT NULL DEFAULT ''`,
`favorite_games text[] NOT NULL DEFAULT '{}'`, and
`skill_level varchar(20) NOT NULL DEFAULT ''` to the existing `users` table.
It preserves all existing columns/records and records completion in TypeORM's
`migrations` table. No reset, table recreation or automatic startup migration occurs.
The existing base schema must already exist. `DATABASE_SCHEMA` optionally selects a
schema for the migration CLI; normal application deployment uses `public`.

Apply the migration before starting the updated API or enabling the updated frontend.
The application now synchronizes only with explicit `TYPEORM_SYNCHRONIZE=true` in
non-production environments; use that only to bootstrap a disposable development DB.
Production never uses schema synchronization. Back up before deploying schema changes.
`npm run migration:revert` removes only the three new columns and loses their profile
contents; roll back application code too if reverting. It preserves original account
columns. Do not run the revert against deployed data casually.

## Frontend integration

`AuthProvider` enables profile saving by default. The existing editor sends only the
four supported fields through `updateUserProfile`. It validates the returned account ID
and complete profile before merging only editable fields into the current session.
JWT, username and email cannot be overwritten by a PATCH response. Requests failing
validation or returning errors preserve the old displayed profile. Duplicate saves
are blocked. Responses from previous sessions cannot replace the current account.

Sign-in retrieves `GET /users/me`; restoring a cached session refreshes it from the
same endpoint. A refresh cannot overwrite an in-flight save or a newer session.
Transient refresh failures retain the cache. Session storage is the existing confirmed
session cache, never a substitute for server persistence. If caching a successful
save fails, the UI explicitly tells the user it was saved on the server and to sign in
again. The optional provider capability remains available for unsupported deployments
and test fixtures; `profileUpdatesEnabled={false}` disables saving clearly.

## Verification

Frontend: `npm test`, `npm run lint`, `npm run build`.
Backend: `npm test -- --runInBand`, `npm run lint -- --no-fix`, `npm run build`.
`npm run test:profile:integration` builds the backend and exercises actual PostgreSQL,
Nest HTTP endpoints, JWT verification and authentication flows. It requires a **local**
`DATABASE_URL` and permission to create a schema. It creates a randomly named
`profile_test_*` schema with disposable accounts, applies the actual migration, tests
existing-record preservation, updates, isolation, validation and re-login, then drops
only that schema. Email delivery is stubbed; no messages are sent. Existing application
records are never modified. The normal application schema migration remains a separate
deployment step.

For browser testing against that isolated real API, run after the backend build:

```sh
node --env-file-if-exists=.env test/profile-fixture.cjs
```

It prints a temporary local API URL and disposable credentials. Start Vite with
`VITE_API_URL=<printed URL> npm run dev`, test `/signin` and `/profile`, then stop the
fixture with Ctrl+C to remove its schema. This fixture mounts the real users and auth
controllers; unrelated Lobby/Forum endpoints are not mounted.

`/tests/profile-editing.html?enabled=true` is also a development-only mock fixture.
`window.profileTest.mode` accepts `error`, `pending`, or `success`;
`window.profileTest.resolve()` completes pending saves and `requests` counts them.
This HTML file is not a production build entry. Verify prefilled/read-only fields,
validation, Cancel/navigation warnings, pending duplicate prevention, failure retention
and successful updates. Use the real API fixture for refresh and re-login persistence.
