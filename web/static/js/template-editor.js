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
    preProcessors: [],
    customLabels: {},
    outputColumns: []
};

let fieldBlocks = [];
let currentImage = null;
let zoomLevel = 0.5;

// Auto-gap (spacing) behavior
let autoGapEnabled = true;

// Canvas elements
let canvas, ctx;
let overlayCanvas, overlayCtx;

// Selection state
let isDrawing = false;
let startX = 0, startY = 0;
let currentX = 0, currentY = 0;

// Active block for editing
let activeBlockIndex = -1;
let formDirty = false;
let suppressDirty = false;
let isPopulatingBlockForm = false;

// Drag state (move blocks when selection mode is OFF)
let isDraggingBlock = false;
let dragBlockIndex = -1;
let dragStartPos = { x: 0, y: 0 };
let dragStartOrigin = [0, 0];

// Field type presets (match backend defaults)
const FIELD_TYPE_PRESETS = {
    QTYPE_MCQ4: { bubbleCount: 4, direction: 'horizontal' },
    QTYPE_MCQ5: { bubbleCount: 5, direction: 'horizontal' },
    QTYPE_INT: { bubbleCount: 10, direction: 'vertical' },
    QTYPE_INT_FROM_1: { bubbleCount: 10, direction: 'vertical' },
    QTYPE_TR_ALPHABET: { bubbleCount: 29, direction: 'vertical' },
};

function isCustomFieldType(fieldType) {
    return fieldType === 'CUSTOM';
}

function getPresetForFieldType(fieldType) {
    return FIELD_TYPE_PRESETS[fieldType] || null;
}

function getBubbleDimensions() {
    const bubbleSizeEl = document.getElementById('bubble-size');
    const size = parseInt(bubbleSizeEl?.value) || templateData.bubbleDimensions?.[0] || 25;
    return [size, size];
}

function syncTemplateBubbleDimensions() {
    templateData.bubbleDimensions = getBubbleDimensions();
    const width = parseInt(document.getElementById('selection-width')?.value);
    const height = parseInt(document.getElementById('selection-height')?.value);
    if (autoGapEnabled && width && height) {
        recalculateGaps();
    }
    updateJsonPreview();
    drawImage();
}

function parseCustomBubbleValues() {
    const input = document.getElementById('custom-bubble-values');
    const raw = (input?.value || '').trim();
    if (!raw) return [];
    return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function syncBlockFormForType(recalculate = true) {
    const fieldType = document.getElementById('block-type')?.value;
    const isCustom = isCustomFieldType(fieldType);

    const customGroup = document.getElementById('custom-values-group');
    if (customGroup) customGroup.style.display = isCustom ? 'block' : 'none';

    const directionEl = document.getElementById('block-direction');
    const numBubblesEl = document.getElementById('block-num-bubbles');

    if (!directionEl || !numBubblesEl) return;

    if (isCustom) {
        directionEl.disabled = false;
        numBubblesEl.disabled = false;

        const values = parseCustomBubbleValues();
        if (values.length > 0) {
            numBubblesEl.value = values.length;
        }
    } else {
        const preset = getPresetForFieldType(fieldType);
        if (preset) {
            directionEl.value = preset.direction;
            numBubblesEl.value = preset.bubbleCount;
        }
        directionEl.disabled = true;
        numBubblesEl.disabled = true;
    }

    // If a selection exists, recalculate spacing with the effective settings.
    const width = parseInt(document.getElementById('selection-width')?.value);
    const height = parseInt(document.getElementById('selection-height')?.value);
    if (recalculate && autoGapEnabled && width && height) {
        recalculateGaps();
    }
    updateActiveBlockPreview();
}

function syncNumLabelsFromLabels() {
    const labelsStr = (document.getElementById('block-labels')?.value || '').trim();
    const range = parseLabelRange(labelsStr);
    if (!range) return null;

    const count = Math.max(1, range.end - range.start + 1);
    const numLabelsEl = document.getElementById('block-num-labels');
    if (numLabelsEl) numLabelsEl.value = count;
    return count;
}

function getCurrentFormDirection() {
    const fieldType = document.getElementById('block-type')?.value;
    if (!isCustomFieldType(fieldType)) {
        return getPresetForFieldType(fieldType)?.direction || 'horizontal';
    }
    return document.getElementById('block-direction')?.value || 'horizontal';
}

function getCurrentFormNumBubbles() {
    const fieldType = document.getElementById('block-type')?.value;
    if (!isCustomFieldType(fieldType)) {
        return getPresetForFieldType(fieldType)?.bubbleCount || 4;
    }
    const values = parseCustomBubbleValues();
    if (values.length > 0) return values.length;
    return parseInt(document.getElementById('block-num-bubbles')?.value) || 4;
}

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
    syncBlockFormForType();
    syncTemplateBubbleDimensions();
    updateJsonPreview();
    setFormMode(false);
    renderCustomLabels();
    drawGrid();

    const customLabelList = document.getElementById('custom-label-list');
    customLabelList?.addEventListener('click', (e) => {
        const btn = e.target?.closest?.('.custom-label-delete');
        const key = btn?.dataset?.customLabelKey;
        if (!key) return;
        removeCustomLabel(decodeURIComponent(key));
    });
});

