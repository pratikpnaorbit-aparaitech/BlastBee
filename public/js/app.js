/**
 * Aparaitech Software - Single Page Application Core
 * Routing, View Management, Modals, and Notifications
 */
class App {
  constructor() {
    this.currentView = 'dashboard';
    this.viewContainer = null;
    this.views = {
      'dashboard': typeof DashboardView !== 'undefined' ? DashboardView : null,
      'students': typeof StudentsView !== 'undefined' ? StudentsView : null,
      'import': typeof ImportView !== 'undefined' ? ImportView : null,
      'composer': typeof ComposerView !== 'undefined' ? ComposerView : null,
      'templates': typeof TemplatesView !== 'undefined' ? TemplatesView : null,
      'blast-monitor': typeof BlastMonitorView !== 'undefined' ? BlastMonitorView : null,
      'history': typeof HistoryView !== 'undefined' ? HistoryView : null,
      'settings': typeof SettingsView !== 'undefined' ? SettingsView : null,
      'subscription': typeof SubscriptionView !== 'undefined' ? SubscriptionView : null,
      'demo-tour': typeof DemoTourView !== 'undefined' ? DemoTourView : null
    };
    if (typeof AdminView !== 'undefined') {
      this.views['admin'] = AdminView;
    }
    this.currentUser = null;
    this.subscription = null;
  }

