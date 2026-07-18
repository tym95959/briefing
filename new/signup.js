// ===== signup.js =====
document.addEventListener('DOMContentLoaded', () => {

  // ---- HTML template ----
  const signupHTML = `
    <div class="login-card">
      <div class="brand">
        <div class="logo">✦ LineManager</div>
        <div class="sub">create your account</div>
      </div>

      <form id="signup-form" autocomplete="off">
        <div class="form-group">
          <label for="displayName">Display Name</label>
          <input type="text" id="displayName" placeholder="Your full name" required />
        </div>
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" placeholder="you@company.com" required />
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" placeholder="•••••••• (min 6 chars)" required minlength="6" />
        </div>
        <div class="form-group">
          <label for="confirmPassword">Confirm Password</label>
          <input type="password" id="confirmPassword" placeholder="••••••••" required />
        </div>

        <div class="form-group">
          <label>Set your line code pattern (at least 4 dots)</label>
          <div class="pattern-wrapper">
            <div class="pattern-container" id="patternContainer">
              <div class="pattern-grid" id="patternGrid"></div>
              <svg class="pattern-svg" id="patternSvg"></svg>
            </div>
            <div class="pattern-status" id="patternStatus">Connect at least 4 dots</div>
            <button type="button" class="clear-pattern-btn" id="clearPatternBtn">✕ clear pattern</button>
          </div>
        </div>

        <button type="submit" class="login-btn" id="btn-signup">
          <span class="btn-text">Create Account</span>
          <span class="spinner"></span>
        </button>
      </form>

      <div id="msg-signup" class="message"></div>
      <div class="footer-link">
        Already have an account? <a href="index.html">Sign in</a>
      </div>
    </div>
  `;

  // ---- Inject into root ----
  const root = document.getElementById('root');
  root.innerHTML = signupHTML;

  // ---- DOM refs ----
  const form = document.getElementById('signup-form');
  const displayNameInput = document.getElementById('displayName');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const confirmInput = document.getElementById('confirmPassword');
  const btnSignup = document.getElementById('btn-signup');
  const msgDiv = document.getElementById('msg-signup');
  const clearPatternBtn = document.getElementById('clearPatternBtn');

  const patternGrid = document.getElementById('patternGrid');
  const patternSvg = document.getElementById('patternSvg');
  const patternStatus = document.getElementById('patternStatus');

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

  function onGlobalUp(e) {
    if (isDrawing) {
      isDrawing = false;
      if (selectedDots.length >= 4) {
        updateStatus('success', `✓ Pattern: ${selectedDots.map(i => i+1).join(' → ')}`);
      } else {
        updateStatus('error', '❌ Need at least 4 dots');
        setTimeout(() => { if (!isDrawing) resetPattern(false); }, 600);
      }
      updateSvg();
    }
  }

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

  clearPatternBtn.addEventListener('click', () => resetPattern(false));

  // ---- Helpers ----
  function showMessage(text, type = 'error') {
    msgDiv.textContent = text;
    msgDiv.className = `message ${type}`;
    msgDiv.style.display = 'block';
  }

  function hideMessage() {
    msgDiv.style.display = 'none';
    msgDiv.className = 'message';
    msgDiv.textContent = '';
  }

  function setLoading(loading) {
    if (loading) {
      btnSignup.classList.add('loading');
      btnSignup.disabled = true;
    } else {
      btnSignup.classList.remove('loading');
      btnSignup.disabled = false;
    }
  }

  function getPatternString() {
    return selectedDots.map(i => i + 1).join('');
  }

  // ---- Signup form submission ----
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideMessage();

    const displayName = displayNameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const confirm = confirmInput.value;

    if (!displayName || !email || !password || !confirm) {
      showMessage('All fields are required.', 'error');
      return;
    }
    if (password !== confirm) {
      showMessage('Passwords do not match.', 'error');
      return;
    }
    if (password.length < 6) {
      showMessage('Password must be at least 6 characters.', 'error');
      return;
    }
    if (selectedDots.length < 4) {
      showMessage('Please draw a line code pattern with at least 4 dots.', 'error');
      updateStatus('error', '❌ Need at least 4 dots');
      return;
    }

    const pattern = getPatternString();
    setLoading(true);

    try {
      // Check if email already exists
      const existing = await db.collection('users').doc(email).get();
      if (existing.exists) {
        showMessage('This email is already registered. Please sign in.', 'error');
        setLoading(false);
        return;
      }

      // Save user to Firestore
      await db.collection('users').doc(email).set({
        displayName,
        email,
        password, // ⚠️ plain text – hash in production
        lineCode: pattern,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      showMessage(`✅ Account created! Welcome, ${displayName}.`, 'success');
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 2000);

    } catch (err) {
      console.error('Signup error:', err);
      showMessage(`❌ Signup failed: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  });

  // ---- Init ----
  setTimeout(buildPatternGrid, 100);

  // Clear messages on input
  displayNameInput.addEventListener('input', hideMessage);
  emailInput.addEventListener('input', hideMessage);
  passwordInput.addEventListener('input', hideMessage);
  confirmInput.addEventListener('input', hideMessage);

  // Pattern reset on email change (optional)
  // Not needed, but we keep it clean

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(buildPatternGrid, 200);
  });

  console.log('📝 Signup page ready.');
});