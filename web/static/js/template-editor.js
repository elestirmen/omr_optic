/**
 * OMRChecker Web Interface - Template Editor v2
 * Complete rewrite with bubble grid preview and fine-tuning
 */

const API_BASE = '';

// Template data
let templateData = {
    pageDimensions: [1700, 2400],
    bubbleDimensions: [25, 25],
    fieldBlocks: {},
    preProcessors: []
};

let fieldBlocks = [];
let currentImage = null;
let zoomLevel = 0.5;

// Canvas elements
let canvas, ctx;
let overlayCanvas, overlayCtx;

// Selection state
let isDrawing = false;
let startX = 0, startY = 0;
let currentX = 0, currentY = 0;

// Active block for editing
let activeBlockIndex = -1;

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', () => {
    canvas = document.getElementById('template-canvas');
    ctx = canvas.getContext('2d');

    overlayCanvas = document.getElementById('overlay-canvas');
    overlayCtx = overlayCanvas.getContext('2d');

    // Set initial canvas size
    canvas.width = 1700;
    canvas.height = 2400;
    overlayCanvas.width = 1700;
    overlayCanvas.height = 2400;

    applyZoom();
    setupEventListeners();
    updateJsonPreview();
    drawGrid();
});

function setupEventListeners() {
    // Image upload
    document.getElementById('image-upload').addEventListener('change', handleImageUpload);

    // Overlay canvas for drawing
    overlayCanvas.addEventListener('mousedown', onMouseDown);
    overlayCanvas.addEventListener('mousemove', onMouseMove);
    overlayCanvas.addEventListener('mouseup', onMouseUp);
    overlayCanvas.addEventListener('mouseleave', onMouseUp);

    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            isDrawing = false;
            clearOverlay();
        }
    });

    // Form inputs for live preview
    document.querySelectorAll('#block-form input, #block-form select').forEach(el => {
        el.addEventListener('change', updateActiveBlockPreview);
        el.addEventListener('input', updateActiveBlockPreview);
    });
}

// ==================== IMAGE HANDLING ====================

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
        const img = new Image();
        img.onload = function () {
            currentImage = img;

            // Update canvas size
            canvas.width = img.width;
            canvas.height = img.height;
            overlayCanvas.width = img.width;
            overlayCanvas.height = img.height;

            // Update template dimensions
            document.getElementById('page-width').value = img.width;
            document.getElementById('page-height').value = img.height;
            templateData.pageDimensions = [img.width, img.height];

            // Auto zoom to fit
            const container = document.getElementById('canvas-container');
            const maxWidth = container.clientWidth - 40;
            const maxHeight = container.clientHeight - 40;
            zoomLevel = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
            zoomLevel = Math.max(0.1, Math.min(1, zoomLevel));

            applyZoom();
            drawImage();
            updateJsonPreview();
            showToast('✅ Görüntü yüklendi! Şimdi "Alan Seç" modunu aktif edin.');
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
}

function drawImage() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (currentImage) {
        ctx.drawImage(currentImage, 0, 0);
    } else {
        drawGrid();
    }

    // Draw all blocks
    fieldBlocks.forEach((block, index) => {
        drawBlock(block, index === activeBlockIndex);
    });
}

function drawGrid() {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#2a2a4a';
    ctx.lineWidth = 1;

    for (let x = 0; x < canvas.width; x += 100) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 100) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }
}

// ==================== ZOOM ====================

function zoomIn() {
    zoomLevel = Math.min(zoomLevel + 0.1, 2);
    applyZoom();
}

function zoomOut() {
    zoomLevel = Math.max(zoomLevel - 0.1, 0.1);
    applyZoom();
}

function applyZoom() {
    document.getElementById('zoom-level').textContent = Math.round(zoomLevel * 100) + '%';

    const displayWidth = canvas.width * zoomLevel;
    const displayHeight = canvas.height * zoomLevel;

    canvas.style.width = displayWidth + 'px';
    canvas.style.height = displayHeight + 'px';
    overlayCanvas.style.width = displayWidth + 'px';
    overlayCanvas.style.height = displayHeight + 'px';
}

