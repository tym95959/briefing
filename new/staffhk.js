// staff.js – Complete Staff Dashboard with Logout & Read‑Only Mode
// Added tabs: Monthly Once, Monthly Twice, Daily

import { 
  MAIN_DAILY_TASKS, 
  FB_DAILY_TASKS,
  MONTHLY_ONCE_TASKS,   // assume exported from task.js
  MONTHLY_TWICE_TASKS,  // assume exported from task.js
  DAILY_TASKS           // assume exported from task.js
} from './task.js';

const AREAS = ['Welcome', 'Reception', 'Buffet', 'Floor', 'Pantry'];
const SHIFTS = ['Morning', 'Evening'];
const PERIODS = {
  Morning: ['07:30-10:30', '10:30-13:30', '13:30-15:30'],
  Evening: ['15:30-18:30', '18:30-21:00', '21:00-23:30']
};
const SHARED_AREAS = ['Floor', 'Pantry'];

function getBreakSlots(shift) {
  if (shift === 'Morning') {
    return [
      '07:30-08:30', '08:30-09:30', '09:30-10:30',
      '10:30-11:30', '11:30-12:30', '12:30-13:30',
      '13:30-14:30', '14:30-15:30'
    ];
  } else if (shift === 'Evening') {
    return [
      '15:30-16:30', '16:30-17:30', '17:30-18:30',
      '18:30-19:30', '19:30-20:30', '20:30-21:30',
      '21:30-22:30', '22:30-23:30'
    ];
  }
  return [];
}

// ---- State ----
let currentUser = null;
let isLoggedOut = false;
let currentTab = 'checklist';
let currentCategory = 'main';   // can be: main, fb, monthly_once, monthly_twice, daily
let users = [];
let dutyData = {};
let areaData = {};
let leaveEntries = [];
let breakRequests = [];
let currentShiftSettings = { date: new Date().toISOString().slice(0,10), shift: 'Morning' };
let isFetchingUsers = false;
let userFetchError = null;
let isLoadingData = false;

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

// ---- Enhanced task retrieval ----
function getTasksByCategory(category) {
  switch (category) {
    case 'main':
      return MAIN_DAILY_TASKS || [];
    case 'fb':
      return FB_DAILY_TASKS || [];
    case 'monthly_once':
      return MONTHLY_ONCE_TASKS || [];
    case 'monthly_twice':
      return MONTHLY_TWICE_TASKS || [];
    case 'daily':
      return DAILY_TASKS || [];
    default:
      return [];
  }
}

