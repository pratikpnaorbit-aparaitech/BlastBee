/**
 * 5-Minute Interactive Guided Tour & Demonstration Showcase View
 * Step-by-step interactive product walkthrough with narration scripts, chapter jumps, and direct live feature triggers
 */
const DemoTourView = {
  state: {
    currentStep: 0,
    isPlaying: false,
    timer: null,
    stepDuration: 12 // seconds per step in auto-play
  },

  chapters: [
    {
      id: 'intro',
      title: '1. Executive Recruitment Dashboard',
      timeCode: '0:00 - 0:45',
      badge: 'Architecture & KPIs',
      icon: '📊',
      heading: 'Aparaitech Software Campus Recruitment Command Center',
      description: 'Comprehensive high-level view of candidate pools across Tier-1/Tier-2 engineering institutions, placement campaign counts, overall delivery rates, and active drives.',
      highlights: [
        'Real-time metrics: Total Candidates in Pool, Colleges Covered, Emails Sent, Delivery Success Rate.',
        'College talent distribution visualizer highlighting candidate concentration across IITs, NITs, BITS, COEP, and VPKBIET Baramati.',
        'Quick launch cards to initiate placement drives in one click.'
      ],
      narration: "Welcome to Aparaitech Software's Student Email Blast Platform. The recruitment dashboard gives placement officers an instant snapshot of talent pools across colleges, active campaign statuses, and high-level delivery metrics.",
      actionLabel: 'Explore Dashboard Live',
      actionView: 'dashboard'
    },
    {
      id: 'students',
      title: '2. Student Candidate Pool & Filtering',
      timeCode: '0:45 - 1:30',
      badge: 'Data Management',
      icon: '🎓',
      heading: 'Multi-College Candidate Directory & Segmenter',
      description: 'Search, filter, and segment candidate profiles by college, graduation year (2024–2027), branch/stream, and active placement status.',
      highlights: [
        'Instant live search across Student Name, Email, College, and Phone.',
        'Multi-criteria filters (College dropdown with student counts, Batch year pills).',
        'Add & Edit student modal dialogs with email format validation.',
        'Bulk select and single-click "Blast to Selected Students" action.'
      ],
      narration: "The Student Pool provides a structured repository of all student candidates. Recruiters can quickly filter by college, search specific branches, or select a targeted subset of candidates for an exclusive placement round.",
      actionLabel: 'View Student Directory',
      actionView: 'students'
    },
    {
      id: 'import',
      title: '3. Bulk Upload & Column Mapping',
      timeCode: '1:30 - 2:30',
      badge: 'Excel & CSV Wizard',
      icon: '📤',
      heading: 'Intelligent Spreadsheet Parser with Live Validation',
      description: 'Effortlessly upload student lists via Excel (.xlsx, .xls) or CSV with intelligent header auto-detection, interactive mapping, and row-level validation.',
      highlights: [
        'Drag-and-drop file upload with sample CSV and Excel template downloads.',
        'Intelligent Column Mapping: automatically matches headers like "Institute" to College and "Mobile" to Phone.',
        'Validation Preview Table: highlights invalid emails or missing fields before importing.',
        'Duplicate Resolution strategies: Skip duplicates, Update existing records, or Overwrite.'
      ],
      narration: "With the Bulk Upload Wizard, recruitment teams can import thousands of student records in seconds. The intelligent parser auto-detects column names, validates RFC email formats, and allows recruiters to preview data before committing.",
      actionLabel: 'Launch Bulk Upload Wizard',
      actionView: 'import'
    },
    {
      id: 'composer',
      title: '4. Personalized Email Composer',
      timeCode: '2:30 - 3:30',
      badge: 'Personalization & Tags',
      icon: '✉️',
      heading: 'Dynamic Personalization Tags & Live Dual Split Preview',
      description: 'Compose high-impact recruitment emails with clickable dynamic tokens ({Name}, {College}, {Package}, {Drive_Date}) and instant side-by-side recipient preview.',
      highlights: [
        'Personalization Variable Pills: click {Name}, {College}, {Branch}, {Job_Role}, {Drive_Date}, {Package} to insert at cursor.',
        'Pre-loaded Aparaitech placement drive templates (Campus Drive, Coding Test, Internship, Interview Shortlist, Offer Letter).',
        'Live Split Preview: test how the email renders dynamically for different students in the database.',
        'Send Single Test Email to verify formatting before launching to the entire pool.'
      ],
      narration: "The Email Composer features pre-built recruitment templates tailored for Aparaitech Software. Personalization tags like {Name} and {College} dynamically substitute candidate data, and the live split preview shows exactly how the email looks for each recipient.",
      actionLabel: 'Open Email Composer',
      actionView: 'composer'
    },
    {
      id: 'blast',
      title: '5. Real-Time Live Blast Cockpit',
      timeCode: '3:30 - 4:15',
      badge: 'SSE Streaming & Controls',
      icon: '⚡',
      heading: 'Real-Time Delivery Cockpit with Telemetry Stream',
      description: 'Stream email dispatches live with Server-Sent Events (SSE), animated progress meters, speed velocity gauges, and interactive Pause / Resume / Abort controls.',
      highlights: [
        'Live percentage progress bar and ETA countdown.',
        'Sending speed indicator (emails/second) and latency metrics.',
        'Live streaming delivery terminal with color-coded success/failure logs.',
        'Interactive blast controls: Pause, Resume, and Cancel anytime.'
      ],
      narration: "During a live blast, the Cockpit streams real-time Server-Sent Events showing each email transmission, latency, and delivery status. Placement officers can pause or resume the blast at will.",
      actionLabel: 'View Live Cockpit',
      actionView: 'blast-monitor'
    },
    {
      id: 'history',
      title: '6. Delivery Audit Reports & 1-Click Retry',
      timeCode: '4:15 - 5:00',
      badge: 'Analytics & Diagnostics',
      icon: '📜',
      heading: 'Comprehensive Delivery Audit & 1-Click Failed Recovery',
      description: 'Detailed campaign history, per-candidate delivery logs, error diagnostics (mailbox full, DNS error), and single-click retry for failed recipients.',
      highlights: [
        'Full historical archive of all launched campus placement campaigns.',
        'Drill-down per-candidate delivery logs with status badges and error reasons.',
        'One-Click Retry for Failed Emails: re-queues only failed recipients without duplicate sends.',
        'Export detailed campaign delivery audit report to CSV or print-ready PDF.'
      ],
      narration: "The Campaign History module provides complete auditability. If an email fails due to a network or mailbox issue, the '1-Click Retry' automatically re-attempts delivery only for failed candidates without re-sending to successful ones.",
      actionLabel: 'Inspect Campaign Reports',
      actionView: 'history'
    }
  ],

  render(container) {
    const chapter = this.chapters[this.state.currentStep];

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>5-Minute Guided Demonstration &amp; Walkthrough</h1>
          <p>Interactive tour showcasing all capabilities of Aparaitech's Student Email Blast Platform</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary btn-sm" onclick="DemoTourView.toggleAutoPlay()" id="btnAutoPlay">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            <span id="autoPlayText">Start Auto Walkthrough</span>
          </button>
        </div>
      </div>

      <!-- Chapter Navigation Timeline Bar -->
      <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 24px;">
        ${this.chapters.map((ch, idx) => `
          <div 
            onclick="DemoTourView.goToStep(${idx})"
            style="background: ${this.state.currentStep === idx ? '#ffffff' : '#f8fafc'}; border: 2px solid ${this.state.currentStep === idx ? 'var(--brand-sapphire)' : 'var(--border-light)'}; border-radius: var(--radius-sm); padding: 12px 10px; cursor: pointer; text-align: center; transition: all 0.2s ease; box-shadow: ${this.state.currentStep === idx ? 'var(--shadow-md)' : 'none'};"
          >
            <div style="font-size: 1.2rem; margin-bottom: 4px;">${ch.icon}</div>
            <div style="font-size: 0.72rem; font-weight: 700; color: ${this.state.currentStep === idx ? 'var(--brand-sapphire)' : 'var(--text-secondary)'}; text-transform: uppercase;">Step ${idx + 1}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${ch.timeCode}</div>
          </div>
        `).join('')}
      </div>

      <!-- Active Chapter Main Presentation Card -->
      <div class="card" style="margin-bottom: 24px; padding: 32px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
          <div>
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
              <span class="badge badge-in_progress" style="font-size: 0.82rem; padding: 4px 12px;">${chapter.badge}</span>
              <span style="font-size: 0.82rem; color: var(--text-muted); font-weight: 600;">Time Code: ${chapter.timeCode}</span>
            </div>
            <h2 style="font-family: var(--font-heading); font-size: 1.6rem; color: var(--text-primary);">${chapter.heading}</h2>
            <p style="color: var(--text-secondary); font-size: 0.95rem; margin-top: 6px; max-width: 900px; line-height: 1.6;">${chapter.description}</p>
          </div>

          <button class="btn btn-primary" onclick="app.navigate('${chapter.actionView}')">
            <span>${chapter.actionLabel} &rarr;</span>
          </button>
        </div>

        <!-- Key Feature Highlights Grid -->
        <div style="background: #f8fafc; border: 1px solid var(--border-light); border-radius: var(--radius-md); padding: 24px; margin-bottom: 24px;">
          <h4 style="font-size: 0.92rem; font-weight: 700; color: var(--text-primary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 14px;">Key Capabilities Demonstrated:</h4>
          <ul style="margin: 0; padding-left: 24px; font-size: 0.92rem; color: var(--text-secondary); line-height: 1.8;">
            ${chapter.highlights.map(h => `<li>${h}</li>`).join('')}
          </ul>
        </div>

        <!-- Narration Script Box -->
        <div style="background: #0f172a; color: #ffffff; border-radius: var(--radius-md); padding: 20px 24px;">
          <div style="display: flex; align-items: center; gap: 8px; font-size: 0.78rem; font-weight: 700; color: #38bdf8; text-transform: uppercase; margin-bottom: 6px;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
            <span>Presenter Narration Script:</span>
          </div>
          <p style="font-size: 0.92rem; line-height: 1.6; color: #e2e8f0; font-style: italic; margin: 0;">
            "${chapter.narration}"
          </p>
        </div>

        <!-- Stepper Controls -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 28px; border-top: 1px solid var(--border-light); padding-top: 20px;">
          <button class="btn btn-secondary" ${this.state.currentStep === 0 ? 'disabled' : ''} onclick="DemoTourView.prevStep()">
            &larr; Previous Chapter
          </button>

          <span style="font-weight: 700; color: var(--text-muted); font-size: 0.88rem;">
            Chapter ${this.state.currentStep + 1} of ${this.chapters.length}
          </span>

          <button class="btn btn-secondary" ${this.state.currentStep === this.chapters.length - 1 ? 'disabled' : ''} onclick="DemoTourView.nextStep()">
            Next Chapter &rarr;
          </button>
        </div>
      </div>
    `;
  },

  goToStep(index) {
    this.state.currentStep = index;
    this.render(document.getElementById('viewContainer'));
  },

  nextStep() {
    if (this.state.currentStep < this.chapters.length - 1) {
      this.goToStep(this.state.currentStep + 1);
    }
  },

  prevStep() {
    if (this.state.currentStep > 0) {
      this.goToStep(this.state.currentStep - 1);
    }
  },

  toggleAutoPlay() {
    this.state.isPlaying = !this.state.isPlaying;
    const btnText = document.getElementById('autoPlayText');

    if (this.state.isPlaying) {
      if (btnText) btnText.textContent = 'Pause Walkthrough';
      this.state.timer = setInterval(() => {
        if (this.state.currentStep < this.chapters.length - 1) {
          this.nextStep();
        } else {
          this.goToStep(0);
        }
      }, this.state.stepDuration * 1000);
      app.showToast('Auto walkthrough started', 'info');
    } else {
      if (btnText) btnText.textContent = 'Start Auto Walkthrough';
      clearInterval(this.state.timer);
      this.state.timer = null;
      app.showToast('Auto walkthrough paused', 'info');
    }
  },

  destroy() {
    if (this.state.timer) {
      clearInterval(this.state.timer);
      this.state.timer = null;
    }
    this.state.isPlaying = false;
  }
};
