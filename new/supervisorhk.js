// supervisor.js – Full Supervisor Dashboard
// Features: Task code & description in box, area definitions as separate boxes,
// multiple area assignments, print checklist, leave/break management.

import { MAIN_DAILY_TASKS, FB_DAILY_TASKS, getTasksByCategory } from './task.js';
import { REASON_OPTIONS, getReasonsForType } from './leaveReasons.js';

// ---- Area definitions (A–G) with descriptions ----
const AREA_DEFS = [
  { id: 'A', label: 'ENTRANCE & RECEPTION, DRINKS CHILLER - INSIDE, BUFFET FLOOR AND RACKS, PANTRY BINS  & FLOOR BINS, MOTHER'S ROOM, ACCESSIBLE TOILET, RE-STOCK BUFFET TISSUE' },
  { id: 'B', label: 'L1 & L2 FLOOR / WALLS / FRAMES, L1 & L2 SEATS / GLASS / RACKS, KIDS ROOM & OUTSIDE, QUITE ROOM' },
  { id: 'C', label: 'R1 & R2 FLOOR / WALLS / FRAMES, R1 & R2 SEATS / GLASS / RACKS, BUSINESS ROOM, DRINKS CHILLER - OUTSIDE' },
  { id: 'D', label: 'GENTS TOILETS , GENTS SHOWER ' },
  { id: 'E', label: 'LADIES TOILETS , LADIES SHOWER' },
  { id: 'F', label: 'STORE CLEANING & ARRANGING, MACHINERY AND EQUIPMENT CLEANING, TOWELS DELIVERY / COLLECTION, WATER FEATURE CLEANING, BACK OFFICE CLEANING' },
  { id: 'G', label: 'DEEP-CLEANING ( EVERY OTHER NIGHT ), PANTRY FOOR DRAIN ' }
];
const AREAS = AREA_DEFS.map(a => a.id);
const AREA_LABELS = Object.fromEntries(AREA_DEFS.map(a => [a.id, a.label]));
const SHARED_AREAS = []; // no shared restrictions – all can be multi-assigned

const SHIFTS = ['Morning', 'Evening'];
const PERIODS = {
  Morning: ['07:30-10:30', '10:30-13:30', '13:30-15:30'],
  Evening: ['15:30-18:30', '18:30-21:00', '21:00-23:30']
};
const LEAVE_TYPES = ['FRL', 'SL', 'Absent'];
const STAFF_DUTY = ['Morning', 'Evening', 'Night'];

// ---- State ----
let currentUser = null;
let currentCategory = 'main';
let currentTab = 'tasks';
let selectedDate = new Date().toISOString().slice(0, 10);
let selectedShift = 'Morning';
let users = [];
let dutyData = {};
let areaData = {};
let leaveEntries = [];
let breakRequests = [];
let currentShiftSettings = { date: selectedDate, shift: 'Morning' };
let hasUnsavedDuty = false;
let hasUnsavedAreas = false;
let isFetchingUsers = false;
let userFetchError = null;
let isLoadingAllocation = false;
let isLoadingLeaves = false;

const root = document.getElementById('root');

// ================== HELPERS ==================
function showNotification(msg, type = 'success') {
  const existing = document.querySelector('.notification');
  if (existing) existing.remove();
  const div = document.createElement('div');
  div.className = `notification ${type}`;
  div.textContent = msg;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}

function getAvatar(name) {
  if (!name) return '👤';
  const emojis = ['😊', '😎', '🤩', '👨‍💼', '👩‍💼', '🧑‍💼', '👨‍⚕️', '👩‍⚕️', '👨‍🍳', '👩‍🍳'];
  const index = name.charCodeAt(0) % emojis.length;
  return emojis[index] || '👤';
}

function getPeriodsForShift(shift) {
  return PERIODS[shift] || [];
}

// ---- All on‑duty staff are available; no exclusivity ----
function getAvailableStaffForArea(shift, period, area, assignedStaff) {
  const staffUsers = users.filter(u => u.role !== 'supervisor' && u.role !== 'admin' && u.role !== 'manager');
  const onDutyStaff = staffUsers.filter(u => (dutyData[shift]?.[u.displayName] || false) === true);
  return onDutyStaff;
}

// ================== RENDER ==================
function render() {
  const userDisplay = currentUser ? currentUser.displayName : 'Not signed in';
  const totalTasks = MAIN_DAILY_TASKS.length + FB_DAILY_TASKS.length;
  const pendingBreakCount = breakRequests.filter(r => r.status === 'pending').length;

  root.innerHTML = `
    <div class="checklist-header">
      <h1>🛠️ Supervisor Dashboard</h1>
      <div>
        <span class="user-badge">👤 <strong>${userDisplay}</strong></span>
        <button class="back-btn" id="switchUserBtn">⟳ Switch User</button>
        <a href="staff-dashboard.html" class="back-btn staff-view-btn">👥 Staff View</a>
        <a href="signup.html" class="back-btn signup-btn">📝 Sign Up</a>
        <a href="dashboard.html" class="back-btn">← Back</a>
      </div>
    </div>
    <div class="supervisor-tabs">
      <button class="supervisor-tab ${currentTab === 'tasks' ? 'active' : ''}" data-tab="tasks">
        📋 Tasks <span class="badge">${totalTasks}</span>
      </button>
      <button class="supervisor-tab ${currentTab === 'allocation' ? 'active' : ''}" data-tab="allocation">
        👥 Allocation <span class="badge">${users.length}</span>
      </button>
      <button class="supervisor-tab ${currentTab === 'leaves' ? 'active' : ''}" data-tab="leaves">
        📝 Leave Report <span class="badge">${leaveEntries.length}</span>
      </button>
      <button class="supervisor-tab ${currentTab === 'break' ? 'active' : ''}" data-tab="break">
        ☕ Break Requests <span class="badge">${pendingBreakCount}</span>
      </button>
      <button class="supervisor-tab ${currentTab === 'shift' ? 'active' : ''}" data-tab="shift">
        📅 Set Shift
      </button>
    </div>
    <div id="tabContent">
      ${currentTab === 'tasks' ? renderTasksTab() :
        currentTab === 'allocation' ? renderAllocationTab() :
        currentTab === 'leaves' ? renderLeaveTab() :
        currentTab === 'break' ? renderBreakTab() :
        renderShiftTab()}
    </div>
  `;

  document.getElementById('switchUserBtn').addEventListener('click', () => showAuthModal());

  document.querySelectorAll('.supervisor-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.tab;
      render();
      if (currentTab === 'tasks' && currentUser) loadTasks();
      else if (currentTab === 'allocation') loadAllocationData();
      else if (currentTab === 'leaves') loadLeaveData();
      else if (currentTab === 'break') loadBreakRequests();
      else if (currentTab === 'shift') loadShiftSettings();
    });
  });

  if (currentTab === 'tasks' && currentUser) loadTasks();
  else if (currentTab === 'allocation') loadAllocationData();
  else if (currentTab === 'leaves') loadLeaveData();
  else if (currentTab === 'break') loadBreakRequests();
  else if (currentTab === 'shift') loadShiftSettings();

  if (currentTab === 'tasks') {
    attachPrintChecklistEvent();
  }

  if (!currentUser) showAuthModal();
}

function attachPrintChecklistEvent() {
  const printBtn = document.getElementById('printChecklistBtn');
  if (printBtn) {
    const newBtn = printBtn.cloneNode(true);
    printBtn.parentNode.replaceChild(newBtn, printBtn);
    newBtn.addEventListener('click', printChecklistReport);
  }
}

