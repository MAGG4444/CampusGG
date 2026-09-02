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
