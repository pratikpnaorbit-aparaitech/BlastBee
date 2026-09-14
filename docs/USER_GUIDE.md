# Aparaitech Software &bull; Recruitment Portal User Guide

Welcome to the **Student Email Blast Platform** built for Aparaitech Software's campus talent acquisition and placement team. This guide walks you through every feature and workflow in the system.

---

## Table of Contents
1. [Overview & Navigation](#1-overview--navigation)
2. [Candidate Pool Management](#2-candidate-pool-management)
3. [Bulk Uploading Spreadsheets (Excel / CSV)](#3-bulk-uploading-spreadsheets-excel--csv)
4. [Email Composer & Personalization Tags](#4-email-composer--personalization-tags)
5. [Real-time Live Blast Cockpit](#5-real-time-live-blast-cockpit)
6. [Campaign History & Delivery Audit Reports](#6-campaign-history--delivery-audit-reports)
7. [Student Mailbox Inspector (Sandbox Mode)](#7-student-mailbox-inspector-sandbox-mode)
8. [Settings & Throttling Controls](#8-settings--throttling-controls)

---

## 1. Overview & Navigation

The platform provides a sidebar navigation bar for quick access:
- **📊 Dashboard**: High-level metrics, college distribution, and recent campaign performance.
- **🎓 Student Pool**: Master student directory with search, college/batch filtering, and CRUD tools.
- **📤 Bulk Upload**: 4-step wizard to upload `.xlsx` or `.csv` files with column auto-mapping.
- **✉️ Email Composer**: Rich email editor with dynamic tags (`{Name}`, `{College}`) and live dual split preview.
- **⚡ Live Blast Cockpit**: Real-time delivery progress bar, velocity counters (emails/sec), and event logs.
- **📜 Campaign History**: Past blast archives, detailed per-candidate audit reports, and 1-click retry.
- **📬 Student Mailbox Inspector**: Preview how personalized emails land in candidate mailboxes.
- **⚙️ Settings & SMTP**: Switch between Sandbox and live SMTP servers, set throttling rates, and edit company profile.
- **🎬 5-Min Guided Tour**: Interactive step-by-step product walkthrough.

---

## 2. Candidate Pool Management

### Adding a Single Student
1. Navigate to **Student Pool** in the sidebar.
2. Click **"+ Add Student"** in the top right.
3. Fill in the candidate's **Full Name** and **Email Address** (Required). Other fields like College, Phone, Branch, and Batch are optional.
4. Click **"Save Student"**.

### Filtering & Searching Candidates
- **Search Bar**: Type any student name, email, college, or mobile number to instantly filter results in real time.
- **College Filter**: Dropdown menu showing student counts per college (e.g., `IIT Bombay (12)`, `COEP Tech Pune (8)`).
- **Batch Filter**: Filter candidates graduating in `2026`, `2025`, `2027`, or `2024`.

### Bulk Operations & Export
- Check the checkboxes next to any students, or select all with the top header checkbox.
- Click **"Blast to Selected"** to jump directly to the Composer with those students pre-selected.
- Click **"Export CSV"** to download the currently filtered candidate list.

---

## 3. Bulk Uploading Spreadsheets (Excel / CSV)

The 4-Step Bulk Import Wizard simplifies adding hundreds or thousands of students:

1. **Step 1: Upload File**
   - Drag & drop your `.xlsx`, `.xls`, or `.csv` file onto the dropzone, or click to browse.
   - You can download sample `.csv` or `.xlsx` templates from the top-right buttons.

2. **Step 2: Verify Column Mapping**
   - The system automatically detects and maps column headers.
   - Only **Student Name** and **Email Address** are required to import. All other columns (College, Phone, Branch, Batch) are optional.
   - If your spreadsheet uses custom column names (e.g., `Candidate`, `Mail ID`), simply map them from the dropdowns.

3. **Step 3: Data Validation Preview**
   - The preview table verifies that candidate names are present and email syntax is valid (RFC standard).
   - Valid rows display a green **"Valid"** badge. Rows with missing names or invalid email syntax display a red **"Error"** badge.

4. **Step 4: Duplicate Strategy & Commit**
   - Select **"Skip duplicates"** (preserves existing candidate profiles) or **"Update existing"** (refreshes phone/college/branch).
   - Click **"Import Students to Pool"** to commit records.

---

## 4. Email Composer & Personalization Tags

### Using Personalization Tags
Click any of the variable pills above the editor to insert dynamic tags at your cursor:
- `{Name}`: Student's full name (e.g., *Rahul Sharma*)
- `{First_Name}`: Student's first name (e.g., *Rahul*)
- `{College}`: Student's institution (e.g., *IIT Bombay*)
- `{Branch}`: Degree discipline (e.g., *Computer Science*)
- `{Batch}`: Graduation year (e.g., *2026*)
- `{Job_Role}`: Designation (e.g., *Associate Software Engineer*)
- `{Drive_Date}`: Placement date (e.g., *August 28, 2026*)
- `{Package}`: CTC / Compensation (e.g., *₹6.5 LPA - ₹12.0 LPA*)
- `{Company}`: *Aparaitech Software*

> [!TIP]
> Personalization tags work in **both** the Email Subject line and the Email Body!

### Pre-Loaded Recruitment Templates
Select from 6 pre-built Aparaitech Software templates in the dropdown:
1. *Campus Placement Drive 2026 - Software Engineer Hiring*
2. *Off-Campus Placement & Aptitude Test Invitation*
3. *Summer Internship & Co-op Program 2025*
4. *Aparaitech National Coding Challenge & Hackathon*
5. *Congratulations! Shortlisted for Technical Interview Round*
6. *Official Offer Letter & Onboarding Instructions*

### Live Split-Screen Preview & Test Email
- The right-hand pane shows a real-time rendered preview of your email.
- Use the **"Simulate as:"** dropdown to switch between different candidates in your database and verify how tags are substituted.
- Click **"Send Test Email"** to dispatch a single rendered test message to your own inbox.

---

## 5. Real-Time Live Blast Cockpit

When you click **"Start Real-time Blast Now"**, the system navigates to the Live Blast Cockpit:
- **Progress Bar & Percentage Dial**: Live visual progress indicator and remaining time (ETA).
- **Speed Meter**: Real-time throughput in emails per second (e.g., `3.5 eps`).
- **Live Terminal Log**: Color-coded streaming log for each student dispatched (`✔ Delivered` or `✖ Failed`).
- **Live Controls**:
  - **Pause Blast**: Temporarily halt the dispatch queue.
  - **Resume Blast**: Continue sending from where it was paused.
  - **Abort Blast**: Cancel remaining unsent emails.

---

## 6. Campaign History & Delivery Audit Reports

1. Navigate to **Campaign History** to view past drives.
2. Click **"Audit Report &rarr;"** on any campaign to view full recipient delivery logs.
3. Filter by **Delivered**, **Failed**, or **Pending** recipients.
4. For failed emails, inspect the exact error reason (e.g., *550 Mailbox quota exceeded* or *Connection timeout*).
5. **1-Click Retry**: Click **"Retry Failed Recipients"** to automatically re-queue and dispatch emails only to students who experienced delivery errors, without duplicate sends to already-delivered recipients.
6. Click **"Export Delivery CSV"** to download the audit log for compliance records.

---

## 7. Student Mailbox Inspector (Sandbox Mode)

In default Sandbox Mode, dispatches are captured in the **Student Mailbox Inspector** (`#inbox`):
- Search delivered emails by student name, college, or subject.
- Click any email to view the rendered HTML, test application links, and verify that personalized student tokens were correctly injected.

---

## 8. Settings & Throttling Controls

Under **Settings & SMTP**:
- **Delivery Mode**: Toggle between **Sandbox Simulator** (offline testing) and **Live External SMTP Server**.
- **SMTP Credentials**: Enter Host, Port, Username, and Password for Gmail, Brevo, SendGrid, or corporate SMTP.
- **Send Delay Throttling**: Adjust the slider (50ms - 2000ms) to control dispatch rate and avoid SMTP provider limits.
- **Simulated Failure Rate**: Adjust from 0% to 30% to test error reporting and the 1-Click Retry workflow.
- **Test Connection Button**: Ping the SMTP server with instant success/failure diagnostic feedback.
