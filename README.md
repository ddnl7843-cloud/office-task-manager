# PaisaFin Task Manager

A React + Vite frontend and Node.js + Express backend for an office task management system.

## What this app does

- employee and admin login
- task creation and assignment
- progress tracking
- help requests
- completion requests and approvals
- notifications
- reports
- permissions
- activity log
- settings
- expense claims, reimbursement approvals, kilometre rates, and reports
- SMTP-based email notifications

## Existing architecture and data

- Frontend: React 19 + Vite + TypeScript.
- Backend: Express running in the same Node.js process.
- Authentication: app-managed sessions stored in the JSON database; passwords are PBKDF2 hashes.
- Source of truth: `data/office_tasks_db.json`; the server writes this file directly.
- Email: existing server-side Nodemailer/Hostinger SMTP integration.
- A new database requires `INITIAL_ADMIN_PASSWORD` (10+ characters) for the initial admin. It is never a fixed default; the seeded employee accounts receive random undisclosed passwords and can be reset by the admin. Unset the bootstrap variable after the first successful initialization.

### Supabase status

Supabase is not connected to this app. The Hostinger instructions alone do not provide a verified runtime URL/key in this project, Supabase schema/table mapping, migration, or RLS policies. Adding an SDK and a `db.js` beside `package.json` would create a second, unused data source beside the existing JSON store, so it is intentionally not done. Do not point production reads/writes to Supabase until there is an approved schema mapping, backup, migration and rollback plan, and tested RLS. Never put a service-role key or SMTP credential in browser code.

## Admin and employee workflows

- **Admin:** sign in with an active account; use User Management to search/filter users, edit name/email/role/status, create accounts, and reset passwords. Accounts are deactivated rather than deleted so task history remains linked. Use Role Permissions to change role grants or select another user and set each override to inherit, allow, or deny. The current signed-in user cannot edit their own override, and critical admin management rights are protected.
- **Branding:** administrators with `MANAGE_SETTINGS` can open Branding Settings to change the company/application name, preview a logo, save it, or restore defaults. Logo uploads are limited to PNG, JPEG, or WebP up to 1 MB and are validated on the server; SVG is rejected. Uploaded files are stored outside the static web root under `data/branding/` and exposed only through a read-only image endpoint with a generated filename. Back up this folder together with the JSON database; it is ignored by Git.
- **Employee:** use My Tasks and the dashboard to view tasks permitted by the account, update assigned-task progress, request help, comment, and submit a 100%-complete task for approval. Task and comment APIs verify task access on the server.
- **Signup requests:** a person can request an employee account from the sign-in page using their name, email, and password. The server creates the account in `PENDING` status with employee-only role; it cannot sign in until an administrator with User Management permission approves it. Admins can review pending requests under User Management and select **Approve**; declined requests can be set inactive. Duplicate email addresses are rejected.
- **Expenses:** employees with expense access can save a draft, attach a receipt, and submit a claim; submitted claims cannot be edited, while rejected claims can be corrected and resubmitted. Kilometre claims are calculated by the server using the latest matching rate effective on the expense date, and the rate/calculation is retained on the claim. Authorized reviewers can take claims under review and approve or reject them with a reason; approval never marks a claim paid. Authorized payers mark approved claims paid separately. Expense dashboards and reports are scoped to the user's permissions, and CSV reports are available to authorized report users.
- **Expense settings:** administrators with expense-settings permission can configure categories, receipt requirements, claim limits, approval thresholds, and effective-dated rates per vehicle/category. New per-kilometre claims require a configured matching rate; kilometre drafts can be saved while settings are being prepared. Expense receipts are stored outside the public static directory under `data/expense-receipts/`; back up this folder with the JSON database. The folder is ignored by Git.
- Permission changes are resolved from the latest saved role and user override on each API request. The client refreshes its session permissions when data refreshes.
- Branding values are stored in the existing JSON settings record and served to the login/app header, browser title, email templates, and a dynamic PWA manifest. The app name defaults to PaisaFin Task Manager.
- The test-email control and endpoint have been removed. Real assignment, help, completion-request, and approval/rejection email functions remain server-side and use the existing SMTP environment variables.

## Mobile app install from link (no Play Store)

This app is built as a web app, so users can install it directly from a browser link instead of going through the Play Store.
The installed app is named **PaisaFin** and uses the PaisaFin logo on Android and iOS home screens.
After the first open of a release that includes app-update support, the installed app checks for newer releases. The current version continues working while a new version downloads; an **Update now** button appears only when the new version is ready. Tapping it activates the update and reloads the app—users do not need to uninstall and reinstall. If the button does not appear immediately after deployment, reopen the app while online and allow the update check to finish.
The install instructions/link are shown only in a browser, not in the installed app. A Share button remains available from the sign-in page and app header; it opens the device share sheet where supported, otherwise it copies the app link.

### Easy steps for Android

1. Open the app link in Chrome on the phone.
2. Tap the 3-dot menu button in the top-right corner.
3. Choose Install app or Add to Home screen.
4. Tap Install and then open the app from the home screen.

### Easy steps for iPhone / iPad

1. Open the app link in Safari.
2. Tap the Share button at the bottom of the screen.
3. Select Add to Home Screen.
4. Tap Add, then open the app from the home screen.

### Important setup for this to work

- Use a live HTTPS URL, not a local file.
- Keep the app hosted on a public web domain or server.
- Make sure the browser can access the web manifest and app icon.

## Local development

1. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```

2. Create a local environment file from the template:
   ```bash
   copy .env.example .env
   ```
   or on macOS/Linux:
   ```bash
   cp .env.example .env
   ```

3. Fill in the real SMTP values in `.env`.

4. Start the app:
   ```bash
   npm run dev
   ```

5. Open:
   ```text
   http://localhost:3000
   ```

## Production build

Build command:
```bash
npm run build
```

Start command:
```bash
npm run start
```

This app serves both the React frontend and the Express API from the same Node.js process.

## Hostinger Node.js Web App deployment

### Recommended setup

- use the existing Hostinger Business Web Hosting
- deploy to a separate subdomain such as `task.paisafin.com`
- manage the domain's DNS records in Cloudflare when the domain uses Cloudflare nameservers
- keep `paisafin.com` untouched and unchanged
- do not mix this app with the existing main website files

### Use this build/start configuration in Hostinger

Build command:
```bash
npm run build
```

Start command:
```bash
npm run start
```

Node.js version recommendation:
```text
20 LTS
```

### Required environment variables

Set these in Hostinger's environment variables panel. For Hostinger Webmail, `SMTP_USER` must be the full mailbox email address, not just the mailbox name.

```env
PORT=3000
APP_URL=https://fintask.paisafin.com
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=notifications@paisafin.com
SMTP_PASS=your-hostinger-webmail-password
SMTP_FROM_NAME=PaisaFin Task Management
SMTP_FROM_EMAIL=notifications@paisafin.com
```

If your Hostinger account uses port 587 instead of 465, keep `SMTP_SECURE=false` and `SMTP_PORT=587`.

For a brand-new installation only, set `INITIAL_ADMIN_PASSWORD` to a unique 10+ character bootstrap password before the first start. After the JSON database has been created, unset it. Do not set/reset this variable to recover an existing database; use the in-app admin reset workflow instead. Never commit `.env` or any real password to GitHub.

## GitHub setup

1. Create a GitHub repository named `office-task-manager`
2. Push this project to GitHub
3. Connect the repo to Hostinger Node.js Web App deployment
4. Keep `.env` local only
5. Store all secrets in Hostinger environment variables, not in source code

## Safe release and rollback

Before pushing or redeploying, make a private, verified backup of `data/office_tasks_db.json` from the running Hostinger instance and keep it outside the repository. Confirm Hostinger persists this writable data path across builds/restarts. The JSON file is currently tracked in this repository; `.gitignore` alone does not remove an already-tracked file. Review the repository's access and commit history before sharing it publicly, and arrange a careful history/data cleanup if it contains production data.

For a release from PowerShell:

```powershell
git status
git add <reviewed-source-files>
git commit -m "Prepare task manager handover"
git push origin <branch>
```

In Hostinger, select the matching branch, set Node.js 20 LTS, `npm run build`, and `npm run start`, configure the existing SMTP variables in the server runtime, and redeploy. Check the deployment logs and sign in with an authorized account. Do not send a test email as part of automated validation.

If the deployment fails, redeploy the previous known-good Git revision and restore the pre-deployment JSON backup only if the new build changed or damaged the data file. Keep a copy of the post-failure file before any restore, compare the versions, then verify login and representative task records. This app has no database migration in this release.

## Tests

Run the focused automated suite with:

```bash
npm test
```

It covers the permission resolver and existing mobile-install helper tests. It does not connect to Supabase, exercise the Express routes end-to-end, or send SMTP messages.

## Subdomain and SSL

Use the existing app subdomain:
```text
fintask.paisafin.com
```

Keep the app hosted on Hostinger, but manage DNS wherever the domain's active nameservers point. If the domain uses Cloudflare nameservers:

1. In Cloudflare, add the subdomain record Hostinger specifies for the Node.js app. This is commonly an `A` record to the server IP or a `CNAME` to a Hostinger-provided hostname; use the exact target shown in Hostinger.
2. Do not change the existing root-domain (`@`) record if the main website should stay as it is.
3. In Hostinger, attach the subdomain to the Node.js app and enable its SSL certificate. DNS changes can take time to propagate.
4. Set `APP_URL` in Hostinger's environment variables to the exact HTTPS app URL, `https://fintask.paisafin.com`.
5. If Hostinger cannot verify the domain or issue SSL, check its Cloudflare/proxy requirements and temporarily set the record to DNS-only if Hostinger instructs you to.

Changing the registrar or DNS provider does not move the app hosting: Hostinger continues to run the app, while Cloudflare serves DNS for domains using Cloudflare nameservers. Do not change the existing root-domain website's record unless you intend to move that site too.

## Data storage warning

This app stores its main data in the local JSON file inside the project `data/` folder.

This works for a simple self-hosted app, but it is not a fully managed database like PostgreSQL or MySQL.

Important:
- do not delete the `data/office_tasks_db.json` file during deployment
- back it up before redeployments
- keep it outside the public GitHub repo if you do not want production data in source control

## Email configuration

This app is designed to use Hostinger webmail/SMTP. Keep the existing Hostinger email setup and do not replace it with a paid third-party service.

For example:
- `notifications@paisafin.com` or another company mailbox can be used as the SMTP sender
- if a single mailbox is required by Hostinger SMTP, configure that mailbox and use it consistently

## Deployment / redeploy workflow

1. Commit changes in Git
2. Push to GitHub
3. Redeploy from Hostinger
4. Confirm the app is running on the subdomain
5. Check the app logs if there are runtime errors
6. Back up the `data/office_tasks_db.json` file before a major update

## Troubleshooting

- if the app does not start, check the Node.js version and logs in Hostinger
- if emails fail, verify `SMTP_USER`, `SMTP_PASS`, and `SMTP_HOST`
- if the app cannot access the database, check that the `data/` folder exists and is writable
- if the app is blank, ensure the build succeeded and the start command is `npm run start`

## Important

- do not use VS Code Live Server for this app
- do not point the public domain at the raw HTML file
- do not alter the live `paisafin.com` website
- keep the task app isolated at its own subdomain
