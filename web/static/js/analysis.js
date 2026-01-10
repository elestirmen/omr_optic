/**
 * OMRChecker - Results/Analysis Module
 * Provides answer key management, scoring, and cheating detection
 */

// State
let currentSessionId = null;
let currentAnswerKey = {};
let csvData = null;
let dataSource = 'session'; // 'session' or 'csv'
let lastScoreResults = null;
let lastCheatingResults = null;
let currentMode = 'score'; // 'score' or 'cheating'

// DOM Elements
const sessionSelect = document.getElementById('session-select');
const questionCountInput = document.getElementById('question-count');
const answerGrid = document.getElementById('answer-grid');
const calculateBtn = document.getElementById('calculate-btn');
const detectBtn = document.getElementById('detect-btn');
const resultsContent = document.getElementById('results-content');
const resultsEmpty = document.getElementById('results-empty');
const savedKeysList = document.getElementById('saved-keys-list');
const downloadExcelBtn = document.getElementById('download-excel-btn');
const quickFillInput = document.getElementById('quick-fill-input');
const applyQuickFillBtn = document.getElementById('apply-quick-fill-btn');
const sessionCountInfo = document.getElementById('session-count-info');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupDataSourceOptions();
    setupModeTabs();
    setupCsvUpload();
    generateAnswerGrid(parseInt(questionCountInput.value));
    loadSavedKeys();
    fetchServerSessions();
    checkUrlParams();

    // Event listeners
    questionCountInput.addEventListener('change', () => {
        generateAnswerGrid(parseInt(questionCountInput.value));
    });

    sessionSelect.addEventListener('change', () => {
        currentSessionId = sessionSelect.value;
        updateButtonStates();
    });

    document.getElementById('refresh-sessions-btn')?.addEventListener('click', () => {
        fetchServerSessions(true);
    });

    calculateBtn.addEventListener('click', calculateScores);
    detectBtn.addEventListener('click', detectCheating);
    downloadExcelBtn.addEventListener('click', downloadResults);

    document.getElementById('save-key-btn').addEventListener('click', saveKey);
    document.getElementById('clear-key-btn').addEventListener('click', clearKey);
    
    applyQuickFillBtn?.addEventListener('click', () => {
        applyQuickFill();
        setTimeout(updateButtonStates, 100);
    });
});

function setupDataSourceOptions() {
    const options = document.querySelectorAll('.data-option');
    const sessionWrapper = document.getElementById('session-wrapper');
    const csvWrapper = document.getElementById('csv-wrapper');

    options.forEach(option => {
        option.addEventListener('click', () => {
            options.forEach(o => o.classList.remove('active'));
            option.classList.add('active');
            
            dataSource = option.dataset.source;
            
            if (dataSource === 'session') {
                sessionWrapper.classList.add('show');
                csvWrapper.classList.remove('show');
            } else {
                sessionWrapper.classList.remove('show');
                csvWrapper.classList.add('show');
            }
            
            updateButtonStates();
        });
    });
}

function setupModeTabs() {
    const tabs = document.querySelectorAll('.mode-tab');
    const contents = document.querySelectorAll('.mode-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            currentMode = tab.dataset.mode;
            document.getElementById(`${currentMode}-mode`).classList.add('active');
        });
    });
}

function setupCsvUpload() {
    const dropzone = document.getElementById('csv-dropzone');
    const fileInput = document.getElementById('csv-file-input');
    const fileLoaded = document.getElementById('csv-file-loaded');
    const removeBtn = document.getElementById('remove-csv-btn');

    dropzone.addEventListener('click', () => fileInput.click());

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
        const file = e.dataTransfer.files[0];
        if (file && file.name.endsWith('.csv')) {
            handleCsvFile(file);
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files[0]) {
            handleCsvFile(fileInput.files[0]);
        }
    });

    removeBtn.addEventListener('click', removeCsvData);
}

function handleCsvFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        parseCsvData(e.target.result, file.name);
    };
    reader.readAsText(file, 'UTF-8');
}

