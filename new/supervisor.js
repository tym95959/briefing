// ============================================================
// GLOBALS
// ============================================================
let currentMode = 'local'; // 'local' or 'multiple'
let manifestEntries = [];
let processingEntries = [];
let failedEntries = [];
let nextId = 1;
let isGuestModeActive = false;
let pendingGuestParentId = null;
let currentShiftData = { date: '', shift: '', status: '' };
let currentUser = { name: 'OPERATOR', username: 'operator', rcno: 'N/A', level: 'OPERATOR' };
let currentTab = 'manifest';
let rtdbRef = null;
let fieldHistory = new Map();
let editingCell = null;
let savingPasses = [];

// ===== CHAT ALERT VARIABLES =====
let chatAlertListener = null;
let unreadChatCount = 0;
let chatAlertContainer = null;
let notifiedMessages = new Set();

// ===== FOCUS MANAGEMENT VARIABLES =====
let isProcessingAction = false;
let activeEditableCell = null;
let isEditingCell = false;

// ===== CACHE SYSTEMS =====
const flightStatusCache = new Map();
const duplicateCache = new Map();
const FLIGHT_CACHE_DURATION = 30000; // 30 seconds
const DUPLICATE_CACHE_DURATION = 5000; // 5 seconds

// ============================================================
// HELPER FUNCTIONS
// ============================================================
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}

function getAirlineName(iataCode) {
    if (!iataCode) return '';
    const code = iataCode.toUpperCase();
    if (window.airlineData && window.airlineData.airlines_flying_to_maldives) {
        const found = window.airlineData.airlines_flying_to_maldives.find(a => a.iata === code);
        if (found) return found.airline;
        return code;
    }
    return code;
}

function getAirlineFromFlight(flightNo) {
    if (!flightNo) return '';
    const match = String(flightNo).match(/^([A-Z]{2})/);
    return match ? match[1] : '';
}

function getAirlineDisplay(iataCode) {
    if (!iataCode) return '—';
    return getAirlineName(iataCode) || iataCode;
}

function calculatePax(seatNo, passengerName) {
    if (passengerName && String(passengerName).toLowerCase().includes('delay')) return 0;
    if (!seatNo) return 1;
    const letters = (String(seatNo).match(/[A-Za-z]/g) || []);
    return Math.max(1, letters.length);
}

function generateId() {
    return Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

function getCurrentEntryTime() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('extractStatus');
    if (!statusEl) return;
    statusEl.className = `status-badge ${type}`;
    statusEl.innerHTML = message;
}

function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

// ============================================================
// FOCUS MANAGEMENT
// ============================================================
function focusToCodeInput(selectText = true) {
    if (isEditingCell || isEditingManifestField()) {
        return;
    }
    const input = document.getElementById('codeInput');
    if (input && document.activeElement !== input) {
        input.focus();
        if (selectText) {
            input.select();
        }
    }
}

function isEditingManifestField() {
    const active = document.activeElement;
    if (active && active.classList && active.classList.contains('editable-cell')) {
        return true;
    }
    return activeEditableCell !== null && document.activeElement === activeEditableCell;
}

// ============================================================
// USER SESSION
// ============================================================
function getUserSession() {
    try {
        const loggedInUser = localStorage.getItem('loggedInUser');
        if (loggedInUser) {
            const parsed = JSON.parse(loggedInUser);
            if (parsed.username || parsed.userName || parsed.name) {
                return {
                    username: parsed.username || parsed.userName || parsed.name || 'Guest',
                    name: parsed.name || parsed.userName || parsed.username || 'Guest',
                    level: parsed.level || parsed.Level || 'operator',
                    right: parsed.right || parsed.Right || parsed.level || 'operator',
                    rcno: parsed.rcno || parsed.RCNo || parsed.employeeId || 'N/A'
                };
            }
        }
        const username = localStorage.getItem('username') ||
                        localStorage.getItem('userName') ||
                        localStorage.getItem('name');
        const level = localStorage.getItem('level') ||
                      localStorage.getItem('right') ||
                      localStorage.getItem('userLevel') ||
                      'operator';
        const rcno = localStorage.getItem('rcno') ||
                     localStorage.getItem('RCNo') ||
                     localStorage.getItem('employeeId') ||
                     'N/A';
        if (username) {
            return {
                username: username,
                name: localStorage.getItem('name') || username,
                level: level,
                right: level,
                rcno: rcno
            };
        }
        const currentUser = localStorage.getItem('currentUser');
        if (currentUser) {
            const parsed = JSON.parse(currentUser);
            if (parsed.username || parsed.name) {
                return {
                    username: parsed.username || parsed.name,
                    name: parsed.name || parsed.username,
                    level: parsed.level || parsed.right || 'operator',
                    right: parsed.right || parsed.level || 'operator',
                    rcno: parsed.rcno || 'N/A'
                };
            }
        }
        return { username: 'Guest', name: 'Guest', level: 'guest', right: 'guest', rcno: 'N/A' };
    } catch (e) {
        return { username: 'Guest', name: 'Guest', level: 'guest', right: 'guest', rcno: 'N/A' };
    }
}

function isShiftActive() {
    return currentShiftData.shift === 'MORNING' || currentShiftData.shift === 'EVENING';
}

// ============================================================
// FIREBASE DATABASE ROUTING
// ============================================================
function getFirestoreForFlight(flightNo) {
    if (!flightNo) return window.defaultCardDb;
    const prefix = String(flightNo).substring(0, 2).toUpperCase();
    if (prefix === 'DE' || prefix === 'OS' || prefix === 'WK' || prefix === 'NO') return window.deoswknoDb;
    if (prefix === 'MU' || prefix === 'VS' || prefix === 'SU' || prefix === 'KC') return window.muvssukcDb;
    if (prefix === 'EY' || prefix === 'FZ' || prefix === 'TK' || prefix === 'MH') return window.eyfztkmhDb;
    if (prefix === 'BA') return window.baDb;
    if (prefix === 'EK') return window.ekDb;
    if (prefix === 'QR') return window.qrDb;
    if (prefix === 'SQ') return window.sqDb;
    return window.defaultCardDb;
}

function getFirestoreNameForFlight(flightNo) {
    if (!flightNo) return "Default DB";
    const prefix = String(flightNo).substring(0, 2).toUpperCase();
    if (prefix === 'DE' || prefix === 'OS' || prefix === 'WK' || prefix === 'NO') return "DE/OS/WK/NO DB";
    if (prefix === 'MU' || prefix === 'VS' || prefix === 'SU' || prefix === 'KC') return "MU/VS/SU/KC DB";
    if (prefix === 'EY' || prefix === 'FZ' || prefix === 'TK' || prefix === 'MH') return "EY/FZ/TK/MH DB";
    if (prefix === 'BA') return "BA DB";
    if (prefix === 'EK') return "EK DB";
    if (prefix === 'QR') return "QR DB";
    if (prefix === 'SQ') return "SQ DB";
    return "Default DB";
}

// ============================================================
// FLIGHT STATUS CHECK FROM RTDB (with cache)
// ============================================================
async function checkFlightStatus(flightNo) {
    if (currentMode !== 'multiple' || !window.rtdb) {
        return { isClosed: false, status: 'open' };
    }
    
    const cacheKey = flightNo.toUpperCase().trim();
    const cached = flightStatusCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < FLIGHT_CACHE_DURATION)) {
        return cached.data;
    }
    
    try {
        const snapshot = await window.rtdb.ref('flightStatus')
            .child(cacheKey)
            .once('value');
        
        const data = snapshot.val();
        let result = { isClosed: false, status: 'open' };
        
        if (data?.closed === true || data?.status === 'closed') {
            result = { isClosed: true, status: 'closed', closedAt: data.closedAt };
        }
        
        flightStatusCache.set(cacheKey, {
            data: result,
            timestamp: Date.now()
        });
        
        return result;
        
    } catch (error) {
        console.warn('Flight status check failed:', error);
        return { isClosed: false, status: 'open' };
    }
}

// ============================================================
// OPTIMIZED DUPLICATE CHECK (1 Firestore read with index)
// ============================================================
async function checkDuplicateSeat(flightNo, seatNo, excludeId = null, date = null) {
    const today = date || getTodayDate();
    const normalizedFlight = (flightNo || '').toUpperCase().trim();
    const normalizedSeat = (seatNo || '').toUpperCase().trim();
    const cacheKey = `${normalizedFlight}_${normalizedSeat}_${today}`;
    
    // STEP 1: Check cache (0 reads)
    const cached = duplicateCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < DUPLICATE_CACHE_DURATION)) {
        return cached.result;
    }
    
    // STEP 2: Check local manifest (0 reads)
    const localDuplicate = manifestEntries.some(entry => {
        if (excludeId !== null && entry.id === excludeId) return false;
        const entryDate = entry.timestamp ? entry.timestamp.split('T')[0] : today;
        return (entry.flightNo || '').toUpperCase().trim() === normalizedFlight &&
               (entry.seatNo || '').toUpperCase().trim() === normalizedSeat &&
               entryDate === today;
    });
    
    if (localDuplicate) {
        const entry = manifestEntries.find(e => 
            (e.flightNo || '').toUpperCase().trim() === normalizedFlight &&
            (e.seatNo || '').toUpperCase().trim() === normalizedSeat &&
            (e.timestamp ? e.timestamp.split('T')[0] : today) === today
        );
        const result = { duplicate: true, source: 'manifest', entry: entry };
        duplicateCache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
    }
    
    // STEP 3: Check processing entries (0 reads)
    const processingDuplicate = processingEntries.some(entry => {
        if (excludeId !== null && entry.id === excludeId) return false;
        const entryDate = entry.timestamp ? entry.timestamp.split('T')[0] : today;
        return (entry.flightNo || '').toUpperCase().trim() === normalizedFlight &&
               (entry.seatNo || '').toUpperCase().trim() === normalizedSeat &&
               entryDate === today;
    });
    
    if (processingDuplicate) {
        const entry = processingEntries.find(e => 
            (e.flightNo || '').toUpperCase().trim() === normalizedFlight &&
            (e.seatNo || '').toUpperCase().trim() === normalizedSeat &&
            (e.timestamp ? e.timestamp.split('T')[0] : today) === today
        );
        const result = { duplicate: true, source: 'processing', entry: entry };
        duplicateCache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
    }
    
    // STEP 4: Check RTDB manifest (1 read)
    if (currentMode === 'multiple' && window.rtdb) {
        try {
            const snapshot = await window.rtdb.ref('passengerManifest_v2/manifest')
                .orderByChild('flightNo')
                .equalTo(normalizedFlight)
                .once('value');
            
            const data = snapshot.val();
            if (data) {
                for (const [key, entry] of Object.entries(data)) {
                    if (excludeId !== null && entry.id === excludeId) continue;
                    const entryDate = entry.timestamp ? entry.timestamp.split('T')[0] : today;
                    if (entryDate === today && 
                        entry.seatNo && entry.seatNo.toUpperCase().trim() === normalizedSeat) {
                        const result = { duplicate: true, source: 'rtdb', entry: entry };
                        duplicateCache.set(cacheKey, { result, timestamp: Date.now() });
                        return result;
                    }
                }
            }
        } catch (error) {
            console.warn('RTDB duplicate check failed:', error);
        }
    }
    
    // STEP 5: Check Firestore (1 read with limit(1) + index)
    if (currentMode === 'multiple') {
        try {
            const db = getFirestoreForFlight(normalizedFlight);
            if (db) {
                const querySnapshot = await db.collection('KoveliPass')
                    .where('flightNo', '==', normalizedFlight)
                    .where('seatNo', '==', normalizedSeat)
                    .where('date', '==', today)
                    .limit(1)
                    .get();
                
                if (!querySnapshot.empty) {
                    const doc = querySnapshot.docs[0];
                    const data = doc.data();
                    const result = { 
                        duplicate: true, 
                        source: 'firestore', 
                        entry: {
                            passengerName: data.pName || data.passengerName || 'Unknown',
                            flightNo: data.flightNo,
                            seatNo: data.seatNo,
                            date: data.date,
                            docId: doc.id
                        }
                    };
                    
                    duplicateCache.set(cacheKey, { result, timestamp: Date.now() });
                    return result;
                }
            }
        } catch (error) {
            console.warn('Firestore duplicate check failed:', error);
        }
    }
    
    // No duplicate found
    const result = { duplicate: false };
    duplicateCache.set(cacheKey, { result, timestamp: Date.now() });
    return result;
}

