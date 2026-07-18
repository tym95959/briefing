// app.js – all the login logic, pattern lock, Firebase interaction

document.addEventListener('DOMContentLoaded', async () => {

  // ---- 1. Fetch and inject the HTML from app.html ----
  try {
    const response = await fetch('app.html');
    if (!response.ok) throw new Error('Failed to load app.html');
    const html = await response.text();
    
    const root = document.getElementById('root');
    root.innerHTML = html;
    root.style.display = 'block';

    // Hide the loader
    document.getElementById('loader').style.display = 'none';

  } catch (err) {
    console.error('Failed to load app:', err);
    document.querySelector('.loader-text').textContent = '⚠️ Failed to load application. Please refresh.';
    return;
  }

  // ---- 2. DOM refs ----
  const toggleBtns = document.querySelectorAll('.toggle-btn');
  const panelPassword = document.getElementById('panel-password');
  const panelLinecode = document.getElementById('panel-linecode');
  const formPassword = document.getElementById('form-password');
  const formLinecode = document.getElementById('form-linecode');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const userSelect = document.getElementById('user-select');
  const msgPassword = document.getElementById('msg-password');
  const msgLinecode = document.getElementById('msg-linecode');
  const btnPassword = document.getElementById('btn-password');
  const btnLinecode = document.getElementById('btn-linecode');
  const signupLink = document.getElementById('signup-link');
  const clearPatternBtn = document.getElementById('clearPatternBtn');

  const patternGrid = document.getElementById('patternGrid');
  const patternSvg = document.getElementById('patternSvg');
  const patternStatus = document.getElementById('patternStatus');

  if (!patternGrid) {
    console.error('Pattern grid not found – app.html may be incomplete.');
    return;
  }

  // ---- Pattern lock state ----
  const DOT_COUNT = 9;
  let dots = [];
  let selectedDots = [];
  let isDrawing = false;

  const dotPositions = [
    { x: 0.1667, y: 0.1667 }, { x: 0.5, y: 0.1667 }, { x: 0.8333, y: 0.1667 },
    { x: 0.1667, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.8333, y: 0.5 },
    { x: 0.1667, y: 0.8333 }, { x: 0.5, y: 0.8333 }, { x: 0.8333, y: 0.8333 }
  ];

  function buildPatternGrid() {
    if (!patternGrid) return;
    patternGrid.innerHTML = '';
    dots = [];
    const container = document.getElementById('patternContainer');
    const size = container ? container.offsetWidth || 280 : 280;

    for (let i = 0; i < DOT_COUNT; i++) {
      const dot = document.createElement('div');
      dot.className = 'pattern-dot';
      dot.dataset.index = i;
      const pos = dotPositions[i];
      dot.style.left = (pos.x * 100) + '%';
      dot.style.top = (pos.y * 100) + '%';
      dot.style.width = Math.max(40, size * 0.18) + 'px';
      dot.style.height = Math.max(40, size * 0.18) + 'px';
      dot.innerHTML = `<span class="dot-number">${i + 1}</span>`;
      patternGrid.appendChild(dot);
      dots.push(dot);

      dot.addEventListener('mousedown', (e) => onDotDown(e, i));
      dot.addEventListener('mouseenter', (e) => onDotEnter(e, i));
      dot.addEventListener('touchstart', (e) => { e.preventDefault(); onDotDown(e, i); }, { passive: false });
      dot.addEventListener('touchmove', (e) => { e.preventDefault(); onDotMove(e, i); }, { passive: false });
      dot.addEventListener('touchend', (e) => { e.preventDefault(); onDotUp(e, i); }, { passive: false });
    }

    document.removeEventListener('mouseup', onGlobalUp);
    document.removeEventListener('mousemove', onGlobalMove);
    document.removeEventListener('touchend', onGlobalUp);
    document.removeEventListener('touchmove', onGlobalMove);

    document.addEventListener('mouseup', onGlobalUp);
    document.addEventListener('mousemove', onGlobalMove);
    document.addEventListener('touchend', onGlobalUp);
    document.addEventListener('touchmove', onGlobalMove, { passive: false });

    updateSvg();
  }

  // ---- Pattern event handlers ----
  function onDotDown(e, index) {
    if (selectedDots.includes(index)) return;
    isDrawing = true;
    selectDot(index);
    updateStatus('active', 'Drawing pattern…');
  }

  function onDotEnter(e, index) {
    if (!isDrawing || selectedDots.includes(index)) return;
    selectDot(index);
  }

  function onDotUp(e, index) {}
  function onDotMove(e, index) {}

  // ---- 🔥 MODIFIED: onGlobalUp triggers auto‑login ----
  function onGlobalUp(e) {
    if (isDrawing) {
      isDrawing = false;
      if (selectedDots.length >= 4) {
        updateStatus('active', 'Verifying pattern…');
        // Attempt automatic login
        attemptAutoLogin();
      } else {
        updateStatus('error', '❌ Need at least 4 dots');
        setTimeout(() => { if (!isDrawing) resetPattern(false); }, 600);
      }
      updateSvg();
    }
  }

  // ---- NEW: auto‑login function ----
  async function attemptAutoLogin() {
    const userId = userSelect.value;
    const pattern = getPatternString();

    if (!userId) {
      showMessage(msgLinecode, 'Please select a user first.', 'error');
      updateStatus('error', '❌ Select a user');
      resetPattern(false);
      return;
    }
    if (selectedDots.length < 4) {
      showMessage(msgLinecode, 'Please draw a pattern with at least 4 dots.', 'error');
      updateStatus('error', '❌ Need at least 4 dots');
      resetPattern(false);
      return;
    }

    // Show checking state
    updateStatus('active', 'Checking credentials…');

    try {
      const docSnap = await db.collection('users').doc(userId).get();

      if (!docSnap.exists) {
        showMessage(msgLinecode, 'User not found. Please refresh.', 'error');
        updateStatus('error', '❌ User not found');
        resetPattern(false);
        return;
      }

      const data = docSnap.data();
      const storedCode = data.lineCode || '';

      if (pattern === storedCode) {
        // ✅ Success – redirect to dashboard
        const displayName = data.displayName || data.username || userId;
        showMessage(msgLinecode, `✅ Welcome, ${displayName}! Redirecting…`, 'success');
        updateStatus('success', '✓ Pattern matched! Redirecting…');
        console.log('Line code login successful for:', userId);

        // Redirect after a short delay
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 1200);
      } else {
        // ❌ Pattern mismatch
        showMessage(msgLinecode, '❌ Invalid pattern. Please try again.', 'error');
        updateStatus('error', '❌ Pattern does not match');
        // Flash error on dots
        selectedDots.forEach(i => {
          const dot = dots[i];
          if (dot) {
            dot.classList.add('error');
            setTimeout(() => dot.classList.remove('error'), 600);
          }
        });
        setTimeout(() => {
          if (!isDrawing) resetPattern(false);
        }, 800);
      }

    } catch (err) {
      console.error('Auto‑login error:', err);
      showMessage(msgLinecode, `⚠️ ${err.message}`, 'error');
      updateStatus('error', '❌ Error checking pattern');
      resetPattern(false);
    }
  }

  // ---- Rest of the pattern functions (unchanged) ----
  function onGlobalMove(e) {
    if (!isDrawing) return;
    let clientX, clientY;
    if (e.touches) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const container = document.getElementById('patternContainer');
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    let nearest = -1;
    let minDist = 0.12;
    for (let i = 0; i < DOT_COUNT; i++) {
      if (selectedDots.includes(i)) continue;
      const pos = dotPositions[i];
      const dx = x - pos.x;
      const dy = y - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        nearest = i;
      }
    }
    if (nearest >= 0 && !selectedDots.includes(nearest)) {
      selectDot(nearest);
    }
  }

  function selectDot(index) {
    if (selectedDots.includes(index)) return;
    selectedDots.push(index);
    const dot = dots[index];
    if (dot) {
      dot.classList.add('selected');
      dot.style.transform = 'translate(-50%, -50%) scale(1.2)';
      setTimeout(() => { dot.style.transform = 'translate(-50%, -50%) scale(1.08)'; }, 100);
    }
    updateSvg();
    updateStatus('active', `Pattern: ${selectedDots.map(i => i+1).join(' → ')}`);
  }

  function resetPattern(keepStatus = false) {
    selectedDots.forEach(i => {
      const dot = dots[i];
      if (dot) {
        dot.classList.remove('selected', 'active', 'error');
        dot.style.transform = '';
      }
    });
    selectedDots = [];
    if (!keepStatus) updateStatus('idle', 'Connect at least 4 dots');
    updateSvg();
  }

  function updateStatus(type, msg) {
    if (!patternStatus) return;
    patternStatus.textContent = msg;
    patternStatus.className = 'pattern-status';
    if (type === 'active') patternStatus.classList.add('active-status');
    else if (type === 'error') patternStatus.classList.add('error-status');
    else if (type === 'success') patternStatus.classList.add('success-status');
  }

  function updateSvg() {
    if (!patternSvg) return;
    const container = document.getElementById('patternContainer');
    const size = container ? container.offsetWidth || 280 : 280;
    let svgContent = '';
    for (let i = 0; i < selectedDots.length - 1; i++) {
      const from = dotPositions[selectedDots[i]];
      const to = dotPositions[selectedDots[i + 1]];
      const x1 = from.x * size;
      const y1 = from.y * size;
      const x2 = to.x * size;
      const y2 = to.y * size;
      svgContent += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;
    }
    patternSvg.innerHTML = svgContent;
  }

  if (clearPatternBtn) {
    clearPatternBtn.addEventListener('click', () => resetPattern(false));
  }

  // ---- Helpers ----
  function showMessage(el, text, type = 'error') {
    if (!el) return;
    el.textContent = text;
    el.className = `message ${type}`;
    el.style.display = 'block';
  }

  function hideMessage(el) {
    if (!el) return;
    el.style.display = 'none';
    el.className = 'message';
    el.textContent = '';
  }

  function setLoading(btn, loading) {
    if (!btn) return;
    if (loading) {
      btn.classList.add('loading');
      btn.disabled = true;
    } else {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  }

  function getPatternString() {
    return selectedDots.map(i => i + 1).join('');
  }

  // ---- Toggle login methods ----
  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      toggleBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');

      const tab = btn.dataset.tab;
      if (tab === 'password') {
        if (panelPassword) panelPassword.classList.add('active');
        if (panelLinecode) panelLinecode.classList.remove('active');
        hideMessage(msgPassword);
        hideMessage(msgLinecode);
      } else {
        if (panelLinecode) panelLinecode.classList.add('active');
        if (panelPassword) panelPassword.classList.remove('active');
        hideMessage(msgPassword);
        hideMessage(msgLinecode);
        resetPattern(false);
        loadUserList();
        setTimeout(buildPatternGrid, 50);
      }
    });
  });

  // ---- Load users for line‑code dropdown ----
  async function loadUserList() {
    try {
      const snapshot = await db.collection('users')
        .orderBy('displayName')
        .get();

      if (!userSelect) return;
      const currentVal = userSelect.value;
      userSelect.innerHTML = '<option value="">— choose a user —</option>';

      if (snapshot.empty) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = '⚠️ No users found';
        opt.disabled = true;
        userSelect.appendChild(opt);
        return;
      }

      snapshot.forEach(doc => {
        const data = doc.data();
        const name = data.displayName || data.username || doc.id;
        const opt = document.createElement('option');
        opt.value = doc.id;
        opt.textContent = name;
        opt.dataset.linecode = data.lineCode || '';
        userSelect.appendChild(opt);
      });

      if (currentVal) userSelect.value = currentVal;

    } catch (err) {
      console.error('Error loading users:', err);
      if (userSelect) {
        userSelect.innerHTML = '<option value="">⚠️ Could not load users</option>';
      }
      showMessage(msgLinecode, '⚠️ Unable to load users. Check Firestore permissions.', 'error');
    }
  }

  // ---- Login: Email + Password (unchanged, with redirect) ----
  if (formPassword) {
    formPassword.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideMessage(msgPassword);

      const email = emailInput ? emailInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value : '';

      if (!email || !password) {
        showMessage(msgPassword, 'Please fill in both fields.', 'error');
        return;
      }

      setLoading(btnPassword, true);

      try {
        const docSnap = await db.collection('users').doc(email).get();

        if (!docSnap.exists) {
          showMessage(msgPassword, 'No account found with this email.', 'error');
          setLoading(btnPassword, false);
          return;
        }

        const userData = docSnap.data();

        if (userData.password === password) {
          showMessage(msgPassword, `✅ Welcome back, ${userData.displayName || userData.email}! Redirecting…`, 'success');
          console.log('Logged in:', email);
          setTimeout(() => { window.location.href = 'dashboard.html'; }, 1200);
        } else {
          showMessage(msgPassword, '❌ Incorrect password.', 'error');
        }

      } catch (err) {
        console.error('Login error:', err);
        showMessage(msgPassword, `❌ Login failed: ${err.message}`, 'error');
      } finally {
        setLoading(btnPassword, false);
      }
    });
  }

  // ---- Login: Line Code Pattern (fallback – calls the same auto function) ----
  if (formLinecode) {
    formLinecode.addEventListener('submit', async (e) => {
      e.preventDefault();
      // If the user clicks submit, we just call the same logic
      attemptAutoLogin();
    });
  }

  // ---- Signup link ----
  if (signupLink) {
    signupLink.addEventListener('click', (e) => { /* navigates to signup.html */ });
  }

  // ---- Init ----
  setTimeout(buildPatternGrid, 100);
  loadUserList();

  if (emailInput) emailInput.addEventListener('input', () => hideMessage(msgPassword));
  if (passwordInput) passwordInput.addEventListener('input', () => hideMessage(msgPassword));
  if (userSelect) {
    userSelect.addEventListener('change', () => {
      hideMessage(msgLinecode);
      resetPattern(false);
    });
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(buildPatternGrid, 200);
  });

  console.log('🔐 App loaded from external HTML (auto‑redirect enabled).');
});