// ================== TASKS TAB ==================
function renderTasksTab() {
  return `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:1rem;">
      <div class="category-tabs">
        <button class="category-tab ${currentCategory === 'main' ? 'active' : ''}" data-cat="main">
          Main Tasks <span class="badge">${MAIN_DAILY_TASKS.length}</span>
        </button>
        <button class="category-tab ${currentCategory === 'fb' ? 'active' : ''}" data-cat="fb">
          Food & Beverage <span class="badge">${FB_DAILY_TASKS.length}</span>
        </button>
      </div>
      <div style="display:flex; gap:0.5rem; align-items:center;">
        <span style="font-size:0.85rem; color:rgba(0,0,0,0.6);">📅 ${selectedDate} · 🕒 ${selectedShift}</span>
        <button class="btn-load" id="refreshTasksBtn">🔄 Refresh</button>
        <button class="btn-print" id="printChecklistBtn">🖨️ Print Checklist</button>
      </div>
    </div>
    <div id="taskListContainer">
      ${currentUser ? '<div class="loading-state"><div class="spinner-small"></div>Loading tasks…</div>' :
                     '<div class="empty-state">Please sign in to view tasks.</div>'}
    </div>
  `;
}

async function loadTasks() {
  const container = document.getElementById('taskListContainer');
  if (!container) return;
  if (!currentUser) {
    container.innerHTML = `<div class="empty-state">Please sign in first.</div>`;
    return;
  }
  
  selectedDate = currentShiftSettings.date || selectedDate;
  selectedShift = currentShiftSettings.shift || selectedShift;
  
  try {
    const docRef = db.collection('checklists').doc(`shift_${selectedDate}`);
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
    let actionsHtml = '';
    if (task.type === 'complete') {
      if (task.completedBy) {
        actionsHtml += `<button class="btn-reset" data-id="${task.id}" data-action="reset">↺ Reset</button>`;
      } else {
        actionsHtml += `<button class="btn-complete" data-id="${task.id}" data-action="complete">✔ Complete</button>`;
      }
    } else if (task.type === 'signoff') {
      const signed = task.signoffs && task.signoffs.includes(currentUser.displayName);
      if (signed) {
        actionsHtml += `<button class="btn-done" disabled>✅ Signed</button>`;
      } else {
        actionsHtml += `<button class="btn-signoff" data-id="${task.id}" data-action="signoff">✍ Sign Off</button>`;
      }
    }
    let signoffsHtml = '';
    if (task.type === 'signoff' && task.signoffs && task.signoffs.length) {
      signoffsHtml = `<div class="task-signoffs">`;
      task.signoffs.forEach(name => {
        const isYou = name === currentUser.displayName;
        signoffsHtml += `
          <span class="signoff-badge ${isYou ? 'you' : ''}">
            ${name}
            <button class="remove-signoff" data-id="${task.id}" data-name="${name}" title="Remove signoff">×</button>
          </span>
        `;
      });
      signoffsHtml += `</div>`;
    }
    let metaHtml = '';
    if (task.type === 'complete' && task.completedAt) {
      metaHtml = `<div class="task-meta">Completed by ${task.completedBy} at ${task.completedAt}</div>`;
    }

    // --- Task card with code and description in a box ---
    html += `
      <div class="task-card ${completedClass}" data-id="${task.id}">
        <div class="task-status-icon">${statusIcon}</div>
        <div class="task-info">
          <div class="task-text">
            <span class="task-code" style="font-weight:600; color:#4f46e5; background:#eef2ff; padding:0.1rem 0.5rem; border-radius:4px; font-size:0.7rem; margin-right:0.5rem;">#${task.id}</span>
            <span class="task-description">${task.task}</span>
            <span class="task-type">${task.type}</span>
          </div>
          ${signoffsHtml}
          ${metaHtml}
        </div>
        <div class="task-actions">${actionsHtml}</div>
      </div>
    `;
  });
  html += '</div>';
  container.innerHTML = html;

  container.querySelectorAll('[data-action="complete"], [data-action="reset"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === 'complete') handleComplete(id, docRef);
      else if (action === 'reset') handleReset(id, docRef);
    });
  });
  container.querySelectorAll('[data-action="signoff"]').forEach(btn => {
    btn.addEventListener('click', () => handleSignoff(btn.dataset.id, docRef));
  });
  container.querySelectorAll('.remove-signoff').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleRemoveSignoff(btn.dataset.id, btn.dataset.name, docRef);
    });
  });
  document.querySelectorAll('.category-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      currentCategory = btn.dataset.cat;
      render();
      loadTasks();
    });
  });
  
  const refreshBtn = document.getElementById('refreshTasksBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadTasks);
  }
}

// ================== TASK ACTION HANDLERS ==================
async function handleComplete(taskId, docRef) {
  const task = getTasksByCategory(currentCategory).find(t => t.id === taskId);
  if (!task) return;
  const updateData = { [taskId]: { ...task, completedBy: currentUser.displayName, completedAt: new Date().toLocaleString() } };
  try {
    await docRef.set(updateData, { merge: true });
    showNotification(`✅ Task completed by ${currentUser.displayName}`);
    loadTasks();
  } catch (err) { showNotification('Error saving: ' + err.message, 'error'); }
}

async function handleReset(taskId, docRef) {
  const task = getTasksByCategory(currentCategory).find(t => t.id === taskId);
  if (!task) return;
  if (!confirm(`Reset task "${task.task}"?`)) return;
  const updateData = { [taskId]: { ...task, completedBy: null, completedAt: null } };
  try {
    await docRef.set(updateData, { merge: true });
    showNotification(`↺ Task reset by supervisor`);
    loadTasks();
  } catch (err) { showNotification('Error resetting: ' + err.message, 'error'); }
}

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
  const updateData = { [taskId]: { ...task, signoffs: newSignoffs } };
  try {
    await docRef.set(updateData, { merge: true });
    showNotification(`✍ ${currentUser.displayName} signed off`);
    loadTasks();
  } catch (err) { showNotification('Error saving: ' + err.message, 'error'); }
}

async function handleRemoveSignoff(taskId, staffName, docRef) {
  if (!confirm(`Remove signoff for "${staffName}"?`)) return;
  const task = getTasksByCategory(currentCategory).find(t => t.id === taskId);
  if (!task) return;
  const docSnap = await docRef.get();
  let saved = {};
  if (docSnap.exists) saved = docSnap.data();
  const currentSignoffs = saved[taskId]?.signoffs || [];
  const newSignoffs = currentSignoffs.filter(name => name !== staffName);
  const updateData = { [taskId]: { ...task, signoffs: newSignoffs } };
  try {
    await docRef.set(updateData, { merge: true });
    showNotification(`🗑️ Removed signoff for ${staffName}`);
    loadTasks();
  } catch (err) { showNotification('Error removing signoff: ' + err.message, 'error'); }
}