// ==================== MOUSE EVENTS ====================

function getMousePos(e) {
    const rect = overlayCanvas.getBoundingClientRect();
    const scaleX = overlayCanvas.width / rect.width;
    const scaleY = overlayCanvas.height / rect.height;

    return {
        x: Math.round((e.clientX - rect.left) * scaleX),
        y: Math.round((e.clientY - rect.top) * scaleY)
    };
}

function onMouseDown(e) {
    if (!isSelectionMode()) return;

    const pos = getMousePos(e);
    isDrawing = true;
    startX = pos.x;
    startY = pos.y;
    currentX = pos.x;
    currentY = pos.y;
}

function onMouseMove(e) {
    const pos = getMousePos(e);

    // Update coordinate display
    document.getElementById('coord-display').textContent = `X: ${pos.x}, Y: ${pos.y}`;

    if (!isDrawing) {
        // Show crosshair
        if (isSelectionMode()) {
            drawCrosshair(pos);
        }
        return;
    }

    currentX = pos.x;
    currentY = pos.y;
    drawSelectionRect();
}

function onMouseUp(e) {
    if (!isDrawing) return;

    const pos = getMousePos(e);
    currentX = pos.x;
    currentY = pos.y;
    isDrawing = false;

    const rect = getSelectionRect();

    if (rect.width > 20 && rect.height > 20) {
        // Valid selection - populate form
        document.getElementById('block-origin-x').value = rect.x;
        document.getElementById('block-origin-y').value = rect.y;
        document.getElementById('selection-width').value = rect.width;
        document.getElementById('selection-height').value = rect.height;

        // Show form panel
        document.getElementById('block-form-panel').style.display = 'block';
        document.getElementById('block-name').focus();

        // Calculate initial gaps
        recalculateGaps();

        showToast(`✅ Alan seçildi: ${rect.width}x${rect.height}px`);
    }

    clearOverlay();
}

function getSelectionRect() {
    return {
        x: Math.min(startX, currentX),
        y: Math.min(startY, currentY),
        width: Math.abs(currentX - startX),
        height: Math.abs(currentY - startY)
    };
}

function isSelectionMode() {
    return document.getElementById('selection-mode').checked;
}

// ==================== OVERLAY DRAWING ====================

function clearOverlay() {
    overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
}

function drawCrosshair(pos) {
    clearOverlay();

    overlayCtx.strokeStyle = 'rgba(99, 102, 241, 0.8)';
    overlayCtx.lineWidth = 1;
    overlayCtx.setLineDash([5, 5]);

    // Vertical line
    overlayCtx.beginPath();
    overlayCtx.moveTo(pos.x, 0);
    overlayCtx.lineTo(pos.x, overlayCanvas.height);
    overlayCtx.stroke();

    // Horizontal line
    overlayCtx.beginPath();
    overlayCtx.moveTo(0, pos.y);
    overlayCtx.lineTo(overlayCanvas.width, pos.y);
    overlayCtx.stroke();

    overlayCtx.setLineDash([]);
}

function drawSelectionRect() {
    clearOverlay();

    const rect = getSelectionRect();

    // Fill
    overlayCtx.fillStyle = 'rgba(99, 102, 241, 0.2)';
    overlayCtx.fillRect(rect.x, rect.y, rect.width, rect.height);

    // Border
    overlayCtx.strokeStyle = '#6366f1';
    overlayCtx.lineWidth = 2;
    overlayCtx.strokeRect(rect.x, rect.y, rect.width, rect.height);

    // Size label
    overlayCtx.fillStyle = '#6366f1';
    overlayCtx.font = 'bold 16px Inter, sans-serif';
    overlayCtx.fillText(`${rect.width} x ${rect.height}`, rect.x + 10, rect.y + 25);

    // Draw bubble preview
    drawBubblePreview(rect);
}

