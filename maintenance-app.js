// ========== MAINTENANCE APP WITH FIREBASE ==========
let reports = [];
let isLoading = false;

function getCurrentFormattedDateTime() {
    const now = new Date();
    return now.toLocaleString();
}

function getCurrentISODateTime() {
    return new Date().toISOString();
}

function formatDisplayDateTime(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString();
    } catch(e) {
        return iso;
    }
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

// ========== FIREBASE OPERATIONS ==========

// Save report to Firebase
async function saveReportToFirebase(reportData) {
    try {
        const docRef = await db.collection(COLLECTION_NAME).add({
            ...reportData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log("Report saved with ID: ", docRef.id);
        return { success: true, id: docRef.id };
    } catch (error) {
        console.error("Error saving report: ", error);
        return { success: false, error: error.message };
    }
}

// Fetch all reports from Firebase
async function fetchReportsFromFirebase() {
    try {
        showLoading(true);
        const snapshot = await db.collection(COLLECTION_NAME)
            .orderBy("createdAt", "desc")
            .get();
        
        const fetchedReports = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            fetchedReports.push({
                firebaseId: doc.id,
                id: data.id || doc.id,
                type: data.type,
                description: data.description,
                priority: data.priority,
                informedBy: data.informedBy,
                status: data.status || "pending",
                entryTimestamp: data.entryTimestamp,
                hubStaffName: data.hubStaffName,
                hubEntryTime: data.hubEntryTime,
                directDepartment: data.directDepartment,
                directStaffName: data.directStaffName,
                directInfoTime: data.directInfoTime,
                resolvedBy: data.resolvedBy,
                resolvedDate: data.resolvedDate,
                resolutionNote: data.resolutionNote
            });
        });
        
        reports = fetchedReports;
        renderTable();
        updateStats();
        updateSyncStatus(true, `${fetchedReports.length} records loaded`);
        return { success: true, data: fetchedReports };
    } catch (error) {
        console.error("Error fetching reports: ", error);
        updateSyncStatus(false, error.message);
        return { success: false, error: error.message };
    } finally {
        showLoading(false);
    }
}

