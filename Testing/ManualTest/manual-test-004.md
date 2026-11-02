### Manual Test Report #4

**Test Case ID:** MT-001

**Test Title:** Resend Custom Domain (`notifications.campusgg.net`) OTP Delivery & Verification

**Related Requirement(s):** FR-Auth-1.1 (.edu Verification)

**Tester Name:** Tianyu Du

**Date Executed:** 2026-10-28

**Environment:** Localhost (NestJS, React, PostgreSQL, Redis), Resend API, Chrome

### Preconditions

* DNS records (SPF, DKIM) for `notifications.campusgg.net` are verified in Resend.
* Backend is running with `RESEND_API_KEY` and Redis active for OTP TTL storage.
* User is logged out with access to an unverified `@purdue.edu` email inbox.

### Test Steps

| Step | Action | Expected Result | Actual Result | Pass/Fail |
| --- | --- | --- | --- | --- |
| **1** | Enter a non-`.edu` email (`test@gmail.com`) and click **Send Code**. | System blocks request with a `.edu` domain validation error; no email sent. | Validation error displayed; Resend API not called. | **Pass** |
| **2** | Enter a valid `.edu` email (`du328@purdue.edu`) and click **Send Code**. | Backend hashes 6-digit OTP in Redis, sends email via Resend, and shows OTP input UI. | API returned `200 OK`; UI transitioned to 6-digit code input. | **Pass** |
| **3** | Check the `.edu` email inbox. | Email arrives from `noreply@notifications.campusgg.net` in primary inbox containing the 6-digit OTP. | Email arrived in 3s in primary inbox; SPF/DKIM passed. | **Pass** |
| **4** | Submit an invalid 6-digit code (`000000`). | Backend returns `400 Bad Request`; UI displays "Invalid verification code" error. | Error message displayed; user remained unverified. | **Pass** |
| **5** | Submit the valid 6-digit OTP from the email. | OTP is cleared from Redis, user `isVerified` updates to `true` in DB, and UI redirects to dashboard. | Verification succeeded; DB updated and user redirected. | **Pass** |

### Overall Result

**PASS**

### Evidence & Notes

* **Screenshots/Logs:** 
* **Defects Raised:** None (Issue #122 resolved)
* **Additional Notes:** Custom subdomain (`noreply@notifications.campusgg.net`) bypassed university spam filters and removed Resend sandbox recipient limits.
