/**
 * Bulk Import Wizard View
 * Upload CSV/Excel spreadsheets, auto-detect column mapping, interactive data preview, validation, and batch commit
 */
const ImportView = {
  state: {
    file: null,
    filename: '',
    headers: [],
    mapping: {
      name: '',
      email: '',
      college: '',
      phone: '',
      branch: '',
      batch: ''
    },
    rawRows: [],
    previewRows: [],
    validCount: 0,
    invalidCount: 0,
    totalRows: 0,
    duplicateStrategy: 'skip',
    step: 1 // 1: Upload, 2: Map & Preview, 3: Success Summary
  },

  render(container) {
    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Bulk Student Upload Wizard</h1>
          <p>Import candidate lists from Excel (.xlsx, .xls) or CSV with column mapping and live data validation</p>
        </div>
        <div class="header-actions">
          <a href="/api/upload/sample-csv" class="btn btn-secondary btn-sm" download>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            <span>Download Sample CSV</span>
          </a>
          <a href="/api/upload/sample-excel" class="btn btn-secondary btn-sm" download>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            <span>Download Sample Excel</span>
          </a>
        </div>
      </div>

      <div id="importWizardStepContainer">
        ${this.renderStep1()}
      </div>
    `;
  },

  renderStep1() {
    return `
      <div class="card" style="max-width: 800px; margin: 0 auto; text-align: center;">
        <div class="dropzone-container" id="fileDropzone" onclick="document.getElementById('spreadsheetFileInput').click()" ondragover="ImportView.handleDragOver(event)" ondragleave="ImportView.handleDragLeave(event)" ondrop="ImportView.handleDrop(event)">
          <input type="file" id="spreadsheetFileInput" accept=".csv, .xlsx, .xls" style="display: none;" onchange="ImportView.handleFileSelect(event)" />
          <svg class="dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          <h3 style="font-size: 1.15rem; font-weight: 700; margin-bottom: 6px; color: var(--text-primary);">Drag and drop your spreadsheet here</h3>
          <p style="color: var(--text-muted); font-size: 0.88rem; margin-bottom: 16px;">Supports Microsoft Excel (.xlsx, .xls) and Comma-Separated Values (.csv)</p>
          <button type="button" class="btn btn-primary btn-sm">Browse Files from Computer</button>
        </div>

        <div style="margin-top: 28px; text-align: left; background: #f8fafc; padding: 20px; border-radius: var(--radius-sm); border: 1px solid var(--border-light);">
          <h4 style="font-size: 0.88rem; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">Supported Column Headers:</h4>
          <ul style="margin: 0; padding-left: 20px; font-size: 0.84rem; color: var(--text-secondary); line-height: 1.8;">
            <li><strong>Student Name / Full Name</strong> &mdash; <span style="color: var(--brand-sapphire); font-weight: 700;">Required</span></li>
            <li><strong>Email ID / Email Address</strong> &mdash; <span style="color: var(--brand-sapphire); font-weight: 700;">Required (Must be valid email format)</span></li>
            <li><strong>College Name / Institute</strong> &mdash; <span style="color: var(--text-muted);">Optional (Defaults to 'General Pool')</span></li>
            <li><strong>Phone Number / Mobile</strong> &mdash; <span style="color: var(--text-muted);">Optional</span></li>
            <li><strong>Branch / Degree</strong> &mdash; <span style="color: var(--text-muted);">Optional (Defaults to 'Computer Science')</span></li>
            <li><strong>Graduation Year / Batch</strong> &mdash; <span style="color: var(--text-muted);">Optional (Defaults to '2026')</span></li>
          </ul>
        </div>
      </div>
    `;
  },

  handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  },

  handleDragLeave(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
  },

  handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      this.processFile(e.dataTransfer.files[0]);
    }
  },

  handleFileSelect(e) {
    if (e.target.files && e.target.files.length > 0) {
      this.processFile(e.target.files[0]);
    }
  },

  async processFile(file) {
    this.state.file = file;
    this.state.filename = file.name;

    const container = document.getElementById('importWizardStepContainer');
    container.innerHTML = `
      <div class="view-loading">
        <div class="spinner"></div>
        <p>Parsing spreadsheet and detecting columns...</p>
      </div>
    `;

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await api.parseSpreadsheet(formData);

      this.state.headers = res.headers || [];
      this.state.mapping = res.detectedMapping || {};
      this.state.rawRows = res.allRows || [];
      this.state.previewRows = res.previewRows || [];
      this.state.validCount = res.validCount || 0;
      this.state.invalidCount = res.invalidCount || 0;
      this.state.totalRows = res.totalRows || 0;

      this.renderStep2();
    } catch (error) {
      app.showToast('Failed to parse file: ' + error.message, 'error');
      container.innerHTML = this.renderStep1();
    }
  },

  renderStep2() {
    const container = document.getElementById('importWizardStepContainer');
    if (!container) return;

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; background: #ffffff; padding: 16px 20px; border-radius: var(--radius-md); border: 1px solid var(--border-light);">
        <div>
          <span style="font-weight: 700; color: var(--text-primary); font-size: 1.05rem;">📄 ${this.state.filename}</span>
          <span style="margin-left: 12px; color: var(--text-muted); font-size: 0.85rem;">(${this.state.totalRows} total rows)</span>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="ImportView.render(document.getElementById('viewContainer'))">Upload Different File</button>
      </div>

      <!-- Column Mapping Card -->
      <div class="card" style="margin-bottom: 24px;">
        <div class="card-header">
          <div>
            <h3 class="card-title">1. Verify Column Mapping</h3>
            <p style="color: var(--text-muted); font-size: 0.82rem; margin-top: 2px;">Only <strong>Student Name</strong> and <strong>Email Address</strong> are required to import.</p>
          </div>
          <span class="badge badge-active">Auto-Detected</span>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
          ${this.renderMappingDropdown('name', 'Student Name * (Required)', true)}
          ${this.renderMappingDropdown('email', 'Email Address * (Required)', true)}
          ${this.renderMappingDropdown('college', 'College / Institute (Optional)', false)}
          ${this.renderMappingDropdown('phone', 'Phone Number (Optional)', false)}
          ${this.renderMappingDropdown('branch', 'Branch / Stream (Optional)', false)}
          ${this.renderMappingDropdown('batch', 'Batch / Year (Optional)', false)}
        </div>
      </div>

      <!-- Validation & Data Preview Card -->
      <div class="card" style="margin-bottom: 24px;">
        <div class="card-header">
          <div>
            <h3 class="card-title">2. Data Validation Preview</h3>
            <p style="color: var(--text-muted); font-size: 0.82rem; margin-top: 2px;">
              ${this.state.totalRows > 100 ? `Showing first 100 rows of ${this.state.totalRows}. ` : ''}All <strong>${this.state.validCount} valid students</strong> will be saved together in bulk.
            </p>
          </div>
          <div style="display: flex; gap: 10px; align-items: center;">
            <span class="badge badge-sent" style="font-size: 0.8rem; padding: 5px 12px;">✅ ${this.state.validCount} Valid &amp; Ready</span>
            ${this.state.invalidCount > 0 ? `<span class="badge badge-failed" style="font-size: 0.8rem; padding: 5px 12px;">⚠️ ${this.state.invalidCount} Invalid</span>` : ''}
          </div>
        </div>

        <div class="table-container" style="max-height: 400px; overflow-y: auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 50px;">Row</th>
                <th>Validation</th>
                <th>Candidate Name</th>
                <th>Email Address</th>
                <th>College</th>
                <th>Phone</th>
                <th>Branch</th>
                <th>Batch</th>
              </tr>
            </thead>
            <tbody>
              ${this.state.previewRows.map(row => {
                const norm = row.normalized;
                return `
                  <tr style="${!row.isValid ? 'background: #fef2f2;' : ''}">
                    <td style="color: var(--text-muted); font-weight: 600;">#${row.rowNumber}</td>
                    <td>
                      ${row.isValid 
                        ? '<span class="badge badge-sent">Valid</span>'
                        : `<span class="badge badge-failed" title="${row.errors.join(', ')}">Errors (${row.errors.length})</span>`
                      }
                    </td>
                    <td><strong>${norm.name}</strong></td>
                    <td style="font-family: var(--font-mono); font-size: 0.82rem;">${norm.email || '<span style="color:red;">[Empty]</span>'}</td>
                    <td>${norm.college || '<span style="color:var(--text-muted);">General Pool</span>'}</td>
                    <td>${norm.phone || '&mdash;'}</td>
                    <td>${norm.branch}</td>
                    <td>${norm.batch}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Commit Strategy & Launch Card -->
      <div class="card" style="background: #f8fafc; border: 1px solid var(--border-light);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px;">
          <div>
            <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 8px; color: var(--text-primary);">Duplicate Handling Strategy:</h4>
            <div style="display: flex; gap: 16px; flex-wrap: wrap;">
              <label style="display: flex; align-items: center; gap: 6px; font-size: 0.86rem; cursor: pointer;">
                <input type="radio" name="dupStrategy" value="skip" checked onchange="ImportView.state.duplicateStrategy = this.value" />
                <span><strong>Skip duplicates</strong> (Keep existing candidate profile)</span>
              </label>
              <label style="display: flex; align-items: center; gap: 6px; font-size: 0.86rem; cursor: pointer;">
                <input type="radio" name="dupStrategy" value="update" onchange="ImportView.state.duplicateStrategy = this.value" />
                <span><strong>Update existing</strong> (Refresh college, phone, branch)</span>
              </label>
            </div>
          </div>

          <button class="btn btn-primary btn-lg" onclick="ImportView.commitImport()" ${this.state.validCount === 0 ? 'disabled' : ''}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>Save All ${this.state.validCount} Students to Database</span>
          </button>
        </div>
      </div>
    `;
  },

  renderMappingDropdown(fieldKey, labelText, isRequired) {
    const selected = this.state.mapping[fieldKey] || '';
    return `
      <div class="form-group">
        <label class="form-label">${labelText}</label>
        <select class="form-select" onchange="ImportView.updateMapping('${fieldKey}', this.value)">
          <option value="">-- Do Not Map --</option>
          ${this.state.headers.map(h => `
            <option value="${h}" ${selected === h ? 'selected' : ''}>${h}</option>
          `).join('')}
        </select>
      </div>
    `;
  },

  async updateMapping(fieldKey, selectedHeader) {
    this.state.mapping[fieldKey] = selectedHeader;

    try {
      const res = await api.revalidateSpreadsheet(this.state.rawRows, this.state.mapping);
      this.state.validCount = res.validCount;
      this.state.invalidCount = res.invalidCount;
      this.state.previewRows = res.previewRows;
      this.renderStep2();
    } catch (error) {
      app.showToast('Revalidation error: ' + error.message, 'error');
    }
  },

  async commitImport() {
    const container = document.getElementById('importWizardStepContainer');
    const validCount = this.state.validCount;

    if (container) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 48px; max-width: 650px; margin: 0 auto;">
          <div class="spinner" style="margin: 0 auto 20px auto; width: 44px; height: 44px;"></div>
          <h2 style="font-family: var(--font-heading); color: var(--text-primary); margin-bottom: 8px;">Saving Data in Bulk...</h2>
          <p style="color: var(--text-secondary); font-size: 0.95rem;">Saving all <strong>${validCount} candidate records</strong> together in bulk to database...</p>
        </div>
      `;
    }

    try {
      const res = await api.commitSpreadsheet(this.state.rawRows, this.state.mapping, this.state.duplicateStrategy, this.state.filename);

      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 48px; max-width: 680px; margin: 0 auto;">
          <div style="width: 64px; height: 64px; border-radius: 50%; background: var(--color-success-bg); color: var(--color-success); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </div>
          <h2 style="font-family: var(--font-heading); color: var(--text-primary); margin-bottom: 8px;">Bulk Import Successfully Completed!</h2>
          <p style="color: var(--text-secondary); font-size: 0.95rem; margin-bottom: 24px;">${res.message}</p>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 32px; background: #f8fafc; padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-light);">
            <div>
              <div style="font-size: 1.3rem; font-weight: 700; color: var(--color-success);">${res.summary.inserted}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">New Students Added</div>
            </div>
            <div>
              <div style="font-size: 1.3rem; font-weight: 700; color: var(--brand-sapphire);">${res.summary.updated}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Updated</div>
            </div>
            <div>
              <div style="font-size: 1.3rem; font-weight: 700; color: var(--text-muted);">${res.summary.skipped}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Skipped Duplicates</div>
            </div>
          </div>

          <div style="display: flex; justify-content: center; gap: 12px; flex-wrap: wrap;">
            <button class="btn btn-primary btn-lg" onclick="app.navigate('composer', { target_type: 'import_batch', target_batch_id: '${res.batchId}', target_batch_name: '${(this.state.filename || 'Bulk Upload').replace(/'/g, "\\'")}' })">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
              <span>Blast to This Bulk Upload (${res.summary.inserted + res.summary.updated} Candidates)</span>
            </button>
            <button class="btn btn-secondary" onclick="app.navigate('students', { import_batch_id: '${res.batchId}' })">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
              <span>View in Student Pool</span>
            </button>
            <button class="btn btn-secondary" onclick="ImportView.render(document.getElementById('viewContainer'))">
              <span>Upload Another File</span>
            </button>
          </div>
        </div>
      `;

      app.showToast('Bulk import completed successfully!', 'success');
    } catch (error) {
      app.showToast('Import failed: ' + error.message, 'error');
      this.renderStep2();
    }
  }
};
