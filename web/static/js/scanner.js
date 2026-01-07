/**
 * OMRChecker Web Interface - Scanner Page
 */

const API_BASE = '';
let selectedDevice = null;
let isScanning = false;
let currentSessionId = null;

// DOM Elements
const deviceSelect = document.getElementById('device-select');
const refreshDevicesBtn = document.getElementById('refresh-devices');
const scanBtn = document.getElementById('scan-btn');
const cancelBtn = document.getElementById('cancel-btn');
const useAdfCheckbox = document.getElementById('use-adf');
const autoProcessCheckbox = document.getElementById('auto-process');
const showUiCheckbox = document.getElementById('show-ui');
const scanTemplateSelect = document.getElementById('scan-template');
const scanStatus = document.getElementById('scan-status');
const scanProgress = document.getElementById('scan-progress');
const pagesCount = document.getElementById('pages-count');
const scanResults = document.getElementById('scan-results');
const scannedPages = document.getElementById('scanned-pages');
const pageThumbnails = document.getElementById('page-thumbnails');

// Platform info
const platformInfo = document.getElementById('platform-info');
const protocolInfo = document.getElementById('protocol-info');
const adfInfo = document.getElementById('adf-info');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadDevices();
    loadTemplates();
    setupEventListeners();
    setupWebSocket();
});

// Load scanner devices
async function loadDevices() {
    deviceSelect.innerHTML = '<option value="">-- Cihazlar aranıyor... --</option>';

    try {
        const response = await fetch(`${API_BASE}/api/scanner/devices`);
        const data = await response.json();

        deviceSelect.innerHTML = '<option value="">-- Tarayıcı Seçin --</option>';

        if (data.devices && data.devices.length > 0) {
            data.devices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.id;
                option.textContent = `${device.name} (${device.type})`;
                option.dataset.adf = device.adf_capable;
                deviceSelect.appendChild(option);
            });
        } else {
            deviceSelect.innerHTML = '<option value="">-- Tarayıcı bulunamadı --</option>';
        }

        // Update platform info
        const statusResponse = await fetch(`${API_BASE}/api/scanner/status`);
        const statusData = await statusResponse.json();

        platformInfo.textContent = statusData.platform || 'Bilinmiyor';
        protocolInfo.textContent = statusData.scanner_type === 'twain' ? 'TWAIN' :
            statusData.scanner_type === 'sane' ? 'SANE' : 'Simülatör';

    } catch (error) {
        console.error('Error loading devices:', error);
        deviceSelect.innerHTML = '<option value="">-- Bağlantı hatası --</option>';
    }
}

// Load templates for scanning
async function loadTemplates() {
    try {
        const response = await fetch(`${API_BASE}/api/templates`);
        const data = await response.json();

        scanTemplateSelect.innerHTML = '<option value="">-- Şablon Seçin --</option>';

        if (data.templates) {
            data.templates.forEach(template => {
                const option = document.createElement('option');
                option.value = template.id;
                option.textContent = template.name;
                scanTemplateSelect.appendChild(option);
            });

            if (scanTemplateSelect.querySelector('option[value=\"kapadokya\"]')) {
                scanTemplateSelect.value = 'kapadokya';
            }
        }
    } catch (error) {
        console.error('Error loading templates:', error);
    }
}

// Setup event listeners
function setupEventListeners() {
    refreshDevicesBtn.addEventListener('click', loadDevices);
    scanBtn.addEventListener('click', startScan);
    cancelBtn.addEventListener('click', cancelScan);

    deviceSelect.addEventListener('change', (e) => {
        selectedDevice = e.target.value;
        const selectedOption = e.target.selectedOptions[0];

        if (selectedOption && selectedOption.dataset.adf) {
            adfInfo.textContent = selectedOption.dataset.adf === 'true' ? 'Evet' : 'Hayır';
        } else {
            adfInfo.textContent = '-';
        }

        scanBtn.disabled = !selectedDevice;
    });
}

// Setup WebSocket for real-time updates
function setupWebSocket() {
    try {
        // Using Socket.IO
        if (typeof io !== 'undefined') {
            const socket = io();

            socket.on('connect', () => {
                console.log('WebSocket connected');
            });

            socket.on('page_scanned', (data) => {
                updateScanProgress(data.page);
                addPageThumbnail(data.filename);
            });

            socket.on('scan_complete', (data) => {
                completeScan(data);
            });

            socket.on('scan_error', (data) => {
                showScanError(data.error);
            });

            socket.on('processing_started', (data) => {
                updateStatus('OMR işleme başladı...');
            });
        }
    } catch (error) {
        console.log('WebSocket not available, using polling');
    }
}

