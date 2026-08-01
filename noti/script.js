// ============================================================
// ===== CONFIGURATION =====
// ============================================================

const API_URL = window.location.origin;

// ============================================================
// ===== DOM ELEMENTS =====
// ============================================================

const emailForm = document.getElementById('emailForm');
const toEmail = document.getElementById('toEmail');
const toName = document.getElementById('toName');
const subject = document.getElementById('subject');
const message = document.getElementById('message');
const orderNumber = document.getElementById('orderNumber');
const orderTotal = document.getElementById('orderTotal');
const statusDiv = document.getElementById('status');
const sendBtnText = document.getElementById('sendBtnText');
const sendBtnLoading = document.getElementById('sendBtnLoading');
const activityLog = document.getElementById('activityLog');
const testEmailBtn = document.getElementById('testEmailBtn');

// ============================================================
// ===== TEMPLATES =====
// ============================================================

const templates = {
    order: {
        subject: '✅ Order Confirmation',
        message: `Thank you for your order! We're excited to confirm that your order has been received and is being processed.

Order Details:
- Order Number: #ORD-12345
- Total: ރ99.99

You will receive a shipping confirmation email once your order is on its way.

Thank you for shopping with StockRoomMV!`
    },
    shipping: {
        subject: '🚚 Your Order Has Shipped!',
        message: `Great news! Your order has been shipped and is on its way to you.

Tracking Information:
- Carrier: DHL
- Tracking Number: TRK-987654321
- Estimated Delivery: 3-5 business days

Track your order here: [Tracking Link]

Thank you for choosing StockRoomMV!`
    },
    welcome: {
        subject: '👋 Welcome to StockRoomMV!',
        message: `Welcome to the StockRoomMV family!

We're thrilled to have you on board. Here's what you can expect:
- 🛍️ High-quality products
- ⭐ Excellent customer service
- 📦 Fast and reliable delivery
- 💳 Secure checkout

Start exploring our collection today!

Best regards,
The StockRoomMV Team`
    },
    promotion: {
        subject: '🎉 Exclusive Promotion Just for You!',
        message: `We have an exclusive offer just for you!

🎁 Special Discount: 20% OFF
📅 Valid until: December 31, 2024
🛒 Use Code: STOCK20

Don't miss out on this amazing deal. Shop now and save!

Happy Shopping!
StockRoomMV Team`
    }
};

// ============================================================
// ===== API FUNCTIONS =====
// ============================================================

async function sendEmail(data) {
    try {
        const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error:', error);
        return {
            success: false,
            error: error.message || 'Network error'
        };
    }
}

// ============================================================
// ===== UI FUNCTIONS =====
// ============================================================

function showStatus(message, type = 'info') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';

    // Auto hide after 10 seconds
    clearTimeout(statusDiv._timeout);
    statusDiv._timeout = setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 10000);
}

function addToLog(message, status = 'success') {
    const time = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = 'log-item';
    
    // Remove empty state if present
    const emptyState = activityLog.querySelector('.empty-state');
    if (emptyState) emptyState.remove();

    logEntry.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
            <span>${message}</span>
            <span class="time">${time}</span>
        </div>
        <span class="status-badge ${status}">${status.toUpperCase()}</span>
    `;

    activityLog.prepend(logEntry);

    // Keep only last 20 entries
    while (activityLog.children.length > 20) {
        activityLog.removeChild(activityLog.lastChild);
    }
}

function setLoading(loading) {
    if (loading) {
        sendBtnText.style.display = 'none';
        sendBtnLoading.style.display = 'inline';
        document.querySelector('.btn-primary').disabled = true;
    } else {
        sendBtnText.style.display = 'inline';
        sendBtnLoading.style.display = 'none';
        document.querySelector('.btn-primary').disabled = false;
    }
}

// ============================================================
// ===== FORM HANDLING =====
// ============================================================

emailForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Validate
    if (!toEmail.value || !subject.value || !message.value) {
        showStatus('⚠️ Please fill in all required fields.', 'error');
        return;
    }

    // Build data
    const data = {
        to: toEmail.value,
        name: toName.value || 'Customer',
        subject: subject.value,
        message: message.value,
        orderNumber: orderNumber.value,
        total: orderTotal.value
    };

    setLoading(true);
    showStatus('📤 Sending email...', 'info');

    const result = await sendEmail(data);

    setLoading(false);

    if (result.success) {
        showStatus('✅ Email sent successfully!', 'success');
        addToLog(`📧 Email sent to ${data.to} - ${data.subject}`, 'success');
        
        // Clear form (optional)
        // toEmail.value = '';
        // subject.value = '';
        // message.value = '';
        // orderNumber.value = '';
        // orderTotal.value = '';
    } else {
        showStatus(`❌ Failed to send email: ${result.error}`, 'error');
        addToLog(`❌ Failed to send email to ${data.to}`, 'error');
    }
});

// ============================================================
// ===== TEMPLATE BUTTONS =====
// ============================================================

document.querySelectorAll('.btn-template').forEach(btn => {
    btn.addEventListener('click', function() {
        const templateKey = this.dataset.template;
        const template = templates[templateKey];
        
        if (template) {
            subject.value = template.subject;
            message.value = template.message;
            showStatus(`📋 Template loaded: ${template.subject}`, 'info');
            
            // Scroll to form
            emailForm.scrollIntoView({ behavior: 'smooth' });
        }
    });
});

// ============================================================
// ===== TEST EMAIL =====
// ============================================================

testEmailBtn.addEventListener('click', async () => {
    const testEmail = prompt('Enter your email address to send a test:');
    
    if (!testEmail) return;

    // Validate email
    if (!testEmail.includes('@') || !testEmail.includes('.')) {
        showStatus('⚠️ Please enter a valid email address.', 'error');
        return;
    }

    const data = {
        to: testEmail,
        name: 'Test User',
        subject: '🧪 StockRoomMV Test Email',
        message: `This is a test email from StockRoomMV Notification System.

✅ If you're receiving this, the email system is working perfectly!

Test Details:
- Time: ${new Date().toLocaleString()}
- Service: StockRoomMV Email Service
- Status: ✅ Working

Thank you for using StockRoomMV!`,
        orderNumber: 'TEST-001',
        total: '0.00'
    };

    showStatus('📤 Sending test email...', 'info');
    
    const result = await sendEmail(data);

    if (result.success) {
        showStatus('✅ Test email sent successfully! Check your inbox.', 'success');
        addToLog(`🧪 Test email sent to ${testEmail}`, 'success');
    } else {
        showStatus(`❌ Test failed: ${result.error}`, 'error');
        addToLog(`❌ Test email failed to ${testEmail}`, 'error');
    }
});

// ============================================================
// ===== AUTO-ADD TEST ENTRY =====
// ============================================================

// Add a welcome entry
addToLog('🚀 Notification system ready!', 'success');

// ============================================================
// ===== KEYBOARD SHORTCUTS =====
// ============================================================

document.addEventListener('keydown', (e) => {
    // Ctrl+Enter to send
    if (e.ctrlKey && e.key === 'Enter') {
        emailForm.dispatchEvent(new Event('submit'));
    }
});
