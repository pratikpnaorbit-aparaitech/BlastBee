# Aparaitech Software &bull; Render.com Deployment Guide

This guide walks you through deploying the **Student Email Blast Web Application** to **Render (Render.com)** in just a few clicks.

---

## 🚀 Quick 3-Step Deployment to Render

### Step 1: Push Your Code to GitHub / GitLab
Ensure your code is pushed to your GitHub or GitLab repository:
```bash
git add .
git commit -m "chore: ready for Render deployment"
git push -u origin main
```

---

### Step 2: Create a New Web Service on Render

1. Go to [https://dashboard.render.com/](https://dashboard.render.com/) and sign in.
2. Click the **"New +"** button in the top right and select **"Web Service"**.
3. Choose **"Build and deploy from a Git repository"** and select your `mail-blast` repository.
4. Fill in the deployment details:
   - **Name**: `aparaitech-mail-blast` (or your preferred name)
   - **Region**: Select the region closest to you (e.g. *Singapore* or *Frankfurt*)
   - **Branch**: `main` or `master`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: **Free** (or *Starter* for persistent disks)

---

### Step 3: Environment Variables (Optional)

Under **Environment Variables** in Render, you can optionally configure:

| Key | Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Production mode |
| `PORT` | `10000` | Render default port (auto-set) |
| `DB_PATH` | `/var/data/mailblast.db` | *(Only if using Render Persistent Disk)* |

Click **"Create Web Service"**!  
Render will automatically build the project, run database seeding, and give you a live HTTPS URL (e.g. `https://aparaitech-mail-blast.onrender.com`).

---

## 💾 Persisting Data on Render

### Option A: Free Tier (Zero-Cost Deployment)
- On Render's Free tier, the SQLite database is created in the app directory and initialized with all 40+ demo students and templates automatically on startup.

### Option B: Render Persistent Disk (For Permanent Data Retention)
If you want data (uploaded students, campaign logs) to persist across server restarts and new code deployments:
1. In your Render Web Service dashboard, go to the **"Disks"** tab.
2. Click **"Add Disk"**:
   - **Name**: `mailblast-data`
   - **Mount Path**: `/var/data`
   - **Size**: `1 GB` (or more)
3. Under the **"Environment"** tab, add the environment variable:
   - `DB_PATH` = `/var/data/mailblast.db`
4. Click **"Save Changes"**. The application will store the SQLite database on your persistent disk!

---

## ✉️ Setting up Live SMTP on Render
Once deployed on Render, go to your live app URL, navigate to **Settings & SMTP** (`/settings`):
1. Switch to **Live SMTP Server**.
2. Enter your **Host**, **Port**, **Username**, and **App Password** (e.g. Gmail App Password, Brevo, SendGrid, Amazon SES).
3. Click **"Test Connection"** to verify, then click **"Save Changes"**.
