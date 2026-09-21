# Defect Report 001

**Defect ID:** DEF-001
**Title:** Frontend failed to build with backend API functionality
**Severity:** [High]
*(Note: High = Crashes/Data loss/Security flaws; Medium = Functional failure with workaround; Low = UI issues/Typos)*
**Related Requirement:** [FR-002]
**Related Test Case:** [UI-001]
**Environment:** local host and Github CI build via ubuntu latest version
**Status:** [Closed]

## Description
Our backend seems to not work with our frontend, causing our frontend to fail whenever we build or run locally due to no communication between the two
## Steps to Reproduce
1. Build npm
2. Open the website and see failure between the API and frontend

## Results
*   Once built, we should wee the API and frontende communication on the localhost  but instead we see nothing and a crash occurs

## Evidence
*   (https://github.com/MAGG4444/CampusGG/actions/runs/34629516447)

## Resolution
*   **Suspected Cause:** I realized this happened because I forgot to update the frontend file from last semester when I pushed our backend API from this semester from a different branch (our backend branch)
*   **Fix:** I pushed in the backend branch code for our frontend which was missing
*   **Verification After Fix:** We re-ran and found that our backend API and frontend were communicating!

---

## Root Cause Analysis (RCA)
*(Complete this section ONLY if the Severity is classified as **High**)*

*   **How was the defect discovered?** 
    *   [When running manual test 002 and trying to build it initially. We then re-ran locally and found the same issue]
*   **Which test exposed the issue?** 
    *   [manual-test-002]
*   **How was the fix verified?** 
    *   [Through running locally to ensure our frontend was actually functioning without any crashes and reaching our frontend. We also saw that a line of code which we thought was intended to work with our backend was actually written wrong, so we fixed it with the help of GenAI]
*   **What regression test prevents recurrence of this issue?** 
    *   [UI-002 which will be created to prevent this issue again]
*   **Are there any other portions of the codebase where this issue may still occur?** 
    *   [Not at the moment but if we make silly mistakes like this again then possibly]
