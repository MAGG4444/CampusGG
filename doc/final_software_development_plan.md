# CampusGG

**ECE 49595-007 Fall 2026**  
**Relentless III**

Justin Samuel - samuel22@purdue.edu  
Tianyu Du - du328@purdue.edu  
Jingwen Huang - huan1740@purdue.edu

---

## Previous SDP Work and Improvements

## Project Overview

We are building CampusGG as a web application to help university students find reliable teammates through a verified, campus-exclusive forum that integrates real-time gaming stats. [F8]

CampusGG will help students connect with other verified campus gamers through structured Looking for Group posts, lobbies, and teammate recommendations. The system focuses on campus-based gaming communities and supports students who want to find reliable teammates instead of relying only on anonymous public matchmaking platforms. [F4]

---

## Scope

### In Scope

- **University identity verification:** Confirms that users are verified university students.
- **Recommendation system / LFG:** Helps users find compatible teammates.
- **User profile:** Stores games, roles, rank, availability, and preferences.
- **User interface:** Lets users access Home, Connect, Chat, Profile, Forum, and Lobby pages. [F1]
- **LFG post and lobby creation:** Lets users create, view, edit, and join teammate-finding posts.
- **Game filtering:** Lets users search by game, role, rank, and availability.
- **Forum page:** Supports campus gaming discussion.
- **Third-party API integration:** Useful for verified stats, but depends on API access and rate limits.
- **User reporting/blocking:** Helps reduce toxic or unwanted interactions. [F14] [F9]

### Under Evaluation

- **Real-time messaging:** Useful for teammate coordination, but may depend on time.
- **Interactive notifications:** Useful for updates, but depends on messaging and lobby features.
- **User review/reputation system:** Useful for trust, but may be a stretch feature. [F14]

### Out of Scope

- **CampusGG chatbot:** Not required for teammate finding.
- **Ads:** Not part of the MVP.
- **Subscription service:** Monetization is not part of the project scope.
- **Tournament generation:** Too complex for the current timeline.
- **Full native mobile app:** The MVP focuses on the web app first. [F14]

---

## Software Requirements

### Functional Requirements

### ID: FR-001

**Title:** Recommendation System

**Statement:** When a verified user requests teammate recommendations, the system shall display a ranked list of campus users based on selected game, preferred role, rank or skill level, and availability. [F3], [F10]

**Rationale:** Peer recommendation can reduce time-to-team and help students find reliable campus teammates rather than relying on blind matchmaking.

**Test Method:** Create a test dataset of at least 50 verified campus users to execute 20 recommendation requests using different user profiles. Verify each recommended user matches the selected game, the recommendation list is ranked and displayed successfully, at least 80% of the top 5 recommendations match the requester's preferred role and availability criteria.

**Supporting Context:** The “ranked list” is an ordered list of recommended users displayed from best match to lowest match according to the system's matching logic. The MVP recommendation system will use rule-based scoring based on game match, role match, rank similarity, availability overlap, and completed profile information. [F6]

**Trace:** SYS-001 Matchmaking and Recommendation

**Priority:** Must Have

---

### ID: FR-002

**Title:** User-Interface

**Statement:** When a verified user opens the CampusGG web application, the system shall display clear navigation to the Home, Connect, Chat, Profile, Forum, and Lobby Feed pages. [F10]

**Rationale:** A user interface which is simple yet essential will captivate users and allow them to have a pleasant experience working with the page with no issues. The UI is essential for the web page to function as well, as if there is no UI, then there is no web page to work with.

**Test Method:** Open each web page and interact with its intended function 3 times each to ensure proper functioning UI.

**Supporting Context:** Assumes all our more detailed features such as recommendations, notifications, chat, and forum building work as intended.

**Trace:** SYS-002 Website Functionality

**Priority:** Must Have

---

### ID: FR-003

**Title:** University Email Verification

**Statement:** When a new user submits the registration form with an email domain ending in .edu, the system will generate a unique verification link to that email address.

