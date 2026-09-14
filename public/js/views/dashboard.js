/**
 * Dashboard View
 * Recruitment KPIs, College pool visualizer, quick blast triggers, recent delivery activity
 */
const DashboardView = {
  async render(container) {
    container.innerHTML = `
      <div class="view-loading">
        <div class="spinner"></div>
        <p>Loading Dashboard Analytics...</p>
      </div>
    `;

    try {
      const data = await api.getDashboardStats();
      const stats = data.stats || {};

      container.innerHTML = `
        <div class="view-header">
          <div class="view-title-group">
            <h1>Recruitment &amp; Email Blast Dashboard</h1>
            <p>Welcome to Aparaitech Software Placement Outreach &bull; Manage student talent pools and campus drives</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-secondary btn-sm" onclick="app.navigate('import')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
              <span>Bulk Upload Students</span>
            </button>
            <button class="btn btn-primary btn-sm" onclick="app.navigate('composer')">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
              <span>Launch Placement Blast</span>
            </button>
          </div>
        </div>

        <!-- KPI Metrics Grid -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-icon-box">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            </div>
            <div class="kpi-data">
              <span class="kpi-label">Candidate Pool</span>
              <span class="kpi-value">${stats.totalStudents || 0}</span>
              <span class="kpi-subtext">Active prospective graduates</span>
            </div>
          </div>

          <div class="kpi-card kpi-purple">
            <div class="kpi-icon-box">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            </div>
            <div class="kpi-data">
              <span class="kpi-label">Partner Colleges</span>
              <span class="kpi-value">${stats.totalColleges || 0}</span>
              <span class="kpi-subtext">Tier-1 &amp; Tier-2 institutions</span>
            </div>
          </div>

          <div class="kpi-card kpi-green">
            <div class="kpi-icon-box">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
            </div>
            <div class="kpi-data">
              <span class="kpi-label">Emails Dispatched</span>
              <span class="kpi-value">${stats.totalEmailsSent || 0}</span>
              <span class="kpi-subtext">${stats.totalSuccess || 0} delivered successfully</span>
            </div>
          </div>

          <div class="kpi-card kpi-amber">
            <div class="kpi-icon-box">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
            </div>
            <div class="kpi-data">
              <span class="kpi-label">Delivery Success Rate</span>
              <span class="kpi-value">${stats.successRate || 100}%</span>
              <span class="kpi-subtext">Across ${stats.totalCampaigns || 0} placement campaigns</span>
            </div>
          </div>
        </div>

        ${stats.totalStudents === 0 ? `
          <!-- New Customer Clean Portal Welcome Card -->
          <div class="card" style="background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%); color: #fff; border: 1px solid #3b82f6; border-radius: 12px; padding: 24px 28px; margin-bottom: 24px; box-shadow: var(--shadow-md);">
            <div style="display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
              <div>
                <span class="badge" style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); margin-bottom: 8px;">🚀 WELCOME TO YOUR WORKSPACE</span>
                <h2 style="font-size: 1.35rem; font-weight: 700; color: #fff; margin: 6px 0 8px 0;">Your Customer Workspace is Clean &amp; Ready!</h2>
                <p style="color: #cbd5e1; font-size: 0.85rem; max-width: 680px; line-height: 1.5; margin-bottom: 18px;">
                  You are active on the <strong>7-Day Free Trial</strong> (1 dedicated SMTP Server). Your portal is completely clean and isolated. Follow these 2 quick steps to blast your first recruitment campaign:
                </p>
                <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                  <button class="btn btn-primary btn-sm" onclick="app.navigate('import')" style="background: #2563eb; padding: 8px 16px;">
                    📁 1. Import Candidates (Excel / CSV)
                  </button>
                  <button class="btn btn-secondary btn-sm" onclick="app.navigate('settings')" style="background: rgba(255,255,255,0.1); color: #fff; border-color: rgba(255,255,255,0.25); padding: 8px 16px;">
                    ⚙️ 2. Connect 1st SMTP Sender
                  </button>
                  <button class="btn btn-outline btn-sm" onclick="app.openUpgradeModal()" style="color: #f59e0b; border-color: #f59e0b; padding: 8px 16px;">
                    ⚡ Upgrade to Pro (5 Servers)
                  </button>
                </div>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Two Column Layout: College Distribution & Recent Campaigns -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px;">
          <!-- College Distribution Card -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Top College Talent Distribution</h3>
              <button class="btn btn-ghost btn-sm" onclick="app.navigate('students')">View All &rarr;</button>
            </div>
            <div class="college-list">
              ${(stats.collegeDistribution && stats.collegeDistribution.length > 0) ? stats.collegeDistribution.map(col => {
                const maxCount = stats.collegeDistribution[0]?.student_count || 1;
                const percentage = Math.round((col.student_count / maxCount) * 100);
                return `
                  <div style="margin-bottom: 14px;">
                    <div style="display: flex; justify-content: space-between; font-size: 0.84rem; font-weight: 600; margin-bottom: 4px;">
                      <span>${col.college}</span>
                      <span style="color: var(--brand-sapphire);">${col.student_count} students</span>
                    </div>
                    <div style="height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                      <div style="height: 100%; width: ${percentage}%; background: linear-gradient(90deg, #2563eb, #38bdf8); border-radius: 4px;"></div>
                    </div>
                  </div>
                `;
              }).join('') : `
                <div style="text-align: center; padding: 32px 16px; color: var(--text-muted);">
                  <div style="font-size: 1.8rem; margin-bottom: 6px;">🏛️</div>
                  <div style="font-weight: 600; font-size: 0.9rem; color: var(--text-primary); margin-bottom: 4px;">No College Data Yet</div>
                  <p style="font-size: 0.8rem; margin-bottom: 14px;">Import a spreadsheet to visualize talent distribution across colleges.</p>
                  <button class="btn btn-primary btn-xs" onclick="app.navigate('import')">+ Upload Candidates</button>
                </div>
              `}
            </div>
          </div>

          <!-- Quick Campaign Launcher Card -->
          <div class="card" style="background: linear-gradient(135deg, #0b1329 0%, #1e293b 100%); color: white; border: none;">
            <div style="display: flex; flex-direction: column; height: 100%; justify-content: space-between;">
              <div>
                <span class="badge" style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); margin-bottom: 12px;">READY TO BLAST</span>
                <h3 style="font-family: var(--font-heading); font-size: 1.35rem; font-weight: 700; color: #ffffff; margin-bottom: 8px;">Campus Outreach Blast</h3>
                <p style="color: #94a3b8; font-size: 0.88rem; line-height: 1.6; margin-bottom: 18px;">
                  ${stats.totalStudents > 0 
                    ? `Quickly launch personalized placement invitations with pre-filled tags ({Name}, {College}, {Package}) to all ${stats.totalStudents} registered candidates with real-time SSE progress tracking.` 
                    : `Upload candidates and connect your SMTP sender to launch high-deliverability recruitment campaigns with personalized dynamic tokens.`}
                </p>
              </div>

              <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                <button class="btn btn-primary" onclick="app.navigate('composer')" ${stats.totalStudents === 0 ? 'style="opacity: 0.8;"' : ''}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                  <span>Compose Placement Blast</span>
                </button>
                <button class="btn btn-outline" onclick="app.navigate('import')">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                  <span>Import Candidates</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Recent Campaigns Table -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Recent Email Blast Campaigns</h3>
            <button class="btn btn-secondary btn-sm" onclick="app.navigate('history')">Full Campaign History &rarr;</button>
          </div>
          
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Campaign Title</th>
                  <th>Target Audience</th>
                  <th>Total Candidates</th>
                  <th>Delivered</th>
                  <th>Failed</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${(stats.recentCampaigns || []).map(camp => `
                  <tr>
                    <td>
                      <div style="font-weight: 600; color: var(--text-primary);">${camp.title}</div>
                      <div style="font-size: 0.76rem; color: var(--text-muted);">${camp.subject}</div>
                    </td>
                    <td><span class="badge" style="background:#f1f5f9;">${camp.target_type}</span></td>
                    <td><strong>${camp.total_recipients}</strong></td>
                    <td><span style="color: var(--color-success); font-weight: 600;">${camp.success_count}</span></td>
                    <td><span style="color: ${camp.failed_count > 0 ? 'var(--color-danger)' : 'var(--text-muted)'}; font-weight: 600;">${camp.failed_count}</span></td>
                    <td><span class="badge badge-${camp.status}">${camp.status.replace('_', ' ')}</span></td>
                    <td style="color: var(--text-muted); font-size: 0.8rem;">${new Date(camp.created_at).toLocaleDateString()}</td>
                    <td>
                      <button class="btn btn-secondary btn-sm" onclick="HistoryView.viewCampaignDetail(${camp.id})">
                        Reports &rarr;
                      </button>
                    </td>
                  </tr>
                `).join('') || `
                  <tr>
                    <td colspan="8" style="text-align: center; padding: 32px; color: var(--text-muted);">
                      No campaigns launched yet. Click "+ New Email Blast" to launch your first campus outreach!
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (error) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 48px; border-color: var(--color-danger-border);">
          <h3 style="color: var(--color-danger);">Failed to load Dashboard</h3>
          <p style="color: var(--text-muted); margin: 8px 0 20px 0;">${error.message}</p>
          <button class="btn btn-primary" onclick="DashboardView.render(document.getElementById('viewContainer'))">Retry</button>
        </div>
      `;
    }
  }
};
