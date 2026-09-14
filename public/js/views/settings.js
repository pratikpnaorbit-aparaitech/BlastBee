/**
 * Settings & SMTP Configuration View
 * Multi-SMTP Senders Pool, Auto-Rotation (Round-Robin & Auto-Failover), daily limits, connection diagnostics
 */
const SettingsView = {
  state: {
    settings: {},
    smtpAccounts: []
  },

  async render(container) {
    container.innerHTML = `
      <div class="view-loading">
        <div class="spinner"></div>
        <p>Loading System &amp; Multi-SMTP Settings...</p>
      </div>
    `;

    try {
      const [settingsData, accountsData, subData] = await Promise.all([
        api.getSettings(),
        api.getSmtpAccounts(),
        api.getSubscription().catch(() => ({ subscription: null }))
      ]);

      this.state.settings = settingsData.settings || {};
      this.state.smtpAccounts = accountsData.accounts || [];
      this.state.subscription = subData.subscription || null;

      const s = this.state.settings;
      const accounts = this.state.smtpAccounts;
      const sub = this.state.subscription;

      container.innerHTML = `
        <div class="view-header">
          <div class="view-title-group">
            <h1>Settings &amp; Multi-SMTP Delivery Engine</h1>
            <p>Manage multiple SMTP sender accounts, auto-rotation load balancing, daily quotas, and branding</p>
          </div>
          <div class="header-actions">
            <button class="btn btn-secondary btn-sm" onclick="SettingsView.openAddAccountModal()">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>Add Sender Account</span>
            </button>
            <button class="btn btn-primary btn-sm" onclick="SettingsView.saveGeneralSettings()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
              <span>Save System Settings</span>
            </button>
          </div>
        </div>

        <!-- 2. Multi-SMTP Sender Accounts Pool Card -->
        <div class="card" style="margin-bottom: 24px;">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div>
              <h3 class="card-title">2. Multi-SMTP Sender Accounts Pool (${accounts.length} Configured)</h3>
              <p style="font-size: 0.82rem; color: var(--text-muted); margin-top: 2px;">
                Add multiple Gmail / Workspace accounts to send up to 2,500+ emails/day with automatic switching when limits are reached
              </p>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-secondary btn-sm" onclick="SettingsView.resetCounters()" title="Reset daily sent counts to 0">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"></polyline><polyline points="23 20 23 14 17 14"></polyline><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path></svg>
                <span>Reset Daily Counters</span>
              </button>
              <button class="btn btn-primary btn-sm" onclick="SettingsView.openAddAccountModal()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                <span>+ Add SMTP Sender</span>
              </button>
            </div>
          </div>

          <!-- Subscription Server Quota Banner ("How much server you gave") -->
          ${sub && sub.serverAllocation ? `
            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: var(--radius-sm); padding: 12px 18px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 1.3rem;">👑</span>
                <div>
                  <div style="font-weight: 700; font-size: 0.88rem; color: #1e40af;">
                    Subscription Server Quota: ${sub.plan_name} (${sub.serverAllocation.active_servers} / ${sub.serverAllocation.max_servers_given} Active Servers Used)
                  </div>
                  <div style="font-size: 0.78rem; color: #3b82f6;">
                    Your license grants ${sub.serverAllocation.max_servers_given} dedicated SMTP senders.
                    ${sub.serverAllocation.remaining_servers > 0 ? `${sub.serverAllocation.remaining_servers} additional sender slots available.` : `All ${sub.serverAllocation.max_servers_given} slots in use.`}
                  </div>
                </div>
              </div>
              <button class="btn btn-outline btn-xs" onclick="app.openUpgradeModal()" style="background: #ffffff; color: #2563eb; border-color: #93c5fd; font-weight: 600;">
                <span>⚡ Upgrade Server Quota &nearr;</span>
              </button>
            </div>
          ` : ''}

          <!-- Rotation Strategy Configuration -->
          <div style="background: #f8fafc; border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 14px 18px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="font-size: 1.2rem;">🔄</span>
              <div>
                <div style="font-weight: 600; font-size: 0.88rem; color: var(--text-primary);">Auto-Rotation &amp; Failover Strategy:</div>
                <div style="font-size: 0.78rem; color: var(--text-muted);">How emails should be distributed across multiple SMTP sender accounts</div>
              </div>
            </div>
            <div style="min-width: 260px;">
              <select id="rotationStrategySelect" class="form-select" onchange="SettingsView.handleStrategyChange(this.value)">
                <option value="round_robin" ${s.smtp_rotation_strategy === 'round_robin' ? 'selected' : ''}>🔄 Round-Robin (Distribute emails evenly)</option>
                <option value="auto_failover" ${s.smtp_rotation_strategy === 'auto_failover' ? 'selected' : ''}>⚡ Auto-Failover (Switch when limit is reached)</option>
                <option value="single" ${s.smtp_rotation_strategy === 'single' ? 'selected' : ''}>🎯 Single Primary (Use first active sender)</option>
              </select>
            </div>
          </div>

          <!-- Accounts List -->
          <div id="smtpAccountsList">
            ${this.renderAccountsList(accounts)}
          </div>
        </div>

        <!-- 3. Rate Limiting & Throttling Card -->
        <div class="card" style="margin-bottom: 24px;">
          <div class="card-header">
            <h3 class="card-title">3. Blast Throttling &amp; Speed Controls</h3>
          </div>

          <div>
            <div class="form-group">
              <label class="form-label">Delay Between Each Email: <span id="delayValText" style="color: var(--brand-sapphire); font-weight: 700;">${s.send_delay_ms || 300} ms</span></label>
              <input type="range" id="sendDelayRange" class="form-range" min="50" max="2000" step="50" value="${s.send_delay_ms || 300}" oninput="document.getElementById('delayValText').textContent = this.value + ' ms'" style="width: 100%; accent-color: var(--brand-sapphire);" />
              <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Controls sending speed (~${Math.round(1000 / (parseInt(s.send_delay_ms || 300, 10)))} emails/sec) to avoid provider rate limits.</p>
            </div>

          </div>
        </div>

        <!-- 4. Company Branding Card -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">4. Aparaitech Corporate Branding</h3>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div class="form-group">
              <label class="form-label">Organization Name</label>
              <input type="text" id="companyNameInput" class="form-input" value="${s.company_name || 'Aparaitech Software'}" />
            </div>
            <div class="form-group">
              <label class="form-label">Official Website</label>
              <input type="text" id="companyWebsiteInput" class="form-input" value="${s.company_website || 'https://aparaitech.org'}" />
            </div>
            <div class="form-group">
              <label class="form-label">Corporate Office Locations</label>
              <input type="text" id="companyLocationInput" class="form-input" value="${s.company_location || 'Baramati (Pune) & Bengaluru, India'}" />
            </div>
            <div class="form-group">
              <label class="form-label">Recruitment Inquiries Reply-To</label>
              <input type="email" id="replyToInput" class="form-input" value="${s.reply_to || 'careers@aparaitech.org'}" />
            </div>
          </div>
        </div>
      `;
    } catch (error) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 48px;">
          <h3 style="color: var(--color-danger);">Failed to load settings</h3>
          <p style="color: var(--text-muted);">${error.message}</p>
        </div>
      `;
    }
  },

  renderAccountsList(accounts) {
    if (!accounts || accounts.length === 0) {
      return `
        <div style="text-align: center; padding: 36px 20px; border: 2px dashed #cbd5e1; border-radius: var(--radius-sm); background: #f8fafc;">
          <div style="font-size: 2.2rem; margin-bottom: 8px;">🖥️</div>
          <h4 style="font-size: 1.05rem; font-weight: 700; color: #1e293b; margin-bottom: 4px;">No SMTP Senders Connected Yet</h4>
          <p style="font-size: 0.84rem; color: #64748b; max-width: 520px; margin: 0 auto 16px auto;">
            Your <strong>7-Day Free Trial</strong> includes <strong>1 dedicated active SMTP sender</strong>. Connect your Gmail App Password, Google Workspace, or custom SMTP server to begin sending outreach blasts.
          </p>
          <button class="btn btn-primary btn-sm" onclick="SettingsView.openAddAccountModal()">
            + Connect My 1st SMTP Sender
          </button>
        </div>
      `;
    }

    return `
      <div style="display: flex; flex-direction: column; gap: 12px;">
        ${accounts.map((acc, index) => {
          const limit = acc.daily_limit || 500;
          const sent = acc.sent_today || 0;
          const pct = Math.min(100, Math.round((sent / limit) * 100));
          const isLimitReached = acc.isLimitReached;

          let statusBadge = `<span class="badge badge-success">Active</span>`;
          if (!acc.is_active) {
            statusBadge = `<span class="badge" style="background: #e2e8f0; color: #64748b;">Disabled</span>`;
          } else if (isLimitReached) {
            statusBadge = `<span class="badge badge-danger">Limit Reached (${sent}/${limit})</span>`;
          }

          return `
            <div style="border: 1.5px solid ${acc.is_active ? '#cbd5e1' : '#e2e8f0'}; border-radius: var(--radius-sm); padding: 16px; background: ${acc.is_active ? '#ffffff' : '#f8fafc'}; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px;">
              <div style="display: flex; align-items: center; gap: 14px; min-width: 260px;">
                <div style="width: 38px; height: 38px; border-radius: 50%; background: ${acc.is_active ? 'var(--color-info-bg)' : '#f1f5f9'}; color: ${acc.is_active ? 'var(--brand-sapphire)' : '#94a3b8'}; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.95rem;">
                  #${index + 1}
                </div>
                <div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <strong style="font-size: 0.95rem; color: var(--text-primary);">${acc.name}</strong>
                    ${statusBadge}
                  </div>
                  <div style="font-family: var(--font-mono); font-size: 0.82rem; color: var(--brand-sapphire); margin-top: 2px;">
                    ${acc.user} &bull; <span style="color: var(--text-muted);">${acc.host}:${acc.port}</span>
                  </div>
                  <div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 2px;">
                    From: "${acc.from_name || 'Aparaitech Recruitment'}" &lt;${acc.from_email || acc.user}&gt;
                  </div>
                </div>
              </div>

              <!-- Daily Quota Progress -->
              <div style="min-width: 180px; flex: 1; max-width: 260px;">
                <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">
                  <span>Daily Quota Used</span>
                  <span style="font-weight: 600; color: ${isLimitReached ? 'var(--color-danger)' : 'var(--text-primary)'};">${sent} / ${limit}</span>
                </div>
                <div style="height: 6px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                  <div style="height: 100%; width: ${pct}%; background: ${isLimitReached ? 'var(--color-danger)' : (pct > 80 ? 'var(--color-warning)' : 'var(--color-success)')};"></div>
                </div>
              </div>

              <!-- Actions -->
              <div style="display: flex; align-items: center; gap: 8px;">
                <button class="btn btn-secondary btn-sm" onclick="SettingsView.testAccount(${acc.id})" title="Test SMTP Connection">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                  <span>Test</span>
                </button>
                <button class="btn btn-secondary btn-sm" onclick="SettingsView.toggleAccountActive(${acc.id})" title="${acc.is_active ? 'Disable' : 'Enable'} this sender">
                  <span>${acc.is_active ? 'Disable' : 'Enable'}</span>
                </button>
                <button class="btn btn-secondary btn-sm" onclick="SettingsView.openEditAccountModal(${acc.id})" title="Edit Credentials">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                  <span>Edit</span>
                </button>
                <button class="btn btn-danger btn-sm" onclick="SettingsView.deleteAccount(${acc.id}, '${acc.name.replace(/'/g, "\\'")}')" title="Delete Account">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  async handleStrategyChange(strategy) {
    try {
      await api.updateSettings({ smtp_rotation_strategy: strategy });
      this.state.settings.smtp_rotation_strategy = strategy;
      app.showToast(`Updated sender rotation strategy to: "${strategy}"`, 'success');
    } catch (e) {
      app.showToast('Failed to update strategy: ' + e.message, 'error');
    }
  },

  async saveGeneralSettings() {
    const payload = {
      mailer_mode: 'smtp',
      smtp_rotation_strategy: document.getElementById('rotationStrategySelect')?.value || 'round_robin',
      send_delay_ms: document.getElementById('sendDelayRange')?.value || 300,
      company_name: document.getElementById('companyNameInput')?.value || 'Aparaitech Software',
      company_website: document.getElementById('companyWebsiteInput')?.value || 'https://aparaitech.org',
      company_location: document.getElementById('companyLocationInput')?.value || 'Baramati (Pune) & Bengaluru, India',
      reply_to: document.getElementById('replyToInput')?.value || 'careers@aparaitech.org'
    };

    try {
      const res = await api.updateSettings(payload);
      app.showToast(res.message || 'System settings saved successfully!', 'success');
      app.refreshEnvironmentBadge();
    } catch (err) {
      app.showToast('Failed to save settings: ' + err.message, 'error');
    }
  },

  async toggleAccountActive(id) {
    try {
      const res = await api.toggleSmtpAccount(id);
      app.showToast(res.message, 'success');
      this.render(document.getElementById('viewContainer'));
    } catch (e) {
      app.showToast('Error toggling account: ' + e.message, 'error');
    }
  },

  async testAccount(id) {
    const acc = this.state.smtpAccounts.find(a => a.id === id);
    if (!acc) return;

    app.showToast(`Testing connection for ${acc.user}...`, 'info');
    try {
      const res = await api.testSmtpAccount(acc);
      app.showToast(res.message, 'success');
    } catch (e) {
      app.showToast('Connection failed: ' + e.message, 'error');
    }
  },

  async deleteAccount(id, name) {
    if (!confirm(`Are you sure you want to remove SMTP account "${name}" from the pool?`)) return;

    try {
      const res = await api.deleteSmtpAccount(id);
      app.showToast(res.message, 'success');
      this.render(document.getElementById('viewContainer'));
    } catch (e) {
      app.showToast('Failed to delete account: ' + e.message, 'error');
    }
  },

  async resetCounters() {
    if (!confirm('Reset daily sent counts back to 0 for all SMTP sender accounts?')) return;
    try {
      const res = await api.resetSmtpCounters();
      app.showToast(res.message, 'success');
      this.render(document.getElementById('viewContainer'));
    } catch (e) {
      app.showToast('Failed to reset counters: ' + e.message, 'error');
    }
  },

  openAddAccountModal() {
    this.openAccountModal();
  },

  openEditAccountModal(id) {
    const acc = this.state.smtpAccounts.find(a => a.id === id);
    if (acc) this.openAccountModal(acc);
  },

  openAccountModal(account = null) {
    const isEdit = !!account;
    const a = account || {
      name: '',
      host: 'smtp.gmail.com',
      port: 587,
      secure: 0,
      user: '',
      pass: '',
      from_name: 'Aparaitech Software Recruitment Team',
      from_email: '',
      reply_to: 'careers@aparaitech.org',
      daily_limit: 500,
      priority: this.state.smtpAccounts.length + 1
    };

    app.openModal(`
      <div class="modal-header">
        <h3 class="modal-title">${isEdit ? 'Edit SMTP Sender Account' : 'Add New SMTP Sender Account'}</h3>
        <button class="modal-close" onclick="app.closeModal()">&times;</button>
      </div>
      <form id="smtpAccountModalForm" onsubmit="SettingsView.submitAccountModal(event, ${isEdit ? a.id : 'null'})">
        <p style="color: var(--text-muted); font-size: 0.84rem; margin-bottom: 16px;">
          Configure an additional sender account (e.g. Gmail / Workspace with 16-character App Password). The blast manager will automatically rotate and switch senders when daily limits are reached.
        </p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Account Label / Name *</label>
            <input type="text" name="name" class="form-input" value="${a.name}" placeholder="e.g. HR Team 1 - Bengaluru" required />
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Daily Sending Limit (Emails/Day)</label>
            <input type="number" name="daily_limit" class="form-input" value="${a.daily_limit || 500}" placeholder="500 for Google, 100 for free" />
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 14px; margin-bottom: 14px;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">SMTP Host *</label>
            <input type="text" name="host" class="form-input" value="${a.host || 'smtp.gmail.com'}" required />
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">SMTP Port *</label>
            <input type="number" name="port" class="form-input" value="${a.port || 587}" required />
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">SMTP Username / Email *</label>
            <input type="email" name="user" class="form-input" value="${a.user}" placeholder="hr.sender@aparaitech.org" required />
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">SMTP Password / App Password *</label>
            <div style="position: relative;">
              <input type="password" id="modalSmtpPass" name="pass" class="form-input" value="${a.pass || ''}" placeholder="16-char App Password" required />
              <button type="button" onclick="SettingsView.toggleModalPassword()" style="position: absolute; right: 8px; top: 8px; background: none; border: none; cursor: pointer; color: var(--text-muted);">👁️</button>
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px;">
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">From Display Name</label>
            <input type="text" name="from_name" class="form-input" value="${a.from_name || 'Aparaitech Software Recruitment Team'}" />
          </div>
          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">From Email Address</label>
            <input type="email" name="from_email" class="form-input" value="${a.from_email || a.user || ''}" placeholder="Leave blank to use username" />
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 24px; border-top: 1px solid var(--border-light); padding-top: 16px;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="SettingsView.testModalAccountConnection()">
            ⚡ Test Connection
          </button>
          <div style="display: flex; gap: 10px;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="app.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary btn-sm" id="btnSaveModalAccount">
              ${isEdit ? 'Update Account' : 'Save Account to Pool'}
            </button>
          </div>
        </div>
      </form>
    `);
  },

  toggleModalPassword() {
    const input = document.getElementById('modalSmtpPass');
    if (input) {
      input.type = input.type === 'password' ? 'text' : 'password';
    }
  },

  async testModalAccountConnection() {
    const form = document.getElementById('smtpAccountModalForm');
    if (!form) return;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    app.showToast(`Testing connection for ${data.user || 'server'}...`, 'info');
    try {
      const res = await api.testSmtpAccount(data);
      app.showToast(res.message, 'success');
    } catch (e) {
      app.showToast('Test failed: ' + e.message, 'error');
    }
  },

  async submitAccountModal(event, editId = null) {
    event.preventDefault();
    const btn = document.getElementById('btnSaveModalAccount');
    if (btn) btn.disabled = true;

    const formData = new FormData(event.target);
    const payload = Object.fromEntries(formData.entries());

    try {
      if (editId) {
        const res = await api.updateSmtpAccount(editId, payload);
        app.showToast(res.message || 'Account updated!', 'success');
      } else {
        const res = await api.createSmtpAccount(payload);
        app.showToast(res.message || 'Account added to pool!', 'success');
      }
      app.closeModal();
      this.render(document.getElementById('viewContainer'));
    } catch (e) {
      if (btn) btn.disabled = false;
      app.showToast('Failed to save account: ' + e.message, 'error');
    }
  }
};