**Rationale:** Restricting access to verified college students is one core value of our project.

**Test Method:** Attempt to register 5 test accounts using various email domains. Verify the system only dispatches the verification email to the .edu addresses.

**Supporting Context:** The verification link must contain a cryptographic token that expires after 24 hours.

**Trace:** SYS-103 User Identity & Authentication

**Priority:** Must Have

---

### ID: FR-004

**Title:** Gaming Statistics Synchronization

**Statement:** When a user successfully links their gaming account, the system retrieves and displays their gaming stats on their profile.

**Rationale:** Accurately displaying a user's verified in-game skill level is essential for other students to evaluate potential teammates and avoid rank mismatches.

**Test Method:** Link a test user account to a sandbox Riot API key associated with a known "Gold 2" Valorant profile. Navigate to the user's CampusGG profile and verify that the "Gold 2" badge and text are visibly rendered.

**Supporting Context:** "Current competitive rank" refers to the specific Elo/MMR bracket returned by the official developer APIs.

**Trace:** SYS-104 Profile & Stats Integration

**Priority:** Must Have

---

### ID: FR-005

**Title:** Messaging Functionality

**Statement:** When users are authorized to communicate, the system shall allow them to exchange messages in chat box in real time and shall store the message history for later retrieval.

**Rationale:** Enables users to coordinate after matchmaking and supports continued communication between teammates within the platform.

**Test Method:** Create 10 pairs of test users and conduct direct messaging sessions between them. Make sure each sent message is delivered to the recipient within 3 seconds.

**Supporting Context:** “Message history” is the previous messages stored by the system and can be viewable in later sessions. Authorized communication means that users are matched, connected, or participating in the same joined lobby. This feature may be implemented after the core LFG, profile, and recommendation features are completed. [F10]

**Trace:** SYS-105 Real-Time Communication

**Priority:** Should Have

---

### ID: FR-006

**Title:** Lobby Card Data Rendering

**Statement:** When a user is viewing the CampusGG Lobby Feed, the system renders individual lobby cards that display the game title/icon, host username, verified university affiliation, desired rank range, current player slot capacity, and an interactive 'Join' button.

**Rationale:** Users need immediate context regarding a lobby's skill requirements and the host's background to determine if it is a suitable match before committing to join.

**Test Method:** Populate the test database with an active lobby hosted by a user affiliated with Purdue University seeking CS2 players with a rank of 'Faceit lv.8-9'. Load the Lobby Feed UI. Verify that the rendered card correctly displays the CS2 identifier, the host's username, a "Verified - Purdue" badge, the "Faceit lv.8-9" requirement, the accurate visual slot fraction (e.g., 3/5), and an enabled 'Join' button.

**Supporting Context:** "Active lobby" refers to a temporary session that has not yet filled its maximum player slots (e.g., 3/5 players for CS2).

**Trace:** SYS-106 Lobby Card

**Priority:** Must Have

---

### ID: FR-007

**Title:** Interactive Notifications

**Statement:** When a user receives a new message, teammate recommendation, or group update, the system shall display an interactive notification and shall allow the user to open the related page directly from the notification.

**Rationale:** This requirement helps users respond quickly to important updates and improves communication between teammates on CampusGG.

**Test Method:** Verify that the correct notification is shown for each event and that selecting the notification opens the correct related page.

**Supporting Context:** The “related page” refers to the page connected to the notification event, such as a message thread, recommendation page, or group discussion page.

**Trace:** SYS-User Notifications

**Priority:** Should Have

---

### ID: FR-008

**Title:** Forum Page

**Statement:** When a user accesses the forum page, the system shall display campus-related posts and shall allow the user to create, view, and reply to forum discussions.

**Rationale:** User interaction on CampusGG. It gives users a place to share posts, ask questions, and connect with other gamers on our campus.

**Test Method:** Verify that the forum page is accessible, interactable, and that it is possible to post a question/comment publicly, privately, anonymously or not. Testing this 4 separate times for each event will prove that it is tested.