function parseCsvData(text, fileName) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) {
        alert('CSV dosyası geçersiz veya boş');
        return;
    }

    const headers = parseCSVLine(lines[0]);
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row = {};
        headers.forEach((h, idx) => {
            row[h] = values[idx] || '';
        });
        rows.push(row);
    }

    const questionCols = headers.filter(h => /^[qQ]\d+$/.test(h));
    questionCols.sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)[0]);
        const numB = parseInt(b.match(/\d+/)[0]);
        return numA - numB;
    });

    csvData = { fileName, headers, rows, questionCols };

    // Update UI
    document.getElementById('csv-file-name').textContent = fileName;
    document.getElementById('csv-file-stats').textContent = `${rows.length} satır, ${questionCols.length} soru`;
    document.getElementById('csv-file-loaded').classList.add('show');
    document.getElementById('csv-dropzone').style.display = 'none';

    if (questionCols.length > 0) {
        questionCountInput.value = questionCols.length;
        generateAnswerGrid(questionCols.length);
    }

    updateButtonStates();
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

function removeCsvData() {
    csvData = null;
    document.getElementById('csv-file-loaded').classList.remove('show');
    document.getElementById('csv-dropzone').style.display = 'block';
    document.getElementById('csv-file-input').value = '';
    updateButtonStates();
}

async function fetchServerSessions(showLoading = false) {
    if (showLoading) {
        sessionSelect.innerHTML = '<option value="">Yükleniyor...</option>';
    }
    
    try {
        const response = await fetch('/api/sessions');
        const data = await response.json();

        sessionSelect.innerHTML = '<option value="">Oturum seçin...</option>';

        if (data.sessions && data.sessions.length > 0) {
            data.sessions.forEach(session => {
                const option = document.createElement('option');
                option.value = session.id;
                const date = new Date(session.modified).toLocaleDateString('tr-TR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                option.textContent = `${session.id.substring(0, 8)}... - ${date}`;
                sessionSelect.appendChild(option);
            });
            
            sessionCountInfo.textContent = `${data.sessions.length} oturum bulundu`;
        } else {
            sessionCountInfo.textContent = 'Henüz oturum yok. Önce OMR işleme yapın.';
        }
        
        // Also load from localStorage
        loadRecentSessions();
    } catch (error) {
        console.error('Failed to fetch sessions:', error);
        sessionCountInfo.textContent = 'Oturumlar yüklenemedi';
    }
}

function loadRecentSessions() {
    const recent = JSON.parse(localStorage.getItem('omr_recent_sessions') || localStorage.getItem('recentSessions') || '[]');
    recent.forEach(session => {
        const exists = Array.from(sessionSelect.options).some(opt => opt.value === session.id);
        if (!exists && session.id) {
            const option = document.createElement('option');
            option.value = session.id;
            option.textContent = session.name || `${session.id.substring(0, 8)}...`;
            sessionSelect.appendChild(option);
        }
    });
}

function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session');
    if (sessionId) {
        let exists = false;
        for (let option of sessionSelect.options) {
            if (option.value === sessionId) {
                exists = true;
                break;
            }
        }
        if (!exists) {
            const option = document.createElement('option');
            option.value = sessionId;
            option.textContent = sessionId.substring(0, 8) + '...';
            sessionSelect.appendChild(option);
        }
        sessionSelect.value = sessionId;
        currentSessionId = sessionId;
        updateButtonStates();
    }
}

function generateAnswerGrid(count) {
    answerGrid.innerHTML = '';
    currentAnswerKey = {};

    for (let i = 1; i <= count; i++) {
        const item = document.createElement('div');
        item.className = 'answer-item';
        item.innerHTML = `
            <label>${i}</label>
            <select data-question="${i}">
                <option value="">-</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
                <option value="E">E</option>
            </select>
        `;
        answerGrid.appendChild(item);

        const select = item.querySelector('select');
        select.addEventListener('change', () => {
            if (select.value) {
                currentAnswerKey[i] = select.value;
            } else {
                delete currentAnswerKey[i];
            }
            updateButtonStates();
        });
    }
}