function drawBubblePreview(rect) {
    const numBubbles = parseInt(document.getElementById('block-num-bubbles').value) || 5;
    const numLabels = parseInt(document.getElementById('block-num-labels').value) || 10;
    const direction = document.getElementById('block-direction').value;

    let cols, rows;
    if (direction === 'horizontal') {
        cols = numBubbles;
        rows = Math.min(numLabels, 30); // Limit preview rows
    } else {
        cols = Math.min(numLabels, 30);
        rows = numBubbles;
    }

    const gapX = rect.width / cols;
    const gapY = rect.height / rows;
    const bubbleRadius = Math.min(gapX, gapY) / 3;

    overlayCtx.fillStyle = 'rgba(99, 102, 241, 0.5)';

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const cx = rect.x + gapX * (col + 0.5);
            const cy = rect.y + gapY * (row + 0.5);

            overlayCtx.beginPath();
            overlayCtx.arc(cx, cy, bubbleRadius, 0, Math.PI * 2);
            overlayCtx.fill();
        }
    }
}

// ==================== BLOCK MANAGEMENT ====================

function recalculateGaps() {
    const width = parseInt(document.getElementById('selection-width').value) || 100;
    const height = parseInt(document.getElementById('selection-height').value) || 100;
    const numBubbles = parseInt(document.getElementById('block-num-bubbles').value) || 5;
    const numLabels = parseInt(document.getElementById('block-num-labels').value) || 10;
    const direction = document.getElementById('block-direction').value;

    if (direction === 'horizontal') {
        document.getElementById('block-bubbles-gap').value = Math.round(width / numBubbles);
        document.getElementById('block-labels-gap').value = Math.round(height / numLabels);
    } else {
        document.getElementById('block-bubbles-gap').value = Math.round(height / numBubbles);
        document.getElementById('block-labels-gap').value = Math.round(width / numLabels);
    }
}

function updateActiveBlockPreview() {
    // Redraw image with current blocks
    drawImage();

    // If we have a selection, draw preview
    const width = parseInt(document.getElementById('selection-width').value);
    const height = parseInt(document.getElementById('selection-height').value);

    if (width && height) {
        const rect = {
            x: parseInt(document.getElementById('block-origin-x').value) || 0,
            y: parseInt(document.getElementById('block-origin-y').value) || 0,
            width: width,
            height: height
        };

        clearOverlay();

        // Draw rectangle
        overlayCtx.strokeStyle = '#22d3ee';
        overlayCtx.lineWidth = 2;
        overlayCtx.strokeRect(rect.x, rect.y, rect.width, rect.height);

        // Draw bubble preview
        drawBubblePreview(rect);
    }
}

function addBlock() {
    const name = document.getElementById('block-name').value.trim();
    const fieldType = document.getElementById('block-type').value;
    const labels = document.getElementById('block-labels').value.trim();
    const originX = parseInt(document.getElementById('block-origin-x').value) || 0;
    const originY = parseInt(document.getElementById('block-origin-y').value) || 0;
    const bubblesGap = parseInt(document.getElementById('block-bubbles-gap').value) || 40;
    const labelsGap = parseInt(document.getElementById('block-labels-gap').value) || 50;
    const direction = document.getElementById('block-direction').value;

    if (!name) {
        alert('Blok adı gerekli!');
        return;
    }
    if (!labels) {
        alert('Alan etiketleri gerekli! Örn: q1..30 veya ad1..12');
        return;
    }

    const block = {
        name: name,
        fieldType: fieldType,
        fieldLabels: [labels],
        origin: [originX, originY],
        bubblesGap: bubblesGap,
        labelsGap: labelsGap,
        direction: direction
    };

    fieldBlocks.push(block);

    // Add to template data
    templateData.fieldBlocks[name] = {
        fieldType: fieldType,
        fieldLabels: [labels],
        origin: [originX, originY],
        bubblesGap: bubblesGap,
        labelsGap: labelsGap,
        direction: direction
    };

    updateBlocksList();
    updateJsonPreview();
    resetForm();
    drawImage();

    showToast(`✅ "${name}" bloğu eklendi!`);
}

