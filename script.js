// ==========================================
// 1. FIREBASE CONFIGURATION
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyD9aGM-M-gGPvGFQMLQx7slBVYMWimQjJo",
  authDomain: "expense-tracker-ba1be.firebaseapp.com",
  projectId: "expense-tracker-ba1be",
  storageBucket: "expense-tracker-ba1be.firebasestorage.app",
  messagingSenderId: "881840768164",
  appId: "1:881840768164:web:28dd15384fed43989b9231",
  measurementId: "G-S8Q0D03Y1H"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
let currentUser = null;

// Listen for Login/Logout
auth.onAuthStateChanged(user => {
    currentUser = user;
    if(user) {
        document.getElementById('sync-btn-text').textContent = "☁️ Synced: " + user.email.split('@')[0];
        document.getElementById('logout-btn').style.display = 'block';
        document.getElementById('login-btn').style.display = 'none';
        syncFromCloud(); // Pull data when logged in
    } else {
        document.getElementById('sync-btn-text').textContent = "☁️ Cloud Sync";
        document.getElementById('logout-btn').style.display = 'none';
        document.getElementById('login-btn').style.display = 'block';
    }
});

// ==========================================
// 2. CONFIG & STATE VARIABLES
// ==========================================
const EXCHANGE_RATES = { INR: 1, USD: 83.5, EUR: 90.2, GBP: 105.1 };
    
let CATEGORIES = {
    'Food': { color: '#FF6B6B', icon: '🍔' },
    'Transport': { color: '#4ECDC4', icon: '🚗' },
    'Shopping': { color: '#45B7D1', icon: '🛍️' },
    'Health': { color: '#96CEB4', icon: '💊' },
    'Entertainment': { color: '#FFEAA7', icon: '🍿' },
    'Bills': { color: '#DDA0DD', icon: '📄' },
    'Others': { color: '#98D8C8', icon: '📦' }
};

let deletedExpenseCache = null;
let deletedExpenseTimeout = null;
let expenses = [];
let budget = 10000;
let theme = 'light';
let filterCat = 'All';
let filterDate = 'month';
let catBudgets = {};
let goals = [];

let donutChart, trendChart;

// ==========================================
// 3. INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    checkRecurringExpenses();
    applyTheme();
    populateCategoryDropdowns();
    renderAll();
    
    document.getElementById('theme-toggle').addEventListener('click', () => {
        theme = theme === 'light' ? 'dark' : 'light';
        applyTheme(); saveData();
    });
    
    document.getElementById('budget-input').addEventListener('change', (e) => {
        budget = Number(e.target.value) || 1; saveData(); renderDashboard();
    });

    document.getElementById('add-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('budget-input').value = budget;
    
    document.getElementById('date-filter').addEventListener('change', e => { filterDate = e.target.value; renderAll(); });
    document.getElementById('search-input').addEventListener('input', renderList);
    
    setupAddForm();
});

// ==========================================
// 4. CORE DATA LOGIC
// ==========================================
function loadData() {
    try {
        expenses = JSON.parse(localStorage.getItem('expenses')) || [];
        budget = Number(localStorage.getItem('budget')) || 10000;
        theme = localStorage.getItem('theme') || 'light';
        const customCats = JSON.parse(localStorage.getItem('customCategories')) || {};
        CATEGORIES = { ...CATEGORIES, ...customCats };
        catBudgets = JSON.parse(localStorage.getItem('catBudgets')) || {};
        goals = JSON.parse(localStorage.getItem('goals')) || [];
    } catch(e) { console.error('Load error', e); }
}

function saveData() {
    // 1. Save locally (works offline)
    localStorage.setItem('expenses', JSON.stringify(expenses));
    localStorage.setItem('budget', budget);
    localStorage.setItem('theme', theme);
    localStorage.setItem('catBudgets', JSON.stringify(catBudgets));
    localStorage.setItem('goals', JSON.stringify(goals));
    
    const baseKeys = ['Food','Transport','Shopping','Health','Entertainment','Bills','Others'];
    const custom = {};
    for(let k in CATEGORIES) { if(!baseKeys.includes(k)) custom[k] = CATEGORIES[k]; }
    localStorage.setItem('customCategories', JSON.stringify(custom));

    // 2. Save to Firebase (if logged in)
    if(currentUser) {
        // Strip image base64s from cloud sync to prevent exceeding Firestore 1MB limits per doc
        const cloudExpenses = expenses.map(e => {
            const { receiptBase64, ...rest } = e; 
            return rest;
        });

        db.collection('users').doc(currentUser.uid).set({
            expenses: cloudExpenses,
            budget, 
            theme, 
            catBudgets, 
            goals,
            customCategories: custom
        }).catch(err => console.error("Cloud save failed:", err));
    }
}