// ================== RENDER ==================
function render() {
  const userDisplay = isLoggedOut ? 'Logged Out' : (currentUser ? currentUser.displayName : 'Not signed in');
  const totalTasks = 
    (MAIN_DAILY_TASKS?.length || 0) + 
    (FB_DAILY_TASKS?.length || 0) + 
    (MONTHLY_ONCE_TASKS?.length || 0) + 
    (MONTHLY_TWICE_TASKS?.length || 0) + 
    (DAILY_TASKS?.length || 0);
  const pendingCount = breakRequests.filter(r => r.status === 'pending').length;

  root.innerHTML = `
    <div class="checklist-header">
      <h1>📋 Staff Dashboard</h1>
      <div>
        <span class="user-badge">👤 <strong>${userDisplay}</strong></span>
        ${!isLoggedOut && currentUser ? `<button class="back-btn" id="logoutBtn">🚪 Logout</button>` : ''}
        <button class="back-btn" id="switchUserBtn">⟳ Switch User</button>
        <a href="supervisor.html" class="back-btn" style="background: #8b5cf6; color: white; text-decoration: none; padding: 0.5rem 1rem; border-radius: 8px; display: inline-block; margin-left: 0.5rem;">
          👑 Supervisor
        </a>
      </div>
    </div>
    <div class="staff-tabs">
      <button class="staff-tab ${currentTab === 'checklist' ? 'active' : ''}" data-tab="checklist">
        ✅ Checklist <span class="badge">${totalTasks}</span>
      </button>
      <button class="staff-tab ${currentTab === 'allocation' ? 'active' : ''}" data-tab="allocation">
        👥 Allocation <span class="badge">${users.length}</span>
      </button>
      <button class="staff-tab ${currentTab === 'leaves' ? 'active' : ''}" data-tab="leaves">
        📝 Leave Report <span class="badge">${leaveEntries.length}</span>
      </button>
      <button class="staff-tab ${currentTab === 'break' ? 'active' : ''}" data-tab="break">
        ☕ Break Request <span class="badge">${pendingCount}</span>
      </button>
    </div>
    <div id="tabContent">
      ${currentTab === 'checklist' ? renderChecklistTab() :
        currentTab === 'allocation' ? renderAllocationTab() :
        currentTab === 'leaves' ? renderLeaveTab() :
        renderBreakTab()}
    </div>
  `;

  // ---- Attach events ----
  const switchBtn = document.getElementById('switchUserBtn');
  if (switchBtn) switchBtn.addEventListener('click', () => showAuthModal());

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      isLoggedOut = true;
      currentUser = null;
      localStorage.removeItem('checklist_user');
      showNotification('👋 Logged out. Viewing read‑only mode.', 'info');
      render();
    });
  }

  document.querySelectorAll('.staff-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.tab;
      render();
      if (currentTab === 'checklist') loadChecklistData();
      else if (currentTab === 'allocation') loadAllocationData();
      else if (currentTab === 'leaves') loadLeaveData();
      else if (currentTab === 'break') loadBreakData();
    });
  });

  // Load data for the current tab
  if (currentTab === 'checklist') loadChecklistData();
  else if (currentTab === 'allocation') loadAllocationData();
  else if (currentTab === 'leaves') loadLeaveData();
  else if (currentTab === 'break') loadBreakData();

  // If not logged in and not in logout mode, show auth modal
  if (!currentUser && !isLoggedOut) showAuthModal();
}

// ================== CHECKLIST TAB ==================
function renderChecklistTab() {
  if (isFetchingUsers) {
    return `<div class="loading-state"><div class="spinner-small"></div>Loading…</div>`;
  }
  if (userFetchError) {
    return `
      <div class="empty-state" style="color:#dc2626; padding: 2rem;">
        <p>⚠️ Unable to load staff data</p>
        <button class="btn-load" id="retryFetchUsersBtn">🔄 Retry</button>
      </div>
    `;
  }
  if (!currentUser && !isLoggedOut) {
    return `<div class="empty-state">Please sign in to view tasks.</div>`;
  }
  return `
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem; margin-bottom:1rem;">
      <div class="category-tabs">
        <button class="category-tab ${currentCategory === 'main' ? 'active' : ''}" data-cat="main">
          Main Tasks <span class="badge">${MAIN_DAILY_TASKS?.length || 0}</span>
        </button>
        <button class="category-tab ${currentCategory === 'fb' ? 'active' : ''}" data-cat="fb">
          Food & Beverage <span class="badge">${FB_DAILY_TASKS?.length || 0}</span>
        </button>
        <button class="category-tab ${currentCategory === 'monthly_once' ? 'active' : ''}" data-cat="monthly_once">
          📅 Monthly Once <span class="badge">${MONTHLY_ONCE_TASKS?.length || 0}</span>
        </button>
        <button class="category-tab ${currentCategory === 'monthly_twice' ? 'active' : ''}" data-cat="monthly_twice">
          📅 Monthly Twice <span class="badge">${MONTHLY_TWICE_TASKS?.length || 0}</span>
        </button>
        <button class="category-tab ${currentCategory === 'daily' ? 'active' : ''}" data-cat="daily">
          📆 Daily <span class="badge">${DAILY_TASKS?.length || 0}</span>
        </button>
      </div>
      <div class="shift-indicator" style="display:flex; align-items:center; gap:0.5rem; font-size:0.85rem; color:#6b7280;">
        <span>📅 ${currentShiftSettings.date}</span>
        <span class="shift-badge ${currentShiftSettings.shift === 'Morning' ? 'morning' : 'evening'}" style="font-size:0.75rem; padding:0.2rem 0.6rem; border-radius:12px; background:${currentShiftSettings.shift === 'Morning' ? '#fef3c7' : '#e0e7ff'};">
          ${currentShiftSettings.shift}
        </span>
      </div>
    </div>
    <div id="taskListContainer">
      <div class="loading-state"><div class="spinner-small"></div>Loading tasks…</div>
    </div>
  `;
}