// ============================================================
// EXTRACT FQTV
// ============================================================
function extractFQTV(codeInput, flightNoPart, isM1orM2) {
    let fqtvValue = '';
    const trimmedCode = codeInput.trim();
    const words = trimmedCode.split(' ').filter(w => w.trim() !== '');
    const flightNoWord = words.find(w => /^[A-Z]{2}\d+[A-Z]?$/.test(w)) || flightNoPart;
    const flightPrefix = flightNoWord ? flightNoWord.substring(0, 2) : '';

    if (flightPrefix === 'EK') {
        const partnerFQTVMatch = trimmedCode.match(/\s+([A-Z]{2})\s+(\d{6,})/);
        if (partnerFQTVMatch) fqtvValue = partnerFQTVMatch[1] + '-' + partnerFQTVMatch[2];
    } else if (flightPrefix === 'QR') {
        const partnerFQTVMatch = trimmedCode.match(/ ([A-Z]{2}) (\d{6,})(?:\s+(N[0123]))?/);
        if (partnerFQTVMatch) {
            const airlineCode = partnerFQTVMatch[1];
            const number = partnerFQTVMatch[2];
            const cardS = partnerFQTVMatch[3];
            if (airlineCode === 'QR' && cardS === 'N1') fqtvValue = airlineCode + '-' + number + '/P';
            else if (airlineCode === 'QR' && cardS === 'N2') fqtvValue = airlineCode + '-' + number + '/G';
            else if (airlineCode === 'QR' && cardS === 'N3') fqtvValue = airlineCode + '-' + number + '/S';
            else if (airlineCode != 'QR' && cardS === 'N1') fqtvValue = airlineCode + '-' + number + '/EMER';
            else if (airlineCode != 'QR' && cardS === 'N2') fqtvValue = airlineCode + '-' + number + '/SAPP';
        }
    } else if (flightPrefix === 'BA') {
        const partnerFQTVMatch = trimmedCode.match(/ ([A-Z]{2}) (\d{6,})(?:\s+(Y[0123]))?/);
        if (partnerFQTVMatch) {
            const airlineCode = partnerFQTVMatch[1];
            const number = partnerFQTVMatch[2];
            const cardS = partnerFQTVMatch[3];
            if (airlineCode === 'BA' && cardS === 'Y1') fqtvValue = airlineCode + '-' + number + '/G';
            else if (airlineCode === 'BA' && cardS === 'Y2') fqtvValue = airlineCode + '-' + number + '/S';
            else if (airlineCode != 'BA' && cardS === 'Y1') fqtvValue = airlineCode + '-' + number + '/EMER';
            else if (airlineCode != 'BA' && cardS === 'Y2') fqtvValue = airlineCode + '-' + number + '/SAPP';
        }
    } else if (flightPrefix === 'MH') {
        const partnerFQTVMatch = trimmedCode.match(/ ([A-Z]{2}) (\d{6,})(?:\s+(Y[0123]))?/);
        if (partnerFQTVMatch) {
            const airlineCode = partnerFQTVMatch[1];
            const number = partnerFQTVMatch[2];
            const cardS = partnerFQTVMatch[3];
            if (airlineCode === 'MH' && cardS === 'Y1') fqtvValue = airlineCode + '-' + number + '/P';
            else if (airlineCode === 'MH' && cardS === 'Y2') fqtvValue = airlineCode + '-' + number + '/G';
            else if (airlineCode === 'MH' && cardS === 'Y3') fqtvValue = airlineCode + '-' + number + '/S';
            else if (airlineCode !== 'MH' && cardS === 'Y1') fqtvValue = airlineCode + '-' + number + '/PLAT';
            else if (airlineCode !== 'MH' && cardS === 'Y2') fqtvValue = airlineCode + '-' + number + '/SAPP';
            else if (airlineCode !== 'MH' && cardS === 'Y3') fqtvValue = "";
        }
    } else if (['FZ','OS','EY','SU','VS','KC','DE','NO','WK','SV'].includes(flightPrefix)) {
        const partnerFQTVMatch = trimmedCode.match(/ ([A-Z]{2}) (\d{6,})/);
        if (partnerFQTVMatch) fqtvValue = partnerFQTVMatch[1] + '-' + partnerFQTVMatch[2];
    } else if (flightPrefix === 'UL') {
        const partnerFQTVMatch = trimmedCode.match(/ ([A-Z]{2}) (\d{6,})/);
        const words = trimmedCode.trim().split(/\s+/);
        const thirdLastWord = words[words.length - 3] || '';
        const firstFive = thirdLastWord.slice(0, 5);
        const result = firstFive.slice(1);
        if (partnerFQTVMatch) fqtvValue = partnerFQTVMatch[1] + '-' + partnerFQTVMatch[2] + '/' + result;
    }
    return fqtvValue;
}

// ============================================================
// BOARDING PASS PARSING
// ============================================================
function runOriginalParsing(inputCodeValue) {
    let inputCode = String(inputCodeValue).toUpperCase().replace(/\s+/g, ' ').trim();
    if (!inputCode.trim()) return { success: false, error: 'Empty code' };

    const isTKVCPO = inputCode.startsWith('TKVCPO');
    const isMFormat = inputCode.startsWith('M1') || inputCode.startsWith('M2') || inputCode.startsWith('M');

    if (isTKVCPO) {
        const tk07Position = inputCode.search(/TK07|TK69/);
        const mlePosition = inputCode.indexOf('MLE');
        if (tk07Position === -1) {
            return { success: false, error: 'TKVCPO MUST CONTAIN TK07' };
        }

        let namePart = inputCode.substring(6, tk07Position).trim();
        let flightNoPart = inputCode.length > tk07Position + 4 ? inputCode.substring(tk07Position, tk07Position + 6) : '';
        let airline = flightNoPart && flightNoPart.length >= 2
            ? getAirlineName(flightNoPart.substring(0, 2))
            : 'TURKISH AIRLINES';

        let seatNo = '';
        let classChar = 'Y';
        if (mlePosition !== -1 && inputCode.length > mlePosition + 11) {
            seatNo = (inputCode.charAt(mlePosition + 8) || '') +
                     (inputCode.charAt(mlePosition + 9) || '') +
                     (inputCode.charAt(mlePosition + 10) || '');
            classChar = inputCode.charAt(mlePosition + 11) || 'Y';
        }

        let pName = namePart.replace(/[^A-Z\s]/g, '').trim();
        if (!pName || pName.length < 2) pName = 'PASSENGER';

        const pax = calculatePax(seatNo, pName);

        return {
            success: true,
            pnr: 'TKVCPO',
            passengerName: pName,
            flightNo: flightNoPart || 'UNKNOWN',
            classCode: classChar,
            seatNo: seatNo || '-',
            airlineCode: flightNoPart ? flightNoPart.substring(0, 2) : 'TK',
            fqtvValue: '',
            serialNo: '',
            pax: pax,
            rawCode: inputCodeValue
        };
    }

    const mleWord = /MLE[A-Z0-9]{5}/i;
    const match = mleWord.exec(inputCode);
    if (!match) return { success: false, error: 'No valid PNR found' };

    const fullMatch = match[0];
    const endIndex = match.index + fullMatch.length;
    const textAfter = inputCode.substring(endIndex);
    const phrases = textAfter.trim().split(/\s+/);
    const firstTwoLetters = inputCode.substring(0, 2);
    const textBeforePNR = inputCode.substring(0, match.index - 8).trim();
    const rawPNR = inputCode.substring(0, match.index).replace(/\s/g, '').slice(-6);
    const PNR = rawPNR.length === 7 ? rawPNR.slice(0) : rawPNR;

    let passengerName = '';
    let flightNo = '';
    let airlineCode = '';
    let classCode = 'Y';
    let seatNo = '';
    let fqtvValue = '';
    let serialNo = '';

    if (firstTwoLetters === 'M1' || firstTwoLetters === 'M2') {
        passengerName = textBeforePNR.substring(2).trim();
    } else if (firstTwoLetters === 'M ') {
        passengerName = inputCode.substring(1, match.index).trim();
    } else {
        passengerName = textBeforePNR;
    }
    if (!passengerName || passengerName.length < 2) {
        const nameMatch = inputCode.match(/^([A-Z\/\s]{3,20})/);
        if (nameMatch) passengerName = nameMatch[1].trim();
    }

    let flightCode = match[0].slice(-2);
    const flightNumber = inputCode.substring(endIndex, endIndex + 10).replace(/\s/g, '').slice(0, -4);
    flightNo = flightCode + flightNumber;
    airlineCode = flightCode;

    const isM1orM2 = firstTwoLetters === 'M1' || firstTwoLetters === 'M2';
    const classCodes = ['F','C','J','Y','S','W','P','A','D','I','Z','O','E','B','H','K','L','M','N','Q','R','T','U','V','X'];

    if (isM1orM2 && inputCode.length > match.index + fullMatch.length + 3) {
        const afterMLE = inputCode.substring(match.index + fullMatch.length);
        const parts = afterMLE.split(' ').filter(p => p.trim() !== '');
        let seatString = '';
        for (let part of parts) {
            if (/^\d{3}[A-Z]\d{3}[A-Z]\d{4}$/.test(part)) {
                seatString = part;
                break;
            }
        }
        if (!seatString) {
            for (let part of parts) {
                if (part.length >= 13 && /[A-Z]/.test(part) && /\d/.test(part)) {
                    seatString = part;
                    break;
                }
            }
        }
        if (seatString) {
            seatNo = seatString.substring(5, seatString.length - 4);
            const potentialClass = seatString.charAt(3);
            if (classCodes.includes(potentialClass)) {
                classCode = potentialClass;
            }
        }
    } else {
        for (const phrase of phrases) {
            const clean = phrase.replace(/\s/g, '');
            for (const cls of classCodes) {
                if (clean === cls || (clean.endsWith(cls) && clean.length <= 3)) {
                    classCode = cls;
                    break;
                }
            }
            if (classCode !== 'Y') break;
        }
    }

    const pax = calculatePax(seatNo, passengerName);
    fqtvValue = extractFQTV(inputCode, flightNo, isM1orM2);

    const etktMatch = inputCode.match(/ETKT[:\s]*(\d{13,14})/i);
    if (etktMatch) serialNo = etktMatch[1];
    if (!serialNo) {
        const tktMatch = inputCode.match(/TKT[:\s]*(\d{13,14})/i);
        if (tktMatch) serialNo = tktMatch[1];
    }
    if (!serialNo) {
        const ticketMatch = inputCode.match(/\b(\d{13,14})\b/);
        if (ticketMatch) serialNo = ticketMatch[1];
    }
    if (!serialNo) {
        const airlineTicketMatch = inputCode.match(/[A-Z]{2,3}(\d{10,13})/);
        if (airlineTicketMatch) serialNo = airlineTicketMatch[0];
    }

    return {
        success: true,
        pnr: PNR,
        passengerName: passengerName || '',
        flightNo: flightNo || '',
        classCode: classCode || 'Y',
        seatNo: seatNo || '',
        airlineCode: airlineCode || '',
        fqtvValue: fqtvValue || '',
        serialNo: serialNo || '',
        pax: pax,
        rawCode: inputCodeValue
    };
}

