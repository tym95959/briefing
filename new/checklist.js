// checklist.js – Task checklist with pattern lock authentication

import { MAIN_DAILY_TASKS, FB_DAILY_TASKS, getTasksByCategory } from './task.js';

// ---- State ----
let currentUser = null;
let currentCategory = 'main';
let shiftKey = `shift_${new Date().toISOString().slice(0,10)}`;
let users = [];

// ---- DOM ----
const root = document.getElementById('root');

// ---- Helpers ----
function showNotification(msg, type = 'success') {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    const div = document.createElement('div');
    div.className = `notification ${type}`;
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}

// ---- Render main UI ----
function render() {
    const userDisplay = currentUser ? currentUser.displayName : 'Not signed in';
    root.innerHTML = `
        <div class="checklist-header">
            <h1>📋 Daily Checklist</h1>
            <div>
                <span class="user-badge">👤 <strong>${userDisplay}</strong></span>
                <button class="back-btn" id="switchUserBtn">⟳ Switch User</button>
                <a href="dashboard.html" class="back-btn">← Back</a>
            </div>
        </div>
        <div class="category-tabs">
            <button class="category-tab ${currentCategory === 'main' ? 'active' : ''}" data-cat="main">
                Main Tasks <span class="badge">${MAIN_DAILY_TASKS.length}</span>
            </button>
            <button class="category-tab ${currentCategory === 'fb' ? 'active' : ''}" data-cat="fb">
                Food & Beverage <span class="badge">${FB_DAILY_TASKS.length}</span>
            </button>
        </div>
        <div id="taskListContainer">
            ${currentUser ? '<div class="loading-state"><div class="spinner-small"></div>Loading tasks…</div>' :
                           '<div class="empty-state">Please sign in to view tasks.</div>'}
        </div>
    `;

    document.getElementById('switchUserBtn').addEventListener('click', () => showAuthModal());
    document.querySelectorAll('.category-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            currentCategory = btn.dataset.cat;
            render();
            if (currentUser) loadTasks();
        });
    });

    if (currentUser) loadTasks();
    else showAuthModal();
}