// Start scanning
async function startScan() {
    if (!selectedDevice) {
        alert('Lütfen bir tarayıcı seçin');
        return;
    }

    const deviceId = /^\d+$/.test(String(selectedDevice))
        ? parseInt(String(selectedDevice), 10)
        : selectedDevice;

    isScanning = true;
    scanBtn.style.display = 'none';
    cancelBtn.style.display = 'block';

    // Reset UI
    scanStatus.style.display = 'none';
    scanProgress.style.display = 'block';
    scanResults.style.display = 'none';
    scannedPages.style.display = 'block';
    pageThumbnails.innerHTML = '';
    pagesCount.textContent = '0';
    updateProgressRing(0);

    try {
        const response = await fetch(`${API_BASE}/api/scanner/scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                device_id: deviceId,
                use_adf: useAdfCheckbox.checked,
                auto_process: autoProcessCheckbox.checked,
                show_ui: showUiCheckbox ? showUiCheckbox.checked : true,
                template_id: scanTemplateSelect.value || null
            })
        });

        const data = await response.json();

        if (data.error) {
            showScanError(data.error);
            return;
        }

        currentSessionId = data.session_id;

        // If WebSocket not available, poll for status
        if (typeof io === 'undefined') {
            pollScanStatus();
        }

    } catch (error) {
        showScanError(error.message);
    }
}

// Cancel scanning
async function cancelScan() {
    isScanning = false;
    scanBtn.style.display = 'block';
    cancelBtn.style.display = 'none';

    try {
        await fetch(`${API_BASE}/api/scanner/cancel`, { method: 'POST' });
    } catch (error) {
        console.error('Error cancelling scan:', error);
    }

    resetScanUI();
}

// Poll scan status (fallback if no WebSocket)
async function pollScanStatus() {
    if (!isScanning) return;

    try {
        const response = await fetch(`${API_BASE}/api/scanner/status`);
        const data = await response.json();

        if (data.cancelled) {
            isScanning = false;
            scanBtn.style.display = 'block';
            cancelBtn.style.display = 'none';
            scanProgress.style.display = 'none';
            resetScanUI();
            return;
        }

        if (data.error) {
            showScanError(data.error);
            return;
        }

        if (data.pages_scanned > 0) {
            updateScanProgress(data.pages_scanned);
        }

        if (data.scanning) {
            setTimeout(pollScanStatus, 1000);
        } else if (currentSessionId) {
            // Scan complete, check for results
            completeScan({ session_id: currentSessionId, pages_scanned: data.pages_scanned });
        }

    } catch (error) {
        console.error('Error polling status:', error);
        setTimeout(pollScanStatus, 2000);
    }
}

// Update scan progress
function updateScanProgress(pageNum) {
    pagesCount.textContent = pageNum;
    updateProgressRing(Math.min(pageNum * 10, 100));
}

// Update progress ring
function updateProgressRing(percent) {
    const ring = document.getElementById('progress-ring');
    if (ring) {
        const circumference = 2 * Math.PI * 45; // r = 45
        const offset = circumference - (percent / 100) * circumference;
        ring.style.strokeDashoffset = offset;
    }
}

// Add page thumbnail
function addPageThumbnail(filename) {
    if (currentSessionId) {
        const thumb = document.createElement('div');
        thumb.className = 'image-item';
        thumb.innerHTML = `
            <img src="${API_BASE}/api/uploads/${currentSessionId}/file/${filename}" 
                 alt="Page" loading="lazy"
                 onerror="this.parentElement.innerHTML='📄'">
        `;
        pageThumbnails.appendChild(thumb);
    }
}

// Complete scan
function completeScan(data) {
    isScanning = false;
    scanBtn.style.display = 'block';
    cancelBtn.style.display = 'none';
    scanProgress.style.display = 'none';

    const scannedCount = data.pages_scanned || 0;
    if (scannedCount <= 0) {
        showScanError('Hiç sayfa taranmadı. Tarayıcıda kağıt/ADF olduğundan emin olun ve tekrar deneyin.');
        return;
    }

    // Show results
    document.getElementById('total-scanned').textContent = scannedCount;
    document.getElementById('total-processed').textContent = scannedCount;
    scanResults.style.display = 'block';

    // Update links
    const viewResultsBtn = document.getElementById('view-results-btn');
    const downloadResultsBtn = document.getElementById('download-results-btn');

    if (data.session_id) {
        viewResultsBtn.href = `process.html?session=${data.session_id}`;
        downloadResultsBtn.onclick = () => {
            window.open(`${API_BASE}/api/results/${data.session_id}/csv`, '_blank');
        };
    }

    // Save to recent sessions
    if (window.OMR && window.OMR.saveRecentSession) {
        window.OMR.saveRecentSession({
            id: data.session_id,
            name: `${data.pages_scanned} sayfa tarama`,
            date: new Date().toISOString(),
            type: 'scan',
            status: 'success'
        });
    }
}

// Show scan error
function showScanError(message) {
    isScanning = false;
    scanBtn.style.display = 'block';
    cancelBtn.style.display = 'none';
    scanProgress.style.display = 'none';

    scanStatus.style.display = 'block';
    scanStatus.innerHTML = `
        <div class="status-idle" style="color: var(--accent-danger);">
            <span class="status-icon">❌</span>
            <p>Tarama hatası</p>
            <small>${message}</small>
        </div>
    `;
}

// Reset scan UI
function resetScanUI() {
    scanStatus.style.display = 'block';
    scanStatus.innerHTML = `
        <div class="status-idle">
            <span class="status-icon">📄</span>
            <p>Tarama için hazır</p>
            <small>Tarayıcı seçin ve başlatın</small>
        </div>
    `;
    scanProgress.style.display = 'none';
    scanResults.style.display = 'none';
}

// Update status text
function updateStatus(message) {
    // Optional: Update a status message area
    console.log('Status:', message);
}