// ============================================================
// DUPLICATE CHECK (Basic)
// ============================================================
function isDuplicateEntry(flightNo, passengerName, seatNo, excludeId, entriesList) {
    const today = getTodayDate();
    const normalizedFlight = (flightNo || '').toUpperCase().trim();
    const normalizedName = (passengerName || '').toUpperCase().trim();
    const normalizedSeat = (seatNo || '').toUpperCase().trim();
    return entriesList.some(entry => {
        if (excludeId !== null && entry.id === excludeId) return false;
        const entryDate = entry.timestamp ? entry.timestamp.split('T')[0] : today;
        return (entry.flightNo || '').toUpperCase().trim() === normalizedFlight &&
            (entry.passengerName || '').toUpperCase().trim() === normalizedName &&
            (entry.seatNo || '').toUpperCase().trim() === normalizedSeat &&
            entryDate === today;
    });
}

// ============================================================
// DATA PERSISTENCE
// ============================================================
function saveToLocalStorage() {
    const data = { manifest: manifestEntries, processing: processingEntries, failed: failedEntries, nextId: nextId };
    localStorage.setItem('passengerManifest_v2', JSON.stringify(data));
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem('passengerManifest_v2');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            manifestEntries = parsed.manifest || [];
            processingEntries = parsed.processing || [];
            failedEntries = parsed.failed || [];
            nextId = parsed.nextId || 1;
        } catch (e) {
            manifestEntries = [];
            processingEntries = [];
            failedEntries = [];
        }
    } else {
        manifestEntries = [];
        processingEntries = [];
        failedEntries = [];
    }
    manifestEntries = manifestEntries.filter(e => e !== null);
    processingEntries = processingEntries.filter(e => e !== null);
    failedEntries = failedEntries.filter(e => e !== null);
}

function clearLocalStorage() {
    localStorage.removeItem('passengerManifest_v2');
    manifestEntries = [];
    processingEntries = [];
    failedEntries = [];
    nextId = 1;
}

// ===== REALTIME DB =====
async function initRTDB() {
    if (!window.rtdb) return false;
    try {
        rtdbRef = window.rtdb.ref('passengerManifest_v2');
        return true;
    } catch (e) { return false; }
}

async function saveToFirebaseRTDB() {
    if (!rtdbRef) await initRTDB();
    if (!rtdbRef) return false;
    try {
        await rtdbRef.set({
            manifest: manifestEntries,
            processing: processingEntries,
            failed: failedEntries,
            nextId: nextId,
            updatedAt: firebase.database.ServerValue.TIMESTAMP
        });
        return true;
    } catch (e) { return false; }
}

async function loadFromFirebaseRTDB() {
    if (!rtdbRef) await initRTDB();
    if (!rtdbRef) return;
    try {
        const snapshot = await rtdbRef.once('value');
        const data = snapshot.val();
        if (data) {
            manifestEntries = data.manifest || [];
            processingEntries = data.processing || [];
            failedEntries = data.failed || [];
            nextId = data.nextId || 1;
        } else {
            manifestEntries = [];
            processingEntries = [];
            failedEntries = [];
        }
        manifestEntries = manifestEntries.filter(e => e !== null);
        processingEntries = processingEntries.filter(e => e !== null);
        failedEntries = failedEntries.filter(e => e !== null);
    } catch (e) {
        manifestEntries = [];
        processingEntries = [];
        failedEntries = [];
    }
}

function listenToFirebaseChanges() {
    if (!window.rtdb) return;
    window.rtdb.ref('passengerManifest_v2').on('value', (snapshot) => {
        if (currentMode === 'multiple') {
            const data = snapshot.val();
            if (data) {
                manifestEntries = data.manifest || [];
                processingEntries = data.processing || [];
                failedEntries = data.failed || [];
                nextId = data.nextId || 1;
                updateTabCounts();
                if (currentTab === 'manifest') renderManifestTable();
                else if (currentTab === 'processing') renderProcessingTable();
                else if (currentTab === 'failed') renderFailedList();
            }
        }
    });
}

async function saveData() {
    if (currentMode === 'local') {
        saveToLocalStorage();
        return true;
    } else {
        return await saveToFirebaseRTDB();
    }
}

// ============================================================
// GUEST MODE
// ============================================================
function showGuestModeBanner() {
    document.getElementById('guestModeBanner').classList.add('visible');
}

function hideGuestModeBanner() {
    document.getElementById('guestModeBanner').classList.remove('visible');
}

function closeGuestMode() {
    isGuestModeActive = false;
    pendingGuestParentId = null;
    hideGuestModeBanner();
    showStatus('👋 Guest mode closed.', 'info');
    setTimeout(() => {
        showStatus('', '');
        focusToCodeInput(true);
    }, 2000);
}

function canAddGuest(entry) {
    const hasFqtv = entry.fqtvValue && String(entry.fqtvValue).trim() !== '' && !String(entry.fqtvValue).startsWith('👥');
    const isFirstClassEK = (entry.classCode === 'F' || entry.classCode === 'F ') && entry.airlineCode === 'EK';
    return hasFqtv || isFirstClassEK;
}

function addGuestForParent(parentId) {
    const parentEntry = manifestEntries.find(e => e.id == parentId);
    if (!parentEntry) return;
    if (!canAddGuest(parentEntry)) {
        showStatus(`❌ Cannot add guest: ${parentEntry.passengerName} requires FQTV or First Class EK`, 'error');
        setTimeout(() => {
            showStatus('', '');
            focusToCodeInput(true);
        }, 3000);
        return;
    }
    pendingGuestParentId = parentEntry.id;
    isGuestModeActive = true;
    showGuestModeBanner();
    showStatus(`👥 Guest mode ACTIVE for ${parentEntry.passengerName}`, 'warning');
    document.getElementById('codeInput').focus();
    document.getElementById('codeInput').value = '';
    focusToCodeInput(true);
}

