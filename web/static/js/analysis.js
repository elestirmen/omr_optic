/**
 * OMRChecker - Results/Analysis Module
 * Simple single-page layout with left settings, right results
 */

// State
let currentSessionId = null;
let currentAnswerKey = {};
let csvData = null;
let dataSource = 'session';
let lastScoreResults = null;
let lastCheatingResults = null;
let currentMode = 'score';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupSourceToggle();
    setupModeToggle();
    setupCsvUpload();
    generateAnswerGrid(parseInt(document.getElementById('question-count').value));
    loadSavedKeys();
    fetchServerSessions();
    checkUrlParams();

    // Event listeners
    document.getElementById('question-count').addEventListener('change', (e) => {
        generateAnswerGrid(parseInt(e.target.value));
    });

    document.getElementById('session-select').addEventListener('change', (e) => {
        currentSessionId = e.target.value;
        updateButtonStates();
    });

    document.getElementById('refresh-sessions-btn').addEventListener('click', () => {
        fetchServerSessions(true);
    });

    document.getElementById('calculate-btn').addEventListener('click', calculateScores);
    document.getElementById('detect-btn').addEventListener('click', detectCheating);
    document.getElementById('download-excel-btn').addEventListener('click', downloadResults);
    document.getElementById('save-key-btn').addEventListener('click', saveKey);
    document.getElementById('clear-key-btn').addEventListener('click', clearKey);
    
    document.getElementById('apply-quick-fill-btn').addEventListener('click', () => {
        applyQuickFill();
        updateButtonStates();
    });
});

function setupSourceToggle() {
    const btnSession = document.getElementById('btn-session');
    const btnCsv = document.getElementById('btn-csv');
    const sourceSession = document.getElementById('source-session');
    const sourceCsv = document.getElementById('source-csv');

    btnSession.addEventListener('click', () => {
        btnSession.classList.add('active');
        btnCsv.classList.remove('active');
        sourceSession.classList.add('active');
        sourceCsv.classList.remove('active');
        dataSource = 'session';
        updateButtonStates();
    });

    btnCsv.addEventListener('click', () => {
        btnCsv.classList.add('active');
        btnSession.classList.remove('active');
        sourceCsv.classList.add('active');
        sourceSession.classList.remove('active');
        dataSource = 'csv';
        updateButtonStates();
    });
}

function setupModeToggle() {
    const btnScore = document.getElementById('btn-mode-score');
    const btnCheating = document.getElementById('btn-mode-cheating');
    const modeScore = document.getElementById('mode-score');
    const modeCheating = document.getElementById('mode-cheating');

    btnScore.addEventListener('click', () => {
        btnScore.classList.add('active');
        btnCheating.classList.remove('active');
        modeScore.classList.add('active');
        modeCheating.classList.remove('active');
        currentMode = 'score';
        updateButtonStates();
    });

    btnCheating.addEventListener('click', () => {
        btnCheating.classList.add('active');
        btnScore.classList.remove('active');
        modeCheating.classList.add('active');
        modeScore.classList.remove('active');
        currentMode = 'cheating';
        updateButtonStates();
    });
}

function setupCsvUpload() {
    const dropzone = document.getElementById('csv-dropzone');
    const fileInput = document.getElementById('csv-file-input');
    const removeBtn = document.getElementById('remove-csv-btn');

    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--accent-primary)';
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.style.borderColor = 'var(--border-color)';
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--border-color)';
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
    questionCols.sort((a, b) => parseInt(a.match(/\d+/)[0]) - parseInt(b.match(/\d+/)[0]));

    csvData = { fileName, headers, rows, questionCols };

    document.getElementById('csv-file-name').textContent = fileName;
    document.getElementById('csv-file-stats').textContent = `${rows.length} satır, ${questionCols.length} soru`;
    document.getElementById('csv-file-loaded').classList.add('show');
    document.getElementById('csv-dropzone').style.display = 'none';

    if (questionCols.length > 0) {
        document.getElementById('question-count').value = questionCols.length;
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
    const sessionSelect = document.getElementById('session-select');
    const sessionInfo = document.getElementById('session-info');
    
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
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                });
                option.textContent = `${session.id.substring(0, 8)}... - ${date}`;
                sessionSelect.appendChild(option);
            });
            sessionInfo.textContent = `✅ ${data.sessions.length} oturum`;
            sessionInfo.style.color = 'var(--accent-success)';
        } else {
            sessionInfo.textContent = '⚠️ Oturum yok';
            sessionInfo.style.color = 'var(--accent-warning)';
        }
        
        loadRecentSessions();
    } catch (error) {
        sessionInfo.textContent = '❌ Yüklenemedi';
        sessionInfo.style.color = 'var(--accent-danger)';
    }
}