async function loadChecklistData() {
  if (!currentUser && !isLoggedOut) return;
  const container = document.getElementById('taskListContainer');
  if (!container) return;
  try {
    const docRef = db.collection('checklists').doc(`shift_${currentShiftSettings.date}`);
    const docSnap = await docRef.get();
    let savedData = {};
    if (docSnap.exists) savedData = docSnap.data();
    const categoryTasks = getTasksByCategory(currentCategory);
    const mergedTasks = categoryTasks.map(task => {
      const saved = savedData[task.id];
      return saved ? { ...task, ...saved } : { ...task };
    });
    renderChecklistTasks(mergedTasks, savedData, docRef);
  } catch (err) {
    console.error('Error loading tasks:', err);
    container.innerHTML = `<div class="empty-state">⚠️ Failed to load tasks: ${err.message}</div>`;
  }
}

function renderChecklistTasks(tasks, savedData, docRef) {
  const container = document.getElementById('taskListContainer');
  if (!container) return;
  if (!tasks.length) {
    container.innerHTML = `<div class="empty-state">No tasks in this category.</div>`;
    return;
  }
  const isReadOnly = isLoggedOut || !currentUser;
  let html = '<div class="task-list">';
  tasks.forEach(task => {
    const isCompleted = task.type === 'complete' ? task.completedBy !== null : (task.signoffs && task.signoffs.length > 0);
    const completedClass = isCompleted ? 'completed' : '';
    const statusIcon = isCompleted ? '✓' : '○';
    
    let actionHtml = '';
    if (task.type === 'complete') {
      if (task.completedBy) {
        if (task.completedBy === currentUser?.displayName && !isReadOnly) {
          actionHtml = `<button class="done" disabled>✅ Done by you</button> <button class="delete-own-complete" data-id="${task.id}">🗑️ Delete</button>`;
        } else {
          actionHtml = `<button class="done" disabled>✅ Done by ${task.completedBy}</button>`;
        }
      } else {
        if (!isReadOnly) {
          actionHtml = `<button class="complete-btn" data-id="${task.id}">✔ Complete</button>`;
        } else {
          actionHtml = `<button class="done" disabled>⏳ Pending</button>`;
        }
      }
    } else if (task.type === 'signoff') {
      const signed = task.signoffs && task.signoffs.includes(currentUser?.displayName);
      if (signed) {
        if (!isReadOnly) {
          actionHtml = `<button class="done" disabled>✅ Signed</button> <button class="remove-own-signoff" data-id="${task.id}">🗑️ Remove</button>`;
        } else {
          actionHtml = `<button class="done" disabled>✅ Signed</button>`;
        }
      } else {
        if (!isReadOnly) {
          actionHtml = `<button class="signoff-btn" data-id="${task.id}">✍ Sign Off</button>`;
        } else {
          actionHtml = `<button class="done" disabled>⏳ Pending</button>`;
        }
      }
    }

    let signoffsHtml = '';
    if (task.type === 'signoff' && task.signoffs && task.signoffs.length) {
      signoffsHtml = `<div class="task-signoffs">${task.signoffs.map(name => 
        `<span class="signoff-badge ${name === currentUser?.displayName ? 'you' : ''}">${name}</span>`
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

  if (!isReadOnly) {
    container.querySelectorAll('.complete-btn').forEach(btn => {
      btn.addEventListener('click', () => handleComplete(btn.dataset.id, docRef));
    });
    container.querySelectorAll('.signoff-btn').forEach(btn => {
      btn.addEventListener('click', () => handleSignoff(btn.dataset.id, docRef));
    });
    container.querySelectorAll('.delete-own-complete').forEach(btn => {
      btn.addEventListener('click', () => handleDeleteOwnComplete(btn.dataset.id, docRef));
    });
    container.querySelectorAll('.remove-own-signoff').forEach(btn => {
      btn.addEventListener('click', () => handleRemoveOwnSignoff(btn.dataset.id, docRef));
    });
  }

  document.querySelectorAll('.category-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      currentCategory = btn.dataset.cat;
      render();
      loadChecklistData();
    });
  });
}

// ---- Task actions ----
async function handleComplete(taskId, docRef) {
  if (isLoggedOut || !currentUser) {
    showNotification('Please log in to complete tasks.', 'error');
    return;
  }
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
    loadChecklistData();
  } catch (err) {
    showNotification('Error saving: ' + err.message, 'error');
  }
}

async function handleSignoff(taskId, docRef) {
  if (isLoggedOut || !currentUser) {
    showNotification('Please log in to sign off.', 'error');
    return;
  }
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
    loadChecklistData();
  } catch (err) {
    showNotification('Error saving: ' + err.message, 'error');
  }
}

async function handleDeleteOwnComplete(taskId, docRef) {
  if (isLoggedOut || !currentUser) {
    showNotification('Please log in to delete.', 'error');
    return;
  }
  if (!confirm('Remove your completion for this task?')) return;
  const task = getTasksByCategory(currentCategory).find(t => t.id === taskId);
  if (!task) return;
  const updateData = {
    [taskId]: {
      ...task,
      completedBy: null,
      completedAt: null,
    }
  };
  try {
    await docRef.set(updateData, { merge: true });
    showNotification(`🗑️ Removed your completion`);
    loadChecklistData();
  } catch (err) {
    showNotification('Error: ' + err.message, 'error');
  }
}

async function handleRemoveOwnSignoff(taskId, docRef) {
  if (isLoggedOut || !currentUser) {
    showNotification('Please log in to remove signoff.', 'error');
    return;
  }
  if (!confirm('Remove your signoff from this task?')) return;
  const task = getTasksByCategory(currentCategory).find(t => t.id === taskId);
  if (!task) return;
  const docSnap = await docRef.get();
  let saved = {};
  if (docSnap.exists) saved = docSnap.data();
  let signoffs = saved[taskId]?.signoffs || [];
  signoffs = signoffs.filter(name => name !== currentUser.displayName);
  const updateData = {
    [taskId]: {
      ...task,
      signoffs: signoffs,
    }
  };
  try {
    await docRef.set(updateData, { merge: true });
    showNotification(`🗑️ Removed your signoff`);
    loadChecklistData();
  } catch (err) {
    showNotification('Error: ' + err.message, 'error');
  }
}

// ================== ALLOCATION TAB (Read‑only) ==================
function renderAllocationTab() {
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
    return `<div class="empty-state">No users found. Please contact your supervisor.</div>`;
  }
  if (isLoadingData) {
    return `<div class="loading-state"><div class="spinner-small"></div>Loading allocation data…</div>`;
  }

  const staffUsers = users.filter(u => u.role !== 'supervisor' && u.role !== 'admin' && u.role !== 'manager');
  const periods = getPeriodsForShift(currentShiftSettings.shift);
  
  // Get duty data for the current shift
  const currentDuty = dutyData[currentShiftSettings.shift] || {};
  const onDutyStaff = staffUsers.filter(u => currentDuty[u.displayName] === true);
  const onDutyCount = onDutyStaff.length;

  // Get area data for the current shift
  const currentAreas = areaData[currentShiftSettings.shift] || {};
  
  // Check if any area has assignments for the current shift
  const hasAreaAssignments = AREAS.some(area => {
    for (const period of periods) {
      const assigned = currentAreas[period]?.[area] || [];
      if (assigned.length > 0) return true;
    }
    return false;
  });

  const docExists = Object.keys(dutyData).length > 0 || Object.keys(areaData).length > 0;
  let debugInfo = '';
  if (!docExists || !hasAreaAssignments) {
    debugInfo = `
      <div style="background:#fee2e2;border:1px solid #fca5a5;border-radius:0.5rem;padding:0.75rem;margin-bottom:1rem;">
        <strong style="color:#991b1b;">⚠️ No allocation data found for ${currentShiftSettings.date} · ${currentShiftSettings.shift}</strong>
        <p style="margin:0.5rem 0 0;font-size:0.85rem;color:#6b7280;">
          The supervisor may not have saved duty for this date/shift, or the shift name doesn't match.
        </p>
        <button class="btn-load" id="checkFirestoreBtn" style="margin-top:0.5rem;">🔍 Check Firestore</button>
      </div>
    `;
  }

  return `
    <div class="allocation-date-section">
      <div class="date-shift-display">
        <span class="label">📅 Date: <strong>${currentShiftSettings.date}</strong></span>
        <span class="label">🕒 Shift: <strong>${currentShiftSettings.shift}</strong></span>
        <button class="btn-load" id="refreshAllocationBtn" style="margin-left:1rem;">🔄 Refresh</button>
      </div>
      <div class="shift-indicators">
        <span class="shift-badge ${currentShiftSettings.shift === 'Morning' ? 'morning' : 'evening'}">
          ${currentShiftSettings.shift === 'Morning' ? '🌅' : '🌙'} ${currentShiftSettings.shift}
        </span>
      </div>
    </div>

    ${debugInfo}

    <div class="allocation-section">
      <div class="section-header">
        <h3>👥 Staff on Duty (${currentShiftSettings.shift})</h3>
        <span class="duty-count">${onDutyCount} staff on duty</span>
      </div>
      <div class="staff-grid">
        ${onDutyStaff.length > 0 ? onDutyStaff.map(u => `
          <span class="staff-badge">
            <span class="avatar">${getAvatar(u.displayName)}</span>
            ${u.displayName}
            <span class="status-dot on"></span>
            <span class="on-duty">On Duty</span>
          </span>
        `).join('') : '<span class="empty-state">No staff on duty for this shift.</span>'}
      </div>
    </div>

    <div class="allocation-section">
      <div class="section-header">
        <h3>🗺️ Area Assignment</h3>
      </div>
      <div class="area-matrix-wrapper">
        <table class="area-matrix">
          <thead><tr><th>Area</th>${periods.map(p => `<th>${p}</th>`).join('')}</tr></thead>
          <tbody>
            ${AREAS.map(area => {
              const isShared = SHARED_AREAS.includes(area);
              return `
                <tr>
                  <td class="area-label">${area} ${isShared ? '<span style="font-size:0.6rem;color:#6b7280;">(shared)</span>' : ''}</td>
                  ${periods.map(period => {
                    const assigned = currentAreas[period]?.[area] || [];
                    return `
                      <td>
                        <div class="area-assigned-tags">
                          ${assigned.map(name => `<span class="staff-tag">👤 ${name}</span>`).join('') || '<span class="empty-cell">—</span>'}
                        </div>
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

async function loadAllocationData() {
  if (!currentUser && !isLoggedOut) { showNotification('Please sign in first.', 'error'); return; }
  if (isLoadingData) return;
  isLoadingData = true;

  if (!users.length && !isFetchingUsers) {
    await fetchUsers();
    if (userFetchError) {
      isLoadingData = false;
      updateTabContent();
      return;
    }
  }

  const date = currentShiftSettings.date;
  const shift = currentShiftSettings.shift;

  console.log(`📥 [Staff] Loading allocation for date: ${date}, shift: ${shift}`);
  try {
    const docRef = db.collection('allocations').doc(date);
    const docSnap = await docRef.get();
    console.log(`📄 [Staff] Document exists? ${docSnap.exists}`);
    if (docSnap.exists) {
      const data = docSnap.data();
      console.log('📊 [Staff] Raw data:', data);
      
      // Get duty data for all shifts
      dutyData = data.duty || {};
      // Get area data for all shifts
      areaData = data.areas || {};
      
      console.log('✅ [Staff] dutyData:', dutyData);
      console.log('✅ [Staff] areaData:', areaData);
      
      if (dutyData[shift]) {
        const onDutyNames = Object.keys(dutyData[shift]).filter(key => dutyData[shift][key] === true);
        console.log(`✅ [Staff] On‑duty staff for "${shift}":`, onDutyNames);
      } else {
        console.warn(`⚠️ [Staff] No duty data for shift "${shift}". Available shifts:`, Object.keys(dutyData));
      }
      
      if (areaData[shift]) {
        console.log(`✅ [Staff] Area data for "${shift}":`, areaData[shift]);
      } else {
        console.warn(`⚠️ [Staff] No area data for shift "${shift}". Available shifts:`, Object.keys(areaData));
      }
    } else {
      dutyData = {};
      areaData = {};
      console.warn('⚠️ [Staff] No document found for date:', date);
      showNotification(`No allocation data found for ${date}.`, 'info');
    }
  } catch (err) {
    console.error('❌ [Staff] Error loading allocation:', err);
    showNotification('Failed to load allocation: ' + err.message, 'error');
  } finally {
    isLoadingData = false;
    updateTabContent();
  }
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
  if (isLoadingData) {
    return `<div class="loading-state"><div class="spinner-small"></div>Loading leave data…</div>`;
  }

  let entriesHtml = '';
  if (leaveEntries.length === 0) {
    entriesHtml = `<div class="empty-state">No leave entries for today.</div>`;
  } else {
    entriesHtml = `
      <table class="leave-table">
        <thead><tr><th>Staff</th><th>Type</th><th>Reason</th><th>Reported At</th></tr></thead>
        <tbody>
          ${leaveEntries.map(entry => `
            <tr>
              <td>${entry.displayName}</td>
              <td><span class="leave-type-badge ${entry.type.toLowerCase()}">${entry.type}</span></td>
              <td>${entry.reason || '—'}</td>
              <td>${entry.reportedAt || '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  return `
    <div class="leave-date-section">
      <div class="date-display">
        <span class="label">📅 Date: <strong>${currentShiftSettings.date}</strong></span>
        <span class="label">🕒 Shift: <strong>${currentShiftSettings.shift}</strong></span>
      </div>
    </div>
    <div class="allocation-section">
      <div class="section-header">
        <h3>📋 Today's Leave Entries</h3>
      </div>
      ${entriesHtml}
    </div>
  `;
}

async function loadLeaveData() {
  if (!currentUser && !isLoggedOut) { showNotification('Please sign in first.', 'error'); return; }
  if (isLoadingData) return;
  isLoadingData = true;

  if (!users.length && !isFetchingUsers) {
    await fetchUsers();
    if (userFetchError) {
      isLoadingData = false;
      updateTabContent();
      return;
    }
  }

  const date = currentShiftSettings.date;

  try {
    const docRef = db.collection('leaves').doc(date);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      leaveEntries = docSnap.data().entries || [];
    } else {
      leaveEntries = [];
    }
  } catch (err) {
    console.error('Error loading leaves:', err);
    showNotification('Failed to load leave data.', 'error');
  } finally {
    isLoadingData = false;
    updateTabContent();
  }
}

// ================== BREAK TAB ==================
function renderBreakTab() {
  if (!currentUser && !isLoggedOut) return '<div class="empty-state">Please sign in to request a break.</div>';

  const shiftDate = currentShiftSettings.date;
  const shiftName = currentShiftSettings.shift;
  const slots = getBreakSlots(shiftName);
  const slotOptions = slots.map(s => `<option value="${s}">${s}</option>`).join('');

  const isReadOnly = isLoggedOut || !currentUser;

  const formHtml = `
    <div class="break-form">
      <div class="form-group">
        <label>📅 Date</label>
        <input type="text" value="${shiftDate}" disabled />
      </div>
      <div class="form-group">
        <label>🕒 Shift</label>
        <input type="text" value="${shiftName}" disabled />
      </div>
      <div class="form-group">
        <label>⏰ Break Slot</label>
        <select id="breakSlotSelect" ${isReadOnly ? 'disabled' : ''}>
          <option value="">— Select a slot —</option>
          ${slotOptions}
        </select>
      </div>
      <div class="form-group">
        <label>Reason (optional)</label>
        <input type="text" id="breakReason" placeholder="Reason for break" maxlength="100" ${isReadOnly ? 'disabled' : ''} />
      </div>
      <button class="btn-primary" id="submitBreakBtn" ${isReadOnly ? 'disabled' : ''}>Request Break</button>
      ${isReadOnly ? '<p style="color:#888; font-size:0.8rem; margin-top:0.5rem;">🔒 Read‑only mode – you cannot request breaks.</p>' : ''}
    </div>
  `;

  const allRequests = breakRequests.filter(r => r.date === shiftDate && r.shift === shiftName);
  const requestsHtml = allRequests.length === 0 ?
    '<p class="empty-state">No break requests for this shift.</p>' :
    `<table class="break-requests-table">
      <thead><tr><th>Staff</th><th>Break Slot</th><th>Status</th><th>Reason</th><th>Action</th></tr></thead>
      <tbody>
        ${allRequests.map(r => {
          const isOwn = r.staffEmail === currentUser?.email;
          return `
            <tr>
              <td>${r.staffName}</td>
              <td>${r.breakSlot || r.startTime || '—'}</td>
              <td><span class="break-status ${r.status}">${r.status}</span></td>
              <td>${r.reason || '—'}</td>
              <td>
                ${(!isReadOnly && isOwn && r.status === 'pending') ? `<button class="delete-own-break" data-id="${r.id}">🗑️ Delete</button>` : '—'}
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>`;

  return `
    <div class="allocation-section">
      <h3>☕ Request a Break</h3>
      ${formHtml}
    </div>
    <div class="allocation-section">
      <h3>📋 All Break Requests (${shiftDate} · ${shiftName})</h3>
      ${requestsHtml}
    </div>
  `;
}

async function loadBreakData() {
  if (!currentUser && !isLoggedOut) return;

  // Load current shift settings first
  try {
    const settingsRef = db.collection('settings').doc('currentShift');
    const settingsSnap = await settingsRef.get();
    if (settingsSnap.exists) {
      currentShiftSettings = settingsSnap.data();
    } else {
      currentShiftSettings = { date: new Date().toISOString().slice(0,10), shift: 'Morning' };
    }
    console.log('📅 [Break] Current shift settings:', currentShiftSettings);
  } catch (err) {
    console.error('Error loading shift settings:', err);
  }

  try {
    const snapshot = await db.collection('break_requests')
      .where('date', '==', currentShiftSettings.date)
      .where('shift', '==', currentShiftSettings.shift)
      .get();
    breakRequests = [];
    snapshot.forEach(doc => {
      breakRequests.push({ id: doc.id, ...doc.data() });
    });
    breakRequests.sort((a, b) => (a.requestedAt < b.requestedAt ? 1 : -1));
  } catch (err) {
    console.error('Error loading break requests:', err);
    showNotification('Failed to load break requests.', 'error');
  }
  updateTabContent();
}

async function submitBreakRequest() {
  if (isLoggedOut || !currentUser) {
    showNotification('Please log in to request a break.', 'error');
    return;
  }
  const slotSelect = document.getElementById('breakSlotSelect');
  const reason = document.getElementById('breakReason').value.trim();
  const selectedSlot = slotSelect.value;
  if (!selectedSlot) {
    showNotification('Please select a break slot.', 'error');
    return;
  }

  const startTime = selectedSlot.split('-')[0];

  const requestData = {
    staffEmail: currentUser.email,
    staffName: currentUser.displayName,
    date: currentShiftSettings.date,
    shift: currentShiftSettings.shift,
    breakSlot: selectedSlot,
    startTime: startTime,
    reason: reason || '',
    status: 'pending',
    requestedAt: new Date().toISOString(),
  };

  try {
    await db.collection('break_requests').add(requestData);
    showNotification('✅ Break request submitted!', 'success');
    loadBreakData();
  } catch (err) {
    console.error('Error submitting break request:', err);
    showNotification('Failed to submit request.', 'error');
  }
}

async function deleteOwnBreakRequest(requestId) {
  if (isLoggedOut || !currentUser) {
    showNotification('Please log in to delete.', 'error');
    return;
  }
  if (!confirm('Delete your break request?')) return;
  try {
    await db.collection('break_requests').doc(requestId).delete();
    showNotification('🗑️ Break request deleted.');
    loadBreakData();
  } catch (err) {
    console.error('Error deleting break request:', err);
    showNotification('Failed to delete request.', 'error');
  }
}

function attachBreakEvents() {
  const submitBtn = document.getElementById('submitBreakBtn');
  if (submitBtn) {
    submitBtn.addEventListener('click', submitBreakRequest);
  }
  document.querySelectorAll('.delete-own-break').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      deleteOwnBreakRequest(id);
    });
  });
}

// ================== UPDATE TAB CONTENT ==================
function updateTabContent() {
  const container = document.getElementById('tabContent');
  if (!container) return;
  if (currentTab === 'checklist') {
    container.innerHTML = renderChecklistTab();
    setTimeout(() => {
      if (currentUser || isLoggedOut) loadChecklistData();
    }, 50);
  } else if (currentTab === 'allocation') {
    container.innerHTML = renderAllocationTab();
    const refreshBtn = document.getElementById('refreshAllocationBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        loadAllocationData();
      });
    }
    const checkBtn = document.getElementById('checkFirestoreBtn');
    if (checkBtn) {
      checkBtn.addEventListener('click', async () => {
        try {
          const date = currentShiftSettings.date;
          const docRef = db.collection('allocations').doc(date);
          const docSnap = await docRef.get();
          if (docSnap.exists) {
            const data = docSnap.data();
            console.log('🔍 [Check Firestore] Document data:', data);
            const shifts = Object.keys(data.duty || {});
            const areas = Object.keys(data.areas || {});
            showNotification(`✅ Document exists! Shifts: ${shifts.join(', ')}. Check console for details.`, 'success');
          } else {
            console.warn('🔍 [Check Firestore] No document for date:', date);
            showNotification(`❌ No document found for ${date}.`, 'error');
          }
        } catch (err) {
          console.error('🔍 [Check Firestore] Error:', err);
          showNotification('Error checking Firestore: ' + err.message, 'error');
        }
      });
    }
  } else if (currentTab === 'leaves') {
    container.innerHTML = renderLeaveTab();
  } else if (currentTab === 'break') {
    container.innerHTML = renderBreakTab();
    setTimeout(attachBreakEvents, 50);
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

// ================== AUTHENTICATION ==================
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
    fetchUsers().then(() => { showAuthModal(); });
    return;
  }
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'userModal';
  const allUsers = users;
  if (!allUsers.length) {
    alert('No accounts found. Please contact your administrator.');
    return;
  }
  const options = allUsers.map(u => `<option value="${u.email}">${u.displayName || u.email}</option>`).join('');
  overlay.innerHTML = `
    <div class="modal-box">
      <h2>🔐 Staff Sign In</h2>
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
      isLoggedOut = false;
      localStorage.setItem('checklist_user', JSON.stringify({ email: user.email }));
      errorMsg.style.display = 'none';
      overlay.remove();
      render();
      showNotification(`Welcome, ${user.displayName || user.email}!`);
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
    } else {
      currentShiftSettings = { date: new Date().toISOString().slice(0,10), shift: 'Morning' };
    }
    console.log('📅 [Init] Current shift settings:', currentShiftSettings);
  } catch (err) {
    console.error('Error loading shift settings:', err);
  }

  await fetchUsers();

  const stored = localStorage.getItem('checklist_user');
  if (stored && !isLoggedOut) {
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
  render();
}

init();