// ============================================================
// CORE OPERATIONS
// ============================================================
// ===== OPTIMISTIC EXTRACT & ADD (INSTANT MANIFEST) =====
async function extractAndAdd() {
    if (!isShiftActive()) {
        showStatus('❌ No active shift.', 'error');
        focusToCodeInput(true);
        return false;
    }

    const rawCode = document.getElementById('codeInput').value;
    if (!rawCode.trim()) {
        focusToCodeInput(true);
        return false;
    }

    const result = runOriginalParsing(rawCode);
    if (!result.success) {
        showStatus(`❌ ${result.error}`, 'error');
        document.getElementById('codeInput').value = '';
        focusToCodeInput(true);
        return false;
    }

    // ===== OPTIMISTIC UI: ADD IMMEDIATELY =====
    let finalFqtv = result.fqtvValue || '';
    let isGuest = false;
    if (isGuestModeActive && pendingGuestParentId) {
        isGuest = true;
        const parent = manifestEntries.find(e => e.id === pendingGuestParentId);
        finalFqtv = `👥 Guest of ${parent ? parent.seatNo || 'Unknown' : 'Unknown'}`;
    }

    const newEntry = {
        id: nextId++,
        pnr: result.pnr || '',
        passengerName: result.passengerName || '',
        flightNo: result.flightNo || '',
        classCode: result.classCode || 'Y',
        seatNo: result.seatNo || '',
        airlineCode: result.airlineCode || '',
        fqtvValue: finalFqtv,
        guestOf: isGuest ? pendingGuestParentId : null,
        pax: result.pax || 1,
        serialNo: result.serialNo || '',
        rawCode: rawCode,
        timestamp: new Date().toISOString(),
        scannedBy: getUserSession()?.username || 'Unknown',
        _validating: true   // mark as being validated
    };

    manifestEntries.unshift(newEntry);
    document.getElementById('codeInput').value = '';
    renderManifestTable();
    updateTabCounts();
    switchTab('manifest');

    // ===== BACKGROUND VALIDATION (no UI blocking) =====
    setTimeout(async () => {
        try {
            // 1. Check flight status
            const flightStatus = await checkFlightStatus(result.flightNo);
            if (flightStatus.isClosed) {
                // Move to failed
                const idx = manifestEntries.findIndex(e => e.id === newEntry.id);
                if (idx !== -1) {
                    const removed = manifestEntries.splice(idx, 1)[0];
                    failedEntries.push({
                        ...removed,
                        errorMessage: `Flight ${result.flightNo} is CLOSED`,
                        failedAt: new Date().toISOString()
                    });
                }
                await saveData();
                renderManifestTable();
                renderFailedList();
                updateTabCounts();
                showStatus(`❌ Flight ${result.flightNo} is CLOSED – moved to Failed`, 'error');
                return;
            }

            // 2. Check duplicate seat (remote only – local already checked)
            const duplicateCheck = await checkDuplicateSeat(result.flightNo, result.seatNo, newEntry.id);
            if (duplicateCheck.duplicate) {
                const idx = manifestEntries.findIndex(e => e.id === newEntry.id);
                if (idx !== -1) {
                    const removed = manifestEntries.splice(idx, 1)[0];
                    failedEntries.push({
                        ...removed,
                        errorMessage: `SEAT ${result.seatNo} on ${result.flightNo} (${getTodayDate()}) is OCCUPIED by ${duplicateCheck.entry?.passengerName || 'Unknown'}`,
                        failedAt: new Date().toISOString()
                    });
                }
                await saveData();
                renderManifestTable();
                renderFailedList();
                updateTabCounts();
                showStatus(`❌ Seat occupied – moved to Failed`, 'error');
                return;
            }

            // 3. Exact duplicate (local)
            if (isDuplicateEntry(result.flightNo, result.passengerName, result.seatNo, newEntry.id, manifestEntries)) {
                const idx = manifestEntries.findIndex(e => e.id === newEntry.id);
                if (idx !== -1) {
                    const removed = manifestEntries.splice(idx, 1)[0];
                    failedEntries.push({
                        ...removed,
                        errorMessage: `Duplicate entry for ${result.passengerName}`,
                        failedAt: new Date().toISOString()
                    });
                }
                await saveData();
                renderManifestTable();
                renderFailedList();
                updateTabCounts();
                showStatus(`❌ Duplicate entry – moved to Failed`, 'error');
                return;
            }

            // ✅ All checks passed – remove validation flag and save
            const entryInManifest = manifestEntries.find(e => e.id === newEntry.id);
            if (entryInManifest) {
                delete entryInManifest._validating;
                await saveData();
                renderManifestTable();
                showStatus(`✅ ${result.passengerName} added successfully (validated)`, 'success');
            }

        } catch (err) {
            console.error('Background validation error:', err);
            const idx = manifestEntries.findIndex(e => e.id === newEntry.id);
            if (idx !== -1) {
                const removed = manifestEntries.splice(idx, 1)[0];
                failedEntries.push({
                    ...removed,
                    errorMessage: `Validation error: ${err.message || 'Unknown'}`,
                    failedAt: new Date().toISOString()
                });
                await saveData();
                renderManifestTable();
                renderFailedList();
                updateTabCounts();
                showStatus(`❌ Validation error – moved to Failed`, 'error');
            }
        }
    }, 0);

    // Immediately show success (optimistic)
    if (isGuest && pendingGuestParentId) {
        const parent = manifestEntries.find(e => e.id === pendingGuestParentId);
        showStatus(`👥 Guest added for ${parent ? parent.passengerName : 'Unknown'} – validating...`, 'success');
        pendingGuestParentId = null;
        isGuestModeActive = false;
        hideGuestModeBanner();
    } else {
        showStatus(`✅ ${result.passengerName} added – validating in background...`, 'success');
    }

    setTimeout(() => {
        showStatus('', '');
        focusToCodeInput(true);
    }, 3000);

    focusToCodeInput(true);
    return true;
}

// ============================================================
// RENDER MANIFEST WITH DUPLICATE BADGE & VALIDATING INDICATOR
// ============================================================
function renderManifestTable() {
    const tbody = document.getElementById('manifestBody');
    if (!tbody) return;
    
    if (!manifestEntries.length) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="10">— no entries — paste a boarding pass code —</td></tr>';
        return;
    }
    
    // Build a map of flight+seat+date combinations to check for duplicates
    const seatMap = new Map();
    const today = getTodayDate();
    
    // First pass: count occurrences of each flight+seat combination for today
    for (const entry of manifestEntries) {
        const entryDate = entry.timestamp ? entry.timestamp.split('T')[0] : today;
        if (entryDate === today) {
            const key = `${entry.flightNo}_${entry.seatNo}`;
            seatMap.set(key, (seatMap.get(key) || 0) + 1);
        }
    }
    
    let html = '';
    for (const entry of manifestEntries) {
        const entryDate = entry.timestamp ? entry.timestamp.split('T')[0] : today;
        const key = `${entry.flightNo}_${entry.seatNo}`;
        const count = seatMap.get(key) || 0;
        const isDuplicate = count > 1 && entryDate === today;
        
        const canGuest = canAddGuest(entry);
        const airlineDisplay = getAirlineDisplay(entry.airlineCode);
        const fqtvDisplay = entry.fqtvValue || '—';
        const serialDisplay = entry.serialNo || '—';
        const isSpecial = ['BA', 'EK', 'QR', 'SQ'].includes(entry.airlineCode);
        const badgeColor = entry.airlineCode === 'BA' ? '#c9a352' :
            entry.airlineCode === 'EK' ? '#1a5c9e' :
            entry.airlineCode === 'QR' ? '#8a1538' :
            entry.airlineCode === 'SQ' ? '#0066b3' : '';
        
        // Show validating badge if _validating flag is true
        const validatingBadge = entry._validating ? 
            `<span class="validating-badge" style="background:#ffa500;color:white;padding:1px 8px;border-radius:30px;font-size:9px;font-weight:700;margin-left:6px;">⏳ validating...</span>` : '';
        
        html += `
            <tr data-id="${entry.id}" ${isSpecial ? `style="border-left:3px solid ${badgeColor};"` : ''}>
                <td style="text-align:center;">
                    <button class="guest-add-btn" id="guest-btn-${entry.id}" ${!canGuest ? 'disabled' : ''} title="Add guest for this passenger">+</button>
                </td>
                <td class="editable-cell" id="name-${entry.id}" contenteditable="true" tabindex="0" style="cursor:text;min-width:150px;padding:4px 8px;border-radius:4px;transition:background 0.2s;user-select:text;" data-field="passengerName" data-id="${entry.id}">
                    ${escapeHtml(entry.passengerName)}
                    ${isSpecial ? `<span class="airline-badge" style="background:${badgeColor};margin-left:6px;">${entry.airlineCode}</span>` : ''}
                    ${isDuplicate ? `<span class="duplicate-badge" style="background:#ff4444;color:white;padding:1px 8px;border-radius:30px;font-size:9px;font-weight:700;margin-left:6px;">⚠️ DUPLICATE</span>` : ''}
                    ${validatingBadge}
                </td>
                <td class="editable-cell" id="flight-${entry.id}" contenteditable="true" tabindex="0" style="cursor:text;padding:4px 8px;border-radius:4px;transition:background 0.2s;user-select:text;" data-field="flightNo" data-id="${entry.id}">${escapeHtml(entry.flightNo)}</td>
                <td class="editable-cell" id="seat-${entry.id}" contenteditable="true" tabindex="0" style="cursor:text;padding:4px 8px;border-radius:4px;transition:background 0.2s;user-select:text;" data-field="seatNo" data-id="${entry.id}">
                    ${escapeHtml(entry.seatNo)}
                    ${isDuplicate ? `<span class="duplicate-badge" style="background:#ff4444;color:white;padding:1px 8px;border-radius:30px;font-size:9px;font-weight:700;margin-left:6px;">⚠️ DUPLICATE</span>` : ''}
                </td>
                <td><span class="pax-badge" id="pax-${entry.id}">${entry.pax}</span></td>
                <td class="editable-cell" id="class-${entry.id}" contenteditable="true" tabindex="0" style="cursor:text;font-weight:700;color:#2d2412;padding:4px 8px;border-radius:4px;transition:background 0.2s;user-select:text;" data-field="classCode" data-id="${entry.id}">${escapeHtml(entry.classCode || 'Y')}</td>
                <td class="editable-cell" id="serial-${entry.id}" contenteditable="true" tabindex="0" style="cursor:text;padding:4px 8px;border-radius:4px;transition:background 0.2s;user-select:text;" data-field="serialNo" data-id="${entry.id}">${escapeHtml(serialDisplay)}</td>
                <td><span id="airline-${entry.id}">${airlineDisplay}</span></td>
                <td class="editable-cell" id="fqtv-${entry.id}" contenteditable="true" tabindex="0" style="cursor:text;padding:4px 8px;border-radius:4px;transition:background 0.2s;user-select:text;" data-field="fqtvValue" data-id="${entry.id}">${escapeHtml(fqtvDisplay)}</td>
                <td>
                    <div class="action-cell">
                        <button class="table-action-btn table-approve" id="approve-${entry.id}">✓ Approve</button>
                        <button class="table-action-btn table-delete" id="delete-${entry.id}">🗑</button>
                    </div>
                </td>
            </tr>
        `;
    }
    tbody.innerHTML = html;
    attachManifestEvents();
}

