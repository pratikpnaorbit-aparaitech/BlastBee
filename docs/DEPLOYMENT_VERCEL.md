# Aparaitech Software &bull; Vercel Deployment Guide

This guide provides step-by-step instructions to deploy the **Student Email Blast Web Application** to **Vercel** with full backend and database support.

---

## ⚡ Quick 2-Step Deployment to Vercel

### Step 1: Push Code to GitHub
Ensure the latest code with `vercel.json` and `api/index.js` is pushed to your GitHub repository:
```bash
git add .
git commit -m "feat: configure Vercel deployment and serverless entry"
git push -u origin main
```

---

### Step 2: Import & Deploy on Vercel Dashboard

1. Visit **[https://vercel.com/dashboard](https://vercel.com/dashboard)** and log in.
2. Click **"Add New..."** &rarr; **"Project"**.
3. Under **"Import Git Repository"**, select **`anuragaparaitech/mail-blast`** and click **"Import"**.
4. Configure Project Settings:
   - **Framework Preset**: *Other*
   - **Root Directory**: `./` (leave default)
   - **Build Command**: `npm install` (or leave default)
   - **Output Directory**: `public` (or leave default)
5. Click **"Deploy"**!

Vercel will build your serverless backend, bundle static frontend assets from `public/`, and deploy your live app at `https://mail-blast-xxx.vercel.app`!

---

## 🗄️ Database on Vercel

The application is configured to handle database execution in Vercel's serverless environment:

### Option 1: Automatic Built-in SQLite (Default / Zero-Setup)
- When running on Vercel, the app automatically detects the serverless environment (`process.env.VERCEL`) and creates/initializes SQLite in `/tmp/mailblast.db`.
- The database is auto-seeded with 40+ student candidates and 6 recruitment templates on first invocation.

### Option 2: Connecting External Cloud Database (Neon / Supabase / Vercel Postgres)
If you want persistent cloud storage across all global edge locations:
1. Create a free PostgreSQL database on **Neon.tech**, **Supabase**, or **Vercel Postgres**.
2. In your Vercel Project Dashboard, navigate to **Settings &rarr; Environment Variables**.
3. Add `DATABASE_URL` with your connection string:
   ```
   DATABASE_URL = postgresql://user:password@ep-cool-fog-123456.us-east-2.aws.neon.tech/mailblast?sslmode=require
   ```

---

## ✉️ Setting up Live Email Delivery on Vercel
After deploying, visit your live Vercel URL, go to **Settings & SMTP** (`/settings`):
1. Select **Live SMTP Server**.
2. Enter your **Host**, **Port**, **Username**, and **App Password** (e.g. Gmail App Password, Brevo, SendGrid, Amazon SES).
3. Click **"Test Connection"** to verify, then click **"Save Changes"**.