// ---- Pattern lock inside modal ----
function setupPatternLock(containerId, onComplete) {
    const grid = document.getElementById(containerId);
    if (!grid) return;
    const svg = grid.parentElement.querySelector('.modal-pattern-svg');
    const status = grid.parentElement.querySelector('.modal-pattern-status');
    const clearBtn = grid.parentElement.querySelector('.modal-clear-pattern');

    const DOT_COUNT = 9;
    const dotPositions = [
        { x: 0.1667, y: 0.1667 }, { x: 0.5, y: 0.1667 }, { x: 0.8333, y: 0.1667 },
        { x: 0.1667, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.8333, y: 0.5 },
        { x: 0.1667, y: 0.8333 }, { x: 0.5, y: 0.8333 }, { x: 0.8333, y: 0.8333 }
    ];
    let dots = [];
    let selected = [];
    let isDrawing = false;

    function build() {
        grid.innerHTML = '';
        dots = [];
        const container = grid.parentElement;
        const size = container.offsetWidth || 220;
        for (let i = 0; i < DOT_COUNT; i++) {
            const dot = document.createElement('div');
            dot.className = 'modal-pattern-dot';
            dot.dataset.index = i;
            const pos = dotPositions[i];
            dot.style.left = (pos.x * 100) + '%';
            dot.style.top = (pos.y * 100) + '%';
            dot.style.width = Math.max(32, size * 0.18) + 'px';
            dot.style.height = Math.max(32, size * 0.18) + 'px';
            dot.innerHTML = `<span class="dot-number">${i+1}</span>`;
            grid.appendChild(dot);
            dots.push(dot);

            dot.addEventListener('mousedown', (e) => onDown(e, i));
            dot.addEventListener('mouseenter', (e) => onEnter(e, i));
            dot.addEventListener('touchstart', (e) => { e.preventDefault(); onDown(e, i); }, { passive: false });
            dot.addEventListener('touchmove', (e) => { e.preventDefault(); onMove(e, i); }, { passive: false });
            dot.addEventListener('touchend', (e) => { e.preventDefault(); onUp(e, i); }, { passive: false });
        }
        document.addEventListener('mouseup', onGlobalUp);
        document.addEventListener('mousemove', onGlobalMove);
        document.addEventListener('touchend', onGlobalUp);
        document.addEventListener('touchmove', onGlobalMove, { passive: false });
        updateSvg();
    }

    function onDown(e, idx) { if (selected.includes(idx)) return; isDrawing = true; select(idx); updateStatus('active', 'Drawing…'); }
    function onEnter(e, idx) { if (!isDrawing || selected.includes(idx)) return; select(idx); }
    function onUp(e, idx) {}
    function onMove(e, idx) {}

    function onGlobalUp() {
        if (isDrawing) {
            isDrawing = false;
            if (selected.length >= 4) {
                updateStatus('success', `✓ Pattern: ${selected.map(i=>i+1).join(' → ')}`);
                if (onComplete) onComplete(selected.map(i=>i+1).join(''));
            } else {
                updateStatus('error', '❌ Need at least 4 dots');
                setTimeout(() => { if (!isDrawing) reset(false); }, 500);
            }
            updateSvg();
        }
    }

    function onGlobalMove(e) {
        if (!isDrawing) return;
        let cx, cy;
        if (e.touches) { cx = e.touches[0].clientX; cy = e.touches[0].clientY; }
        else { cx = e.clientX; cy = e.clientY; }
        const rect = grid.parentElement.getBoundingClientRect();
        const x = (cx - rect.left) / rect.width;
        const y = (cy - rect.top) / rect.height;
        let nearest = -1, minDist = 0.12;
        for (let i = 0; i < DOT_COUNT; i++) {
            if (selected.includes(i)) continue;
            const pos = dotPositions[i];
            const dx = x - pos.x, dy = y - pos.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < minDist) { minDist = dist; nearest = i; }
        }
        if (nearest >= 0) select(nearest);
    }

    function select(idx) {
        if (selected.includes(idx)) return;
        selected.push(idx);
        const dot = dots[idx];
        dot.classList.add('selected');
        dot.style.transform = 'translate(-50%,-50%) scale(1.2)';
        setTimeout(() => dot.style.transform = 'translate(-50%,-50%) scale(1.08)', 100);
        updateSvg();
        updateStatus('active', `Pattern: ${selected.map(i=>i+1).join(' → ')}`);
    }

    function reset(keepStatus = false) {
        selected.forEach(i => {
            const dot = dots[i];
            if (dot) { dot.classList.remove('selected', 'error'); dot.style.transform = ''; }
        });
        selected = [];
        if (!keepStatus) updateStatus('idle', 'Connect at least 4 dots');
        updateSvg();
    }

    function updateStatus(type, msg) {
        if (!status) return;
        status.textContent = msg;
        status.className = 'modal-pattern-status';
        if (type === 'active') status.classList.add('active-status');
        else if (type === 'error') status.classList.add('error-status');
        else if (type === 'success') status.classList.add('success-status');
    }

    function updateSvg() {
        if (!svg) return;
        const size = grid.parentElement.offsetWidth || 220;
        let content = '';
        for (let i = 0; i < selected.length - 1; i++) {
            const from = dotPositions[selected[i]];
            const to = dotPositions[selected[i+1]];
            content += `<line x1="${from.x*size}" y1="${from.y*size}" x2="${to.x*size}" y2="${to.y*size}" />`;
        }
        svg.innerHTML = content;
    }

    if (clearBtn) clearBtn.addEventListener('click', () => reset(false));

    build();
    return { reset, getPattern: () => selected.map(i=>i+1).join('') };
}