// ============================================================
// APPROVE (WITH CHECKS)
// ============================================================
async function approveEntry(id) {
    // Save any active inline edit immediately
    if (activeEditableCell) {
        const cell = activeEditableCell;
        const field = cell.dataset.field;
        const entryId = parseInt(cell.dataset.id);
        const newVal = cell.innerText.trim();
        await saveFieldLive(entryId, field, newVal);
        activeEditableCell = null;
        isEditingCell = false;
    }

    isProcessingAction = true;
    try {
        const entryIndex = manifestEntries.findIndex(e => e.id === id);
        if (entryIndex === -1) {
            isProcessingAction = false;
            return;
        }
        const entry = manifestEntries[entryIndex];
        
        // ============================================================
        // 🔴 CRITICAL: RE-CHECK BEFORE APPROVING
        // ============================================================
        
        // 1. CHECK FLIGHT STATUS (again)
        const flightStatus = await checkFlightStatus(entry.flightNo);
        if (flightStatus.isClosed) {
            // Move to failed with reason
            manifestEntries.splice(entryIndex, 1);
            const failedEntry = { 
                ...entry, 
                errorMessage: `Flight ${entry.flightNo} is CLOSED. Cannot approve.`, 
                failedAt: new Date().toISOString() 
            };
            failedEntries.push(failedEntry);
            await saveData();
            renderManifestTable();
            renderFailedList();
            updateTabCounts();
            showStatus(`❌ ${entry.passengerName}: Flight ${entry.flightNo} is CLOSED`, 'error');
            isProcessingAction = false;
            focusToCodeInput(true);
            return;
        }
        
        // 2. CHECK FOR DUPLICATE SEAT (again)
        const duplicateCheck = await checkDuplicateSeat(entry.flightNo, entry.seatNo, entry.id);
        if (duplicateCheck.duplicate) {
            // Move to failed with reason
            manifestEntries.splice(entryIndex, 1);
            const existingPassenger = duplicateCheck.entry?.passengerName || 'Unknown';
            const source = duplicateCheck.source || 'unknown';
            const failedEntry = { 
                ...entry, 
                errorMessage: `SEAT ${entry.seatNo} on ${entry.flightNo} (${getTodayDate()}) is OCCUPIED by ${existingPassenger}. Found in: ${source}`, 
                failedAt: new Date().toISOString() 
            };
            failedEntries.push(failedEntry);
            await saveData();
            renderManifestTable();
            renderFailedList();
            updateTabCounts();
            showStatus(`❌ ${entry.passengerName}: Seat ${entry.seatNo} is OCCUPIED by ${existingPassenger}`, 'error');
            isProcessingAction = false;
            focusToCodeInput(true);
            return;
        }
        
        // 3. CHECK EXACT DUPLICATE (again)
        if (isDuplicateEntry(entry.flightNo, entry.passengerName, entry.seatNo, entry.id, manifestEntries)) {
            manifestEntries.splice(entryIndex, 1);
            const failedEntry = { 
                ...entry, 
                errorMessage: `Duplicate entry exists for ${entry.passengerName} on ${getTodayDate()}`, 
                failedAt: new Date().toISOString() 
            };
            failedEntries.push(failedEntry);
            await saveData();
            renderManifestTable();
            renderFailedList();
            updateTabCounts();
            showStatus(`❌ Duplicate entry exists for ${entry.passengerName}`, 'error');
            isProcessingAction = false;
            focusToCodeInput(true);
            return;
        }
        
        // ============================================================
        // ✅ ALL CHECKS PASSED - PROCEED WITH APPROVAL
        // ============================================================
        
        // Remove from manifest
        manifestEntries.splice(entryIndex, 1);
        
        const db = getFirestoreForFlight(entry.flightNo);
        if (!db) {
            const failedEntry = { 
                ...entry, 
                errorMessage: `No database configured for airline: ${entry.airlineCode}`, 
                failedAt: new Date().toISOString() 
            };
            failedEntries.push(failedEntry);
            await saveData();
            renderManifestTable();
            renderFailedList();
            updateTabCounts();
            showStatus(`❌ ${entry.passengerName}: Database not available`, 'error');
            isProcessingAction = false;
            focusToCodeInput(true);
            return;
        }
        
        const processingEntry = { 
            ...entry, 
            processingStatus: 'saving', 
            saveAttempts: 0
        };
        processingEntries.push(processingEntry);
        await saveData();
        renderManifestTable();
        renderProcessingTable();
        updateTabCounts();
        
        // Save to Firestore
        await saveToFirestore(processingEntry.id);
        
        focusToCodeInput(true);
    } finally {
        isProcessingAction = false;
    }
}

// ----- BATCH APPROVE (WITH CHECKS) -----
async function approveMultipleEntries(ids) {
    if (!ids || ids.length === 0) return;
    
    if (activeEditableCell) {
        const cell = activeEditableCell;
        const field = cell.dataset.field;
        const entryId = parseInt(cell.dataset.id);
        const newVal = cell.innerText.trim();
        await saveFieldLive(entryId, field, newVal);
        activeEditableCell = null;
        isEditingCell = false;
    }
    
    isProcessingAction = true;
    try {
        const entriesToProcess = [];
        const entriesToFail = [];
        const validationErrors = [];
        
        // Process all entries - validate and remove from manifest
        for (const id of ids) {
            const entryIndex = manifestEntries.findIndex(e => e.id === id);
            if (entryIndex === -1) continue;
            
            const entry = manifestEntries[entryIndex];
            
            // 1. Check flight status
            const flightStatus = await checkFlightStatus(entry.flightNo);
            if (flightStatus.isClosed) {
                manifestEntries.splice(entryIndex, 1);
                const failedEntry = { 
                    ...entry, 
                    errorMessage: `Flight ${entry.flightNo} is CLOSED. Cannot approve.`, 
                    failedAt: new Date().toISOString() 
                };
                failedEntries.push(failedEntry);
                validationErrors.push(`${entry.passengerName}: Flight ${entry.flightNo} is CLOSED`);
                continue;
            }
            
            // 2. Check duplicate seat
            const duplicateCheck = await checkDuplicateSeat(entry.flightNo, entry.seatNo, entry.id);
            if (duplicateCheck.duplicate) {
                manifestEntries.splice(entryIndex, 1);
                const existingPassenger = duplicateCheck.entry?.passengerName || 'Unknown';
                const source = duplicateCheck.source || 'unknown';
                const failedEntry = { 
                    ...entry, 
                    errorMessage: `SEAT ${entry.seatNo} on ${entry.flightNo} (${getTodayDate()}) is OCCUPIED by ${existingPassenger}. Found in: ${source}`, 
                    failedAt: new Date().toISOString() 
                };
                failedEntries.push(failedEntry);
                validationErrors.push(`${entry.passengerName}: Seat ${entry.seatNo} is OCCUPIED by ${existingPassenger}`);
                continue;
            }
            
            // 3. Check exact duplicate
            if (isDuplicateEntry(entry.flightNo, entry.passengerName, entry.seatNo, entry.id, manifestEntries)) {
                manifestEntries.splice(entryIndex, 1);
                const failedEntry = { 
                    ...entry, 
                    errorMessage: `Duplicate entry exists for ${entry.passengerName} on ${getTodayDate()}`, 
                    failedAt: new Date().toISOString() 
                };
                failedEntries.push(failedEntry);
                validationErrors.push(`Duplicate entry exists for ${entry.passengerName}`);
                continue;
            }
            
            // 4. Check database availability
            const db = getFirestoreForFlight(entry.flightNo);
            if (!db) {
                manifestEntries.splice(entryIndex, 1);
                const failedEntry = { 
                    ...entry, 
                    errorMessage: `No database configured for airline: ${entry.airlineCode}`, 
                    failedAt: new Date().toISOString() 
                };
                failedEntries.push(failedEntry);
                validationErrors.push(`${entry.passengerName}: No database configured`);
                continue;
            }
            
            // ✅ All checks passed - remove from manifest and add to processing
            manifestEntries.splice(entryIndex, 1);
            entriesToProcess.push(entry);
        }
        
        // Show validation errors if any
        if (validationErrors.length > 0) {
            showStatus(`⚠️ ${validationErrors.length} entries failed validation: ${validationErrors.join('; ')}`, 'warning');
        }
        
        // ONE RTDB WRITE for all valid entries
        if (entriesToProcess.length > 0) {
            for (const entry of entriesToProcess) {
                processingEntries.push({ 
                    ...entry, 
                    processingStatus: 'saving', 
                    saveAttempts: 0
                });
            }
            
            await saveData();
            renderManifestTable();
            renderProcessingTable();
            updateTabCounts();
            
            // N FIRESTORE WRITES (one per passenger)
            for (const entry of entriesToProcess) {
                await saveToFirestore(entry.id);
            }
        }
        
        if (entriesToFail.length > 0 || validationErrors.length > 0) {
            await saveData();
            renderFailedList();
            renderManifestTable();
            updateTabCounts();
        }
        
        if (entriesToProcess.length > 0) {
            showStatus(`✅ ${entriesToProcess.length} passengers approved successfully!`, 'success');
        }
        
        focusToCodeInput(true);
    } finally {
        isProcessingAction = false;
    }
}