// Update report status in Firebase
async function updateReportStatusInFirebase(firebaseId, newStatus) {
    try {
        await db.collection(COLLECTION_NAME).doc(firebaseId).update({
            status: newStatus,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error("Error updating status: ", error);
        return { success: false, error: error.message };
    }
}

// Resolve report in Firebase
async function resolveReportInFirebase(firebaseId, resolvedBy, resolutionNote) {
    try {
        await db.collection(COLLECTION_NAME).doc(firebaseId).update({
            status: "resolved",
            resolvedBy: resolvedBy,
            resolvedDate: getCurrentISODateTime(),
            resolutionNote: resolutionNote,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error("Error resolving report: ", error);
        return { success: false, error: error.message };
    }
}

// Delete report from Firebase
async function deleteReportFromFirebase(firebaseId) {
    try {
        await db.collection(COLLECTION_NAME).doc(firebaseId).delete();
        return { success: true };
    } catch (error) {
        console.error("Error deleting report: ", error);
        return { success: false, error: error.message };
    }
}

// ========== CORE APP FUNCTIONS ==========

async function addReport(data) {
    const newReport = {
        id: generateId(),
        type: data.type,
        description: data.description.trim(),
        priority: data.priority,
        informedBy: data.informedBy.trim(),
        status: "pending",
        entryTimestamp: getCurrentISODateTime(),
        resolvedBy: null,
        resolvedDate: null,
        resolutionNote: null
    };
    
    if (data.type === "hub") {
        newReport.hubStaffName = data.hubStaffName.trim();
        newReport.hubEntryTime = getCurrentISODateTime();
        newReport.directDepartment = null;
        newReport.directStaffName = null;
        newReport.directInfoTime = null;
    } else {
        newReport.directDepartment = data.directDepartment.trim();
        newReport.directStaffName = data.directStaffName.trim();
        newReport.directInfoTime = getCurrentISODateTime();
        newReport.hubStaffName = null;
        newReport.hubEntryTime = null;
    }
    
    // Save to Firebase
    const result = await saveReportToFirebase(newReport);
    if (result.success) {
        // Refresh data from Firebase to get latest
        await fetchReportsFromFirebase();
        return true;
    } else {
        alert("Error saving to Firebase: " + result.error);
        return false;
    }
}

async function updateStatus(id, newStatus) {
    const report = reports.find(r => r.id === id || r.firebaseId === id);
    if (report && report.status !== "resolved") {
        const firebaseId = report.firebaseId;
        const result = await updateReportStatusInFirebase(firebaseId, newStatus);
        if (result.success) {
            await fetchReportsFromFirebase();
        } else {
            alert("Error updating status: " + result.error);
        }
    }
}

async function resolveReportAction(id, resolver, note) {
    const report = reports.find(r => r.id === id || r.firebaseId === id);
    if (report && report.status !== "resolved") {
        const firebaseId = report.firebaseId;
        const result = await resolveReportInFirebase(firebaseId, resolver.trim(), note || "Resolved");
        if (result.success) {
            await fetchReportsFromFirebase();
        } else {
            alert("Error resolving report: " + result.error);
        }
    }
}

async function deleteReportAction(id) {
    if (confirm("Delete this report from Firebase?")) {
        const report = reports.find(r => r.id === id || r.firebaseId === id);
        if (report) {
            const firebaseId = report.firebaseId;
            const result = await deleteReportFromFirebase(firebaseId);
            if (result.success) {
                await fetchReportsFromFirebase();
            } else {
                alert("Error deleting: " + result.error);
            }
        }
    }
}

// ========== UI RENDERING ==========

function getPriorityHtml(p) {
    let cls = p === "High" ? "priority-high" : (p === "Medium" ? "priority-medium" : "priority-low");
    return `<span class="priority-tag ${cls}">${p}</span>`;
}

function getTypeHtml(type) {
    if (type === "hub") return `<span class="type-badge type-hub"><i class="fas fa-building"></i> Hub Entry</span>`;
    return `<span class="type-badge type-direct"><i class="fas fa-bell"></i> Direct Inform</span>`;
}

function getDetailCell(r) {
    if (r.type === "hub") {
        return `<div style="font-size:0.75rem;">
                    <strong><i class="fas fa-user-check"></i> Entered:</strong> ${escapeHtml(r.hubStaffName || '—')}<br>
                    <span class="timestamp-sm"><i class="fas fa-clock"></i> ${formatDisplayDateTime(r.hubEntryTime)}</span>
                </div>`;
    } else {
        return `<div style="font-size:0.75rem;">
                    <strong><i class="fas fa-building"></i> Dept:</strong> ${escapeHtml(r.directDepartment || '—')}<br>
                    <strong><i class="fas fa-user"></i> Staff:</strong> ${escapeHtml(r.directStaffName || '—')}<br>
                    <span class="timestamp-sm"><i class="fas fa-clock"></i> ${formatDisplayDateTime(r.directInfoTime)}</span>
                </div>`;
    }
}

function getEntryInfoCell(r) {
    return `<div style="font-size:0.7rem;">
                <span class="timestamp-sm">Reported: ${formatDisplayDateTime(r.entryTimestamp)}</span>
            </div>`;
}

function getStatusHtml(s) {
    if (s === "resolved") return `<span class="status-tag status-resolved"><i class="fas fa-check-circle"></i> Resolved</span>`;
    if (s === "in-progress") return `<span class="status-tag status-progress"><i class="fas fa-sync-alt"></i> In Progress</span>`;
    return `<span class="status-tag status-pending"><i class="fas fa-clock"></i> Pending</span>`;
}

function getResolutionCell(r) {
    if (r.status === "resolved" && r.resolvedBy) {
        return `<div style="font-size:0.7rem;">
                    <i class="fas fa-user-check"></i> ${escapeHtml(r.resolvedBy)}<br>
                    <i class="fas fa-calendar"></i> ${formatDisplayDateTime(r.resolvedDate)}<br>
                    <small>${escapeHtml(r.resolutionNote?.substring(0,25)||'')}</small>
                </div>`;
    }
    return `<span style="color:#aaa;">—</span>`;
}

function renderTable() {
    const tbody = document.getElementById("tableBody");
    if (!tbody) return;
    
    if (reports.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" class="empty-state">No reports in Firebase. Click "New Report" to add.</td></tr>`;
        return;
    }
    
    let html = "";
    for (let rep of reports) {
        let shortDesc = rep.description?.length > 45 ? rep.description.substring(0,42)+"..." : rep.description || '';
        html += `<tr>
                    <td><span class="timestamp-sm">${formatDisplayDateTime(rep.entryTimestamp)}</span></td>
                    <td title="${escapeHtml(rep.description)}">${escapeHtml(shortDesc)}</td>
                    <td>${getPriorityHtml(rep.priority)}</td>
                    <td>${getTypeHtml(rep.type)}</td>
                    <td>${getDetailCell(rep)}</td>
                    <td><i class="fas fa-user-edit"></i> ${escapeHtml(rep.informedBy)}</td>
                    <td>${getEntryInfoCell(rep)}</td>
                    <td>${getStatusHtml(rep.status)}</td>
                    <td class="action-icons">`;
        
        if (rep.status !== "resolved") {
            if (rep.status === "pending") {
                html += `<button class="action-icon" data-action="start" data-id="${rep.id}"><i class="fas fa-play"></i> Start</button>`;
            } else if (rep.status === "in-progress") {
                html += `<button class="action-icon" data-action="resolvePrompt" data-id="${rep.id}"><i class="fas fa-check-double"></i> Resolve</button>`;
                html += `<button class="action-icon" data-action="back" data-id="${rep.id}"><i class="fas fa-undo"></i> Back</button>`;
            }
        } else {
            html += `<span style="font-size:0.7rem;">✓ Closed</span>`;
        }
        html += `<button class="action-icon" data-action="delete" data-id="${rep.id}"><i class="fas fa-trash"></i> Del</button>`;
        html += `</td></tr>`;
    }
    tbody.innerHTML = html;
    attachTableEvents();
}

function attachTableEvents() {
    document.querySelectorAll("[data-action='start']").forEach(btn => {
        btn.addEventListener("click", () => updateStatus(btn.dataset.id, "in-progress"));
    });
    document.querySelectorAll("[data-action='back']").forEach(btn => {
        btn.addEventListener("click", () => updateStatus(btn.dataset.id, "pending"));
    });
    document.querySelectorAll("[data-action='resolvePrompt']").forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.dataset.id;
            let resolver = prompt("Resolved by (staff name):", "Technician");
            if (resolver && resolver.trim()) {
                let note = prompt("Resolution notes:", "Issue resolved");
                resolveReportAction(id, resolver.trim(), note || "Resolved");
            }
        });
    });
    document.querySelectorAll("[data-action='delete']").forEach(btn => {
        btn.addEventListener("click", () => deleteReportAction(btn.dataset.id));
    });
}