**Supporting Context:** Campus-related posts can be anything from current events, or gaming events/tournaments that are upcoming within the users campus.

**Trace:** SYS-Community Forum

**Priority:** Must Have

---

### ID: FR-009

**Title:** Mobile-Responsive Web Interface

**Statement:** When a user accesses CampusGG on a common mobile screen size, the system shall display a mobile-responsive web interface that supports the platform's core features.

**Rationale:** A mobile-responsive interface improves accessibility and allows students to use the web application more conveniently during daily campus life.

**Test Method:** Open the web application on desktop and mobile screen sizes and verify that navigation, profiles, LFG posts, lobby feed, and forum pages remain usable.

**Supporting Context:** A full native iOS or Android application is out of scope for the MVP.

**Priority:** Should Have

---

### ID: FR-010

**Title:** User Review / Reputation System

**Statement:** After a user participates in a lobby or teammate interaction, the system should allow the user to submit a basic review or reputation signal for another user. [F5]

**Rationale:** A review or reputation system can improve accountability and help users identify reliable teammates.

**Test Method:** Complete a test lobby interaction between two users and verify that one user can submit a review for the other user. Confirm that the review is stored and associated with the reviewed user profile.

**Supporting Context:** This feature may be implemented as a stretch feature after the core recommendation, profile, lobby, and verification systems are completed.

**Trace:** SYS-107 User Trust & Reputation

**Priority:** Should Have

---

### ID: FR-011

**Title:** User Reporting and Blocking System

**Statement:** When a user experiences inappropriate behavior, the system shall allow the user to report or block another user or report a forum post. [F7]

**Rationale:** Reporting and blocking help reduce toxicity and support the goal of making CampusGG a safer and more reliable student gaming community.

**Test Method:** Create two test users and verify that one user can block the other user. Create a test forum post and verify that it can be reported. Confirm that reports are stored for moderator review.

**Supporting Context:** Reports may be reviewed by administrators or moderators. Blocking should prevent unwanted direct interaction where supported.

**Trace:** SYS-108 Moderation and Safety

**Priority:** Must Have

---

### ID: FR-012

**Title:** Profile Creation and Editing

**Statement:** When a verified user accesses their profile page, the system shall allow the user to create and edit profile information including games played, skill level, availability, preferred roles, and additional notes.

**Rationale:** User preferences and schedules change over time; profiles must remain dynamic.

**Test Method:** Create a verified test user profile, close and reopen the application, edit the profile fields, save the changes, and verify that the updated games played, skill level, availability, preferred roles, and additional notes persist across sessions.

**Supporting Context:** Profile data feeds into the recommendation system.

**Trace:** SYS-104 Profile & Stats Integration

**Priority:** Must Have

---

### ID: FR-013

**Title:** Structured LFG Post Management

**Statement:** When a verified user accesses the LFG or forum page, the system shall allow the user to create, edit, delete, and view structured LFG posts with fields such as game, rank requirement, and player count.

**Rationale:** This is a core feature enabling users to actively find teammates beyond passive recommendations.

**Test Method:** Create a structured LFG post with game, rank requirement, and player count fields. Edit the post and verify that the updated information appears correctly. Delete the post and verify that it no longer appears in the LFG or forum feed.

**Supporting Context:** This requirement extends forum functionality with structured matchmaking.

**Trace:** SYS-Community Forum

**Priority:** Must Have

---

### ID: FR-014

**Title:** Lobby Creation and Join Management

**Statement:** When a verified user accesses the Lobby page, the system shall allow the user to create a lobby, set the game title, rank requirement, maximum player count, and lobby description, and allow other verified users to join the lobby until the maximum player count is reached.

**Rationale:** Lobby creation allows users to form active teammate groups. This supports real-time team formation beyond static posts.

**Test Method:** Create a test lobby with a game title, rank requirement, maximum player count, and description. Verify that the lobby appears in the Lobby Feed. Join the lobby using additional verified test users and confirm that the player count updates correctly. Verify that users cannot join once the lobby reaches the maximum player count.

