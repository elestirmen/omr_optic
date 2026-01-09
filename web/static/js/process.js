/**
 * OMRChecker Web Interface - Process Page
 */

const API_BASE = '';
let uploadedFiles = [];
let uploadedFileKeys = new Set();
let sessionId = null;
let templateFromUrl = null;

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tif', '.tiff']);

function getDisplayName(file) {
    return file.webkitRelativePath || file.name || '';
}

function getFileKey(file) {
    return `${getDisplayName(file)}::${file.size}::${file.lastModified}`;
}

function isImageFile(file) {
    if (file?.type && file.type.startsWith('image/')) return true;
    const name = (file?.name || '').toLowerCase();
    for (const ext of IMAGE_EXTENSIONS) {
        if (name.endsWith(ext)) return true;
    }
    return false;
}

// DOM Elements
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const folderInput = document.getElementById('folder-input');
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
const downloadExcelBtn = document.getElementById('download-excel');
const processedImages = document.getElementById('processed-images');
const imageGrid = document.getElementById('image-grid');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkUrlParams();
    loadTemplates();
    setupDropzone();
    setupFileInput();
    setupButtons();
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

            // Preselect from URL, otherwise default to "kapadokya" if available.
            if (templateFromUrl) {
                templateSelect.value = templateFromUrl;
            } else if (templateSelect.querySelector('option[value=\"kapadokya\"]')) {
                templateSelect.value = 'kapadokya';
            }
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

    dropzone.addEventListener('click', (e) => {
        // Butonlara tıklandığında dosya seçiciyi tekrar açma
        if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
            return;
        }
        fileInput.click();
    });
}

// File input setup
function setupFileInput() {
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    folderInput?.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });
}

// Button setup
function setupButtons() {
    clearFilesBtn.addEventListener('click', clearFiles);
    processBtn.addEventListener('click', processFiles);
    downloadCsvBtn.addEventListener('click', downloadCSV);
    downloadExcelBtn?.addEventListener('click', downloadExcel);
}

// Handle file selection
function handleFiles(files) {
    const imageFiles = Array.from(files).filter(isImageFile);

    imageFiles.forEach(file => {
        const key = getFileKey(file);
        if (!uploadedFileKeys.has(key)) {
            uploadedFiles.push(file);
            uploadedFileKeys.add(key);
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
                <span>${getDisplayName(file)}</span>
            </div>
            <span class="file-item-size">${formatFileSize(file.size)}</span>
            <span class="file-item-remove" onclick="removeFile(${index})">✕</span>
        </div>
    `).join('');
}

// Remove file from list
function removeFile(index) {
    const removed = uploadedFiles.splice(index, 1)[0];
    if (removed) uploadedFileKeys.delete(getFileKey(removed));
    updateFileList();
}

// Clear all files
function clearFiles() {
    uploadedFiles = [];
    fileInput.value = '';
    folderInput.value = '';
    uploadedFileKeys.clear();
    updateFileList();
}

// Format file size
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

const MAX_UPLOAD_BYTES_PER_REQUEST = 30 * 1024 * 1024; // keep well under server 50MB limit
const MAX_FILES_PER_REQUEST = 30;

function chunkFilesForUpload(files) {
    const chunks = [];
    let current = [];
    let currentBytes = 0;

    for (const file of files) {
        const fileBytes = file?.size || 0;
        const wouldExceedBytes = currentBytes + fileBytes > MAX_UPLOAD_BYTES_PER_REQUEST;
        const wouldExceedCount = current.length >= MAX_FILES_PER_REQUEST;

        if (current.length > 0 && (wouldExceedBytes || wouldExceedCount)) {
            chunks.push(current);
            current = [];
            currentBytes = 0;
        }

        current.push(file);
        currentBytes += fileBytes;
    }

    if (current.length > 0) chunks.push(current);
    return chunks;
}

async function readJsonResponse(response) {
    const text = await response.text();
    try {
        return JSON.parse(text);
    } catch {
        return { error: text };
    }
}

async function uploadFilesInChunks(files) {
    const chunks = chunkFilesForUpload(files);
    let sid = null;

    for (let i = 0; i < chunks.length; i++) {
        progressText.textContent = `Dosyalar yukleniyor... (${i + 1}/${chunks.length})`;
        progressFill.style.width = `${Math.round((i / chunks.length) * 40)}%`;

        const formData = new FormData();
        if (sid) formData.append('session_id', sid);

        chunks[i].forEach(file => {
            const filename = getDisplayName(file) || file.name;
            formData.append('files', file, filename);
        });

        const uploadResponse = await fetch(`${API_BASE}/api/upload`, {
            method: 'POST',
            body: formData
        });

        const uploadData = await readJsonResponse(uploadResponse);

        if (!uploadResponse.ok || !uploadData.success) {
            throw new Error(uploadData.error || uploadResponse.statusText || 'Upload failed');
        }

        sid = uploadData.session_id;
        progressFill.style.width = `${Math.round(((i + 1) / chunks.length) * 40)}%`;
    }

    return sid;
}

// Process files
async function processFiles() {
    if (uploadedFiles.length === 0 && !sessionId) return;

    processBtn.disabled = true;
    progressSection.style.display = 'block';
    progressFill.style.width = '0%';
    progressFill.style.background = '';
    progressText.textContent = uploadedFiles.length > 0 ? 'Dosyalar yükleniyor...' : 'Oturum işleniyor...';

    try {
        if (uploadedFiles.length > 0) {
            const filesToUpload = [...uploadedFiles].sort((a, b) =>
                getDisplayName(a).localeCompare(getDisplayName(b))
            );
            sessionId = await uploadFilesInChunks(filesToUpload);
            progressFill.style.width = '50%';
            progressText.textContent = 'OMR işleniyor...';
        } else {
            progressFill.style.width = '30%';
            progressText.textContent = 'OMR işleniyor...';
        }

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
    } finally {
        processBtn.disabled = uploadedFiles.length === 0 && !sessionId;
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
        if (downloadExcelBtn) downloadExcelBtn.disabled = false;
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
        window.open(`${API_BASE}/api/results/${sessionId}/csv?kind=all`, '_blank');
    }
}

function downloadExcel() {
    if (sessionId) {
        window.open(`${API_BASE}/api/results/${sessionId}/excel?kind=all`, '_blank');
    }
}

// Check URL params for session
function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const session = params.get('session');
    const template = params.get('template');

    if (session) {
        sessionId = session;
        loadSessionResults(session);
        processBtn.disabled = false;
    }

    if (template) {
        templateFromUrl = template;
        if (templateSelect?.options?.length) {
            templateSelect.value = templateFromUrl;
        }
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