function checkRecurringExpenses() {
    const today = new Date();
    const currentMonthStr = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2, '0');
    
    const recurringExps = expenses.filter(e => e.recurring);
    let addedAny = false;

    recurringExps.forEach(rx => {
        // Check if this specific recurring item already exists this month
        const existsThisMonth = expenses.some(e => e.title === rx.title && e.recurring && e.date.startsWith(currentMonthStr));
        if (!existsThisMonth) {
            expenses.push({
                ...rx,
                id: Date.now().toString() + Math.random(),
                date: `${currentMonthStr}-01`, 
                createdAt: new Date().toISOString()
            });
            addedAny = true;
        }
    });
    
    if(addedAny) {
        saveData();
        showToast("Added monthly recurring expenses.", "info");
    }
}

// ==========================================
// 5. UI RENDERING
// ==========================================
function renderAll() {
    renderDashboard();
    renderList();
    renderCharts();
    renderGoals();
    populateCatBudgetsModal();
}

function applyTheme() {
    document.documentElement.setAttribute('data-theme', theme);
    document.getElementById('theme-toggle').textContent = theme === 'dark' ? '☀️' : '🌙';
    if(donutChart) renderCharts();
}

function populateCategoryDropdowns() {
    const select = document.getElementById('add-category');
    select.innerHTML = '';
    const filtersDiv = document.getElementById('category-filters');
    filtersDiv.innerHTML = '<div class="pill active" onclick="setCatFilter(\'All\', this)">All</div>';

    Object.keys(CATEGORIES).forEach(cat => {
        select.innerHTML += `<option value="${cat}">${CATEGORIES[cat].icon} ${cat}</option>`;
        filtersDiv.innerHTML += `<div class="pill" onclick="setCatFilter('${cat}', this)">${CATEGORIES[cat].icon} ${cat}</div>`;
    });
}

function setCatFilter(cat, element) {
    filterCat = cat;
    document.querySelectorAll('#category-filters .pill').forEach(p => p.classList.remove('active'));
    element.classList.add('active');
    renderList();
}

function getFiltered() {
    const search = document.getElementById('search-input').value.toLowerCase();
    const now = new Date();
    
    return expenses.filter(e => {
        if (filterCat !== 'All' && e.category !== filterCat) return false;
        if (search && !e.title.toLowerCase().includes(search)) return false;
        
        if (filterDate === 'month') {
            const ed = new Date(e.date);
            if (ed.getMonth() !== now.getMonth() || ed.getFullYear() !== now.getFullYear()) return false;
        }
        return true;
    }).sort((a,b) => new Date(b.date) - new Date(a.date));
}

function renderDashboard() {
    const monthExps = expenses.filter(e => {
        const ed = new Date(e.date); const now = new Date();
        return ed.getMonth() === now.getMonth() && ed.getFullYear() === now.getFullYear();
    });
    
    const totalMonth = monthExps.reduce((sum, e) => sum + e.amountINR, 0);
    document.getElementById('hero-total').textContent = `₹${totalMonth.toFixed(0)}`;
    document.getElementById('hero-count').textContent = monthExps.length;
    document.getElementById('hero-avg').textContent = `₹${monthExps.length ? (totalMonth / new Date().getDate()).toFixed(0) : 0}`;
    
    const cats = {}; monthExps.forEach(e => cats[e.category] = (cats[e.category]||0) + e.amountINR);
    const topCat = Object.keys(cats).sort((a,b)=>cats[b]-cats[a])[0];
    document.getElementById('hero-top-cat').textContent = topCat ? `${CATEGORIES[topCat].icon} ${topCat}` : '-';

    const p = Math.min(100, Math.round((totalMonth / budget) * 100));
    document.getElementById('budget-percent').textContent = p + '%';
    document.getElementById('budget-remaining').textContent = Math.max(0, budget - totalMonth).toFixed(0);
    
    const ring = document.getElementById('budget-ring-fg');
    ring.style.strokeDashoffset = 452.38 - (p / 100) * 452.38;
    ring.style.stroke = p > 90 ? 'var(--danger)' : p > 75 ? 'var(--warning)' : 'var(--success)';

    const totalOwed = expenses.reduce((sum, e) => sum + (e.splitAmount || 0), 0);
    document.getElementById('owed-total').textContent = `₹${totalOwed.toFixed(0)}`;
}

