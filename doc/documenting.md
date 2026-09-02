## Repository Architecture:


## Branching & Workflow Model
*   **Main Branches:** We utilize two main branches for our workflow.
    *   `main`: Represents the stable, production-ready release.
    *   `dev`: Acts as our integration branch where all newly approved features are merged before release.
*   **Branch Naming Convention:** Branches must follow the `[type]/[issue-number]-[short-description]` format. Examples include `feature/6-matchmaking-logic` or `bugfix/3-email-verification`.
*   **Cleanup Policy:** To avoid branch proliferation, all feature branches will be deleted immediately after they are successfully merged into `dev` or `main`.


## Pull Request Process
