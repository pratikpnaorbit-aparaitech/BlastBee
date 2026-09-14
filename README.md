<<<<<<< HEAD
# Aparaitech Software &bull; Student Email Blast Web Application

[![Node.js](https://img.shields.io/badge/Node.js-v20%2B-green.svg)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-v4.21-blue.svg)](https://expressjs.com)
[![SQLite](https://img.shields.io/badge/SQLite-WAL%20Mode-003B57.svg)](https://sqlite.org)
[![Aparaitech](https://img.shields.io/badge/Portal-aparaitech.org-0284c7.svg)](https://aparaitech.org)

An enterprise-grade, high-performance, and beautifully crafted **Student Email Blast Web Application** built specifically for **Aparaitech Software's recruitment & campus placement team** to organize talent pools, compose personalized placement drives, import bulk student data via Excel/CSV, and dispatch real-time email blasts with live SSE progress telemetry.

---

## 🌟 Key Features

### 🎓 1. Student Candidate Pool Management
- Structured student candidate repository (Name, Email, College, Phone, Branch, Batch, Status, Tags).
- Instant search across names, emails, colleges, and mobile numbers.
- Filter by College dropdown (with live student counts) and Batch Year (2024–2027).
- Add/Edit/Delete candidate profile modals with RFC email format validation.
- Bulk select, bulk delete, CSV export, and single-click **"Blast to Selected Candidates"**.

### 📤 2. 4-Step Bulk Spreadsheet Upload Wizard
- Drag-and-drop file upload supporting **Excel (.xlsx, .xls)** and **CSV (.csv)** formats.
- Pre-built downloadable sample CSV & Excel templates.
- **Intelligent Column Auto-Detection**: Automatically detects variations like `Student Name`, `Email Address`, `Institute`, `Mobile`, `Branch`, and `Passing Year`.
- **Interactive Data Validation Preview**: Highlights invalid email formats or missing fields before importing.
- **Duplicate Strategy Controls**: *Skip duplicates* (default) or *Update existing candidate records*.

### ✉️ 3. Personalization Studio & Rich Email Composer
- Single-click **Personalization Variable Pills**: `{Name}`, `{First_Name}`, `{College}`, `{Branch}`, `{Batch}`, `{Job_Role}`, `{Drive_Date}`, `{Package}`, `{Company}`, `{Phone}` for both Subject and Body.
- **6 Pre-loaded Aparaitech Recruitment Templates**:
  1. *Aparaitech Campus Placement Drive 2026 - Associate Software Engineer Hiring*
  2. *Off-Campus Placement & Aptitude Test Invitation*
  3. *Summer Internship & Co-op Program 2025/2026*
  4. *Aparaitech National Coding Challenge & Hackathon*
  5. *Congratulations! Shortlisted for Technical Interview Round*
  6. *Official Job Offer Letter & Onboarding Next Steps*
- **WYSIWYG Rich Editor**: Headings, lists, callout highlight boxes, styled CTA buttons, links, and raw HTML toggle.
- **Live Dual Split Preview**: Side-by-side real-time rendering with candidate switcher dropdown.
- Single-click **"Send Test Email"** for recruiter inbox verification.

### ⚡ 4. Real-time Live Blast Cockpit
- Real-time **Server-Sent Events (SSE)** telemetry stream.
- Animated percentage progress bar, velocity speed meter (*emails/second*), and ETA countdown.
- Live scrolling delivery terminal with color-coded success/failure logs and latency timings.
- Real-time execution controls: **Pause Blast**, **Resume Blast**, and **Abort Blast**.

### 📜 5. Campaign History & 1-Click Retry Audit Reports
- Complete archive of all past and running placement campaigns.
- Drill-down per-candidate audit log with timestamps, delivery latency, and error diagnostics (*e.g., DNS error, Mailbox full, SMTP timeout*).
- **One-Click Retry for Failed Emails**: Automatically re-queues only failed recipients without duplicate sends to already-delivered candidates.
- Export full delivery reports to CSV or print-ready PDF.

### 📬 6. Student Mailbox Inspector (Sandbox Mode)
- Built-in live mailbox viewer allowing recruiters to inspect delivered personalized emails, test application links, and verify dynamic token substitution.

### ⚙️ 7. Dual Delivery Engine & Settings
- Seamlessly toggle between **High-Fidelity Sandbox Simulator** (zero external setup) and **Live SMTP Server** (*Gmail App Password, Brevo, SendGrid, Amazon SES, or custom corporate SMTP*).
- Configurable dispatch rate throttling slider and simulated failure rates.
- Instant **"Test SMTP Connection"** button with live server ping.

### 🎬 8. 5-Minute Guided Demonstration Tour
- Built-in interactive walkthrough mode with chapter markers (0:00 - 5:00) and presenter narration script for client evaluation.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js `v18.0.0` or higher
- NPM `v9.x` or `v10.x`

### 1. Install Dependencies
```bash
cd "e:/Mail blast"
npm install
```
*(On Windows PowerShell, use `cmd.exe /c npm install` if script execution is restricted)*

### 2. Initialize Database & Seed Sample Data
```bash
npm run seed
```
*(Pre-populates the database with 40+ diverse candidates across top engineering colleges and 6 recruitment templates)*

### 3. Run Automated Tests
```bash
npm test
```

### 4. Start the Application
```bash
npm start
```
Or with live reload:
```bash
npm run dev
```

### 5. Access the Web Application
Open your browser at:
```
http://localhost:3000
```

---

## 📁 Project Directory Structure

```
e:/Mail blast/
├── package.json                   # Project dependencies & npm scripts
├── server.js                      # Express server entry point & SSE controller
├── database/
│   ├── db.js                      # SQLite database initialization & migrations
│   ├── schema.sql                 # SQL table schemas and indexes
│   ├── seed.js                    # Database seed script (40+ students, 6 templates)
│   └── mailblast.db               # SQLite database file
├── services/
│   ├── mailer.js                  # Nodemailer live SMTP & Sandbox mailer service
│   ├── blastManager.js            # Queue worker, rate-limiter, SSE broadcast, retry
│   ├── excelParser.js             # XLSX/CSV file validator & column auto-mapper
│   └── templateEngine.js          # Personalization tag engine ({Name}, {College})
├── routes/
│   ├── students.js                # Student CRUD, bulk delete, search, filter, export
│   ├── upload.js                  # Spreadsheet upload, validation, mapping & commit
│   ├── templates.js               # Template CRUD & live preview
│   ├── campaigns.js               # Launch blast, SSE stream, pause/resume/cancel, retry
│   ├── stats.js                   # Dashboard KPIs & college talent analytics
│   ├── settings.js                # SMTP credentials, connection test, throttling
│   └── inbox.js                   # Student Mailbox Inspector API
├── public/
│   ├── index.html                 # Main single-page application shell
│   ├── css/
│   │   ├── main.css               # Design tokens, layout grid, typography
│   │   ├── components.css         # Cards, data tables, composer, live blast cockpit
│   │   └── toast.css              # Toast notification system
│   ├── js/
│   │   ├── app.js                 # SPA router, modal manager, toast coordinator
│   │   ├── api.js                 # Centralized fetch API client
│   │   └── views/
│   │       ├── dashboard.js       # Executive recruitment dashboard
│   │       ├── students.js        # Student candidate directory & filters
│   │       ├── import.js          # 4-step bulk upload wizard
│   │       ├── composer.js        # Email composer & live split preview
│   │       ├── blastMonitor.js    # Real-time SSE live blast cockpit
│   │       ├── history.js         # Campaign history & delivery audit reports
│   │       ├── inbox.js           # Student mailbox inspector
│   │       ├── settings.js        # SMTP settings & throttling controls
│   │       └── demoTour.js        # 5-minute interactive guided walkthrough
│   └── assets/
│       ├── logo.svg               # Aparaitech Software high-res SVG branding
│       ├── sample_students.csv    # Sample CSV template
│       └── sample_students.xlsx   # Sample Excel template
├── docs/
│   ├── DATABASE_SCHEMA.md         # Full database schema and data dictionary
│   ├── INSTALLATION.md            # Detailed installation and setup guide
│   └── USER_GUIDE.md              # Comprehensive recruiter user manual
├── test/
│   └── test_suite.js              # Automated test suite (6/6 tests)
└── README.md                      # Project documentation
```

---

## 📋 Comprehensive Deliverables Included

| Deliverable | Location | Description |
| :--- | :--- | :--- |
| **Complete Source Code** | `e:/Mail blast/` | Production-ready full stack Node.js/Express + SQLite + Custom Vanilla CSS/JS web application |
| **Database Schema** | [`docs/DATABASE_SCHEMA.md`](file:///e:/Mail%20blast/docs/DATABASE_SCHEMA.md) | Entity relationship diagram, data dictionaries, constraints, and indexes |
| **Installation Guide** | [`docs/INSTALLATION.md`](file:///e:/Mail%20blast/docs/INSTALLATION.md) | Step-by-step setup, SMTP configuration, PM2 production deployment, and Nginx reverse proxy |
| **User Documentation** | [`docs/USER_GUIDE.md`](file:///e:/Mail%20blast/docs/USER_GUIDE.md) | Recruiter manual for managing student pools, bulk uploads, templates, live blasts, and retry |
| **Live Working Demo** | `http://localhost:3000` | Fully functional local instance with seed data and SMTP delivery |
| **5-Minute Guided Tour** | `#demo-tour` in App | Built-in interactive demonstration showcase with chapter markers and presenter voiceover script |

---

## 🏢 Corporate Identity & Credits
Developed for **Aparaitech Software** ([aparaitech.org](https://aparaitech.org))  
*Recruitment Engineering Team &bull; Baramati &amp; Bengaluru, India*
=======
# mail-blast
>>>>>>> 39f09aa8c2b68512baa47becb5b6ac9f78ae3e38
#   B l a s t B e e  
 #   B l a s t B e e  
 #   B l a s t B e e  
 