function renderList() {
    const list = document.getElementById('expense-list');
    const data = getFiltered();
    list.innerHTML = '';
    
    if (!data.length) {
        list.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">No expenses found.</p>';
        return;
    }

    data.forEach(e => {
        const cat = CATEGORIES[e.category] || CATEGORIES['Others'];
        let metaHtml = `${new Date(e.date).toLocaleDateString('en-IN')} • ${e.category}`;
        if(e.recurring) metaHtml += ` <span class="badge">🔁 Monthly</span>`;
        if(e.splitAmount) metaHtml += ` <span class="badge" style="color:var(--warning)">Owed: ₹${e.splitAmount} (${e.splitWho})</span>`;
        
        let receiptHtml = e.receiptBase64 ? `<img src="${e.receiptBase64}" class="receipt-thumb" onclick="viewReceipt('${e.id}')">` : '';

        list.innerHTML += `
            <div class="expense-item">
                <div class="cat-icon" style="background:${cat.color}20; color:${cat.color}">${cat.icon}</div>
                <div class="expense-details">
                    <div class="expense-title">${e.title}</div>
                    ${e.note ? `<div class="expense-note">${e.note}</div>` : ''}
                    <div class="expense-meta">${metaHtml}</div>
                </div>
                ${receiptHtml}
                <div class="expense-amount">
                    ₹${e.amountINR.toFixed(2)}
                    ${e.currency !== 'INR' ? `<span class="orig">${e.currency} ${e.amount}</span>` : ''}
                </div>
                <div class="expense-actions">
                    <button class="btn-icon" style="color:var(--danger)" onclick="deleteExpense('${e.id}')">🗑️</button>
                </div>
            </div>
        `;
    });
}

// ==========================================
// 6. FORM & LOGIC
// ==========================================
function setupAddForm() {
    const fileInput = document.getElementById('add-receipt');
    let receiptBase64 = null;

    fileInput.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = e => receiptBase64 = e.target.result;
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('add-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const cat = document.getElementById('add-category').value;
        const currency = document.getElementById('add-currency').value;
        const amount = Number(document.getElementById('add-amount').value);
        const amountINR = amount * (EXCHANGE_RATES[currency] || 1);
        
        if (catBudgets[cat]) {
            const monthExps = expenses.filter(ex => ex.category === cat && new Date(ex.date).getMonth() === new Date().getMonth());
            const currentCatSpend = monthExps.reduce((s, ex) => s + ex.amountINR, 0);
            if (currentCatSpend + amountINR > catBudgets[cat]) {
                showToast(`Warning: This exceeds your ${cat} budget cap!`, 'warning');
            }
        }

        expenses.push({
            id: Date.now().toString(),
            title: document.getElementById('add-title').value,
            amount, currency, amountINR, category: cat,
            date: document.getElementById('add-date').value,
            recurring: document.getElementById('add-recurring').checked,
            splitAmount: document.getElementById('add-split').checked ? Number(document.getElementById('split-amount').value||0) : 0,
            splitWho: document.getElementById('split-who').value,
            note: document.getElementById('add-note').value,
            receiptBase64,
            createdAt: new Date().toISOString()
        });

        saveData();
        e.target.reset();
        receiptBase64 = null;
        document.getElementById('add-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('split-fields').style.display = 'none';
        renderAll();
        showToast('Expense added!', 'success');
    });
}

window.deleteExpense = function(id) {
    const index = expenses.findIndex(e => e.id === id);
    if (index > -1) {
        // 1. Save it to cache before deleting
        deletedExpenseCache = { exp: expenses[index], index: index };
        
        // 2. Remove it from the array
        expenses.splice(index, 1);
        saveData(); 
        renderAll();
        
        // 3. Show the toast with the undo flag set to true
        showToast('Expense deleted', 'info', true);
        
        // 4. Clear the cache permanently after 5 seconds
        if (deletedExpenseTimeout) clearTimeout(deletedExpenseTimeout);
        deletedExpenseTimeout = setTimeout(() => { 
            deletedExpenseCache = null; 
        }, 5000);
    }
};

