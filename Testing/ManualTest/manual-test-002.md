# Manual Test Report 002

**Test Case ID:** UI-001
**Test Title:** Verifying navigation between Connect and Lobby and Profile
**Related Requirement(s):** FR-002
**Tester Name:** Justin Samuel
**Date Executed:** 2026-09-11
**Environment:** localhost and ubuntu via ci.yml

## Preconditions
* Ensure backend is build via npm build
* Ensure frontend includes all specified specs reaching a Home, Connect, Lobby, and Profile page

## Test Steps

| Step | Action | Expected Result | Actual Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Build the backend via npm build and host on any port | backend should build and be reachable | Backend did not populate any objects from the frontend | [Fail] |
## Overall Result
**[FAIL]**

## Evidence & Notes
*   Linked to fail build via github: https://github.com/MAGG4444/CampusGG/actions/runs/34629516447
* As we can see, although it states are backend was built, our frontend wasn't able to build and populate anything due to miscommunication between the frontend and backend code it seems
