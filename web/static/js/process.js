/**
 * OMRChecker Web Interface - Process Page
 */

const API_BASE = '';
let uploadedFiles = [];
let sessionId = null;

// DOM Elements
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const fileItems = document.getElementById('file-items');
const clearFilesBtn = document.getElementById('clear-files');
const processBtn = document.getElementById('process-btn');
const templateSelect = document.getElementById('template-select');
const progressSection = document.getElementById('progress-section');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const resultsContainer = document.getElementById('results-container');
const resultsTableContainer = document.getElementById('results-table-container');
const downloadCsvBtn = document.getElementById('download-csv');
const processedImages = document.getElementById('processed-images');
const imageGrid = document.getElementById('image-grid');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadTemplates();
    setupDropzone();
    setupFileInput();
    setupButtons();
    checkUrlParams();
});

// Load templates
async function loadTemplates() {
    try {
        const response = await fetch(`${API_BASE}/api/templates`);
        const data = await response.json();

        if (data.templates && data.templates.length > 0) {
            templateSelect.innerHTML = '<option value="">-- Şablon Seçin (Opsiyonel) --</option>';
            data.templates.forEach(template => {
                const option = document.createElement('option');
                option.value = template.id;
                option.textContent = template.name;
                templateSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading templates:', error);
    }
}

// Dropzone setup
function setupDropzone() {
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    dropzone.addEventListener('click', () => {
        fileInput.click();
    });
}

// File input setup
function setupFileInput() {
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });
}

// Button setup
function setupButtons() {
    clearFilesBtn.addEventListener('click', clearFiles);
    processBtn.addEventListener('click', processFiles);
    downloadCsvBtn.addEventListener('click', downloadCSV);
}

// Handle file selection
function handleFiles(files) {
    const imageFiles = Array.from(files).filter(file =>
        file.type.startsWith('image/')
    );

    imageFiles.forEach(file => {
        if (!uploadedFiles.some(f => f.name === file.name && f.size === file.size)) {
            uploadedFiles.push(file);
        }
    });

    updateFileList();
}

// Update file list display
function updateFileList() {
    if (uploadedFiles.length === 0) {
        fileItems.innerHTML = '';
        clearFilesBtn.style.display = 'none';
        processBtn.disabled = true;
        return;
    }

    clearFilesBtn.style.display = 'block';
    processBtn.disabled = false;

    fileItems.innerHTML = uploadedFiles.map((file, index) => `
        <div class="file-item">
            <div class="file-item-name">
                <span>📄</span>
                <span>${file.name}</span>
            </div>
            <span class="file-item-size">${formatFileSize(file.size)}</span>
            <span class="file-item-remove" onclick="removeFile(${index})">✕</span>
        </div>
    `).join('');
}

// Remove file from list
function removeFile(index) {
    uploadedFiles.splice(index, 1);
    updateFileList();
}

// Clear all files
function clearFiles() {
    uploadedFiles = [];
    fileInput.value = '';
    updateFileList();
}

// Format file size
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Process files
async function processFiles() {
    if (uploadedFiles.length === 0) return;

    processBtn.disabled = true;
    progressSection.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.textContent = 'Dosyalar yükleniyor...';

    try {
        // Upload files
        const formData = new FormData();
        uploadedFiles.forEach(file => {
            formData.append('files', file);
        });

        progressFill.style.width = '30%';

        const uploadResponse = await fetch(`${API_BASE}/api/upload`, {
            method: 'POST',
            body: formData
        });

        const uploadData = await uploadResponse.json();

        if (!uploadData.success) {
            throw new Error(uploadData.error || 'Upload failed');
        }

        sessionId = uploadData.session_id;
        progressFill.style.width = '50%';
        progressText.textContent = 'OMR işleniyor...';

        // Process OMR
        const processResponse = await fetch(`${API_BASE}/api/process`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                session_id: sessionId,
                template_id: templateSelect.value || null
            })
        });

        const processData = await processResponse.json();

        progressFill.style.width = '100%';
        progressText.textContent = 'Tamamlandı!';

        // Save to recent sessions
        if (window.OMR && window.OMR.saveRecentSession) {
            window.OMR.saveRecentSession({
                id: sessionId,
                name: `${uploadedFiles.length} dosya`,
                date: new Date().toISOString(),
                type: 'upload',
                status: processData.status === 'completed' ? 'success' : 'pending'
            });
        }

        // Display results
        displayResults(processData);

    } catch (error) {
        progressText.textContent = 'Hata: ' + error.message;
        progressFill.style.width = '100%';
        progressFill.style.background = 'var(--accent-danger)';
    }
}

// Display results
function displayResults(data) {
    if (data.error) {
        resultsContainer.innerHTML = `
            <div class="results-empty">
                <span class="empty-icon">❌</span>
                <p>Hata: ${data.error}</p>
            </div>
        `;
        return;
    }

    resultsContainer.innerHTML = `
        <div class="result-summary" style="text-align: center; padding: var(--spacing-lg);">
            <p style="color: var(--accent-success); font-size: 1.25rem; margin-bottom: var(--spacing-md);">
                ✅ İşlem tamamlandı!
            </p>
            <p style="color: var(--text-secondary);">
                ${data.summary?.total_sheets || 0} form işlendi
            </p>
        </div>
    `;

    // Show table if data exists
    if (data.data && data.data.length > 0) {
        displayTable(data.data, data.summary?.columns || []);
    }

    // Show processed images
    if (data.files && data.files.length > 0) {
        displayProcessedImages(data.files);
    }

    // Enable CSV download
    if (data.csv_available) {
        downloadCsvBtn.disabled = false;
    }
}

// Display results table
function displayTable(data, columns) {
    const headerRow = document.getElementById('results-header');
    const tbody = document.getElementById('results-body');

    // Header
    headerRow.innerHTML = columns.map(col => `<th>${col}</th>`).join('');

    // Body
    tbody.innerHTML = data.map(row => `
        <tr>
            ${columns.map(col => `<td>${row[col] !== undefined ? row[col] : '-'}</td>`).join('')}
        </tr>
    `).join('');

    resultsTableContainer.style.display = 'block';
}

// Display processed images
function displayProcessedImages(files) {
    imageGrid.innerHTML = files.map(file => `
        <div class="image-item" onclick="showImageModal('${file.url}')">
            <img src="${file.url}" alt="${file.name}" loading="lazy">
        </div>
    `).join('');

    processedImages.style.display = 'block';
}

// Show image modal
function showImageModal(url) {
    const modal = document.getElementById('image-modal');
    const modalImage = document.getElementById('modal-image');
    modalImage.src = url;
    modal.classList.add('active');
}

// Close modal
function closeModal() {
    const modal = document.getElementById('image-modal');
    modal.classList.remove('active');
}

// Download CSV
function downloadCSV() {
    if (sessionId) {
        window.open(`${API_BASE}/api/results/${sessionId}/csv`, '_blank');
    }
}

// Check URL params for session
function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const session = params.get('session');

    if (session) {
        sessionId = session;
        loadSessionResults(session);
    }
}

// Load existing session results
async function loadSessionResults(sid) {
    try {
        progressSection.style.display = 'block';
        progressText.textContent = 'Sonuçlar yükleniyor...';
        progressFill.style.width = '50%';

        const response = await fetch(`${API_BASE}/api/results/${sid}`);
        const data = await response.json();

        progressFill.style.width = '100%';
        progressText.textContent = 'Yüklendi!';

        displayResults(data);
    } catch (error) {
        progressText.textContent = 'Sonuçlar yüklenemedi';
    }
}

// Close modal on click outside
document.getElementById('image-modal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        closeModal();
    }
});