window.undoDelete = function() {
    if (deletedExpenseCache) {
        // Put the expense back in its original spot
        expenses.splice(deletedExpenseCache.index, 0, deletedExpenseCache.exp);
        deletedExpenseCache = null; 
        
        saveData(); 
        renderAll();
        showToast('Expense restored!', 'success');
    }
};

function processAIText() {
    const text = document.getElementById('ai-text').value;
    if(!text) return;
    
    let amountMatch = text.match(/(?:Rs\.?|INR)?\s*([\d,]+(?:\.\d+)?)/i);
    if(amountMatch) {
        document.getElementById('add-amount').value = amountMatch[1].replace(/,/g, '');
    }
    
    const lower = text.toLowerCase();
    let guessedCat = 'Others';
    if(lower.includes('zomato') || lower.includes('swiggy') || lower.includes('food') || lower.includes('restaurant')) guessedCat = 'Food';
    if(lower.includes('uber') || lower.includes('ola') || lower.includes('petrol') || lower.includes('flight')) guessedCat = 'Transport';
    if(lower.includes('netflix') || lower.includes('movie') || lower.includes('spotify')) guessedCat = 'Entertainment';
    if(lower.includes('amazon') || lower.includes('flipkart') || lower.includes('myntra')) guessedCat = 'Shopping';
    if(lower.includes('pharmacy') || lower.includes('hospital') || lower.includes('clinic')) guessedCat = 'Health';
    
    document.getElementById('add-category').value = guessedCat;
    document.getElementById('add-title').value = "Auto-filled from SMS";
    showToast("Auto-filled details via simulated AI", "info");
}

// ==========================================
// 7. CHARTS & GOALS
// ==========================================
function renderCharts() {
    const tc = theme === 'dark' ? '#F5F6FA' : '#2D3436';
    Chart.defaults.color = tc; Chart.defaults.font.family = 'Inter';
    
    const monthExps = expenses.filter(e => new Date(e.date).getMonth() === new Date().getMonth());
    const cats = {}; monthExps.forEach(e => cats[e.category] = (cats[e.category]||0) + e.amountINR);

    if(donutChart) donutChart.destroy();
    donutChart = new Chart(document.getElementById('donut-chart'), {
        type: 'doughnut',
        data: { labels: Object.keys(cats), datasets: [{ data: Object.values(cats), backgroundColor: Object.keys(cats).map(c=>CATEGORIES[c].color), borderWidth:0 }] },
        options: { responsive:true, maintainAspectRatio:false, plugins: { legend: { position:'right', labels:{boxWidth:10} } }, cutout:'65%' }
    });

    const months = []; const trendData = [];
    for(let i=5; i>=0; i--) {
        let d = new Date(); d.setMonth(d.getMonth() - i);
        months.push(d.toLocaleString('default', { month: 'short' }));
        let sum = expenses.filter(e => new Date(e.date).getMonth() === d.getMonth() && new Date(e.date).getFullYear() === d.getFullYear()).reduce((s,e)=>s+e.amountINR, 0);
        trendData.push(sum);
    }

    if(trendChart) trendChart.destroy();
    trendChart = new Chart(document.getElementById('trend-chart'), {
        type: 'bar',
        data: { labels: months, datasets: [{ label: 'Spend ₹', data: trendData, backgroundColor: '#0984E3', borderRadius:4 }] },
        options: { responsive:true, maintainAspectRatio:false, plugins: { legend: { display:false } }, scales: { y: { beginAtZero:true, grid:{color:theme==='dark'?'#2F3640':'#DFE6E9'} }, x:{grid:{display:false}} } }
    });
}

function renderGoals() {
    const list = document.getElementById('goals-list');
    list.innerHTML = '';
    goals.forEach((g, idx) => {
        const p = Math.min(100, (g.current / g.target) * 100);
        list.innerHTML += `
            <li class="goal-item">
                <div style="display:flex; justify-content:space-between; font-size:0.9rem;">
                    <strong>${g.name}</strong> <span>₹${g.current} / ₹${g.target}</span>
                </div>
                <div class="progress-bar"><div class="progress-fill" style="width:${p}%"></div></div>
            </li>
        `;
    });
}

function saveGoal() {
    goals.push({
        name: document.getElementById('goal-name').value,
        target: Number(document.getElementById('goal-target').value),
        current: Number(document.getElementById('goal-current').value)
    });
    saveData(); renderGoals(); closeModal('add-goal-modal');
}

// ==========================================
// 8. MODALS & EXTRAS
// ==========================================
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