**Supporting Context:** A lobby is an active teammate group with a limited number of player slots. This differs from an LFG post because an LFG post is a structured request, while a lobby tracks active joining and player capacity.

**Trace:** SYS-106 Lobby Card

**Priority:** Must Have

---

## Non-Functional Requirements

### ID: NFR-001

**Title:** Data Privacy

**Statement:** If a user initiates the "Delete Account" action from their profile settings, then the system shall permanently purge their .edu email, linked API tokens, and identifiable profile data from the primary database within 24 hours.

**Rationale:** Handling student data requires strict adherence to privacy principles. Users must have a guaranteed, verifiable way to scrub their identity and third-party gaming links from the platform if they graduate or decide to stop using CampusGG.

**Test Method:** Create a test user with a linked Riot Games account and several active LFG posts. Trigger the account deletion endpoint. Query the backend database directly. Verify the user's record in the User table is deleted, their record in the AuthTokens table is dropped, and their name on historical LFG posts is replaced with a generic "[Deleted User]" string.

**Supporting Context:** Unwanted behavior

**Trace:** SYS-103 User Identity & Authentication

**Priority:** Should Have

---

### ID: NFR-002

**Title:** Brute-Force Login Protection

**Statement:** If an unauthenticated user or IP address triggers 5 consecutive failed login attempts within a 15-minute window, then the system shall temporarily lock the target account and block further authentication attempts from that specific IP address for 30 minutes.

**Rationale:** Because CampusGG uses verified .edu emails, bad actors might attempt credential stuffing or brute-force attacks to hijack verified student accounts. Implementing rigorous rate-limiting on authentication endpoints is a fundamental computer security practice to protect user identities.

**Test Method:** Write an automated script that attempts to log into a test account using an incorrect password 5 times in rapid succession. Verify that on the 6th attempt (even if using the correct password), the system returns a "Temporarily Locked" message.

**Supporting Context:** Unwanted behavior.

**Trace:** SYS-103 User Identity & Authentication

**Priority:** Should Have

---

### ID: NFR-003

**Title:** Accessibility

**Statement:** The system shall provide an accessible user interface across all main user screens by supporting keyboard navigation, readable text contrast, alternative text for meaningful images, and properly labeled interactive elements.

**Rationale:** Accessibility helps ensure that all users, including those with disabilities, can effectively use CampusGG. It also improves overall usability and makes the platform more inclusive for a wider range of students.

**Test Method:** Test all main user screens using keyboard-only navigation and verify that users can access major features without a mouse. Check that normal text has a contrast ratio of at least 4.5:1, meaningful images include alternative text, and all buttons, forms, and links have clear labels. The requirement passes if all main screens meet these checks with no critical accessibility failures. [F11]

**Supporting Context:** Users may interact with the platform using assistive technologies or alternative input methods. These accessibility checks are intended to align with common WCAG and ADA accessibility expectations for web interfaces. [F11]

**Trace:** SYS-009 User Interface

**Priority:** Should Have

---

### ID: NFR-004

**Title:** Stability Under High Traffic

**Statement:** If the system experiences high user activity, the website shall remain available and responsive under a simulated load of up to 1000 concurrent users. [F2]

**Rationale:** CampusGG may experience high traffic during peak gaming times, campus events, or popular LFG periods. The system should remain stable enough for users to browse profiles, view lobbies, and use core features.

**Test Method:** Run a stress test that gradually increases simulated traffic from 0 to 1000 concurrent users, maintains the peak load for 5 minutes, and then decreases traffic back to 0. Verify that the application remains available and does not crash during the test.

**Supporting Context:** This test focuses on general availability and stability rather than guaranteeing full production-level scalability.

**Trace:** SYS-002 Website Functionality

**Priority:** Should Have

---

## Deliverables

### Deliverable: CampusGG Web Application