function loadRecentSessions() {
    const sessionSelect = document.getElementById('session-select');
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
        const sessionSelect = document.getElementById('session-select');
        let exists = Array.from(sessionSelect.options).some(opt => opt.value === sessionId);
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
    const answerGrid = document.getElementById('answer-grid');
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
    const input = document.getElementById('quick-fill-input').value.toUpperCase().replace(/[^A-E]/g, '');
    const selects = document.getElementById('answer-grid').querySelectorAll('select');

    currentAnswerKey = {};
    selects.forEach((select, idx) => {
        if (idx < input.length) {
            select.value = input[idx];
            currentAnswerKey[idx + 1] = input[idx];
        }
    });
    document.getElementById('quick-fill-input').value = '';
}

function updateButtonStates() {
    const hasData = (dataSource === 'csv' && csvData) || (dataSource === 'session' && currentSessionId);
    const hasAnswers = Object.keys(currentAnswerKey).length > 0;

    document.getElementById('calculate-btn').disabled = !(hasData && hasAnswers);
    document.getElementById('detect-btn').disabled = !hasData;
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

    const btn = document.getElementById('calculate-btn');
    btn.disabled = true;
    btn.textContent = 'Hesaplanıyor...';

    try {
        // Calculate scores
        const scoreResponse = await fetch(`/api/analysis/score/${currentSessionId}`, {
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

        const scoreData = await scoreResponse.json();
        
        // Also run cheating detection automatically with answer key
        const cheatingResponse = await fetch(`/api/analysis/cheating/${currentSessionId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                similarity_threshold: parseFloat(document.getElementById('similarity-threshold').value),
                pearson_threshold: parseFloat(document.getElementById('pearson-threshold').value),
                min_common_wrong: parseInt(document.getElementById('common-wrong-threshold').value),
                answer_key: currentAnswerKey  // Include answer key for better detection
            })
        });
        
        const cheatingData = await cheatingResponse.json();
        
        if (scoreData.success) {
            lastScoreResults = scoreData;
            lastCheatingResults = cheatingData;
            displayScoreResults(scoreData);
            displayAutoCheatingResults(cheatingData);
        } else {
            alert('Hata: ' + (scoreData.error || 'Bilinmeyen hata'));
        }
    } catch (error) {
        alert('Bağlantı hatası: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Puanları Hesapla';
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

        let studentId = row['Ogrenci_No'] || row['ogrenci_no'] || row['student_id'] || '';
        let tcKimlik = row['TC_Kimlik'] || row['tc_kimlik'] || '';
        let studentName = row['ad'] || row['Ad'] || row['name'] || '';
        let fileName = row['file_name'] || row['file_id'] || '';

        if (!studentId && fileName) {
            const clean = fileName.split(/[\/\\]/).pop().replace(/\.[^.]+$/, '');
            const nums = clean.match(/\d{6,}/);
            studentId = nums ? nums[0] : clean;
        }
        if (!studentId) studentId = `Satır ${idx + 1}`;

        results.push({
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

    results.sort((a, b) => b.score - a.score);

    const data = {
        success: true,
        total_students: results.length,
        total_questions: questionCols.length,
        results: results,
        statistics: {
            average_score: results.reduce((s, r) => s + r.score, 0) / results.length,
            max_score: Math.max(...results.map(r => r.score)),
            min_score: Math.min(...results.map(r => r.score))
        }
    };

    lastScoreResults = data;
    displayScoreResults(data);
    
    // Also run auto cheating detection for CSV
    runAutoCheatingFromCsv();
}

function runAutoCheatingFromCsv() {
    if (!csvData) return;

    const minCommonWrong = parseInt(document.getElementById('common-wrong-threshold').value);
    const questionCols = csvData.questionCols;

    const students = csvData.rows.map((row, idx) => {
        const answers = questionCols.map(qCol => {
            const ans = (row[qCol] || '').trim().toUpperCase();
            return (!ans || ans === '*' || ans === '-') ? '' : ans;
        });

        let studentId = row['Ogrenci_No'] || row['ogrenci_no'] || row['student_id'] || '';
        let studentName = row['ad'] || row['Ad'] || '';

        if (!studentId) {
            const fileName = row['file_name'] || row['file_id'] || '';
            if (fileName) {
                const clean = fileName.split(/[\/\\]/).pop().replace(/\.[^.]+$/, '');
                const nums = clean.match(/\d{6,}/);
                studentId = nums ? nums[0] : clean;
            }
        }
        if (!studentId) studentId = `Satır ${idx + 1}`;

        const displayId = studentName ? `${studentId} (${studentName})` : studentId;
        return { studentId: displayId, answers };
    });

    // Calculate answer frequencies for rare answer detection
    const answerFreq = calculateAnswerFrequencies(students, questionCols.length);

    const cheatingPairs = [];

    for (let i = 0; i < students.length; i++) {
        for (let j = i + 1; j < students.length; j++) {
            const s1 = students[i], s2 = students[j];
            const metrics = calculateCheatingMetrics(s1.answers, s2.answers, currentAnswerKey, answerFreq);
            const suspicionScore = calculateSuspicionScore(metrics, Object.keys(currentAnswerKey).length > 0);

            const isSuspicious = (
                suspicionScore >= 0.7 ||
                (metrics.commonWrong >= minCommonWrong && Object.keys(currentAnswerKey).length > 0) ||
                (metrics.rareMatchRatio >= 0.5 && metrics.rareMatches >= 3) ||
                (metrics.patternSimilarity >= 0.85 && metrics.blankMatchRatio >= 0.8)
            );

            if (isSuspicious) {
                const details = [];
                if (metrics.commonWrong >= 2) details.push(`Ortak yanlış: ${metrics.commonWrong}`);
                if (metrics.rareMatches >= 2) details.push(`Nadir cevap: ${metrics.rareMatches}`);
                if (metrics.patternSimilarity >= 0.8) details.push(`Desen: %${(metrics.patternSimilarity*100).toFixed(0)}`);

                cheatingPairs.push({
                    student1_id: s1.studentId,
                    student2_id: s2.studentId,
                    similarity_ratio: suspicionScore,
                    pearson_correlation: metrics.patternSimilarity,
                    common_wrong_answers: metrics.commonWrong || metrics.rareMatches,
                    details: details.join(' | ')
                });
            }
        }
    }

    cheatingPairs.sort((a, b) => b.similarity_ratio - a.similarity_ratio);

    const cheatingData = {
        success: true,
        total_students: students.length,
        total_pairs_checked: students.length * (students.length - 1) / 2,
        suspicious_pairs: cheatingPairs.length,
        results: cheatingPairs
    };

    lastCheatingResults = cheatingData;
    displayAutoCheatingResults(cheatingData);
}

function calculateAnswerFrequencies(students, numQuestions) {
    const freq = Array.from({ length: numQuestions }, () => ({}));
    const total = students.length;

    students.forEach(student => {
        student.answers.forEach((ans, i) => {
            if (i < numQuestions) {
                freq[i][ans] = (freq[i][ans] || 0) + 1;
            }
        });
    });

    // Convert to ratios
    freq.forEach(qFreq => {
        Object.keys(qFreq).forEach(ans => {
            qFreq[ans] /= total;
        });
    });

    return freq;
}

function calculateCheatingMetrics(answers1, answers2, answerKey, answerFreq) {
    const n = Math.min(answers1.length, answers2.length);
    let commonWrong = 0, rareMatches = 0, patternMatches = 0, blankMatches = 0, totalBlanks = 0;

    for (let i = 0; i < n; i++) {
        const a1 = answers1[i], a2 = answers2[i];

        // Pattern similarity
        if (a1 === a2) patternMatches++;

        // Blank matching
        if (a1 === '' || a2 === '') {
            totalBlanks++;
            if (a1 === '' && a2 === '') blankMatches++;
        }

        // Common wrong answers
        if (answerKey && a1 && a2 && a1 === a2) {
            const qNum = i + 1;
            const correct = (answerKey[qNum] || answerKey[String(qNum)] || '').toUpperCase();
            if (correct && a1 !== correct) {
                commonWrong++;
            }
        }

        // Rare answer matching
        if (a1 && a2 && a1 === a2 && i < answerFreq.length) {
            const freq = answerFreq[i][a1] || 0;
            if (freq < 0.15) rareMatches++;
        }
    }

    return {
        commonWrong,
        rareMatches,
        patternSimilarity: n > 0 ? patternMatches / n : 0,
        blankMatchRatio: totalBlanks > 0 ? blankMatches / totalBlanks : 1.0,
        rareMatchRatio: n > 0 ? rareMatches / n : 0
    };
}

function calculateSuspicionScore(metrics, hasAnswerKey) {
    let score = 0;

    if (hasAnswerKey) {
        score += Math.min(metrics.commonWrong / 10, 0.4);
        score += metrics.rareMatchRatio * 0.25;
        score += Math.max(0, (metrics.patternSimilarity - 0.6)) * 0.5;
        score += Math.max(0, (metrics.blankMatchRatio - 0.5)) * 0.3;
    } else {
        score += metrics.rareMatchRatio * 0.45;
        score += Math.max(0, (metrics.patternSimilarity - 0.7)) * 0.6;
        score += Math.max(0, (metrics.blankMatchRatio - 0.5)) * 0.4;
        score += Math.min(metrics.rareMatches / 8, 0.2);
    }

    return Math.min(score, 1.0);
}

function displayScoreResults(data) {
    document.getElementById('results-title').textContent = '📊 Puan Sonuçları';
    document.getElementById('results-empty').style.display = 'none';
    document.getElementById('results-content').style.display = 'block';
    document.getElementById('download-excel-btn').style.display = 'block';

    const stats = data.statistics;
    document.getElementById('results-stats').innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${data.total_students}</div>
            <div class="stat-label">Öğrenci</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.average_score?.toFixed(1) || 0}</div>
            <div class="stat-label">Ortalama</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.max_score?.toFixed(1) || 0}</div>
            <div class="stat-label">En Yüksek</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${stats.min_score?.toFixed(1) || 0}</div>
            <div class="stat-label">En Düşük</div>
        </div>
    `;

    document.getElementById('results-list').innerHTML = data.results.map((r, i) => {
        const details = [r.student_name, r.tc_kimlik ? `TC: ${r.tc_kimlik}` : ''].filter(Boolean).join(' • ');
        return `
            <div class="result-item">
                <div class="rank ${i < 3 ? 'top' : ''}">${i + 1}</div>
                <div class="result-info">
                    <div class="result-id">${r.student_id}</div>
                    <div class="result-detail">${details}</div>
                </div>
                <div class="result-score">
                    <div class="score-num">${r.score.toFixed(1)}</div>
                    <div class="score-breakdown">D:${r.correct_count} Y:${r.wrong_count} B:${r.empty_count}</div>
                </div>
            </div>
        `;
    }).join('');
}

function displayAutoCheatingResults(data) {
    const section = document.getElementById('auto-cheating-section');
    const badge = document.getElementById('auto-cheating-badge');
    const list = document.getElementById('auto-cheating-list');
    
    section.style.display = 'block';
    
    if (data.suspicious_pairs > 0) {
        badge.textContent = `${data.suspicious_pairs} şüpheli`;
        badge.style.background = 'rgba(239, 68, 68, 0.2)';
        badge.style.color = 'var(--accent-danger)';
        
        list.innerHTML = data.results.slice(0, 10).map(r => `
            <div class="cheat-item">
                <div class="cheat-pair">
                    <div class="cheat-student">${r.student1_id}</div>
                    <div class="cheat-vs">↔</div>
                    <div class="cheat-student">${r.student2_id}</div>
                </div>
                <div class="cheat-metrics">
                    <span class="cheat-badge ${r.similarity_ratio >= 0.85 ? 'danger' : ''}">Benzerlik: %${(r.similarity_ratio * 100).toFixed(1)}</span>
                    <span class="cheat-badge">Ortak: ${r.common_wrong_answers}</span>
                </div>
            </div>
        `).join('') + (data.results.length > 10 ? `<p style="color: var(--text-secondary); font-size: 0.875rem; margin-top: 0.5rem;">... ve ${data.results.length - 10} daha</p>` : '');
    } else {
        badge.textContent = 'Temiz ✅';
        badge.style.background = 'rgba(16, 185, 129, 0.2)';
        badge.style.color = 'var(--accent-success)';
        list.innerHTML = '<p style="color: var(--accent-success); font-size: 0.875rem;">Şüpheli kopya tespit edilmedi</p>';
    }
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

    const btn = document.getElementById('detect-btn');
    btn.disabled = true;
    btn.textContent = 'Analiz ediliyor...';

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
        btn.disabled = false;
        btn.textContent = 'Kopya Tespit Et';
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
            return (!ans || ans === '*' || ans === '-') ? '' : ans;
        });

        let studentId = row['Ogrenci_No'] || row['ogrenci_no'] || row['student_id'] || '';
        let studentName = row['ad'] || row['Ad'] || '';

        if (!studentId) {
            const fileName = row['file_name'] || row['file_id'] || '';
            if (fileName) {
                const clean = fileName.split(/[\/\\]/).pop().replace(/\.[^.]+$/, '');
                const nums = clean.match(/\d{6,}/);
                studentId = nums ? nums[0] : clean;
            }
        }
        if (!studentId) studentId = `Satır ${idx + 1}`;

        const displayId = studentName ? `${studentId} (${studentName})` : studentId;
        return { studentId: displayId, answers };
    });

    const cheatingPairs = [];

    for (let i = 0; i < students.length; i++) {
        for (let j = i + 1; j < students.length; j++) {
            const s1 = students[i], s2 = students[j];

            let similar = 0, total = Math.max(s1.answers.length, s2.answers.length);
            for (let k = 0; k < Math.min(s1.answers.length, s2.answers.length); k++) {
                if (s1.answers[k] === s2.answers[k] && s1.answers[k] !== '') similar++;
            }
            const simRatio = total > 0 ? similar / total : 0;

            const isSuspicious = (simRatio >= simThreshold && simRatio >= pearsonThreshold) || similar >= minCommonWrong;

            if (isSuspicious) {
                cheatingPairs.push({
                    student1_id: s1.studentId,
                    student2_id: s2.studentId,
                    similarity_ratio: simRatio,
                    pearson_correlation: simRatio,
                    common_wrong_answers: similar
                });
            }
        }
    }

    cheatingPairs.sort((a, b) => b.similarity_ratio - a.similarity_ratio);

    const data = {
        success: true,
        total_students: students.length,
        total_pairs_checked: students.length * (students.length - 1) / 2,
        suspicious_pairs: cheatingPairs.length,
        results: cheatingPairs
    };

    lastCheatingResults = data;
    displayCheatingResults(data);
}

