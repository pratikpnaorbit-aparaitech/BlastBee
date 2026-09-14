/**
 * Aparaitech Software - Email Templates Management View
 * Create, Edit, Delete, Preview, and Manage Recruitment Email Templates
 */
const TemplatesView = {
  state: {
    templates: [],
    search: '',
    category: 'all',
    isLoading: false,
    activeEditorMode: 'visual'
  },

  async render(container) {
    this.container = container;
    container.innerHTML = `
      <div class="view-header">
        <div class="view-title-group">
          <div style="display: flex; align-items: center; gap: 10px;">
            <h1>Email Templates &amp; Presets</h1>
            <span class="badge badge-primary" id="templateCountBadge" style="font-size: 0.82rem;">Loading...</span>
          </div>
          <p>Create, customize, preview, and organize reusable email templates for campus recruitment drives</p>
        </div>
        <div class="header-actions">
          <button class="btn btn-outline btn-sm" onclick="TemplatesView.restoreDefaultSamples()" title="Restore/refresh all standard sample recruitment templates" style="background: #ffffff; color: #2563eb; border-color: #93c5fd; font-weight: 600;">
            🔄 Reset to Sample Templates
          </button>
          <button class="btn btn-secondary btn-sm" onclick="app.navigate('composer')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
            <span>Open Composer</span>
          </button>
          <button class="btn btn-primary btn-sm" onclick="TemplatesView.openCreateModal()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>+ Create New Template</span>
          </button>
        </div>
      </div>

      <!-- Filter & Search Toolbar -->
      <div class="toolbar-container" style="margin-bottom: 20px;">
        <div class="toolbar-left" style="flex: 1; display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
          <div class="search-box" style="max-width: 320px; flex: 1;">
            <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input type="text" id="templateSearchInput" placeholder="Search templates by name, subject, or content..." value="${this.state.search}" oninput="TemplatesView.handleSearch(this.value)" />
          </div>

          <div style="display: flex; gap: 6px; flex-wrap: wrap;" id="templateCategoryPills">
            ${this.renderCategoryPills()}
          </div>
        </div>
      </div>

      <!-- Templates Grid / List Container -->
      <div id="templatesGridContainer">
        <div style="text-align: center; padding: 40px;">
          <div class="spinner"></div>
          <p style="margin-top: 12px; color: var(--text-muted);">Loading email templates...</p>
        </div>
      </div>
    `;

    await this.loadTemplates();
  },

  async loadTemplates() {
    try {
      this.state.isLoading = true;
      const res = await api.getTemplates();
      this.state.templates = res.templates || [];
      this.renderGrid();
    } catch (err) {
      console.error('Error loading templates:', err);
      const container = document.getElementById('templatesGridContainer');
      if (container) {
        container.innerHTML = `
          <div class="card" style="text-align: center; padding: 40px;">
            <p style="color: var(--color-danger); font-weight: 600;">Failed to load email templates</p>
            <p style="color: var(--text-muted); font-size: 0.88rem;">${err.message}</p>
            <button class="btn btn-secondary btn-sm" onclick="TemplatesView.loadTemplates()" style="margin-top: 14px;">Retry</button>
          </div>
        `;
      }
    } finally {
      this.state.isLoading = false;
    }
  },

  async restoreDefaultSamples() {
    if (!confirm('Restore standard recruitment sample template (Campus Placement Drive 2026 - Software Engineer)?')) {
      return;
    }
    try {
      const res = await api.restoreSampleTemplates();
      app.showToast(res.message || 'Standard sample template restored successfully!', 'success');
      await this.loadTemplates();
    } catch (err) {
      app.showToast('Failed to restore sample templates: ' + err.message, 'error');
    }
  },

  getFilteredTemplates() {
    return this.state.templates.filter(tpl => {
      const matchCat = this.state.category === 'all' || 
        (tpl.category || '').toLowerCase() === this.state.category.toLowerCase();

      const q = this.state.search.toLowerCase().trim();
      const matchSearch = !q || 
        (tpl.name || '').toLowerCase().includes(q) ||
        (tpl.subject || '').toLowerCase().includes(q) ||
        (tpl.body_html || '').toLowerCase().includes(q);

      return matchCat && matchSearch;
    });
  },

  renderCategoryPills() {
    const availableCategories = Array.from(new Set(this.state.templates.map(t => t.category).filter(Boolean)));
    const categories = [
      { id: 'all', label: 'All Templates' },
      ...availableCategories.map(c => ({ id: c, label: c }))
    ];

    return categories.map(cat => {
      const active = this.state.category === cat.id;
      return `
        <button class="btn btn-sm ${active ? 'btn-primary' : 'btn-outline'}" 
          style="padding: 4px 12px; font-size: 0.8rem; border-radius: 20px;"
          onclick="TemplatesView.setCategory('${cat.id}')">
          ${cat.label}
        </button>
      `;
    }).join('');
  },

  renderGrid() {
    const gridContainer = document.getElementById('templatesGridContainer');
    const countBadge = document.getElementById('templateCountBadge');
    const pillsContainer = document.getElementById('templateCategoryPills');

    if (countBadge) {
      countBadge.textContent = `${this.state.templates.length} Templates Available`;
    }

    if (pillsContainer) {
      pillsContainer.innerHTML = this.renderCategoryPills();
    }

    if (!gridContainer) return;

    const list = this.getFilteredTemplates();

    if (list.length === 0) {
      gridContainer.innerHTML = `
        <div class="card" style="text-align: center; padding: 60px 20px; border: 2px dashed #cbd5e1;">
          <div style="font-size: 2.5rem; margin-bottom: 12px;">✉️</div>
          <h3 style="font-size: 1.15rem; font-weight: 700; color: #1e293b; margin-bottom: 6px;">No Templates Found</h3>
          <p style="color: var(--text-muted); font-size: 0.88rem; max-width: 420px; margin: 0 auto 20px;">
            ${this.state.search ? `No templates matching "${this.state.search}" in the selected category.` : 'You have not created any templates in this category yet.'}
          </p>
          <button class="btn btn-primary btn-sm" onclick="TemplatesView.openCreateModal()">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            <span>Create New Template</span>
          </button>
        </div>
      `;
      return;
    }

    gridContainer.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 20px;">
        ${list.map(tpl => this.renderTemplateCard(tpl)).join('')}
      </div>
    `;
  },

  renderTemplateCard(tpl) {
    const categoryColors = {
      'Placement Drive': { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
      'Internship': { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
      'Coding Assessment': { bg: '#fef3c7', text: '#b45309', border: '#fde68a' },
      'Interview Shortlist': { bg: '#faf5ff', text: '#7e22ce', border: '#e9d5ff' },
      'Offer Letter': { bg: '#fdf2f8', text: '#be185d', border: '#fbcfe8' },
      'Urgent Reminder': { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' },
      'Hackathon': { bg: '#f3e8ff', text: '#6b21a8', border: '#d8b4fe' },
      'Custom': { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' }
    };

    const catStyle = categoryColors[tpl.category] || categoryColors['Custom'];
    
    let tags = [];
    if (typeof tpl.tags_used === 'string') {
      try { tags = JSON.parse(tpl.tags_used || '[]'); } catch (e) { tags = []; }
    } else if (Array.isArray(tpl.tags_used)) {
      tags = tpl.tags_used;
    }

    const rawSnippet = (tpl.body_html || '').replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim().substring(0, 140);

    return `
      <div class="card" style="display: flex; flex-direction: column; justify-content: space-between; border-radius: var(--radius-md); border: 1px solid var(--border-light); box-shadow: 0 2px 6px rgba(0,0,0,0.03); transition: transform 0.15s, box-shadow 0.15s; padding: 20px;">
        <div>
          <!-- Card Header: Category & Actions -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <span style="font-size: 0.74rem; font-weight: 700; background: ${catStyle.bg}; color: ${catStyle.text}; border: 1px solid ${catStyle.border}; padding: 3px 10px; border-radius: 12px; text-transform: uppercase; letter-spacing: 0.4px;">
              ${tpl.category || 'General'}
            </span>
            <div style="display: flex; gap: 4px;">
              <button class="btn btn-outline btn-sm" style="padding: 4px 8px; font-size: 0.76rem;" onclick="TemplatesView.openEditModal(${tpl.id})" title="Edit Template">
                ✏️ Edit
              </button>
              <button class="btn btn-outline btn-sm" style="padding: 4px 8px; font-size: 0.76rem; color: var(--color-danger); border-color: #fca5a5;" onclick="TemplatesView.confirmDelete(${tpl.id}, '${tpl.name.replace(/'/g, "\\'")}')" title="Delete Template">
                🗑 Delete
              </button>
            </div>
          </div>

          <!-- Template Name & Subject -->
          <h3 style="font-size: 1.05rem; font-weight: 700; color: #0f172a; margin-bottom: 6px;">
            ${tpl.name}
          </h3>
          
          <div style="background: #f8fafc; padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid #e2e8f0; margin-bottom: 12px;">
            <div style="font-size: 0.74rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; margin-bottom: 2px;">Subject:</div>
            <div style="font-size: 0.86rem; font-weight: 600; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${tpl.subject}
            </div>
          </div>

          <!-- Body Snippet -->
          <p style="font-size: 0.83rem; color: #475569; line-height: 1.5; margin-bottom: 14px; min-height: 38px;">
            ${rawSnippet}...
          </p>

          <!-- Dynamic Tags -->
          ${tags.length > 0 ? `
            <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 16px;">
              ${tags.map(tag => `
                <span style="font-family: var(--font-mono, monospace); font-size: 0.72rem; background: #e0f2fe; color: #0369a1; padding: 2px 7px; border-radius: 4px; font-weight: 600;">
                  ${tag}
                </span>
              `).join('')}
            </div>
          ` : ''}
        </div>

        <!-- Card Footer Actions -->
        <div style="display: flex; gap: 8px; border-top: 1px solid #f1f5f9; padding-top: 14px; margin-top: 10px;">
          <button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="TemplatesView.openPreviewModal(${tpl.id})">
            👁 Preview
          </button>
          <button class="btn btn-primary btn-sm" style="flex: 1.3;" onclick="TemplatesView.useInComposer(${tpl.id})">
            🚀 Use in Blast &rarr;
          </button>
        </div>
      </div>
    `;
  },

  handleSearch(query) {
    this.state.search = query;
    this.renderGrid();
  },

  setCategory(cat) {
    this.state.category = cat;
    this.renderGrid();
  },

  useInComposer(templateId) {
    const tpl = this.state.templates.find(t => t.id == templateId);
    if (!tpl) {
      app.showToast('Template not found', 'error');
      return;
    }

    ComposerView.state.selectedTemplateId = tpl.id;
    ComposerView.state.subject = tpl.subject;
    ComposerView.state.bodyHtml = tpl.body_html;
    ComposerView.state.campaignTitle = `${tpl.name} - ${new Date().toLocaleDateString()}`;

    app.navigate('composer', { template_id: tpl.id });
    app.showToast(`Loaded sample template "${tpl.name}" in Email Composer`, 'success');
  },

  openCreateModal() {
    this.state.activeEditorMode = 'visual';
    const categories = ['Placement Drive', 'Internship', 'Coding Assessment', 'Interview Shortlist', 'Offer Letter', 'Announcement', 'Custom'];

    const modalHtml = `
      <div class="modal-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 1.3rem;">✉️</span>
          <div>
            <h2 style="font-size: 1.15rem; font-weight: 700; margin: 0;">Create New Email Template</h2>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">Add a reusable recruitment message with dynamic candidate tags</p>
          </div>
        </div>
        <button class="modal-close" onclick="app.closeModal()">&times;</button>
      </div>

      <div class="modal-body" style="padding: 20px 24px; max-height: 75vh; overflow-y: auto;">
        <form id="templateCreateForm" onsubmit="event.preventDefault(); TemplatesView.handleSaveNewTemplate();">
          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 14px; margin-bottom: 14px;">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Template Name <span style="color: var(--color-danger);">*</span></label>
              <input type="text" id="tplNewName" class="form-input" placeholder="e.g. Pune Campus Placement Drive 2026" required />
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Category</label>
              <select id="tplNewCategory" class="form-select">
                ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- Subject Line with Tag Inserter -->
          <div class="form-group" style="margin-bottom: 14px;">
            <label class="form-label" style="display: flex; justify-content: space-between; align-items: center;">
              <span>Email Subject Line <span style="color: var(--color-danger);">*</span></span>
              <span style="font-size: 0.76rem; color: var(--text-muted);">Use tags like {Name}, {College}</span>
            </label>
            <input type="text" id="tplNewSubject" class="form-input" placeholder="e.g. Invitation: Aparaitech Software Placement Drive - {Name} ({College})" required onfocus="TemplatesView.state.lastFocused = 'subject'" />
          </div>

          <!-- Quick Tag Inserter Pills -->
          <div style="background: #f1f5f9; padding: 10px 14px; border-radius: var(--radius-sm); margin-bottom: 14px; border: 1px solid #e2e8f0;">
            <div style="font-size: 0.76rem; font-weight: 700; color: #475569; margin-bottom: 6px; text-transform: uppercase;">
              ⚡ Quick Tag Inserter (Click to Insert into active field):
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
              ${['{Name}', '{First_Name}', '{College}', '{ApplyLink}', '{Job_Role}', '{Package}', '{Drive_Date}', '{Location}', '{Branch}', '{Batch}'].map(tag => `
                <button type="button" class="btn btn-outline btn-sm" style="padding: 3px 8px; font-size: 0.76rem; font-family: var(--font-mono, monospace); background: #ffffff;" onclick="TemplatesView.insertTag('${tag}', 'create')">
                  ${tag}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Body Editor -->
          <div class="form-group" style="margin-bottom: 0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <label class="form-label" style="margin-bottom: 0;">Email Body HTML <span style="color: var(--color-danger);">*</span></label>
              <div style="display: flex; gap: 6px;">
                <button type="button" class="btn btn-outline btn-sm" style="padding: 2px 8px; font-size: 0.76rem;" onclick="TemplatesView.toggleEditorMode('create')">
                  <span id="tplEditorModeLabel">👁 Visual / &lt;&gt; Code</span>
                </button>
              </div>
            </div>

            <!-- Formatting Toolbar -->
            <div style="display: flex; gap: 4px; background: #f8fafc; padding: 6px; border: 1px solid #cbd5e1; border-bottom: none; border-top-left-radius: var(--radius-sm); border-top-right-radius: var(--radius-sm); flex-wrap: wrap;">
              <button type="button" class="btn btn-outline btn-sm" style="padding: 2px 7px;" onclick="document.execCommand('bold')"><b>B</b></button>
              <button type="button" class="btn btn-outline btn-sm" style="padding: 2px 7px;" onclick="document.execCommand('italic')"><i>I</i></button>
              <button type="button" class="btn btn-outline btn-sm" style="padding: 2px 7px;" onclick="document.execCommand('insertUnorderedList')">&bull; List</button>
              <button type="button" class="btn btn-outline btn-sm" style="padding: 2px 7px;" onclick="TemplatesView.insertButtonHtml('create')">🔗 Add Apply Button</button>
            </div>

            <div id="tplCreateVisualEditor" contenteditable="true" style="min-height: 220px; max-height: 320px; overflow-y: auto; padding: 14px; background: #ffffff; border: 1px solid #cbd5e1; border-bottom-left-radius: var(--radius-sm); border-bottom-right-radius: var(--radius-sm); line-height: 1.6; font-size: 0.9rem;" onfocus="TemplatesView.state.lastFocused = 'body'">
              <p>Dear {Name},</p>
              <p>We are delighted to invite students from <strong>{College}</strong> to participate in the upcoming <strong>Aparaitech Software Campus Recruitment Drive 2026</strong> for the role of <strong>{Job_Role}</strong> (Annual Package: <strong>{Package}</strong>).</p>
              <p>Please register and confirm your candidature using the official recruitment portal below:</p>
              <div style="text-align: center; margin: 20px 0;">
                <a href="{ApplyLink}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 28px; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 6px;">Apply Now &amp; Register &rarr;</a>
              </div>
              <p>Best regards,<br/><strong>Aparaitech Software Recruitment Engineering</strong><br/>Bengaluru &amp; Pune / Baramati Tech Centers</p>
            </div>

            <textarea id="tplCreateSourceEditor" class="form-textarea" style="display: none; font-family: var(--font-mono, monospace); font-size: 0.84rem; min-height: 220px;"></textarea>
          </div>
        </form>
      </div>

      <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 10px; padding: 16px 24px;">
        <button class="btn btn-outline btn-sm" onclick="app.closeModal()">Cancel</button>
        <button class="btn btn-primary btn-sm" onclick="TemplatesView.handleSaveNewTemplate()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
          <span>Save Email Template</span>
        </button>
      </div>
    `;

    app.openModal(modalHtml);
  },

  openEditModal(templateId) {
    const tpl = this.state.templates.find(t => t.id == templateId);
    if (!tpl) {
      app.showToast('Template not found', 'error');
      return;
    }

    this.state.activeEditorMode = 'visual';
    const categories = ['Placement Drive', 'Internship', 'Coding Assessment', 'Interview Shortlist', 'Offer Letter', 'Announcement', 'Custom'];

    const modalHtml = `
      <div class="modal-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 1.3rem;">✏️</span>
          <div>
            <h2 style="font-size: 1.15rem; font-weight: 700; margin: 0;">Edit Email Template</h2>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">Update template parameters and message content</p>
          </div>
        </div>
        <button class="modal-close" onclick="app.closeModal()">&times;</button>
      </div>

      <div class="modal-body" style="padding: 20px 24px; max-height: 75vh; overflow-y: auto;">
        <form id="templateEditForm" onsubmit="event.preventDefault(); TemplatesView.handleUpdateTemplate(${tpl.id});">
          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 14px; margin-bottom: 14px;">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Template Name <span style="color: var(--color-danger);">*</span></label>
              <input type="text" id="tplEditName" class="form-input" value="${tpl.name.replace(/"/g, '&quot;')}" required />
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label">Category</label>
              <select id="tplEditCategory" class="form-select">
                ${categories.map(c => `<option value="${c}" ${tpl.category === c ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 14px;">
            <label class="form-label" style="display: flex; justify-content: space-between; align-items: center;">
              <span>Email Subject Line <span style="color: var(--color-danger);">*</span></span>
              <span style="font-size: 0.76rem; color: var(--text-muted);">Dynamic tags supported</span>
            </label>
            <input type="text" id="tplEditSubject" class="form-input" value="${tpl.subject.replace(/"/g, '&quot;')}" required onfocus="TemplatesView.state.lastFocused = 'subject'" />
          </div>

          <!-- Quick Tag Inserter -->
          <div style="background: #f1f5f9; padding: 10px 14px; border-radius: var(--radius-sm); margin-bottom: 14px; border: 1px solid #e2e8f0;">
            <div style="font-size: 0.76rem; font-weight: 700; color: #475569; margin-bottom: 6px; text-transform: uppercase;">
              ⚡ Insert Tag into active field:
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
              ${['{Name}', '{First_Name}', '{College}', '{ApplyLink}', '{Job_Role}', '{Package}', '{Drive_Date}', '{Location}', '{Branch}', '{Batch}'].map(tag => `
                <button type="button" class="btn btn-outline btn-sm" style="padding: 3px 8px; font-size: 0.76rem; font-family: var(--font-mono, monospace); background: #ffffff;" onclick="TemplatesView.insertTag('${tag}', 'edit')">
                  ${tag}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Body Editor -->
          <div class="form-group" style="margin-bottom: 0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <label class="form-label" style="margin-bottom: 0;">Email Body HTML <span style="color: var(--color-danger);">*</span></label>
              <div style="display: flex; gap: 6px;">
                <button type="button" class="btn btn-outline btn-sm" style="padding: 2px 8px; font-size: 0.76rem;" onclick="TemplatesView.toggleEditorMode('edit')">
                  <span id="tplEditorModeLabel">👁 Visual / &lt;&gt; Code</span>
                </button>
              </div>
            </div>

            <div style="display: flex; gap: 4px; background: #f8fafc; padding: 6px; border: 1px solid #cbd5e1; border-bottom: none; border-top-left-radius: var(--radius-sm); border-top-right-radius: var(--radius-sm); flex-wrap: wrap;">
              <button type="button" class="btn btn-outline btn-sm" style="padding: 2px 7px;" onclick="document.execCommand('bold')"><b>B</b></button>
              <button type="button" class="btn btn-outline btn-sm" style="padding: 2px 7px;" onclick="document.execCommand('italic')"><i>I</i></button>
              <button type="button" class="btn btn-outline btn-sm" style="padding: 2px 7px;" onclick="document.execCommand('insertUnorderedList')">&bull; List</button>
              <button type="button" class="btn btn-outline btn-sm" style="padding: 2px 7px;" onclick="TemplatesView.insertButtonHtml('edit')">🔗 Add Apply Button</button>
            </div>

            <div id="tplEditVisualEditor" contenteditable="true" style="min-height: 220px; max-height: 320px; overflow-y: auto; padding: 14px; background: #ffffff; border: 1px solid #cbd5e1; border-bottom-left-radius: var(--radius-sm); border-bottom-right-radius: var(--radius-sm); line-height: 1.6; font-size: 0.9rem;" onfocus="TemplatesView.state.lastFocused = 'body'">
              ${tpl.body_html}
            </div>

            <textarea id="tplEditSourceEditor" class="form-textarea" style="display: none; font-family: var(--font-mono, monospace); font-size: 0.84rem; min-height: 220px;">${tpl.body_html.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
          </div>
        </form>
      </div>

      <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 10px; padding: 16px 24px;">
        <button class="btn btn-outline btn-sm" onclick="app.closeModal()">Cancel</button>
        <button class="btn btn-primary btn-sm" onclick="TemplatesView.handleUpdateTemplate(${tpl.id})">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>Save Changes</span>
        </button>
      </div>
    `;

    app.openModal(modalHtml);
  },

  toggleEditorMode(prefix) {
    const visual = document.getElementById(`tpl${prefix === 'create' ? 'Create' : 'Edit'}VisualEditor`);
    const source = document.getElementById(`tpl${prefix === 'create' ? 'Create' : 'Edit'}SourceEditor`);

    if (source.style.display === 'none') {
      source.value = visual.innerHTML;
      source.style.display = 'block';
      visual.style.display = 'none';
      this.state.activeEditorMode = 'source';
    } else {
      visual.innerHTML = source.value;
      visual.style.display = 'block';
      source.style.display = 'none';
      this.state.activeEditorMode = 'visual';
    }
  },

  insertTag(tag, prefix) {
    if (this.state.lastFocused === 'subject') {
      const input = document.getElementById(`tpl${prefix === 'create' ? 'New' : 'Edit'}Subject`);
      if (input) {
        const start = input.selectionStart || input.value.length;
        const end = input.selectionEnd || input.value.length;
        input.value = input.value.substring(0, start) + tag + input.value.substring(end);
        input.focus();
        input.selectionStart = input.selectionEnd = start + tag.length;
      }
    } else {
      if (this.state.activeEditorMode === 'source') {
        const textarea = document.getElementById(`tpl${prefix === 'create' ? 'Create' : 'Edit'}SourceEditor`);
        if (textarea) {
          const start = textarea.selectionStart || textarea.value.length;
          const end = textarea.selectionEnd || textarea.value.length;
          textarea.value = textarea.value.substring(0, start) + tag + textarea.value.substring(end);
          textarea.focus();
          textarea.selectionStart = textarea.selectionEnd = start + tag.length;
        }
      } else {
        document.execCommand('insertText', false, tag);
      }
    }
  },

  insertButtonHtml(prefix) {
    const btnHtml = `
      <div style="text-align: center; margin: 20px 0;">
        <a href="{ApplyLink}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 28px; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 6px;">Apply Now &amp; Register &rarr;</a>
      </div>
    `;
    if (this.state.activeEditorMode === 'source') {
      const textarea = document.getElementById(`tpl${prefix === 'create' ? 'Create' : 'Edit'}SourceEditor`);
      if (textarea) textarea.value += btnHtml;
    } else {
      document.execCommand('insertHTML', false, btnHtml);
    }
  },

  async handleSaveNewTemplate() {
    const name = (document.getElementById('tplNewName')?.value || '').trim();
    const category = document.getElementById('tplNewCategory')?.value || 'Placement Drive';
    const subject = (document.getElementById('tplNewSubject')?.value || '').trim();
    
    let body_html = '';
    if (this.state.activeEditorMode === 'source') {
      body_html = document.getElementById('tplCreateSourceEditor')?.value || '';
    } else {
      body_html = document.getElementById('tplCreateVisualEditor')?.innerHTML || '';
    }

    if (!name || !subject || !body_html.trim()) {
      app.showToast('Please provide Template Name, Subject line, and Body content', 'warning');
      return;
    }

    try {
      const res = await api.createTemplate({ name, category, subject, body_html });
      app.closeModal();
      app.showToast(`Template "${res.template?.name || name}" saved successfully!`, 'success');
      await this.loadTemplates();

      if (typeof ComposerView !== 'undefined' && ComposerView.state) {
        ComposerView.state.templates = this.state.templates;
      }
    } catch (err) {
      app.showToast(`Failed to save template: ${err.message}`, 'error');
    }
  },

  async handleUpdateTemplate(templateId) {
    const name = (document.getElementById('tplEditName')?.value || '').trim();
    const category = document.getElementById('tplEditCategory')?.value || 'Placement Drive';
    const subject = (document.getElementById('tplEditSubject')?.value || '').trim();
    
    let body_html = '';
    if (this.state.activeEditorMode === 'source') {
      body_html = document.getElementById('tplEditSourceEditor')?.value || '';
    } else {
      body_html = document.getElementById('tplEditVisualEditor')?.innerHTML || '';
    }

    if (!name || !subject || !body_html.trim()) {
      app.showToast('Please provide Template Name, Subject line, and Body content', 'warning');
      return;
    }

    try {
      const res = await api.updateTemplate(templateId, { name, category, subject, body_html });
      app.closeModal();
      app.showToast(`Template "${res.template?.name || name}" updated successfully!`, 'success');
      await this.loadTemplates();

      if (typeof ComposerView !== 'undefined' && ComposerView.state) {
        ComposerView.state.templates = this.state.templates;
      }
    } catch (err) {
      app.showToast(`Failed to update template: ${err.message}`, 'error');
    }
  },

  confirmDelete(templateId, templateName) {
    const modalHtml = `
      <div class="modal-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 1.3rem;">⚠️</span>
          <div>
            <h2 style="font-size: 1.15rem; font-weight: 700; margin: 0; color: var(--color-danger);">Remove Template</h2>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">Confirm permanent deletion of email preset</p>
          </div>
        </div>
        <button class="modal-close" onclick="app.closeModal()">&times;</button>
      </div>

      <div class="modal-body" style="padding: 24px;">
        <p style="font-size: 0.92rem; color: #334155; line-height: 1.5; margin: 0 0 16px;">
          Are you sure you want to delete template <strong>"${templateName}"</strong>?
        </p>
        <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: var(--radius-sm); font-size: 0.84rem; color: #991b1b;">
          This template preset will be permanently removed and will no longer be available in the Email Composer.
        </div>
      </div>

      <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 10px; padding: 16px 24px;">
        <button class="btn btn-outline btn-sm" onclick="app.closeModal()">Cancel</button>
        <button class="btn btn-sm" style="background: #dc2626; color: #ffffff; border: none; font-weight: 600;" onclick="TemplatesView.handleDeleteTemplate(${templateId})">
          🗑 Delete Permanently
        </button>
      </div>
    `;

    app.openModal(modalHtml);
  },

  async handleDeleteTemplate(templateId) {
    try {
      await api.deleteTemplate(templateId);
      app.closeModal();
      app.showToast('Template deleted successfully', 'info');
      await this.loadTemplates();

      if (typeof ComposerView !== 'undefined' && ComposerView.state) {
        ComposerView.state.templates = this.state.templates;
        if (ComposerView.state.selectedTemplateId == templateId) {
          ComposerView.state.selectedTemplateId = null;
        }
      }
    } catch (err) {
      app.showToast(`Failed to delete template: ${err.message}`, 'error');
    }
  },

  async openPreviewModal(templateId) {
    const tpl = this.state.templates.find(t => t.id == templateId);
    if (!tpl) return;

    try {
      const previewRes = await api.renderPreview({
        subject: tpl.subject,
        body_html: tpl.body_html,
        apply_link: 'https://aparaitech.org/apply'
      });

      const student = previewRes.student || { name: 'Rahul Sharma', college: 'IIT Bombay' };

      const modalHtml = `
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.3rem;">👁</span>
            <div>
              <h2 style="font-size: 1.15rem; font-weight: 700; margin: 0;">Template Preview: "${tpl.name}"</h2>
              <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0;">Personalized rendering for candidate: <strong>${student.name}</strong> (${student.college})</p>
            </div>
          </div>
          <button class="modal-close" onclick="app.closeModal()">&times;</button>
        </div>

        <div class="modal-body" style="padding: 20px 24px; max-height: 70vh; overflow-y: auto;">
          <div style="background: #f8fafc; padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid #e2e8f0; margin-bottom: 16px;">
            <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Rendered Subject:</div>
            <div style="font-size: 0.95rem; font-weight: 700; color: #0f172a;">${previewRes.renderedSubject}</div>
          </div>

          <div style="font-size: 0.78rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">Rendered Body Content:</div>
          <div style="background: #ffffff; padding: 24px; border: 1px solid #e2e8f0; border-radius: var(--radius-md); box-shadow: 0 1px 3px rgba(0,0,0,0.05); line-height: 1.6; font-size: 0.92rem; color: #1e293b;">
            ${previewRes.renderedBody}
          </div>
        </div>

        <div class="modal-footer" style="display: flex; justify-content: space-between; padding: 16px 24px;">
          <button class="btn btn-outline btn-sm" onclick="app.closeModal()">Close</button>
          <button class="btn btn-primary btn-sm" onclick="app.closeModal(); TemplatesView.useInComposer(${tpl.id});">
            🚀 Use This Template in Composer &rarr;
          </button>
        </div>
      `;

      app.openModal(modalHtml);
    } catch (err) {
      app.showToast(`Preview error: ${err.message}`, 'error');
    }
  }
};
