// --- ESTADO ---
let investments = [];
let transactions = [];
let plans = [];

let evolutionPage = 1;
const ITEMS_PER_PAGE = 15;
let filteredEvolutionData = [];

// URL DO APP SCRIPT
const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbw6n_SqtEYQ4lsJHpEr4KF4i2WlI_kKCCgKE32XPEvjlI5F9d9YzCJpVf1ppLirdDM/exec";

// INSTÂNCIAS GRÁFICOS
let charts = { pie: null, bar: null, evo: null, exp: null, comp: null };

window.onload = function() {
    loadLocal();
    initDates();
    renderAll();
    loadFromSheet(); // Busca dados atualizados da planilha
};

// --- NAVEGAÇÃO ---
function showPage(id, el) {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active-section'));
    if(el) {
        document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
        el.classList.add('active');
    }
    const target = document.getElementById(id);
    if(target) {
        target.classList.add('active-section');
        updateCurrentPage(id);
    }
}

function updateCurrentPage(id) {
    if(id === 'dashboard') updateDashboard();
    if(id === 'despesas') renderExpenseAnalysis();
    if(id === 'evolucao') updateEvolutionChart();
    if(id === 'comparativo') updateComparisonDashboard();
}

function checkPasswordAndShowConfig(el) {
    const p = prompt("Senha de acesso:");
    if(p === '2915') showPage('config', el);
}

// --- DATAS ---
function initDates() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    
    setVal('dashGlobalStart', firstDay.toISOString().split('T')[0]);
    setVal('dashGlobalEnd', now.toISOString().split('T')[0]);

    const lastYear = new Date();
    lastYear.setFullYear(now.getFullYear() - 1);
    setVal('filterStartDate', lastYear.toISOString().split('T')[0]);
    setVal('filterEndDate', now.toISOString().split('T')[0]);
}

// --- SALDOS ---
function calculateBalances() {
    let re = 0, pe = 0;
    transactions.forEach(t => {
        const v = parseFloat(t.value) || 0;
        if(t.wallet === 'reinvest') t.type === 'deposit' ? re += v : re -= v;
        else if(t.wallet === 'personal') t.type === 'deposit' ? pe += v : pe -= v;
    });
    return { reinvest: re, personal: pe };
}

// --- TRANSAÇÕES ---
function handleTransaction(type, wallet) {
    const desc = prompt("Descrição da operação:"); if(!desc) return;
    const valStr = prompt("Valor (R$):"); if(!valStr) return;
    const value = parseFloat(valStr.replace(',','.'));
    if(isNaN(value)) return alert("Valor inválido");

    const newT = {
        dataType: 'transaction', id: Date.now(),
        date: new Date().toISOString().split('T')[0],
        type, wallet, desc, value
    };
    transactions.unshift(newT);

    // LÓGICA DE INVESTIMENTO AUTOMÁTICO
    if(wallet === 'personal' && type === 'withdraw' && desc.toLowerCase().includes('investimento')) {
        const syncT = {
            dataType: 'transaction', id: Date.now()+1,
            date: newT.date, type: 'deposit', wallet: 'reinvest',
            desc: `Ref: ${desc}`, value
        };
        transactions.unshift(syncT);
        sendToSheet(syncT);
    }

    saveLocal(); renderAll(); sendToSheet(newT);
}

// --- RENDERIZAÇÃO ---
function renderAll() {
    const saldos = calculateBalances();
    setTxt('balanceReinvest', formatCurrency(saldos.reinvest));
    setTxt('balancePersonal', formatCurrency(saldos.personal));
    
    renderTable('tableBodyReinvest', 'reinvest');
    renderTable('tableBodyPersonal', 'personal');
    updateDashboard();
    renderPlansTable();
    renderHistory();
}

function renderTable(id, wallet) {
    const tb = document.getElementById(id); if(!tb) return;
    tb.innerHTML = '';
    transactions.filter(t => t.wallet === wallet).forEach(t => {
        tb.innerHTML += `<tr>
            <td>${t.date.split('-').reverse().join('/')}</td>
            <td class="${t.type==='deposit'?'text-green':'text-red'}">${t.type==='deposit'?'Entrada':'Saída'}</td>
            <td>${t.desc}</td>
            <td>${formatCurrency(t.value)}</td>
            <td><button onclick="deleteTransaction(${t.id})">🗑️</button></td>
        </tr>`;
    });
}

