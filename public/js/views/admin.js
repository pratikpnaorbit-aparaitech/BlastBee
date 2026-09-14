/**
 * Aparaitech Software - Admin Portal & Subscription Management View
 * Features:
 * 1. Admin Authentication Gate (Login / Logout / Session check)
 * 2. Subscription & Server Allocation Overview ("How much server you gave")
 * 3. Plan Switcher & Admin Limits Override (Manual server count allocation)
 * 4. Multi-SMTP Fleet Utilization & Server Health
 * 5. Admin Users & Credentials Management
 */
const AdminView = {
  state: {
    activeTab: 'subscription', // 'subscription', 'fleet', 'users'
    subscription: null,
    plans: [],
    fleet: [],
    users: [],
    currentUser: null,
    isAuthenticated: false,
    isLoading: true
  },

  async render(container) {
    container.innerHTML = `
      <div class="view-loading">
        <div class="spinner"></div>
        <p>Loading Admin Console &amp; Subscription Engine...</p>
      </div>
    `;

    try {
      // Check auth status
      await this.checkAuth();

      if (!this.state.isAuthenticated) {
        this.renderLoginGate(container);
        return;
      }

      // Load admin data
      await this.loadData();
      this.renderPortal(container);
    } catch (err) {
      console.error('Admin view render error:', err);
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <h3>Failed to load Admin Portal</h3>
          <p>${err.message || 'Unknown error occurred.'}</p>
          <button class="btn btn-primary btn-sm" onclick="app.navigate('admin')">Retry</button>
        </div>
      `;
    }
  },

  async checkAuth() {
    try {
      const res = await api.getMe();
      if (res.authenticated && res.user) {
        this.state.isAuthenticated = true;
        this.state.currentUser = res.user;
        app.currentUser = res.user;
        app.updateHeaderAuthUI();
      } else {
        this.state.isAuthenticated = false;
        this.state.currentUser = null;
        app.currentUser = null;
        app.updateHeaderAuthUI();
      }
    } catch (e) {
      this.state.isAuthenticated = false;
      this.state.currentUser = null;
    }
  },

  async loadData() {
    this.state.isLoading = true;
    try {
      const [subRes, plansRes, fleetRes, usersRes] = await Promise.all([
        api.getSubscription(),
        api.getSubscriptionPlans(),
        api.getServerFleet(),
        api.getAdminUsers().catch(() => ({ users: [] }))
      ]);

      this.state.subscription = subRes.subscription;
      this.state.plans = plansRes.plans || [];
      this.state.fleet = fleetRes.fleet || [];
      this.state.users = usersRes.users || [];
    } catch (err) {
      console.error('Error loading admin portal data:', err);
      app.showToast(err.message, 'error');
    } finally {
      this.state.isLoading = false;
    }
  },

  renderLoginGate(container) {
    container.innerHTML = `
      <div style="max-width: 480px; margin: 40px auto; padding: 20px;">
        <div class="card" style="box-shadow: var(--shadow-xl); border: 1px solid var(--border-light); border-radius: var(--radius-lg); overflow: hidden;">
          <div style="background: linear-gradient(135deg, #0b1329 0%, #1e3a8a 100%); padding: 32px 24px; text-align: center; color: #fff;">
            <div style="width: 56px; height: 56px; margin: 0 auto 16px; background: rgba(255,255,255,0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; border: 1px solid rgba(255,255,255,0.2);">
              🔐
            </div>
            <h2 style="font-size: 1.4rem; font-weight: 700; margin-bottom: 6px; color: #fff;">Admin Authentication</h2>
            <p style="font-size: 0.85rem; color: #93c5fd; line-height: 1.4;">
              Access Aparaitech Admin Console, Subscription Management, and Server Quotas
            </p>
          </div>

          <div style="padding: 28px;">
            <form id="adminLoginForm" onsubmit="AdminView.handleLogin(event)">
              <div class="form-group" style="margin-bottom: 16px;">
                <label class="form-label" style="font-weight: 600; font-size: 0.82rem;">Email or Username</label>
                <div class="input-with-icon">
                  <input type="text" id="loginIdentifier" class="form-input" placeholder="admin@aparaitech.org" required value="admin@aparaitech.org" />
                </div>
              </div>

              <div class="form-group" style="margin-bottom: 20px;">
                <label class="form-label" style="font-weight: 600; font-size: 0.82rem;">Password</label>
                <input type="password" id="loginPassword" class="form-input" placeholder="••••••••" required value="admin123" />
              </div>

              <button type="submit" class="btn btn-primary" id="btnLoginSubmit" style="width: 100%; justify-content: center; padding: 10px; font-weight: 600;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                <span>Log In to Admin Console</span>
              </button>
            </form>

            <div style="margin-top: 20px; padding: 12px 14px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: var(--radius-sm); font-size: 0.78rem; color: #0369a1;">
              <div style="font-weight: 700; margin-bottom: 4px;">👑 Default Admin Credentials:</div>
              <div>Email: <code>admin@aparaitech.org</code></div>
              <div>Password: <code>admin123</code></div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('btnLoginSubmit');
    const email = document.getElementById('loginIdentifier').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!email || !password) {
      app.showToast('Please enter both identifier and password', 'warning');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<div class="spinner spinner-sm"></div> Authenticating...';
    }

    try {
      const res = await api.login({ email, password });
      if (res.token) {
        localStorage.setItem('aparaitech_auth_token', res.token);
        this.state.isAuthenticated = true;
        this.state.currentUser = res.user;
        app.currentUser = res.user;
        app.updateHeaderAuthUI();
        app.showToast(res.message || 'Login successful!', 'success');
        this.render(document.getElementById('viewContainer'));
      }
    } catch (err) {
      app.showToast(err.message || 'Authentication failed', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>Log In to Admin Console</span>';
      }
    }
  },

  async handleLogout() {
    try {
      await api.logout();
    } catch (e) {
      // ignore
    }
    localStorage.removeItem('aparaitech_auth_token');
    this.state.isAuthenticated = false;
    this.state.currentUser = null;
    app.currentUser = null;
    app.updateHeaderAuthUI();
    app.showToast('You have been logged out.', 'info');
    app.navigate('dashboard');
  },

  renderPortal(container) {
    const sub = this.state.subscription;
    const user = this.state.currentUser || {};
    const serverAlloc = sub ? sub.serverAllocation : { max_servers_given: 10, active_servers: 8, utilization_pct: 80 };
    const emailQuota = sub ? sub.emailQuota : { max_monthly: 200000, sent_this_cycle: 0, utilization_pct: 0 };

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <div style="display: flex; align-items: center; gap: 10px;">
            <h1>Admin Console &amp; Subscription Management</h1>
            <span class="badge badge-primary" style="font-size: 0.75rem; text-transform: uppercase;">
              ${sub.plan_name}
            </span>
          </div>
          <p>Configure subscription plans, track server allocations ("how much servers you gave"), and manage administrators</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-outline btn-sm" onclick="AdminView.openEditLimitsModal()" title="Manually adjust how much servers and emails are granted">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            <span>Custom Server &amp; Quota Override</span>
          </button>
          <button class="btn btn-secondary btn-sm" onclick="AdminView.handleLogout()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            <span>Log Out</span>
          </button>
        </div>
      </div>

      <!-- KPI Overview Row -->
      <div class="stats-grid" style="margin-bottom: 24px;">
        <!-- Server Allocation Card (How much server you gave) -->
        <div class="stat-card" style="border-top: 4px solid #2563eb;">
          <div class="stat-header">
            <span class="stat-title">Servers Given (Server Quota)</span>
            <div class="stat-icon" style="background: rgba(37,99,235,0.1); color: #2563eb;">🖥️</div>
          </div>
          <div class="stat-value" style="display: flex; align-items: baseline; gap: 8px;">
            <span>${serverAlloc.active_servers}</span>
            <span style="font-size: 1rem; color: var(--text-muted); font-weight: 500;">/ ${serverAlloc.max_servers_given} Granted</span>
          </div>
          <div style="margin-top: 8px;">
            <div class="progress-bar-container" style="height: 6px; background: #e2e8f0; border-radius: 99px; overflow: hidden;">
              <div style="height: 100%; width: ${serverAlloc.utilization_pct}%; background: ${serverAlloc.utilization_pct >= 100 ? '#ef4444' : '#2563eb'}; transition: width 0.4s;"></div>
            </div>
          </div>
          <div class="stat-footer" style="margin-top: 6px; font-size: 0.76rem; color: var(--text-muted); display: flex; justify-content: space-between;">
            <span>${serverAlloc.remaining_servers} slot${serverAlloc.remaining_servers === 1 ? '' : 's'} available</span>
            <span style="font-weight: 600; color: ${serverAlloc.utilization_pct >= 100 ? '#dc2626' : '#2563eb'};">${serverAlloc.utilization_pct}% capacity</span>
          </div>
        </div>

        <!-- Monthly Email Volume Card -->
        <div class="stat-card" style="border-top: 4px solid #059669;">
          <div class="stat-header">
            <span class="stat-title">Monthly Email Quota</span>
            <div class="stat-icon" style="background: rgba(5,150,105,0.1); color: #059669;">✉️</div>
          </div>
          <div class="stat-value" style="display: flex; align-items: baseline; gap: 8px;">
            <span>${emailQuota.sent_this_cycle.toLocaleString()}</span>
            <span style="font-size: 1rem; color: var(--text-muted); font-weight: 500;">/ ${emailQuota.max_monthly.toLocaleString()}</span>
          </div>
          <div style="margin-top: 8px;">
            <div class="progress-bar-container" style="height: 6px; background: #e2e8f0; border-radius: 99px; overflow: hidden;">
              <div style="height: 100%; width: ${emailQuota.utilization_pct}%; background: #059669;"></div>
            </div>
          </div>
          <div class="stat-footer" style="margin-top: 6px; font-size: 0.76rem; color: var(--text-muted); display: flex; justify-content: space-between;">
            <span>${emailQuota.remaining.toLocaleString()} remaining</span>
            <span>Billing: ${sub.billing_cycle || 'Monthly'}</span>
          </div>
        </div>

        <!-- Active Plan Card -->
        <div class="stat-card" style="border-top: 4px solid #7c3aed;">
          <div class="stat-header">
            <span class="stat-title">Subscription Tier</span>
            <div class="stat-icon" style="background: rgba(124,58,237,0.1); color: #7c3aed;">👑</div>
          </div>
          <div class="stat-value" style="font-size: 1.3rem;">
            ${sub.plan_name}
          </div>
          <div class="stat-footer" style="margin-top: 8px; font-size: 0.76rem; color: var(--text-muted);">
            <div>Status: <span class="badge badge-success" style="font-size: 0.7rem;">${sub.status.toUpperCase()}</span></div>
            <div style="margin-top: 4px;">Renewal: ${new Date(sub.expires_at || Date.now()).toLocaleDateString()}</div>
          </div>
        </div>

        <!-- Admin Users Card -->
        <div class="stat-card" style="border-top: 4px solid #f59e0b;">
          <div class="stat-header">
            <span class="stat-title">Admin &amp; Staff</span>
            <div class="stat-icon" style="background: rgba(245,158,11,0.1); color: #f59e0b;">👥</div>
          </div>
          <div class="stat-value">
            ${this.state.users.length || 1}
          </div>
          <div class="stat-footer" style="margin-top: 8px; font-size: 0.76rem; color: var(--text-muted);">
            <div>Logged in as: <strong>${user.full_name || user.username || 'Admin'}</strong></div>
            <div style="margin-top: 4px;">Role: <span class="badge badge-info" style="font-size: 0.7rem;">${(user.role || 'superadmin').toUpperCase()}</span></div>
          </div>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="tabs-nav" style="display: flex; gap: 8px; border-bottom: 2px solid var(--border-light); margin-bottom: 24px;">
        <button class="tab-btn ${this.state.activeTab === 'subscription' ? 'active' : ''}" onclick="AdminView.switchTab('subscription')">
          <span style="font-size: 1.1rem;">💎</span>
          <span>Subscription &amp; Server Quotas</span>
        </button>
        <button class="tab-btn ${this.state.activeTab === 'fleet' ? 'active' : ''}" onclick="AdminView.switchTab('fleet')">
          <span style="font-size: 1.1rem;">🖥️</span>
          <span>SMTP Fleet ("How Much Server You Gave")</span>
          <span class="badge badge-secondary" style="margin-left: 6px; font-size: 0.7rem;">${serverAlloc.active_servers}/${serverAlloc.max_servers_given}</span>
        </button>
        <button class="tab-btn ${this.state.activeTab === 'users' ? 'active' : ''}" onclick="AdminView.switchTab('users')">
          <span style="font-size: 1.1rem;">👥</span>
          <span>Admin Users &amp; Roles</span>
        </button>
      </div>

      <!-- Tab Content Area -->
      <div id="adminTabContent">
        ${this.renderTabContent()}
      </div>
    `;
  },

  switchTab(tabName) {
    this.state.activeTab = tabName;
    document.querySelectorAll('.tabs-nav .tab-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.querySelector(`.tabs-nav .tab-btn[onclick*="${tabName}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    const contentArea = document.getElementById('adminTabContent');
    if (contentArea) {
      contentArea.innerHTML = this.renderTabContent();
    }
  },

  renderTabContent() {
    switch (this.state.activeTab) {
      case 'subscription':
        return this.renderSubscriptionTab();
      case 'fleet':
        return this.renderFleetTab();
      case 'users':
        return this.renderUsersTab();
      default:
        return this.renderSubscriptionTab();
    }
  },

  renderSubscriptionTab() {
    const sub = this.state.subscription;
    const plans = this.state.plans;
    const serverAlloc = sub.serverAllocation;

    return `
      <!-- Server Allocation Capacity Banner -->
      <div class="card" style="margin-bottom: 24px; background: linear-gradient(135deg, #0b1329 0%, #1e293b 100%); color: #fff; border: 1px solid rgba(255,255,255,0.1);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <span style="font-size: 1.4rem;">⚡</span>
              <h3 style="color: #fff; font-size: 1.25rem; font-weight: 700; margin: 0;">Multi-SMTP Server Allocation Quota</h3>
              <span class="badge badge-primary" style="font-size: 0.72rem;">HOW MUCH SERVER YOU GAVE</span>
            </div>
            <p style="font-size: 0.84rem; color: #94a3b8; max-width: 600px; line-height: 1.4;">
              Your active subscription ("${sub.plan_name}") provides an allocation of 
              <strong style="color: #38bdf8;">${serverAlloc.max_servers_given} dedicated SMTP Servers</strong>.
              Currently, <strong style="color: #4ade80;">${serverAlloc.active_servers} servers are actively delivering</strong> candidate emails.
            </p>
          </div>
          <div style="display: flex; gap: 10px;">
            <button class="btn btn-primary btn-sm" onclick="AdminView.openEditLimitsModal()" style="background: #2563eb; border-color: #3b82f6;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              <span>Edit Servers Given (Quota Override)</span>
            </button>
          </div>
        </div>

        <!-- Visual Server Slots Meter -->
        <div style="margin-top: 20px; background: rgba(255,255,255,0.05); padding: 16px; border-radius: var(--radius-md); border: 1px solid rgba(255,255,255,0.1);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 0.8rem;">
            <span>Server Slot Allocation: <strong>${serverAlloc.active_servers} / ${serverAlloc.max_servers_given} Slots Used</strong></span>
            <span style="color: ${serverAlloc.utilization_pct >= 100 ? '#f87171' : '#38bdf8'}; font-weight: 700;">${serverAlloc.utilization_pct}% Capacity Allocated</span>
          </div>

          <!-- Individual Slot Pills -->
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            ${Array.from({ length: serverAlloc.max_servers_given }).map((_, i) => {
              const isActive = i < serverAlloc.active_servers;
              return `
                <div style="flex: 1; min-width: 45px; height: 32px; border-radius: 6px; background: ${isActive ? '#2563eb' : 'rgba(255,255,255,0.1)'}; border: 1px solid ${isActive ? '#60a5fa' : 'rgba(255,255,255,0.2)'}; display: flex; align-items: center; justify-content: center; font-size: 0.72rem; font-weight: 600; color: #fff;" title="${isActive ? `Server #${i+1}: Active & Delivering` : `Server #${i+1}: Open Slot`}">
                  ${isActive ? `S${i+1} ✓` : `Slot ${i+1}`}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Subscription Tiers & Plans Grid -->
      <div style="margin-bottom: 24px;">
        <div style="margin-bottom: 16px;">
          <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">Available Subscription License Tiers</h3>
          <p style="font-size: 0.82rem; color: var(--text-muted);">Compare plan server allocations, email blast volume, and click to switch or upgrade your plan</p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
          ${plans.map(p => {
            const isCurrent = p.id === sub.plan_id;
            return `
              <div class="card plan-card ${isCurrent ? 'current-plan-card' : ''}" style="position: relative; border-radius: var(--radius-lg); ${isCurrent ? 'border: 2px solid var(--brand-sapphire); box-shadow: var(--shadow-md);' : ''}">
                ${p.is_popular ? `
                  <div style="position: absolute; top: -10px; right: 20px; background: var(--brand-sapphire); color: #fff; font-size: 0.68rem; font-weight: 700; padding: 2px 10px; border-radius: 99px; text-transform: uppercase; letter-spacing: 0.5px;">
                    Most Popular
                  </div>
                ` : ''}

                ${isCurrent ? `
                  <div style="position: absolute; top: -10px; left: 20px; background: #059669; color: #fff; font-size: 0.68rem; font-weight: 700; padding: 2px 10px; border-radius: 99px; text-transform: uppercase; letter-spacing: 0.5px;">
                    Active License
                  </div>
                ` : ''}

                <div style="padding-top: ${isCurrent || p.is_popular ? '8px' : '0'};">
                  <h4 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 4px;">${p.name}</h4>
                  <p style="font-size: 0.78rem; color: var(--text-muted); min-height: 36px; margin-bottom: 16px;">${p.description}</p>

                  <div style="display: flex; align-items: baseline; gap: 4px; margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid var(--border-light);">
                    <span style="font-size: 1.8rem; font-weight: 800; color: var(--text-primary);">₹${Number(p.price).toLocaleString('en-IN')}</span>
                    <span style="font-size: 0.8rem; color: var(--text-muted);">/ ${p.billing_interval || 'month'}</span>
                  </div>

                  <!-- Server Quota Highlight (How much server you gave) -->
                  <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: var(--radius-sm); padding: 10px 12px; margin-bottom: 16px;">
                    <div style="font-size: 0.72rem; text-transform: uppercase; color: #0284c7; font-weight: 700; margin-bottom: 2px;">Servers Given:</div>
                    <div style="font-size: 1.05rem; font-weight: 700; color: #0369a1;">
                      🖥️ ${p.max_servers} SMTP Server${p.max_servers === 1 ? '' : 's'} Granted
                    </div>
                  </div>

                  <!-- Feature List -->
                  <ul style="list-style: none; padding: 0; margin: 0 0 20px 0; font-size: 0.82rem; line-height: 1.8;">
                    ${(p.features || []).map(f => `
                      <li style="display: flex; align-items: center; gap: 8px;">
                        <span style="color: #059669; font-weight: 700;">✓</span>
                        <span>${f}</span>
                      </li>
                    `).join('')}
                  </ul>

                  <!-- Action Button -->
                  ${isCurrent ? `
                    <button class="btn btn-secondary btn-sm" disabled style="width: 100%; justify-content: center; background: #ecfdf5; color: #059669; border-color: #a7f3d0; cursor: default;">
                      <span>✓ Currently Active Tier</span>
                    </button>
                  ` : `
                    <button class="btn btn-primary btn-sm" onclick="AdminView.upgradeToPlan('${p.id}')" style="width: 100%; justify-content: center;">
                      <span>Switch to ${p.name.split(' ')[0]}</span>
                    </button>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  renderFleetTab() {
    const fleet = this.state.fleet;
    const sub = this.state.subscription;
    const serverAlloc = sub.serverAllocation;

    return `
      <div class="card" style="margin-bottom: 20px;">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div>
            <h3 class="card-title">Configured SMTP Servers Fleet (${fleet.length} Senders)</h3>
            <p style="font-size: 0.82rem; color: var(--text-muted); margin-top: 2px;">
              Server quota given by your subscription: <strong>${serverAlloc.max_servers_given} Active Servers</strong> 
              (${serverAlloc.active_servers} active, ${serverAlloc.remaining_servers} available)
            </p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary btn-sm" onclick="app.navigate('settings')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
              <span>Manage in Settings</span>
            </button>
            <button class="btn btn-primary btn-sm" onclick="AdminView.openEditLimitsModal()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>+ Increase Server Quota</span>
            </button>
          </div>
        </div>

        <!-- Fleet Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; margin-top: 16px;">
          ${fleet.map(acc => {
            const isAllocated = acc.allocationStatus === 'allocated';
            const isExceeding = acc.allocationStatus === 'exceeds_quota';
            return `
              <div class="card" style="padding: 16px; border: 1px solid ${isAllocated ? 'var(--border-light)' : (isExceeding ? '#fecaca' : '#e2e8f0')}; background: ${isExceeding ? '#fff5f5' : '#fff'}; border-radius: var(--radius-md);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                  <div>
                    <h4 style="font-size: 0.95rem; font-weight: 700; margin: 0; color: var(--text-primary);">${acc.name}</h4>
                    <span style="font-size: 0.78rem; color: var(--text-muted); font-family: var(--font-mono);">${acc.user}</span>
                  </div>
                  ${isAllocated ? `
                    <span class="badge badge-success" style="font-size: 0.7rem;">Active (Allocated)</span>
                  ` : (isExceeding ? `
                    <span class="badge badge-danger" style="font-size: 0.7rem;">Exceeds Quota</span>
                  ` : `
                    <span class="badge badge-secondary" style="font-size: 0.7rem;">Disabled</span>
                  `)}
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.78rem; margin: 12px 0; padding: 10px; background: #f8fafc; border-radius: 6px;">
                  <div>
                    <span style="color: var(--text-muted);">Host &amp; Port:</span>
                    <div style="font-weight: 600;">${acc.host}:${acc.port}</div>
                  </div>
                  <div>
                    <span style="color: var(--text-muted);">Sent Today:</span>
                    <div style="font-weight: 600;">${acc.sent_today} / ${acc.daily_limit}</div>
                  </div>
                  <div>
                    <span style="color: var(--text-muted);">Priority:</span>
                    <div style="font-weight: 600;">#${acc.priority}</div>
                  </div>
                  <div>
                    <span style="color: var(--text-muted);">Capacity Left:</span>
                    <div style="font-weight: 600; color: #059669;">${acc.remainingDaily} emails</div>
                  </div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                  <button class="btn btn-outline btn-xs" onclick="SettingsView.testAccount(${acc.id})" style="font-size: 0.72rem;">
                    <span>⚡ Test Ping</span>
                  </button>
                  <button class="btn ${acc.is_active === 1 ? 'btn-secondary' : 'btn-primary'} btn-xs" onclick="SettingsView.toggleAccountStatus(${acc.id})" style="font-size: 0.72rem;">
                    <span>${acc.is_active === 1 ? 'Disable' : 'Enable'}</span>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  renderUsersTab() {
    const users = this.state.users;
    const currentUser = this.state.currentUser || {};

    return `
      <div class="card">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div>
            <h3 class="card-title">Admin &amp; Recruiter Team Accounts (${users.length})</h3>
            <p style="font-size: 0.82rem; color: var(--text-muted); margin-top: 2px;">
              Manage administrator access credentials, security tokens, and permission roles
            </p>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-primary btn-sm" onclick="AdminView.openCreateUserModal()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              <span>+ Add Admin Account</span>
            </button>
          </div>
        </div>

        <div class="table-container" style="margin-top: 16px;">
          <table class="table" style="width: 100%;">
            <thead>
              <tr>
                <th>User / Admin</th>
                <th>Email</th>
                <th>Role</th>
                <th>Login Status</th>
                <th>Created</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${users.map(u => `
                <tr>
                  <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                      <div style="width: 34px; height: 34px; border-radius: 50%; background: #e0f2fe; display: flex; align-items: center; justify-content: center; font-size: 1.1rem;">
                        ${u.avatar || '👨‍💼'}
                      </div>
                      <div>
                        <div style="font-weight: 600; color: var(--text-primary);">${u.full_name || u.username}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">@${u.username}</div>
                      </div>
                    </div>
                  </td>
                  <td><code>${u.email}</code></td>
                  <td>
                    <span class="badge ${u.role === 'superadmin' ? 'badge-primary' : (u.role === 'admin' ? 'badge-info' : 'badge-secondary')}">
                      ${u.role.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    ${u.is_online ? `
                      <span class="badge badge-success" style="font-size:0.7rem;">Online Now</span>
                    ` : u.has_logged_in ? `
                      <span style="font-size:0.75rem; color:#059669; font-weight:700;">🟢 Logged In</span>
                    ` : `
                      <span style="font-size:0.72rem; color:#94a3b8;">⚪ Never</span>
                    `}
                  </td>
                  <td style="font-size: 0.8rem; color: var(--text-muted);">
                    ${new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td style="text-align: right;">
                    <button class="btn btn-outline btn-xs" onclick="AdminView.openChangePasswordModal(${u.id}, '${u.username}')">
                      <span>Reset Password</span>
                    </button>
                    ${u.id !== this.state.currentUser.id ? `
                      <button class="btn btn-xs" style="background: #fee2e2; color: #b91c1c; border-color: #fca5a5; margin-left: 6px;" onclick="AdminView.deleteUser(${u.id}, '${u.username}')">
                        <span>🗑️ Delete</span>
                      </button>
                    ` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async deleteUser(userId, username) {
    if (!confirm(`Are you sure you want to delete user "${username}"? All their data will be purged.`)) return;
    try {
      const res = await api.deleteUser(userId);
      app.showToast(res.message || 'User deleted successfully', 'success');
      await this.loadData();
      this.renderPortal(document.getElementById('viewContainer'));
    } catch (err) {
      app.showToast(err.message, 'error');
    }
  },

  // Switch / Upgrade subscription plan
  async upgradeToPlan(planId) {
    if (!confirm(`Are you sure you want to switch your subscription license to this tier?`)) {
      return;
    }

    try {
      const res = await api.upgradeSubscription(planId);
      app.showToast(res.message, 'success');
      await this.loadData();
      this.renderPortal(document.getElementById('viewContainer'));
    } catch (err) {
      app.showToast(err.message, 'error');
    }
  },

  // Modal: Manually edit "how much servers you gave" (Admin Quota Override)
  openEditLimitsModal() {
    const sub = this.state.subscription;
    const serverAlloc = sub ? sub.serverAllocation : {};

    const content = `
      <div class="modal-header">
        <h3 class="modal-title">🖥️ Custom Server &amp; Quota Override</h3>
        <button class="modal-close" onclick="app.closeModal()">&times;</button>
      </div>
      <div class="modal-body">
        <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 16px;">
          As an Administrator, you can explicitly configure <strong>how much SMTP servers are given</strong> 
          and set custom monthly email thresholds for your recruitment platform.
        </p>

        <form id="editLimitsForm" onsubmit="AdminView.handleSaveLimits(event)">
          <div class="form-group" style="margin-bottom: 14px;">
            <label class="form-label" style="font-weight: 700; color: #2563eb;">
              How Much SMTP Servers Given (Server Quota):
            </label>
            <input type="number" id="limitMaxServers" class="form-input" min="1" max="100" value="${serverAlloc.max_servers_given || 10}" required />
            <p style="font-size: 0.72rem; color: var(--text-muted); margin-top: 3px;">
              Total number of simultaneous active SMTP senders allowed in the Multi-SMTP pool.
            </p>
          </div>

          <div class="form-group" style="margin-bottom: 14px;">
            <label class="form-label" style="font-weight: 600;">
              Monthly Email Blast Volume Quota:
            </label>
            <input type="number" id="limitMaxEmails" class="form-input" min="500" step="500" value="${sub.emailQuota.max_monthly || 200000}" required />
          </div>

          <div class="form-group" style="margin-bottom: 14px;">
            <label class="form-label" style="font-weight: 600;">
              Maximum Candidate Contacts:
            </label>
            <input type="number" id="limitMaxContacts" class="form-input" min="100" step="1000" value="${sub.contactQuota.max_contacts || 100000}" required />
          </div>

          <div class="form-group" style="margin-bottom: 18px;">
            <label class="form-label" style="font-weight: 600;">Subscription License Status:</label>
            <select id="limitStatus" class="form-select">
              <option value="active" ${sub.status === 'active' ? 'selected' : ''}>Active (Operational)</option>
              <option value="trial" ${sub.status === 'trial' ? 'selected' : ''}>Trial Mode</option>
              <option value="expired" ${sub.status === 'expired' ? 'selected' : ''}>Expired (Locked)</option>
            </select>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btnSaveLimits">Save Server Quota</button>
          </div>
        </form>
      </div>
    `;

    app.openModal(content);
  },

  async handleSaveLimits(e) {
    e.preventDefault();
    const btn = document.getElementById('btnSaveLimits');
    const max_servers = parseInt(document.getElementById('limitMaxServers').value, 10);
    const max_emails_per_month = parseInt(document.getElementById('limitMaxEmails').value, 10);
    const max_contacts = parseInt(document.getElementById('limitMaxContacts').value, 10);
    const status = document.getElementById('limitStatus').value;

    if (btn) btn.disabled = true;

    try {
      const res = await api.updateSubscriptionLimits({
        max_servers,
        max_emails_per_month,
        max_contacts,
        status
      });

      app.closeModal();
      app.showToast(res.message, 'success');
      await this.loadData();
      this.renderPortal(document.getElementById('viewContainer'));
    } catch (err) {
      app.showToast(err.message, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  // Modal: Create new admin account
  openCreateUserModal() {
    const content = `
      <div class="modal-header">
        <h3 class="modal-title">👥 Create Admin Account</h3>
        <button class="modal-close" onclick="app.closeModal()">&times;</button>
      </div>
      <div class="modal-body">
        <form id="createUserForm" onsubmit="AdminView.handleCreateUser(event)">
          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label">Full Name</label>
            <input type="text" id="newFullName" class="form-input" placeholder="e.g. Rahul Sharma" required />
          </div>

          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label">Email Address</label>
            <input type="email" id="newEmail" class="form-input" placeholder="rahul@aparaitech.org" required />
          </div>

          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label">Username</label>
            <input type="text" id="newUsername" class="form-input" placeholder="rahul.admin" required />
          </div>

          <div class="form-group" style="margin-bottom: 12px;">
            <label class="form-label">Temporary Password (min 6 chars)</label>
            <input type="password" id="newPassword" class="form-input" placeholder="••••••••" required />
          </div>

          <div class="form-group" style="margin-bottom: 18px;">
            <label class="form-label">Role</label>
            <select id="newRole" class="form-select">
              <option value="admin">Administrator</option>
              <option value="recruiter">Recruiter / Placement Officer</option>
              <option value="superadmin">Super Administrator</option>
            </select>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary" id="btnCreateUser">Create Account</button>
          </div>
        </form>
      </div>
    `;

    app.openModal(content);
  },

  async handleCreateUser(e) {
    e.preventDefault();
    const fullName = document.getElementById('newFullName').value.trim();
    const email = document.getElementById('newEmail').value.trim();
    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newPassword').value;
    const role = document.getElementById('newRole').value;

    try {
      const res = await api.createAdminUser({ fullName, email, username, password, role });
      app.closeModal();
      app.showToast(res.message, 'success');
      await this.loadData();
      this.renderPortal(document.getElementById('viewContainer'));
    } catch (err) {
      app.showToast(err.message, 'error');
    }
  },

  // Modal: Change user password
  openChangePasswordModal(userId, username) {
    const content = `
      <div class="modal-header">
        <h3 class="modal-title">🔑 Change Password for @${username}</h3>
        <button class="modal-close" onclick="app.closeModal()">&times;</button>
      </div>
      <div class="modal-body">
        <form id="changePasswordForm" onsubmit="AdminView.handleChangePassword(event, ${userId})">
          <div class="form-group" style="margin-bottom: 18px;">
            <label class="form-label">New Password (min 6 characters)</label>
            <input type="password" id="changeNewPassword" class="form-input" placeholder="••••••••" required />
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Update Password</button>
          </div>
        </form>
      </div>
    `;

    app.openModal(content);
  },

  async handleChangePassword(e, userId) {
    e.preventDefault();
    const newPassword = document.getElementById('changeNewPassword').value;

    try {
      const res = await api.changeUserPassword(userId, newPassword);
      app.closeModal();
      app.showToast(res.message, 'success');
    } catch (err) {
      app.showToast(err.message, 'error');
    }
  }
};
