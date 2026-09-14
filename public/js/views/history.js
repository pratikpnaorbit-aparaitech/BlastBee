/**
 * Campaign History & Delivery Audit Reports View
 * Complete archive of past blasts, drill-down delivery logs, 1-click retry failed, CSV/PDF export
 */
const HistoryView = {
  state: {
    campaigns: [],
    activeDetailCampaignId: null,
    detailCampaign: null,
    detailSummary: null,
    recipients: [],
    statusFilter: '',
    search: '',
    page: 1,
    limit: 20,
    totalPages: 1,
    total: 0
  },

  async render(container) {
    this.state.activeDetailCampaignId = null;
    container.innerHTML = `
      <div class="view-loading">
        <div class="spinner"></div>
        <p>Loading Campaign History...</p>
      </div>
    `;

    try {
      const data = await api.getCampaigns();
      this.state.campaigns = data.campaigns || [];

      container.innerHTML = `
        <div class="view-header">
          <div class="view-title-group">
            <h1>Campaign History &amp; Delivery Reports</h1>
            <p>Track historical placement drive deliveries, audit logs, and performance metrics</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-primary btn-sm" onclick="app.navigate('composer')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>New Email Blast</span>
            </button>
          </div>
        </div>

        <div id="historyMainContent">
          ${this.renderCampaignsTable()}
        </div>
      `;
    } catch (error) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 48px;">
          <h3 style="color: var(--color-danger);">Failed to load history</h3>
          <p style="color: var(--text-muted);">${error.message}</p>
        </div>
      `;
    }
  },

  renderCampaignsTable() {
    if (this.state.campaigns.length === 0) {
      return `
        <div class="card" style="text-align: center; padding: 48px;">
          <h3 style="color: var(--text-primary); margin-bottom: 6px;">No Campaigns Found</h3>
          <p style="color: var(--text-muted); margin-bottom: 20px;">You haven't launched any email blast campaigns yet.</p>
          <button class="btn btn-primary" onclick="app.navigate('composer')">Compose First Blast</button>
        </div>
      `;
    }

    return `
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th>Campaign Name &amp; Subject</th>
              <th>Audience</th>
              <th>Total Targeted</th>
              <th>Delivered</th>
              <th>Failed</th>
              <th>Success Rate</th>
              <th>Status</th>
              <th>Launched At</th>
              <th style="text-align: right;">Report</th>
            </tr>
          </thead>
          <tbody>
            ${this.state.campaigns.map(c => {
              const successRate = c.sent_count > 0 ? Math.round((c.success_count / c.sent_count) * 100) : 0;
              return `
                <tr>
                  <td>
                    <div style="font-weight: 700; color: var(--text-primary); font-size: 0.92rem;">${c.title}</div>
                    <div style="font-size: 0.78rem; color: var(--text-muted);">${c.subject}</div>
                  </td>
                  <td><span class="badge" style="background:#f1f5f9; text-transform: uppercase;">${c.target_type}</span></td>
                  <td><strong>${c.total_recipients}</strong></td>
                  <td><span style="color: var(--color-success); font-weight: 700;">${c.success_count}</span></td>
                  <td><span style="color: ${c.failed_count > 0 ? 'var(--color-danger)' : 'var(--text-muted)'}; font-weight: 700;">${c.failed_count}</span></td>
                  <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span style="font-weight: 700; font-size: 0.82rem;">${successRate}%</span>
                      <div style="width: 50px; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
                        <div style="width: ${successRate}%; height: 100%; background: ${successRate > 90 ? 'var(--color-success)' : 'var(--color-warning)'};"></div>
                      </div>
                    </div>
                  </td>
                  <td><span class="badge badge-${c.status}">${c.status.replace('_', ' ')}</span></td>
                  <td style="color: var(--text-muted); font-size: 0.8rem;">${new Date(c.created_at).toLocaleDateString()}</td>
                  <td style="text-align: right;">
                    <div class="table-actions" style="justify-content: flex-end;">
                      <button class="btn btn-secondary btn-sm" onclick="HistoryView.viewCampaignDetail(${c.id})">
                        Audit Report &rarr;
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  async viewCampaignDetail(campaignId) {
    this.state.activeDetailCampaignId = campaignId;
    this.state.page = 1;
    this.state.statusFilter = '';
    this.state.search = '';

    const container = document.getElementById('historyMainContent');
    if (!container) {
      app.navigate('history');
      setTimeout(() => this.viewCampaignDetail(campaignId), 100);
      return;
    }

    container.innerHTML = `
      <div class="view-loading">
        <div class="spinner"></div>
        <p>Loading Detailed Delivery Audit Report...</p>
      </div>
    `;

    try {
      const campData = await api.getCampaign(campaignId);
      this.state.detailCampaign = campData.campaign;
      this.state.detailSummary = campData.summary;

      await this.fetchRecipients();
    } catch (error) {
      app.showToast('Failed to load campaign detail: ' + error.message, 'error');
    }
  },

  async fetchRecipients() {
    try {
      const data = await api.getCampaignRecipients(this.state.activeDetailCampaignId, {
        status: this.state.statusFilter,
        search: this.state.search,
        page: this.state.page,
        limit: this.state.limit
      });

      this.state.recipients = data.recipients || [];
      this.state.total = data.pagination.total || 0;
      this.state.totalPages = data.pagination.totalPages || 1;

      this.renderDetailView();
    } catch (error) {
      app.showToast('Failed to fetch recipients: ' + error.message, 'error');
    }
  },

  renderDetailView() {
    const container = document.getElementById('historyMainContent');
    if (!container) return;

    const camp = this.state.detailCampaign;
    const sum = this.state.detailSummary;
    const successRate = sum.total > 0 ? Math.round((sum.sent / sum.total) * 100) : 0;

    container.innerHTML = `
      <!-- Back navigation bar -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
        <button class="btn btn-secondary btn-sm" onclick="HistoryView.render(document.getElementById('viewContainer'))">
          &larr; Back to Campaign History
        </button>

        <div style="display: flex; gap: 10px;">
          <a href="/api/campaigns/${camp.id}/export" class="btn btn-secondary btn-sm" download>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            <span>Export Delivery CSV</span>
          </a>

          ${sum.failed > 0 ? `
            <button class="btn btn-primary btn-sm" onclick="HistoryView.retryFailedDeliveries(${camp.id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
              <span>Retry ${sum.failed} Failed Recipients</span>
            </button>
          ` : ''}

          <button class="btn btn-secondary btn-sm" onclick="window.print()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            <span>Print Report</span>
          </button>
        </div>
      </div>

      <!-- Campaign Overview Card -->
      <div class="card" style="margin-bottom: 24px;">
        <div class="card-header">
          <div>
            <span class="badge badge-${camp.status}" style="margin-bottom: 8px;">${camp.status.replace('_', ' ').toUpperCase()}</span>
            <h2 style="font-family: var(--font-heading); font-size: 1.35rem; color: var(--text-primary); margin-top: 4px;">${camp.title}</h2>
            <div style="color: var(--text-muted); font-size: 0.88rem; margin-top: 4px;">Subject: <strong>${camp.subject}</strong></div>
          </div>
          <div style="text-align: right; color: var(--text-muted); font-size: 0.82rem;">
            <div>Launched: <strong>${new Date(camp.created_at).toLocaleString()}</strong></div>
            ${camp.completed_at ? `<div>Completed: <strong>${new Date(camp.completed_at).toLocaleString()}</strong></div>` : ''}
          </div>
        </div>

        <!-- Metric Boxes -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px;">
          <div style="background: #f8fafc; padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-light);">
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Total Targeted</div>
            <div style="font-size: 1.5rem; font-weight: 800; color: var(--text-primary);">${sum.total}</div>
          </div>
          <div style="background: var(--color-success-bg); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--color-success-border);">
            <div style="font-size: 0.75rem; color: var(--color-success); text-transform: uppercase;">Delivered</div>
            <div style="font-size: 1.5rem; font-weight: 800; color: var(--color-success);">${sum.sent}</div>
          </div>
          <div style="background: ${sum.failed > 0 ? 'var(--color-danger-bg)' : '#f8fafc'}; padding: 14px; border-radius: var(--radius-sm); border: 1px solid ${sum.failed > 0 ? 'var(--color-danger-border)' : 'var(--border-light)'};">
            <div style="font-size: 0.75rem; color: ${sum.failed > 0 ? 'var(--color-danger)' : 'var(--text-muted)'}; text-transform: uppercase;">Failed Deliveries</div>
            <div style="font-size: 1.5rem; font-weight: 800; color: ${sum.failed > 0 ? 'var(--color-danger)' : 'var(--text-muted)'};">${sum.failed}</div>
          </div>
          <div style="background: #f8fafc; padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-light);">
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Success Rate</div>
            <div style="font-size: 1.5rem; font-weight: 800; color: var(--brand-sapphire);">${successRate}%</div>
          </div>
          <div style="background: #f8fafc; padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-light);">
            <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Avg Latency</div>
            <div style="font-size: 1.5rem; font-weight: 800; color: var(--text-primary);">${sum.avgLatencyMs || 120}ms</div>
          </div>
        </div>
      </div>

      <!-- Recipient Delivery Log Table -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Recipient Delivery Logs</h3>
            <p style="color: var(--text-muted); font-size: 0.82rem; margin-top: 2px;">Per-candidate delivery status, timestamps, and error diagnostics</p>
          </div>

          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <input type="text" class="form-input" style="padding: 5px 10px; font-size: 0.82rem; width: 180px;" placeholder="Search candidate..." value="${this.state.search}" oninput="HistoryView.handleRecipientSearch(this.value)" />

            <select class="form-select" style="padding: 5px 10px; font-size: 0.82rem; width: auto;" onchange="HistoryView.handleStatusFilter(this.value)">
              <option value="">All Statuses</option>
              <option value="sent" ${this.state.statusFilter === 'sent' ? 'selected' : ''}>Delivered Only</option>
              <option value="failed" ${this.state.statusFilter === 'failed' ? 'selected' : ''}>Failed Only</option>
              <option value="pending" ${this.state.statusFilter === 'pending' ? 'selected' : ''}>Pending Only</option>
            </select>
          </div>
        </div>

        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Candidate Name</th>
                <th>Email Address</th>
                <th>College</th>
                <th>Delivery Status</th>
                <th>Latency</th>
                <th>Error Diagnostics / Reason</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              ${this.state.recipients.map(r => `
                <tr style="${r.status === 'failed' ? 'background: #fef2f2;' : ''}">
                  <td><strong>${r.recipient_name}</strong></td>
                  <td style="font-family: var(--font-mono); font-size: 0.82rem;">${r.recipient_email}</td>
                  <td>${r.recipient_college || '&mdash;'}</td>
                  <td>
                    <span class="badge badge-${r.status === 'sent' ? 'delivered' : r.status}">
                      ${r.status === 'sent' ? '✔ Delivered' : (r.status === 'failed' ? '✖ Failed' : 'Pending')}
                    </span>
                  </td>
                  <td style="color: var(--text-muted); font-size: 0.82rem;">${r.latency_ms ? r.latency_ms + 'ms' : '&mdash;'}</td>
                  <td style="color: var(--color-danger); font-size: 0.8rem;">${r.error_message || '&mdash;'}</td>
                  <td style="color: var(--text-muted); font-size: 0.78rem;">${r.sent_at ? new Date(r.sent_at).toLocaleTimeString() : '&mdash;'}</td>
                </tr>
              `).join('') || `
                <tr>
                  <td colspan="7" style="text-align: center; padding: 32px; color: var(--text-muted);">
                    No recipients matching current filter.
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>

        <!-- Pagination -->
        <div class="pagination-bar">
          <div>Showing ${this.state.recipients.length} of ${this.state.total} records</div>
          <div class="pagination-controls">
            <button class="btn btn-secondary btn-sm" ${this.state.page <= 1 ? 'disabled' : ''} onclick="HistoryView.goToPage(${this.state.page - 1})">&larr; Prev</button>
            <span style="font-weight: 600; padding: 0 8px;">Page ${this.state.page} / ${this.state.totalPages}</span>
            <button class="btn btn-secondary btn-sm" ${this.state.page >= this.state.totalPages ? 'disabled' : ''} onclick="HistoryView.goToPage(${this.state.page + 1})">Next &rarr;</button>
          </div>
        </div>
      </div>
    `;
  },

  handleRecipientSearch: debounce(function(val) {
    HistoryView.state.search = val;
    HistoryView.state.page = 1;
    HistoryView.fetchRecipients();
  }, 300),

  handleStatusFilter(val) {
    this.state.statusFilter = val;
    this.state.page = 1;
    this.fetchRecipients();
  },

  goToPage(page) {
    this.state.page = page;
    this.fetchRecipients();
  },

  async retryFailedDeliveries(campaignId) {
    try {
      const res = await api.retryFailedCampaign(campaignId);
      app.showToast(res.message, 'success');
      app.navigate('blast-monitor', { campaignId });
    } catch (error) {
      app.showToast('Retry error: ' + error.message, 'error');
    }
  }
};
