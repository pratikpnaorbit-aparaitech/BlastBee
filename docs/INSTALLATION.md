# Aparaitech Software &bull; Installation & Setup Guide

This guide provides comprehensive, step-by-step instructions for installing, configuring, testing, and deploying the **Student Email Blast Web Application**.

---

## 1. System Requirements & Prerequisites

- **Node.js**: `v18.0.0` or higher (Recommended: Node `v20.x` or `v22.x LTS`)
- **NPM**: `v9.x` or `v10.x`
- **Operating System**: Windows 10/11, macOS, or Linux (Ubuntu/Debian/RHEL)
- **Disk Space**: ~100MB for application and local SQLite database

---

## 2. Quick Start Installation (Local Development)

### Step 1: Clone or Navigate to Project Directory
```bash
cd "e:/Mail blast"
```

### Step 2: Install Node.js Dependencies
```bash
npm install
```
*(On Windows PowerShell, you can run `cmd.exe /c npm install` if PowerShell script execution policy is restricted).*

### Step 3: Initialize Database & Seed Demo Data
The system automatically initializes and seeds the SQLite database with 40+ diverse college candidates and 6 recruitment email templates on first startup. You can also run the seed script explicitly:
```bash
npm run seed
```

### Step 4: Run the Automated Test Suite
Verify that all subsystems (database, template engine, excel parser, blast queue, retry logic) are functioning:
```bash
npm test
```

### Step 5: Start the Web Application
```bash
npm start
```
Or for auto-reloading development mode:
```bash
npm run dev
```

### Step 6: Access the Application in Browser
Open your browser and navigate to:
```
http://localhost:3000
```

---

## 3. SMTP & Email Provider Configuration

The application includes two email delivery engines:
1. **High-Fidelity Sandbox / Simulator (Default)**:
   - No external credentials required.
   - Dispatches emails with realistic latency and logs them to the **Student Mailbox Inspector** (`/inbox`).
   - Ideal for demonstrations, QA, and testing variable personalization.

2. **Live SMTP Server Mode**:
   - Delivers real emails to candidate inboxes.
   - Configure under **Settings & SMTP** in the portal UI, or via the `settings` database table.

### Popular SMTP Configurations:

#### A. Gmail / Google Workspace (App Password)
- **SMTP Host**: `smtp.gmail.com`
- **SMTP Port**: `587` (TLS) or `465` (SSL)
- **SMTP Username**: `your_email@gmail.com`
- **SMTP Password**: 16-character Google App Password *(Generate via Google Account &rarr; Security &rarr; 2-Step Verification &rarr; App Passwords)*
- **From Name**: `Aparaitech Software Recruitment Team`
- **From Email**: `your_email@gmail.com`

#### B. Brevo (formerly Sendinblue)
- **SMTP Host**: `smtp-relay.brevo.com`
- **SMTP Port**: `587`
- **SMTP Username**: `your_brevo_login_email`
- **SMTP Password**: `your_brevo_smtp_key`

#### C. SendGrid
- **SMTP Host**: `smtp.sendgrid.net`
- **SMTP Port**: `587`
- **SMTP Username**: `apikey`
- **SMTP Password**: `YOUR_SENDGRID_API_KEY`

#### D. Amazon SES
- **SMTP Host**: `email-smtp.us-east-1.amazonaws.com` (or your AWS region)
- **SMTP Port**: `587`
- **SMTP Username**: `YOUR_SES_SMTP_USERNAME`
- **SMTP Password**: `YOUR_SES_SMTP_PASSWORD`

---

## 4. Production Deployment Guide

### Running with PM2 (Process Manager)
To run the server continuously in the background on production Linux/Windows servers:

```bash
# Install PM2 globally
npm install -g pm2

# Start server as a cluster or daemon
pm2 start server.js --name "aparaitech-mail-blast"

# Save PM2 process list
pm2 save

# Setup auto-start on server reboot
pm2 startup
```

### Production Nginx Reverse Proxy Configuration
```nginx
server {
    listen 80;
    server_name mailblast.aparaitech.org;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # Important for Server-Sent Events (SSE) live progress streaming:
        proxy_set_header Cache-Control 'no-cache';
        proxy_buffering off;
        chunked_transfer_encoding on;
    }
}
```

---

## 5. Troubleshooting & FAQ

### Q: Why do I get a PowerShell script execution error when running `npm`?
**A**: Run commands via `cmd.exe /c npm ...` or enable script execution in PowerShell by running `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.

### Q: How do I test the 1-Click Retry functionality?
**A**: By default, in Sandbox Mode, a 5% simulated failure rate is enabled in Settings. Launch a campaign with 20+ students; any failed emails will display error diagnostics, and a single click on **"Retry Failed Deliveries"** will re-queue only those failed students.

### Q: Where is the SQLite database file stored?
**A**: The database is stored at `database/mailblast.db`. It is lightweight, ACID-compliant, and can be backed up simply by copying the file.