function displayCheatingResults(data) {
    document.getElementById('results-title').textContent = '🔍 Kopya Tespit Sonuçları';
    document.getElementById('results-empty').style.display = 'none';
    document.getElementById('results-content').style.display = 'block';
    document.getElementById('download-excel-btn').style.display = 'block';

    document.getElementById('results-stats').innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${data.total_students}</div>
            <div class="stat-label">Öğrenci</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${data.total_pairs_checked}</div>
            <div class="stat-label">Karşılaştırma</div>
        </div>
        <div class="stat-card">
            <div class="stat-value" style="color: ${data.suspicious_pairs > 0 ? 'var(--accent-danger)' : 'var(--accent-success)'}">${data.suspicious_pairs}</div>
            <div class="stat-label">Şüpheli</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${data.suspicious_pairs > 0 ? '⚠️' : '✅'}</div>
            <div class="stat-label">Durum</div>
        </div>
    `;

    if (data.results.length === 0) {
        document.getElementById('results-list').innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--accent-success);">
                <div style="font-size: 4rem;">✅</div>
                <h3 style="margin: 1rem 0 0.5rem;">Temiz!</h3>
                <p style="color: var(--text-secondary);">Şüpheli kopya tespit edilmedi</p>
            </div>
        `;
        return;
    }

    document.getElementById('results-list').innerHTML = data.results.map(r => `
        <div class="cheat-item">
            <div class="cheat-pair">
                <div class="cheat-student">${r.student1_id}</div>
                <div class="cheat-vs">↔</div>
                <div class="cheat-student">${r.student2_id}</div>
            </div>
            <div class="cheat-metrics">
                <span class="cheat-badge ${r.similarity_ratio >= 0.85 ? 'danger' : ''}">Benzerlik: %${(r.similarity_ratio * 100).toFixed(1)}</span>
                <span class="cheat-badge ${r.pearson_correlation >= 0.90 ? 'danger' : ''}">Pearson: ${r.pearson_correlation.toFixed(3)}</span>
                <span class="cheat-badge">Ortak: ${r.common_wrong_answers}</span>
            </div>
        </div>
    `).join('');
}