function resetForm() {
    document.getElementById('block-name').value = '';
    document.getElementById('block-labels').value = '';
    document.getElementById('block-form-panel').style.display = 'none';
    clearOverlay();
    activeBlockIndex = -1;
}

function updateBlocksList() {
    const container = document.getElementById('blocks-list');

    if (fieldBlocks.length === 0) {
        container.innerHTML = '<p class="empty-text">Henüz alan eklenmedi</p>';
        return;
    }

    container.innerHTML = fieldBlocks.map((block, index) => `
        <div class="block-item ${index === activeBlockIndex ? 'active' : ''}" onclick="selectBlock(${index})">
            <div class="block-header">
                <span class="block-name">${block.name}</span>
                <button class="delete-btn" onclick="event.stopPropagation(); deleteBlock(${index})">🗑️</button>
            </div>
            <div class="block-info">
                <span class="block-type">${getTypeLabel(block.fieldType)}</span>
                <span class="block-pos">📍 (${block.origin[0]}, ${block.origin[1]})</span>
            </div>
        </div>
    `).join('');
}

function getTypeLabel(type) {
    const labels = {
        'QTYPE_MCQ4': 'MCQ-4',
        'QTYPE_MCQ5': 'MCQ-5',
        'QTYPE_INT': '0-9',
        'QTYPE_INT_FROM_1': '1-0',
        'QTYPE_TR_ALPHABET': 'Alfabe',
        'CUSTOM': 'Özel'
    };
    return labels[type] || type;
}

function selectBlock(index) {
    activeBlockIndex = index;
    const block = fieldBlocks[index];

    // Populate form
    document.getElementById('block-name').value = block.name;
    document.getElementById('block-type').value = block.fieldType;
    document.getElementById('block-labels').value = block.fieldLabels[0] || '';
    document.getElementById('block-origin-x').value = block.origin[0];
    document.getElementById('block-origin-y').value = block.origin[1];
    document.getElementById('block-bubbles-gap').value = block.bubblesGap;
    document.getElementById('block-labels-gap').value = block.labelsGap;
    document.getElementById('block-direction').value = block.direction;

    // Calculate selection size
    const numBubbles = getBubbleCount(block.fieldType);
    const numLabels = parseLabels(block.fieldLabels[0]).length;

    if (block.direction === 'horizontal') {
        document.getElementById('selection-width').value = numBubbles * block.bubblesGap;
        document.getElementById('selection-height').value = numLabels * block.labelsGap;
        document.getElementById('block-num-bubbles').value = numBubbles;
        document.getElementById('block-num-labels').value = numLabels;
    } else {
        document.getElementById('selection-width').value = numLabels * block.labelsGap;
        document.getElementById('selection-height').value = numBubbles * block.bubblesGap;
        document.getElementById('block-num-bubbles').value = numBubbles;
        document.getElementById('block-num-labels').value = numLabels;
    }

    document.getElementById('block-form-panel').style.display = 'block';
    updateBlocksList();
    drawImage();
}

function deleteBlock(index) {
    const block = fieldBlocks[index];
    if (confirm(`"${block.name}" bloğunu silmek istediğinize emin misiniz?`)) {
        delete templateData.fieldBlocks[block.name];
        fieldBlocks.splice(index, 1);

        if (activeBlockIndex === index) {
            resetForm();
        } else if (activeBlockIndex > index) {
            activeBlockIndex--;
        }

        updateBlocksList();
        updateJsonPreview();
        drawImage();
        showToast(`🗑️ "${block.name}" silindi`);
    }
}

