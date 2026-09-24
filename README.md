# Office Task Manager

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
- SMTP-based email notifications

## Mobile app install from link (no Play Store)

This app is built as a web app, so users can install it directly from a browser link instead of going through the Play Store.

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
APP_URL=https://task.paisafin.com
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=notifications@paisafin.com
SMTP_PASS=your-hostinger-webmail-password
SMTP_FROM_NAME=PaisaFin Task Management
SMTP_FROM_EMAIL=notifications@paisafin.com
```

If your Hostinger account uses port 587 instead of 465, keep `SMTP_SECURE=false` and `SMTP_PORT=587`.

Never commit `.env` to GitHub.

## GitHub setup

1. Create a GitHub repository named `office-task-manager`
2. Push this project to GitHub
3. Connect the repo to Hostinger Node.js Web App deployment
4. Keep `.env` local only
5. Store all secrets in Hostinger environment variables, not in source code

## Subdomain and SSL

Use a separate subdomain such as:
```text
task.paisafin.com
```

Configure the DNS in Hostinger and enable the SSL certificate through the Hostinger dashboard.

Do not change the existing `paisafin.com` site or its DNS records.

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
