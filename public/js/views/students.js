/**
 * Students Management View
 * Directory of student candidates across colleges with search, multi-filter, pagination, CRUD, and bulk blast
 */
const StudentsView = {
  state: {
    students: [],
    selectedIds: new Set(),
    search: '',
    college: '',
    batch: '',
    status: '',
    import_batch_id: '',
    page: 1,
    limit: 15,
    totalPages: 1,
    total: 0,
    filterOptions: { colleges: [], batches: [], uploadBatches: [] }
  },

  async render(container, routeParams = {}) {
    if (routeParams && routeParams.import_batch_id) {
      this.state.import_batch_id = routeParams.import_batch_id;
    }

    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Student Candidate Pool</h1>
          <p>Manage, filter, and segment candidate profiles for Aparaitech recruitment drives</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary btn-sm" onclick="StudentsView.openExportModal()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            <span>Export Data</span>
          </button>
          <button class="btn btn-secondary btn-sm" onclick="app.navigate('import')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            <span>Bulk Upload</span>
          </button>
          <button class="btn btn-primary btn-sm" onclick="StudentsView.openAddModal()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>Add Student</span>
          </button>
        </div>
      </div>

      <!-- Filter Toolbar -->
      <div class="toolbar-container">
        <div class="toolbar-left">
          <div class="search-box">
            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" id="studentSearchInput" placeholder="Search by name, email, college, phone..." value="${StudentsView.state.search}" oninput="StudentsView.handleSearch(this.value)" />
          </div>

          <select class="form-select" style="width: auto; min-width: 170px;" id="filterUploadBatch" onchange="StudentsView.handleFilterUploadBatch(this.value)">
            <option value="">All Upload Sources (${StudentsView.state.total || 'All'})</option>
          </select>

          <select class="form-select" style="width: auto; min-width: 160px;" id="filterCollege" onchange="StudentsView.handleFilterCollege(this.value)">
            <option value="">All Colleges (${StudentsView.state.total || 'All'})</option>
          </select>

          <select class="form-select" style="width: auto; min-width: 120px;" id="filterBatch" onchange="StudentsView.handleFilterBatch(this.value)">
            <option value="">All Batches</option>
            <option value="2027">Batch 2027</option>
            <option value="2026">Batch 2026</option>
            <option value="2025">Batch 2025</option>
            <option value="2024">Batch 2024</option>
          </select>
        </div>

        <div class="toolbar-right" id="bulkActionsBar" style="display: none;">
          <span style="font-size: 0.82rem; font-weight: 600; color: var(--brand-sapphire);" id="selectedCountText">0 selected</span>
          <button class="btn btn-secondary btn-sm" onclick="StudentsView.exportData('csv', 'name_email', true)" title="Export only Name and Email for selected candidates">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            <span>Export Name &amp; Email</span>
          </button>
          <button class="btn btn-primary btn-sm" onclick="StudentsView.blastToSelected()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
            <span>Blast to Selected</span>
          </button>
          <button class="btn btn-danger btn-sm" onclick="StudentsView.bulkDelete()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            <span>Delete</span>
          </button>
        </div>
      </div>

      <!-- Bulk Upload Active Banner -->
      <div id="batchActionBanner" style="display: none; margin-bottom: 16px;"></div>

      <!-- Students Table -->
      <div class="table-container" id="studentsTableWrapper">
        <div class="view-loading">
          <div class="spinner"></div>
          <p>Loading Students...</p>
        </div>
      </div>
    `;

    await this.fetchStudents();
  },

  async fetchStudents() {
    try {
      const data = await api.getStudents({
        search: this.state.search,
        college: this.state.college,
        batch: this.state.batch,
        import_batch_id: this.state.import_batch_id,
        page: this.state.page,
        limit: this.state.limit
      });

      this.state.students = data.students || [];
      this.state.total = data.pagination.total || 0;
      this.state.totalPages = data.pagination.totalPages || 1;
      this.state.filterOptions = data.filterOptions || { colleges: [], batches: [], uploadBatches: [] };

      // Update sidebar counter
      const counterEl = document.getElementById('navStudentCount');
      if (counterEl) counterEl.textContent = this.state.total;

      // Populate upload batches filter
      const batchSelect = document.getElementById('filterUploadBatch');
      if (batchSelect) {
        batchSelect.innerHTML = `<option value="">All Upload Sources (${this.state.total || 'All'})</option>` +
          (this.state.filterOptions.uploadBatches || []).map(b => `
            <option value="${b.import_batch_id}" ${this.state.import_batch_id === b.import_batch_id ? 'selected' : ''}>
              📄 ${b.import_source} (${b.student_count})
            </option>
          `).join('');
      }

      // Populate college filter
      const collegeSelect = document.getElementById('filterCollege');
      if (collegeSelect) {
        const currentCollege = this.state.college;
        collegeSelect.innerHTML = `<option value="">All Colleges (${this.state.total})</option>` +
          (this.state.filterOptions.colleges || []).map(c => `
            <option value="${c.college}" ${currentCollege === c.college ? 'selected' : ''}>${c.college} (${c.count})</option>
          `).join('');
      }

      // Populate batch filter if batches available
      const batchYearSelect = document.getElementById('filterBatch');
      if (batchYearSelect && this.state.filterOptions.batches && this.state.filterOptions.batches.length > 0) {
        const currentBatch = this.state.batch;
        batchYearSelect.innerHTML = `<option value="">All Batches</option>` +
          this.state.filterOptions.batches.map(b => `
            <option value="${b}" ${currentBatch === b ? 'selected' : ''}>Batch ${b}</option>
          `).join('');
      }

      this.renderBatchBanner();
      this.renderTable();
    } catch (error) {
      app.showToast('Failed to load students: ' + error.message, 'error');
    }
  },

  renderBatchBanner() {
    const banner = document.getElementById('batchActionBanner');
    if (!banner) return;

    if (this.state.import_batch_id) {
      const batches = this.state.filterOptions.uploadBatches || [];
      const currentBatch = batches.find(b => b.import_batch_id === this.state.import_batch_id);
      const batchName = currentBatch ? currentBatch.import_source : 'Selected Upload Batch';

      banner.style.display = 'flex';
      banner.style.justifyContent = 'space-between';
      banner.style.alignItems = 'center';
      banner.style.flexWrap = 'wrap';
      banner.style.gap = '12px';
      banner.style.background = '#eff6ff';
      banner.style.border = '1.5px solid var(--brand-sapphire)';
      banner.style.padding = '12px 18px';
      banner.style.borderRadius = 'var(--radius-sm)';

      banner.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 1.1rem;">📄</span>
          <div>
            <div style="font-weight: 700; color: var(--brand-sapphire); font-size: 0.92rem;">
              Viewing Bulk Upload: "${batchName}"
            </div>
            <div style="font-size: 0.78rem; color: var(--text-muted);">
              Contains ${this.state.total} candidates in this single bulk upload
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn-primary btn-sm" onclick="StudentsView.blastCurrentBatch('${this.state.import_batch_id}', '${batchName.replace(/'/g, "\\'")}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
            <span>Blast Entire Upload (${this.state.total})</span>
          </button>
          <button class="btn btn-danger btn-sm" onclick="StudentsView.deleteCurrentBatch('${this.state.import_batch_id}', '${batchName.replace(/'/g, "\\'")}', ${this.state.total})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            <span>Delete All Data of this Upload (${this.state.total})</span>
          </button>
          <button class="btn btn-secondary btn-sm" onclick="StudentsView.handleFilterUploadBatch('')">
            <span>Clear Filter</span>
          </button>
        </div>
      `;
    } else {
      banner.style.display = 'none';
      banner.innerHTML = '';
    }
  },

  handleFilterUploadBatch(batchId) {
    this.state.import_batch_id = batchId;
    this.state.page = 1;
    this.fetchStudents();
  },

  blastCurrentBatch(batchId, batchName) {
    const bId = batchId || this.state.import_batch_id;
    if (!bId) return;
    app.navigate('composer', {
      target_type: 'import_batch',
      target_batch_id: bId,
      target_batch_name: batchName || 'Bulk Upload Batch'
    });
  },

  async deleteCurrentBatch(batchId, batchName, count) {
    const bId = batchId || this.state.import_batch_id;
    if (!bId) return;

    const displayName = batchName || 'this upload spreadsheet';
    const numText = count ? `${count} ` : '';

    if (!confirm(`⚠️ DANGER: Are you sure you want to permanently delete all ${numText}student candidates imported from "${displayName}"?\n\nThis will remove all candidate data from this bulk upload. This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await api.deleteUploadBatch(bId);
      app.showToast(res.message || `Deleted bulk upload batch "${displayName}"`, 'success');
      this.state.import_batch_id = '';
      this.state.selectedIds.clear();
      this.fetchStudents();
    } catch (error) {
      app.showToast('Failed to delete bulk upload batch: ' + error.message, 'error');
    }
  },

  renderTable() {
    const wrapper = document.getElementById('studentsTableWrapper');
    if (!wrapper) return;

    if (this.state.students.length === 0) {
      const isFiltered = !!(this.state.search || this.state.college || this.state.batch || this.state.import_batch_id);
      wrapper.innerHTML = `
        <div style="text-align: center; padding: 48px 24px; color: var(--text-muted);">
          <div style="font-size: 2.8rem; margin-bottom: 12px;">🎓</div>
          <h3 style="color: var(--text-primary); margin-bottom: 6px;">${isFiltered ? 'No Candidates Match Your Filters' : 'Your Candidate Pool is Empty'}</h3>
          <p style="max-width: 480px; margin: 0 auto 16px auto; font-size: 0.85rem;">
            ${isFiltered ? 'Try clearing your search query or college filters.' : 'You have not added any candidates yet. Get started by importing a college Excel/CSV sheet or adding candidates manually.'}
          </p>
          ${isFiltered ? `
            <button class="btn btn-secondary btn-sm" onclick="StudentsView.resetFilters()">Clear Filters</button>
          ` : `
            <div style="display: flex; gap: 10px; justify-content: center;">
              <button class="btn btn-primary btn-sm" onclick="app.navigate('import')">
                📁 Upload Excel / CSV
              </button>
              <button class="btn btn-secondary btn-sm" onclick="StudentsView.openAddModal()">
                + Add Candidate Manually
              </button>
            </div>
          `}
        </div>
      `;
      return;
    }

    const allSelectedOnPage = this.state.students.length > 0 && this.state.students.every(s => this.state.selectedIds.has(String(s.id)));

    wrapper.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 40px;">
              <input type="checkbox" class="table-checkbox" id="selectAllCheckbox" ${allSelectedOnPage ? 'checked' : ''} onchange="StudentsView.toggleSelectAll(this.checked)" />
            </th>
            <th>Candidate Name</th>
            <th>Email Address</th>
            <th>College / Institute</th>
            <th>Phone</th>
            <th>Branch / Stream</th>
            <th>Batch</th>
            <th>Status</th>
            <th style="text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${this.state.students.map(s => {
            const sid = String(s.id);
            const isSelected = this.state.selectedIds.has(sid);
            const safeName = (s.name || '').replace(/'/g, "\\'");
            return `
              <tr style="${isSelected ? 'background: #eff6ff;' : ''}">
                <td>
                  <input type="checkbox" class="table-checkbox" ${isSelected ? 'checked' : ''} onchange="StudentsView.toggleSelectOne('${sid}', this.checked)" />
                </td>
                <td>
                  <div style="font-weight: 600; color: var(--text-primary);">${s.name}</div>
                  <div style="font-size: 0.74rem; color: var(--text-muted);">ID: #${s.id}</div>
                </td>
                <td>
                  <span style="font-family: var(--font-mono); font-size: 0.82rem; color: var(--brand-sapphire);">${s.email}</span>
                </td>
                <td><strong>${s.college}</strong></td>
                <td style="color: var(--text-muted);">${s.phone || '&mdash;'}</td>
                <td>${s.branch || 'Computer Science'}</td>
                <td><span class="badge" style="background:#f1f5f9; font-weight:600;">${s.batch || '2026'}</span></td>
                <td><span class="badge badge-${(s.status || 'Active').toLowerCase()}">${s.status || 'Active'}</span></td>
                <td style="text-align: right;">
                  <div class="table-actions" style="justify-content: flex-end;">
                    <button class="btn btn-secondary btn-icon" title="Edit Student" onclick="StudentsView.openEditModal('${sid}')">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button class="btn btn-ghost btn-icon" style="color: var(--color-danger);" title="Delete Student" onclick="StudentsView.deleteStudent('${sid}', '${safeName}')">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <!-- Pagination -->
      <div class="pagination-bar">
        <div>
          Showing ${(this.state.page - 1) * this.state.limit + 1} &ndash; ${Math.min(this.state.total, this.state.page * this.state.limit)} of ${this.state.total} candidates
        </div>
        <div class="pagination-controls">
          <button class="btn btn-secondary btn-sm" ${this.state.page <= 1 ? 'disabled' : ''} onclick="StudentsView.goToPage(${this.state.page - 1})">&larr; Prev</button>
          <span style="font-weight: 600; padding: 0 8px;">Page ${this.state.page} / ${this.state.totalPages}</span>
          <button class="btn btn-secondary btn-sm" ${this.state.page >= this.state.totalPages ? 'disabled' : ''} onclick="StudentsView.goToPage(${this.state.page + 1})">Next &rarr;</button>
        </div>
      </div>
    `;

    this.updateBulkActionBar();
  },

  handleSearch: debounce(function(val) {
    StudentsView.state.search = val;
    StudentsView.state.page = 1;
    StudentsView.fetchStudents();
  }, 300),

  handleFilterCollege(val) {
    this.state.college = val;
    this.state.page = 1;
    this.fetchStudents();
  },

  handleFilterBatch(val) {
    this.state.batch = val;
    this.state.page = 1;
    this.fetchStudents();
  },

  resetFilters() {
    this.state.search = '';
    this.state.college = '';
    this.state.batch = '';
    this.state.import_batch_id = '';
    this.state.page = 1;
    const sInput = document.getElementById('studentSearchInput');
    if (sInput) sInput.value = '';
    const cSelect = document.getElementById('filterCollege');
    if (cSelect) cSelect.value = '';
    const bSelect = document.getElementById('filterBatch');
    if (bSelect) bSelect.value = '';
    const uSelect = document.getElementById('filterUploadBatch');
    if (uSelect) uSelect.value = '';
    this.fetchStudents();
  },

  goToPage(page) {
    this.state.page = page;
    this.fetchStudents();
  },

  toggleSelectAll(checked) {
    this.state.students.forEach(s => {
      const sid = String(s.id);
      if (checked) {
        this.state.selectedIds.add(sid);
      } else {
        this.state.selectedIds.delete(sid);
      }
    });
    this.renderTable();
  },

  toggleSelectOne(id, checked) {
    const sid = String(id);
    if (checked) {
      this.state.selectedIds.add(sid);
    } else {
      this.state.selectedIds.delete(sid);
    }
    this.renderTable();
  },

  updateBulkActionBar() {
    const bar = document.getElementById('bulkActionsBar');
    const text = document.getElementById('selectedCountText');
    if (!bar || !text) return;

    const count = this.state.selectedIds.size;
    if (count > 0) {
      bar.style.display = 'flex';
      text.textContent = `${count} candidate${count > 1 ? 's' : ''} selected`;
    } else {
      bar.style.display = 'none';
    }
  },

  blastToSelected() {
    if (this.state.selectedIds.size === 0) return;
    const ids = Array.from(this.state.selectedIds);
    app.navigate('composer', { targetType: 'selected', selectedIds: ids });
  },

  async bulkDelete() {
    const count = this.state.selectedIds.size;
    if (!confirm(`Are you sure you want to delete ${count} selected student(s)?`)) return;

    try {
      const ids = Array.from(this.state.selectedIds);
      const res = await api.bulkDeleteStudents(ids);
      app.showToast(res.message || `Deleted ${count} students`, 'success');
      this.state.selectedIds.clear();
      this.fetchStudents();
    } catch (error) {
      app.showToast('Bulk delete failed: ' + error.message, 'error');
    }
  },

  async deleteStudent(id, name) {
    if (!confirm(`Delete student record for "${name}"?`)) return;
    try {
      await api.deleteStudent(id);
      app.showToast(`Deleted ${name}`, 'success');
      this.state.selectedIds.delete(String(id));
      this.fetchStudents();
    } catch (error) {
      app.showToast('Failed to delete student: ' + error.message, 'error');
    }
  },

  openAddModal() {
    app.openModal(`
      <div class="modal-header">
        <h3 class="modal-title">Add New Student Candidate</h3>
        <button class="modal-close" onclick="app.closeModal()">&times;</button>
      </div>
      <form id="addStudentForm" onsubmit="StudentsView.submitAdd(event)">
        <div class="form-group">
          <label class="form-label">Full Name *</label>
          <input type="text" name="name" class="form-input" placeholder="e.g. Rahul Sharma" required />
        </div>
        <div class="form-group">
          <label class="form-label">Email Address *</label>
          <input type="email" name="email" class="form-input" placeholder="e.g. rahul.sharma@iitb.ac.in" required />
        </div>
        <div class="form-group">
          <label class="form-label">College / University (Optional)</label>
          <input type="text" name="college" class="form-input" placeholder="e.g. IIT Bombay (Optional)" />
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Phone Number</label>
            <input type="tel" name="phone" class="form-input" placeholder="+91 9876543210" />
          </div>
          <div class="form-group">
            <label class="form-label">Graduation Batch</label>
            <select name="batch" class="form-select">
              <option value="2026" selected>2026</option>
              <option value="2025">2025</option>
              <option value="2027">2027</option>
              <option value="2024">2024</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Branch / Specialization</label>
          <input type="text" name="branch" class="form-input" placeholder="Computer Science & Engineering" value="Computer Science & Engineering" />
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px;">
          <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Student</button>
        </div>
      </form>
    `);
  },

  async submitAdd(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const payload = Object.fromEntries(formData.entries());

    try {
      const res = await api.createStudent(payload);
      app.showToast(res.message || 'Student added successfully!', 'success');
      app.closeModal();
      this.fetchStudents();
    } catch (error) {
      app.showToast('Failed to add student: ' + error.message, 'error');
    }
  },

  async openEditModal(id) {
    try {
      const data = await api.getStudent(id);
      const s = data.student;

      app.openModal(`
        <div class="modal-header">
          <h3 class="modal-title">Edit Student Profile (#${s.id})</h3>
          <button class="modal-close" onclick="app.closeModal()">&times;</button>
        </div>
        <form id="editStudentForm" onsubmit="StudentsView.submitEdit(event, '${s.id}')">
          <div class="form-group">
            <label class="form-label">Full Name *</label>
            <input type="text" name="name" class="form-input" value="${s.name}" required />
          </div>
          <div class="form-group">
            <label class="form-label">Email Address *</label>
            <input type="email" name="email" class="form-input" value="${s.email}" required />
          </div>
          <div class="form-group">
            <label class="form-label">College / University *</label>
            <input type="text" name="college" class="form-input" value="${s.college}" required />
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
              <label class="form-label">Phone Number</label>
              <input type="tel" name="phone" class="form-input" value="${s.phone || ''}" />
            </div>
            <div class="form-group">
              <label class="form-label">Graduation Batch</label>
              <select name="batch" class="form-select">
                <option value="2026" ${s.batch === '2026' ? 'selected' : ''}>2026</option>
                <option value="2025" ${s.batch === '2025' ? 'selected' : ''}>2025</option>
                <option value="2027" ${s.batch === '2027' ? 'selected' : ''}>2027</option>
                <option value="2024" ${s.batch === '2024' ? 'selected' : ''}>2024</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Branch / Specialization</label>
            <input type="text" name="branch" class="form-input" value="${s.branch || ''}" />
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select name="status" class="form-select">
              <option value="Active" ${s.status === 'Active' ? 'selected' : ''}>Active</option>
              <option value="Placed" ${s.status === 'Placed' ? 'selected' : ''}>Placed</option>
              <option value="Unsubscribed" ${s.status === 'Unsubscribed' ? 'selected' : ''}>Unsubscribed</option>
            </select>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px;">
            <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Update Profile</button>
          </div>
        </form>
      `);
    } catch (error) {
      app.showToast('Failed to fetch student details: ' + error.message, 'error');
    }
  },

  async submitEdit(event, id) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const payload = Object.fromEntries(formData.entries());

    try {
      const res = await api.updateStudent(id, payload);
      app.showToast(res.message || 'Student updated successfully!', 'success');
      app.closeModal();
      this.fetchStudents();
    } catch (error) {
      app.showToast('Failed to update student: ' + error.message, 'error');
    }
  },

  openExportModal() {
    const hasSelected = this.state.selectedIds.size > 0;
    const selectedCount = this.state.selectedIds.size;
    const totalCount = this.state.total;

    app.openModal(`
      <div class="modal-header">
        <h3 class="modal-title">Export Student Candidate Data</h3>
        <button class="modal-close" onclick="app.closeModal()">&times;</button>
      </div>
      <div>
        <p style="color: var(--text-muted); font-size: 0.88rem; margin-bottom: 18px;">
          Choose the export scope and whether you want only Name &amp; Email or full student profiles.
        </p>

        <div class="form-group">
          <label class="form-label">Data Fields to Include:</label>
          <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 4px;">
            <label style="display: flex; align-items: flex-start; gap: 10px; padding: 12px; border: 2px solid var(--brand-sapphire); background: #eff6ff; border-radius: var(--radius-sm); cursor: pointer;">
              <input type="radio" name="exportFieldsRadio" value="name_email" checked style="margin-top: 3px;" />
              <div>
                <strong style="color: var(--text-primary); font-size: 0.9rem;">⭐ Only Name &amp; Email Address (Recommended)</strong>
                <p style="color: var(--text-secondary); font-size: 0.78rem; margin-top: 2px;">
                  Produces a clean 2-column list (<code>Name</code>, <code>Email</code>) &mdash; ideal for importing into mailing tools or CRM platforms.
                </p>
              </div>
            </label>

            <label style="display: flex; align-items: flex-start; gap: 10px; padding: 12px; border: 1px solid var(--border-medium); border-radius: var(--radius-sm); cursor: pointer;">
              <input type="radio" name="exportFieldsRadio" value="all" style="margin-top: 3px;" />
              <div>
                <strong style="color: var(--text-primary); font-size: 0.9rem;">Complete Candidate Profile</strong>
                <p style="color: var(--text-secondary); font-size: 0.78rem; margin-top: 2px;">
                  Includes Name, Email, College, Phone Number, Branch, Batch Year, Status, and Registered Date.
                </p>
              </div>
            </label>
          </div>
        </div>

        <div class="form-group" style="margin-top: 16px;">
          <label class="form-label">Export Scope:</label>
          <div style="display: flex; gap: 14px; margin-top: 4px;">
            <label style="display: flex; align-items: center; gap: 6px; font-size: 0.86rem; cursor: pointer;">
              <input type="radio" name="exportScopeRadio" value="filtered" checked />
              <span>All Matching Candidates (${totalCount})</span>
            </label>
            ${hasSelected ? `
              <label style="display: flex; align-items: center; gap: 6px; font-size: 0.86rem; cursor: pointer;">
                <input type="radio" name="exportScopeRadio" value="selected" />
                <span>Only Selected Candidates (${selectedCount})</span>
              </label>
            ` : ''}
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 28px;">
          <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
          <button type="button" class="btn btn-primary" onclick="StudentsView.submitExportModal('csv')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            <span>Export CSV</span>
          </button>
          <button type="button" class="btn btn-secondary" onclick="StudentsView.submitExportModal('xlsx')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            <span>Export Excel</span>
          </button>
        </div>
      </div>
    `);
  },

  submitExportModal(format) {
    const fieldsRadio = document.querySelector('input[name="exportFieldsRadio"]:checked');
    const scopeRadio = document.querySelector('input[name="exportScopeRadio"]:checked');

    const fields = fieldsRadio ? fieldsRadio.value : 'name_email';
    const useSelected = scopeRadio && scopeRadio.value === 'selected';

    app.closeModal();
    this.exportData(format, fields, useSelected);
  },

  exportData(format = 'csv', fields = 'name_email', useSelected = false) {
    const params = new URLSearchParams({
      format,
      fields,
      search: this.state.search,
      college: this.state.college,
      batch: this.state.batch
    });

    if (useSelected && this.state.selectedIds.size > 0) {
      params.set('ids', Array.from(this.state.selectedIds).join(','));
    }

    window.location.href = `/api/students/export?${params.toString()}`;
    app.showToast(`Exporting ${fields === 'name_email' ? 'Name & Email' : 'Student Profiles'} (${format.toUpperCase()})...`, 'info');
  }
};

// Utility debounce helper
function debounce(fn, delay) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
