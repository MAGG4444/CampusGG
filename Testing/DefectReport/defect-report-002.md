# Defect Report 002

**Defect ID:** DEF-002
**Title:** Integration test suite cannot run locally or in CI
**Severity:** Medium
**Related Requirement:** FR-003 / SYS-103
**Related Test Case:** IT-AUTH-01
**Environment:** Windows 11, Node.js 24.19.0 (local); GitHub Actions ubuntu-latest, Node.js 20
**Status:** Resolved (local); CI verification pending

## Description

`npm run test:e2e` fails before executing any test because the E2E Jest
configuration does not map relative `.js` imports to the TypeScript source
files. The default smoke test also imported the full `AppModule`, pulling in
PostgreSQL and Redis dependencies that are not available in the test
environment. As a result, no integration suite was runnable and CI had no
integration-test job; the registration and OTP verification flow was covered
only by unit tests.

## Steps to Reproduce

1. `cd campusgg-backend`
2. `npm ci`
3. `npm run test:e2e`
4. Observe the suite fail before any test executes.

## Results

* **Expected Result:** Jest discovers and runs the E2E suite, including the
  authentication flow.
* **Actual Result:** The suite fails with
  `Cannot find module '../auth/auth.module.js' from
  '../src/matchmaking/matchmaking.module.ts'`; zero tests execute.

## Evidence

* Local terminal output from `npm run test:e2e` before the fix.
* Fix commit: `7446a23` on `feature/auth-integration-test`.
* After the fix:
  * `npm run test:e2e -- --runInBand` → 2 suites, 14 tests passed.
  * `npm test -- --runInBand` → 11 suites, 54 tests passed.
  * `npm run lint` and `npm run build` → clean.
* CI job URL: to be added after the PR run.

## Resolution

* **Suspected Cause:** `campusgg-backend/test/jest-e2e.json` was missing the
  `"^(\\.{1,2}/.*)\\.js$": "$1"` mapper, and `app.e2e-spec.ts` imported the
  full `AppModule`.
* **Fix:** Added the mapper; scoped the smoke test to `AppController` and
  `AppService`; added `test/auth.e2e-spec.ts` with 13 integration tests using
  an in-memory user repository and a mail-service spy; added an
  `integration-test` job to CI that runs `npm run test:e2e`.
* **Verification After Fix:** Local integration, unit, lint, and build runs
  all pass. CI verification is pending the pull request.

## Root Cause Analysis (RCA)

Not required — Medium severity.