// --- DASHBOARD ---
function updateDashboard() {
    const start = new Date(getVal('dashGlobalStart'));
    const end = new Date(getVal('dashGlobalEnd'));
    const b = calculateBalances();

    let inc = 0, exp = 0;
    transactions.forEach(t => {
        const d = new Date(t.date);
        if(d >= start && d <= end) {
            t.type === 'deposit' ? inc += t.value : exp += t.value;
        }
    });

    setTxt('dashPeriodIncome', formatCurrency(inc));
    setTxt('dashPeriodExpense', formatCurrency(exp));
    setTxt('dashBalanceReinvest', formatCurrency(b.reinvest));
    const totalInv = investments.reduce((a, b) => a + (parseFloat(b.value)||0), 0);
    setTxt('dashTotalInvested', formatCurrency(totalInv));

    renderDashCharts(inc, exp);
}

function renderDashCharts(inc, exp) {
    const ctx = document.getElementById('barChartDash'); if(!ctx) return;
    if(charts.bar) charts.bar.destroy();
    charts.bar = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: { labels: ['Receitas', 'Despesas'], datasets: [{ data: [inc, exp], backgroundColor: ['#00b894', '#ff7675'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
    renderPieChart();
}

function renderPieChart() {
    const ctx = document.getElementById('pieChart'); if(!ctx) return;
    const types = {};
    investments.forEach(i => types[i.type] = (types[i.type] || 0) + (parseFloat(i.value)||0));
    if(charts.pie) charts.pie.destroy();
    charts.pie = new Chart(ctx.getContext('2d'), {
        type: 'doughnut',
        data: { labels: Object.keys(types), datasets: [{ data: Object.values(types), backgroundColor: ['#0984e3', '#00b894', '#6c5ce7', '#ff7675', '#fdcb6e'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#fff' } } } }
    });
}

// --- DESPESAS ---
function renderExpenseAnalysis() {
    const container = document.getElementById('expenseTree');
    const tableBody = document.getElementById('expenseTableBody');
    if(!container || !tableBody) return;
    
    container.innerHTML = ''; tableBody.innerHTML = '';
    const expenses = transactions.filter(t => t.type === 'withdraw' && t.wallet === 'personal');
    const categories = {};
    
    expenses.forEach(e => {
        const cat = e.desc.split(' ')[0] || 'Geral';
        if(!categories[cat]) categories[cat] = { total: 0, items: [] };
        categories[cat].total += e.value;
        categories[cat].items.push(e);
        tableBody.innerHTML += `<tr><td>${e.date}</td><td>${cat}</td><td>${e.desc}</td><td>${formatCurrency(e.value)}</td></tr>`;
    });

    for(let cat in categories) {
        const node = document.createElement('div');
        node.className = 'tree-node';
        node.innerHTML = `<div class="tree-category"><span>${cat}</span><span>${formatCurrency(categories[cat].total)}</span></div>`;
        categories[cat].items.forEach(item => {
            node.innerHTML += `<div class="tree-item"><span>${item.desc}</span><span>${formatCurrency(item.value)}</span></div>`;
        });
        container.appendChild(node);
    }
}

// --- EVOLUÇÃO ---
function updateEvolutionChart() {
    const ctx = document.getElementById('evolutionChart'); if(!ctx) return;
    const startStr = getVal('filterStartDate');
    const endStr = getVal('filterEndDate');
    const typeF = getVal('filterType');

    const startDate = new Date(startStr);
    const endDate = new Date(endStr);
    const filteredInv = investments.filter(i => typeF === 'all' || i.type === typeF);

    const labels = [];
    const dataPoints = [];
    const tableData = [];

    let curr = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const limit = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0);
    let prevVal = 0;

    while (curr <= limit) {
        const label = `${String(curr.getMonth()+1).padStart(2,'0')}/${curr.getFullYear()}`;
        let total = 0;
        
        filteredInv.forEach(inv => {
            const p = inv.date.split('-');
            const iDate = new Date(p[0], p[1]-1, p[2]);

            if (curr >= iDate) {
                const diffM = (curr - iDate) / (1000 * 60 * 60 * 24 * 30.44);
                let taxaA = 0.10; 
                if (inv.ratePrev) {
                   const r = parseFloat(inv.ratePrev);
                   if (inv.rateTypePrev.includes('CDI')) taxaA = (r/100) * 0.1125;
                   else if (inv.rateTypePrev.includes('IPCA')) taxaA = 0.045 + (r/100);
                   else taxaA = r/100;
                }
                const taxaM = Math.pow(1 + taxaA, 1/12) - 1;
                total += inv.value * Math.pow(1 + taxaM, Math.max(0, diffM));
            }
        });

        labels.push(label);
        dataPoints.push(total);
        tableData.push({ date: label, total, growth: dataPoints.length === 1 ? 0 : total - prevVal });
        prevVal = total;
        curr.setMonth(curr.getMonth() + 1);
    }

    if(charts.evo) charts.evo.destroy();
    charts.evo = new Chart(ctx.getContext('2d'), {
        type: 'line',
        data: { labels, datasets: [{ label: 'Patrimônio Projetado', data: dataPoints, borderColor: '#00b894', fill: true, backgroundColor: 'rgba(0,184,148,0.1)', tension: 0.3 }] },
        options: { responsive: true, maintainAspectRatio: false }
    });

    filteredEvolutionData = tableData;
    evolutionPage = 1;
    renderEvoTable();
}

function renderEvoTable() {
    const tb = document.querySelector('#evolutionTable tbody'); if(!tb) return;
    tb.innerHTML = '';
    const start = (evolutionPage - 1) * ITEMS_PER_PAGE;
    filteredEvolutionData.slice(start, start + ITEMS_PER_PAGE).forEach(r => {
        tb.innerHTML += `<tr><td>${r.date}</td><td>${formatCurrency(r.total)}</td><td class="${r.growth>=0?'text-green':'text-red'}">${formatCurrency(r.growth)}</td></tr>`;
    });
    setTxt('pageIndicator', `Página ${evolutionPage}`);
}

function changeEvoPage(dir) {
    const max = Math.ceil(filteredEvolutionData.length / ITEMS_PER_PAGE);
    if(dir === 1 && evolutionPage < max) { evolutionPage++; renderEvoTable(); }
    else if(dir === -1 && evolutionPage > 1) { evolutionPage--; renderEvoTable(); }
}

// --- COMPARATIVO ---
function updateComparisonDashboard() {
    const realized = {};
    investments.forEach(inv => {
        const key = inv.date.slice(0, 7);
        realized[key] = (realized[key] || 0) + parseFloat(inv.value);
    });
    const planned = {};
    plans.forEach(p => {
        const key = p.monthYear;
        planned[key] = (planned[key] || 0) + parseFloat(p.targetValue);
    });

    const months = Array.from(new Set([...Object.keys(realized), ...Object.keys(planned)])).sort();
    const tP = Object.values(planned).reduce((a,b)=>a+b, 0);
    const tR = Object.values(realized).reduce((a,b)=>a+b, 0);
    
    setTxt('compTotalPlanned', formatCurrency(tP));
    setTxt('compTotalRealized', formatCurrency(tR));
    setTxt('compPercentage', tP > 0 ? ((tR/tP)*100).toFixed(1) + '%' : '0%');

    const ctx = document.getElementById('compBarChart'); if(!ctx) return;
    if(charts.comp) charts.comp.destroy();
    charts.comp = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: { labels: months, datasets: [
            { label: 'Planejado', data: months.map(m => planned[m] || 0), backgroundColor: 'rgba(255,255,255,0.1)' },
            { label: 'Realizado', data: months.map(m => realized[m] || 0), backgroundColor: '#00b894' }
        ]},
        options: { responsive: true, maintainAspectRatio: false }
    });
}

// --- FORMS ---
document.getElementById('investForm').onsubmit = (e) => {
    e.preventDefault();
    const b = calculateBalances();
    const val = parseFloat(getVal('inpValue'));
    if(val > b.reinvest) return alert("Saldo insuficiente no Giro!");
    
    const newI = {
        dataType: 'investment', id: Date.now(),
        name: getVal('inpName'), institution: getVal('inpInst'),
        type: getVal('inpType'), value: val, date: getVal('inpDate'),
        expiry: getVal('inpExpiry'), ratePrev: getVal('inpRatePrev'),
        rateTypePrev: getVal('inpRateTypePrev'), status: getVal('inpStatus')
    };
    const sync = {
        dataType: 'transaction', id: Date.now()+1,
        date: newI.date, type: 'withdraw', wallet: 'reinvest',
        desc: `Aporte: ${newI.name}`, value: val
    };
    investments.push(newI); transactions.unshift(sync);
    saveLocal(); renderAll(); sendToSheet(newI); sendToSheet(sync);
    e.target.reset(); alert("Aporte salvo!");
};

document.getElementById('planForm').onsubmit = (e) => {
    e.preventDefault();
    const newP = { id: Date.now(), monthYear: getVal('inpPlanMonth'), targetValue: parseFloat(getVal('inpPlanValue')), category: getVal('inpPlanCategory') };
    plans.push(newP); saveLocal(); renderPlansTable(); alert("Meta salva!");
};

// --- PERSISTÊNCIA & SHEET ---
function formatCurrency(v) { return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function getVal(id) { return document.getElementById(id).value; }
function setVal(id, v) { const el = document.getElementById(id); if(el) el.value = v; }
function setTxt(id, t) { const el = document.getElementById(id); if(el) el.innerText = t; }

function saveLocal() {
    localStorage.setItem('investments', JSON.stringify(investments));
    localStorage.setItem('transactions', JSON.stringify(transactions));
    localStorage.setItem('plans', JSON.stringify(plans));
}
function loadLocal() {
    investments = JSON.parse(localStorage.getItem('investments')) || [];
    transactions = JSON.parse(localStorage.getItem('transactions')) || [];
    plans = JSON.parse(localStorage.getItem('plans')) || [];
}

async function sendToSheet(d) {
    try { await fetch(GOOGLE_SHEET_URL, { method:'POST', mode:'no-cors', body: JSON.stringify(d) }); } catch(e) {}
}

async function loadFromSheet() {
    const ind = document.getElementById('syncIndicator');
    try {
        // Timestamp para evitar cache do navegador e forçar atualização real do Sheets
        const res = await fetch(`${GOOGLE_SHEET_URL}?t=${Date.now()}`);
        const d = await res.json();
        if(d.investments) investments = d.investments;
        if(d.transactions) transactions = d.transactions;
        if(ind) { ind.innerText = "Online"; ind.className = "status-indicator status-online"; }
        renderAll();
    } catch(e) {
        if(ind) { ind.innerText = "Local"; ind.className = "status-indicator status-offline"; }
    }
}

function deleteTransaction(id) { if(confirm("Apagar?")) { transactions = transactions.filter(t=>t.id!==id); saveLocal(); renderAll(); } }
function deleteInvestment(id) { if(confirm("Apagar?")) { investments = investments.filter(i=>i.id!==id); saveLocal(); renderAll(); } }
function clearAllData() { if(confirm("Limpar local?")) { localStorage.clear(); location.reload(); } }

function renderPlansTable() {
    const tb = document.getElementById('plansTableBody'); if(!tb) return;
    tb.innerHTML = '';
    plans.forEach(p => tb.innerHTML += `<tr><td>${p.monthYear}</td><td>${p.category}</td><td>${formatCurrency(p.targetValue)}</td><td><button onclick="deletePlan(${p.id})">🗑️</button></td></tr>`);
}
function renderHistory() {
    const tb = document.getElementById('investTableBody'); if(!tb) return;
    tb.innerHTML = '';
    investments.forEach(i => tb.innerHTML += `<tr><td>${i.name}</td><td>${i.date}</td><td>${i.expiry||'-'}</td><td>${formatCurrency(i.value)}</td><td><button onclick="deleteInvestment(${i.id})">🗑️</button></td></tr>`);
}
function deletePlan(id) { plans = plans.filter(p=>p.id!==id); renderPlansTable(); saveLocal(); }


