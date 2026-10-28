# Issue #117: My Posts and My Lobbies

Profile has one My Content card linking to `/my-content`. Tabs are available at
`/my-content?tab=posts`, `/my-content?tab=lobbies`, and `/my-content?tab=drafts`.
The optional `page` query parameter is 1-based. Tabs and pages survive refresh.
The legacy `/drafts` route redirects to the Drafts tab. Profile editing (#116) is
not included.

## API

- `GET /forum/posts/me?page=1&limit=10`
- `GET /lobbies/me?page=1&limit=10`

Both require the existing Bearer JWT. The JWT guard verifies the signature and
expiration and supplies the subject ID. The server filters `author_id` or
`host_id`; client user IDs and display names never determine ownership.
Joined-only lobbies are excluded. All persisted Forum posts are published;
drafts remain separate browser data. Static `/me` routes precede `/:id`.

Response: `{ items: [{ id, title, preview, createdAt }], total, page, limit }`.
Previews contain at most 240 characters. Page defaults to 1 (maximum 2147483647),
limit defaults to 10 (maximum 100); invalid pagination returns 400. Missing,
invalid, or expired JWTs return 401. Results sort by creation date descending,
then ID descending to break timestamp ties. Each endpoint uses a filtered page
query and count query, with no per-item queries or account entities in responses.
Existing public endpoints retain their contracts. No schema changes are included.
At larger data volumes, assess composite ownership/creation-date indexes; this
branch does not add migrations or change automatic schema synchronization.

## Frontend behavior

Requests send the existing token and AbortSignal. Account/token changes, tab
changes, pagination, refresh, and route revisits reset list state. Aborted requests
cannot display data or sign out a later account. A current 401 invokes the existing
signOut and the protected route redirects to sign in. Published content is never
stored in localStorage. Retry and the accessible RefreshCw icon fetch published content from the server
again. The refresh button disables and spins during requests, including history
revisits. Reduced-motion preferences suppress spinning. Draft refresh is a
synchronous reread of the existing browser storage and preserves the draft filter.
It never calls the backend or modifies saved drafts.

Detail links carry an allowlisted local return location. Existing PostDetail
editing/deletion is reused; successful deletion returns to the originating list.
LobbyDetail gains only contextual return navigation, with no new edit/delete UI.
Opening detail pages normally still returns to their original feeds.

## Verification

Frontend: `npm test`, `npm run lint`, `npm run build`.
Browser regressions: run Vite and open `/tests/my-content.html`. The result element
`#results[data-status="passed"]` indicates all scenarios passed. This harness
renders real components and simulates delayed/error API responses; it does not
contact a real backend or use real accounts.

Backend: `npm test -- --runInBand`, `npm run build`, and read-only lint:
`npx eslint 'src/**/*.ts' 'test/**/*.ts'` (the existing npm lint script uses --fix).
Run `npm run test:my-content:integration` with DATABASE_URL configured for a local
test PostgreSQL database. It creates disposable accounts in a unique schema and
drops that schema in teardown, using real controllers, JWT verification, services,
and SQL. The account display names deliberately match to test ID-based ownership.

For live browser QA, run `node --env-file=.env test/my-content-fixture.cjs` from the
backend. It prints a temporary URL and disposable login credentials. Point a
separate Vite process at that URL using VITE_API_URL. Stop the fixture with SIGINT
or SIGTERM to remove its schema. Never use production DATABASE_URL for testing.

## Merge considerations

#116 may touch the same Profile JSX/CSS. Preserve its editor while retaining the
single My Content card and consolidated Drafts tab. This issue does not change User,
UsersService, AuthProvider, or database migration configuration.

Existing public Lobby endpoints expose lobby records without visibility-based
access control; this issue leaves that behavior unchanged. The new personal list
always restricts results to the authenticated host, including private lobbies.

## Validation results

- Backend: 53 existing unit tests passed; PostgreSQL integration suite passed
  (6 scenarios plus parent test), including real JWT rejection, ownership,
  hosted-versus-joined lobbies, pagination, ordering and post edit/delete.
- Frontend: all three Node test files passed; build passed. Lint has no errors
  and one existing JoinedLobbiesContext dependency warning.
- Browser harness: eleven scenarios passed with no browser errors. Covers redirect,
  loading/error/retry/empty states, URL selection, keyboard tabs, cancellation,
  account switching, stale 401 responses, pagination, revisits, Drafts and Sign Out.
- Live disposable-account QA: Profile → posts → edit/save → back; post deletion
  and refresh; Profile → hosted lobby → back; tab refresh; Drafts; Sign Out.
  Desktop (1280px) and mobile (390px) inspected; no mobile horizontal overflow.
- Backend lint: new DTO and touched Lobby files pass. Full lint reports 376
  existing Prettier violations. The two touched Forum files have 222 violations
  versus 223 in their HEAD versions; unrelated formatting was left untouched.
- Frontend/backend builds and `git diff --check` pass.

## File inventory

Created in backend:
- `src/common/dto/my-content.dto.ts`
- `test/my-content-fixture.cjs`
- `test/my-content.integration.cjs`

Modified in backend:
- `package.json`
- `src/forum/forum.controller.ts`
- `src/forum/forum.service.ts`
- `src/lobbies/lobbies.controller.ts`
- `src/lobbies/lobbies.service.ts`

Created in frontend:
- `src/components/DraftList.jsx`
- `src/api/request.js`
- `src/api/lobbies.js`
- `src/pages/MyContent.jsx`
- `src/pages/MyContent.css`
- `src/utils/myContentNavigation.js`
- `tests/myContent.test.js`
- `tests/myContent.browser.jsx`
- `tests/my-content.html`
- `docs/my-content.md`

Modified in frontend:
- `src/App.jsx`
- `src/api/forum.js`
- `src/pages/Profile.jsx`
- `src/pages/Profile.css`
- `src/pages/Drafts.jsx`
- `src/pages/Drafts.css`
- `src/pages/CreatePost.jsx`
- `src/pages/CreateLobby.jsx`
- `src/pages/PostDetail.jsx`
- `src/pages/LobbyDetail.jsx`

## UI consolidation refinement

DraftList is extracted from the existing Drafts page; filtering, sorting,
per-account storage, restoring and deletion still use the original draftStorage
functions. The draft editor hook, autosaving and navigation blocker are unchanged.
Editor links retain draftId and a Drafts-tab return location. A direct saved-draft
URL also returns to that tab. A new editor opened from a feed retains its original
Back destination even after saving adds draftId to the URL.

The expanded browser suite covers all three tabs, the legacy redirect, refresh
busy/disabled states, cancellation and history revisits, draft filtering and
account isolation, deletion, both real draft editors' restoration/autosave/unsaved
warnings, avoiding updates to other drafts, and feed return after saving.
This refinement changes frontend files only; backend tests are rerun unchanged.
