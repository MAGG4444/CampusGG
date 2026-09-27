# Defect Report Template

**Defect ID:** [e.g., DEF-001]
**Title:** [Short, descriptive title of the issue]
**Severity:** [High / Medium / Low] 
*(Note: High = Crashes/Data loss/Security flaws; Medium = Functional failure with workaround; Low = UI issues/Typos)*
**Related Requirement:** [e.g., FR-003]
**Related Test Case:** [e.g., IT-UEV-01]
**Environment:** [e.g., Localhost, Production, Chrome v116]
**Status:** [Open / In Progress / Resolved / Closed]

## Description
[Provide a brief summary of the bug and its impact on the system.]

## Steps to Reproduce
1. [Step 1]
2. [Step 2]
3. [Step 3]

## Results
*   **Expected Result:** [What the system should do]
*   **Actual Result:** [What the system actually did]

## Evidence
*   [Insert links to screenshots, video recordings, or GitHub Actions logs]

## Resolution
*   **Suspected Cause:** [Initial hypothesis for why this is happening]
*   **Fix:** [Describe the code change or configuration adjustment made]
*   **Verification After Fix:** [Explain how the fix was validated]

---

## Root Cause Analysis (RCA)
*(Complete this section ONLY if the Severity is classified as **High**)*

*   **How was the defect discovered?** 
    *   [Response]
*   **Which test exposed the issue?** 
    *   [Response]
*   **How was the fix verified?** 
    *   [Response]
*   **What regression test prevents recurrence of this issue?** 
    *   [Response]
*   **Are there any other portions of the codebase where this issue may still occur?** 
    *   [Response]