async function downloadResults() {
    // CSV mode - download both scores and cheating as combined CSV
    if (dataSource === 'csv' && csvData) {
        downloadCombinedCsv();
        return;
    }

    if (!currentSessionId) return;

    // Session mode - always use score endpoint which includes both sheets
    try {
        const endpoint = `/api/analysis/score/${currentSessionId}/excel`;

        const body = {
            answer_key: currentAnswerKey,
            scoring: {
                correct_points: parseFloat(document.getElementById('correct-points').value),
                wrong_points: parseFloat(document.getElementById('wrong-points').value),
                empty_points: parseFloat(document.getElementById('empty-points').value)
            },
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
            a.download = `sonuclar_${currentSessionId.substring(0, 8)}.xlsx`;
            a.click();
            window.URL.revokeObjectURL(url);
        }
    } catch (error) {
        console.error('Download error:', error);
    }
}

function downloadCombinedCsv() {
    if (!lastScoreResults && !lastCheatingResults) return;

    let csv = '\uFEFF'; // BOM for UTF-8

    // Add scores section
    if (lastScoreResults && lastScoreResults.results.length > 0) {
        csv += '=== PUANLAR ===\n';
        csv += 'Öğrenci No;Ad Soyad;TC Kimlik;Doğru;Yanlış;Boş;Puan;Cevaplar\n';
        lastScoreResults.results.forEach(r => {
            csv += `${r.student_id};${r.student_name || ''};${r.tc_kimlik || ''};${r.correct_count};${r.wrong_count};${r.empty_count};${r.score.toString().replace('.', ',')};${r.answers || ''}\n`;
        });
        csv += '\n';
    }

    // Add cheating section
    if (lastCheatingResults && lastCheatingResults.results.length > 0) {
        csv += '=== KOPYA TESPİT ===\n';
        csv += 'Öğrenci 1;Öğrenci 2;Benzerlik;Ortak Cevap\n';
        lastCheatingResults.results.forEach(r => {
            csv += `${r.student1_id};${r.student2_id};%${(r.similarity_ratio * 100).toFixed(1).replace('.', ',')};${r.common_wrong_answers}\n`;
        });
    } else {
        csv += '=== KOPYA TESPİT ===\n';
        csv += 'Şüpheli kopya tespit edilmedi\n';
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = window.URL.createObjectURL(blob);
    a.download = `sonuclar_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
}

function downloadResultsAsCsv(results, prefix) {
    if (!results || results.length === 0) return;

    const headerMap = {
        'student_id': 'Öğrenci No',
        'student_name': 'Ad Soyad',
        'tc_kimlik': 'TC Kimlik',
        'correct_count': 'Doğru',
        'wrong_count': 'Yanlış',
        'empty_count': 'Boş',
        'score': 'Puan',
        'answers': 'Cevaplar',
        'student1_id': 'Öğrenci 1',
        'student2_id': 'Öğrenci 2',
        'similarity_ratio': 'Benzerlik',
        'pearson_correlation': 'Pearson',
        'common_wrong_answers': 'Ortak'
    };

    const keys = Object.keys(results[0]).filter(k => headerMap[k]);
    const csvHeaders = keys.map(k => headerMap[k]);

    let csv = '\uFEFF' + csvHeaders.join(';') + '\n';
    results.forEach(row => {
        const values = keys.map(k => {
            let val = row[k];
            if (typeof val === 'number') val = val.toString().replace('.', ',');
            if (typeof val === 'string' && val.includes(';')) val = `"${val}"`;
            return val || '';
        });
        csv += values.join(';') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = window.URL.createObjectURL(blob);
    a.download = `${prefix}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
}

async function saveKey() {
    const name = prompt('Anahtar adı:');
    if (!name) return;

    try {
        const response = await fetch('/api/analysis/answer-keys', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                answers: currentAnswerKey,
                question_count: parseInt(document.getElementById('question-count').value),
                correct_points: parseFloat(document.getElementById('correct-points').value),
                wrong_points: parseFloat(document.getElementById('wrong-points').value),
                empty_points: parseFloat(document.getElementById('empty-points').value)
            })
        });
        if ((await response.json()).success) loadSavedKeys();
    } catch (e) {
        alert('Kaydetme hatası');
    }
}