// ---- Auth modal with pattern ----
function showAuthModal() {
    if (!users.length) {
        fetchUsers().then(() => showAuthModal());
        return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'userModal';

    const options = users.map(u => `<option value="${u.email}">${u.displayName || u.email}</option>`).join('');

    overlay.innerHTML = `
        <div class="modal-box">
            <h2>🔐 Sign in with Line Code</h2>
            <p>Select your account and draw your pattern.</p>
            <div class="form-group">
                <label for="userSelect">User</label>
                <select id="userSelect">
                    <option value="">— Choose —</option>
                    ${options}
                </select>
            </div>
            <div class="modal-pattern-wrapper">
                <div class="modal-pattern-container">
                    <div class="modal-pattern-grid" id="modalPatternGrid"></div>
                    <svg class="modal-pattern-svg" id="modalPatternSvg"></svg>
                </div>
                <div class="modal-pattern-status" id="modalPatternStatus">Connect at least 4 dots</div>
                <button type="button" class="modal-clear-pattern" id="modalClearPattern">✕ clear</button>
            </div>
            <div id="authError" class="error-msg" style="display:none;">Incorrect pattern. Please try again.</div>
            <div class="modal-actions">
                <button class="btn-secondary" id="modalCancel">Cancel</button>
                <button class="btn-primary" id="modalSignin">Sign In</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const userSelect = document.getElementById('userSelect');
    const errorMsg = document.getElementById('authError');
    const signinBtn = document.getElementById('modalSignin');
    const cancelBtn = document.getElementById('modalCancel');

    // Setup pattern lock
    let patternLock = null;
    setTimeout(() => {
        patternLock = setupPatternLock('modalPatternGrid', (pattern) => {
            // Auto-trigger signin when pattern is drawn
            attemptSignin(pattern);
        });
    }, 50);

    // ---- Signin function ----
    async function attemptSignin(drawnPattern) {
        const email = userSelect.value;
        if (!email) {
            errorMsg.style.display = 'block';
            errorMsg.textContent = 'Please select a user.';
            return;
        }
        if (!drawnPattern || drawnPattern.length < 4) {
            errorMsg.style.display = 'block';
            errorMsg.textContent = 'Please draw a pattern with at least 4 dots.';
            return;
        }

        const user = users.find(u => u.email === email);
        if (!user) {
            errorMsg.style.display = 'block';
            errorMsg.textContent = 'User not found.';
            return;
        }

        const storedCode = user.lineCode || user.password || '';
        if (drawnPattern === storedCode) {
            currentUser = user;
            localStorage.setItem('checklist_user', JSON.stringify({ email: user.email }));
            errorMsg.style.display = 'none';
            overlay.remove();
            render();
            showNotification(`Welcome, ${user.displayName || user.email}!`);
        } else {
            errorMsg.style.display = 'block';
            errorMsg.textContent = '❌ Incorrect pattern. Please try again.';
            if (patternLock) patternLock.reset(false);
            // Clear the pattern
        }
    }

    // ---- Event listeners ----
    signinBtn.addEventListener('click', () => {
        const pattern = patternLock ? patternLock.getPattern() : '';
        attemptSignin(pattern);
    });

    cancelBtn.addEventListener('click', () => {
        overlay.remove();
        if (!currentUser) {
            const container = document.getElementById('taskListContainer');
            if (container) container.innerHTML = `<div class="empty-state">Please sign in to start.</div>`;
        }
    });

    // If user already selected, focus pattern
    if (currentUser) {
        userSelect.value = currentUser.email;
    }
}

// ---- Fetch users from Firestore ----
async function fetchUsers() {
    try {
        const snapshot = await db.collection('users').get();
        users = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            users.push({
                email: doc.id,
                displayName: data.displayName || data.username || doc.id,
                lineCode: data.lineCode || '',
                password: data.password || ''
            });
        });
        users.sort((a, b) => a.displayName.localeCompare(b.displayName));
    } catch (err) {
        console.error('Failed to fetch users:', err);
        showNotification('Could not load users. Please refresh.', 'error');
    }
}

// ---- Load tasks from Firestore (unchanged) ----
async function loadTasks() {
    const container = document.getElementById('taskListContainer');
    if (!container) return;
    if (!currentUser) {
        container.innerHTML = `<div class="empty-state">Please sign in first.</div>`;
        return;
    }

    try {
        const docRef = db.collection('checklists').doc(shiftKey);
        const docSnap = await docRef.get();
        let savedData = {};
        if (docSnap.exists) savedData = docSnap.data();

        const categoryTasks = getTasksByCategory(currentCategory);
        const mergedTasks = categoryTasks.map(task => {
            const saved = savedData[task.id];
            return saved ? { ...task, ...saved } : { ...task };
        });

        renderTasks(mergedTasks, savedData, docRef);

    } catch (err) {
        console.error('Error loading tasks:', err);
        container.innerHTML = `<div class="empty-state">⚠️ Failed to load tasks: ${err.message}</div>`;
    }
}

// ---- Render task cards (unchanged) ----
function renderTasks(tasks, savedData, docRef) {
    const container = document.getElementById('taskListContainer');
    if (!container) return;

    if (!tasks.length) {
        container.innerHTML = `<div class="empty-state">No tasks in this category.</div>`;
        return;
    }

    let html = '<div class="task-list">';
    tasks.forEach(task => {
        const isCompleted = task.type === 'complete' ? task.completedBy !== null : (task.signoffs && task.signoffs.length > 0);
        const completedClass = isCompleted ? 'completed' : '';
        const statusIcon = isCompleted ? '✓' : '○';

        let actionHtml = '';
        if (task.type === 'complete') {
            if (task.completedBy) {
                actionHtml = `<button class="done" disabled>✅ Done by ${task.completedBy}</button>`;
            } else {
                actionHtml = `<button class="complete-btn" data-id="${task.id}">✔ Complete</button>`;
            }
        } else if (task.type === 'signoff') {
            const signed = task.signoffs && task.signoffs.includes(currentUser.displayName);
            if (signed) {
                actionHtml = `<button class="done" disabled>✅ Signed</button>`;
            } else {
                actionHtml = `<button class="signoff-btn" data-id="${task.id}">✍ Sign Off</button>`;
            }
        }

        let signoffsHtml = '';
        if (task.type === 'signoff' && task.signoffs && task.signoffs.length) {
            signoffsHtml = `<div class="task-signoffs">${task.signoffs.map(name => 
                `<span class="signoff-badge ${name === currentUser.displayName ? 'you' : ''}">${name}</span>`
            ).join('')}</div>`;
        }

        let metaHtml = '';
        if (task.type === 'complete' && task.completedAt) {
            metaHtml = `<div class="task-meta">Completed at ${task.completedAt}</div>`;
        }

        html += `
            <div class="task-card ${completedClass}" data-id="${task.id}">
                <div class="task-status-icon">${statusIcon}</div>
                <div class="task-info">
                    <div class="task-text">
                        ${task.task}
                        <span class="task-type">${task.type}</span>
                    </div>
                    ${signoffsHtml}
                    ${metaHtml}
                </div>
                <div class="task-action">${actionHtml}</div>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;

    container.querySelectorAll('.complete-btn').forEach(btn => {
        btn.addEventListener('click', () => handleComplete(btn.dataset.id, docRef));
    });
    container.querySelectorAll('.signoff-btn').forEach(btn => {
        btn.addEventListener('click', () => handleSignoff(btn.dataset.id, docRef));
    });
}

// ---- Handle Complete ----
async function handleComplete(taskId, docRef) {
    const task = getTasksByCategory(currentCategory).find(t => t.id === taskId);
    if (!task) return;

    const updateData = {
        [taskId]: {
            ...task,
            completedBy: currentUser.displayName,
            completedAt: new Date().toLocaleString(),
        }
    };

    try {
        await docRef.set(updateData, { merge: true });
        showNotification(`✅ Task completed by ${currentUser.displayName}`);
        loadTasks();
    } catch (err) {
        showNotification('Error saving: ' + err.message, 'error');
    }
}

// ---- Handle Signoff ----
async function handleSignoff(taskId, docRef) {
    const task = getTasksByCategory(currentCategory).find(t => t.id === taskId);
    if (!task) return;

    const docSnap = await docRef.get();
    let saved = {};
    if (docSnap.exists) saved = docSnap.data();

    const currentSignoffs = saved[taskId]?.signoffs || [];
    if (currentSignoffs.includes(currentUser.displayName)) {
        showNotification('You already signed off on this.', 'error');
        return;
    }

    const newSignoffs = [...currentSignoffs, currentUser.displayName];
    const updateData = {
        [taskId]: {
            ...task,
            signoffs: newSignoffs,
        }
    };

    try {
        await docRef.set(updateData, { merge: true });
        showNotification(`✍ ${currentUser.displayName} signed off`);
        loadTasks();
    } catch (err) {
        showNotification('Error saving: ' + err.message, 'error');
    }
}

// ---- Init ----
async function init() {
    await fetchUsers();

    const stored = localStorage.getItem('checklist_user');
    if (stored) {
        try {
            const { email } = JSON.parse(stored);
            const user = users.find(u => u.email === email);
            if (user) {
                currentUser = user;
                render();
                return;
            }
        } catch (e) {}
    }

    render(); // will show modal if no user
}

init();