function applyQuickFill() {
    const input = quickFillInput.value.toUpperCase().replace(/[^A-E]/g, '');
    const selects = answerGrid.querySelectorAll('select');

    currentAnswerKey = {};
    selects.forEach((select, idx) => {
        if (idx < input.length) {
            select.value = input[idx];
            currentAnswerKey[idx + 1] = input[idx];
        }
    });
}

function updateButtonStates() {
    const hasData = (dataSource === 'csv' && csvData) || (dataSource === 'session' && currentSessionId);
    const hasAnswers = Object.keys(currentAnswerKey).length > 0;

    calculateBtn.disabled = !(hasData && hasAnswers);
    detectBtn.disabled = !hasData;
}

async function calculateScores() {
    if (dataSource === 'csv' && csvData) {
        calculateScoresFromCsv();
        return;
    }

    if (!currentSessionId) {
        alert('Lütfen bir oturum seçin');
        return;
    }

    calculateBtn.disabled = true;
    calculateBtn.textContent = 'Hesaplanıyor...';

    try {
        const response = await fetch(`/api/analysis/score/${currentSessionId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                answer_key: currentAnswerKey,
                scoring: {
                    correct_points: parseFloat(document.getElementById('correct-points').value),
                    wrong_points: parseFloat(document.getElementById('wrong-points').value),
                    empty_points: parseFloat(document.getElementById('empty-points').value)
                }
            })
        });

        const data = await response.json();
        if (data.success) {
            lastScoreResults = data;
            displayScoreResults(data);
        } else {
            alert('Hata: ' + (data.error || 'Bilinmeyen hata'));
        }
    } catch (error) {
        alert('Bağlantı hatası: ' + error.message);
    } finally {
        calculateBtn.disabled = false;
        calculateBtn.textContent = 'Puanları Hesapla';
    }
}

function calculateScoresFromCsv() {
    if (!csvData) return;

    const correctPts = parseFloat(document.getElementById('correct-points').value);
    const wrongPts = parseFloat(document.getElementById('wrong-points').value);
    const emptyPts = parseFloat(document.getElementById('empty-points').value);

    const answerKeyNums = new Set(Object.keys(currentAnswerKey).map(k => parseInt(k)));
    const questionCols = csvData.questionCols.filter(qCol => {
        const qNum = parseInt(qCol.match(/\d+/)[0]);
        return answerKeyNums.has(qNum);
    });

    if (questionCols.length === 0) {
        alert('Cevap anahtarı ile eşleşen soru bulunamadı');
        return;
    }

    const results = [];

    csvData.rows.forEach((row, idx) => {
        let correct = 0, wrong = 0, empty = 0;
        let answersStr = '';

        questionCols.forEach(qCol => {
            const qNum = parseInt(qCol.match(/\d+/)[0]);
            const studentAnswer = (row[qCol] || '').trim().toUpperCase();
            const correctAnswer = (currentAnswerKey[qNum] || '').toUpperCase();

            if (!studentAnswer || studentAnswer === '*' || studentAnswer === '-') {
                empty++;
                answersStr += '-';
            } else if (studentAnswer === correctAnswer) {
                correct++;
                answersStr += studentAnswer;
            } else {
                wrong++;
                answersStr += studentAnswer;
            }
        });

        const score = (correct * correctPts) + (wrong * wrongPts) + (empty * emptyPts);

        let fileName = row['file_name'] || row['filename'] || row['file_id'] || '';
        let studentId = row['Ogrenci_No'] || row['ogrenci_no'] || row['OgrenciNo'] || 
                        row['student_id'] || row['id'] || '';
        let tcKimlik = row['TC_Kimlik'] || row['tc_kimlik'] || row['TCKimlik'] || row['tc'] || '';
        let studentName = row['ad'] || row['Ad'] || row['AD'] || row['name'] || row['adsoyad'] || '';

        if (!studentId && fileName) {
            const cleanFileName = fileName.split(/[\/\\]/).pop() || fileName;
            const nameWithoutExt = cleanFileName.replace(/\.[^.]+$/, '');
            const numbers = nameWithoutExt.match(/\d{6,}/);
            studentId = numbers ? numbers[0] : nameWithoutExt;
        }

        if (!studentId) {
            studentId = `Satır ${idx + 1}`;
        }

        results.push({
            file_name: fileName,
            student_id: studentId,
            student_name: studentName,
            tc_kimlik: tcKimlik,
            answers: answersStr,
            correct_count: correct,
            wrong_count: wrong,
            empty_count: empty,
            score: score
        });
    });

    results.sort((a, b) => b.score - a.score || a.student_id.localeCompare(b.student_id));

    const data = {
        success: true,
        session_id: 'csv_upload',
        total_students: results.length,
        total_questions: questionCols.length,
        results: results,
        statistics: {
            average_score: results.reduce((s, r) => s + r.score, 0) / results.length,
            max_score: Math.max(...results.map(r => r.score)),
            min_score: Math.min(...results.map(r => r.score)),
            total_correct: results.reduce((s, r) => s + r.correct_count, 0),
            total_wrong: results.reduce((s, r) => s + r.wrong_count, 0),
            total_empty: results.reduce((s, r) => s + r.empty_count, 0)
        }
    };

    lastScoreResults = data;
    displayScoreResults(data);
}

function displayScoreResults(data) {
    document.getElementById('results-title').textContent = 'Puan Sonuçları';
    resultsEmpty.style.display = 'none';
    resultsContent.style.display = 'block';

    const statsContainer = document.getElementById('results-stats');
    const resultsList = document.getElementById('results-list');

    const stats = data.statistics;
    statsContainer.innerHTML = `
        <div class="stat-box">
            <div class="stat-value">${data.total_students}</div>
            <div class="stat-label">Öğrenci</div>
        </div>
        <div class="stat-box">
            <div class="stat-value">${stats.average_score?.toFixed(1) || 0}</div>
            <div class="stat-label">Ortalama</div>
        </div>
        <div class="stat-box">
            <div class="stat-value">${stats.max_score?.toFixed(1) || 0}</div>
            <div class="stat-label">En Yüksek</div>
        </div>
        <div class="stat-box">
            <div class="stat-value">${stats.min_score?.toFixed(1) || 0}</div>
            <div class="stat-label">En Düşük</div>
        </div>
    `;

    resultsList.innerHTML = data.results.map((r, i) => {
        const displayName = r.student_name || '';
        const displayId = r.student_id || '';
        const displayTc = r.tc_kimlik || '';

        let details = [];
        if (displayName) details.push(displayName);
        if (displayTc) details.push(`TC: ${displayTc}`);

        return `
            <div class="score-result">
                <div class="rank ${i < 3 ? 'top3' : ''}">${i + 1}</div>
                <div class="student-info">
                    <div class="student-id">${displayId}</div>
                    <div class="student-details">${details.join(' • ')}</div>
                </div>
                <div class="score-info">
                    <div class="score-value">${r.score.toFixed(1)}</div>
                    <div class="score-breakdown">D:${r.correct_count} Y:${r.wrong_count} B:${r.empty_count}</div>
                </div>
            </div>
        `;
    }).join('');
}

async function detectCheating() {
    if (dataSource === 'csv' && csvData) {
        detectCheatingFromCsv();
        return;
    }

    if (!currentSessionId) {
        alert('Lütfen bir oturum seçin');
        return;
    }

    detectBtn.disabled = true;
    detectBtn.textContent = 'Analiz ediliyor...';

    try {
        const response = await fetch(`/api/analysis/cheating/${currentSessionId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                similarity_threshold: parseFloat(document.getElementById('similarity-threshold').value),
                pearson_threshold: parseFloat(document.getElementById('pearson-threshold').value),
                min_common_wrong: parseInt(document.getElementById('common-wrong-threshold').value)
            })
        });

        const data = await response.json();
        if (data.success) {
            lastCheatingResults = data;
            displayCheatingResults(data);
        } else {
            alert('Hata: ' + (data.error || 'Bilinmeyen hata'));
        }
    } catch (error) {
        alert('Bağlantı hatası: ' + error.message);
    } finally {
        detectBtn.disabled = false;
        detectBtn.textContent = 'Kopya Tespit Et';
    }
}