function updateStats() {
    document.getElementById("totalCount").innerText = reports.length;
    document.getElementById("openCount").innerText = reports.filter(r => r.status !== "resolved").length;
    document.getElementById("resolvedCount").innerText = reports.filter(r => r.status === "resolved").length;
}

function updateSyncStatus(connected, message = "") {
    const statusEl = document.getElementById("syncStatus");
    if (connected) {
        statusEl.innerHTML = `<i class="fas fa-check-circle" style="color:#22c55e;"></i> Firebase Connected | ${message}`;
    } else {
        statusEl.innerHTML = `<i class="fas fa-exclamation-triangle" style="color:#e74c3c;"></i> Firebase Error: ${message}`;
    }
}

function showLoading(show) {
    const loadingEl = document.getElementById("loadingIndicator");
    const tableBody = document.getElementById("tableBody");
    if (show) {
        if (loadingEl) loadingEl.style.display = "block";
        if (tableBody) tableBody.innerHTML = '';
    } else {
        if (loadingEl) loadingEl.style.display = "none";
    }
}

function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));
}

// ========== MODAL LOGIC ==========
const modal = document.getElementById("entryModal");
const openBtn = document.getElementById("openPopupBtn");
const refreshBtn = document.getElementById("refreshBtn");
const closeBtn = document.getElementById("closeModalBtn");
const cancelBtn = document.getElementById("cancelModalBtn");
const submitBtn = document.getElementById("submitModalBtn");
const typeHub = document.getElementById("typeHub");
const typeDirect = document.getElementById("typeDirect");
const hubPanel = document.getElementById("hubPanel");
const directPanel = document.getElementById("directPanel");
const hubAutoTime = document.getElementById("hubAutoTime");
const directAutoTime = document.getElementById("directAutoTime");
const liveSpan = document.getElementById("liveDateTime");