function clearKey() {
    currentAnswerKey = {};
    document.getElementById('answer-grid').querySelectorAll('select').forEach(s => s.value = '');
    document.getElementById('quick-fill-input').value = '';
    updateButtonStates();
}

async function loadSavedKeys() {
    try {
        const response = await fetch('/api/analysis/answer-keys');
        const data = await response.json();

        const list = document.getElementById('saved-keys-list');
        if (data.keys && data.keys.length > 0) {
            list.innerHTML = data.keys.map(key => `
                <div class="saved-key">
                    <span>${key.name} (${key.question_count})</span>
                    <div>
                        <button class="btn-sm" onclick="loadKey('${key.name}')">Yükle</button>
                        <button class="btn-sm" onclick="deleteKey('${key.name}')" style="color: var(--accent-danger);">✕</button>
                    </div>
                </div>
            `).join('');
        } else {
            list.innerHTML = '<div style="color: var(--text-secondary); font-size: 0.8125rem;">Kayıtlı anahtar yok</div>';
        }
    } catch (e) {}
}

async function loadKey(name) {
    try {
        const response = await fetch(`/api/analysis/answer-keys/${name}`);
        const data = await response.json();

        if (data) {
            document.getElementById('question-count').value = data.question_count;
            generateAnswerGrid(data.question_count);

            currentAnswerKey = data.answers;
            Object.entries(data.answers).forEach(([q, ans]) => {
                const select = document.getElementById('answer-grid').querySelector(`select[data-question="${q}"]`);
                if (select) select.value = ans;
            });

            if (data.scoring) {
                document.getElementById('correct-points').value = data.scoring.correct_points;
                document.getElementById('wrong-points').value = data.scoring.wrong_points;
                document.getElementById('empty-points').value = data.scoring.empty_points;
            }
            updateButtonStates();
        }
    } catch (e) {
        alert('Yükleme hatası');
    }
}

async function deleteKey(name) {
    if (!confirm(`"${name}" silinsin mi?`)) return;
    try {
        await fetch(`/api/analysis/answer-keys/${name}`, { method: 'DELETE' });
        loadSavedKeys();
    } catch (e) {}
}