function detectCheatingFromCsv() {
    if (!csvData) return;

    const simThreshold = parseFloat(document.getElementById('similarity-threshold').value);
    const pearsonThreshold = parseFloat(document.getElementById('pearson-threshold').value);
    const minCommonWrong = parseInt(document.getElementById('common-wrong-threshold').value);

    const questionCols = csvData.questionCols;

    const students = csvData.rows.map((row, idx) => {
        const answers = questionCols.map(qCol => {
            const ans = (row[qCol] || '').trim().toUpperCase();
            if (!ans || ans === '*' || ans === '-') return '';
            return ans;
        });

        let fileName = row['file_name'] || row['filename'] || row['file_id'] || '';
        let studentId = row['Ogrenci_No'] || row['ogrenci_no'] || row['OgrenciNo'] || 
                        row['student_id'] || row['id'] || '';
        let studentName = row['ad'] || row['Ad'] || row['AD'] || row['name'] || '';

        if (!studentId && fileName) {
            const cleanFileName = fileName.split(/[\/\\]/).pop() || fileName;
            const nameWithoutExt = cleanFileName.replace(/\.[^.]+$/, '');
            const numbers = nameWithoutExt.match(/\d{6,}/);
            studentId = numbers ? numbers[0] : nameWithoutExt;
        }

        if (!studentId) {
            studentId = `Satır ${idx + 1}`;
        }

        const displayId = studentName ? `${studentId} (${studentName})` : studentId;

        return { studentId: displayId, fileName, answers };
    });

    const cheatingPairs = [];

    for (let i = 0; i < students.length; i++) {
        for (let j = i + 1; j < students.length; j++) {
            const s1 = students[i];
            const s2 = students[j];

            let similar = 0;
            let total = Math.max(s1.answers.length, s2.answers.length);
            for (let k = 0; k < Math.min(s1.answers.length, s2.answers.length); k++) {
                if (s1.answers[k] === s2.answers[k] && s1.answers[k] !== '') {
                    similar++;
                }
            }
            const simRatio = total > 0 ? similar / total : 0;
            const pearson = simRatio;
            const commonWrong = similar;

            const isSuspicious = (simRatio >= simThreshold && pearson >= pearsonThreshold) || 
                                 commonWrong >= minCommonWrong;

            if (isSuspicious) {
                const details = [];
                if (simRatio >= simThreshold) details.push(`Benzerlik: %${(simRatio * 100).toFixed(1)}`);
                if (commonWrong >= minCommonWrong) details.push(`Ortak: ${commonWrong}`);

                cheatingPairs.push({
                    student1_id: s1.studentId,
                    student1_file: s1.fileName,
                    student2_id: s2.studentId,
                    student2_file: s2.fileName,
                    similarity_ratio: simRatio,
                    pearson_correlation: pearson,
                    common_wrong_answers: commonWrong,
                    details: details.join(' | ')
                });
            }
        }
    }

    cheatingPairs.sort((a, b) => b.similarity_ratio - a.similarity_ratio);

    const data = {
        success: true,
        session_id: 'csv_upload',
        total_students: students.length,
        total_pairs_checked: students.length * (students.length - 1) / 2,
        suspicious_pairs: cheatingPairs.length,
        results: cheatingPairs
    };

    lastCheatingResults = data;
    displayCheatingResults(data);
}

