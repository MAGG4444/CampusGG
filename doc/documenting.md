## Repository Architecture

The CampusGG repository currently contains the main application within our 'frontend', along with a separate 'campusgg-backend' directory for the backend. The backend uses **NestJS and TypeScript** and is organized around individual features. Frontend uses **HTML and CSS** and will later include **Javascript** files for enhanced functionality later on. We will update our structure once we include the file.

### Repository Structure

```text
CampusGG/
├── campusgg-backend/
│   ├── src/
│   │   ├── lobbies/
│   │   │   └── lobbies.controller.ts
│   │   ├── app.controller.ts
│   │   ├── app.service.ts
│   │   └── main.ts
│   ├── test/
│   │   ├── app.e2e-spec.ts
│   │   └── jest-e2e.json
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── tsconfig.build.json
│   ├── nest-cli.json
│   └── README.md
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── assets/
│       └── LOGO.png
├── doc/
│   ├── Design Document - Relentless III.pdf
│   ├── Verification & Validation - Relentless III.pdf
│   ├── final_software_development_plan.md
│   └── documenting.md (this current file)
├──.gitignore
└──README.md
```

## Branching & Workflow Model
*   **Main Branches:** We utilize two main branches for our workflow.
    *   `main`: Represents the stable, production-ready release.
    *   `dev`: Acts as our integration branch where all newly approved features are merged before release.
*   **Branch Naming Convention:** Branches must follow the `[type]/[issue-number]-[short-description]` format. Examples include `feature/6-matchmaking-logic` or `bugfix/3-email-verification`.
*   **Cleanup Policy:** To avoid branch proliferation, all feature branches will be deleted immediately after they are successfully merged into `dev` or `main`.


## Pull Request Process
*   **PR Naming Convention:** 

    We decided to use the format `[Area]-[Feature]-[issue number]-[short_description]` for PR titles. This helps team members quickly identify which part of the project the PR affects, what feature it belongs to, and which issue it is connected to. Example: `F-Lobby-23-Add_game_filter`

    Also, each feature is assigned a number. If the same feature is updated later, a decimal version number is added to show that it is a follow up change. For example: `F-lobby-3.1-update_game_filter`. 
    Here, `F` means `Frontend`, `lobby` identifies the feature area, and the number identifies the specific feature and its later revisions.
*   **Linking Issues to PR:** 

    Each pull request should include `For issue #` in the PR description to indicate the related issue. If the PR completely resolves the issue, `Closes #` can be used instead so that GitHub automatically closes the issue after the PR is merged.
*   **Code Review and Merging Policy:** 

    * Code Review: Every pull request must be reviewed by at least one team member before it is merged.

    * Testing: The code should pass basic tests, such as build, lint, and function checks, before merging.

    * Weekly Review: Once a week, the team will check each other's recent work, run the project together, and look for bugs, missing functions, or other problems. Any problems found will be recorded as GitHub Issues for the team to fix.

    * Merging: Approved feature pull requests will be merged into `dev`. Stable changes will later be merged from `dev` into `main`.