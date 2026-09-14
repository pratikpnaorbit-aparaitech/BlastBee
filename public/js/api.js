/**
 * Aparaitech API Client
 * Centralized fetch interface with error handling and response unwrapping
 */
const api = {
  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `/api${endpoint}`;
    
    const token = localStorage.getItem('aparaitech_auth_token');
    const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...options.headers
      },
      ...options
    };

    // If body is FormData, delete Content-Type to allow browser to set boundary
    if (options.body instanceof FormData) {
      delete config.headers['Content-Type'];
    } else if (options.body && typeof options.body === 'object') {
      config.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || `HTTP Error ${response.status}: ${response.statusText}`);
      }

      return data;
    } catch (error) {
      console.error(`API Error on [${options.method || 'GET'} ${endpoint}]:`, error);
      throw error;
    }
  },

  // Students API
  getStudents(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/students?${query}`);
  },

  getStudent(id) {
    return this.request(`/students/${id}`);
  },

  createStudent(data) {
    return this.request('/students', { method: 'POST', body: data });
  },

  updateStudent(id, data) {
    return this.request(`/students/${id}`, { method: 'PUT', body: data });
  },

  deleteStudent(id) {
    return this.request(`/students/${id}`, { method: 'DELETE' });
  },

  bulkDeleteStudents(ids) {
    return this.request('/students/bulk-delete', { method: 'POST', body: { ids } });
  },

  getColleges() {
    return this.request('/students/colleges');
  },

  getUploadBatches() {
    return this.request('/students/batches');
  },

  deleteUploadBatch(batchId) {
    return this.request(`/students/batch/${encodeURIComponent(batchId)}`, { method: 'DELETE' });
  },

  // Bulk Upload API
  parseSpreadsheet(formData) {
    return this.request('/upload/parse', { method: 'POST', body: formData });
  },

  revalidateSpreadsheet(rawRows, mapping) {
    return this.request('/upload/revalidate', { method: 'POST', body: { rawRows, mapping } });
  },

  commitSpreadsheet(rawRows, mapping, duplicateStrategy, filename) {
    return this.request('/upload/commit', { method: 'POST', body: { rawRows, mapping, duplicateStrategy, filename } });
  },

  // Templates API
  getTemplates() {
    return this.request('/templates');
  },

  getTemplate(id) {
    return this.request(`/templates/${id}`);
  },

  createTemplate(data) {
    return this.request('/templates', { method: 'POST', body: data });
  },

  updateTemplate(id, data) {
    return this.request(`/templates/${id}`, { method: 'PUT', body: data });
  },

  deleteTemplate(id) {
    return this.request(`/templates/${id}`, { method: 'DELETE' });
  },

  renderPreview(data) {
    return this.request('/templates/preview', { method: 'POST', body: data });
  },

  getSampleTemplates() {
    return this.request('/templates/samples');
  },

  restoreSampleTemplates() {
    return this.request('/templates/reset-samples', { method: 'POST' });
  },

  // Campaigns API
  getCampaigns() {
    return this.request('/campaigns');
  },

  getCampaign(id) {
    return this.request(`/campaigns/${id}`);
  },

  getCampaignRecipients(id, params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/campaigns/${id}/recipients?${query}`);
  },

  launchCampaign(data) {
    return this.request('/campaigns', { method: 'POST', body: data });
  },

  pauseCampaign(id) {
    return this.request(`/campaigns/${id}/pause`, { method: 'POST' });
  },

  resumeCampaign(id) {
    return this.request(`/campaigns/${id}/resume`, { method: 'POST' });
  },

  cancelCampaign(id) {
    return this.request(`/campaigns/${id}/cancel`, { method: 'POST' });
  },

  retryFailedCampaign(id) {
    return this.request(`/campaigns/${id}/retry-failed`, { method: 'POST' });
  },

  sendTestEmail(data) {
    return this.request('/campaigns/test-send', { method: 'POST', body: data });
  },

  // Stats & Dashboard
  getDashboardStats() {
    return this.request('/stats/dashboard');
  },

  // Settings
  getSettings() {
    return this.request('/settings');
  },

  updateSettings(data) {
    return this.request('/settings', { method: 'POST', body: data });
  },

  testSmtp(data) {
    return this.request('/settings/test-smtp', { method: 'POST', body: data });
  },

  // Multi-SMTP Account Pool API
  getSmtpAccounts() {
    return this.request('/settings/smtp-accounts');
  },

  createSmtpAccount(data) {
    return this.request('/settings/smtp-accounts', { method: 'POST', body: data });
  },

  updateSmtpAccount(id, data) {
    return this.request(`/settings/smtp-accounts/${id}`, { method: 'PUT', body: data });
  },

  toggleSmtpAccount(id) {
    return this.request(`/settings/smtp-accounts/${id}/toggle`, { method: 'PATCH' });
  },

  deleteSmtpAccount(id) {
    return this.request(`/settings/smtp-accounts/${id}`, { method: 'DELETE' });
  },

  testSmtpAccount(data) {
    return this.request('/settings/smtp-accounts/test', { method: 'POST', body: data });
  },

  resetSmtpCounters() {
    return this.request('/settings/smtp-accounts/reset-counters', { method: 'POST' });
  },

  // MongoDB Atlas API
  testMongoDb(uri) {
    return this.request('/settings/test-mongodb', { method: 'POST', body: { uri } });
  },

  saveMongoDb(uri) {
    return this.request('/settings/save-mongodb', { method: 'POST', body: { uri } });
  },

  // Anti-Spam Shield API
  checkSpam(data) {
    return this.request('/campaigns/spam-check', { method: 'POST', body: data });
  },

  checkDns(domain = '') {
    const query = domain ? `?domain=${encodeURIComponent(domain)}` : '';
    return this.request(`/campaigns/dns-check${query}`);
  },

  // Auth API
  register(userData) {
    return this.request('/auth/register', { method: 'POST', body: userData });
  },

  login(credentials) {
    return this.request('/auth/login', { method: 'POST', body: credentials });
  },

  logout() {
    return this.request('/auth/logout', { method: 'POST' });
  },

  getMe() {
    return this.request('/auth/me');
  },

  getAdminUsers() {
    return this.request('/auth/users');
  },

  createAdminUser(data) {
    return this.request('/auth/users', { method: 'POST', body: data });
  },

  changeUserPassword(userId, newPassword) {
    return this.request(`/auth/users/${userId}/password`, { method: 'PUT', body: { newPassword } });
  },

  // Subscription & Server Allocation API ("How much server you gave")
  getSubscription() {
    return this.request('/subscription');
  },

  getSubscriptionPlans() {
    return this.request('/subscription/plans');
  },

  upgradeSubscription(planId) {
    return this.request('/subscription/upgrade', { method: 'POST', body: { planId } });
  },

  paySubscriptionUpi(planIdOrFormData, utrNumber, amount, screenshotData) {
    if (planIdOrFormData instanceof FormData) {
      return this.request('/subscription/pay-upi', {
        method: 'POST',
        body: planIdOrFormData
      });
    }
    return this.request('/subscription/pay-upi', {
      method: 'POST',
      body: { 
        planId: planIdOrFormData, 
        utrNumber, 
        amount, 
        screenshotData 
      }
    });
  },

  getMyPayments() {
    return this.request('/subscription/my-payments');
  },

  updateSubscriptionLimits(limits) {
    return this.request('/subscription/limits', { method: 'PUT', body: limits });
  },

  getServerFleet() {
    return this.request('/subscription/server-fleet');
  },

  getCustomers() {
    return this.request('/subscription/customers');
  },

  extendCustomerTrial(id, extraDays = 7) {
    return this.request(`/subscription/customers/${id}/extend-trial`, { method: 'POST', body: { extraDays } });
  },

  upgradeCustomerPlan(id, planId) {
    return this.request(`/subscription/customers/${id}/upgrade`, { method: 'POST', body: { planId } });
  },

  updateCustomerLimits(id, limits) {
    return this.request(`/subscription/customers/${id}/limits`, { method: 'PUT', body: limits });
  },

  // Admin Payment Approvals API
  getAdminPayments() {
    return this.request('/subscription/admin/payments');
  },

  approvePayment(paymentId) {
    return this.request(`/subscription/admin/payments/${paymentId}/approve`, { method: 'POST' });
  },

  rejectPayment(paymentId, adminNote = '') {
    return this.request(`/subscription/admin/payments/${paymentId}/reject`, { method: 'POST', body: { adminNote } });
  },

  // Admin Subscription Plans Editor API
  updateSubscriptionPlan(planId, data) {
    return this.request(`/subscription/plans/${planId}`, { method: 'PUT', body: data });
  },

  // Admin User Deletion API
  deleteUser(userId) {
    return this.request(`/auth/users/${userId}`, { method: 'DELETE' });
  }
};
