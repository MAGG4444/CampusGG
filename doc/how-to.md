# How-To: CampusGG

CampusGG is a web application where college students can discuss games and find people to play with. This guide provides task-based instructions for people using the website and for developers working with the code.

- **Live website:** [https://campusgg.net](https://campusgg.net)
- **Source repository:** [MAGG4444/CampusGG](https://github.com/MAGG4444/CampusGG)

---

## End-User How-To Guides

### 1. How to create and verify a CampusGG account

**Purpose:** Register an account so you can create posts, reply to discussions, and participate in gaming lobbies.

**Before you begin:** Have access to a college email address ending in `.edu` and a web browser.

**Steps:**

1. Open [CampusGG](https://campusgg.net) and select **Sign Up**. You can also go directly to `/signup` on the website.
2. Enter your **.edu Email**, **Username**, and **Display Name**.
3. Enter a **Password** and repeat it in **Confirm Password**.
4. Submit the registration form to create the account.
5. On the email-verification page, follow the displayed instructions to verify your email address. Check the inbox for the address you registered with.
6. Once verification is complete, open **Sign In** and log in with your credentials.

**Expected result:** You have a verified account and can access authenticated CampusGG features.

**If something goes wrong:** Check that the email ends in `.edu`, the two passwords match, and the verification message has not been filtered into spam. If a form error appears, correct the highlighted field and try again.

### 2. How to create a forum post

**Purpose:** Ask a gaming question, share a strategy, or start a discussion with other students.

**Before you begin:** Sign in to your CampusGG account.

**Steps:**

1. Open the **Forum** section or visit `/forum`.
2. Click **+ Create Post**.
3. Enter a descriptive **Post title**.
4. Optionally add a **Short description** and the name of the **Game**.
5. Choose a tag if it helps describe your post, and enter your main message in **Post content**.
6. Keep **Visibility** set to **Public**. Private-post publishing is not currently supported.
7. Click **Publish**. To finish later instead, click **Save** and use **My Drafts** to return to it.

**Expected result:** The new post opens on its own forum page and is available in the public forum.

**If something goes wrong:** Fill in any required fields identified by the form. If publishing fails, confirm that you are signed in and refresh the page before retrying.

### 3. How to reply to a forum post

**Purpose:** Respond to a question or contribute to an existing discussion.

**Before you begin:** Sign in and find a forum post you want to discuss.

**Steps:**

1. Open **Forum** and select the post by clicking its title or post card.
2. Read the post and scroll to the reply area.
3. Type your response in the **Reply Post** text box.
4. Click **Reply** to submit your comment.
5. To reply in the context of another comment, use the available reply action beside that comment, enter your message, and submit it.

**Expected result:** Your reply appears in the post's discussion.

**If something goes wrong:** Make sure your reply is not empty and that your login session is still active. Reload the discussion to check whether the comment was saved before submitting it again.

### 4. How to create a gaming lobby

**Purpose:** Set up a space for other students to find and join a gaming session.

**Before you begin:** Sign in to CampusGG and decide what game or activity the lobby will be for.

**Steps:**

1. Open **Lobby** or visit `/lobby`.
2. Click **+ Create Lobby**.
3. Enter a **Lobby name**, and fill in the **Details** describing the session.
4. Add a subtitle or relevant tags if desired.
5. Choose a participant limit, or leave it **Unlimited**.
6. Select the visibility setting that matches your intended audience.
7. Review the form and click **Publish**. Use **Save** if you want to keep an unfinished lobby as a draft.

**Expected result:** CampusGG returns you to the lobby feed, where the newly published lobby can be found.

**If something goes wrong:** Check the required name and details fields, confirm that you are signed in, and follow any validation message shown on the form.

### 5. How to find and join an existing lobby

**Purpose:** Find other students playing a game that interests you.

**Before you begin:** Sign in to CampusGG. An available lobby must exist for the game or session you want.

**Steps:**

1. Go to **Lobby** on the website.
2. Use the game filter to narrow the list to a particular game.
3. Use the additional filter or search bar to narrow the results further.
4. Select a lobby to review its details, including any participant limit or joining requirements.
5. Click the lobby's **Join** action if you want to participate.
6. Open the lobby detail page to confirm that you joined successfully.

**Expected result:** You can access the selected lobby as a participant, provided that joining is allowed and space is available.

**If something goes wrong:** Try a different lobby if the selected one is full. If you are redirected to the sign-in page, log in and attempt to join again.

### 6. How to save and reopen an unfinished post or lobby

**Purpose:** Continue editing content without publishing it immediately.

**Before you begin:** Open the **Create Post** or **Create Lobby** page and begin entering content.

**Steps:**

1. Fill in the fields you want to keep.
2. Click **Save** rather than **Publish**.
3. Open **My Drafts** from the editor, or visit `/my-content?tab=drafts`.
4. Find your saved post or lobby draft and reopen it.
5. Make any remaining changes.
6. Click **Save** again to keep editing later, or **Publish** when the content is ready.

**Expected result:** Your unfinished content is available through the drafts interface and can be edited before publication.

**If something goes wrong:** Return to the same browser and account used to save the draft. Avoid clearing site data until you have confirmed how the draft is stored.

---

## Developer How-To Guides

### 1. How to download CampusGG and install its dependencies

**Purpose:** Get a local copy of the project ready for development.

**Before you begin:** Install Git, Node.js and npm. The commands below use a terminal on macOS, Linux, or a compatible shell.

**Steps:**

1. Clone the team repository and open its main directory:

   ```bash
   git clone https://github.com/MAGG4444/CampusGG.git
   cd CampusGG
   ```

2. Install the backend dependencies:

   ```bash
   cd campusgg-backend
   npm ci
   ```

3. Install the frontend dependencies in a second terminal, or return to the project root first:

   ```bash
   cd ../campusgg-frontend
   npm ci
   ```

4. Check that the expected commands are available:

   ```bash
   node --version
   npm --version
   ```

**Expected result:** Both `campusgg-backend/node_modules` and `campusgg-frontend/node_modules` are installed, with no dependency-installation errors.

**If something goes wrong:** Run each `npm ci` command from the directory containing that application's `package.json` and lockfile. Do not run the frontend or backend scripts from the repository's root `package.json`.

### 2. How to configure PostgreSQL and the backend environment

**Purpose:** Connect the NestJS API to a local PostgreSQL database.

**Before you begin:** Complete the dependency-installation task and have PostgreSQL installed, running, and accessible with a database administrator account.

**Steps:**

1. Open a PostgreSQL administration terminal. For example, on a system with a `postgres` administrator role:

   ```bash
   psql -U postgres
   ```

2. Create a local application role and database. Use a password of your own in place of `choose-a-local-password`:

   ```sql
   CREATE USER campusgg WITH PASSWORD 'choose-a-local-password';
   CREATE DATABASE campusgg OWNER campusgg;
   ```

3. Exit `psql` with `\q`.
4. From the repository root, copy the backend environment template:

   ```bash
   cd campusgg-backend
   cp .env.example .env
   ```

5. Open `campusgg-backend/.env` and set the following values to match your local PostgreSQL installation:

   ```dotenv
   DATABASE_URL="postgresql://campusgg:choose-a-local-password@localhost:5432/campusgg"
   NODE_ENV=development
   REDIS_ENABLED=false
   ```

6. Keep other settings from `.env.example` unless you need to change them. Do not commit `.env` or share real database passwords.

**Expected result:** The backend has a valid local database connection string. With `NODE_ENV=development`, the application's TypeORM configuration can synchronize its entities when the API starts.

**If something goes wrong:** Verify that PostgreSQL is running, the database and username match `DATABASE_URL`, the credentials are correct, and port `5432` is available. If your administrator username is not `postgres`, use your own PostgreSQL administrator account in step 1.

### 3. How to start the backend and frontend locally

**Purpose:** Run CampusGG on your computer for development and manual testing.

**Before you begin:** Install the dependencies and configure PostgreSQL and the backend `.env` file.

**Steps:**

1. From the repository root, start the backend API in the first terminal:

   ```bash
   cd campusgg-backend
   npm run start:dev
   ```

2. Leave that terminal open. The NestJS API should be accessible at `http://localhost:3000`.
3. From the repository root, open the frontend project in a second terminal:

   ```bash
   cd campusgg-frontend
   ```

4. Create a local frontend `.env` file with the backend address:

   ```dotenv
   VITE_API_URL=http://localhost:3000
   ```

5. Start Vite:

   ```bash
   npm run dev
   ```

6. Open the local URL shown by Vite, normally `http://localhost:5173`. Visit **Forum** or **Lobby** to confirm that content can load from the backend.

**Expected result:** The React frontend and NestJS backend are running in separate terminals, and browser requests reach the local API.

**If something goes wrong:** If the site opens but posts or lobbies do not load, check the backend terminal for database errors and verify `VITE_API_URL`. Restart Vite after changing the frontend `.env` file. If a port is occupied, stop the conflicting process before retrying.

### 4. How to check the backend API from a terminal

**Purpose:** Confirm that the local server can respond to requests independently of the frontend.

**Before you begin:** Start the backend and make sure its PostgreSQL connection succeeds.

**Steps:**

1. Open another terminal while the backend remains running.
2. Request the forum's published-post list:

   ```bash
   curl -i "http://localhost:3000/forum/posts?page=1&limit=10"
   ```

3. Request the lobby list:

   ```bash
   curl -i "http://localhost:3000/lobbies"
   ```

4. Check the returned HTTP status and response data. An empty list is acceptable if no content has been created yet.
5. If a request fails, review the output in the backend terminal, correct the issue, and repeat the request.

**Expected result:** Both read endpoints return successful HTTP responses with data in JSON format. Requests requiring login or mutation must be made with the appropriate authentication token.

**If something goes wrong:** A connection error usually means the backend is not running on port `3000`. A server error may indicate an unavailable database. A `401 Unauthorized` response on a protected endpoint indicates that valid authentication is required.

### 5. How to run automated tests and code checks

**Purpose:** Catch regressions before opening a pull request.

**Before you begin:** Install dependencies for both applications.

**Steps:**

1. From `campusgg-backend`, execute the Jest test suite:

   ```bash
   npm test -- --runInBand
   ```

2. Check that the test output reports passing suites or review any failures.
3. From `campusgg-frontend`, run its test script:

   ```bash
   npm test
   ```

4. In the frontend directory, also run the lint check:

   ```bash
   npm run lint
   ```

5. Resolve relevant errors before committing changes. Run the checks again after making fixes.

**Expected result:** The test runners complete without failures and the frontend lint check reports no blocking errors.

**If something goes wrong:** Make sure `npm ci` completed successfully and the commands are being run from the correct application directory. Review the failing test name and the associated source file before making changes.

### 6. How to build CampusGG before a release

**Purpose:** Verify that both applications can produce build output suitable for deployment.

**Before you begin:** Install dependencies, complete the relevant configuration, and resolve known test failures.

**Steps:**

1. Build the backend from `campusgg-backend`:

   ```bash
   npm run build
   ```

2. Confirm that the generated backend entry point exists in `dist/`.
3. Build the frontend from `campusgg-frontend`:

   ```bash
   npm run build
   ```

4. Confirm that the frontend generated a `dist/` directory.
5. Optionally preview the built frontend locally:

   ```bash
   npm run preview
   ```

6. Before deploying, ensure the frontend was built with the correct production API URL and that the production server has appropriate database credentials and environment settings.

**Expected result:** The backend compiles and the frontend produces static build files, with no build errors.

**If something goes wrong:** Check the first error in the build output, confirm the correct Node.js and npm versions are installed, and repeat `npm ci` if dependencies are missing. A successful build does not by itself confirm that the deployed database or API is reachable.

---

## Generative AI Usage Statement

ChatGPT was used to draft the initial headings, step-by-step instructions, troubleshooting notes, and command examples in both the end-user and developer how-to sections. The draft was cross-checked against the CampusGG repository's frontend routes, form labels, package scripts, and backend configuration.