  async init() {
    this.viewContainer = document.getElementById('viewContainer');

    // Handle hash change events
    window.addEventListener('hashchange', () => this.handleRoute());

    // Close modal on backdrop click or ESC key
    const modalOverlay = document.getElementById('modalContainer');
    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) this.closeModal();
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeModal();
    });

    try {
      // Check auth session
      await this.checkAuth();
    } catch (err) {
      console.warn('Auth check warning:', err);
    }

    try {
      // Refresh subscription & trial status
      await this.refreshSubscription();
    } catch (err) {
      console.warn('Subscription refresh warning:', err);
    }

    try {
      // Refresh settings / badge state
      await this.refreshEnvironmentBadge();
      await this.refreshCounters();
    } catch (err) {
      console.warn('Badge/counter warning:', err);
    }

    // Initial routing
    this.handleRoute();

    // If user arrived from landing page with a pre-selected paid plan, prompt UPI checkout
    try {
      const pendingPlan = localStorage.getItem('selected_upgrade_plan');
      if (pendingPlan && pendingPlan !== 'trial') {
        localStorage.removeItem('selected_upgrade_plan');
        setTimeout(() => {
          this.openUpiPaymentModal(pendingPlan);
        }, 600);
      }
    } catch (e) {
      // ignore
    }
  }

  async checkAuth() {
    try {
      const res = await api.getMe();
      if (res.authenticated && res.user) {
        this.currentUser = res.user;
      } else {
        this.currentUser = null;
      }
    } catch (e) {
      this.currentUser = null;
    }
    this.updateHeaderAuthUI();
  }

  updateHeaderAuthUI() {
    const profileWidget = document.getElementById('customerProfileWidget');
    if (!profileWidget) return;

    if (this.currentUser) {
      const displayName = this.currentUser.company 
        ? `${this.currentUser.company} (${this.currentUser.full_name || this.currentUser.username})` 
        : (this.currentUser.full_name || this.currentUser.username);

      const isSuperAdmin = this.currentUser.role === 'superadmin';
      const roleBadge = isSuperAdmin
        ? `<a href="/admin" class="badge badge-primary" style="text-decoration:none; margin-left: 6px; font-size: 0.7rem;" title="Go to SuperAdmin Console">🛡️ Admin Panel &rarr;</a>`
        : `<span class="badge badge-secondary" style="font-size: 0.7rem; margin-left: 6px;">Customer</span>`;

      profileWidget.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 28px; height: 28px; border-radius: 50%; background: #2563eb; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700;">
            ${(this.currentUser.full_name || this.currentUser.username || 'C')[0].toUpperCase()}
          </div>
          <span style="font-size: 0.82rem; font-weight: 600; color: #f8fafc;">${displayName}</span>
          ${roleBadge}
        </div>
        <button class="btn btn-outline btn-xs" onclick="app.logout()" style="color: #fff; border-color: rgba(255,255,255,0.25);">
          <span>Sign Out</span>
        </button>
      `;
    } else {
      profileWidget.innerHTML = `
        <a href="/" class="btn btn-outline btn-xs" style="color: #fff; border-color: rgba(255,255,255,0.25);">
          <span>Sign In / 7-Day Trial</span>
        </a>
      `;
    }
  }

  async refreshSubscription() {
    try {
      const data = await api.getSubscription();
      this.subscription = data.subscription || null;

      const banner = document.getElementById('trialBanner');
      if (!banner) return;

      if (this.subscription && this.subscription.pendingPayment) {
        banner.style.display = 'flex';
        banner.style.background = 'linear-gradient(90deg, #b45309 0%, #d97706 100%)';
        document.body.classList.add('has-trial-banner');
        const p = this.subscription.pendingPayment;
        const textEl = document.getElementById('trialBannerText');
        const btnUpgrade = document.getElementById('btnUpgradeTrial');
        if (textEl) {
          textEl.innerHTML = `<strong>⏳ UPI Payment Under Verification:</strong> ₹${Number(p.amount).toLocaleString('en-IN')} for <strong>${p.plan_name}</strong> (UTR: <code>${p.utr_number}</code>) submitted &bull; Awaiting Admin verification &amp; access release`;
        }
        if (btnUpgrade) {
          btnUpgrade.textContent = '🔍 View Pending Status';
          btnUpgrade.style.background = 'rgba(255,255,255,0.25)';
          btnUpgrade.style.color = '#ffffff';
          btnUpgrade.onclick = () => app.openPendingPaymentStatusModal();
        }
        return;
      }

      if (this.subscription && (this.subscription.status === 'trial' || this.subscription.plan_id === 'trial')) {
        banner.style.display = 'flex';
        document.body.classList.add('has-trial-banner');

        const remainingDays = this.subscription.trial_days_remaining != null ? this.subscription.trial_days_remaining : 7;
        const activeServers = (this.subscription.serverAllocation && this.subscription.serverAllocation.active_servers) || 0;
        const maxServers = (this.subscription.serverAllocation && this.subscription.serverAllocation.max_servers_given) || 1;

        const textEl = document.getElementById('trialBannerText');
        const btnUpgrade = document.getElementById('btnUpgradeTrial');

        if (this.subscription.is_trial_expired) {
          banner.style.background = 'linear-gradient(90deg, #991b1b 0%, #dc2626 100%)';
          if (textEl) {
            textEl.innerHTML = `<strong style="color: #fecaca;">⚠️ 7-Day Free Trial Expired:</strong> Your trial period has ended. Upgrade your plan to continue blasting emails.`;
          }
          if (btnUpgrade) {
            btnUpgrade.textContent = '⚡ Upgrade Plan to Resume';
            btnUpgrade.style.background = '#ffffff';
            btnUpgrade.style.color = '#dc2626';
          }
        } else {
          banner.style.background = 'linear-gradient(90deg, #1e3a8a 0%, #2563eb 100%)';
          if (textEl) {
            textEl.innerHTML = `<strong>7-Day Free Trial:</strong> <span id="trialDaysCount">${remainingDays}</span> days remaining &bull; <strong id="trialServerCount">${activeServers} of ${maxServers} SMTP Server</strong> Active`;
          }
          if (btnUpgrade) {
            btnUpgrade.textContent = '⚡ Upgrade to Pro (5 Servers)';
            btnUpgrade.style.background = '#f59e0b';
            btnUpgrade.style.color = '#000';
          }
        }
      } else if (this.subscription && this.subscription.status === 'active') {
        banner.style.display = 'flex';
        banner.style.background = 'linear-gradient(90deg, #065f46 0%, #059669 100%)';
        document.body.classList.add('has-trial-banner');

        const activeServers = (this.subscription.serverAllocation && this.subscription.serverAllocation.active_servers) || 0;
        const maxServers = (this.subscription.serverAllocation && this.subscription.serverAllocation.max_servers_given) || 5;

        const textEl = document.getElementById('trialBannerText');
        const btnUpgrade = document.getElementById('btnUpgradeTrial');
        if (textEl) {
          textEl.innerHTML = `<strong>👑 Active Subscription: ${this.subscription.plan_name}</strong> &bull; <strong>${activeServers} of ${maxServers} SMTP Servers</strong> Active (${this.subscription.serverAllocation ? this.subscription.serverAllocation.remaining_servers : 0} Available)`;
        }
        if (btnUpgrade) {
          btnUpgrade.textContent = '💎 Manage Subscription';
          btnUpgrade.style.background = 'rgba(255,255,255,0.2)';
          btnUpgrade.style.color = '#ffffff';
        }
      } else {
        banner.style.display = 'none';
        document.body.classList.remove('has-trial-banner');
      }
    } catch (err) {
      console.error('Subscription refresh error:', err);
    }
  }

  async logout() {
    try {
      await api.logout();
    } catch (e) {}
    localStorage.removeItem('aparaitech_auth_token');
    window.location.href = '/';
  }

  copyUpiId(text = '8261840199-3@ibl') {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    this.showToast(`UPI ID "${text}" copied to clipboard!`, 'success');
  }

  async openUpgradeModal() {
    let plans = [];
    try {
      const res = await api.getSubscriptionPlans();
      plans = res.plans || [];
      this.availablePlans = plans;
    } catch (e) {
      plans = [];
    }

    const currentPlanId = (this.subscription && this.subscription.plan_id) || 'trial';
    const currentStatus = (this.subscription && this.subscription.status) || 'trial';

    const modalHtml = `
      <div class="modal-header" style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); color: #fff; padding: 20px 24px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 1.5rem;">🐝</span>
          <div>
            <h3 class="modal-title" style="color: #fff; margin-bottom: 2px;">BlastBee Subscription Plans &amp; Server Allocation</h3>
            <div style="font-size: 0.78rem; color: #93c5fd;">Scale your outreach campaigns with dedicated multi-server fleets &bull; <strong>Developed by Aparaitech Software</strong> (All prices in ₹ INR)</div>
          </div>
        </div>
        <button class="modal-close" onclick="app.closeModal()" style="color: #fff; background: rgba(255,255,255,0.15);">&times;</button>
      </div>

      <div class="modal-body" style="padding: 24px; max-height: 80vh; overflow-y: auto;">
        ${currentStatus === 'trial' ? `
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 1.4rem;">⏳</span>
            <div>
              <div style="font-weight: 700; font-size: 0.88rem; color: #1e40af;">You are currently on the 7-Day Free Trial</div>
              <div style="font-size: 0.78rem; color: #3b82f6;">Enforced Quota: Exactly 1 active SMTP Server permitted. Upgrade via UPI to unlock multi-server auto-rotation!</div>
            </div>
          </div>
        ` : ''}

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 20px;">
          ${plans.map(p => {
            const isCurrent = currentPlanId === p.id;
            const isGrowth = p.id === 'growth' || p.is_popular === 1;
            const formattedPrice = Number(p.price).toLocaleString('en-IN');
            const cleanInterval = (p.billing_interval || 'month').replace(/^\/+/, '');
            const intervalDisplay = cleanInterval === '7-days' ? '7 days free' : cleanInterval;

            // Deduplicate features
            let featuresList = [];
            try {
              featuresList = Array.isArray(p.features) ? p.features : JSON.parse(p.features || '[]');
            } catch (e) {
              featuresList = [];
            }
            const dedupedFeatures = featuresList.filter(f => {
              const fl = f.toLowerCase();
              if (fl.includes('smtp server') || fl.includes('active smtp')) return false;
              if (fl.includes('emails / month') || fl.includes('emails/month')) return false;
              if (fl.includes('candidate contacts') || fl.includes('candidate pool')) return false;
              return true;
            });

            return `
              <div class="card" style="border: 2px solid ${isCurrent ? '#059669' : (isGrowth ? '#2563eb' : 'var(--border-light)')}; border-radius: 8px; padding: 18px; position: relative; display: flex; flex-direction: column; justify-content: space-between; ${isGrowth ? 'box-shadow: var(--shadow-md);' : ''}">
                <div>
                  ${isCurrent ? '<span class="badge badge-primary" style="position: absolute; top: 12px; right: 12px; background: #059669;">CURRENT PLAN</span>' : (isGrowth ? '<span class="badge" style="position: absolute; top: 12px; right: 12px; background: #2563eb; color: #fff;">RECOMMENDED</span>' : '')}
                  <h4 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 4px;">${p.name}</h4>
                  <div style="font-size: 1.6rem; font-weight: 800; color: ${isGrowth ? '#2563eb' : '#0f172a'}; margin-bottom: 12px;">
                    ₹${formattedPrice} <span style="font-size: 0.8rem; font-weight: 400; color: var(--text-muted);">/ ${intervalDisplay}</span>
                  </div>
                  
                  <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 4px; padding: 6px 10px; margin-bottom: 12px; font-size: 0.78rem; font-weight: 700; color: #1e40af;">
                    🖥️ ${p.max_servers} Dedicated SMTP Server${p.max_servers === 1 ? '' : 's'}
                  </div>

                  <ul style="list-style: none; padding: 0; margin: 0 0 16px 0; font-size: 0.8rem; line-height: 1.8;">
                    <li>✓ <strong>${p.max_servers} Active SMTP Senders Granted</strong></li>
                    <li>✓ ${Number(p.max_emails_per_month).toLocaleString()} emails / month</li>
                    <li>✓ ${Number(p.max_contacts).toLocaleString()} contact pool</li>
                    ${dedupedFeatures.map(f => `<li>✓ ${f}</li>`).join('')}
                  </ul>
                </div>

                <div>
                  ${p.id === 'trial' ? `
                    <button class="btn btn-secondary btn-sm" style="width: 100%;" disabled>
                      ${isCurrent ? 'Current Tier' : 'Trial'}
                    </button>
                  ` : `
                    <button class="btn btn-sm" onclick="app.openUpiPaymentModal('${p.id}')" style="width: 100%; justify-content: center; font-weight: 700; ${isGrowth ? 'background: #2563eb; color: #ffffff;' : 'background: #0f172a; color: #ffffff;'} border: none; padding: 9px 12px; border-radius: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.15);" ${isCurrent ? 'disabled' : ''}>
                      ${isCurrent ? '✓ Active Plan' : `⚡ Pay ₹${formattedPrice} via UPI &rarr;`}
                    </button>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; font-size: 0.78rem; color: var(--text-muted); border-top: 1px solid var(--border-light); padding-top: 14px;">
          <span>Need help or custom onboarding? WhatsApp: <a href="https://wa.me/919158852129?text=Hi%20Aparaitech%20Software,%20I%20need%20help%20with%20BlastBee%20Subscription" target="_blank" style="color: #16a34a; font-weight: 700;">💬 +91 9158852129</a></span>
          <span>Contact <a href="mailto:support@aparaitech.org" style="color: #2563eb; font-weight: 600;">support@aparaitech.org</a></span>
        </div>
      </div>
    `;

    this.openModal(modalHtml, '1180px');
  }

  handleScreenshotSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      this.selectedScreenshotBase64 = e.target.result;
      const previewImg = document.getElementById('screenshotPreviewImg');
      const previewContainer = document.getElementById('screenshotPreviewContainer');
      const promptEl = document.getElementById('screenshotPrompt');
      const nameEl = document.getElementById('screenshotFileName');

      if (previewImg) previewImg.src = e.target.result;
      if (previewContainer) previewContainer.style.display = 'flex';
      if (promptEl) promptEl.style.display = 'none';
      if (nameEl) nameEl.textContent = file.name;
    };
    reader.readAsDataURL(file);
  }

  removeScreenshotSelected() {
    this.selectedScreenshotBase64 = null;
    const fileInput = document.getElementById('upiScreenshotFile');
    if (fileInput) fileInput.value = '';
    const previewContainer = document.getElementById('screenshotPreviewContainer');
    const promptEl = document.getElementById('screenshotPrompt');
    if (previewContainer) previewContainer.style.display = 'none';
    if (promptEl) promptEl.style.display = 'block';
  }

  async openUpiPaymentModal(planId) {
    this.selectedScreenshotBase64 = null;
    let plans = this.availablePlans || [];
    if (plans.length === 0) {
      try {
        const res = await api.getSubscriptionPlans();
        plans = res.plans || [];
        this.availablePlans = plans;
      } catch (e) {
        plans = [];
      }
    }

    const plan = plans.find(p => p.id === planId) || {
      id: planId,
      name: planId === 'growth' ? 'Pro Growth Placement Tier' : (planId === 'enterprise' ? 'Enterprise Scale License' : 'Starter Recruiter Tier'),
      price: planId === 'growth' ? 3499 : (planId === 'enterprise' ? 8999 : 1499),
      max_servers: planId === 'growth' ? 5 : (planId === 'enterprise' ? 10 : 2)
    };

    const upiId = '8261840199-3@ibl';
    const payeeName = 'Aparaitech Software';
    const amount = Number(plan.price);
    const upiUri = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(plan.name + ' Plan Upgrade')}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(upiUri)}`;

    const modalHtml = `
      <div class="modal-header" style="background: linear-gradient(135deg, #065f46 0%, #047857 100%); color: #fff; padding: 18px 24px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 1.5rem;">🇮🇳</span>
          <div>
            <h3 class="modal-title" style="color: #fff; margin-bottom: 2px;">Direct UPI Payment Gateway</h3>
            <div style="font-size: 0.78rem; color: #a7f3d0;">Verified Indian UPI &bull; Admin Verification &bull; Zero Transaction Fees</div>
          </div>
        </div>
        <button class="modal-close" onclick="app.closeModal()" style="color: #fff; background: rgba(255,255,255,0.15);">&times;</button>
      </div>

      <div class="modal-body" style="padding: 24px; max-height: 80vh; overflow-y: auto;">
        <!-- Top Summary Bar -->
        <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div>
            <div style="font-size: 0.75rem; text-transform: uppercase; color: #166534; font-weight: 700; letter-spacing: 0.5px;">Selected Plan</div>
            <div style="font-size: 1.1rem; font-weight: 800; color: #0f172a;">${plan.name}</div>
            <div style="font-size: 0.8rem; color: #047857; font-weight: 600;">🖥️ Unlocks ${plan.max_servers} Dedicated SMTP Senders</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.75rem; text-transform: uppercase; color: #166534; font-weight: 700;">Total Payable</div>
            <div style="font-size: 1.8rem; font-weight: 900; color: #059669;">₹${amount.toLocaleString('en-IN')}</div>
          </div>
        </div>

        <!-- 2-Column UPI Payment Section -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; align-items: start; margin-bottom: 24px;">
          <!-- QR Code Column -->
          <div style="text-align: center; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.04);">
            <div style="font-size: 0.85rem; font-weight: 700; color: #1e293b; margin-bottom: 12px;">
              Scan QR with Any UPI App
            </div>
            
            <div style="display: inline-block; padding: 8px; background: #ffffff; border: 2px solid #059669; border-radius: 12px; margin-bottom: 12px;">
              <img src="${qrUrl}" alt="Scan UPI QR Code" style="width: 180px; height: 180px; display: block;" onerror="this.src='https://chart.googleapis.com/chart?cht=qr&chs=180x180&chl=' + encodeURIComponent('${upiUri}')" />
            </div>

            <div style="display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px;">
              <span style="font-size: 0.72rem; background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-weight: 600; color: #475569;">GPay</span>
              <span style="font-size: 0.72rem; background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-weight: 600; color: #475569;">PhonePe</span>
              <span style="font-size: 0.72rem; background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-weight: 600; color: #475569;">Paytm</span>
              <span style="font-size: 0.72rem; background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-weight: 600; color: #475569;">BHIM</span>
              <span style="font-size: 0.72rem; background: #f1f5f9; padding: 2px 8px; border-radius: 4px; font-weight: 600; color: #475569;">CRED</span>
            </div>

            <a href="${upiUri}" class="btn btn-sm" style="display: block; width: 100%; background: #059669; color: #ffffff; text-decoration: none; font-weight: 700; border-radius: 6px; padding: 8px 12px; margin-top: 8px;">
              📱 Open in UPI App Directly &rarr;
            </a>
          </div>

          <!-- UPI ID & Verification Column -->
          <div>
            <!-- Official UPI ID Box -->
            <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
              <label style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: #475569; display: block; margin-bottom: 6px;">
                Official Merchant UPI ID:
              </label>
              
              <div style="display: flex; gap: 8px; align-items: center;">
                <input type="text" readonly value="${upiId}" 
                  id="targetUpiInput"
                  style="flex: 1; font-family: monospace; font-size: 1rem; font-weight: 700; color: #0f172a; padding: 8px 12px; border: 1px solid #94a3b8; border-radius: 6px; background: #ffffff;" />
                <button type="button" class="btn btn-secondary btn-sm" onclick="app.copyUpiId('${upiId}')" style="white-space: nowrap; font-weight: 700; background: #ffffff;">
                  📋 Copy
                </button>
              </div>

              <div style="font-size: 0.74rem; color: #64748b; margin-top: 6px;">
                Payee Name: <strong>${payeeName}</strong>
              </div>
            </div>

            <!-- Activation / UTR & Screenshot Form -->
            <div style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 18px;">
              <h4 style="font-size: 0.95rem; font-weight: 700; color: #0f172a; margin-bottom: 4px;">
                Step 2: Upload Proof &amp; Submit
              </h4>
              <p style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 12px;">
                Enter your 12-digit UTR and upload a payment receipt screenshot for Admin approval:
              </p>

              <div style="margin-bottom: 12px;">
                <label style="font-size: 0.74rem; font-weight: 700; color: #334155; display: block; margin-bottom: 4px;">
                  UPI Transaction ID / UTR Number: <span style="color:#dc2626;">*</span>
                </label>
                <input type="text" id="upiUtrNumber" placeholder="e.g. 423981298412 or Ref No." 
                  style="width: 100%; padding: 10px 14px; font-size: 0.95rem; border: 1.5px solid #2563eb; border-radius: 6px; font-weight: 600; letter-spacing: 0.5px;" />
              </div>

              <!-- Payment Screenshot Proof Drop Area -->
              <div style="margin-bottom: 16px;">
                <label style="font-size: 0.74rem; font-weight: 700; color: #334155; display: block; margin-bottom: 4px;">
                  Payment Screenshot Proof: <span style="color:#dc2626;">*</span>
                </label>
                <div id="screenshotDropArea" style="border: 2px dashed #94a3b8; border-radius: 8px; padding: 14px; text-align: center; background: #f8fafc; cursor: pointer;"
                  onclick="document.getElementById('upiScreenshotFile').click()">
                  <input type="file" id="upiScreenshotFile" accept="image/*" style="display: none;" onchange="app.handleScreenshotSelected(event)" />
                  <div id="screenshotPreviewContainer" style="display: none; align-items: center; justify-content: center; gap: 12px;">
                    <img id="screenshotPreviewImg" src="" style="width: 58px; height: 58px; object-fit: cover; border-radius: 6px; border: 1.5px solid #059669;" />
                    <div style="text-align: left;">
                      <div id="screenshotFileName" style="font-weight: 700; font-size: 0.82rem; color: #0f172a;"></div>
                      <div style="font-size: 0.72rem; color: #059669; font-weight: 700;">✓ Receipt attached</div>
                      <button type="button" class="btn btn-ghost btn-xs" style="color: #dc2626; padding: 0; margin-top: 2px; text-decoration: underline;" 
                        onclick="event.stopPropagation(); app.removeScreenshotSelected();">Remove</button>
                    </div>
                  </div>
                  <div id="screenshotPrompt">
                    <span style="font-size: 1.6rem;">📸</span>
                    <div style="font-size: 0.82rem; font-weight: 700; color: #1e293b; margin-top: 4px;">
                      Click to upload payment screenshot
                    </div>
                    <div style="font-size: 0.72rem; color: #64748b;">PNG, JPG, JPEG up to 15MB</div>
                  </div>
                </div>
              </div>

              <button type="button" class="btn btn-primary btn-lg" id="btnConfirmUpiPayment" onclick="app.submitUpiPayment('${plan.id}', ${amount})" 
                style="width: 100%; justify-content: center; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); font-weight: 800; font-size: 1rem; padding: 12px; box-shadow: 0 4px 14px rgba(22, 163, 74, 0.35);">
                ✓ Submit Proof for Admin Approval
              </button>
            </div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-light); padding-top: 14px;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="app.openUpgradeModal()">
            &larr; Back to All Plans
          </button>
          <div style="font-size: 0.76rem; color: var(--text-muted);">
            Need payment help? WhatsApp: <a href="https://wa.me/919158852129?text=Hi%20Aparaitech%20Software,%20I%20need%20help%20with%20UPI%20Payment" target="_blank" style="color: #16a34a; font-weight: 700;">💬 +91 9158852129</a>
          </div>
        </div>
      </div>
    `;

    this.openModal(modalHtml, '720px');
  }

  async submitUpiPayment(planId, amount) {
    const utrInput = document.getElementById('upiUtrNumber');
    const utr = utrInput ? utrInput.value.trim() : '';
    const fileInput = document.getElementById('upiScreenshotFile');
    const file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
    const btn = document.getElementById('btnConfirmUpiPayment');

    if (!utr) {
      this.showToast('Please enter your 12-digit UPI UTR / Transaction Reference number.', 'warning');
      if (utrInput) utrInput.focus();
      return;
    }

    if (!file && !this.selectedScreenshotBase64) {
      this.showToast('Please attach your payment screenshot receipt for Admin approval.', 'warning');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<div class="spinner" style="width: 16px; height: 16px; border-width: 2px; margin-right: 8px;"></div> Submitting Payment Proof...';
    }

    try {
      let res;
      if (file) {
        const formData = new FormData();
        formData.append('planId', planId);
        formData.append('amount', amount);
        formData.append('utrNumber', utr);
        formData.append('screenshot', file);
        res = await api.paySubscriptionUpi(formData);
      } else {
        res = await api.paySubscriptionUpi(planId, utr, amount, this.selectedScreenshotBase64);
      }

      this.showToast(res.message || 'Payment proof submitted! Awaiting Admin verification.', 'success');
      this.closeModal();
      await this.refreshSubscription();
      if (this.currentView === 'settings' || this.currentView === 'dashboard') {
        this.renderView(this.currentView);
      }
    } catch (err) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '✓ Submit Proof for Admin Approval';
      }
      this.showToast(err.message || 'Failed to submit payment proof', 'error');
    }
  }

  openPendingPaymentStatusModal() {
    const p = this.subscription && this.subscription.pendingPayment;
    if (!p) {
      this.showToast('No pending payment found.', 'info');
      return;
    }

    const modalHtml = `
      <div class="modal-header" style="background: #0f172a; color: #fff;">
        <h3 class="modal-title" style="color: #fff;">⏳ Payment Verification in Progress</h3>
        <button class="modal-close" onclick="app.closeModal()" style="color: #fff;">&times;</button>
      </div>
      <div class="modal-body" style="padding: 24px;">
        <div style="text-align: center; margin-bottom: 18px;">
          <div style="font-size: 2.5rem; margin-bottom: 8px;">⏳</div>
          <h3 style="font-size: 1.2rem; font-weight: 800; color: #0f172a; margin-bottom: 4px;">Awaiting SuperAdmin Verification</h3>
          <p style="font-size: 0.82rem; color: var(--text-muted);">
            Your UPI payment proof has been submitted and is waiting for administrator approval.
          </p>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 18px; font-size: 0.85rem;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: var(--text-muted);">Plan Requested:</span>
            <strong>${p.plan_name} (${p.plan_servers} Dedicated Servers)</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: var(--text-muted);">Amount:</span>
            <strong style="color: #059669;">₹${Number(p.amount).toLocaleString('en-IN')}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: var(--text-muted);">UTR / Reference:</span>
            <code>${p.utr_number}</code>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Submitted Date:</span>
            <span>${new Date(p.created_at).toLocaleString()}</span>
          </div>
        </div>

        ${p.screenshot_url ? `
          <div style="text-align: center; margin-bottom: 18px;">
            <div style="font-size: 0.76rem; font-weight: 700; color: #475569; margin-bottom: 6px;">Submitted Screenshot Receipt:</div>
            <img src="${p.screenshot_url}" style="max-width: 140px; max-height: 140px; border-radius: 6px; border: 1px solid #cbd5e1; box-shadow: var(--shadow-sm);" />
          </div>
        ` : ''}

        <p style="font-size: 0.78rem; color: #0369a1; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; padding: 10px 14px; line-height: 1.5;">
          ℹ️ Your multi-server fleet quota will unlock automatically as soon as the administrator verifies your payment against the merchant statement. If urgent, WhatsApp: <a href="https://wa.me/919158852129?text=Hi%20Aparaitech%20Software,%20I%20have%20submitted%20my%20payment%20proof" target="_blank" style="color: #16a34a; font-weight: 700;">💬 +91 9158852129</a>.
        </p>

        <div style="display: flex; justify-content: flex-end; margin-top: 18px;">
          <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Close</button>
        </div>
      </div>
    `;

    this.openModal(modalHtml, '600px');
  }

  async handleUpgradePlan(planId) {
    this.openUpiPaymentModal(planId);
  }

  async refreshEnvironmentBadge() {
    try {
      const data = await api.getSettings();
      const settings = data.settings || {};
      const badge = document.getElementById('envBadgeText');
      if (badge) {
        badge.textContent = 'Live SMTP';
      }
    } catch (err) {
      console.error('Settings badge error:', err);
    }
  }

  async refreshCounters() {
    try {
      const statsData = await api.getDashboardStats();
      const countEl = document.getElementById('navStudentCount');
      if (countEl && statsData.stats) {
        countEl.textContent = statsData.stats.totalStudents || 0;
      }
    } catch (err) {
      console.error('Counter refresh error:', err);
    }
  }

  handleRoute() {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    const [viewName] = hash.split('?');
    const params = this.pendingParams || null;
    this.pendingParams = null;
    this.navigate(viewName, params, false);
  }

  navigate(viewName, params = null, updateHash = true) {
    if (viewName === 'admin') {
      window.location.href = '/admin';
      return;
    }

    if (!this.views[viewName]) {
      viewName = 'dashboard';
    }

    if (params) {
      this.pendingParams = params;
    }

    // Clean up previous view if needed
    if (this.views[this.currentView] && typeof this.views[this.currentView].destroy === 'function') {
      this.views[this.currentView].destroy();
    }

    this.currentView = viewName;

    if (updateHash) {
      if (window.location.hash === `#${viewName}`) {
        // Same hash, handle route manually
        const routeParams = this.pendingParams || params;
        this.pendingParams = null;
        this.renderView(viewName, routeParams);
        return;
      }
      window.location.hash = viewName;
      return;
    }

    this.renderView(viewName, params);
  }

  renderView(viewName, params) {
    // Update active nav class
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => {
      if (el.getAttribute('data-view') === viewName) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    // Scroll to top
    window.scrollTo(0, 0);

    // Render target view
    const viewObj = this.views[viewName];
    if (viewObj && typeof viewObj.render === 'function') {
      viewObj.render(this.viewContainer, params);
    }
  }

  openLaptopModal() {
    const content = `
      <div class="modal-header" style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); color: #ffffff; padding: 20px 24px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="background: rgba(56, 189, 248, 0.2); width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; border: 1px solid rgba(56, 189, 248, 0.4);">
            💻
          </div>
          <div>
            <h3 class="modal-title" style="color: #ffffff; font-size: 1.2rem; margin-bottom: 3px;">BlastBee Laptop Desktop Application</h3>
            <div style="font-size: 0.78rem; color: #93c5fd;">Windows 10 &amp; 11 (64-bit) &bull; Standalone Desktop App</div>
          </div>
        </div>
        <button class="modal-close" onclick="app.closeModal()" style="color: #ffffff; background: rgba(255,255,255,0.15);">&times;</button>
      </div>
      <div class="modal-body" style="padding: 24px;">
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 0.72rem; text-transform: uppercase; color: #64748b; font-weight: 700;">Platform</div>
            <div style="font-size: 0.95rem; font-weight: 800; color: #0f172a; margin-top: 2px;">Windows 10 / 11</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 0.72rem; text-transform: uppercase; color: #64748b; font-weight: 700;">Version</div>
            <div style="font-size: 0.95rem; font-weight: 800; color: #0f172a; margin-top: 2px;">v2.4.0 (Latest)</div>
          </div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 0.72rem; text-transform: uppercase; color: #64748b; font-weight: 700;">Package</div>
            <div style="font-size: 0.95rem; font-weight: 800; color: #0f172a; margin-top: 2px;">Standalone App</div>
          </div>
        </div>

        <div style="background: #f0f9ff; border: 1.5px solid #bae6fd; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
          <h4 style="font-size: 0.9rem; font-weight: 800; color: #0369a1; margin-bottom: 8px;">✨ Why Run BlastBee on Your Laptop?</h4>
          <ul style="margin: 0; padding-left: 20px; font-size: 0.84rem; color: #0c4a6e; line-height: 1.6;">
            <li><strong>Dedicated Standalone Window:</strong> Run BlastBee frameless without browser tab clutter.</li>
            <li><strong>Local Engine Speed:</strong> Ultra-fast local email queue processing with zero network latency.</li>
            <li><strong>1-Click Desktop Shortcut:</strong> Places a desktop launcher right on your PC.</li>
            <li><strong>Full Offline Capability:</strong> Edit campaigns and manage candidate databases locally.</li>
          </ul>
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px; align-items: center;">
          <a href="/api/download/app" class="btn btn-primary" style="width: 100%; justify-content: center; padding: 14px; font-weight: 800; font-size: 1rem; border-radius: 8px; box-shadow: 0 4px 16px rgba(37, 99, 235, 0.4); text-decoration: none;">
            <span>💻</span>
            <span>Download BlastBee App for Laptop</span>
          </a>
          <div style="font-size: 0.74rem; color: #64748b; text-align: center;">
            Direct Windows Application &bull; 13.3 MB &bull; Instant 1-Click Launch
          </div>
        </div>
      </div>
    `;
    this.openModal(content, '540px');
  }

  openUpgradeModal() {
    this.navigate('subscription');
  }

  openModal(htmlContent, maxWidth = null) {
    const overlay = document.getElementById('modalContainer');
    const card = document.getElementById('modalCard');
    if (overlay && card) {
      card.innerHTML = htmlContent;
      card.style.maxWidth = maxWidth || '';
      overlay.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  }

  closeModal() {
    const overlay = document.getElementById('modalContainer');
    const card = document.getElementById('modalCard');
    if (card) {
      card.style.maxWidth = '';
    }
    if (overlay) {
      overlay.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  showToast(message, type = 'info', title = null) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const titles = {
      success: title || 'Success',
      error: title || 'Error',
      warning: title || 'Warning',
      info: title || 'Notice'
    };

    const icons = {
      success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>',
      error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
      warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
      info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
    };

    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || icons.info}</div>
      <div class="toast-content">
        <div class="toast-title">${titles[type]}</div>
        <div class="toast-msg">${message}</div>
      </div>
      <button class="toast-close" onclick="this.parentElement.remove()">&times;</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('hiding');
      setTimeout(() => toast.remove(), 250);
    }, 4500);
  }
}

// Global App Instance
const app = new App();

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