// ----- SAVE TO FIRESTORE -----
async function saveToFirestore(processingId) {
    const entryIndex = processingEntries.findIndex(e => e.id === processingId);
    if (entryIndex === -1) return false;
    
    const entry = processingEntries[entryIndex];
    const db = getFirestoreForFlight(entry.flightNo);
    
    if (!db) {
        processingEntries.splice(entryIndex, 1);
        const failedEntry = { 
            ...entry, 
            errorMessage: `Database not available for airline: ${entry.airlineCode}`, 
            failedAt: new Date().toISOString() 
        };
        failedEntries.push(failedEntry);
        await saveData();
        renderProcessingTable();
        renderFailedList();
        updateTabCounts();
        return false;
    }
    
    entry.saveAttempts = (entry.saveAttempts || 0) + 1;
    renderProcessingTable();
    
    try {
        const user = getUserSession();
        const now = new Date();
        const shiftDate = currentShiftData.date || now.toISOString().split('T')[0];
        const shiftName = currentShiftData.shift || 'UNKNOWN';
        
        const passengerData = {
            airline: getAirlineDisplay(entry.airlineCode),
            class: entry.classCode || '',
            date: shiftDate,
            enteredAt: now.toISOString(),
            enteredBy: user?.name || user?.username || 'Unknown',
            enteredByRCNo: user?.rcno || 'N/A',
            enteredByUsername: user?.username || 'Unknown',
            entryTime: getCurrentEntryTime(),
            flightNo: entry.flightNo || '',
            hiddenCode: entry.rawCode || '',
            isGuest: entry.guestOf !== null && entry.guestOf !== undefined,
            mainPassengerId: entry.guestOf || null,
            mainPassengerName: null,
            mainPassengerSeat: null,
            pName: entry.passengerName || '',
            pax: String(entry.pax || 1),
            remarks: '',
            seatNo: entry.seatNo || '',
            serialNo: entry.serialNo || '',
            shift: shiftName === 'MORNING' ? 'MORNING' : (shiftName === 'EVENING' ? 'EVENING' : 'UNKNOWN'),
            shiftDate: shiftDate,
            FQTV: entry.fqtvValue || '',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        const docRef = await db.collection('KoveliPass').add(passengerData);
        console.log(`✅ ${entry.airlineCode} passenger saved to Firestore: ${docRef.id}`);
        
        processingEntries.splice(entryIndex, 1);
        await saveData();
        
        renderProcessingTable();
        updateTabCounts();
        showStatus(`✅ ${entry.passengerName} saved to Firestore successfully!`, 'success');
        
        if (processingEntries.length > 0) {
            setTimeout(async () => {
                const nextEntry = processingEntries[0];
                if (nextEntry) {
                    await saveToFirestore(nextEntry.id);
                }
            }, 500);
        }
        
        return true;
        
    } catch (error) {
        const errorMessage = error.message || 'Unknown error';
        console.error("Firestore save error:", error);
        
        processingEntries.splice(entryIndex, 1);
        const failedEntry = { 
            ...entry, 
            errorMessage: `Firestore save failed: ${errorMessage}`, 
            failedAt: new Date().toISOString() 
        };
        failedEntries.push(failedEntry);
        await saveData();
        
        renderProcessingTable();
        renderFailedList();
        updateTabCounts();
        showStatus(`❌ Failed to save ${entry.passengerName} to Firestore: ${errorMessage}`, 'error');
        return false;
    }
}

// ----- RETRY FAILED -----
async function retryFailedEntry(id) {
    const entryIndex = failedEntries.findIndex(e => e.id === id);
    if (entryIndex === -1) return;
    
    const entry = failedEntries[entryIndex];
    failedEntries.splice(entryIndex, 1);
    
    const processingEntry = { 
        ...entry, 
        processingStatus: 'saving', 
        saveAttempts: (entry.saveAttempts || 0) + 1 
    };
    processingEntries.push(processingEntry);
    await saveData();
    
    renderFailedList();
    renderProcessingTable();
    updateTabCounts();
    switchTab('processing');
    
    await saveToFirestore(processingEntry.id);
}

// ----- DELETE FUNCTIONS -----
async function deleteManifestEntry(id) {
    if (confirm('Delete this entry from manifest?')) {
        manifestEntries = manifestEntries.filter(e => e.id !== id);
        await saveData();
        renderManifestTable();
        updateTabCounts();
        focusToCodeInput(true);
    }
}

async function deleteProcessingEntry(id) {
    if (confirm('Cancel saving this entry?')) {
        processingEntries = processingEntries.filter(e => e.id !== id);
        await saveData();
        renderProcessingTable();
        updateTabCounts();
        focusToCodeInput(true);
    }
}

async function deleteFailedEntry(id) {
    if (confirm('Delete this failed entry?')) {
        failedEntries = failedEntries.filter(e => e.id !== id);
        await saveData();
        renderFailedList();
        updateTabCounts();
        focusToCodeInput(true);
    }
}

async function clearAllManifest() {
    if (manifestEntries.length > 0 && confirm('Clear ALL entries from manifest?')) {
        manifestEntries = [];
        await saveData();
        renderManifestTable();
        updateTabCounts();
        focusToCodeInput(true);
    }
}

async function clearAllProcessing() {
    if (processingEntries.length > 0 && confirm('Clear ALL processing entries?')) {
        processingEntries = [];
        await saveData();
        renderProcessingTable();
        updateTabCounts();
        focusToCodeInput(true);
    }
}

async function clearAllFailed() {
    if (failedEntries.length > 0 && confirm('Clear ALL failed entries?')) {
        failedEntries = [];
        await saveData();
        renderFailedList();
        updateTabCounts();
        focusToCodeInput(true);
    }
}

// ============================================================
// LIVE FIELD EDIT
// ============================================================
async function saveFieldLive(id, field, value) {
    const entryIndex = manifestEntries.findIndex(e => e.id === id);
    if (entryIndex === -1) return;
    const entry = manifestEntries[entryIndex];
    const oldValue = entry[field];
    
    if (field === 'seatNo' || field === 'flightNo') {
        const flightNo = field === 'flightNo' ? value : entry.flightNo;
        const seatNo = field === 'seatNo' ? value : entry.seatNo;
        
        const localDuplicate = manifestEntries.some(e => {
            if (e.id === id) return false;
            const eDate = e.timestamp ? e.timestamp.split('T')[0] : getTodayDate();
            return (e.flightNo || '').toUpperCase().trim() === (flightNo || '').toUpperCase().trim() &&
                   (e.seatNo || '').toUpperCase().trim() === (seatNo || '').toUpperCase().trim() &&
                   eDate === getTodayDate();
        });
        
        if (localDuplicate) {
            showStatus(`❌ Seat ${seatNo} on flight ${flightNo} (${getTodayDate()}) is already occupied!`, 'error');
            setTimeout(() => {
                showStatus('', '');
            }, 3000);
            renderManifestTable();
            return;
        }
    }
    
    entry[field] = value;
    if (field === 'seatNo') {
        entry.pax = calculatePax(value, entry.passengerName);
        const paxSpan = document.getElementById(`pax-${id}`);
        if (paxSpan) paxSpan.innerText = entry.pax;
    }
    if (field === 'flightNo') {
        const newAirlineCode = getAirlineFromFlight(value);
        entry.airlineCode = newAirlineCode;
        const airlineSpan = document.getElementById(`airline-${id}`);
        if (airlineSpan) airlineSpan.innerText = getAirlineDisplay(newAirlineCode);
    }
    
    if (isDuplicateEntry(entry.flightNo, entry.passengerName, entry.seatNo, id, manifestEntries)) {
        entry[field] = oldValue;
        if (field === 'seatNo') entry.pax = calculatePax(oldValue, entry.passengerName);
        if (field === 'flightNo') entry.airlineCode = getAirlineFromFlight(oldValue);
        showStatus('❌ Duplicate entry exists!', 'error');
        setTimeout(() => {
            showStatus('', '');
        }, 2000);
        renderManifestTable();
        return;
    }
    await saveData();
    renderManifestTable();
    updateTabCounts();
    showStatus(`✅ ${field} updated`, 'success');
    setTimeout(() => {
        showStatus('', '');
    }, 1500);
}

// ============================================================
// PROCESSING TABLE RENDER
// ============================================================
function renderProcessingTable() {
    const tbody = document.getElementById('processingBody');
    if (!tbody) return;
    if (!processingEntries.length) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="9">— no items processing —</td></tr>';
        return;
    }
    let html = '';
    for (const entry of processingEntries) {
        const airlineDisplay = getAirlineDisplay(entry.airlineCode);
        const fqtvDisplay = entry.fqtvValue || '—';
        const serialDisplay = entry.serialNo || '—';
        html += `
            <tr style="background:#fcf8ef;">
                <td>${escapeHtml(entry.passengerName)} <span style="font-size:0.6rem;color:#c9a352;">⏳ Saving...</span></td>
                <td>${escapeHtml(entry.flightNo)}</td>
                <td>${escapeHtml(entry.seatNo)}</td>
                <td><span class="pax-badge">${entry.pax}</span></td>
                <td>${escapeHtml(entry.classCode || 'Y')}</td>
                <td>${escapeHtml(serialDisplay)}</td>
                <td>${airlineDisplay}</td>
                <td>${escapeHtml(fqtvDisplay)}</td>
                <td>
                    <div class="action-cell">
                        <button class="table-action-btn table-delete" id="delete-proc-${entry.id}">🗑 Cancel</button>
                    </div>
                </td>
            </tr>
        `;
    }
    tbody.innerHTML = html;
    for (const entry of processingEntries) {
        const delBtn = document.getElementById(`delete-proc-${entry.id}`);
        if (delBtn) delBtn.addEventListener('click', () => deleteProcessingEntry(entry.id));
    }
}

// ============================================================
// FAILED LIST RENDER
// ============================================================
function renderFailedList() {
    const container = document.getElementById('failedList');
    if (!container) return;
    if (!failedEntries.length) {
        container.innerHTML = '<div class="empty-list-message">✅ No failed entries. All saves successful!</div>';
        return;
    }
    let html = '';
    for (const entry of failedEntries) {
        const airlineDisplay = getAirlineDisplay(entry.airlineCode);
        const fqtvDisplay = entry.fqtvValue || '—';
        const serialDisplay = entry.serialNo || '—';
        html += `
            <div class="passenger-item">
                <div class="passenger-header">
                    <div class="passenger-name">✈️ ${escapeHtml(entry.passengerName || 'UNKNOWN')}<span class="failed-badge">❌ Failed</span></div>
                    <div class="action-buttons">
                        <button class="retry-btn" data-id="${entry.id}">🔄 Retry Save</button>
                        <button class="delete-btn" data-id="${entry.id}">🗑️ Delete</button>
                    </div>
                </div>
                <div class="passenger-details-grid">
                    <div class="detail-row"><span class="detail-label">Flight:</span><span class="detail-value">${escapeHtml(entry.flightNo || '—')}</span></div>
                    <div class="detail-row"><span class="detail-label">Seat:</span><span class="detail-value">${escapeHtml(entry.seatNo || '—')}</span></div>
                    <div class="detail-row"><span class="detail-label">Airline:</span><span class="detail-value">${airlineDisplay}</span></div>
                    <div class="detail-row"><span class="detail-label">Class:</span><span class="detail-value">${escapeHtml(entry.classCode || 'Y')}</span></div>
                    <div class="detail-row"><span class="detail-label">Serial No:</span><span class="detail-value">${escapeHtml(serialDisplay)}</span></div>
                    <div class="detail-row"><span class="detail-label">Target DB:</span><span class="detail-value">${escapeHtml(getFirestoreNameForFlight(entry.flightNo))}</span></div>
                </div>
                <div class="error-detail">❌ <strong>Error:</strong> ${escapeHtml(entry.errorMessage || 'Unknown error')}<br><small>Failed at: ${new Date(entry.failedAt).toLocaleTimeString()}</small></div>
            </div>
        `;
    }
    container.innerHTML = html;
    for (const entry of failedEntries) {
        const retryBtn = document.querySelector(`#failedList .retry-btn[data-id="${entry.id}"]`);
        if (retryBtn) retryBtn.addEventListener('click', () => retryFailedEntry(entry.id));
        const deleteBtn = document.querySelector(`#failedList .delete-btn[data-id="${entry.id}"]`);
        if (deleteBtn) deleteBtn.addEventListener('click', () => deleteFailedEntry(entry.id));
    }
}

// ============================================================
// TAB COUNTS & MODE UI
// ============================================================
function updateTabCounts() {
    const mc = document.getElementById('manifestCount');
    if (mc) mc.textContent = manifestEntries.length;
    const pc = document.getElementById('processingCount');
    if (pc) pc.textContent = processingEntries.length;
    const fc = document.getElementById('failedCount');
    if (fc) fc.textContent = failedEntries.length;
}

function updateModeUI() {
    const modeBadge = document.getElementById('modeBadge');
    if (modeBadge) {
        if (currentMode === 'local') {
            modeBadge.textContent = 'LOCAL MODE';
            modeBadge.className = 'mode-badge local';
        } else {
            modeBadge.textContent = 'ONLINE MODE';
            modeBadge.className = 'mode-badge online';
        }
    }
    updateTabCounts();
    renderManifestTable();
    renderProcessingTable();
    renderFailedList();
}