function setupEventListeners() {
    // Image upload
    document.getElementById('image-upload').addEventListener('change', handleImageUpload);

    // Overlay canvas for drawing
    overlayCanvas.addEventListener('mousedown', onMouseDown);
    overlayCanvas.addEventListener('mousemove', onMouseMove);
    overlayCanvas.addEventListener('mouseup', onMouseUp);
    overlayCanvas.addEventListener('mouseleave', onMouseUp);

    // Selection mode toggle
    const selectionModeEl = document.getElementById('selection-mode');
    if (selectionModeEl) {
        overlayCanvas.style.cursor = selectionModeEl.checked ? 'crosshair' : 'move';
        selectionModeEl.addEventListener('change', () => {
            overlayCanvas.style.cursor = selectionModeEl.checked ? 'crosshair' : 'move';
            if (selectionModeEl.checked) {
                const wasEditing = activeBlockIndex >= 0;
                const ok = startNewBlock({ enableSelectionMode: false, clearIdentity: wasEditing, focusName: false });
                if (ok === false) {
                    selectionModeEl.checked = false;
                    overlayCanvas.style.cursor = 'move';
                }
                return;
            }
            showToast('Alan Seç kapalı: bloklara tıklayıp taşıyabilirsiniz.');
        });
    }

    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            isDrawing = false;
            isDraggingBlock = false;
            dragBlockIndex = -1;
            clearOverlay();
            return;
        }

        const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
        if (arrowKeys.includes(e.key) && activeBlockIndex >= 0 && !isSelectionMode()) {
            const tag = (e.target?.tagName || '').toLowerCase();
            if (['input', 'textarea', 'select'].includes(tag)) return;

            e.preventDefault();
            const step = e.shiftKey ? 5 : 1;
            let dx = 0, dy = 0;
            if (e.key === 'ArrowUp') dy = -step;
            if (e.key === 'ArrowDown') dy = step;
            if (e.key === 'ArrowLeft') dx = -step;
            if (e.key === 'ArrowRight') dx = step;
            nudgeActiveBlock(dx, dy);
        }
    });

    // Form inputs for live preview
    document.querySelectorAll('#block-form input, #block-form select').forEach(el => {
        el.addEventListener('change', updateActiveBlockPreview);
        el.addEventListener('input', updateActiveBlockPreview);
    });

    // Global template settings
    document.getElementById('bubble-size')?.addEventListener('change', syncTemplateBubbleDimensions);
    document.getElementById('bubble-size')?.addEventListener('input', syncTemplateBubbleDimensions);

    // Block helpers
    document.getElementById('block-type')?.addEventListener('change', syncBlockFormForType);
    document.getElementById('custom-bubble-values')?.addEventListener('input', syncBlockFormForType);

    const autoGapEl = document.getElementById('auto-gap');
    if (autoGapEl) {
        autoGapEnabled = !!autoGapEl.checked;
        autoGapEl.addEventListener('change', () => {
            autoGapEnabled = !!autoGapEl.checked;
            const width = parseInt(document.getElementById('selection-width')?.value);
            const height = parseInt(document.getElementById('selection-height')?.value);
            if (autoGapEnabled && width && height) recalculateGaps();
            updateActiveBlockPreview();
        });
    }

    const disableAutoGap = () => {
        autoGapEnabled = false;
        if (autoGapEl) autoGapEl.checked = false;
    };

    document.getElementById('block-bubbles-gap')?.addEventListener('input', disableAutoGap);
    document.getElementById('block-labels-gap')?.addEventListener('input', disableAutoGap);

    document.getElementById('block-num-labels')?.addEventListener('input', () => {
        const width = parseInt(document.getElementById('selection-width')?.value);
        const height = parseInt(document.getElementById('selection-height')?.value);
        if (autoGapEnabled && width && height) recalculateGaps();
    });

    document.getElementById('block-num-bubbles')?.addEventListener('input', () => {
        const width = parseInt(document.getElementById('selection-width')?.value);
        const height = parseInt(document.getElementById('selection-height')?.value);
        if (autoGapEnabled && width && height) recalculateGaps();
    });

    document.getElementById('block-labels')?.addEventListener('input', () => {
        const synced = syncNumLabelsFromLabels();
        const width = parseInt(document.getElementById('selection-width')?.value);
        const height = parseInt(document.getElementById('selection-height')?.value);
        if (autoGapEnabled && synced && width && height) recalculateGaps();
        updateActiveBlockPreview();
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
    const pos = getMousePos(e);

    if (isSelectionMode()) {
        isDrawing = true;
        startX = pos.x;
        startY = pos.y;
        currentX = pos.x;
        currentY = pos.y;
        return;
    }

    const hitIndex = findBlockAtPosition(pos);
    if (hitIndex < 0) return;

    selectBlock(hitIndex);
    isDraggingBlock = true;
    dragBlockIndex = hitIndex;
    dragStartPos = pos;
    dragStartOrigin = [...fieldBlocks[hitIndex].origin];
}

function onMouseMove(e) {
    const pos = getMousePos(e);

    // Update coordinate display
    document.getElementById('coord-display').textContent = `X: ${pos.x}, Y: ${pos.y}`;

    if (isDraggingBlock && dragBlockIndex >= 0) {
        const dx = pos.x - dragStartPos.x;
        const dy = pos.y - dragStartPos.y;
        setBlockOrigin(dragBlockIndex, dragStartOrigin[0] + dx, dragStartOrigin[1] + dy);
        drawImage();
        return;
    }

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
    if (isDraggingBlock) {
        isDraggingBlock = false;
        dragBlockIndex = -1;
        updateJsonPreview();
        return;
    }

    if (!isDrawing) return;

    const wasEditing = activeBlockIndex >= 0;
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

        // New selection implies creating a new block (avoid overwriting selected block)
        activeBlockIndex = -1;
        setFormMode(false);
        updateBlocksList();
        drawImage();

        // Show form panel
        document.getElementById('block-form-panel').style.display = 'block';
        if (wasEditing) clearBlockIdentityFields();
        document.getElementById('block-name').focus();

        // Calculate initial gaps
        autoGapEnabled = true;
        const autoGapEl = document.getElementById('auto-gap');
        if (autoGapEl) autoGapEl.checked = true;
        recalculateGaps();

        showToast(`Alan seçildi: ${rect.width}x${rect.height}px`);
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

// ==================== BLOCK HIT TEST / MOVE ====================

function getBlockDimensions(block) {
    const numLabels = parseLabels(block.fieldLabels?.[0]).length || 1;
    const numBubbles = getBubbleCount(block.fieldType, block.bubbleValues);
    const [bubbleW, bubbleH] = templateData.bubbleDimensions || [25, 25];

    let width, height;
    if (block.direction === 'horizontal') {
        width = bubbleW + Math.max(0, numBubbles - 1) * block.bubblesGap;
        height = bubbleH + Math.max(0, numLabels - 1) * block.labelsGap;
    } else {
        width = bubbleW + Math.max(0, numLabels - 1) * block.labelsGap;
        height = bubbleH + Math.max(0, numBubbles - 1) * block.bubblesGap;
    }

    return { width, height };
}

function getBlockRect(block) {
    const { width, height } = getBlockDimensions(block);
    return {
        x: block.origin?.[0] || 0,
        y: block.origin?.[1] || 0,
        width,
        height
    };
}

function findBlockAtPosition(pos) {
    for (let i = fieldBlocks.length - 1; i >= 0; i--) {
        const rect = getBlockRect(fieldBlocks[i]);
        if (
            pos.x >= rect.x &&
            pos.x <= rect.x + rect.width &&
            pos.y >= rect.y &&
            pos.y <= rect.y + rect.height
        ) {
            return i;
        }
    }
    return -1;
}

function setBlockOrigin(index, x, y) {
    const block = fieldBlocks[index];
    if (!block) return;

    const { width, height } = getBlockDimensions(block);
    const pageW = templateData.pageDimensions?.[0] || canvas.width;
    const pageH = templateData.pageDimensions?.[1] || canvas.height;

    const maxX = Math.max(0, pageW - width);
    const maxY = Math.max(0, pageH - height);

    const clampedX = Math.round(Math.min(maxX, Math.max(0, x)));
    const clampedY = Math.round(Math.min(maxY, Math.max(0, y)));

    block.origin = [clampedX, clampedY];
    if (templateData.fieldBlocks?.[block.name]) {
        templateData.fieldBlocks[block.name].origin = [clampedX, clampedY];
    }

    if (index === activeBlockIndex) {
        const ox = document.getElementById('block-origin-x');
        const oy = document.getElementById('block-origin-y');
        if (ox) ox.value = clampedX;
        if (oy) oy.value = clampedY;
    }
}

function nudgeActiveBlock(dx, dy) {
    if (activeBlockIndex < 0) return;
    const block = fieldBlocks[activeBlockIndex];
    setBlockOrigin(activeBlockIndex, block.origin[0] + dx, block.origin[1] + dy);
    drawImage();
    updateJsonPreview();
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
    const numBubbles = getCurrentFormNumBubbles();
    const numLabels = parseInt(document.getElementById('block-num-labels').value) || 10;
    const direction = getCurrentFormDirection();

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
    // Skip if we're suppressing updates (e.g., during block selection)
    if (suppressDirty) return;
    // Skip if we're populating form from an existing block
    if (isPopulatingBlockForm) return;

    const width = parseInt(document.getElementById('selection-width').value) || 100;
    const height = parseInt(document.getElementById('selection-height').value) || 100;
    const numBubbles = getCurrentFormNumBubbles();
    const numLabels = parseInt(document.getElementById('block-num-labels').value) || 10;
    const direction = getCurrentFormDirection();
    const [bubbleW, bubbleH] = getBubbleDimensions();

    const calcGap = (total, bubbleDim, count) => {
        if (!total || count <= 1) return 0;
        const gap = (total - bubbleDim) / (count - 1);
        return Math.max(0, Math.round(gap * 100) / 100);
    };

    if (direction === 'horizontal') {
        document.getElementById('block-bubbles-gap').value = calcGap(width, bubbleW, numBubbles);
        document.getElementById('block-labels-gap').value = calcGap(height, bubbleH, numLabels);
    } else {
        document.getElementById('block-bubbles-gap').value = calcGap(height, bubbleH, numBubbles);
        document.getElementById('block-labels-gap').value = calcGap(width, bubbleW, numLabels);
    }
}

function updateActiveBlockPreview() {
    // Skip if we're suppressing updates (e.g., during block selection)
    if (suppressDirty) return;
    // Skip if we're populating form from an existing block
    if (isPopulatingBlockForm) return;

    markFormDirty();

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

// ==================== PRESETS / HELPERS ====================

const QUICK_PRESETS = {
    ogrenci7: { name: 'Ogrenci_No', fieldType: 'QTYPE_INT', labels: 'ogrenci1..7', numLabels: 7 },
    tc11: { name: 'TC_Kimlik_No', fieldType: 'QTYPE_INT', labels: 'tc1..11', numLabels: 11 },
    ad12: { name: 'Soyadi_Adi', fieldType: 'QTYPE_TR_ALPHABET', labels: 'ad1..12', numLabels: 12 },
    test30: { name: 'Test_1_30', fieldType: 'QTYPE_MCQ5', labels: 'q1..30', numLabels: 30 },
    kitapcik: { name: 'Kitapcik_Turu', fieldType: 'QTYPE_MCQ4', labels: 'kitapcik', numLabels: 1 },
};

function applyPreset(key) {
    const preset = QUICK_PRESETS[key];
    if (!preset) return;

    activeBlockIndex = -1;
    setFormMode(false);

    autoGapEnabled = true;
    const autoGapEl = document.getElementById('auto-gap');
    if (autoGapEl) autoGapEl.checked = true;

    document.getElementById('block-form-panel').style.display = 'block';
    document.getElementById('block-name').value = preset.name;
    document.getElementById('block-type').value = preset.fieldType;
    syncBlockFormForType();

    document.getElementById('block-labels').value = preset.labels;
    document.getElementById('block-num-labels').value = preset.numLabels;
    syncNumLabelsFromLabels();

    updateActiveBlockPreview();
}

function parseCustomLabelFieldsInput(raw) {
    return (raw || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
}

function renderCustomLabels() {
    const container = document.getElementById('custom-label-list');
    if (!container) return;

    const customLabels = templateData.customLabels || {};
    const entries = Object.entries(customLabels);

    if (entries.length === 0) {
        container.innerHTML = '<p class="empty-text">Henüz birleştirilmiş alan yok.</p>';
        return;
    }

    container.innerHTML = entries.map(([key, fields]) => `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; background: var(--bg-input); padding: 8px 10px; border-radius: 8px; margin-bottom: 8px;">
            <div style="min-width:0;">
                <div style="font-weight:600; font-size:13px;">${key}</div>
                <div style="color: var(--text-muted); font-size: 12px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    ${(fields || []).join(', ')}
                </div>
            </div>
            <button class="btn btn-sm btn-ghost custom-label-delete" data-custom-label-key="${encodeURIComponent(key)}">Sil</button>
        </div>
    `).join('');
}

function addCustomLabel() {
    const nameEl = document.getElementById('custom-label-name');
    const fieldsEl = document.getElementById('custom-label-fields');
    if (!nameEl || !fieldsEl) return;

    const labelName = (nameEl.value || '').trim();
    const fieldsRaw = (fieldsEl.value || '').trim();
    const fields = parseCustomLabelFieldsInput(fieldsRaw);

    if (!labelName) {
        alert('Birleştirilmiş alan adı gerekli.');
        return;
    }
    if (fields.length === 0) {
        alert('Birleştirilecek alan etiketleri gerekli. Örn: ogrenci1..7');
        return;
    }

    templateData.customLabels = templateData.customLabels || {};

    const allLabels = getAllParsedLabelsSet(-1);
    if (allLabels.has(labelName)) {
        alert('Birleştirilmiş alan adı, mevcut bir alan etiketiyle aynı olamaz.');
        return;
    }

    // Validate referenced labels exist in field blocks
    const referenced = [];
    fields.forEach(f => referenced.push(...parseLabels(f)));
    const missing = referenced.filter(l => !allLabels.has(l));
    if (missing.length > 0) {
        alert(`Bu etiketler henüz bir blokta tanımlı değil: ${missing.slice(0, 20).join(', ')}${missing.length > 20 ? '...' : ''}`);
        return;
    }

    // Ensure no overlap with existing custom label ranges
    const usedByCustomLabels = new Set();
    Object.entries(templateData.customLabels).forEach(([k, arr]) => {
        if (k === labelName) return;
        (arr || []).forEach(f => parseLabels(f).forEach(l => usedByCustomLabels.add(l)));
    });
    const overlap = referenced.find(l => usedByCustomLabels.has(l));
    if (overlap) {
        alert(`Bu etiket başka bir birleştirilmiş alanda kullanılıyor: ${overlap}`);
        return;
    }

    templateData.customLabels[labelName] = fields;
    updateJsonPreview();
    renderCustomLabels();
    nameEl.value = '';
    fieldsEl.value = '';
}

function removeCustomLabel(key) {
    if (!templateData.customLabels) return;
    delete templateData.customLabels[key];
    updateJsonPreview();
    renderCustomLabels();
}

function clearBlockIdentityFields() {
    const nameEl = document.getElementById('block-name');
    const labelsEl = document.getElementById('block-labels');
    const customValuesEl = document.getElementById('custom-bubble-values');

    if (nameEl) nameEl.value = '';
    if (labelsEl) labelsEl.value = '';
    if (customValuesEl) customValuesEl.value = '';
}

function markFormDirty() {
    if (activeBlockIndex < 0) return;
    if (suppressDirty) return;
    if (formDirty) return;
    formDirty = true;
    setFormMode(true);
}

function clearFormDirty() {
    formDirty = false;
    if (activeBlockIndex >= 0) setFormMode(true);
}

function setFormMode(isEditing) {
    const titleEl = document.getElementById('block-form-title');
    const btnEl = document.getElementById('save-block-btn');

    if (titleEl) titleEl.textContent = isEditing ? 'Alan Bloğu (Düzenle)' : 'Alan Bloğu (Ekle)';

    if (btnEl) {
        btnEl.textContent = isEditing ? 'Güncelle' : 'Ekle';
        btnEl.classList.toggle('btn-success', isEditing);
        btnEl.classList.toggle('btn-primary', !isEditing);
    }

    const badgeEl = document.getElementById('mode-badge');
    const modeTitleEl = document.getElementById('mode-title');
    const modeSubtitleEl = document.getElementById('mode-subtitle');

    const selectedName = isEditing ? fieldBlocks[activeBlockIndex]?.name : null;

    if (badgeEl) {
        badgeEl.textContent = isEditing ? (formDirty ? 'DÜZENLE*' : 'DÜZENLE') : 'YENİ';
        badgeEl.classList.toggle('edit', isEditing);
        badgeEl.classList.toggle('add', !isEditing);
    }

    if (modeTitleEl) {
        modeTitleEl.textContent = isEditing && selectedName ? `Seçili: ${selectedName}` : 'Yeni alan ekleme';
    }

    if (modeSubtitleEl) {
        if (isEditing) {
            modeSubtitleEl.textContent = formDirty
                ? 'Kaydedilmemiş değişiklikler var. "Güncelle"ye basın.'
                : 'Değiştirip "Güncelle"ye basın. Yeni alan için "Yeni Alan" deyin.';
        } else {
            modeSubtitleEl.textContent = 'Alan seçip ad/etiket girin ve "Ekle"ye basın.';
        }
    }
}

function startNewBlock(options = {}) {
    const { enableSelectionMode = true, clearIdentity = true, focusName = true } = options;

    if (activeBlockIndex >= 0 && formDirty) {
        const ok = confirm('Seçili blokta kaydedilmemiş değişiklikler var. Kaydetmeden devam edilsin mi?');
        if (!ok) return false;
    }

    formDirty = false;
    activeBlockIndex = -1;
    setFormMode(false);
    updateBlocksList();
    drawImage();

    if (enableSelectionMode) {
        const selEl = document.getElementById('selection-mode');
        if (selEl) selEl.checked = true;
    }

    document.getElementById('block-form-panel').style.display = 'block';
    if (clearIdentity) clearBlockIdentityFields();
    if (focusName) document.getElementById('block-name')?.focus();

    showToast('Yeni alan: "Alan Seç" açıkken sürükleyip bırakın.');
    return true;
}

function getAllParsedLabelsSet(excludeIndex = -1) {
    const set = new Set();
    fieldBlocks.forEach((block, idx) => {
        if (idx === excludeIndex) return;
        const labelsStr = block.fieldLabels?.[0];
        parseLabels(labelsStr).forEach(l => set.add(l));
    });
    return set;
}

function parseLabelRange(labelStr) {
    const trimmed = (labelStr || '').trim();
    const rangeMatch = trimmed.match(/^([a-zA-Z_]+)(\d+)\.\.(\d+)$/);
    if (!rangeMatch) return null;
    return {
        prefix: rangeMatch[1],
        start: parseInt(rangeMatch[2]),
        end: parseInt(rangeMatch[3]),
    };
}

function shiftLabelRange(labelStr, delta) {
    const range = parseLabelRange(labelStr);
    if (!range) return null;
    const start = range.start + delta;
    const end = range.end + delta;
    return `${range.prefix}${start}..${end}`;
}

function shiftNameWithRange(name, oldRange, newRange, suffixIndex) {
    const patterns = [
        { old: `${oldRange.start}_${oldRange.end}`, sep: '_' },
        { old: `${oldRange.start}-${oldRange.end}`, sep: '-' },
        { old: `${oldRange.start}.${oldRange.end}`, sep: '.' },
    ];

    for (const p of patterns) {
        if (name.includes(p.old)) {
            return name.replace(p.old, `${newRange.start}${p.sep}${newRange.end}`);
        }
    }

    const endRangeMatch = name.match(/^(.*?)(\d+)(\D+)(\d+)$/);
    if (
        endRangeMatch &&
        parseInt(endRangeMatch[2]) === oldRange.start &&
        parseInt(endRangeMatch[4]) === oldRange.end
    ) {
        return `${endRangeMatch[1]}${newRange.start}${endRangeMatch[3]}${newRange.end}`;
    }

    return `${name}_${suffixIndex}`;
}

function syncDuplicateDefaultsForLabels(labelsStr) {
    const stepEl = document.getElementById('dup-label-step');
    if (!stepEl) return;

    const range = parseLabelRange(labelsStr);
    if (!range) return;

    const len = Math.max(1, range.end - range.start + 1);
    const current = parseInt(stepEl.value) || 0;
    if (current === 0) stepEl.value = len;
}

function duplicateActiveBlock() {
    if (activeBlockIndex < 0) {
        alert('Önce çoğaltmak için bir blok seçin.');
        return;
    }

    const extraCopies = parseInt(document.getElementById('dup-count')?.value) || 0;
    if (extraCopies <= 0) return;

    const offsetX = parseInt(document.getElementById('dup-offset-x')?.value) || 0;
    const offsetY = parseInt(document.getElementById('dup-offset-y')?.value) || 0;
    const labelStepInput = parseInt(document.getElementById('dup-label-step')?.value) || 0;

    const baseBlock = fieldBlocks[activeBlockIndex];
    const baseLabelsStr = baseBlock.fieldLabels?.[0] || '';
    const baseRange = parseLabelRange(baseLabelsStr);
    if (!baseRange) {
        alert('Çoğaltma için etiketler aralık formatında olmalı. Örn: q1..30');
        return;
    }

    const step = labelStepInput || Math.max(1, baseRange.end - baseRange.start + 1);
    if (step <= 0) {
        alert('Etiket kaydırma değeri 0 olamaz.');
        return;
    }

    const existingNames = new Set(Object.keys(templateData.fieldBlocks || {}));
    const existingLabels = getAllParsedLabelsSet(-1);

    let lastIndex = activeBlockIndex;
    for (let i = 1; i <= extraCopies; i++) {
        const newLabelsStr = shiftLabelRange(baseLabelsStr, step * i);
        if (!newLabelsStr) break;

        const newLabels = parseLabels(newLabelsStr);
        const overlap = newLabels.find(l => existingLabels.has(l));
        if (overlap) {
            alert(`Etiket çakışması bulundu: ${overlap}`);
            break;
        }

        const newRange = parseLabelRange(newLabelsStr);
        let newName = shiftNameWithRange(baseBlock.name, baseRange, newRange, i + 1);
        while (existingNames.has(newName)) newName = `${newName}_${Math.floor(Math.random() * 1000)}`;

        const originX = (baseBlock.origin?.[0] || 0) + offsetX * i;
        const originY = (baseBlock.origin?.[1] || 0) + offsetY * i;

        const cloned = {
            ...baseBlock,
            name: newName,
            fieldLabels: [newLabelsStr],
            origin: [originX, originY],
            bubbleValues: Array.isArray(baseBlock.bubbleValues) ? [...baseBlock.bubbleValues] : undefined,
        };

        fieldBlocks.push(cloned);
        templateData.fieldBlocks[newName] = isCustomFieldType(baseBlock.fieldType)
            ? {
                bubbleValues: cloned.bubbleValues || [],
                fieldLabels: [newLabelsStr],
                origin: [originX, originY],
                bubblesGap: cloned.bubblesGap,
                labelsGap: cloned.labelsGap,
                direction: cloned.direction,
            }
            : {
                fieldType: cloned.fieldType,
                fieldLabels: [newLabelsStr],
                origin: [originX, originY],
                bubblesGap: cloned.bubblesGap,
                labelsGap: cloned.labelsGap,
                direction: cloned.direction,
            };

        existingNames.add(newName);
        newLabels.forEach(l => existingLabels.add(l));
        lastIndex = fieldBlocks.length - 1;
    }

    updateBlocksList();
    updateJsonPreview();
    drawImage();
    selectBlock(lastIndex);
}

function saveBlock() {
    addBlock();
}

function addBlock() {
    const name = document.getElementById('block-name').value.trim();
    const fieldType = document.getElementById('block-type').value;
    let labels = document.getElementById('block-labels').value.trim();
    const originX = parseInt(document.getElementById('block-origin-x').value) || 0;
    const originY = parseInt(document.getElementById('block-origin-y').value) || 0;
    const bubblesGap = parseFloat(document.getElementById('block-bubbles-gap').value) || 40;
    const labelsGap = parseFloat(document.getElementById('block-labels-gap').value) || 50;
    const direction = getCurrentFormDirection();

    // Unified add/update logic (kept here to avoid depending on old UI strings)
    {
        const isEditing = activeBlockIndex >= 0;
        const previousName = isEditing ? fieldBlocks[activeBlockIndex]?.name : null;

        if (!name) {
            alert('Blok adı gerekli!');
            return;
        }
        if (!labels) {
            alert('Alan etiketleri gerekli! Örn: q1..30 veya ad1..12');
            return;
        }

        const desiredLabelCount = parseInt(document.getElementById('block-num-labels')?.value) || 1;
        const expandedLabels = expandLabelRangeIfNeeded(labels, desiredLabelCount);
        if (expandedLabels !== labels) {
            labels = expandedLabels;
            document.getElementById('block-labels').value = labels;
        }

        const parsedLabels = parseLabels(labels);
        const existingLabels = getAllParsedLabelsSet(isEditing ? activeBlockIndex : -1);
        const overlap = parsedLabels.find(l => existingLabels.has(l));
        if (overlap) {
            alert(`Etiket çakışması bulundu: ${overlap}`);
            return;
        }

        const isCustom = isCustomFieldType(fieldType);
        const bubbleValues = isCustom ? parseCustomBubbleValues() : [];
        if (isCustom && bubbleValues.length === 0) {
            alert('CUSTOM için "Kabarcık Değerleri" gerekli! (Örn: A,B,C,D)');
            return;
        }

        templateData.fieldBlocks = templateData.fieldBlocks || {};

        if (isEditing) {
            if (!previousName) return;

            if (name !== previousName && templateData.fieldBlocks[name]) {
                alert('Bu isimde bir blok zaten var.');
                return;
            }

            if (name !== previousName) {
                delete templateData.fieldBlocks[previousName];
            }

            const block = fieldBlocks[activeBlockIndex];
            block.name = name;
            block.fieldType = fieldType;
            block.bubbleValues = isCustom ? bubbleValues : undefined;
            block.fieldLabels = [labels];
            block.origin = [originX, originY];
            block.bubblesGap = bubblesGap;
            block.labelsGap = labelsGap;
            block.direction = direction;

            templateData.fieldBlocks[name] = isCustom
                ? {
                    bubbleValues: bubbleValues,
                    fieldLabels: [labels],
                    origin: [originX, originY],
                    bubblesGap: bubblesGap,
                    labelsGap: labelsGap,
                    direction: direction
                }
                : {
                    fieldType: fieldType,
                    fieldLabels: [labels],
                    origin: [originX, originY],
                    bubblesGap: bubblesGap,
                    labelsGap: labelsGap,
                    direction: direction
                };

            updateBlocksList();
            updateJsonPreview();
            drawImage();
            formDirty = false;
            setFormMode(true);
            syncDuplicateDefaultsForLabels(labels);
            showToast(`"${name}" bloğu güncellendi`);
            return;
        }

        if (templateData.fieldBlocks[name]) {
            alert('Bu isimde bir blok zaten var.');
            return;
        }

        const block = {
            name: name,
            fieldType: fieldType,
            bubbleValues: isCustom ? bubbleValues : undefined,
            fieldLabels: [labels],
            origin: [originX, originY],
            bubblesGap: bubblesGap,
            labelsGap: labelsGap,
            direction: direction
        };

        fieldBlocks.push(block);
        templateData.fieldBlocks[name] = isCustom
            ? {
                bubbleValues: bubbleValues,
                fieldLabels: [labels],
                origin: [originX, originY],
                bubblesGap: bubblesGap,
                labelsGap: labelsGap,
                direction: direction
            }
            : {
                fieldType: fieldType,
                fieldLabels: [labels],
                origin: [originX, originY],
                bubblesGap: bubblesGap,
                labelsGap: labelsGap,
                direction: direction
            };

        activeBlockIndex = fieldBlocks.length - 1;
        updateBlocksList();
        updateJsonPreview();
        drawImage();
        formDirty = false;
        setFormMode(true);
        syncDuplicateDefaultsForLabels(labels);
        showToast(`"${name}" bloğu eklendi`);
        return;
    }

    if (!name) {
        alert('Blok adı gerekli!');
        return;
    }
    if (!labels) {
        alert('Alan etiketleri gerekli! Örn: q1..30 veya ad1..12');
        return;
    }

    const desiredLabelCount = parseInt(document.getElementById('block-num-labels')?.value) || 1;
    const expandedLabels = expandLabelRangeIfNeeded(labels, desiredLabelCount);
    if (expandedLabels !== labels) {
        labels = expandedLabels;
        document.getElementById('block-labels').value = labels;
    }

    const isCustom = isCustomFieldType(fieldType);
    const bubbleValues = isCustom ? parseCustomBubbleValues() : [];

    if (isCustom && bubbleValues.length === 0) {
        alert('CUSTOM icin "Kabarcik Degerleri" gerekli! (Orn: A,B,C,D)');
        return;
    }

    const block = {
        name: name,
        fieldType: fieldType,
        bubbleValues: isCustom ? bubbleValues : undefined,
        fieldLabels: [labels],
        origin: [originX, originY],
        bubblesGap: bubblesGap,
        labelsGap: labelsGap,
        direction: direction
    };

    fieldBlocks.push(block);

    // Add to template data (schema-valid)
    templateData.fieldBlocks[name] = isCustom
        ? {
            bubbleValues: bubbleValues,
            fieldLabels: [labels],
            origin: [originX, originY],
            bubblesGap: bubblesGap,
            labelsGap: labelsGap,
            direction: direction
        }
        : {
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
    const customValuesEl = document.getElementById('custom-bubble-values');
    if (customValuesEl) customValuesEl.value = '';
    document.getElementById('block-form-panel').style.display = 'none';
    clearOverlay();
    formDirty = false;
    activeBlockIndex = -1;
    setFormMode(false);
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
    if (index === activeBlockIndex) return;

    if (activeBlockIndex >= 0 && formDirty) {
        const ok = confirm('Seçili blokta kaydedilmemiş değişiklikler var. Kaydetmeden devam edilsin mi?');
        if (!ok) return;
    }

    formDirty = false;
    suppressDirty = true;
    isPopulatingBlockForm = true;

    // Disable auto-gap when loading existing block to preserve its settings
    autoGapEnabled = false;
    const autoGapEl = document.getElementById('auto-gap');
    if (autoGapEl) autoGapEl.checked = false;

    const selectionModeEl = document.getElementById('selection-mode');
    if (selectionModeEl) selectionModeEl.checked = false;
    overlayCanvas.style.cursor = 'move';

    activeBlockIndex = index;
    const block = fieldBlocks[index];

    // Populate form
    document.getElementById('block-name').value = block.name;
    document.getElementById('block-type').value = block.fieldType;
    if (block.fieldType === 'CUSTOM') {
        const customValuesEl = document.getElementById('custom-bubble-values');
        if (customValuesEl && Array.isArray(block.bubbleValues)) {
            customValuesEl.value = block.bubbleValues.join(',');
        }
    }
    document.getElementById('block-labels').value = block.fieldLabels[0] || '';
    document.getElementById('block-origin-x').value = block.origin[0];
    document.getElementById('block-origin-y').value = block.origin[1];
    document.getElementById('block-bubbles-gap').value = block.bubblesGap;
    document.getElementById('block-labels-gap').value = block.labelsGap;
    document.getElementById('block-direction').value = block.direction;
    syncBlockFormForType(false);

    // Calculate selection size
    const numBubbles = getBubbleCount(block.fieldType, block.bubbleValues);
    const numLabels = Math.max(1, parseLabels(block.fieldLabels[0]).length);
    const [bubbleW, bubbleH] = templateData.bubbleDimensions || [25, 25];

    if (block.direction === 'horizontal') {
        document.getElementById('selection-width').value =
            bubbleW + Math.max(0, numBubbles - 1) * block.bubblesGap;
        document.getElementById('selection-height').value =
            bubbleH + Math.max(0, numLabels - 1) * block.labelsGap;
    } else {
        document.getElementById('selection-width').value =
            bubbleW + Math.max(0, numLabels - 1) * block.labelsGap;
        document.getElementById('selection-height').value =
            bubbleH + Math.max(0, numBubbles - 1) * block.bubblesGap;
    }

    document.getElementById('block-num-bubbles').value = numBubbles;
    document.getElementById('block-num-labels').value = numLabels;

    document.getElementById('block-form-panel').style.display = 'block';
    setFormMode(true);
    syncDuplicateDefaultsForLabels(block.fieldLabels[0]);
    updateBlocksList();
    drawImage();
    isPopulatingBlockForm = false;
    suppressDirty = false;
    showToast(`Seçildi: ${block.name}`);
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
    // Color scheme: active block = green, others = red
    const activeColor = '#10b981';  // Emerald green
    const inactiveColor = '#ef4444'; // Red
    const color = isActive ? activeColor : inactiveColor;

    const origin = block.origin;
    const numLabels = parseLabels(block.fieldLabels[0]).length || 1;
    const numBubbles = getBubbleCount(block.fieldType, block.bubbleValues);

    const [bubbleW, bubbleH] = templateData.bubbleDimensions || [25, 25];

    let width, height;
    if (block.direction === 'horizontal') {
        width = bubbleW + Math.max(0, numBubbles - 1) * block.bubblesGap;
        height = bubbleH + Math.max(0, numLabels - 1) * block.labelsGap;
    } else {
        width = bubbleW + Math.max(0, numLabels - 1) * block.labelsGap;
        height = bubbleH + Math.max(0, numBubbles - 1) * block.bubblesGap;
    }

    // Active fill (helps focus)
    if (isActive) {
        ctx.fillStyle = 'rgba(34, 211, 238, 0.12)';
        ctx.fillRect(origin[0], origin[1], width, height);
    }

    // Block outline
    ctx.strokeStyle = color;
    ctx.lineWidth = isActive ? 4 : 2;
    ctx.strokeRect(origin[0], origin[1], width, height);

    // Label background
    const labelText = block.name;
    ctx.font = 'bold 14px Inter, sans-serif';
    const textWidth = ctx.measureText(labelText).width + 10;

    ctx.fillStyle = color;
    ctx.fillRect(origin[0], origin[1] - 22, textWidth, 20);

    // Label text
    ctx.fillStyle = isActive ? '#0f0f1a' : '#ffffff';
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
                bx = origin[0] + c * block.bubblesGap + bubbleW / 2;
                by = origin[1] + r * block.labelsGap + bubbleH / 2;
            } else {
                bx = origin[0] + c * block.labelsGap + bubbleW / 2;
                by = origin[1] + r * block.bubblesGap + bubbleH / 2;
            }

            ctx.beginPath();
            ctx.arc(bx, by, 8, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    ctx.globalAlpha = 1;
}

// ==================== UTILITIES ====================

function getBubbleCount(fieldType, bubbleValues) {
    if (fieldType === 'CUSTOM' && Array.isArray(bubbleValues) && bubbleValues.length > 0) {
        return bubbleValues.length;
    }

    const counts = {
        'QTYPE_MCQ4': 4,
        'QTYPE_MCQ5': 5,
        'QTYPE_INT': 10,
        'QTYPE_INT_FROM_1': 10,
        'QTYPE_TR_ALPHABET': 29,
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

function expandLabelRangeIfNeeded(labelStr, desiredCount) {
    const trimmed = (labelStr || '').trim();
    if (!trimmed || desiredCount <= 1) return trimmed;
    if (trimmed.includes('..') || trimmed.includes(',')) return trimmed;

    const withStart = trimmed.match(/^([a-zA-Z_]+)(\d+)$/);
    if (withStart) {
        const prefix = withStart[1];
        const start = parseInt(withStart[2]);
        if (Number.isFinite(start)) {
            return `${prefix}${start}..${start + desiredCount - 1}`;
        }
    }

    if (/^[a-zA-Z_]+$/.test(trimmed)) {
        return `${trimmed}1..${desiredCount}`;
    }

    return trimmed;
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