function viewReceipt(id) {
    const exp = expenses.find(e => e.id === id);
    if(exp && exp.receiptBase64) {
        document.getElementById('receipt-large').src = exp.receiptBase64;
        openModal('receipt-modal');
    }
}

function saveCustomCategory() {
    const name = document.getElementById('new-cat-name').value;
    const icon = document.getElementById('new-cat-icon').value || '📌';
    const color = document.getElementById('new-cat-color').value;
    if(name) {
        CATEGORIES[name] = { color, icon };
        saveData(); populateCategoryDropdowns(); closeModal('add-cat-modal'); showToast('Category Added');
    }
}

function populateCatBudgetsModal() {
    const list = document.getElementById('cat-budget-list');
    list.innerHTML = '';
    Object.keys(CATEGORIES).forEach(cat => {
        const val = catBudgets[cat] || '';
        list.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span>${CATEGORIES[cat].icon} ${cat}</span>
                <div style="display:flex; gap:4px; width:150px;">
                    <input type="number" placeholder="No limit" value="${val}" onchange="saveCatBudget('${cat}', this.value)" style="padding:4px 8px;">
                </div>
            </div>
        `;
    });
}

function saveCatBudget(cat, val) {
    if(val) catBudgets[cat] = Number(val);
    else delete catBudgets[cat];
    saveData();
}

function importCSV() {
    const text = document.getElementById('csv-input').value;
    const lines = text.split('\n');
    let added = 0;
    lines.forEach(l => {
        const parts = l.split(',');
        if(parts.length >= 4) {
            expenses.push({
                id: Date.now().toString() + Math.random(),
                date: parts[0].trim(), title: parts[1].trim(), category: parts[2].trim(),
                amount: Number(parts[3]), amountINR: Number(parts[3]), currency: 'INR',
                createdAt: new Date().toISOString()
            });
            added++;
        }
    });
    saveData(); renderAll(); closeModal('settings-modal');
    showToast(`Imported ${added} expenses!`, 'success');
}

// ==========================================
// 9. FIREBASE AUTHENTICATION & SYNC
// ==========================================
async function cloudLogin() {
    const email = document.getElementById('sync-email').value;
    const pass = document.getElementById('sync-pass').value;
    if(!email || !pass) return showToast('Please enter email and password', 'warning');

    const btn = document.getElementById('login-btn');
    btn.textContent = "Connecting...";

    try {
        await auth.signInWithEmailAndPassword(email, pass);
        closeModal('cloud-sync-modal');
        showToast('Logged in successfully!', 'success');
    } catch(e) {
        if(e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
            try {
                await auth.createUserWithEmailAndPassword(email, pass);
                closeModal('cloud-sync-modal');
                showToast('Account created & logged in!', 'success');
                saveData(); 
            } catch(err) {
                showToast(err.message, 'danger');
            }
        } else {
            showToast(e.message, 'danger');
        }
    }
    btn.textContent = "Login & Sync";
}

function cloudLogout() {
    auth.signOut();
    closeModal('cloud-sync-modal');
    showToast('Logged out. App is now local only.', 'info');
}

async function syncFromCloud() {
    try {
        const doc = await db.collection('users').doc(currentUser.uid).get();
        if(doc.exists) {
            const data = doc.data();
            
            expenses = data.expenses || [];
            budget = data.budget || 10000;
            theme = data.theme || 'light';
            catBudgets = data.catBudgets || {};
            goals = data.goals || [];
            
            const customCats = data.customCategories || {};
            CATEGORIES = { ...CATEGORIES, ...customCats };

            saveData(); 
            applyTheme();
            populateCategoryDropdowns();
            renderAll();
            
            showToast('Data synced from cloud! ☁️', 'success');
        }
    } catch(e) {
        console.error("Error fetching cloud data", e);
    }
}

// ==========================================
// 10. UTILS
// ==========================================
function showToast(msg, type='info', withUndo=false) {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.style.borderColor = `var(--${type==='warning'?'warning':type==='success'?'success':'primary'})`;
    
    // Inject the Undo button HTML if withUndo is true
    t.innerHTML = `
        <span style="display:flex; align-items:center;">
            ${msg} 
            ${withUndo ? '<button class="toast-undo" onclick="undoDelete(); this.closest(\'.toast\').remove()">Undo</button>' : ''}
        </span>
    `;
    
    c.appendChild(t);
    
    // Extend the toast duration to 5 seconds so they have time to click undo
    setTimeout(() => { if(t.parentElement) t.remove(); }, 5000); 
}