function displayCheatingResults(data) {
    document.getElementById('results-title').textContent = 'Kopya Tespit Sonuçları';
    resultsEmpty.style.display = 'none';
    resultsContent.style.display = 'block';

    const statsContainer = document.getElementById('results-stats');
    const resultsList = document.getElementById('results-list');

    statsContainer.innerHTML = `
        <div class="stat-box">
            <div class="stat-value">${data.total_students}</div>
            <div class="stat-label">Öğrenci</div>
        </div>
        <div class="stat-box">
            <div class="stat-value">${data.total_pairs_checked}</div>
            <div class="stat-label">Karşılaştırma</div>
        </div>
        <div class="stat-box">
            <div class="stat-value" style="color: ${data.suspicious_pairs > 0 ? 'var(--danger)' : 'var(--success)'}">
                ${data.suspicious_pairs}
            </div>
            <div class="stat-label">Şüpheli</div>
        </div>
        <div class="stat-box">
            <div class="stat-value">${data.suspicious_pairs > 0 ? '⚠️' : '✅'}</div>
            <div class="stat-label">Durum</div>
        </div>
    `;

    if (data.results.length === 0) {
        resultsList.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: var(--success);">
                <div style="font-size: 64px; margin-bottom: 15px;">✅</div>
                <h3 style="margin: 0 0 8px;">Temiz!</h3>
                <p style="margin: 0; color: var(--text-muted);">Şüpheli kopya tespit edilmedi</p>
            </div>
        `;
        return;
    }

    resultsList.innerHTML = data.results.map(r => `
        <div class="cheating-result">
            <div class="cheating-pair">
                <div class="cheating-student">${r.student1_id}</div>
                <div class="cheating-vs">↔</div>
                <div class="cheating-student">${r.student2_id}</div>
            </div>
            <div class="cheating-metrics">
                <span class="cheating-metric ${r.similarity_ratio >= 0.85 ? 'danger' : ''}">
                    Benzerlik: %${(r.similarity_ratio * 100).toFixed(1)}
                </span>
                <span class="cheating-metric ${r.pearson_correlation >= 0.90 ? 'danger' : ''}">
                    Pearson: ${r.pearson_correlation.toFixed(3)}
                </span>
                <span class="cheating-metric">
                    Ortak: ${r.common_wrong_answers}
                </span>
            </div>
        </div>
    `).join('');
}

async function downloadResults() {
    if (dataSource === 'csv' && csvData) {
        if (currentMode === 'score' && lastScoreResults) {
            downloadResultsAsCsv(lastScoreResults.results, 'puanlar');
        } else if (currentMode === 'cheating' && lastCheatingResults) {
            downloadResultsAsCsv(lastCheatingResults.results, 'kopya_tespit');
        }
        return;
    }

    if (!currentSessionId) return;

    try {
        const endpoint = currentMode === 'score'
            ? `/api/analysis/score/${currentSessionId}/excel`
            : `/api/analysis/cheating/${currentSessionId}/excel`;

        const body = currentMode === 'score'
            ? {
                answer_key: currentAnswerKey,
                scoring: {
                    correct_points: parseFloat(document.getElementById('correct-points').value),
                    wrong_points: parseFloat(document.getElementById('wrong-points').value),
                    empty_points: parseFloat(document.getElementById('empty-points').value)
                }
            }
            : {
                similarity_threshold: parseFloat(document.getElementById('similarity-threshold').value),
                pearson_threshold: parseFloat(document.getElementById('pearson-threshold').value),
                min_common_wrong: parseInt(document.getElementById('common-wrong-threshold').value)
            };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${currentMode === 'score' ? 'puanlar' : 'kopya_tespit'}_${currentSessionId.substring(0, 8)}.xlsx`;
            a.click();
            window.URL.revokeObjectURL(url);
        }
    } catch (error) {
        console.error('Download error:', error);
    }
}