// ================== PRINT CHECKLIST REPORT ==================
async function printChecklistReport() {
  if (!currentUser) {
    showNotification('Please sign in first.', 'error');
    return;
  }

  try {
    const printDate = currentShiftSettings.date || selectedDate;

    const docRef = db.collection('checklists').doc(`shift_${printDate}`);
    const docSnap = await docRef.get();
    const savedData = docSnap.exists ? docSnap.data() : {};

    const allTasks = [...MAIN_DAILY_TASKS, ...FB_DAILY_TASKS];
    const mergedTasks = allTasks.map(task => {
      const saved = savedData[task.id];
      return saved ? { ...task, ...saved } : { ...task };
    });

    mergedTasks.sort((a, b) => {
      const aDone = a.type === 'complete' ? a.completedBy !== null : (a.signoffs && a.signoffs.length > 0);
      const bDone = b.type === 'complete' ? b.completedBy !== null : (b.signoffs && b.signoffs.length > 0);
      return aDone - bDone;
    });

    const rows = mergedTasks.map(task => {
      const isDone = task.type === 'complete' ? task.completedBy !== null : (task.signoffs && task.signoffs.length > 0);
      let details = '';
      if (isDone) {
        if (task.type === 'complete' && task.completedBy) {
          details = `Completed by ${task.completedBy}`;
        } else if (task.type === 'signoff' && task.signoffs && task.signoffs.length) {
          details = `Signed by: ${task.signoffs.join(', ')}`;
        } else {
          details = 'Done';
        }
      } else {
        details = 'Pending';
      }
      return `
        <tr>
          <td>${task.task}</td>
          <td>${details}</td>
        </tr>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Daily Checklist Report - ${printDate}</title>
        <style>
          * { box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 0.5in; }
          h1 { font-size: 1.8rem; margin-bottom: 0.2rem; }
          .sub { color: #555; margin-bottom: 1.5rem; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ccc; padding: 8px 10px; text-align: left; vertical-align: top; }
          th { background: #f0f0f0; font-weight: 600; }
          .status-done { color: #16a34a; }
          .status-pending { color: #dc2626; }
          @media print { body { padding: 0.3in; } }
        </style>
      </head>
      <body>
        <h1>📋 Daily Checklist Report</h1>
        <div class="sub">Date: ${printDate} · Shift: ${selectedShift}</div>
        <table>
          <thead>
            <tr><th>Task</th><th>Details</th></tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
        <p style="margin-top:1.5rem;font-size:0.85rem;color:#888;">
          Printed on ${new Date().toLocaleString()}
        </p>
      </body>
      </html>
    `;

    const win = window.open('', '_blank');
    if (!win) {
      showNotification('Please allow pop-ups for this site.', 'error');
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();

  } catch (err) {
    console.error('Error printing checklist:', err);
    showNotification('Failed to print checklist.', 'error');
  }
}

// ================== ALLOCATION TAB ==================
function renderAllocationTab() {
  if (isFetchingUsers) {
    return `<div class="loading-state"><div class="spinner-small"></div>Loading staff list…</div>`;
  }
  if (userFetchError) {
    return `
      <div class="empty-state" style="color:#dc2626; padding: 2rem;">
        <p style="font-size:1.1rem; margin-bottom:0.5rem;">⚠️ Unable to load staff data</p>
        <p style="font-size:0.85rem; color:rgba(0,0,0,0.4); margin-bottom:1rem;">
          ${userFetchError.message || 'Network error. Please check your connection.'}
          <br><small>Try disabling QUIC in chrome://flags/#enable-quic</small>
        </p>
        <button class="btn-load" id="retryFetchUsersBtn">🔄 Retry</button>
      </div>
    `;
  }
  if (!users.length) {
    return `<div class="empty-state">No users found. Please ensure Firestore has user data.</div>`;
  }
  if (isLoadingAllocation) {
    return `<div class="loading-state"><div class="spinner-small"></div>Loading allocation data…</div>`;
  }

  const staffUsers = users.filter(u => u.role !== 'supervisor' && u.role !== 'admin' && u.role !== 'manager');
  const periods = getPeriodsForShift(selectedShift);
  const currentDuty = dutyData[selectedShift] || {};
  const onDutyCount = Object.values(currentDuty).filter(v => v === true).length;
  const currentAreas = areaData[selectedShift] || {};

  // --- Area definitions as separate boxes ---
  const areaBoxesHtml = AREA_DEFS.map(def => `
    <div style="
      border:1px solid #d1d5db;
      border-radius:8px;
      padding:0.5rem 0.75rem;
      background:#f8fafc;
      min-width:200px;
      flex:1 0 auto;
      max-width:300px;
      box-shadow:0 1px 2px rgba(0,0,0,0.05);
    ">
      <strong style="color:#1e293b; font-size:1rem;">${def.id}</strong>
      <span style="color:#475569; font-size:0.85rem; display:block; margin-top:0.1rem;">${def.label}</span>
    </div>
  `).join('');

  return `
    <div class="allocation-date-section">
      <div class="date-shift-display">
        <span class="label">📅 Date: <strong>${selectedDate}</strong></span>
        <span class="label">🕒 Shift: <strong>${selectedShift}</strong></span>
        <button class="btn-load" id="refreshAllocationBtn" style="margin-left:1rem;">🔄 Refresh</button>
        <button class="btn-load" id="syncShiftBtn" style="background:#34d399;color:#fff;margin-left:0.5rem;">📌 Sync with Shift</button>
      </div>
      <div class="shift-indicators">
        <span class="shift-badge ${selectedShift === 'Morning' ? 'morning' : 'evening'}">
          ${selectedShift === 'Morning' ? '🌅' : '🌙'} ${selectedShift}
        </span>
        <button class="btn-print" id="printAllocationBtn">🖨️ Print (2 copies)</button>
      </div>
    </div>

    <!-- Area boxes (each area in its own box) -->
    <div style="display:flex; flex-wrap:wrap; gap:0.75rem; margin-bottom:1.5rem; justify-content:center;">
      ${areaBoxesHtml}
    </div>

    <div class="allocation-section">
      <div class="section-header">
        <h3>👥 Staff on Duty (${selectedShift})</h3>
        <span class="duty-count">${onDutyCount} / ${staffUsers.length} on duty</span>
        <button class="save-btn" id="saveDutyBtn" ${!hasUnsavedDuty ? 'disabled' : ''}>💾 Save Duty</button>
      </div>
      <div class="allocation-grid" id="dutyGrid">
        ${staffUsers.map(u => {
          const isOnDuty = currentDuty[u.displayName] || false;
          return `
            <div class="allocation-card ${isOnDuty ? 'on-duty' : ''}" data-name="${u.displayName}" role="button" tabindex="0" aria-pressed="${isOnDuty}">
              <span class="avatar">${getAvatar(u.displayName)}</span>
              <span class="name">${u.displayName}</span>
              <span class="role-badge">${u.role || 'staff'}</span>
              <span class="status ${isOnDuty ? 'on-duty' : 'off-duty'}">
                ${isOnDuty ? '✓' : '○'}
              </span>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <div class="allocation-section">
      <div class="section-header">
        <h3>🗺️ Area Assignment (All staff can be assigned to multiple areas)</h3>
        <button class="save-btn" id="saveAreasBtn" ${!hasUnsavedAreas ? 'disabled' : ''}>💾 Save Areas</button>
      </div>
      <div class="area-matrix-wrapper">
        <table class="area-matrix">
          <thead><tr><th>Area</th>${periods.map(p => `<th>${p}</th>`).join('')}</tr></thead>
          <tbody>
            ${AREAS.map(area => {
              return `
                <tr>
                  <td class="area-label"><strong>${area}</strong></td>
                  ${periods.map(period => {
                    const assigned = currentAreas[period]?.[area] || [];
                    const availableStaff = getAvailableStaffForArea(selectedShift, period, area, assigned);
                    return `
                      <td>
                        <select multiple class="area-select" data-area="${area}" data-period="${period}" size="${Math.min(availableStaff.length + 1, 4)}">
                          ${availableStaff.map(u => `<option value="${u.displayName}" ${assigned.includes(u.displayName) ? 'selected' : ''}>${u.displayName}</option>`).join('')}
                        </select>
                        <div class="area-assigned-tags">
                          ${assigned.map(name => `
                            <span class="staff-tag">
                              👤 ${name}
                              <span class="remove-staff" data-area="${area}" data-period="${period}" data-name="${name}">×</span>
                            </span>
                          `).join('')}
                        </div>
                        ${availableStaff.length === 0 && assigned.length === 0 ? '<div style="font-size:0.7rem;color:#999;margin-top:0.25rem;">No staff on duty</div>' : ''}
                      </td>
                    `;
                  }).join('')}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ================== ALLOCATION LOGIC ==================
async function loadAllocationData() {
  if (!currentUser) { showNotification('Please sign in first.', 'error'); return; }
  if (isLoadingAllocation) return;
  isLoadingAllocation = true;

  if (!users.length && !isFetchingUsers) {
    await fetchUsers();
    if (userFetchError) {
      isLoadingAllocation = false;
      updateTabContent();
      return;
    }
  }

  selectedDate = currentShiftSettings.date || selectedDate;
  selectedShift = currentShiftSettings.shift || selectedShift;

  try {
    const docRef = db.collection('allocations').doc(selectedDate);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      const data = docSnap.data();
      dutyData = {};
      areaData = {};
      
      SHIFTS.forEach(shift => {
        dutyData[shift] = data.duty?.[shift] || {};
        areaData[shift] = data.areas?.[shift] || {};
        
        const staffUsers = users.filter(u => u.role !== 'supervisor' && u.role !== 'admin' && u.role !== 'manager');
        staffUsers.forEach(u => {
          if (dutyData[shift][u.displayName] === undefined) {
            dutyData[shift][u.displayName] = false;
          }
        });
        
        const periods = getPeriodsForShift(shift);
        periods.forEach(period => {
          if (!areaData[shift][period]) areaData[shift][period] = {};
          AREAS.forEach(area => {
            if (!areaData[shift][period][area]) areaData[shift][period][area] = [];
          });
        });
      });
    } else {
      dutyData = {};
      areaData = {};
      SHIFTS.forEach(shift => {
        dutyData[shift] = {};
        areaData[shift] = {};
        const staffUsers = users.filter(u => u.role !== 'supervisor' && u.role !== 'admin' && u.role !== 'manager');
        staffUsers.forEach(u => { dutyData[shift][u.displayName] = false; });
        const periods = getPeriodsForShift(shift);
        periods.forEach(period => {
          areaData[shift][period] = {};
          AREAS.forEach(area => { areaData[shift][period][area] = []; });
        });
      });
    }
    hasUnsavedDuty = false;
    hasUnsavedAreas = false;
  } catch (err) {
    console.error('Error loading allocation:', err);
    showNotification('Failed to load allocation data.', 'error');
  } finally {
    isLoadingAllocation = false;
    updateTabContent();
  }
}

function toggleDuty(name) {
  if (!dutyData[selectedShift]) dutyData[selectedShift] = {};
  dutyData[selectedShift][name] = !dutyData[selectedShift][name];
  hasUnsavedDuty = true;

  const card = document.querySelector(`.allocation-card[data-name="${name}"]`);
  if (card) {
    const isOnDuty = dutyData[selectedShift][name];
    card.classList.toggle('on-duty', isOnDuty);
    card.setAttribute('aria-pressed', isOnDuty);
    const statusSpan = card.querySelector('.status');
    if (statusSpan) {
      statusSpan.className = `status ${isOnDuty ? 'on-duty' : 'off-duty'}`;
      statusSpan.innerHTML = isOnDuty ? '✓' : '○';
    }
  }

  const staffUsers = users.filter(u => u.role !== 'supervisor' && u.role !== 'admin' && u.role !== 'manager');
  const onDutyCount = Object.values(dutyData[selectedShift] || {}).filter(v => v === true).length;
  const countSpan = document.querySelector('.duty-count');
  if (countSpan) countSpan.textContent = `${onDutyCount} / ${staffUsers.length} on duty`;

  const saveBtn = document.getElementById('saveDutyBtn');
  if (saveBtn) saveBtn.disabled = false;
  updateAreaSelects();
}

function updateAreaSelects() {
  const selects = document.querySelectorAll('.area-select');
  const staffUsers = users.filter(u => u.role !== 'supervisor' && u.role !== 'admin' && u.role !== 'manager');
  selects.forEach(select => {
    const shift = selectedShift;
    const period = select.dataset.period;
    const area = select.dataset.area;
    const assigned = areaData[shift]?.[period]?.[area] || [];
    
    const onDutyStaff = staffUsers.filter(u => (dutyData[shift]?.[u.displayName] || false) === true);
    const availableStaff = onDutyStaff; // no exclusivity
    
    select.innerHTML = '';
    availableStaff.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.displayName;
      opt.textContent = u.displayName;
      if (assigned.includes(u.displayName)) opt.selected = true;
      select.appendChild(opt);
    });
    
    const container = select.parentElement;
    let tagsDiv = container.querySelector('.area-assigned-tags');
    if (!tagsDiv) {
      tagsDiv = document.createElement('div');
      tagsDiv.className = 'area-assigned-tags';
      container.appendChild(tagsDiv);
    }
    tagsDiv.innerHTML = assigned.map(name => `
      <span class="staff-tag">
        👤 ${name}
        <span class="remove-staff" data-area="${area}" data-period="${period}" data-name="${name}">×</span>
      </span>
    `).join('');
  });
}

function onAreaChange(select, area, period) {
  const selectedOptions = Array.from(select.selectedOptions);
  let names = selectedOptions.map(opt => opt.value);

  if (!areaData[selectedShift]) areaData[selectedShift] = {};
  if (!areaData[selectedShift][period]) areaData[selectedShift][period] = {};
  areaData[selectedShift][period][area] = names;
  hasUnsavedAreas = true;
  document.getElementById('saveAreasBtn').disabled = false;

  const container = select.parentElement;
  let tagsDiv = container.querySelector('.area-assigned-tags');
  if (!tagsDiv) {
    tagsDiv = document.createElement('div');
    tagsDiv.className = 'area-assigned-tags';
    container.appendChild(tagsDiv);
  }
  tagsDiv.innerHTML = names.map(name => `
    <span class="staff-tag">
      👤 ${name}
      <span class="remove-staff" data-area="${area}" data-period="${period}" data-name="${name}">×</span>
    </span>
  `).join('');
  
  updateAreaSelects();
}

function handleRemoveStaffClick(e) {
  const target = e.target.closest('.remove-staff');
  if (!target) return;

  const area = target.dataset.area;
  const period = target.dataset.period;
  const name = target.dataset.name;
  const shift = selectedShift;

  if (areaData[shift]?.[period]?.[area]) {
    areaData[shift][period][area] = areaData[shift][period][area].filter(n => n !== name);
  }

  if (areaData[shift]?.[period]?.[area] && areaData[shift][period][area].length === 0) {
    delete areaData[shift][period][area];
    if (Object.keys(areaData[shift][period]).length === 0) {
      delete areaData[shift][period];
    }
    if (Object.keys(areaData[shift]).length === 0) {
      delete areaData[shift];
    }
  }

  hasUnsavedAreas = true;
  const saveBtn = document.getElementById('saveAreasBtn');
  if (saveBtn) saveBtn.disabled = false;

  showNotification(`🗑️ Removed ${name} from ${area} (${period})`, 'info');
  updateAreaSelects();
}

// ================== SAVE FUNCTIONS ==================
async function saveDuty() {
  if (!currentUser) return;
  try {
    const docRef = db.collection('allocations').doc(selectedDate);
    const docSnap = await docRef.get();
    let existingData = {};
    if (docSnap.exists) existingData = docSnap.data();
    
    const updateData = {
      duty: {
        ...existingData.duty,
        [selectedShift]: dutyData[selectedShift] || {}
      },
      updatedDutyBy: currentUser.displayName,
      updatedDutyAt: new Date().toISOString()
    };
    
    await docRef.set(updateData, { merge: true });
    hasUnsavedDuty = false;
    document.getElementById('saveDutyBtn').disabled = true;
    showNotification('✅ Duty status saved!', 'success');
  } catch (err) {
    console.error('Error saving duty:', err);
    showNotification('Failed to save duty: ' + err.message, 'error');
  }
}

async function saveAreas() {
  if (!currentUser) return;

  const currentShift = selectedShift;
  if (areaData[currentShift]) {
    const periods = getPeriodsForShift(currentShift);
    periods.forEach(period => {
      if (areaData[currentShift][period]) {
        AREAS.forEach(area => {
          if (!areaData[currentShift][period][area] || areaData[currentShift][period][area].length === 0) {
            delete areaData[currentShift][period][area];
          }
        });
        if (Object.keys(areaData[currentShift][period]).length === 0) {
          delete areaData[currentShift][period];
        }
      }
    });
    if (Object.keys(areaData[currentShift]).length === 0) {
      delete areaData[currentShift];
    }
  }

  const docRef = db.collection('allocations').doc(selectedDate);
  const docSnap = await docRef.get();
  let existingData = {};
  if (docSnap.exists) existingData = docSnap.data();
  
  const updateData = {
    areas: {
      ...existingData.areas,
      [selectedShift]: areaData[selectedShift] || {}
    },
    updatedAreasBy: currentUser.displayName,
    updatedAreasAt: new Date().toISOString()
  };

  try {
    await docRef.set(updateData, { merge: true });
    hasUnsavedAreas = false;
    const saveBtn = document.getElementById('saveAreasBtn');
    if (saveBtn) saveBtn.disabled = true;
    showNotification('✅ Area assignments saved!', 'success');
  } catch (err) {
    console.error('Error saving areas:', err);
    showNotification('Failed to save areas: ' + err.message, 'error');
  }
}

function printAllocation() {
  const periods = getPeriodsForShift(selectedShift);
  const currentAreas = areaData[selectedShift] || {};
  
  const tableHtml = (copyNum) => `
    <div class="copy-container">
      <h3>${copyNum === 1 ? 'Copy 1' : 'Copy 2'}</h3>
      <table>
        <thead><tr><th>Area</th><th>Description</th>${periods.map(p => `<th>${p}</th>`).join('')}</tr></thead>
        <tbody>
          ${AREAS.map(area => {
            const label = AREA_LABELS[area] || area;
            return `
              <tr>
                <td class="area-label"><strong>${area}</strong></td>
                <td style="font-size:0.8rem; color:#555;">${label}</td>
                ${periods.map(period => {
                  const assigned = currentAreas[period]?.[area] || [];
                  return `<td>${assigned.map(name => `<span class="staff-tag">${name}</span>`).join('') || '—'}</td>`;
                }).join('')}
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      <div class="footer">Date: ${selectedDate} · Shift: ${selectedShift}</div>
    </div>
  `;

  const fullHtml = `
    <!DOCTYPE html>
    <html><head><title>Staff Allocation - ${selectedDate} ${selectedShift}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 0.5in; }
      .page { display: flex; flex-wrap: wrap; gap: 1in; }
      .copy-container { flex: 1; min-width: 300px; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 0.5rem; }
      th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; vertical-align: top; font-size: 11px; }
      th { background: #f5f5f5; }
      .area-label { font-weight: bold; background: #fafafa; }
      .staff-tag { display: inline-block; background: #e8f0fe; padding: 0 6px; border-radius: 10px; margin: 1px; font-size: 10px; }
      .footer { font-size: 10px; color: #555; text-align: center; margin-top: 4px; }
      h3 { margin: 0 0 4px 0; font-size: 13px; color: #333; }
      @media print { body { padding: 0.3in; } .page { gap: 0.5in; } }
    </style>
    </head><body>
    <h2 style="text-align:center; margin-bottom:0.2in;">Staff Allocation – ${selectedDate} ${selectedShift}</h2>
    <div class="page">
      ${tableHtml(1)}
      ${tableHtml(2)}
    </div>
    </body></html>
  `;

  const win = window.open('', '_blank');
  win.document.write(fullHtml);
  win.document.close();
  win.focus();
  win.print();
}

// ================== LEAVE TAB ==================
function renderLeaveTab() {
  if (isFetchingUsers) {
    return `<div class="loading-state"><div class="spinner-small"></div>Loading staff list…</div>`;
  }
  if (userFetchError) {
    return `
      <div class="empty-state" style="color:#dc2626; padding: 2rem;">
        <p>⚠️ Unable to load staff data</p>
        <button class="btn-load" id="retryFetchUsersBtn">🔄 Retry</button>
      </div>
    `;
  }
  if (!users.length) {
    return `<div class="empty-state">No users found.</div>`;
  }
  if (isLoadingLeaves) {
    return `<div class="loading-state"><div class="spinner-small"></div>Loading leave data…</div>`;
  }

  const staffUsers = users.filter(u => u.role !== 'supervisor' && u.role !== 'admin' && u.role !== 'manager');
  const leaveTypeOptions = LEAVE_TYPES.map(t => `<option value="${t}">${t}</option>`).join('');
  const staffDutyOptions = STAFF_DUTY.map(d => `<option value="${d}">${d}</option>`).join('');
  
  const initialReasons = REASON_OPTIONS['FRL'] || [];
  const reasonOptionsHtml = initialReasons.map(r => `<option value="${r}">${r}</option>`).join('');

  let entriesHtml = '';
  if (leaveEntries.length === 0) {
    entriesHtml = `<div class="empty-state">No leave entries for selected date.</div>`;
  } else {
    entriesHtml = `
      <table class="leave-table">
        <thead><tr><th>Staff</th><th>Staff Duty</th><th>Type</th><th>Reason</th><th>Reported At</th><th>Action</th></tr></thead>
        <tbody>
          ${leaveEntries.map((entry, idx) => `
            <tr>
              <td>${entry.displayName}</td>
              <td><span class="staff-duty-badge">${entry.staffDuty || '—'}</span></td>
              <td><span class="leave-type-badge ${entry.type.toLowerCase()}">${entry.type}</span></td>
              <td>${entry.reason || '—'}</td>
              <td>${entry.reportedAt || '—'}</td>
              <td><button class="btn-remove-leave" data-idx="${idx}">🗑️</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  return `
    <div class="leave-date-section">
      <label>📅 Date <input type="date" id="leaveDate" value="${selectedDate}" /></label>
      <button class="btn-load" id="loadLeaveBtn">📂 Load</button>
      <button class="btn-print" id="printLeaveBtn">🖨️ Print Leave Report</button>
    </div>
    <div class="allocation-section">
      <div class="section-header">
        <h3>📝 Add Leave Entry</h3>
        <button class="save-btn" id="saveLeaveBtn">💾 Save Leave</button>
      </div>
      <div class="leave-form">
        <div class="form-group">
          <label>Staff</label>
          <select id="leaveStaffSelect">
            <option value="">— Select —</option>
            ${staffUsers.map(u => `<option value="${u.email}">${u.displayName}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Staff Duty</label>
          <select id="staffDutySelect">
            <option value="">— Select —</option>
            ${staffDutyOptions}
          </select>
        </div>
        <div class="form-group">
          <label>Leave Type</label>
          <select id="leaveTypeSelect">${leaveTypeOptions}</select>
        </div>
        <div class="form-group" id="leaveReasonGroup">
          <label>Reason</label>
          <select id="leaveReasonSelect">${reasonOptionsHtml}</select>
        </div>
        <div class="form-group">
          <label>Reported Time</label>
          <input type="time" id="leaveTimeInput" value="${new Date().toTimeString().slice(0,5)}" />
        </div>
      </div>
    </div>
    <div class="allocation-section">
      <div class="section-header">
        <h3>📋 Leave Entries for ${selectedDate}</h3>
      </div>
      ${entriesHtml}
    </div>
  `;
}

async function loadLeaveData() {
  if (!currentUser) { showNotification('Please sign in first.', 'error'); return; }
  if (isLoadingLeaves) return;
  isLoadingLeaves = true;

  if (!users.length && !isFetchingUsers) {
    await fetchUsers();
    if (userFetchError) {
      isLoadingLeaves = false;
      updateTabContent();
      return;
    }
  }

  const dateInput = document.getElementById('leaveDate');
  if (dateInput) {
    selectedDate = dateInput.value;
  }

  try {
    const docRef = db.collection('leaves').doc(selectedDate);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      leaveEntries = docSnap.data().entries || [];
    } else {
      leaveEntries = [];
    }
    showNotification(`📋 Loaded ${leaveEntries.length} leave entries for ${selectedDate}`, 'info');
  } catch (err) {
    console.error('Error loading leaves:', err);
    showNotification('Failed to load leave data.', 'error');
  } finally {
    isLoadingLeaves = false;
    updateTabContent();
  }
}

async function addLeaveEntry() {
  const staffSelect = document.getElementById('leaveStaffSelect');
  const staffDutySelect = document.getElementById('staffDutySelect');
  const typeSelect = document.getElementById('leaveTypeSelect');
  const reasonSelect = document.getElementById('leaveReasonSelect');
  const timeInput = document.getElementById('leaveTimeInput');

  const staffEmail = staffSelect.value;
  if (!staffEmail) { showNotification('Please select a staff member.', 'error'); return; }
  
  const staffDuty = staffDutySelect.value;
  if (!staffDuty) { showNotification('Please select staff duty.', 'error'); return; }
  
  const type = typeSelect.value;
  const reason = type === 'Absent' ? '' : reasonSelect.value;
  const reportedAt = timeInput.value;

  if ((type === 'FRL' || type === 'SL') && !reason) {
    showNotification('Please select a reason for ' + type + '.', 'error');
    return;
  }

  const staff = users.find(u => u.email === staffEmail);
  if (!staff) { showNotification('Staff not found.', 'error'); return; }

  const entry = {
    staffEmail,
    displayName: staff.displayName,
    staffDuty: staffDuty,
    type,
    reason: reason || '',
    reportedAt,
    timestamp: new Date().toISOString()
  };

  leaveEntries.push(entry);
  try {
    const docRef = db.collection('leaves').doc(selectedDate);
    await docRef.set({ entries: leaveEntries }, { merge: true });
    showNotification(`✅ Leave added for ${staff.displayName} (${type})`, 'success');
    loadLeaveData();
  } catch (err) {
    console.error('Error saving leave:', err);
    showNotification('Failed to save leave.', 'error');
    leaveEntries.pop();
  }
}

async function removeLeaveEntry(idx) {
  if (!confirm(`Remove leave entry for ${leaveEntries[idx].displayName}?`)) return;
  leaveEntries.splice(idx, 1);
  try {
    const docRef = db.collection('leaves').doc(selectedDate);
    await docRef.set({ entries: leaveEntries }, { merge: true });
    showNotification('🗑️ Leave entry removed.', 'success');
    loadLeaveData();
  } catch (err) {
    console.error('Error removing leave:', err);
    showNotification('Failed to remove leave.', 'error');
    loadLeaveData();
  }
}

function printLeaveReport() {
  if (leaveEntries.length === 0) {
    showNotification('No leave entries to print.', 'error');
    return;
  }
  const rows = leaveEntries.map(e => `
    <tr>
      <td>${e.displayName}</td>
      <td>${e.staffDuty || '—'}</td>
      <td>${e.type}</td>
      <td>${e.reason || '—'}</td>
      <td>${e.reportedAt || '—'}</td>
    </tr>
  `).join('');
  
  const html = `
    <!DOCTYPE html>
    <html><head><title>Leave Report - ${selectedDate}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 0.5in; }
      h1 { font-size: 18px; margin-bottom: 4px; }
      .sub { color: #555; margin-bottom: 0.3in; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #aaa; padding: 6px 8px; text-align: left; }
      th { background: #f0f0f0; }
      .frl { background: #fef3c7; }
      .sl { background: #dbeafe; }
      .absent { background: #fee2e2; }
      .staff-duty-badge { 
        display: inline-block; 
        padding: 0 8px; 
        border-radius: 12px; 
        font-size: 0.7rem; 
        font-weight: 500;
        background: #e5e7eb;
        color: #374151;
      }
    </style>
    </head><body>
    <h1>📋 Leave Report</h1>
    <div class="sub">Date: ${selectedDate}</div>
    <table>
      <thead>
        <tr>
          <th>Staff</th>
          <th>Staff Duty</th>
          <th>Type</th>
          <th>Reason</th>
          <th>Reported At</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin-top:1rem;font-size:0.85rem;color:#888;">
      Printed on ${new Date().toLocaleString()}
    </p>
    </body></html>
  `;
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

// ================== BREAK REQUESTS TAB ==================
function renderBreakTab() {
  if (!currentUser) return '<div class="empty-state">Please sign in.</div>';
  if (isFetchingUsers) {
    return `<div class="loading-state"><div class="spinner-small"></div>Loading…</div>`;
  }
  if (!users.length) {
    return `<div class="empty-state">No staff found.</div>`;
  }

  const filteredRequests = breakRequests.filter(r => 
    r.date === selectedDate && r.shift === selectedShift
  );
  
  const pending = filteredRequests.filter(r => r.status === 'pending');
  const others = filteredRequests.filter(r => r.status !== 'pending');

  const renderTable = (requests, title) => {
    if (requests.length === 0) return `<p class="empty-state">No ${title.toLowerCase()} for ${selectedDate} · ${selectedShift}.</p>`;
    return `
      <h4>${title}</h4>
      <table class="break-requests-table">
        <thead><tr><th>Staff</th><th>Break Slot</th><th>Reason</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>
          ${requests.map(r => `
            <tr>
              <td>${r.staffName}</td>
              <td>${r.breakSlot || r.startTime || '—'}</td>
              <td>${r.reason || '—'}</td>
              <td><span class="break-status ${r.status}">${r.status}</span></td>
              <td class="break-actions">
                ${r.status === 'pending' ? `
                  <button class="approve-btn" data-id="${r.id}">✅ Approve</button>
                  <button class="reject-btn" data-id="${r.id}">❌ Reject</button>
                ` : '<span style="color:#888;">No action</span>'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  return `
    <div class="allocation-section">
      <div class="section-header">
        <h3>☕ Break Requests</h3>
        <div style="display:flex; gap:1rem; font-size:0.85rem; color:rgba(0,0,0,0.6);">
          <span>📅 ${selectedDate}</span>
          <span>🕒 ${selectedShift}</span>
          <button class="btn-load" id="refreshBreakBtn">🔄 Refresh</button>
        </div>
      </div>
      ${renderTable(pending, 'Pending')}
      ${renderTable(others, 'Reviewed')}
    </div>
  `;
}

async function loadBreakRequests() {
  if (!currentUser) return;
  
  selectedDate = currentShiftSettings.date || selectedDate;
  selectedShift = currentShiftSettings.shift || selectedShift;
  
  try {
    const snapshot = await db.collection('break_requests')
      .where('date', '==', selectedDate)
      .where('shift', '==', selectedShift)
      .orderBy('requestedAt', 'desc')
      .get();
    breakRequests = [];
    snapshot.forEach(doc => {
      breakRequests.push({ id: doc.id, ...doc.data() });
    });
    if (currentTab === 'break') {
      const container = document.getElementById('tabContent');
      if (container) container.innerHTML = renderBreakTab();
      attachBreakEvents();
    }
  } catch (err) {
    console.error('Error loading break requests:', err);
    showNotification('Failed to load break requests.', 'error');
  }
}

async function handleBreakAction(requestId, action) {
  try {
    await db.collection('break_requests').doc(requestId).update({ status: action });
    showNotification(`✅ Break request ${action}ed.`, 'success');
    loadBreakRequests();
  } catch (err) {
    console.error('Error updating break request:', err);
    showNotification('Failed to update break request.', 'error');
  }
}

function attachBreakEvents() {
  document.querySelectorAll('.approve-btn').forEach(btn => {
    btn.addEventListener('click', () => handleBreakAction(btn.dataset.id, 'approved'));
  });
  document.querySelectorAll('.reject-btn').forEach(btn => {
    btn.addEventListener('click', () => handleBreakAction(btn.dataset.id, 'rejected'));
  });
  
  const refreshBtn = document.getElementById('refreshBreakBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadBreakRequests);
  }
}

// ================== SET SHIFT TAB ==================
function renderShiftTab() {
  const currentDate = currentShiftSettings.date || selectedDate;
  const currentShift = currentShiftSettings.shift || 'Morning';

  return `
    <div class="allocation-section">
      <h3>📅 Set Current Shift</h3>
      <p style="color: rgba(0,0,0,0.5); margin-bottom: 1rem;">
        This determines the date and shift that will be used for tasks, allocation, and break requests.
      </p>
      <div class="shift-form">
        <div class="form-group">
          <label>📅 Date</label>
          <input type="date" id="shiftDateInput" value="${currentDate}" />
        </div>
        <div class="form-group">
          <label>🕒 Shift</label>
          <select id="shiftSelectInput">
            ${SHIFTS.map(s => `<option value="${s}" ${s === currentShift ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
        <button class="btn-primary" id="saveShiftBtn">💾 Save Shift</button>
      </div>
      <div style="margin-top: 1rem; font-size: 0.85rem; color: rgba(0,0,0,0.4);">
        Current setting: <strong>${currentDate} · ${currentShift}</strong>
      </div>
    </div>
  `;
}

async function loadShiftSettings() {
  try {
    const settingsRef = db.collection('settings').doc('currentShift');
    const settingsSnap = await settingsRef.get();
    if (settingsSnap.exists) {
      currentShiftSettings = settingsSnap.data();
      selectedDate = currentShiftSettings.date || selectedDate;
      selectedShift = currentShiftSettings.shift || selectedShift;
    } else {
      currentShiftSettings = { date: new Date().toISOString().slice(0,10), shift: 'Morning' };
    }
    if (currentTab === 'shift') {
      const container = document.getElementById('tabContent');
      if (container) container.innerHTML = renderShiftTab();
      attachShiftEvents();
    }
  } catch (err) {
    console.error('Error loading shift settings:', err);
    showNotification('Failed to load shift settings.', 'error');
  }
}

async function saveShiftSettings() {
  const dateInput = document.getElementById('shiftDateInput');
  const shiftSelect = document.getElementById('shiftSelectInput');
  if (!dateInput || !shiftSelect) return;

  const date = dateInput.value;
  const shift = shiftSelect.value;

  if (!date || !shift) {
    showNotification('Please select both date and shift.', 'error');
    return;
  }

  try {
    await db.collection('settings').doc('currentShift').set({ date, shift });
    currentShiftSettings = { date, shift };
    selectedDate = date;
    selectedShift = shift;
    showNotification('✅ Shift settings saved!', 'success');
    const container = document.getElementById('tabContent');
    if (container) container.innerHTML = renderShiftTab();
    attachShiftEvents();
    
    if (currentTab === 'tasks') loadTasks();
    if (currentTab === 'allocation') loadAllocationData();
    if (currentTab === 'break') loadBreakRequests();
  } catch (err) {
    console.error('Error saving shift settings:', err);
    showNotification('Failed to save shift settings.', 'error');
  }
}

function attachShiftEvents() {
  const saveBtn = document.getElementById('saveShiftBtn');
  if (saveBtn) saveBtn.addEventListener('click', saveShiftSettings);
}

// ================== UPDATE TAB CONTENT ==================
function updateTabContent() {
  const container = document.getElementById('tabContent');
  if (!container) return;
  if (currentTab === 'tasks') {
    container.innerHTML = renderTasksTab();
    if (currentUser) loadTasks();
    attachPrintChecklistEvent();
  } else if (currentTab === 'allocation') {
    container.innerHTML = renderAllocationTab();
    setTimeout(attachAllocationEvents, 50);
  } else if (currentTab === 'leaves') {
    container.innerHTML = renderLeaveTab();
    setTimeout(attachLeaveEvents, 50);
  } else if (currentTab === 'break') {
    container.innerHTML = renderBreakTab();
    setTimeout(attachBreakEvents, 50);
  } else if (currentTab === 'shift') {
    container.innerHTML = renderShiftTab();
    setTimeout(attachShiftEvents, 50);
  }
}

// ================== FETCH USERS ==================
async function fetchUsers() {
  if (isFetchingUsers) return;
  isFetchingUsers = true;
  userFetchError = null;
  try {
    const snapshot = await db.collection('users').get();
    users = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      users.push({
        email: doc.id,
        displayName: data.displayName || data.username || doc.id,
        lineCode: data.lineCode || '',
        password: data.password || '',
        role: data.role || 'staff'
      });
    });
    users.sort((a, b) => a.displayName.localeCompare(b.displayName));
    console.log(`✅ Loaded ${users.length} users`);
  } catch (err) {
    console.error('Failed to fetch users:', err);
    userFetchError = err;
    showNotification('Failed to load users: ' + (err.message || 'network error'), 'error');
  } finally {
    isFetchingUsers = false;
    updateTabContent();
  }
}

// ================== EVENT ATTACHMENT ==================
function attachAllocationEvents() {
  document.querySelectorAll('.allocation-card').forEach(card => {
    const name = card.dataset.name;
    if (!name) return;
    card.addEventListener('click', (e) => { e.preventDefault(); toggleDuty(name); });
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleDuty(name); } });
    card.addEventListener('touchstart', () => { card.style.transform = 'scale(0.95)'; }, { passive: true });
    card.addEventListener('touchend', () => { card.style.transform = ''; }, { passive: true });
  });

  document.querySelectorAll('.area-select').forEach(select => {
    const area = select.dataset.area;
    const period = select.dataset.period;
    select.addEventListener('change', () => onAreaChange(select, area, period));
  });

  const matrixWrapper = document.querySelector('.area-matrix-wrapper');
  if (matrixWrapper) {
    matrixWrapper.addEventListener('click', function(e) {
      const target = e.target.closest('.remove-staff');
      if (target) {
        handleRemoveStaffClick(e);
      }
    });
  }

  const saveDutyBtn = document.getElementById('saveDutyBtn');
  if (saveDutyBtn) saveDutyBtn.addEventListener('click', saveDuty);
  const saveAreasBtn = document.getElementById('saveAreasBtn');
  if (saveAreasBtn) saveAreasBtn.addEventListener('click', saveAreas);
  
  const refreshBtn = document.getElementById('refreshAllocationBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadAllocationData);
  }
  
  const printBtn = document.getElementById('printAllocationBtn');
  if (printBtn) printBtn.addEventListener('click', printAllocation);
  const retryBtn = document.getElementById('retryFetchUsersBtn');
  if (retryBtn) retryBtn.addEventListener('click', () => { fetchUsers().then(() => loadAllocationData()); });
  
  const syncBtn = document.getElementById('syncShiftBtn');
  if (syncBtn) {
    syncBtn.addEventListener('click', () => {
      if (currentShiftSettings.date) {
        selectedDate = currentShiftSettings.date;
        selectedShift = currentShiftSettings.shift;
        loadAllocationData();
        showNotification(`📌 Synced to shift: ${currentShiftSettings.date} · ${currentShiftSettings.shift}`, 'success');
      } else {
        showNotification('No shift set. Please go to Set Shift tab first.', 'error');
      }
    });
  }
}

function attachLeaveEvents() {
  const loadBtn = document.getElementById('loadLeaveBtn');
  if (loadBtn) {
    loadBtn.addEventListener('click', () => {
      const dateInput = document.getElementById('leaveDate');
      if (dateInput) selectedDate = dateInput.value;
      loadLeaveData();
    });
  }
  const saveBtn = document.getElementById('saveLeaveBtn');
  if (saveBtn) saveBtn.addEventListener('click', addLeaveEntry);

  document.querySelectorAll('.btn-remove-leave').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      removeLeaveEntry(idx);
    });
  });

  const printBtn = document.getElementById('printLeaveBtn');
  if (printBtn) printBtn.addEventListener('click', printLeaveReport);

  const typeSelect = document.getElementById('leaveTypeSelect');
  const reasonSelect = document.getElementById('leaveReasonSelect');
  const reasonGroup = document.getElementById('leaveReasonGroup');

  if (typeSelect && reasonSelect && reasonGroup) {
    function updateReasons() {
      const type = typeSelect.value;
      if (type === 'Absent') {
        reasonGroup.style.display = 'none';
        return;
      }
      reasonGroup.style.display = 'block';
      const reasons = REASON_OPTIONS[type] || [];
      reasonSelect.innerHTML = reasons.map(r => `<option value="${r}">${r}</option>`).join('');
    }
    typeSelect.addEventListener('change', updateReasons);
    updateReasons();
  }

  const retryBtn = document.getElementById('retryFetchUsersBtn');
  if (retryBtn) retryBtn.addEventListener('click', () => { fetchUsers().then(() => loadLeaveData()); });
}

// ================== AUTHENTICATION (Pattern Lock) ==================
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
  let dots = [], selected = [], isDrawing = false;
  function build() {
    grid.innerHTML = ''; dots = [];
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
      grid.appendChild(dot); dots.push(dot);
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
    selected.forEach(i => { const dot = dots[i]; if (dot) { dot.classList.remove('selected', 'error'); dot.style.transform = ''; } });
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

function showAuthModal() {
  if (!users.length) {
    fetchUsers().then(() => { if (currentTab === 'allocation') updateTabContent(); showAuthModal(); });
    return;
  }
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'userModal';
  const supervisorUsers = users.filter(u => u.role === 'supervisor' || u.role === 'admin' || u.role === 'manager');
  if (!supervisorUsers.length) {
    alert('No supervisor accounts found. Please use the checklist page.');
    window.location.href = 'checklist.html';
    return;
  }
  const options = supervisorUsers.map(u => `<option value="${u.email}">${u.displayName || u.email}</option>`).join('');
  overlay.innerHTML = `
    <div class="modal-box">
      <h2>🔐 Supervisor Sign In</h2>
      <p>Select your account and draw your pattern.</p>
      <div class="form-group"><label for="userSelect">User</label><select id="userSelect"><option value="">— Choose —</option>${options}</select></div>
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
  let patternLock = null;
  setTimeout(() => {
    patternLock = setupPatternLock('modalPatternGrid', (pattern) => { attemptSignin(pattern); });
  }, 50);
  async function attemptSignin(drawnPattern) {
    const email = userSelect.value;
    if (!email) { errorMsg.style.display = 'block'; errorMsg.textContent = 'Please select a user.'; return; }
    if (!drawnPattern || drawnPattern.length < 4) { errorMsg.style.display = 'block'; errorMsg.textContent = 'Please draw a pattern with at least 4 dots.'; return; }
    const user = users.find(u => u.email === email);
    if (!user) { errorMsg.style.display = 'block'; errorMsg.textContent = 'User not found.'; return; }
    const storedCode = user.lineCode || user.password || '';
    if (drawnPattern === storedCode) {
      currentUser = user;
      localStorage.setItem('checklist_user', JSON.stringify({ email: user.email }));
      errorMsg.style.display = 'none';
      overlay.remove();
      render();
      showNotification(`Welcome, Supervisor ${user.displayName || user.email}!`);
      if (currentTab === 'allocation') loadAllocationData();
    } else {
      errorMsg.style.display = 'block';
      errorMsg.textContent = '❌ Incorrect pattern. Please try again.';
      if (patternLock) patternLock.reset(false);
    }
  }
  signinBtn.addEventListener('click', () => {
    const pattern = patternLock ? patternLock.getPattern() : '';
    attemptSignin(pattern);
  });
  cancelBtn.addEventListener('click', () => {
    overlay.remove();
    if (!currentUser) {
      const container = document.getElementById('tabContent');
      if (container) container.innerHTML = `<div class="empty-state">Please sign in to start.</div>`;
    }
  });
  if (currentUser) userSelect.value = currentUser.email;
}

// ================== INIT ==================
async function init() {
  try {
    const settingsRef = db.collection('settings').doc('currentShift');
    const settingsSnap = await settingsRef.get();
    if (settingsSnap.exists) {
      currentShiftSettings = settingsSnap.data();
      selectedDate = currentShiftSettings.date || selectedDate;
      selectedShift = currentShiftSettings.shift || selectedShift;
    } else {
      currentShiftSettings = { date: new Date().toISOString().slice(0,10), shift: 'Morning' };
    }
    console.log('📅 [Supervisor] Shift settings loaded:', currentShiftSettings);
  } catch (err) {
    console.error('Error loading shift settings:', err);
  }

  await fetchUsers();

  const stored = localStorage.getItem('checklist_user');
  if (stored) {
    try {
      const { email } = JSON.parse(stored);
      const user = users.find(u => u.email === email);
      if (user && (user.role === 'supervisor' || user.role === 'admin' || user.role === 'manager')) {
        currentUser = user;
        render();
        return;
      }
    } catch (e) {}
  }
  render();
}

init();
