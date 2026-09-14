/**
 * Real-time Live Blast Monitor Cockpit View
 * Live SSE progress tracking, speed gauges, ETA, live terminal logs, pause/resume/cancel controls
 */
const BlastMonitorView = {
  state: {
    campaignId: null,
    campaign: null,
    eventSource: null,
    status: 'idle', // 'idle', 'in_progress', 'paused', 'completed', 'cancelled'
    progress: {
      total: 0,
      sent: 0,
      success: 0,
      failed: 0,
      percentage: 0,
      speedEps: 0,
      etaSeconds: 0
    },
    logs: [],
    logFilter: 'all' // 'all', 'success', 'failed'
  },

  async render(container, routeParams = {}) {
    // If specific campaign ID passed in routeParams, use it
    let targetCampaignId = routeParams && routeParams.campaignId ? parseInt(routeParams.campaignId, 10) : this.state.campaignId;

    container.innerHTML = `
      <div class="view-loading">
        <div class="spinner"></div>
        <p>Connecting to Live Blast Cockpit...</p>
      </div>
    `;

    try {
      // If no campaign ID specified, check for the latest active or completed campaign
      if (!targetCampaignId) {
        const camps = await api.getCampaigns();
        if (camps.campaigns && camps.campaigns.length > 0) {
          targetCampaignId = camps.campaigns[0].id;
        }
      }

      if (!targetCampaignId) {
        container.innerHTML = `
          <div class="view-header">
            <div class="view-title-group">
              <h1>Live Email Blast Monitor</h1>
              <p>Real-time delivery telemetry, speed meters, and event streaming</p>
            </div>
          </div>
          <div class="card" style="text-align: center; padding: 48px;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--brand-sapphire); margin-bottom: 12px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
            <h3 style="margin-bottom: 6px;">No Active Campaign</h3>
            <p style="color: var(--text-muted); margin-bottom: 20px;">Launch an email blast from the composer to watch real-time delivery telemetry.</p>
            <button class="btn btn-primary" onclick="app.navigate('composer')">Go to Email Composer</button>
          </div>
        `;
        return;
      }

      this.state.campaignId = targetCampaignId;
      const campData = await api.getCampaign(targetCampaignId);
      this.state.campaign = campData.campaign;
      this.state.status = this.state.campaign.status;

      this.state.progress = {
        total: this.state.campaign.total_recipients,
        sent: this.state.campaign.sent_count,
        success: this.state.campaign.success_count,
        failed: this.state.campaign.failed_count,
        percentage: Math.round((this.state.campaign.sent_count / Math.max(1, this.state.campaign.total_recipients)) * 100) || 0,
        speedEps: this.state.campaign.speed_eps || 0,
        etaSeconds: 0
      };

      this.renderMonitorCockpit(container);
      this.connectSseStream(targetCampaignId);
    } catch (error) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 48px;">
          <h3 style="color: var(--color-danger);">Failed to connect monitor</h3>
          <p style="color: var(--text-muted);">${error.message}</p>
        </div>
      `;
    }
  },

  renderMonitorCockpit(container) {
    const isRunning = this.state.status === 'in_progress';
    const isPaused = this.state.status === 'paused';
    const isCompleted = this.state.status === 'completed';

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Live Email Blast Monitor</h1>
          <p>Campaign #${this.state.campaignId}: <strong>${this.state.campaign.title}</strong></p>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary btn-sm" onclick="HistoryView.viewCampaignDetail(${this.state.campaignId})">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span>Campaign Reports</span>
          </button>
        </div>
      </div>

      <!-- Live Blast Monitor Main Card -->
      <div class="blast-monitor-card">
        <div class="blast-header">
          <div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span class="badge badge-${this.state.status}" id="liveStatusBadge" style="font-size: 0.82rem; padding: 5px 14px;">
                ${this.state.status.replace('_', ' ').toUpperCase()}
              </span>
              <span style="font-size: 0.85rem; color: #94a3b8;" id="liveConnectionIndicator">● Connected via SSE</span>
            </div>
            <h2 style="font-family: var(--font-heading); font-size: 1.4rem; color: #ffffff; margin-top: 10px;">
              ${this.state.campaign.subject}
            </h2>
          </div>

          <!-- Controls Button Group -->
          <div style="display: flex; gap: 10px;">
            <button class="btn btn-warning btn-sm" id="btnPauseResume" onclick="BlastMonitorView.togglePauseResume()" style="display: ${isRunning || isPaused ? 'inline-flex' : 'none'};">
              ${isPaused ? '▶ Resume Blast' : '⏸ Pause Blast'}
            </button>
            <button class="btn btn-danger btn-sm" id="btnCancelBlast" onclick="BlastMonitorView.cancelBlast()" style="display: ${isRunning || isPaused ? 'inline-flex' : 'none'};">
              ⏹ Abort Blast
            </button>
            ${isCompleted && this.state.progress.failed > 0 ? `
              <button class="btn btn-primary btn-sm" onclick="BlastMonitorView.retryFailed()">
                🔄 Retry ${this.state.progress.failed} Failed Deliveries
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Progress Bar & Percentage Dial -->
        <div class="blast-progress-wrapper">
          <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 8px;">
            <div>
              <span style="font-size: 1.8rem; font-weight: 800; font-family: var(--font-mono); color: #ffffff;" id="progressPercentageText">
                ${this.state.progress.percentage}%
              </span>
              <span style="color: #94a3b8; font-size: 0.85rem; margin-left: 8px;">Completed</span>
            </div>
            <div style="text-align: right; color: #94a3b8; font-size: 0.82rem;">
              <span id="progressCountsText">${this.state.progress.sent} / ${this.state.progress.total} emails</span>
              ${this.state.progress.etaSeconds > 0 ? `<span id="progressEtaText"> &bull; ETA: ~${this.state.progress.etaSeconds}s</span>` : ''}
            </div>
          </div>

          <div class="progress-track">
            <div class="progress-fill" id="progressBarFill" style="width: ${this.state.progress.percentage}%;"></div>
          </div>
        </div>

        <!-- Real-time Stats Counter Grid -->
        <div class="blast-stats-row">
          <div class="blast-stat-item">
            <div class="blast-stat-num" id="statTotalRecipients">${this.state.progress.total}</div>
            <div class="blast-stat-lbl">Total Recipients</div>
          </div>
          <div class="blast-stat-item">
            <div class="blast-stat-num" style="color: #22c55e;" id="statSuccessCount">${this.state.progress.success}</div>
            <div class="blast-stat-lbl">Delivered</div>
          </div>
          <div class="blast-stat-item">
            <div class="blast-stat-num" style="color: #ef4444;" id="statFailedCount">${this.state.progress.failed}</div>
            <div class="blast-stat-lbl">Failed</div>
          </div>
          <div class="blast-stat-item">
            <div class="blast-stat-num" style="color: #38bdf8;" id="statSpeedEps">${this.state.progress.speedEps || 0}</div>
            <div class="blast-stat-lbl">Speed (Emails / sec)</div>
          </div>
        </div>
      </div>

      <!-- Real-time Event Terminal Feed -->
      <div class="card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Real-time Delivery Event Feed</h3>
            <p style="color: var(--text-muted); font-size: 0.82rem; margin-top: 2px;">Live dispatch logs stream automatically</p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-ghost btn-sm" onclick="BlastMonitorView.filterLogs('all')" id="logTabAll" style="font-weight: 700;">All</button>
            <button class="btn btn-ghost btn-sm" onclick="BlastMonitorView.filterLogs('success')" id="logTabSuccess">Delivered</button>
            <button class="btn btn-ghost btn-sm" onclick="BlastMonitorView.filterLogs('failed')" id="logTabFailed">Failed</button>
            <button class="btn btn-ghost btn-sm" onclick="BlastMonitorView.clearLogs()">Clear</button>
          </div>
        </div>

        <div class="live-log-terminal" id="liveLogTerminal">
          <div style="color: #64748b; font-style: italic;">[Telemetry Stream Initialized. Waiting for dispatch events...]</div>
        </div>
      </div>
    `;
  },

  connectSseStream(campaignId) {
    if (this.state.eventSource) {
      this.state.eventSource.close();
    }

    const liveIndicator = document.getElementById('navLiveIndicator');
    if (liveIndicator) liveIndicator.style.display = 'inline-block';

    const es = new EventSource(`/api/campaigns/${campaignId}/stream`);
    this.state.eventSource = es;

    es.addEventListener('progress', (e) => {
      try {
        const data = JSON.parse(e.data);
        this.updateProgressUI(data);
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    });

    es.addEventListener('log', (e) => {
      try {
        const data = JSON.parse(e.data);
        this.appendLog(data);
      } catch (err) {
        console.error('SSE log error:', err);
      }
    });

    es.addEventListener('status_change', (e) => {
      try {
        const data = JSON.parse(e.data);
        this.state.status = data.status;
        this.updateStatusBadge(data.status);
        app.showToast(data.message, 'info');
      } catch (err) {
        console.error('SSE status error:', err);
      }
    });

    es.addEventListener('smtp_switched', (e) => {
      try {
        const data = JSON.parse(e.data);
        app.showToast(`🔄 Sender Auto-Switched: ${data.oldSender} ➔ ${data.newSender} (${data.reason})`, 'warning');
        const stream = document.getElementById('blastTelemetryStream');
        if (stream) {
          const logDiv = document.createElement('div');
          logDiv.style.cssText = 'color: #f59e0b; margin-bottom: 6px; font-weight: 600;';
          logDiv.innerHTML = `<span>[${new Date().toLocaleTimeString()}]</span> 🔄 <strong>AUTO-FAILOVER:</strong> ${data.reason} &bull; Switched sender to <code>${data.newSender}</code>`;
          stream.insertBefore(logDiv, stream.firstChild);
        }
      } catch (err) {
        console.error('SSE smtp_switched error:', err);
      }
    });

    es.addEventListener('done', (e) => {
      try {
        const data = JSON.parse(e.data);
        this.state.status = data.status;
        this.updateStatusBadge(data.status);
        if (liveIndicator) liveIndicator.style.display = 'none';

        app.showToast(`Blast completed! Delivered: ${data.success}, Failed: ${data.failed}`, 'success');

        const btnPause = document.getElementById('btnPauseResume');
        const btnCancel = document.getElementById('btnCancelBlast');
        if (btnPause) btnPause.style.display = 'none';
        if (btnCancel) btnCancel.style.display = 'none';
      } catch (err) {
        console.error('SSE done error:', err);
      }
    });

    es.onerror = () => {
      const conn = document.getElementById('liveConnectionIndicator');
      if (conn) conn.textContent = '○ Reconnecting...';
    };
  },

  updateProgressUI(data) {
    this.state.progress = data;

    const percentEl = document.getElementById('progressPercentageText');
    if (percentEl) percentEl.textContent = `${data.percentage}%`;

    const barEl = document.getElementById('progressBarFill');
    if (barEl) barEl.style.width = `${data.percentage}%`;

    const countsEl = document.getElementById('progressCountsText');
    if (countsEl) countsEl.textContent = `${data.sent} / ${data.total} emails`;

    const etaEl = document.getElementById('progressEtaText');
    if (etaEl) {
      etaEl.textContent = data.etaSeconds > 0 ? ` • ETA: ~${data.etaSeconds}s` : '';
    }

    const totalEl = document.getElementById('statTotalRecipients');
    if (totalEl) totalEl.textContent = data.total;

    const succEl = document.getElementById('statSuccessCount');
    if (succEl) succEl.textContent = data.success;

    const failEl = document.getElementById('statFailedCount');
    if (failEl) failEl.textContent = data.failed;

    const speedEl = document.getElementById('statSpeedEps');
    if (speedEl) speedEl.textContent = data.speedEps || 0;
  },

  updateStatusBadge(status) {
    const badge = document.getElementById('liveStatusBadge');
    if (badge) {
      badge.className = `badge badge-${status}`;
      badge.textContent = status.replace('_', ' ').toUpperCase();
    }

    const btnPause = document.getElementById('btnPauseResume');
    if (btnPause) {
      btnPause.textContent = status === 'paused' ? '▶ Resume Blast' : '⏸ Pause Blast';
    }
  },

  appendLog(logData) {
    this.state.logs.push(logData);
    this.renderLogEntry(logData);
  },

  renderLogEntry(logData) {
    const terminal = document.getElementById('liveLogTerminal');
    if (!terminal) return;

    // Filter check
    if (this.state.logFilter === 'success' && logData.status !== 'Delivered') return;
    if (this.state.logFilter === 'failed' && logData.status !== 'Failed') return;

    const entry = document.createElement('div');
    entry.className = 'log-entry';

    const isSuccess = logData.status === 'Delivered';
    const statusClass = isSuccess ? 'log-success' : 'log-error';
    const statusIcon = isSuccess ? '✔' : '✖';

    entry.innerHTML = `
      <span class="log-time">[${logData.timestamp || new Date().toLocaleTimeString()}]</span>
      <span class="${statusClass}">${statusIcon} ${logData.status.toUpperCase()}</span>
      <span style="color: #f8fafc;">&rarr;</span>
      <span style="color: #93c5fd;">${logData.recipientName}</span>
      <span style="color: #64748b;">(${logData.recipientEmail})</span>
      <span style="color: #cbd5e1; margin-left: auto;">${logData.latencyMs ? logData.latencyMs + 'ms' : ''}</span>
      ${logData.error ? `<div style="color: #f87171; font-size: 0.75rem; margin-top: 2px; width: 100%;">Reason: ${logData.error}</div>` : ''}
    `;

    terminal.appendChild(entry);
    terminal.scrollTop = terminal.scrollHeight;
  },

  filterLogs(filter) {
    this.state.logFilter = filter;
    ['all', 'success', 'failed'].forEach(f => {
      const tab = document.getElementById(`logTab${f.charAt(0).toUpperCase() + f.slice(1)}`);
      if (tab) {
        tab.style.fontWeight = f === filter ? '700' : '400';
        tab.style.color = f === filter ? 'var(--brand-sapphire)' : 'var(--text-secondary)';
      }
    });

    const terminal = document.getElementById('liveLogTerminal');
    if (terminal) {
      terminal.innerHTML = '';
      this.state.logs.forEach(l => this.renderLogEntry(l));
    }
  },

  clearLogs() {
    this.state.logs = [];
    const terminal = document.getElementById('liveLogTerminal');
    if (terminal) terminal.innerHTML = '<div style="color: #64748b; font-style: italic;">[Logs Cleared]</div>';
  },

  async togglePauseResume() {
    try {
      if (this.state.status === 'paused') {
        await api.resumeCampaign(this.state.campaignId);
      } else {
        await api.pauseCampaign(this.state.campaignId);
      }
    } catch (error) {
      app.showToast('Control error: ' + error.message, 'error');
    }
  },

  async cancelBlast() {
    if (!confirm('Are you sure you want to cancel the remaining emails in this blast?')) return;
    try {
      await api.cancelCampaign(this.state.campaignId);
      app.showToast('Blast cancelled', 'warning');
    } catch (error) {
      app.showToast('Cancel error: ' + error.message, 'error');
    }
  },

  async retryFailed() {
    try {
      const res = await api.retryFailedCampaign(this.state.campaignId);
      app.showToast(res.message, 'success');
      this.render(document.getElementById('viewContainer'), { campaignId: this.state.campaignId });
    } catch (error) {
      app.showToast('Retry error: ' + error.message, 'error');
    }
  },

  destroy() {
    if (this.state.eventSource) {
      this.state.eventSource.close();
      this.state.eventSource = null;
    }
  }
};