function updateLiveTime() {
    const now = getCurrentFormattedDateTime();
    if (liveSpan) liveSpan.innerText = now;
    if (hubAutoTime) hubAutoTime.value = now;
    if (directAutoTime) directAutoTime.value = now;
}
setInterval(updateLiveTime, 1000);
updateLiveTime();

function togglePanels() {
    if (typeHub.checked) {
        hubPanel.classList.remove("hidden");
        directPanel.classList.add("hidden");
    } else if (typeDirect.checked) {
        directPanel.classList.remove("hidden");
        hubPanel.classList.add("hidden");
    } else {
        hubPanel.classList.add("hidden");
        directPanel.classList.add("hidden");
    }
    updateLiveTime();
}

typeHub.addEventListener("change", togglePanels);
typeDirect.addEventListener("change", togglePanels);

function resetModal() {
    document.getElementById("modalDescription").value = "";
    document.getElementById("modalPriority").value = "Medium";
    document.getElementById("modalInformedBy").value = "";
    document.getElementById("hubStaffName").value = "";
    document.getElementById("directDepartment").value = "";
    document.getElementById("directStaffName").value = "";
    typeHub.checked = false;
    typeDirect.checked = false;
    togglePanels();
    updateLiveTime();
}

function openModal() {
    resetModal();
    modal.classList.add("active");
    updateLiveTime();
}

function closeModal() {
    modal.classList.remove("active");
}

openBtn.addEventListener("click", openModal);
if (refreshBtn) {
    refreshBtn.addEventListener("click", () => fetchReportsFromFirebase());
}
closeBtn.addEventListener("click", closeModal);
cancelBtn.addEventListener("click", closeModal);
modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
});

submitBtn.addEventListener("click", async () => {
    const description = document.getElementById("modalDescription").value.trim();
    const priority = document.getElementById("modalPriority").value;
    const informedBy = document.getElementById("modalInformedBy").value.trim();
    
    if (!description) { alert("Enter issue description."); return; }
    if (!informedBy) { alert("Enter 'Informed By' name."); return; }
    
    if (typeHub.checked) {
        const hubStaffName = document.getElementById("hubStaffName").value.trim();
        if (!hubStaffName) { alert("Hub Entry: Enter staff name."); return; }
        await addReport({ type: "hub", description, priority, informedBy, hubStaffName });
    } 
    else if (typeDirect.checked) {
        const directDepartment = document.getElementById("directDepartment").value.trim();
        const directStaffName = document.getElementById("directStaffName").value.trim();
        if (!directDepartment) { alert("Direct Inform: Enter department."); return; }
        if (!directStaffName) { alert("Direct Inform: Enter staff name."); return; }
        await addReport({ type: "direct", description, priority, informedBy, directDepartment, directStaffName });
    }
    else {
        alert("Select report type: Hub Entry or Direct Inform.");
        return;
    }
    closeModal();
});

// Initialize: Fetch data from Firebase on load
fetchReportsFromFirebase();
