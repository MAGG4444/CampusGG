# Manual Test Report 001

**Test Case ID:** API-001
**Test Title:** Node.js Backend API Basic Functionality
**Related Requirement(s):** FR-006
**Tester Name:** Justin
**Date Executed:** 2026-09-18
**Environment:** localhost

## Preconditions
* Downloaded basic npm functionality (via homebrew if on macOS) due to required dependency
* Node.js will be running locally
* API endpoint is available (shown via frontend)


## Test Steps

| Step | Action | Expected Result | Actual Result | Pass/Fail |
| :--- | :--- | :--- | :--- | :--- |
| 1 | Start the CampusGG backend and verify that the application starts without an unrecoverable error. | The backend starts and listens on the configured port | Application starts with backend API properly configured on | [Pass] |
| 2 | Find lobby objects and ensure lobby card data is populated through /lobbies | All lobby objects should be reached and viewable through the action | Lobby objects are properly displayed and reached when adding /lobbies to the configured port as expected | [Pass] |

## Overall Result
**PASS**

## Evidence & Notes
* Evidence of successful run can be found when running npm build and calling upon /localhost3000 (the configured port which was chosen) from the original html file ran on
* You will view all objects documented and the see which API endpoits were reached, and in this case the lobby objects were reached
* https://github.com/MAGG4444/CampusGG/actions/runs/34785313970