// ============================================================
// TAB SWITCHING
// ============================================================
function switchTab(tabId) {
    currentTab = tabId;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabId}`);
    });
    if (tabId === 'manifest') renderManifestTable();
    else if (tabId === 'processing') renderProcessingTable();
    else if (tabId === 'failed') renderFailedList();
    
    if (!isEditingManifestField()) {
        setTimeout(() => focusToCodeInput(true), 150);
    }
}

// ============================================================
// TOAST / STATUS
// ============================================================
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

function showSavingStatus(message, type = 'loading') {
    const statusDiv = document.getElementById('savingStatus');
    if (!statusDiv) return;
    const textSpan = document.getElementById('savingStatusText');
    statusDiv.className = `saving-status ${type} show`;
    if (textSpan) textSpan.textContent = message;
    if (type !== 'loading') {
        setTimeout(() => statusDiv.classList.remove('show'), 3000);
    }
}

// ============================================================
// USER & SHIFT
// ============================================================
function loadUserData() {
    const user = getUserSession();
    if (user) {
        currentUser = {
            name: user.name || user.username || 'OPERATOR',
            username: user.username || 'operator',
            rcno: user.rcno || 'N/A',
            level: user.level || user.right || 'OPERATOR'
        };
        const nameDisplay = document.getElementById('userNameDisplay');
        if (nameDisplay) nameDisplay.innerText = currentUser.name;
        const rcnoDisplay = document.getElementById('userRcnoDisplay');
        if (rcnoDisplay) rcnoDisplay.innerText = currentUser.rcno;
        const levelDisplay = document.getElementById('userLevelDisplay');
        if (levelDisplay) levelDisplay.innerText = currentUser.level;
    }
}

async function fetchShiftData() {
    try {
        if (typeof passengerDb !== 'undefined' && passengerDb) {
            const doc = await passengerDb.collection('shifts').doc('currentshift').get();
            if (doc.exists) {
                const data = doc.data();
                currentShiftData.date = data.date || '';
                if (data.morning === 'open') currentShiftData.shift = 'MORNING';
                else if (data.evening === 'open') currentShiftData.shift = 'EVENING';
                else currentShiftData.shift = 'NO SHIFT';
                localStorage.setItem('currentShiftData', JSON.stringify(currentShiftData));
            }
        }
    } catch (e) {
        const saved = localStorage.getItem('currentShiftData');
        if (saved) {
            try { currentShiftData = JSON.parse(saved); } catch (e) {}
        }
    }
    const dateEl = document.getElementById('currentDate');
    if (dateEl) dateEl.innerText = currentShiftData.date || '—';
    const shiftEl = document.getElementById('currentShift');
    if (shiftEl) shiftEl.innerText = currentShiftData.shift || '—';
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('username');
        localStorage.removeItem('level');
        localStorage.removeItem('right');
        localStorage.removeItem('rcno');
        localStorage.removeItem('name');
        localStorage.removeItem('currentUser');
        localStorage.removeItem('loggedInUser');
        window.location.href = 'login.html';
    }
}

// ============================================================
// MANUAL ENTRY
// ============================================================
async function addManualEntry() {
    if (!isShiftActive()) {
        showStatus('❌ No active shift.', 'error');
        focusToCodeInput(true);
        return;
    }
    
    const timestamp = Date.now().toString().slice(-4);
    const demoEntry = {
        id: nextId++,
        pnr: 'MAN' + timestamp,
        passengerName: `Manual ${timestamp}`,
        flightNo: 'EK123',
        classCode: 'Y',
        seatNo: '12A',
        airlineCode: 'EK',
        fqtvValue: '',
        guestOf: null,
        pax: 1,
        serialNo: '',
        timestamp: new Date().toISOString(),
        scannedBy: getUserSession()?.username || 'Unknown',
        rawCode: ''
    };
    
    // Check before adding
    const flightStatus = await checkFlightStatus(demoEntry.flightNo);
    if (flightStatus.isClosed) {
        showStatus(`❌ Flight ${demoEntry.flightNo} is CLOSED. Cannot add passengers.`, 'error');
        focusToCodeInput(true);
        return;
    }
    
    const duplicateCheck = await checkDuplicateSeat(demoEntry.flightNo, demoEntry.seatNo);
    if (duplicateCheck.duplicate) {
        const existingPassenger = duplicateCheck.entry?.passengerName || 'Unknown';
        showStatus(`❌ SEAT ${demoEntry.seatNo} on ${demoEntry.flightNo} (${getTodayDate()}) is OCCUPIED by ${existingPassenger}.`, 'error');
        focusToCodeInput(true);
        return;
    }
    
    if (isDuplicateEntry(demoEntry.flightNo, demoEntry.passengerName, demoEntry.seatNo, null, manifestEntries)) {
        showStatus('❌ Duplicate entry.', 'error');
        focusToCodeInput(true);
        return;
    }
    
    manifestEntries.unshift(demoEntry);
    await saveData();
    renderManifestTable();
    updateTabCounts();
    switchTab('manifest');
    showStatus('✏️ Manual entry created. Click fields to edit.', 'success');
    setTimeout(() => {
        showStatus('', '');
        focusToCodeInput(true);
    }, 2000);
    focusToCodeInput(true);
}

// ============================================================
// CHAT ALERT SYSTEM
// ============================================================
function getChatUser() {
    try {
        const loggedIn = localStorage.getItem('loggedInUser');
        if (loggedIn) {
            const parsed = JSON.parse(loggedIn);
            if (parsed.username || parsed.name) {
                return {
                    username: parsed.username || parsed.name || 'Guest',
                    name: parsed.name || parsed.username || 'Guest',
                    rcno: parsed.rcno || 'N/A',
                    id: parsed.username || parsed.rcno || 'guest_' + Date.now()
                };
            }
        }
        const username = localStorage.getItem('username') || localStorage.getItem('userName') || 'Guest';
        const rcno = localStorage.getItem('rcno') || 'N/A';
        return {
            username: username,
            name: localStorage.getItem('name') || username,
            rcno: rcno,
            id: username + '_' + rcno
        };
    } catch (e) {
        return { username: 'Guest', name: 'Guest', rcno: 'N/A', id: 'guest_' + Date.now() };
    }
}

function initChatAlerts() {
    if (!window.rtdb) {
        console.warn('RTDB not available for chat alerts');
        setTimeout(initChatAlerts, 1000);
        return;
    }

    const user = getChatUser();
    const currentUserId = user.id || user.username || 'guest';

    if (!document.getElementById('chatToastContainer')) {
        const container = document.createElement('div');
        container.id = 'chatToastContainer';
        container.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 99999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 380px;
            width: 100%;
            pointer-events: none;
        `;
        document.body.appendChild(container);
        chatAlertContainer = container;
    } else {
        chatAlertContainer = document.getElementById('chatToastContainer');
    }

    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    if (chatAlertListener) {
        window.rtdb.ref('chatMessages').off('child_added', chatAlertListener);
    }

    chatAlertListener = window.rtdb.ref('chatMessages').on('child_added', (snapshot) => {
        const msg = snapshot.val();
        if (!msg || !msg.text) return;
        if (msg.senderId === currentUserId) return;
        const messageId = snapshot.key;
        if (notifiedMessages.has(messageId)) return;
        const readBy = msg.readBy || {};
        if (readBy[currentUserId]) return;
        notifiedMessages.add(messageId);
        showChatAlert(msg.sender, msg.text, msg.senderId);
        unreadChatCount++;
        updateChatBadge();
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
            try {
                new Notification('💬 New message from ' + msg.sender, {
                    body: msg.text.length > 60 ? msg.text.substring(0, 60) + '...' : msg.text,
                    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23dcb96a"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>',
                    tag: messageId,
                    requireInteraction: true
                });
            } catch (e) {}
        }
    });

    console.log('✅ Chat alerts initialized');
}

function showChatAlert(sender, text, senderId) {
    if (!chatAlertContainer) return;

    const toast = document.createElement('div');
    toast.style.cssText = `
        background: linear-gradient(135deg, #2d2412, #4a3822);
        color: #f7eaca;
        padding: 12px 16px;
        border-radius: 12px;
        box-shadow: 0 8px 25px rgba(0,0,0,0.25);
        border-left: 4px solid #dcb96a;
        cursor: pointer;
        animation: slideInToast 0.3s ease;
        display: flex;
        align-items: flex-start;
        gap: 12px;
        max-width: 380px;
        backdrop-filter: blur(8px);
        pointer-events: auto;
    `;
    toast.innerHTML = `
        <div style="font-size:20px; flex-shrink:0; margin-top:2px;">💬</div>
        <div style="flex:1; min-width:0;">
            <div style="font-weight:700; font-size:13px; color:#dcb96a;">${escapeHtml(sender)}</div>
            <div style="font-size:14px; opacity:0.9; word-wrap:break-word; overflow:hidden; text-overflow:ellipsis; max-height:50px;">
                ${escapeHtml(text.length > 60 ? text.substring(0,60)+'...' : text)}
            </div>
        </div>
        <button onclick="this.parentElement.remove(); event.stopPropagation();" 
                style="background:none; border:none; color:rgba(255,255,255,0.4); cursor:pointer; font-size:18px; padding:0 4px; flex-shrink:0;">
            &times;
        </button>
    `;

    toast.addEventListener('click', function(e) {
        if (e.target.tagName === 'BUTTON') return;
        this.remove();
        openChatPage();
        markAllChatMessagesAsRead();
        unreadChatCount = 0;
        updateChatBadge();
    });

    chatAlertContainer.appendChild(toast);

    setTimeout(() => {
        if (toast.parentNode) toast.remove();
    }, 6000);
}

function markAllChatMessagesAsRead() {
    if (!window.rtdb) return;
    const user = getChatUser();
    const currentUserId = user.id || user.username || 'guest';
    
    window.rtdb.ref('chatMessages').once('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) return;
        
        const updates = {};
        for (const [key, msg] of Object.entries(data)) {
            if (msg.senderId === currentUserId) continue;
            const readBy = msg.readBy || {};
            if (!readBy[currentUserId]) {
                readBy[currentUserId] = true;
                updates[key] = { readBy: readBy };
            }
        }
        
        if (Object.keys(updates).length > 0) {
            for (const [key, update] of Object.entries(updates)) {
                window.rtdb.ref('chatMessages').child(key).update(update);
            }
            console.log(`✅ Marked ${Object.keys(updates).length} messages as read`);
        }
    });
}

function updateChatBadge() {
    const btn = document.getElementById('openMessageBtn');
    if (!btn) return;
    let badge = btn.querySelector('.chat-unread-badge');
    if (unreadChatCount > 0) {
        if (!badge) {
            badge = document.createElement('div');
            badge.className = 'chat-unread-badge';
            badge.style.cssText = `
                position: absolute;
                top: -5px;
                right: -5px;
                background: #ff4444;
                color: white;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                font-size: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 700;
            `;
            btn.style.position = 'relative';
            btn.appendChild(badge);
        }
        badge.textContent = unreadChatCount > 9 ? '9+' : unreadChatCount;
        badge.style.display = 'flex';
    } else {
        if (badge) badge.style.display = 'none';
    }
}

