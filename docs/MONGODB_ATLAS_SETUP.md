# 🍃 MongoDB Atlas Cloud Database Setup Guide
## Aparaitech Software Student Email Blast Platform

This guide explains how to connect your **MongoDB Atlas Cloud Database** to the Aparaitech Student Email Blast platform for cross-device synchronization and cloud deployment (Vercel, Render, Railway, AWS).

---

### Step 1: Create a Free MongoDB Atlas Account
1. Visit **[https://www.mongodb.com/cloud/atlas/register](https://www.mongodb.com/cloud/atlas/register)** and sign up for free.
2. Select the **"M0 Free Tier"** cluster (512MB free storage, permanent).
3. Choose your preferred cloud provider and region (e.g. AWS `ap-south-1` Mumbai).
4. Click **Create Deployment**.

---

### Step 2: Configure Database User & Network Access
1. **Database Access (User & Password)**:
   - Go to **Security > Database Access** > **Add New Database User**.
   - Select **Password Authentication**.
   - Username: `admin` (or your choice).
   - Password: Click *Autogenerate* or type a secure password (save this password!).
   - Database User Privileges: `Read and write to any database`.
2. **Network Access (IP Whitelist)**:
   - Go to **Security > Network Access** > **Add IP Address**.
   - Select **Allow Access from Anywhere (`0.0.0.0/0`)** so that Vercel, laptops, and local servers can connect seamlessly.
   - Click **Confirm**.

---

### Step 3: Copy Your MongoDB Connection String
1. In the MongoDB Atlas Dashboard, click the **"Connect"** button on your cluster.
2. Select **Drivers** (Node.js).
3. Copy the connection string format:
   ```text
   mongodb+srv://admin:<password>@cluster0.abcde.mongodb.net/mailblast?retryWrites=true&w=majority
   ```
4. Replace `<password>` with your actual database user password.

---

### Step 4: Configure in Aparaitech Email Blast Portal

#### Option A: Inside the Web UI (1-Click)
1. Open the application: **`http://localhost:3000/#settings`**
2. Scroll to **"5. Cloud Database Connection (MongoDB Atlas)"**.
3. Paste your connection string into the **MongoDB Atlas Connection URI** field.
4. Click **"⚡ Test Connection"** to verify.
5. Click **"Save & Connect MongoDB"**.
6. Click **"🚀 Sync Local Data to MongoDB Atlas"** to immediately upload all existing candidates, templates, and SMTP sender accounts!

#### Option B: Via `.env` Environment Variables (for Vercel & Production)
Add the `MONGODB_URI` environment variable in your `.env` or in your **Vercel Project Settings > Environment Variables**:
```env
MONGODB_URI=mongodb+srv://admin:YourPassword123@cluster0.abcde.mongodb.net/mailblast?retryWrites=true&w=majority
```

---

### 📂 Collections Auto-Created in MongoDB Atlas
* `students`: Candidate directory with index on `email`, `college`, `batch`, `import_batch_id`.
* `templates`: Personalization email templates.
* `campaigns`: Blast campaigns history and metrics.
* `campaign_recipients`: Recipient delivery logs, SMTP account used, latency, and status.
* `smtp_accounts`: Multi-sender accounts pool with auto-rotation counters.
* `settings`: System configurations and branding settings.
* `simulated_inbox`: Sandbox delivery inspector.
