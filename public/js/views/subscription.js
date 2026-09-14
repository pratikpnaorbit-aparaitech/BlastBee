/**
 * BlastBee Subscription & Plans View
 * Developed by Aparaitech Software
 * Manages active tier, dedicated multi-server quotas, UPI payments, and approval tracking
 */
const SubscriptionView = {
  state: {
    subscription: null,
    plans: [],
    payments: [],
    loading: true
  },

  async render(container) {
    container.innerHTML = `
      <div class="view-loading">
        <div class="spinner"></div>
        <p>Loading BlastBee Subscription &amp; Server Allocation...</p>
      </div>
    `;

    try {
      const [subRes, plansRes, payRes] = await Promise.all([
        api.getSubscription().catch(() => ({})),
        api.getSubscriptionPlans().catch(() => ({})),
        api.getMyPayments().catch(() => ({ payments: [] }))
      ]);

      this.state.subscription = subRes.subscription || null;
      this.state.plans = plansRes.plans || [];
      this.state.payments = payRes.payments || [];
      this.state.loading = false;

      this.renderContent(container);
    } catch (err) {
      console.error('Error loading subscription view:', err);
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <h3 class="empty-state-title">Could not load subscription details</h3>
          <p class="empty-state-desc">${err.message || 'Please check your connection and try again.'}</p>
          <button class="btn btn-primary btn-sm" onclick="SubscriptionView.render(document.getElementById('viewContainer'))">
            Retry
          </button>
        </div>
      `;
    }
  },

  renderContent(container) {
    const sub = this.state.subscription || {};
    const plans = this.state.plans || [];
    const payments = this.state.payments || [];

    const isTrial = sub.status === 'trial';
    const isExpired = sub.is_expired;
    const currentPlanId = sub.plan_id || 'trial';
    const planName = sub.plan_name || (isTrial ? '7-Day Free Trial' : 'Active Plan');
    const maxServers = sub.active_servers_allowed || 1;
    const maxEmails = sub.monthly_limit || 3500;
    const configuredServers = sub.configured_servers_count || 0;
    const daysRemaining = sub.days_remaining !== undefined ? sub.days_remaining : 7;

    let statusBadgeHtml = '';
    if (isExpired) {
      statusBadgeHtml = `<span class="badge" style="background: #dc2626; color: #fff; font-weight: 700; padding: 4px 12px; font-size: 0.78rem;">🔴 Subscription Expired</span>`;
    } else if (isTrial) {
      statusBadgeHtml = `<span class="badge" style="background: #f59e0b; color: #000; font-weight: 800; padding: 4px 12px; font-size: 0.78rem;">🟡 7-Day Free Trial (${daysRemaining} Days Left)</span>`;
    } else {
      statusBadgeHtml = `<span class="badge" style="background: #059669; color: #fff; font-weight: 800; padding: 4px 12px; font-size: 0.78rem;">🟢 Active Paid Subscription</span>`;
    }

    container.innerHTML = `
      <!-- View Header -->
      <div class="view-header" style="margin-bottom: 24px;">
        <div class="view-title-group">
          <div style="display: flex; align-items: center; gap: 10px;">
            <h1 style="margin: 0; font-size: 1.6rem; font-weight: 800; color: #0f172a;">BlastBee Subscription &amp; Plans</h1>
            <span class="badge" style="background: #2563eb; color: #fff; font-size: 0.72rem; font-weight: 700;">Chrome Extension</span>
          </div>
          <p style="margin-top: 4px; font-size: 0.85rem; color: #64748b;">Developed by <strong>Aparaitech Software</strong> &bull; Manage your dedicated SMTP sender allocations and UPI billing in Indian Rupees (₹ INR)</p>
        </div>

        <div class="header-actions">
          <button class="btn btn-secondary btn-sm" onclick="app.navigate('settings')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            <span>My SMTP Senders</span>
          </button>
          <button class="btn btn-primary btn-sm" onclick="app.openUpgradeModal()">
            <span>⚡ Upgrade Server Quota</span>
          </button>
        </div>
      </div>

      <!-- Current Subscription Status Card -->
      <div class="card" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; border-radius: 14px; padding: 24px 28px; margin-bottom: 30px; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.3);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px; margin-bottom: 20px;">
          <div>
            <div style="font-size: 0.76rem; text-transform: uppercase; color: #94a3b8; font-weight: 800; letter-spacing: 0.6px; margin-bottom: 6px;">CURRENT SUBSCRIPTION TIER</div>
            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
              <h2 style="font-size: 1.7rem; font-weight: 800; color: #ffffff; margin: 0;">${planName}</h2>
              ${statusBadgeHtml}
            </div>
            <div style="font-size: 0.84rem; color: #cbd5e1; margin-top: 6px;">
              ${isTrial ? `Trial access expires in <strong>${daysRemaining} days</strong>. Upgrade to unlock multi-server auto-rotation!` : `Subscription active. Dedicated SMTP capacity unlocked.`}
            </div>
          </div>

          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn btn-sm" onclick="app.openUpiPaymentModal('${currentPlanId === 'trial' ? 'growth' : currentPlanId}')" style="background: #2563eb; color: #ffffff; font-weight: 700; border: none; padding: 9px 16px; border-radius: 6px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);">
              <span>⚡ Upgrade Plan via UPI &rarr;</span>
            </button>
          </div>
        </div>

        <!-- 3 Metrics Columns -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; border-top: 1px solid rgba(255,255,255,0.12); padding-top: 18px;">
          <div style="background: rgba(255,255,255,0.06); border-radius: 10px; padding: 14px 18px; border: 1px solid rgba(255,255,255,0.08);">
            <div style="font-size: 0.72rem; text-transform: uppercase; color: #93c5fd; font-weight: 700; letter-spacing: 0.5px;">Dedicated SMTP Quota</div>
            <div style="font-size: 1.4rem; font-weight: 800; color: #ffffff; margin-top: 4px;">
              🖥️ ${maxServers} <span style="font-size: 0.8rem; font-weight: 500; color: #94a3b8;">Server${maxServers === 1 ? '' : 's'} Allowed</span>
            </div>
            <div style="font-size: 0.74rem; color: #cbd5e1; margin-top: 2px;">
              ${configuredServers} currently active in pool
            </div>
          </div>

          <div style="background: rgba(255,255,255,0.06); border-radius: 10px; padding: 14px 18px; border: 1px solid rgba(255,255,255,0.08);">
            <div style="font-size: 0.72rem; text-transform: uppercase; color: #a7f3d0; font-weight: 700; letter-spacing: 0.5px;">Monthly Send Limit</div>
            <div style="font-size: 1.4rem; font-weight: 800; color: #ffffff; margin-top: 4px;">
              📬 ${Number(maxEmails).toLocaleString()} <span style="font-size: 0.8rem; font-weight: 500; color: #94a3b8;">Emails / Mo</span>
            </div>
            <div style="font-size: 0.74rem; color: #cbd5e1; margin-top: 2px;">
              High-speed throttled delivery
            </div>
          </div>

          <div style="background: rgba(255,255,255,0.06); border-radius: 10px; padding: 14px 18px; border: 1px solid rgba(255,255,255,0.08);">
            <div style="font-size: 0.72rem; text-transform: uppercase; color: #fbcfe8; font-weight: 700; letter-spacing: 0.5px;">Delivery Engine</div>
            <div style="font-size: 1.4rem; font-weight: 800; color: #ffffff; margin-top: 4px;">
              ${maxServers > 1 ? '🔄 Round-Robin' : '⚡ Single Server'}
            </div>
            <div style="font-size: 0.74rem; color: #cbd5e1; margin-top: 2px;">
              ${maxServers > 1 ? 'Multi-server auto-failover active' : 'Upgrade for multi-server rotation'}
            </div>
          </div>
        </div>
      </div>

      <!-- Section: 4-Tier Plan Comparison Grid -->
      <div style="margin-bottom: 36px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="font-size: 1.4rem; font-weight: 800; color: #0f172a; margin-bottom: 6px;">Available BlastBee Subscription Tiers</h2>
          <p style="font-size: 0.86rem; color: #64748b; margin: 0;">All plans include dedicated SMTP sender quotas, anti-spam shields, and instant UPI activation.</p>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; align-items: stretch;">
          ${plans.map(p => {
            const isCurrent = currentPlanId === p.id;
            const isGrowth = p.id === 'growth' || p.is_popular === 1;
            const isTrialPlan = p.id === 'trial' || p.price === 0;
            const isEnterprise = p.id === 'enterprise';

            let border = 'border: 1.5px solid #cbd5e1;';
            let shadow = 'box-shadow: 0 4px 16px -4px rgba(0, 0, 0, 0.05);';
            let badgeBg = '#334155';
            let badgeText = '💼 RECRUITER';
            let quotaBg = '#f8fafc';
            let quotaBorder = '#e2e8f0';
            let quotaLabelColor = '#475569';
            let quotaValColor = '#1e293b';
            let quotaVal = `🖥️ ${p.max_servers} Dedicated SMTP Servers Granted`;
            let ctaBg = '#0f172a';

            if (isTrialPlan) {
              border = 'border: 1.5px solid #38bdf8;';
              shadow = 'box-shadow: 0 4px 18px -4px rgba(56, 189, 248, 0.18);';
              badgeBg = '#0284c7';
              badgeText = '🎁 7-DAY FREE TRIAL';
              quotaBg = '#f0f9ff';
              quotaBorder = '#bae6fd';
              quotaLabelColor = '#0284c7';
              quotaValColor = '#0369a1';
              quotaVal = '🖥️ 1 Dedicated SMTP Server Allowed';
              ctaBg = '#0284c7';
            } else if (isGrowth) {
              border = 'border: 2.5px solid #2563eb;';
              shadow = 'box-shadow: 0 12px 30px -4px rgba(37, 99, 235, 0.22);';
              badgeBg = '#2563eb';
              badgeText = '🔥 MOST POPULAR • BEST ROI';
              quotaBg = '#eff6ff';
              quotaBorder = '#bfdbfe';
              quotaLabelColor = '#1d4ed8';
              quotaValColor = '#1e3a8a';
              quotaVal = `⚡ ${p.max_servers} Active SMTP Servers Granted`;
              ctaBg = '#2563eb';
            } else if (isEnterprise) {
              border = 'border: 1.5px solid #c084fc;';
              shadow = 'box-shadow: 0 4px 18px -4px rgba(192, 132, 252, 0.18);';
              badgeBg = '#7c3aed';
              badgeText = '👑 ENTERPRISE FLEET';
              quotaBg = '#faf5ff';
              quotaBorder = '#e9d5ff';
              quotaLabelColor = '#7c3aed';
              quotaValColor = '#4c1d95';
              quotaVal = `🏢 ${p.max_servers}+ Multi-SMTP Servers Granted`;
              ctaBg = '#7c3aed';
            }

            let featuresList = [];
            try {
              featuresList = Array.isArray(p.features) ? p.features : JSON.parse(p.features || '[]');
            } catch (e) {
              featuresList = [];
            }

            const formattedPrice = isTrialPlan ? '₹0' : '₹' + Number(p.price).toLocaleString('en-IN');
            const cadence = isTrialPlan ? '/ 7 days free' : `/ ${p.billing_interval || 'month'}`;

            return `
              <div class="card" style="${border} ${shadow} border-radius: 14px; background: #ffffff; display: flex; flex-direction: column; justify-content: space-between; padding: 28px 20px 22px; position: relative;">
                <div>
                  <div style="position: absolute; top: -13px; left: 50%; transform: translateX(-50%); font-size: 0.68rem; font-weight: 800; padding: 4px 12px; border-radius: 99px; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; background: ${badgeBg}; color: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.12);">
                    ${isCurrent ? '🟢 ACTIVE: ' + badgeText : badgeText}
                  </div>

                  <div style="min-height: 48px; display: flex; align-items: center; justify-content: center; text-align: center; margin-top: 4px; margin-bottom: 4px;">
                    <h3 style="font-size: 1.2rem; font-weight: 800; color: #0f172a; margin: 0;">${p.name}</h3>
                  </div>

                  <div style="min-height: 42px; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 0.8rem; color: #64748b; margin-bottom: 14px;">
                    ${p.description || ''}
                  </div>

                  <div style="min-height: 64px; display: flex; flex-direction: column; align-items: center; justify-content: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 16px;">
                    <div style="font-size: 2.1rem; font-weight: 900; color: ${isGrowth ? '#2563eb' : '#0f172a'}; line-height: 1;">
                      ${formattedPrice}
                    </div>
                    <div style="font-size: 0.78rem; font-weight: 600; color: #64748b; margin-top: 3px;">
                      ${cadence}
                    </div>
                  </div>

                  <div style="min-height: 64px; background: ${quotaBg}; border: 1px solid ${quotaBorder}; border-radius: 8px; padding: 8px 12px; margin-bottom: 18px; display: flex; flex-direction: column; justify-content: center; text-align: center;">
                    <div style="font-size: 0.66rem; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px; color: ${quotaLabelColor}; margin-bottom: 2px;">SERVER CAPACITY</div>
                    <div style="font-size: 0.92rem; font-weight: 800; color: ${quotaValColor};">${quotaVal}</div>
                  </div>

                  <ul style="list-style: none; padding: 0; margin: 0 0 20px 0; display: flex; flex-direction: column; gap: 8px; font-size: 0.8rem; color: #334155; line-height: 1.4;">
                    ${featuresList.map(f => `
                      <li style="display: flex; align-items: flex-start; gap: 8px;">
                        <span style="color: #16a34a; font-weight: 800; font-size: 0.9rem; flex-shrink: 0; line-height: 1;">✓</span>
                        <span>${f}</span>
                      </li>
                    `).join('')}
                  </ul>
                </div>

                <div style="margin-top: auto; padding-top: 10px;">
                  ${isCurrent ? `
                    <button class="btn btn-sm" disabled style="width: 100%; justify-content: center; background: #e2e8f0; color: #475569; font-weight: 800; border: none; padding: 12px; border-radius: 8px;">
                      ✓ Current Active Plan
                    </button>
                  ` : (isTrialPlan ? `
                    <button class="btn btn-sm" disabled style="width: 100%; justify-content: center; background: #f1f5f9; color: #94a3b8; font-weight: 700; border: 1px solid #cbd5e1; padding: 12px; border-radius: 8px;">
                      Trial Tier
                    </button>
                  ` : `
                    <button class="btn btn-sm" onclick="app.openUpiPaymentModal('${p.id}')" style="width: 100%; justify-content: center; background: ${ctaBg}; color: #ffffff; font-weight: 800; border: none; padding: 12px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
                      ⚡ Upgrade to ${p.name.split(' ')[0]} (${formattedPrice}) &rarr;
                    </button>
                  `)}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Section: Direct Indian UPI Payment Instructions & Gateway Details -->
      <div class="card" style="background: #ffffff; border: 1.5px solid #cbd5e1; border-radius: 14px; padding: 24px 28px; margin-bottom: 30px;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 18px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 44px; height: 44px; border-radius: 10px; background: #f0fdf4; border: 1px solid #bbf7d0; display: flex; align-items: center; justify-content: center; font-size: 1.4rem;">
              🇮🇳
            </div>
            <div>
              <h3 style="font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 0;">Direct Merchant UPI Gateway</h3>
              <p style="font-size: 0.8rem; color: #64748b; margin: 2px 0 0 0;">Zero Transaction Fees &bull; Instant Admin Verification &bull; Dedicated Server Allocation</p>
            </div>
          </div>

          <div style="display: flex; gap: 10px;">
            <button class="btn btn-secondary btn-sm" onclick="app.copyUpiId('8261840199-3@ibl')">
              📋 Copy Merchant UPI ID
            </button>
            <button class="btn btn-primary btn-sm" onclick="app.openUpiPaymentModal('growth')">
              ⚡ Open UPI Payment QR &rarr;
            </button>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 22px;">
          <div>
            <div style="font-size: 0.74rem; text-transform: uppercase; color: #475569; font-weight: 700; margin-bottom: 4px;">Merchant Details</div>
            <div style="font-size: 0.95rem; font-weight: 800; color: #0f172a;">Payee: Aparaitech Software</div>
            <div style="font-size: 0.95rem; font-weight: 800; color: #059669; font-family: monospace; margin-top: 4px;">UPI ID: 8261840199-3@ibl</div>
            <div style="font-size: 0.78rem; color: #64748b; margin-top: 4px;">Accepted: GPay &bull; PhonePe &bull; Paytm &bull; BHIM &bull; CRED &bull; All Banking UPI</div>
          </div>

          <div>
            <div style="font-size: 0.74rem; text-transform: uppercase; color: #475569; font-weight: 700; margin-bottom: 4px;">How Activation Works</div>
            <div style="font-size: 0.82rem; color: #334155; line-height: 1.5;">
              1. Scan the QR code or transfer the exact plan amount to <code>8261840199-3@ibl</code>.<br>
              2. Upload your payment screenshot and enter your 12-digit UTR reference.<br>
              3. SuperAdmin verifies and unlocks your dedicated SMTP server quota immediately.
            </div>
          </div>
        </div>
      </div>

      <!-- Section: Payment Submissions & Status Tracking -->
      <div class="card" style="background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 24px 28px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <h3 style="font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 0;">My Payment Submissions &amp; Approvals</h3>
            <p style="font-size: 0.8rem; color: #64748b; margin: 2px 0 0 0;">Track the status of your UPI payments and server quota unlocks</p>
          </div>
          <button class="btn btn-outline btn-xs" onclick="SubscriptionView.render(document.getElementById('viewContainer'))" title="Refresh payment status">
            🔄 Refresh Status
          </button>
        </div>

        ${payments.length === 0 ? `
          <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 28px; text-align: center;">
            <div style="font-size: 1.6rem; margin-bottom: 8px;">🧾</div>
            <div style="font-size: 0.9rem; font-weight: 700; color: #334155;">No Payment Records Yet</div>
            <div style="font-size: 0.8rem; color: #64748b; max-width: 460px; margin: 4px auto 14px;">
              You are currently using the 7-day free trial. When you upgrade, your UPI transaction receipts and admin verification status will appear here.
            </div>
            <button class="btn btn-primary btn-sm" onclick="app.openUpgradeModal()">
              View Upgrade Options &rarr;
            </button>
          </div>
        ` : `
          <div class="table-container" style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <table class="data-table" style="width: 100%;">
              <thead>
                <tr style="background: #f8fafc;">
                  <th style="padding: 10px 14px; font-size: 0.75rem; font-weight: 700;">Date</th>
                  <th style="padding: 10px 14px; font-size: 0.75rem; font-weight: 700;">Plan</th>
                  <th style="padding: 10px 14px; font-size: 0.75rem; font-weight: 700;">Amount</th>
                  <th style="padding: 10px 14px; font-size: 0.75rem; font-weight: 700;">UTR Reference</th>
                  <th style="padding: 10px 14px; font-size: 0.75rem; font-weight: 700;">Server Quota</th>
                  <th style="padding: 10px 14px; font-size: 0.75rem; font-weight: 700;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${payments.map(p => {
                  let badge = '';
                  if (p.status === 'approved') {
                    badge = `<span class="badge" style="background: #059669; color: #fff; font-weight: 700;">🟢 Approved &amp; Active</span>`;
                  } else if (p.status === 'rejected') {
                    badge = `<span class="badge" style="background: #dc2626; color: #fff; font-weight: 700;">🔴 Rejected</span>`;
                  } else {
                    badge = `<span class="badge" style="background: #f59e0b; color: #000; font-weight: 800;">🕒 Pending Admin Verification</span>`;
                  }

                  return `
                    <tr style="border-top: 1px solid #e2e8f0;">
                      <td style="padding: 12px 14px; font-size: 0.8rem; color: #64748b;">${p.created_at ? new Date(p.created_at).toLocaleDateString() : 'Recent'}</td>
                      <td style="padding: 12px 14px; font-size: 0.85rem; font-weight: 700; color: #0f172a;">${p.plan_name || p.plan_id}</td>
                      <td style="padding: 12px 14px; font-size: 0.85rem; font-weight: 800; color: #059669;">₹${Number(p.amount).toLocaleString('en-IN')}</td>
                      <td style="padding: 12px 14px; font-size: 0.8rem; font-family: monospace; font-weight: 700; color: #1e293b;">${p.utr_number || 'Pending'}</td>
                      <td style="padding: 12px 14px; font-size: 0.8rem; font-weight: 700; color: #2563eb;">🖥️ ${p.plan_servers || 5} Dedicated Servers</td>
                      <td style="padding: 12px 14px;">${badge}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  }
};