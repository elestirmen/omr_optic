/**
 * OMRChecker Web Interface - Templates Page
 */

const API_BASE = '';
let templates = [];
let currentTemplate = null;

// DOM Elements
const templateGrid = document.getElementById('template-grid');
const templateModal = document.getElementById('template-modal');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadTemplates();

    document.getElementById('create-template-btn')?.addEventListener('click', () => {
        window.location.href = 'template-editor.html';
    });

    document.getElementById('use-template-btn')?.addEventListener('click', useCurrentTemplate);
});

// Load templates
async function loadTemplates() {
    templateGrid.innerHTML = `
        <div class="loading-spinner">
            <div class="spinner"></div>
            <p>Şablonlar yükleniyor...</p>
        </div>
    `;

    try {
        const response = await fetch(`${API_BASE}/api/templates`);
        const data = await response.json();

        templates = data.templates || [];

        if (templates.length === 0) {
            templateGrid.innerHTML = `
                <div class="results-empty" style="grid-column: 1/-1;">
                    <span class="empty-icon">📝</span>
                    <p>Henüz şablon bulunamadı</p>
                    <p style="color: var(--text-muted); font-size: 0.875rem;">
                        samples/ klasörüne template.json dosyası ekleyin
                    </p>
                </div>
            `;
            return;
        }

        displayTemplates();

    } catch (error) {
        console.error('Error loading templates:', error);
        templateGrid.innerHTML = `
            <div class="results-empty" style="grid-column: 1/-1;">
                <span class="empty-icon">❌</span>
                <p>Şablonlar yüklenemedi</p>
                <small>${error.message}</small>
            </div>
        `;
    }
}

// Display templates in grid
function displayTemplates() {
    templateGrid.innerHTML = templates.map(template => `
        <div class="template-card" onclick="showTemplateDetails('${template.id}')">
            <div class="template-icon">📋</div>
            <h3>${template.name}</h3>
            <p>${template.fieldBlocks?.length || 0} alan bloğu</p>
            <div class="template-meta">
                <span>📐 ${template.pageDimensions?.[0] || '?'} x ${template.pageDimensions?.[1] || '?'}</span>
                ${template.hasMarker ? '<span>🎯 Marker</span>' : ''}
            </div>
        </div>
    `).join('');
}

// Show template details in modal
async function showTemplateDetails(templateId) {
    try {
        const response = await fetch(`${API_BASE}/api/templates/${templateId}`);
        currentTemplate = await response.json();

        // Update modal content
        document.getElementById('template-name').textContent = currentTemplate.id || 'Şablon Detayları';

        // Page dimensions
        const dims = currentTemplate.pageDimensions || [];
        document.getElementById('detail-width').textContent = dims[0] || '-';
        document.getElementById('detail-height').textContent = dims[1] || '-';

        // Bubble dimensions
        const bubbleDims = currentTemplate.bubbleDimensions || [];
        document.getElementById('detail-bubble-width').textContent = bubbleDims[0] || '-';
        document.getElementById('detail-bubble-height').textContent = bubbleDims[1] || '-';

        // Field blocks
        const blocksList = document.getElementById('blocks-list');
        const fieldBlocks = currentTemplate.fieldBlocks || {};
        if (Object.keys(fieldBlocks).length > 0) {
            blocksList.innerHTML = Object.entries(fieldBlocks).map(([name, block]) => `
                <div style="background: var(--bg-input); padding: 8px 12px; border-radius: 6px; margin-bottom: 4px;">
                    <strong>${name}</strong>
                    <span style="color: var(--text-muted); margin-left: 8px;">
                        ${block.fieldType || 'CUSTOM'}
                    </span>
                </div>
            `).join('');
        } else {
            blocksList.innerHTML = '<p style="color: var(--text-muted);">Alan bloğu yok</p>';
        }

        // Preprocessors
        const processorsList = document.getElementById('processors-list');
        const preProcessors = currentTemplate.preProcessors || [];
        if (preProcessors.length > 0) {
            processorsList.innerHTML = preProcessors.map(proc => `
                <div style="background: var(--bg-input); padding: 8px 12px; border-radius: 6px; margin-bottom: 4px;">
                    ⚙️ ${proc.name}
                </div>
            `).join('');
        } else {
            processorsList.innerHTML = '<p style="color: var(--text-muted);">Ön işlemci yok</p>';
        }

        // JSON content
        const jsonContent = document.getElementById('template-json-content');
        jsonContent.textContent = JSON.stringify(currentTemplate, null, 2);

        // Show modal
        templateModal.classList.add('active');

    } catch (error) {
        console.error('Error loading template details:', error);
        alert('Şablon detayları yüklenemedi: ' + error.message);
    }
}

// Close template modal
function closeTemplateModal() {
    templateModal.classList.remove('active');
    currentTemplate = null;
}

// Use current template (redirect to process page)
function useCurrentTemplate() {
    if (currentTemplate && currentTemplate.id) {
        window.location.href = `process.html?template=${currentTemplate.id}`;
    }
}

// Close modal on click outside
templateModal?.addEventListener('click', (e) => {
    if (e.target === templateModal) {
        closeTemplateModal();
    }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && templateModal?.classList.contains('active')) {
        closeTemplateModal();
    }
});