A production-ready web application that includes the main user-facing screens for Home, Connect, Chat, Profile, Forum, and Lobby Feed. This deliverable includes the deployed frontend interface, backend services, database connection, authentication workflow, profile management, LFG/lobby features, recommendation logic, gaming statistics integration, forum interaction, and user safety features required for core user interaction. [F12]

**Requirements:** FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012, FR-013, FR-014, NFR-001, NFR-002, NFR-003, NFR-004

### Supporting Components

1. **User Authentication and Verification Component**  
   Supports user registration, login, and .edu email verification through expiring verification links.

2. **User Profile and Gaming Statistics Component**  
   Supports profile creation, profile editing, linked gaming statistics, and verified rank display.

3. **Matchmaking and Recommendation Component**  
   Processes selected game, preferred role, rank or skill level, and availability data to generate ranked teammate recommendations.

4. **LFG posts and lobbies**  
   Allows users to create, view, edit, and delete structured LFG posts, and create, view, and join lobbies.

5. **Forum and Safety Component**  
   Supports forum discussions, user reporting, blocking, and basic moderation support.

6. **Messaging and Notification Component**  
   Supports direct messaging, message history, and event-triggered notifications if implemented within the final project scope.

---

## Standards

### 1. ISO 25010

https://iso25000.com/index.php/en/iso-25000-standards/iso-25010

This standard is applicable to our project because the qualities are directly related to our system's main features, including teammate recommendation, messaging, login, and profile management. It will guide us to design features that are correct and complete, keep response times fast, and make the interface easy to use. We will map our requirements and tests to the relevant standard quality characteristics. For example, we will use response-time tests for performance efficiency and email security checks for authentication.

### 2. ISO/IEC/IEEE 29148-2018 - Systems and software engineering - Life cycle processes - Requirements engineering

https://ieeexplore.ieee.org/document/8559686

Because we need clear and testable software requirements.

It will guide us to write better requirements before coding begins. This will help us design the right features and avoid vague requirements. We will write each requirement in a clear and testable format and connect it to system goals and test cases.

### 3. Digital Identity Guidelines: Authentication and Authenticator Management

https://csrc.nist.gov/pubs/sp/800/63/b/4/final?utm_source=chatgpt.com

Because the platform includes account registration, login, university email verification, and user account protection. It will affect how we design login, verification, and password protection. We will review our registration, email verification flows against the standard and test whether passwords are stored securely.

---

## Evidence