function downloadResultsAsCsv(results, prefix) {
    if (!results || results.length === 0) return;

    const orderedKeys = [
        'student_id', 'student_name', 'tc_kimlik',
        'correct_count', 'wrong_count', 'empty_count', 'score', 'answers',
        'student1_id', 'student2_id', 'similarity_ratio', 'pearson_correlation', 'common_wrong_answers', 'details'
    ];

    const existingKeys = Object.keys(results[0]);
    const headers = orderedKeys.filter(k => existingKeys.includes(k))
        .concat(existingKeys.filter(k => !orderedKeys.includes(k) && k !== 'file_name' && k !== 'student1_file' && k !== 'student2_file'));

    const headerMap = {
        'file_name': 'Dosya',
        'student_id': 'Öğrenci No',
        'student_name': 'Ad Soyad',
        'tc_kimlik': 'TC Kimlik',
        'answers': 'Cevaplar',
        'correct_count': 'Doğru',
        'wrong_count': 'Yanlış',
        'empty_count': 'Boş',
        'score': 'Puan',
        'student1_id': 'Öğrenci 1',
        'student2_id': 'Öğrenci 2',
        'similarity_ratio': 'Benzerlik Oranı',
        'pearson_correlation': 'Pearson Korelasyonu',
        'common_wrong_answers': 'Ortak Cevaplar',
        'details': 'Detaylar'
    };

    const csvHeaders = headers.map(h => headerMap[h] || h);

    let csvContent = '\uFEFF';
    csvContent += csvHeaders.join(';') + '\n';

    results.forEach(row => {
        const values = headers.map(h => {
            let val = row[h];
            if (typeof val === 'number') {
                val = val.toString().replace('.', ',');
            }
            if (typeof val === 'string' && (val.includes(';') || val.includes('"') || val.includes('\n'))) {
                val = '"' + val.replace(/"/g, '""') + '"';
            }
            return val || '';
        });
        csvContent += values.join(';') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${prefix}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

async function saveKey() {
    const name = prompt('Anahtar adı girin:');
    if (!name) return;

    try {
        const response = await fetch('/api/analysis/answer-keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                answers: currentAnswerKey,
                question_count: parseInt(questionCountInput.value),
                correct_points: parseFloat(document.getElementById('correct-points').value),
                wrong_points: parseFloat(document.getElementById('wrong-points').value),
                empty_points: parseFloat(document.getElementById('empty-points').value)
            })
        });

        const data = await response.json();
        if (data.success) {
            loadSavedKeys();
        }
    } catch (error) {
        alert('Kaydetme hatası: ' + error.message);
    }
}

function clearKey() {
    currentAnswerKey = {};
    const selects = answerGrid.querySelectorAll('select');
    selects.forEach(s => s.value = '');
    quickFillInput.value = '';
    updateButtonStates();
}

async function loadSavedKeys() {
    try {
        const response = await fetch('/api/analysis/answer-keys');
        const data = await response.json();

        if (data.keys && data.keys.length > 0) {
            savedKeysList.innerHTML = data.keys.map(key => `
                <div class="saved-key-item">
                    <span class="saved-key-name">${key.name} (${key.question_count})</span>
                    <div class="saved-key-actions">
                        <button class="btn btn-outline btn-sm" onclick="loadKey('${key.name}')">Yükle</button>
                        <button class="btn btn-outline btn-sm" onclick="deleteKey('${key.name}')" style="color: var(--danger);">✕</button>
                    </div>
                </div>
            `).join('');
        } else {
            savedKeysList.innerHTML = '<p style="color: var(--text-muted); font-size: 12px; text-align: center;">Kayıtlı anahtar yok</p>';
        }
    } catch (error) {
        console.error('Failed to load keys:', error);
    }
}

async function loadKey(name) {
    try {
        const response = await fetch(`/api/analysis/answer-keys/${name}`);
        const data = await response.json();

        if (data) {
            questionCountInput.value = data.question_count;
            generateAnswerGrid(data.question_count);

            currentAnswerKey = data.answers;
            Object.entries(data.answers).forEach(([q, ans]) => {
                const select = answerGrid.querySelector(`select[data-question="${q}"]`);
                if (select) select.value = ans;
            });

            if (data.scoring) {
                document.getElementById('correct-points').value = data.scoring.correct_points;
                document.getElementById('wrong-points').value = data.scoring.wrong_points;
                document.getElementById('empty-points').value = data.scoring.empty_points;
            }

            updateButtonStates();
        }
    } catch (error) {
        alert('Yükleme hatası: ' + error.message);
    }
}

async function deleteKey(name) {
    if (!confirm(`"${name}" anahtarını silmek istiyor musunuz?`)) return;

    try {
        await fetch(`/api/analysis/answer-keys/${name}`, { method: 'DELETE' });
        loadSavedKeys();
    } catch (error) {
        alert('Silme hatası: ' + error.message);
    }
}