function openChatPage() {
    const chatWindow = window.open(
        'chat.html',
        'ChatWindow',
        'width=420,height=600,left=' + (window.screen.width - 440) + ',top=60,resizable=yes,scrollbars=no'
    );
    if (chatWindow) {
        chatWindow.focus();
        setTimeout(() => {
            markAllChatMessagesAsRead();
            unreadChatCount = 0;
            updateChatBadge();
        }, 500);
    } else {
        window.location.href = 'chat.html';
    }
}

// ============================================================
// CACHE CLEANUP
// ============================================================
function cleanupCache() {
    const now = Date.now();
    
    for (const [key, value] of flightStatusCache.entries()) {
        if (now - value.timestamp > FLIGHT_CACHE_DURATION) {
            flightStatusCache.delete(key);
        }
    }
    
    for (const [key, value] of duplicateCache.entries()) {
        if (now - value.timestamp > DUPLICATE_CACHE_DURATION) {
            duplicateCache.delete(key);
        }
    }
}

setInterval(cleanupCache, 10000);

// ============================================================
// ATTACH MANIFEST EVENTS
// ============================================================
function attachManifestEvents() {
    for (const entry of manifestEntries) {
        const guestBtn = document.getElementById(`guest-btn-${entry.id}`);
        if (guestBtn) {
            guestBtn.removeEventListener('click', guestBtn._clickHandler);
            guestBtn._clickHandler = (e) => {
                e.stopPropagation();
                addGuestForParent(entry.id);
                setTimeout(() => focusToCodeInput(true), 100);
            };
            guestBtn.addEventListener('click', guestBtn._clickHandler);
        }
        
        const approveBtn = document.getElementById(`approve-${entry.id}`);
        if (approveBtn) {
            approveBtn.removeEventListener('click', approveBtn._clickHandler);
            approveBtn._clickHandler = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await approveEntry(entry.id);
                setTimeout(() => focusToCodeInput(true), 100);
            };
            approveBtn.addEventListener('click', approveBtn._clickHandler);
        }
        
        const deleteBtn = document.getElementById(`delete-${entry.id}`);
        if (deleteBtn) {
            deleteBtn.removeEventListener('click', deleteBtn._clickHandler);
            deleteBtn._clickHandler = (e) => {
                e.stopPropagation();
                deleteManifestEntry(entry.id);
                setTimeout(() => focusToCodeInput(true), 100);
            };
            deleteBtn.addEventListener('click', deleteBtn._clickHandler);
        }
        
        setupEditableCell(entry, 'name');
        setupEditableCell(entry, 'flight');
        setupEditableCell(entry, 'seat');
        setupEditableCell(entry, 'class');
        setupEditableCell(entry, 'serial');
        setupEditableCell(entry, 'fqtv');
    }
}

function setupEditableCell(entry, fieldType) {
    const cell = document.getElementById(`${fieldType}-${entry.id}`);
    if (!cell) return;
    
    const fieldMap = {
        'name': 'passengerName',
        'flight': 'flightNo',
        'seat': 'seatNo',
        'class': 'classCode',
        'serial': 'serialNo',
        'fqtv': 'fqtvValue'
    };
    
    const fieldName = fieldMap[fieldType];
    if (!fieldName) return;
    
    cell.removeEventListener('focus', cell._focusHandler);
    cell.removeEventListener('blur', cell._blurHandler);
    cell.removeEventListener('keydown', cell._keydownHandler);
    
    cell._focusHandler = () => {
        isEditingCell = true;
        activeEditableCell = cell;
        cell.style.background = '#fff8e7';
        setTimeout(() => {
            const range = document.createRange();
            range.selectNodeContents(cell);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }, 10);
    };
    
    cell._blurHandler = debounce(async (e) => {
        cell.style.background = 'transparent';
        const newVal = e.target.innerText.trim();
        const oldVal = entry[fieldName] || '';
        if (newVal !== oldVal) {
            await saveFieldLive(entry.id, fieldName, newVal);
        }
        activeEditableCell = null;
        isEditingCell = false;
    }, 300);
    
    cell._keydownHandler = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.target.blur();
        }
        if (e.key === 'Escape') {
            e.target.blur();
            focusToCodeInput(true);
        }
    };
    
    cell.addEventListener('focus', cell._focusHandler);
    cell.addEventListener('blur', cell._blurHandler);
    cell.addEventListener('keydown', cell._keydownHandler);
}

// ============================================================
// INITIALIZATION
// ============================================================
async function init() {
    const username = localStorage.getItem('username');
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const loggedInUser = localStorage.getItem('loggedInUser');
    let isAuth = false;
    if (username && isLoggedIn) isAuth = true;
    else if (loggedInUser) {
        try { const u = JSON.parse(loggedInUser); if (u && u.username) { isAuth = true; localStorage.setItem('isLoggedIn', 'true'); } } catch (e) {}
    } else if (username) { isAuth = true; localStorage.setItem('isLoggedIn', 'true'); }
    if (!isAuth) {
        window.location.href = 'login.html';
        return;
    }
    loadUserData();
    await fetchShiftData();
    const savedMode = localStorage.getItem('operationMode');
    currentMode = savedMode === 'multiple' ? 'multiple' : 'local';
    const modeRadios = document.querySelectorAll('input[name="operationMode"]');
    modeRadios.forEach(r => {
        if (r.value === currentMode) r.checked = true;
    });
    await initRTDB();
    listenToFirebaseChanges();
    if (currentMode === 'local') loadFromLocalStorage();
    else await loadFromFirebaseRTDB();
    updateModeUI();
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    
    const clearAllBtn = document.getElementById('clearAllBtn');
    if (clearAllBtn) clearAllBtn.addEventListener('click', clearAllManifest);
    const clearProcessingBtn = document.getElementById('clearProcessingBtn');
    if (clearProcessingBtn) clearProcessingBtn.addEventListener('click', clearAllProcessing);
    const clearFailedBtn = document.getElementById('clearFailedBtn');
    if (clearFailedBtn) clearFailedBtn.addEventListener('click', clearAllFailed);
    
    const codeInput = document.getElementById('codeInput');
    if (codeInput) {
        codeInput.addEventListener('change', extractAndAdd);
        codeInput.addEventListener('blur', () => { 
            if (codeInput.value.trim()) {
                extractAndAdd();
            }
        });
        codeInput.addEventListener('paste', () => {
            setTimeout(async () => {
                await extractAndAdd();
                focusToCodeInput(true);
            }, 50);
        });
        setTimeout(() => focusToCodeInput(true), 500);
    }
    
    const manualBtn = document.getElementById('manualEntryBtn');
    if (manualBtn) manualBtn.addEventListener('click', addManualEntry);
    
    const closeGuestBtn = document.getElementById('closeGuestModeBtn');
    if (closeGuestBtn) closeGuestBtn.addEventListener('click', closeGuestMode);
    
    const refreshShiftBtn = document.getElementById('refreshShiftBtn');
    if (refreshShiftBtn) refreshShiftBtn.addEventListener('click', fetchShiftData);
    
    modeRadios.forEach(radio => {
        radio.addEventListener('change', async (e) => {
            if (e.target.checked) {
                const newMode = e.target.value;
                if (newMode !== currentMode) {
                    currentMode = newMode;
                    localStorage.setItem('operationMode', currentMode);
                    if (currentMode === 'local') loadFromLocalStorage();
                    else await loadFromFirebaseRTDB();
                    updateModeUI();
                    showToast(`Switched to ${currentMode.toUpperCase()} mode`, 'info');
                    focusToCodeInput(true);
                }
            }
        });
    });
    
    document.addEventListener('click', (e) => {
        const targetEl = e.target.nodeType === Node.TEXT_NODE ? e.target.parentElement : e.target;
        const isInsideManifestTab = targetEl.closest && targetEl.closest('#tab-manifest');
        if (isInsideManifestTab) {
            return;
        }
        const isInput = targetEl.id === 'codeInput';
        const isButton = targetEl.closest ? targetEl.closest('button') : false;
        const isTab = targetEl.closest ? targetEl.closest('.tab-btn') : false;
        const isGuestBanner = targetEl.closest ? targetEl.closest('#guestModeBanner') : false;
        const isStatus = targetEl.closest ? targetEl.closest('#extractStatus') : false;
        
        if (isButton || isTab) {
            return;
        }
        
        if (!isInput && !isGuestBanner && !isStatus) {
            if (!isEditingManifestField() && !isProcessingAction) {
                setTimeout(() => focusToCodeInput(false), 50);
            }
        }
    }, true);
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (activeEditableCell) {
                activeEditableCell.blur();
            }
            focusToCodeInput(true);
        }
        if (e.ctrlKey && e.shiftKey && (e.key === 'F' || e.key === 'f')) {
            e.preventDefault();
            focusToCodeInput(true);
        }
    });
    
    initChatAlerts();
    
    const openMsgBtn = document.getElementById('openMessageBtn');
    if (openMsgBtn) {
        openMsgBtn.onclick = function(e) {
            e.preventDefault();
            openChatPage();
        };
    }
    
    renderManifestTable();
    renderProcessingTable();
    renderFailedList();
    updateTabCounts();
    setInterval(fetchShiftData, 30000);
    console.log('✅ Passenger Manifest System initialized with optimistic UI and background validation');
}

// ============================================================
// START
// ============================================================
document.addEventListener('DOMContentLoaded', init);

// ============================================================
// EXPOSE FUNCTIONS TO GLOBAL SCOPE
// ============================================================
window.approveEntry = approveEntry;
window.approveMultipleEntries = approveMultipleEntries;
window.retryFailedEntry = retryFailedEntry;
window.deleteManifestEntry = deleteManifestEntry;
window.deleteProcessingEntry = deleteProcessingEntry;
window.deleteFailedEntry = deleteFailedEntry;
window.addGuestForParent = addGuestForParent;
window.closeGuestMode = closeGuestMode;
window.logout = logout;
window.switchTab = switchTab;
window.extractAndAdd = extractAndAdd;
window.addManualEntry = addManualEntry;
window.focusToCodeInput = focusToCodeInput;
window.showToast = showToast;
window.openChatPage = openChatPage;
window.initChatAlerts = initChatAlerts;
window.markAllChatMessagesAsRead = markAllChatMessagesAsRead;