| Feedback ID | Feedback Source | Feedback Received | Change Made |
|---|---|---|---|
| F1 | Peer feedback | The scope did not clearly include the user interface, even though UI is central to user interaction. | Added Core Web User Interface to the In Scope section and clarified the main navigation pages. |
| F2 | Peer feedback | The project should consider stability under high traffic, such as many concurrent users. | Added NFR-004 Stability Under High Traffic with a stress test using up to 1000 concurrent users. |
| F3 | Peer feedback | Schedule compatibility, game options, and filtering were not clearly addressed. | Expanded FR-001 so recommendations are based on selected game, preferred role, rank or skill level, and available time. |
| F4 | Peer feedback | The relationship between the forum, LFG posts, and the recommendation algorithm was unclear. | Clarified that the forum supports community interaction while LFG/lobby features support structured teammate finding. |
| F5 | Peer feedback | Structured LFG posts and trust/accountability features were not clearly reflected in the SDP. | Added User Review / Reputation System as a Should Have feature and described it as a stretch accountability feature. |
| F6 | Peer feedback | The recommendation algorithm was vague and did not say whether it was rule-based or machine learning. | Added supporting context to FR-001 explaining that the MVP recommendation system will use rule-based scoring. |
| F7 | Peer feedback | Reporting and blocking should be added to reduce toxicity and improve user safety. | Added FR-011 User Reporting and Blocking System as a Must Have requirement. |
| F8 | Course staff feedback | Missing the medium info, an app? a web app? mobile app? | Clarified in the Project Overview that CampusGG is primarily a web application, changed FR-009 from Mobile Application to Mobile-Responsive Web Interface, and identified full native mobile apps as out of scope for the MVP. |
| F9 | Course staff feedback | The answers are only stated for in scope, out of scope and under eval, without explanation. Also, the elements mentioned in functional requirements are not described here in scope like post making, and many others covered in functional requirements. work to be done here. | Expanded the Scope section with explanations and added missing items such as post creation, lobby creation, profile features, reporting/blocking, game filtering, and third-party API integration. |
| F10 | Course staff feedback | Several functional requirements did not use clean single EARS-style statements, especially FR-001 and FR-002; FR-005 did not define authorization clearly. | Revised FR-001 and FR-002 into cleaner requirement statements and clarified in FR-005 that authorized communication means users are matched, connected, or in the same joined lobby. |
| F11 | Course staff feedback | NFR-003 Accessibility was missing measurable testing metrics and pass/fail criteria. | Updated NFR-003 to include measurable accessibility checks such as keyboard navigation, contrast ratio, alternative text coverage, labeled inputs/buttons, and WCAG/ADA-aligned pass criteria. |
| F12 | Course staff feedback | Comprehensive, since internal modules aren't visible to the stakeholders, the deliverable will be a self-contained app. these subsystems are part of your design rather than the deliverable. | Revised the Deliverables section to emphasize the self-contained CampusGG web application as the primary deliverable, with internal modules described as supporting components. |
| F13 | Individual reflection | We identified that users need a way to create and update profile information because recommendations depend on current user preferences and availability. | Added FR-012 Profile Creation and Editing as a Must Have requirement and connected profile data to the recommendation system. |
| F14 | Individual reflection | Identified that structured LFG posts are necessary because users need an active way to find teammates beyond passive recommendations. | Added FR-013 Structured LFG Post Management as a Must Have requirement, including create, edit, delete, and view actions for structured LFG posts. |
| F15 | Course staff feedback | Missing User Profile creation, lobby creation, user reporting/blocking which is the core thing this app is trying to solve. Overlapping with previous feedback, the primary focus of the revisions is on lobby creation. | Added FR-012 Profile Creation and Editing, FR-011 User Reporting and Blocking System, and FR-014 Lobby Creation and Join Management as Must Have requirements. |

---

## Development Methodology

Waterfall fits our CampusGG project because we already have clearly defined features like the forum system, matchmaking, chat, and user profiles. Our workflow in this course follows structured milestones (Requirements, components, and deployment), which aligns well with Waterfall's phase-based approach. To mitigate its lack of flexibility, we will include iterative testing within each phase and allow small feedback loops before fully moving forward.

### Project Task Mapping (Waterfall Phases)

1. **Requirements Phase**
   - Define system requirements (FRs + NFRs)
   - Finalize UI/UX design for 4 tabs (Home, Connect, Chat, Profile)

2. **Design Phase**
   - Design system architecture (frontend, backend, APIs)
   - Database schema design (users, posts, connections)

3. **Implementation Phase**
   - Build frontend (React / UI pages)
   - Develop backend APIs (Node/NestJS)
   - Implement authentication system

4. **Integration Phase**
   - Connect frontend to backend APIs
   - Integrate database (AWS RDS)
   - Add real-time chat (WebSockets)

5. **Testing Phase (Iterative across phases)**
   - Test user flows (login, posting, matchmaking)
   - Debug system integration issues
   - Perform performance and security testing

6. **Deployment Phase**
   - Deploy application to cloud (AWS)
   - Final system validation + demo prep

---

## Verification and Validation Plan

[Verification & Validation - Relentless III](https://github.com/MAGG4444/CampusGG/blob/main/doc/Verification%20%26%20Validation%20-%20Relentless%20III.pdf)

---

## Gantt Chart

[Final Gantt Chart](https://drive.google.com/file/d/17vdCs4DEqUwlng0kaNw3kNW3s2bIaq6B/view?usp=sharing)