function drawBlock(block, isActive) {
    const colors = ['#6366f1', '#22d3ee', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    const color = isActive ? '#ffffff' : colors[fieldBlocks.indexOf(block) % colors.length];

    const origin = block.origin;
    const numLabels = parseLabels(block.fieldLabels[0]).length || 1;
    const numBubbles = getBubbleCount(block.fieldType);

    let width, height;
    if (block.direction === 'horizontal') {
        width = numBubbles * block.bubblesGap;
        height = numLabels * block.labelsGap;
    } else {
        width = numLabels * block.labelsGap;
        height = numBubbles * block.bubblesGap;
    }

    // Block outline
    ctx.strokeStyle = color;
    ctx.lineWidth = isActive ? 3 : 2;
    ctx.strokeRect(origin[0], origin[1], width, height);

    // Label background
    const labelText = block.name;
    ctx.font = 'bold 14px Inter, sans-serif';
    const textWidth = ctx.measureText(labelText).width + 10;

    ctx.fillStyle = color;
    ctx.fillRect(origin[0], origin[1] - 22, textWidth, 20);

    // Label text
    ctx.fillStyle = isActive ? '#000000' : '#ffffff';
    ctx.fillText(labelText, origin[0] + 5, origin[1] - 7);

    // Draw bubbles (simplified)
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.4;

    const maxRows = Math.min(block.direction === 'horizontal' ? numLabels : numBubbles, 10);
    const maxCols = Math.min(block.direction === 'horizontal' ? numBubbles : numLabels, 10);

    for (let r = 0; r < maxRows; r++) {
        for (let c = 0; c < maxCols; c++) {
            let bx, by;
            if (block.direction === 'horizontal') {
                bx = origin[0] + c * block.bubblesGap + block.bubblesGap / 2;
                by = origin[1] + r * block.labelsGap + block.labelsGap / 2;
            } else {
                bx = origin[0] + c * block.labelsGap + block.labelsGap / 2;
                by = origin[1] + r * block.bubblesGap + block.bubblesGap / 2;
            }

            ctx.beginPath();
            ctx.arc(bx, by, 8, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    ctx.globalAlpha = 1;
}

// ==================== UTILITIES ====================

function getBubbleCount(fieldType) {
    const counts = {
        'QTYPE_MCQ4': 4,
        'QTYPE_MCQ5': 5,
        'QTYPE_INT': 10,
        'QTYPE_INT_FROM_1': 10,
        'QTYPE_TR_ALPHABET': 29,
        'CUSTOM': 4
    };
    return counts[fieldType] || 4;
}

function parseLabels(labelStr) {
    if (!labelStr) return [];

    const rangeMatch = labelStr.match(/^([a-zA-Z_]+)(\d+)\.\.(\d+)$/);
    if (rangeMatch) {
        const start = parseInt(rangeMatch[2]);
        const end = parseInt(rangeMatch[3]);
        const labels = [];
        for (let i = start; i <= end; i++) {
            labels.push(rangeMatch[1] + i);
        }
        return labels;
    }

    return labelStr.split(',').map(s => s.trim());
}

function updateJsonPreview() {
    document.getElementById('json-preview').textContent = JSON.stringify(templateData, null, 2);
}

function showToast(message) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
}

// ==================== SAVE ====================

async function saveTemplate() {
    const name = document.getElementById('template-name').value.trim();

    if (!name) {
        alert('Şablon adı gerekli!');
        return;
    }

    if (Object.keys(templateData.fieldBlocks).length === 0) {
        alert('En az bir alan bloğu ekleyin!');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/templates`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, ...templateData })
        });

        const result = await response.json();

        if (result.success) {
            showToast('💾 Şablon kaydedildi!');
            setTimeout(() => window.location.href = 'templates.html', 1500);
        } else {
            alert('Hata: ' + (result.error || 'Kaydedilemedi'));
        }
    } catch (error) {
        alert('Bağlantı hatası: ' + error.message);
    }
}
