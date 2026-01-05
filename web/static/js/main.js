/**
 * OMRChecker Web Interface - Main JavaScript
 */

const API_BASE = '';

// Utility functions
async function apiRequest(endpoint, options = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    });
    return response.json();
}

// Health check and status
async function checkServerStatus() {
    try {
        const result = await apiRequest('/api/health');
        if (result.status === 'ok') {
            document.getElementById('server-status').textContent = 'Bağlı';
            document.querySelector('.status-indicator').classList.add('online');
        }
    } catch (error) {
        document.getElementById('server-status').textContent = 'Bağlantı Yok';
        document.querySelector('.status-indicator').classList.remove('online');
    }
}

// Load recent activity (placeholder for now)
function loadRecentActivity() {
    const activityList = document.getElementById('activity-list');
    if (!activityList) return;
    
    // Check localStorage for recent sessions
    const recentSessions = JSON.parse(localStorage.getItem('recentSessions') || '[]');
    
    if (recentSessions.length === 0) {
        activityList.innerHTML = `
            <div class="activity-empty">
                <span class="empty-icon">📋</span>
                <p>Henüz işlem yapılmadı</p>
            </div>
        `;
        return;
    }
    
    activityList.innerHTML = recentSessions.slice(0, 5).map(session => `
        <div class="activity-item" onclick="viewSession('${session.id}')">
            <span class="activity-icon">${session.type === 'scan' ? '🖨️' : '📄'}</span>
            <div class="activity-content">
                <div class="activity-title">${session.name || session.id}</div>
                <div class="activity-time">${formatDate(session.date)}</div>
            </div>
            <span class="activity-status ${session.status}">${session.status === 'success' ? 'Tamamlandı' : 'Bekliyor'}</span>
        </div>
    `).join('');
}

function viewSession(sessionId) {
    window.location.href = `process.html?session=${sessionId}`;
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Az önce';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} dakika önce`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} saat önce`;
    return date.toLocaleDateString('tr-TR');
}

// Save session to recent
function saveRecentSession(session) {
    const recentSessions = JSON.parse(localStorage.getItem('recentSessions') || '[]');
    recentSessions.unshift(session);
    localStorage.setItem('recentSessions', JSON.stringify(recentSessions.slice(0, 20)));
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkServerStatus();
    loadRecentActivity();
    
    // Check status periodically
    setInterval(checkServerStatus, 30000);
});

// Export for other scripts
window.OMR = {
    apiRequest,
    saveRecentSession,
    formatDate,
    API_BASE
};
