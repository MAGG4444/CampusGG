# CampusGG Verification Test Inventory

**Purpose:** This document contains the verification tests used to evaluate the CampusGG implementation against the software requirements defined in the Final Software Design Project (SDP). Tests from the team's Requirements Verification Traceability Matrix (RVTM) are included and additional tests have been added where necessary to provide coverage for the current software requirements. Tests are categorized as Unit, Integration, or System tests. Tests that have not yet been executed are identified as planned or not yet implemented rather than being reported as passed.

**RVTM Reference:** https://docs.google.com/spreadsheets/d/1aw4wVFeKvnpvVjaV_OZzfsBNCL_1easfMTCObMuUoWs/edit?gid=0#gid=0

**Test Evidence:** Evidence links will be added as tests are executed. Evidence may consist of GitHub Actions logs, API test results, screenshots, manual test reports, or other appropriate artifacts. For tests that are not yet integrated into CI, the inventory will identify the expected integration date according to the implementation schedule.

## Test Cases

| Test Case ID | Level (Unit / Integration / System) | Description | Req. ID | Test Owner | Tool | Automated? | CI Integrated? | Evidence Link |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| IT-UEV-01 | Integration | Attempt to register 5 test accounts using various email domains. Verify the system only dispatches the verification email to the .edu addresses. | FR-003 | [Assignee] | [e.g., Postman] | [Yes/No] | [Yes / not completed yet] | [GitHub Log URL / Integration Date] |
| IT-UEV-02 | Integration | Attempt to activate an account using a verification link that has expired (older than 24 hours) or has already been used once. Verify the system rejects the activation with an "invalid/expired link" error. | FR-003 | [Assignee] | [Tool] | [Yes/No] | [Yes / not completed yet] | [GitHub Log URL / Integration Date] |
| IT-UEV-03 | Integration | Attempt to register with a malformed .edu email (e.g., user@purdue, user@.edu). Verify the system rejects invalid formats. | FR-003 | [Assignee] | [Tool] | [Yes/No] | [Yes / not completed yet] | [GitHub Log URL / Integration Date] |
| IT-UEV-04 | Integration | Attempt to request multiple verification emails rapidly. Verify rate limiting is enforced to prevent spam/abuse. | FR-003 | [Assignee] | [Tool] | [Yes/No] | [Yes / not completed yet] | [GitHub Log URL / Integration Date] |
