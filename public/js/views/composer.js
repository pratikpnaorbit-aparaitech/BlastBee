const ComposerView = {
  state: {
    templates: [],
    students: [],
    colleges: [],
    uploadBatches: [],
    selectedTemplateId: null,
    selectedPreviewStudentId: null,
    targetType: 'all', // 'all', 'college', 'batch', 'selected', 'import_batch'
    selectedColleges: [],
    selectedBatches: [],
    selectedStudentIds: [],
    targetBatchId: '',
    targetBatchName: '',
    lastFocusedField: 'subject', // 'subject' or 'body'
    campaignTitle: 'Aparaitech Campus Placement Outreach 2026',
    applyLink: 'https://aparaitech.org/apply',
    subject: 'Campus Placement Drive 2026: Career Opportunity for {Name} from {College}',
    bodyHtml: ''
  },

  async render(container, routeParams = {}) {
    container.innerHTML = `
      <div class="view-loading">
        <div class="spinner"></div>
        <p>Loading Email Composer Studio...</p>
      </div>
    `;

    try {
      const [tplData, stdData, colData, batchData] = await Promise.all([
        api.getTemplates(),
        api.getStudents({ limit: 50 }),
        api.getColleges(),
        api.getUploadBatches()
      ]);

      this.state.templates = tplData.templates || [];
      this.state.students = stdData.students || [];
      this.state.colleges = colData.colleges || [];
      this.state.uploadBatches = batchData.batches || [];

      if (this.state.students.length > 0 && !this.state.selectedPreviewStudentId) {
        this.state.selectedPreviewStudentId = this.state.students[0].id;
      }

      // If routed with preselected student IDs from the Student Pool table
      if (routeParams && routeParams.selectedIds && routeParams.selectedIds.length > 0) {
        this.state.targetType = 'selected';
        this.state.selectedStudentIds = routeParams.selectedIds;
      }

      // If routed with a specific bulk upload batch
      if (routeParams && (routeParams.target_type === 'import_batch' || routeParams.target_batch_id)) {
        this.state.targetType = 'import_batch';
        this.state.targetBatchId = routeParams.target_batch_id;
        this.state.targetBatchName = routeParams.target_batch_name || '';
      }

      // If routed with a specific template ID
      if (routeParams && routeParams.template_id) {
        const routedTpl = this.state.templates.find(t => t.id == routeParams.template_id);
        if (routedTpl) {
          this.state.selectedTemplateId = routedTpl.id;
          this.state.subject = routedTpl.subject;
          this.state.bodyHtml = routedTpl.body_html;
        }
      }

      // Default to flagship placement drive template if body is empty
      if (!this.state.bodyHtml && this.state.templates.length > 0) {
        const flagship = this.state.templates.find(t => t.name.includes('Campus Placement Drive 2026')) || this.state.templates[0];
        this.state.selectedTemplateId = flagship.id;
        this.state.subject = flagship.subject;
        this.state.bodyHtml = flagship.body_html;
      }

      this.renderComposerUI(container);
      this.updateLivePreview();
      this.checkDnsHealth();
      this.runAntiSpamCheck();
    } catch (error) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 48px;">
          <h3 style="color: var(--color-danger);">Failed to load composer</h3>
          <p style="color: var(--text-muted);">${error.message}</p>
        </div>
      `;
    }
  },

  renderComposerUI(container) {
    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <h1>Email Blast Composer &amp; Personalization Studio</h1>
          <p>Design personalized campus emails with dynamic tags &bull; Real-time rendering preview</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-secondary btn-sm" onclick="ComposerView.openSaveTemplateModal()" title="Save current email subject and body as a template">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
            <span>💾 Save as Template</span>
          </button>
          <button class="btn btn-secondary btn-sm" onclick="ComposerView.openTestEmailModal()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
            <span>Send Test Email</span>
          </button>
          <button class="btn btn-primary btn-sm" onclick="ComposerView.openLaunchModal()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
            <span>Launch Email Blast &rarr;</span>
          </button>
        </div>
      </div>

      <!-- Main Dual Split Layout -->
      <div class="composer-split">
        <!-- Left Column: Form & Editor -->
        <div class="composer-left">
          <!-- Campaign Settings Card -->
          <div class="card" style="margin-bottom: 20px;">
            <div class="form-group">
              <label class="form-label">Internal Campaign Title</label>
              <input type="text" id="campaignTitleInput" class="form-input" value="${this.state.campaignTitle}" oninput="ComposerView.state.campaignTitle = this.value" placeholder="e.g. Campus Placement Drive 2026 - Phase 1" />
            </div>

            <!-- Audience Filter Selectors -->
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Target Audience</label>
              <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 10px;">
                <label style="display: flex; align-items: center; gap: 6px; font-size: 0.86rem; cursor: pointer;">
                  <input type="radio" name="targetTypeRadio" value="all" ${this.state.targetType === 'all' ? 'checked' : ''} onchange="ComposerView.handleTargetTypeChange(this.value)" />
                  <span>All Active Students (${this.state.students.length}+)</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 0.86rem; cursor: pointer;">
                  <input type="radio" name="targetTypeRadio" value="college" ${this.state.targetType === 'college' ? 'checked' : ''} onchange="ComposerView.handleTargetTypeChange(this.value)" />
                  <span>Filter by College</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 0.86rem; cursor: pointer;">
                  <input type="radio" name="targetTypeRadio" value="batch" ${this.state.targetType === 'batch' ? 'checked' : ''} onchange="ComposerView.handleTargetTypeChange(this.value)" />
                  <span>Filter by Batch Year</span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 0.86rem; cursor: pointer;">
                  <input type="radio" name="targetTypeRadio" value="import_batch" ${this.state.targetType === 'import_batch' ? 'checked' : ''} onchange="ComposerView.handleTargetTypeChange(this.value)" />
                  <span>Filter by Bulk Upload Spreadsheet</span>
                </label>
                ${this.state.selectedStudentIds.length > 0 ? `
                  <label style="display: flex; align-items: center; gap: 6px; font-size: 0.86rem; cursor: pointer;">
                    <input type="radio" name="targetTypeRadio" value="selected" ${this.state.targetType === 'selected' ? 'checked' : ''} onchange="ComposerView.handleTargetTypeChange(this.value)" />
                    <span>Selected Students (${this.state.selectedStudentIds.length})</span>
                  </label>
                ` : ''}
              </div>

              <!-- Upload Batch Container -->
              <div id="targetUploadBatchContainer" style="display: ${this.state.targetType === 'import_batch' ? 'block' : 'none'}; margin-top: 10px; background: #f8fafc; padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-light);">
                <label class="form-label" style="font-size: 0.84rem; margin-bottom: 6px;">Select Bulk Upload Spreadsheet:</label>
                <select class="form-select" id="targetUploadBatchSelect" onchange="ComposerView.handleUploadBatchSelect(this.value)">
                  <option value="">-- Choose Bulk Upload Batch --</option>
                  ${this.state.uploadBatches.map(b => `
                    <option value="${b.import_batch_id}" ${this.state.targetBatchId === b.import_batch_id ? 'selected' : ''}>
                      📁 ${b.import_source} (${b.student_count} students) &bull; ${new Date(b.created_at).toLocaleDateString()}
                    </option>
                  `).join('')}
                </select>
              </div>

              <!-- Colleges Multi-select Checkboxes -->
              <div id="targetCollegesContainer" style="display: ${this.state.targetType === 'college' ? 'flex' : 'none'}; flex-wrap: wrap; gap: 8px; max-height: 140px; overflow-y: auto; padding: 8px; background: #f8fafc; border-radius: var(--radius-sm); border: 1px solid var(--border-light); margin-top: 10px;">
                ${this.state.colleges.map(col => `
                  <label style="display: flex; align-items: center; gap: 6px; font-size: 0.82rem; background: #ffffff; padding: 4px 10px; border: 1px solid #e2e8f0; border-radius: 20px; cursor: pointer;">
                    <input type="checkbox" value="${col.college}" ${this.state.selectedColleges.includes(col.college) ? 'checked' : ''} onchange="ComposerView.toggleTargetCollege('${col.college.replace(/'/g, "\\'")}', this.checked)" />
                    <span>${col.college} (${col.count})</span>
                  </label>
                `).join('')}
              </div>

              <!-- Batch Year Multi-select Checkboxes -->
              <div id="targetBatchesContainer" style="display: ${this.state.targetType === 'batch' ? 'flex' : 'none'}; flex-wrap: wrap; gap: 8px; padding: 8px; background: #f8fafc; border-radius: var(--radius-sm); border: 1px solid var(--border-light); margin-top: 10px;">
                ${['2024', '2025', '2026', '2027'].map(year => `
                  <label style="display: flex; align-items: center; gap: 6px; font-size: 0.84rem; background: #ffffff; padding: 6px 14px; border: 1px solid #e2e8f0; border-radius: 20px; cursor: pointer;">
                    <input type="checkbox" value="${year}" ${this.state.selectedBatches.includes(year) ? 'checked' : ''} onchange="ComposerView.toggleTargetBatch('${year}', this.checked)" />
                    <span>Batch of ${year}</span>
                  </label>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Sample Template Preset Selector Card -->
          <div class="card" style="margin-bottom: 20px; background: linear-gradient(to right, #f8fafc, #eff6ff); border: 1.5px solid #bfdbfe;">
            <div class="form-group" style="margin-bottom: 0;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 1.25rem;">📋</span>
                  <div>
                    <label class="form-label" style="margin-bottom: 0; font-weight: 700; color: #1e3a8a; font-size: 0.92rem;">
                      Sample Recruitment Email Templates
                    </label>
                    <span style="font-size: 0.74rem; color: #64748b;">
                      Pre-formatted high-deliverability templates with dynamic candidate tags
                    </span>
                  </div>
                </div>
                <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                  <button type="button" class="btn btn-primary btn-xs" onclick="ComposerView.openSampleTemplatesModal()" style="background: #2563eb; font-weight: 600; padding: 4px 10px; display: flex; align-items: center; gap: 5px;">
                    🎨 Browse Sample Gallery
                  </button>
                  <button type="button" class="btn btn-outline btn-xs" onclick="ComposerView.openSaveTemplateModal()" title="Save current email as a template" style="padding: 4px 8px; font-size: 0.74rem;">
                    💾 Save as Template
                  </button>
                  <a href="#templates" style="font-size: 0.76rem; color: var(--brand-sapphire); font-weight: 600;">Manage All Templates &rarr;</a>
                </div>
              </div>

              <!-- Quick Template Select Dropdown -->
              <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 10px;">
                <select class="form-select" id="composerTemplateSelect" onchange="ComposerView.loadTemplatePreset(this.value)" style="flex: 1; font-weight: 600; background: #ffffff;">
                  <option value="">-- Choose from Sample Templates --</option>
                  ${this.state.templates.map(t => `
                    <option value="${t.id}" ${this.state.selectedTemplateId == t.id ? 'selected' : ''}>
                      [${t.category}] ${t.name}
                    </option>
                  `).join('')}
                </select>
                <button type="button" class="btn btn-secondary btn-sm" onclick="ComposerView.openSampleTemplatesModal()" title="Visual Gallery of Sample Templates" style="white-space: nowrap; background: #ffffff;">
                  👁 Visual Gallery
                </button>
              </div>

              <!-- Quick-Switch Sample Template Pills -->
              <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center; padding-top: 6px; border-top: 1px dashed #cbd5e1;">
                <span style="font-size: 0.74rem; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-right: 4px;">Quick Load:</span>
                ${this.renderQuickSamplePills()}
              </div>
            </div>
          </div>

          <!-- 🔗 SEPARATE APPLICATION / APPLY NOW HYPERLINK BOX -->
          <div class="card" style="margin-bottom: 20px; background: #f0fdf4; border: 1.5px solid #86efac;">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" style="color: #166534; font-weight: 700; display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="display: flex; align-items: center; gap: 6px;">
                  🔗 Application / "Apply Now" Hyperlink URL
                </span>
                <span style="font-size: 0.72rem; font-weight: 700; background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 12px; border: 1px solid #86efac;">
                  Tag: {ApplyLink}
                </span>
              </label>
              <div style="display: flex; gap: 8px; align-items: center;">
                <input type="url" id="applyLinkInput" class="form-input" style="font-family: var(--font-mono); font-size: 0.88rem; background: #ffffff; font-weight: 500;" value="${this.state.applyLink}" oninput="ComposerView.handleApplyLinkChange(this.value)" placeholder="https://careers.aparaitech.org/apply?drive=2026 or https://forms.gle/..." />
                <button type="button" class="btn btn-secondary btn-sm" onclick="ComposerView.insertApplyNowButton()" title="Insert styled 'Apply Now' CTA button at cursor position" style="white-space: nowrap; background: #ffffff; border-color: #86efac; color: #166534; font-weight: 600;">
                  ➕ Insert Apply Button
                </button>
              </div>
              <p style="font-size: 0.75rem; color: #166534; margin-top: 6px; margin-bottom: 0; line-height: 1.4;">
                💡 <strong>Separate Link Box:</strong> Change this URL for different campus drives or job roles. All <strong>"Apply Now"</strong> buttons and <strong><code>{ApplyLink}</code></strong> tags in the email body will automatically link to this URL.
              </p>
            </div>
          </div>

          <!-- Personalization Variables Bar -->
          <div class="variables-bar">
            <span class="variables-title">Insert Tag:</span>
            <button type="button" class="var-pill" onclick="ComposerView.insertTag('{Name}')" title="Student full name">{Name}</button>
            <button type="button" class="var-pill" onclick="ComposerView.insertTag('{College}')" title="Student college">{College}</button>
            <button type="button" class="var-pill" onclick="ComposerView.insertTag('{Branch}')" title="Branch / Stream">{Branch}</button>
            <button type="button" class="var-pill" onclick="ComposerView.insertTag('{Batch}')" title="Graduation Year">{Batch}</button>
            <button type="button" class="var-pill" onclick="ComposerView.insertTag('{ApplyLink}')" title="Apply Now Hyperlink from box above" style="background: #dcfce7; color: #166534; font-weight: 700; border-color: #86efac;">{ApplyLink}</button>
            <button type="button" class="var-pill" onclick="ComposerView.insertTag('{Job_Role}')" title="Target Job Role">{Job_Role}</button>
            <button type="button" class="var-pill" onclick="ComposerView.insertTag('{Drive_Date}')" title="Drive Date">{Drive_Date}</button>
            <button type="button" class="var-pill" onclick="ComposerView.insertTag('{Package}')" title="Salary / CTC">{Package}</button>
            <button type="button" class="var-pill" onclick="ComposerView.insertTag('{Company}')" title="Aparaitech Software">{Company}</button>
            <button type="button" class="var-pill" onclick="ComposerView.insertTag('{Phone}')" title="Mobile Number">{Phone}</button>
            <button type="button" class="var-pill" onclick="ComposerView.insertSpintaxExample()" title="Insert random synonym variations (e.g. {Dear|Hello|Greetings}) to bypass bulk mail hashing" style="background: #ede9fe; color: #5b21b6; font-weight: 700; border-color: #ddd6fe;">🎲 {Spintax: Greeting}</button>
          </div>

          <!-- Email Subject Line -->
          <div class="form-group">
            <label class="form-label">Email Subject Line *</label>
            <input type="text" id="emailSubjectInput" class="form-input" style="font-weight: 600;" value="${this.state.subject}" onfocus="ComposerView.state.lastFocusedField = 'subject'" oninput="ComposerView.handleSubjectChange(this.value)" placeholder="e.g. Career Opportunity at Aparaitech for {Name}" />
          </div>

          <!-- Rich Email Body Editor -->
          <div class="form-group">
            <label class="form-label">Email Body (HTML / Visual)</label>
            
            <div class="editor-toolbar">
              <button type="button" class="editor-btn" onclick="ComposerView.formatDoc('bold')" title="Bold"><strong>B</strong></button>
              <button type="button" class="editor-btn" onclick="ComposerView.formatDoc('italic')" title="Italic"><em>I</em></button>
              <button type="button" class="editor-btn" onclick="ComposerView.formatDoc('underline')" title="Underline"><u>U</u></button>
              <button type="button" class="editor-btn" onclick="ComposerView.formatDoc('insertUnorderedList')" title="Bullet List">&bull; List</button>
              <button type="button" class="editor-btn" onclick="ComposerView.formatDoc('insertOrderedList')" title="Numbered List">1. List</button>
              <button type="button" class="editor-btn" onclick="ComposerView.insertCallout()" title="Add Highlight Box">&#x25A4; Callout</button>
              <button type="button" class="editor-btn" onclick="ComposerView.insertApplyNowButton()" title="Add 'Apply Now' CTA Button" style="color: #166534; font-weight: 700;">&#x25AC; Apply Button</button>
              <button type="button" class="editor-btn" onclick="ComposerView.formatDoc('createLink', prompt('Enter URL:'))" title="Insert Link">&#x1F517; Link</button>
              <button type="button" class="editor-btn" onclick="ComposerView.toggleHtmlMode()" id="btnToggleSource" title="Toggle Raw HTML">&lt;/&gt; Source</button>
            </div>

            <div id="visualEditor" class="editor-content-area" contenteditable="true" onfocus="ComposerView.state.lastFocusedField = 'body'" oninput="ComposerView.handleBodyChange()">
              ${this.state.bodyHtml}
            </div>

            <textarea id="rawHtmlTextarea" class="form-textarea" style="display: none; font-family: var(--font-mono); font-size: 0.8rem; min-height: 280px;" oninput="ComposerView.handleRawHtmlChange(this.value)">${this.state.bodyHtml}</textarea>
          </div>
        </div>

        <!-- Right Column: Live Dual Preview with Recipient Switcher & Anti-Spam Shield -->
        <div class="composer-right">
          <div class="preview-pane">
            <div class="preview-header">
              <div>
                <span style="font-weight: 700; font-size: 0.88rem; color: var(--text-primary);">Live Recipient Preview</span>
                <div style="font-size: 0.74rem; color: var(--text-muted);">Dynamic tags render automatically below</div>
              </div>
              
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 0.78rem; font-weight: 600; color: var(--text-muted);">Simulate as:</span>
                <select class="form-select" style="padding: 4px 8px; font-size: 0.8rem; width: auto; max-width: 180px;" id="previewStudentSelect" onchange="ComposerView.switchPreviewStudent(this.value)">
                  ${this.state.students.map(s => `
                    <option value="${s.id}" ${this.state.selectedPreviewStudentId == s.id ? 'selected' : ''}>${s.name} (${s.college})</option>
                  `).join('')}
                </select>
              </div>
            </div>

            <!-- Subject Preview Banner -->
            <div style="background: #ffffff; padding: 14px 20px; border-bottom: 1px solid var(--border-light);">
              <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Subject:</div>
              <div id="previewSubjectText" style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); margin-top: 2px;">
                ${this.state.subject}
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
                From: <strong>Aparaitech Software Recruitment Team &lt;recruitment@aparaitech.org&gt;</strong>
              </div>
            </div>

            <!-- Body Frame Preview -->
            <div class="preview-body-frame">
              <div class="preview-rendered-box" id="previewRenderedHtml">
                <!-- Rendered output -->
              </div>
            </div>
          </div>

          <!-- 🛡️ Anti-Spam Deliverability Shield Card -->
          <div class="card" id="antiSpamShieldCard" style="margin-top: 16px; border: 1.5px solid #cbd5e1; background: #ffffff; padding: 18px; border-radius: var(--radius-md);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 1.25rem;">🛡️</span>
                <div>
                  <h4 style="margin: 0; font-size: 0.92rem; font-weight: 700; color: #0f172a;">Anti-Spam Deliverability Shield</h4>
                  <p style="margin: 0; font-size: 0.72rem; color: var(--text-muted);">Real-time spam filter score &amp; primary inbox analyzer</p>
                </div>
              </div>
              <div id="spamScoreBadge" style="font-size: 0.85rem; font-weight: 700; padding: 4px 12px; border-radius: 20px; background: #e2e8f0; color: #475569;">
                Checking...
              </div>
            </div>

            <!-- Score Meter Bar -->
            <div style="margin-bottom: 12px;">
              <div style="display: flex; justify-content: space-between; font-size: 0.76rem; color: #64748b; margin-bottom: 4px;">
                <span>Spam Risk: <strong id="spamRiskCategory">Evaluating...</strong></span>
                <span id="spamScoreText" style="font-weight: 700;">-- / 100</span>
              </div>
              <div style="height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden;">
                <div id="spamScoreProgress" style="width: 100%; height: 100%; background: #10b981; transition: width 0.3s, background-color 0.3s;"></div>
              </div>
            </div>

            <!-- Real-time Diagnostic Warnings -->
            <div id="spamIssuesList" style="font-size: 0.78rem; line-height: 1.4; max-height: 140px; overflow-y: auto; margin-bottom: 12px;">
              <!-- Populated dynamically -->
            </div>

            <!-- Quick Action & Health Toolbar -->
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f1f5f9; padding-top: 10px; flex-wrap: wrap; gap: 8px;">
              <div id="domainDnsStatus" style="font-size: 0.72rem; color: #64748b; display: flex; align-items: center; gap: 4px;">
                <span>🌐 Domain DNS: <strong id="dnsHealthText">Checking...</strong></span>
              </div>
              <div style="display: flex; gap: 6px;">
                <button type="button" class="btn btn-outline btn-sm" style="font-size: 0.74rem; padding: 3px 8px;" onclick="ComposerView.applySpamSanitizer()" title="Auto-replace known spam words & clean formatting">
                  ✨ Auto-Fix Words
                </button>
                <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.74rem; padding: 3px 8px;" onclick="ComposerView.runAntiSpamCheck(true)">
                  🔄 Re-check
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  handleSubjectChange(val) {
    this.state.subject = val;
    this.updateLivePreview();
  },

  handleApplyLinkChange(val) {
    this.state.applyLink = val;
    this.updateLivePreview();
  },

  handleBodyChange() {
    const editor = document.getElementById('visualEditor');
    if (editor) {
      this.state.bodyHtml = editor.innerHTML;
      const rawArea = document.getElementById('rawHtmlTextarea');
      if (rawArea) rawArea.value = this.state.bodyHtml;
      this.updateLivePreview();
    }
  },

  handleRawHtmlChange(val) {
    this.state.bodyHtml = val;
    const editor = document.getElementById('visualEditor');
    if (editor) editor.innerHTML = val;
    this.updateLivePreview();
  },

  formatDoc(cmd, val = null) {
    document.execCommand(cmd, false, val);
    this.handleBodyChange();
  },

  insertCallout() {
    const html = `
      <div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 14px 18px; margin: 18px 0; border-radius: 4px;">
        <p style="margin: 0; font-size: 14px; color: #1e293b;"><strong>Important Drive Notice:</strong> Please bring your updated resume and college ID card.</p>
      </div>
    `;
    document.execCommand('insertHTML', false, html);
    this.handleBodyChange();
  },

  insertApplyNowButton() {
    const html = `
      <div style="text-align: center; margin: 24px 0;">
        <a href="{ApplyLink}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 14px 32px; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);">Apply Now & Confirm Registration &rarr;</a>
      </div>
    `;
    document.execCommand('insertHTML', false, html);
    this.handleBodyChange();
  },

  insertCtaButton() {
    this.insertApplyNowButton();
  },

  toggleHtmlMode() {
    const visual = document.getElementById('visualEditor');
    const raw = document.getElementById('rawHtmlTextarea');
    const btn = document.getElementById('btnToggleSource');

    if (raw.style.display === 'none') {
      raw.value = visual.innerHTML;
      raw.style.display = 'block';
      visual.style.display = 'none';
      btn.style.background = '#cbd5e1';
      btn.textContent = '👁 Visual';
    } else {
      visual.innerHTML = raw.value;
      visual.style.display = 'block';
      raw.style.display = 'none';
      btn.style.background = 'transparent';
      btn.textContent = '</> Source';
    }
  },

  insertTag(tag) {
    if (this.state.lastFocusedField === 'subject') {
      const input = document.getElementById('emailSubjectInput');
      if (input) {
        const start = input.selectionStart || input.value.length;
        const end = input.selectionEnd || input.value.length;
        input.value = input.value.substring(0, start) + tag + input.value.substring(end);
        input.focus();
        input.selectionStart = input.selectionEnd = start + tag.length;
        this.handleSubjectChange(input.value);
      }
    } else {
      document.execCommand('insertText', false, tag);
      this.handleBodyChange();
    }
  },

  renderQuickSamplePills() {
    const quickItems = [
      { label: '🎓 Campus Drive 2026', keyword: 'Campus Placement Drive' },
      { label: '👋 Welcome & Onboarding Guide', keyword: 'Welcome' }
    ];

    return quickItems.map(item => `
      <button type="button" class="btn btn-outline btn-xs" 
        style="padding: 3px 8px; font-size: 0.74rem; background: #ffffff; border-radius: 14px; font-weight: 600; color: #334155;" 
        onclick="ComposerView.loadTemplateByName('${item.keyword.replace(/'/g, "\\'")}')" 
        title="Quick-load ${item.keyword} sample template">
        ${item.label}
      </button>
    `).join('');
  },

  loadTemplateByName(keyword) {
    const found = this.state.templates.find(t => 
      t.name.toLowerCase().includes(keyword.toLowerCase()) || 
      (t.category && t.category.toLowerCase().includes(keyword.toLowerCase()))
    );
    if (found) {
      this.loadTemplatePreset(found.id);
    } else {
      app.showToast(`Template matching "${keyword}" not found`, 'warning');
    }
  },

  loadTemplatePreset(templateId) {
    const tpl = this.state.templates.find(t => t.id == templateId);
    if (tpl) {
      this.state.selectedTemplateId = tpl.id;
      this.state.subject = tpl.subject;
      this.state.bodyHtml = tpl.body_html;

      const select = document.getElementById('composerTemplateSelect');
      if (select) select.value = tpl.id;

      const subjInput = document.getElementById('emailSubjectInput');
      if (subjInput) subjInput.value = tpl.subject;

      const visual = document.getElementById('visualEditor');
      if (visual) visual.innerHTML = tpl.body_html;

      const raw = document.getElementById('rawHtmlTextarea');
      if (raw) raw.value = tpl.body_html;

      this.updateLivePreview();
      app.showToast(`Loaded template: "${tpl.name}"`, 'info');
    }
  },

  openSampleTemplatesModal() {
    const categories = [
      { id: 'all', label: 'All Samples' },
      { id: 'Placement Drive', label: 'Placement Drive' },
      { id: 'Coding Assessment', label: 'Assessment' },
      { id: 'Internship', label: 'Internship' },
      { id: 'Interview Shortlist', label: 'Interview' },
      { id: 'Offer Letter', label: 'Offer Letter' },
      { id: 'Urgent Reminder', label: 'Deadline Reminder' },
      { id: 'Hackathon', label: 'Hackathon' }
    ];

    const categoryBadges = {
      'Placement Drive': { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
      'Coding Assessment': { bg: '#fef3c7', text: '#b45309', border: '#fde68a' },
      'Internship': { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
      'Interview Shortlist': { bg: '#faf5ff', text: '#7e22ce', border: '#e9d5ff' },
      'Offer Letter': { bg: '#fdf2f8', text: '#be185d', border: '#fbcfe8' },
      'Urgent Reminder': { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
      'Hackathon': { bg: '#f3e8ff', text: '#6b21a8', border: '#d8b4fe' },
      'Custom': { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' }
    };

    const modalHtml = `
      <div class="modal-header" style="background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); color: #fff; padding: 18px 24px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 1.4rem;">🎨</span>
          <div>
            <h3 class="modal-title" style="color: #fff; margin: 0; font-size: 1.15rem;">Sample Recruitment Email Templates Gallery</h3>
            <p style="margin: 2px 0 0 0; font-size: 0.78rem; color: #93c5fd;">Browse, preview, and load pre-tested high-deliverability recruitment emails with 1 click</p>
          </div>
        </div>
        <button class="modal-close" onclick="app.closeModal()" style="color: #fff; background: rgba(255,255,255,0.15);">&times;</button>
      </div>

      <div class="modal-body" style="padding: 20px; max-height: 75vh; overflow-y: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; gap: 6px; flex-wrap: wrap;" id="sampleModalFilterPills">
            ${categories.map(c => `
              <button type="button" class="btn btn-xs ${c.id === 'all' ? 'btn-primary' : 'btn-outline'}" 
                style="padding: 4px 10px; border-radius: 20px; font-size: 0.78rem;"
                onclick="ComposerView.filterSampleModalCards('${c.id}')">
                ${c.label}
              </button>
            `).join('')}
          </div>
          <a href="#templates" onclick="app.closeModal()" style="font-size: 0.78rem; color: var(--brand-sapphire); font-weight: 600;">Open Full Templates Manager &rarr;</a>
        </div>

        <div id="sampleModalGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;">
          ${this.state.templates.map(t => {
            const badge = categoryBadges[t.category] || categoryBadges['Custom'];
            let tags = [];
            try { tags = typeof t.tags_used === 'string' ? JSON.parse(t.tags_used) : (t.tags_used || []); } catch(e) {}
            const plainSnippet = (t.body_html || '').replace(/<[^>]*>?/gm, ' ').replace(/\\s+/g, ' ').trim().substring(0, 120);

            return `
              <div class="card sample-modal-card" data-category="${t.category || 'Custom'}" style="display: flex; flex-direction: column; justify-content: space-between; padding: 16px; border: 1.5px solid var(--border-light); border-radius: var(--radius-md); box-shadow: 0 2px 4px rgba(0,0,0,0.03);">
                <div>
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <span style="font-size: 0.72rem; font-weight: 700; background: ${badge.bg}; color: ${badge.text}; border: 1px solid ${badge.border}; padding: 2px 8px; border-radius: 10px; text-transform: uppercase;">
                      ${t.category || 'Placement'}
                    </span>
                    <span style="font-size: 0.7rem; color: #94a3b8; font-family: monospace;">ID: #${t.id}</span>
                  </div>
                  <h4 style="font-size: 0.95rem; font-weight: 700; color: #0f172a; margin: 0 0 6px 0;">
                    ${t.name}
                  </h4>
                  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 10px; font-size: 0.78rem; font-weight: 600; color: #334155; margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ✉️ ${t.subject}
                  </div>
                  <p style="font-size: 0.8rem; color: #64748b; line-height: 1.4; margin: 0 0 10px 0;">
                    ${plainSnippet}...
                  </p>
                  ${tags.length > 0 ? `
                    <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 12px;">
                      ${tags.slice(0, 4).map(tg => `
                        <span style="font-size: 0.68rem; background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-family: monospace;">${tg}</span>
                      `).join('')}
                      ${tags.length > 4 ? `<span style="font-size: 0.68rem; color: #94a3b8;">+${tags.length - 4} more</span>` : ''}
                    </div>
                  ` : ''}
                </div>
                <div style="display: flex; gap: 8px; border-top: 1px solid #f1f5f9; padding-top: 10px; margin-top: 6px;">
                  <button type="button" class="btn btn-secondary btn-xs" style="flex: 1;" onclick="ComposerView.previewSampleInModal(${t.id})">
                    👁 View Preview
                  </button>
                  <button type="button" class="btn btn-primary btn-xs" style="flex: 1.4; background: #2563eb; font-weight: 700;" onclick="ComposerView.selectSampleFromModal(${t.id})">
                    ⚡ Load into Composer
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    app.openModal(modalHtml);
  },

  filterSampleModalCards(category) {
    const cards = document.querySelectorAll('.sample-modal-card');
    cards.forEach(card => {
      const cardCat = card.getAttribute('data-category') || '';
      if (category === 'all' || cardCat.toLowerCase() === category.toLowerCase()) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });

    const pills = document.querySelectorAll('#sampleModalFilterPills button');
    pills.forEach(pill => {
      const isTarget = pill.getAttribute('onclick').includes(`'${category}'`);
      pill.className = `btn btn-xs ${isTarget ? 'btn-primary' : 'btn-outline'}`;
    });
  },

  selectSampleFromModal(templateId) {
    this.loadTemplatePreset(templateId);
    app.closeModal();
    const tpl = this.state.templates.find(t => t.id == templateId);
    app.showToast(`✨ Loaded sample template "${tpl ? tpl.name : ''}" into Composer!`, 'success');
  },

  async previewSampleInModal(templateId) {
    const tpl = this.state.templates.find(t => t.id == templateId);
    if (!tpl) return;

    try {
      const previewRes = await api.renderPreview({
        subject: tpl.subject,
        body_html: tpl.body_html,
        apply_link: this.state.applyLink,
        studentId: this.state.selectedPreviewStudentId
      });

      const previewHtml = `
        <div class="modal-header" style="background: #0f172a; color: #fff; padding: 16px 20px;">
          <div>
            <h3 class="modal-title" style="color: #fff; margin: 0; font-size: 1.05rem;">Template Preview: ${tpl.name}</h3>
            <p style="margin: 2px 0 0 0; font-size: 0.74rem; color: #94a3b8;">Simulated with sample candidate tokens</p>
          </div>
          <button class="modal-close" onclick="ComposerView.openSampleTemplatesModal()" style="color: #fff; background: rgba(255,255,255,0.15);">&larr; Back to Gallery</button>
        </div>
        <div class="modal-body" style="padding: 20px; max-height: 75vh; overflow-y: auto;">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px;">
            <div style="font-size: 0.74rem; font-weight: 700; color: #64748b; text-transform: uppercase;">Rendered Subject:</div>
            <div style="font-size: 0.92rem; font-weight: 700; color: #1e293b; margin-top: 2px;">${previewRes.renderedSubject}</div>
          </div>
          <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; background: #ffffff;">
            ${previewRes.renderedBody}
          </div>
          <div style="text-align: right; margin-top: 16px;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="ComposerView.openSampleTemplatesModal()" style="margin-right: 8px;">&larr; Back</button>
            <button type="button" class="btn btn-primary btn-sm" onclick="ComposerView.selectSampleFromModal(${tpl.id})" style="background: #2563eb; font-weight: 700;">
              ⚡ Load this Template into Composer &rarr;
            </button>
          </div>
        </div>
      `;
      app.openModal(previewHtml);
    } catch (e) {
      app.showToast('Preview error: ' + e.message, 'error');
    }
  },

  switchPreviewStudent(studentId) {
    this.state.selectedPreviewStudentId = parseInt(studentId, 10);
    this.updateLivePreview();
  },

  handleTargetTypeChange(type) {
    this.state.targetType = type;
    const colContainer = document.getElementById('targetCollegesContainer');
    const batchContainer = document.getElementById('targetBatchesContainer');
    const uploadBatchContainer = document.getElementById('targetUploadBatchContainer');

    if (colContainer) colContainer.style.display = type === 'college' ? 'flex' : 'none';
    if (batchContainer) batchContainer.style.display = type === 'batch' ? 'flex' : 'none';
    if (uploadBatchContainer) uploadBatchContainer.style.display = type === 'import_batch' ? 'block' : 'none';
  },

  handleUploadBatchSelect(batchId) {
    this.state.targetBatchId = batchId;
    const found = this.state.uploadBatches.find(b => b.import_batch_id === batchId);
    if (found) {
      this.state.targetBatchName = found.import_source;
      app.showToast(`Selected bulk upload: "${found.import_source}" (${found.student_count} candidates)`, 'info');
    }
  },

  toggleTargetCollege(college, checked) {
    if (checked) {
      this.state.selectedColleges.push(college);
    } else {
      this.state.selectedColleges = this.state.selectedColleges.filter(c => c !== college);
    }
  },

  toggleTargetBatch(batch, checked) {
    if (checked) {
      this.state.selectedBatches.push(batch);
    } else {
      this.state.selectedBatches = this.state.selectedBatches.filter(b => b !== batch);
    }
  },

  async updateLivePreview() {
    try {
      const res = await api.renderPreview({
        subject: this.state.subject,
        body_html: this.state.bodyHtml,
        apply_link: this.state.applyLink,
        studentId: this.state.selectedPreviewStudentId
      });

      const subjEl = document.getElementById('previewSubjectText');
      if (subjEl) subjEl.textContent = res.renderedSubject;

      const bodyEl = document.getElementById('previewRenderedHtml');
      if (bodyEl) bodyEl.innerHTML = res.renderedBody;

      this.debouncedSpamCheck();
    } catch (error) {
      console.error('Preview render error:', error);
    }
  },

  openTestEmailModal() {
    app.openModal(`
      <div class="modal-header">
        <h3 class="modal-title">Send Single Test Blast Email</h3>
        <button class="modal-close" onclick="app.closeModal()">&times;</button>
      </div>
      <form id="testEmailForm" onsubmit="ComposerView.submitTestEmail(event)">
        <p style="color: var(--text-muted); font-size: 0.88rem; margin-bottom: 16px;">
          Send a rendered preview of this email with personalized tags and your custom Apply Now link to your own email address.
        </p>
        <div class="form-group">
          <label class="form-label">Recipient Test Email *</label>
          <input type="email" name="test_email" class="form-input" placeholder="recruiter@aparaitech.org" value="careers@aparaitech.org" required />
        </div>
        <div class="form-group">
          <label class="form-label">Application / Apply Now URL</label>
          <input type="url" name="apply_link" class="form-input" value="${this.state.applyLink}" placeholder="https://careers.aparaitech.org/apply" />
        </div>
        <div class="form-group">
          <label class="form-label">Substitute Tags From Student Profile</label>
          <select name="studentId" class="form-select">
            ${this.state.students.map(s => `
              <option value="${s.id}" ${this.state.selectedPreviewStudentId == s.id ? 'selected' : ''}>${s.name} (${s.college})</option>
            `).join('')}
          </select>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 24px;">
          <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btnSendTest">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            <span>Dispatch Test Email</span>
          </button>
        </div>
      </form>
    `);
  },

  async submitTestEmail(event) {
    event.preventDefault();
    const btn = document.getElementById('btnSendTest');
    if (btn) btn.disabled = true;

    const formData = new FormData(event.target);
    const payload = {
      test_email: formData.get('test_email'),
      studentId: formData.get('studentId'),
      apply_link: formData.get('apply_link') || this.state.applyLink,
      subject: this.state.subject,
      body_html: this.state.bodyHtml
    };

    try {
      const res = await api.sendTestEmail(payload);
      app.showToast(res.message, 'success');
      app.closeModal();
    } catch (error) {
      if (btn) btn.disabled = false;
      app.showToast('Test email failed: ' + error.message, 'error');
    }
  },

  openLaunchModal() {
    let targetLabel = 'All Registered Students';
    if (this.state.targetType === 'college') {
      targetLabel = this.state.selectedColleges.length > 0
        ? `Colleges: ${this.state.selectedColleges.join(', ')}`
        : 'All Colleges (No specific college selected)';
    } else if (this.state.targetType === 'batch') {
      targetLabel = this.state.selectedBatches.length > 0
        ? `Batches: ${this.state.selectedBatches.join(', ')}`
        : 'All Batches';
    } else if (this.state.targetType === 'import_batch') {
      targetLabel = this.state.targetBatchName
        ? `Bulk Upload Batch: "${this.state.targetBatchName}"`
        : 'Selected Bulk Upload Batch';
    } else if (this.state.targetType === 'selected') {
      targetLabel = `${this.state.selectedStudentIds.length} Selected Candidates`;
    }

    app.openModal(`
      <div class="modal-header">
        <h3 class="modal-title">Confirm Email Blast Launch</h3>
        <button class="modal-close" onclick="app.closeModal()">&times;</button>
      </div>
      <div>
        <p style="color: var(--text-secondary); margin-bottom: 20px;">
          You are about to launch an automated email blast. Each student will receive a unique personalized message rendered with their individual credentials and your custom application link.
        </p>

        <div style="background: #f8fafc; border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 16px; margin-bottom: 24px;">
          <div style="margin-bottom: 8px;"><strong>Campaign Title:</strong> ${this.state.campaignTitle}</div>
          <div style="margin-bottom: 8px;"><strong>Subject:</strong> ${this.state.subject}</div>
          <div style="margin-bottom: 8px;"><strong>Application Link:</strong> <code style="color: #166534; font-weight: 600;">${this.state.applyLink}</code></div>
          <div><strong>Target Audience:</strong> <span style="color: var(--brand-sapphire); font-weight: 600;">${targetLabel}</span></div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <button type="button" class="btn btn-secondary" onclick="app.closeModal()">Back to Editing</button>
          <button type="button" class="btn btn-primary" id="btnConfirmLaunch" onclick="ComposerView.executeLaunch()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
            <span>Start Real-time Blast Now</span>
          </button>
        </div>
      </div>
    `);
  },

  async executeLaunch() {
    const btn = document.getElementById('btnConfirmLaunch');
    if (btn) btn.disabled = true;

    try {
      const payload = {
        title: this.state.campaignTitle,
        subject: this.state.subject,
        body_html: this.state.bodyHtml,
        apply_link: this.state.applyLink,
        target_type: this.state.targetType,
        target_colleges: this.state.selectedColleges,
        target_batches: this.state.selectedBatches,
        target_batch_id: this.state.targetBatchId,
        target_upload_batches: this.state.targetBatchId ? [this.state.targetBatchId] : [],
        selected_student_ids: this.state.selectedStudentIds
      };

      const res = await api.launchCampaign(payload);
      app.closeModal();
      app.showToast(res.message || 'Email blast initiated!', 'success');

      // Navigate to Live Monitor Cockpit
      app.navigate('blast-monitor', { campaignId: res.campaignId });
    } catch (error) {
      if (btn) btn.disabled = false;
      app.showToast('Launch failed: ' + error.message, 'error');
    }
  },

  openSaveTemplateModal() {
    const subject = (this.state.subject || '').trim();
    const visual = document.getElementById('visualEditor');
    const body_html = visual ? visual.innerHTML.trim() : (this.state.bodyHtml || '').trim();

    if (!subject && !body_html) {
      app.showToast('Please write an email subject and body before saving as a template', 'warning');
      return;
    }

    const currentTpl = this.state.templates.find(t => t.id == this.state.selectedTemplateId);
    const categories = ['Placement Drive', 'Internship', 'Coding Assessment', 'Interview Shortlist', 'Offer Letter', 'Announcement', 'Custom'];
    const defaultName = currentTpl ? currentTpl.name : (this.state.campaignTitle || 'New Recruitment Template');
    const defaultCategory = currentTpl ? currentTpl.category : 'Placement Drive';

    const modalHtml = `
      <div class="modal-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 1.3rem;">💾</span>
          <div>
            <h2 style="font-size: 1.15rem; font-weight: 700; margin: 0;">Save Email as Template</h2>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">Save current subject and body layout as a reusable preset</p>
          </div>
        </div>
        <button class="modal-close" onclick="app.closeModal()">&times;</button>
      </div>

      <div class="modal-body" style="padding: 20px 24px;">
        <form id="saveTemplateModalForm" onsubmit="event.preventDefault(); ComposerView.handleSaveTemplateSubmit();">
          ${currentTpl ? `
            <div style="background: #f8fafc; padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid #e2e8f0; margin-bottom: 16px;">
              <div style="font-size: 0.84rem; font-weight: 600; color: #1e293b; margin-bottom: 8px;">Choose Save Action:</div>
              <div style="display: flex; gap: 16px; flex-wrap: wrap;">
                <label style="display: flex; align-items: center; gap: 6px; font-size: 0.84rem; cursor: pointer;">
                  <input type="radio" name="saveTemplateMode" value="update" checked onchange="document.getElementById('saveTplNameInput').value = '${currentTpl.name.replace(/'/g, "\\'")}'" />
                  <span>Update existing: <strong>"${currentTpl.name}"</strong></span>
                </label>
                <label style="display: flex; align-items: center; gap: 6px; font-size: 0.84rem; cursor: pointer;">
                  <input type="radio" name="saveTemplateMode" value="new" onchange="document.getElementById('saveTplNameInput').value = '${currentTpl.name.replace(/'/g, "\\'")} (Copy)'" />
                  <span>Save as New Template</span>
                </label>
              </div>
            </div>
          ` : '<input type="hidden" name="saveTemplateMode" value="new" />'}

          <div class="form-group">
            <label class="form-label">Template Name <span style="color: var(--color-danger);">*</span></label>
            <input type="text" id="saveTplNameInput" class="form-input" value="${defaultName.replace(/"/g, '&quot;')}" required />
          </div>

          <div class="form-group">
            <label class="form-label">Category</label>
            <select id="saveTplCategoryInput" class="form-select">
              ${categories.map(c => `<option value="${c}" ${c === defaultCategory ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>

          <div class="form-group" style="margin-bottom: 0;">
            <label class="form-label">Subject Line</label>
            <input type="text" id="saveTplSubjectInput" class="form-input" value="${subject.replace(/"/g, '&quot;')}" required />
          </div>
        </form>
      </div>

      <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 10px; padding: 16px 24px;">
        <button class="btn btn-outline btn-sm" onclick="app.closeModal()">Cancel</button>
        <button class="btn btn-primary btn-sm" onclick="ComposerView.handleSaveTemplateSubmit()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
          <span>Confirm &amp; Save Template</span>
        </button>
      </div>
    `;

    app.openModal(modalHtml);
  },

  async handleSaveTemplateSubmit() {
    const name = (document.getElementById('saveTplNameInput')?.value || '').trim();
    const category = document.getElementById('saveTplCategoryInput')?.value || 'Placement Drive';
    const subject = (document.getElementById('saveTplSubjectInput')?.value || this.state.subject || '').trim();
    const modeEl = document.querySelector('input[name="saveTemplateMode"]:checked') || document.querySelector('input[name="saveTemplateMode"]');
    const mode = modeEl ? modeEl.value : 'new';

    const visual = document.getElementById('visualEditor');
    const body_html = visual ? visual.innerHTML : (this.state.bodyHtml || '');

    if (!name || !subject || !body_html.trim()) {
      app.showToast('Template Name, Subject, and Body content are required', 'warning');
      return;
    }

    try {
      if (mode === 'update' && this.state.selectedTemplateId) {
        await api.updateTemplate(this.state.selectedTemplateId, { name, category, subject, body_html });
        app.showToast(`Template "${name}" updated successfully!`, 'success');
      } else {
        const res = await api.createTemplate({ name, category, subject, body_html });
        if (res.template && res.template.id) {
          this.state.selectedTemplateId = res.template.id;
        }
        app.showToast(`New template "${name}" created and saved!`, 'success');
      }

      app.closeModal();

      // Refresh templates in composer
      const tplRes = await api.getTemplates();
      this.state.templates = tplRes.templates || [];
      
      // Update template dropdown in composer UI
      const select = document.getElementById('composerTemplateSelect');
      if (select) {
        select.innerHTML = this.state.templates.map(t => `
          <option value="${t.id}" ${this.state.selectedTemplateId == t.id ? 'selected' : ''}>
            [${t.category}] ${t.name}
          </option>
        `).join('');
      }

      // Also sync TemplatesView if it exists
      if (typeof TemplatesView !== 'undefined' && TemplatesView.state) {
        TemplatesView.state.templates = this.state.templates;
      }
    } catch (err) {
      app.showToast(`Failed to save template: ${err.message}`, 'error');
    }
  },

  debouncedSpamCheck() {
    if (this.state.spamCheckTimeout) clearTimeout(this.state.spamCheckTimeout);
    this.state.spamCheckTimeout = setTimeout(() => {
      this.runAntiSpamCheck();
    }, 450);
  },

  async runAntiSpamCheck(isManual = false) {
    try {
      const badge = document.getElementById('spamScoreBadge');
      const prog = document.getElementById('spamScoreProgress');
      const scoreTxt = document.getElementById('spamScoreText');
      const catTxt = document.getElementById('spamRiskCategory');
      const issuesList = document.getElementById('spamIssuesList');

      if (isManual && badge) {
        badge.textContent = 'Analyzing...';
        badge.style.background = '#e2e8f0';
        badge.style.color = '#475569';
      }

      const res = await api.checkSpam({
        subject: this.state.subject,
        body_html: this.state.bodyHtml,
        apply_link: this.state.applyLink
      });

      if (!res || res.score === undefined) return;

      if (badge) {
        badge.textContent = `${res.score}/100`;
        badge.style.background = res.color + '22';
        badge.style.color = res.color;
        badge.style.border = `1px solid ${res.color}55`;
      }

      if (prog) {
        prog.style.width = `${res.score}%`;
        prog.style.background = res.color;
      }

      if (scoreTxt) {
        scoreTxt.textContent = `${res.score} / 100 Deliverability`;
        scoreTxt.style.color = res.color;
      }

      if (catTxt) {
        catTxt.textContent = res.label;
        catTxt.style.color = res.color;
      }

      if (issuesList) {
        if ((!res.issues || res.issues.length === 0) && (!res.suggestions || res.suggestions.length === 0)) {
          issuesList.innerHTML = `
            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px 12px; color: #15803d;">
              <span style="font-weight: 700;">✅ Pristine Inbox Health!</span>
              <p style="margin: 3px 0 0 0; font-size: 0.74rem;">No spam keywords, suspicious links, or deliverability traps detected. This mail will comfortably reach candidate primary inboxes.</p>
            </div>
          `;
        } else {
          let html = '';
          (res.issues || []).forEach(issue => {
            const isHigh = issue.severity === 'high';
            html += `
              <div style="background: ${isHigh ? '#fef2f2' : '#fffbeb'}; border-left: 3px solid ${isHigh ? '#ef4444' : '#f59e0b'}; padding: 6px 10px; margin-bottom: 6px; border-radius: 2px;">
                <div style="font-weight: 700; color: ${isHigh ? '#991b1b' : '#92400e'};">${issue.message}</div>
                ${issue.advice ? `<div style="color: #64748b; font-size: 0.72rem; margin-top: 2px;">💡 ${issue.advice}</div>` : ''}
              </div>
            `;
          });

          (res.suggestions || []).forEach(sug => {
            html += `
              <div style="background: #f0f9ff; border-left: 3px solid #38bdf8; padding: 6px 10px; margin-bottom: 6px; border-radius: 2px; color: #0369a1;">
                ℹ️ ${sug}
              </div>
            `;
          });

          issuesList.innerHTML = html;
        }
      }

      if (isManual) {
        app.showToast(`Anti-Spam Check: ${res.score}/100 (${res.label})`, res.score >= 80 ? 'success' : 'warning');
      }
    } catch (err) {
      console.error('Anti-Spam check error:', err);
    }
  },

  async checkDnsHealth() {
    try {
      const dnsText = document.getElementById('dnsHealthText');
      const res = await api.checkDns();
      if (dnsText && res) {
        if (res.overallStatus === 'optimal') {
          dnsText.innerHTML = `<span style="color: #10b981; font-weight: 600;">Optimal (MX, SPF &amp; DMARC Active)</span>`;
        } else if (res.overallStatus === 'good') {
          dnsText.innerHTML = `<span style="color: #3b82f6; font-weight: 600;">Good (${res.spf.exists ? 'SPF' : 'DMARC'} Active)</span>`;
        } else {
          dnsText.innerHTML = `<span style="color: #f59e0b; font-weight: 600;" title="Ensure domain has SPF and DMARC set in DNS">MX Active (SPF/DMARC recommended)</span>`;
        }
      }
    } catch (e) {
      console.warn('DNS check failed:', e.message);
    }
  },

  insertSpintaxExample() {
    const spintax = '{Dear|Hello|Greetings}';
    if (this.state.lastFocusedField === 'subject') {
      const input = document.getElementById('emailSubjectInput');
      if (input) {
        const start = input.selectionStart || input.value.length;
        const end = input.selectionEnd || input.value.length;
        input.value = input.value.substring(0, start) + spintax + ' ' + input.value.substring(end);
        input.focus();
        this.handleSubjectChange(input.value);
      }
    } else {
      document.execCommand('insertText', false, spintax + ' ');
      this.handleBodyChange();
    }
    app.showToast('Inserted Spintax: {Dear|Hello|Greetings}. Every recipient will get a unique random greeting to bypass bulk mail hashing!', 'info');
  },

  applySpamSanitizer() {
    let subj = this.state.subject || '';
    let body = this.state.bodyHtml || '';
    let link = this.state.applyLink || '';
    let replacedCount = 0;

    const replacements = [
      { pattern: /win\s*(?:cash|₹|rs)\s*[\d,]+/gi, replace: 'career placement opportunities' },
      { pattern: /100%\s*guaranteed/gi, replace: 'structured' },
      { pattern: /100%\s*free/gi, replace: 'complimentary' },
      { pattern: /guaranteed\s*stipend/gi, replace: 'competitive performance stipend' },
      { pattern: /wipro-oriented/gi, replace: 'industry-aligned' },
      { pattern: /tcs-oriented/gi, replace: 'industry-standard' },
      { pattern: /infosys-oriented/gi, replace: 'enterprise-ready' },
      { pattern: /urgent\s*!*/gi, replace: 'Important notice:' },
      { pattern: /hurry\s*up/gi, replace: 'Early submission recommended' },
      { pattern: /don't\s*miss\s*out/gi, replace: 'You are invited to review' },
      { pattern: /!{2,}/g, replace: '.' },
      { pattern: /\?{2,}/g, replace: '?' }
    ];

    replacements.forEach(r => {
      if (r.pattern.test(subj)) {
        subj = subj.replace(r.pattern, r.replace);
        replacedCount++;
      }
      if (r.pattern.test(body)) {
        body = body.replace(r.pattern, r.replace);
        replacedCount++;
      }
    });

    // Check link for forms.gle
    if (link.includes('forms.gle')) {
      link = 'https://aparaitech.org/apply';
      replacedCount++;
      app.showToast('Replaced forms.gle with direct domain https://aparaitech.org/apply for high deliverability!', 'warning');
    }

    if (replacedCount > 0) {
      this.state.subject = subj;
      this.state.bodyHtml = body;
      this.state.applyLink = link;

      const subjInput = document.getElementById('emailSubjectInput');
      if (subjInput) subjInput.value = subj;

      const visual = document.getElementById('visualEditor');
      if (visual) visual.innerHTML = body;

      const raw = document.getElementById('rawHtmlTextarea');
      if (raw) raw.value = body;

      const linkInput = document.getElementById('applyLinkInput');
      if (linkInput) linkInput.value = link;

      this.updateLivePreview();
      app.showToast(`Sanitized ${replacedCount} potential spam triggers! Deliverability score improved.`, 'success');
    } else {
      app.showToast('No aggressive spam words found to sanitize. Email copy is already clean!', 'info');
    }
  }
};
