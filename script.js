// --- ESTADO GLOBAL ---
let investments = [];
let transactions = [];
let plans = [];

// Configuração da Evolução e Paginação
let evolutionPage = 1;
const ITEMS_PER_PAGE = 20;
let filteredEvolutionData = [];

// URL DO APP SCRIPT
const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbzW-kPYS2xDqSyEjE04iwL_FXR_ZaRqKeXdw5XadLH47QobjHHNbI-biORVsgNBHVaIxg/exec"; 

// Instâncias dos Gráficos
let pieChart = null, barChartDash = null, evoChart = null, expChart = null, compBarChart = null;

window.onload = function() {
    loadLocal();
    initDefaultDates();
    renderAll();
    setTimeout(loadFromSheet, 500);
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
        updatePageContent(id);
    }
}

function updatePageContent(id) {
    if(id === 'dashboard') updateDashboard();
    if(id === 'despesas') renderExpenseAnalysis();
    if(id === 'evolucao') updateEvolutionChart();
    if(id === 'comparativo') updateComparisonDashboard();
    if(id === 'planejamento') renderPlansTable();
    if(id === 'historico') renderHistory();
}

function checkPasswordAndShowConfig(el) {
    const p = prompt("Senha:");
    if(p === '2915') showPage('config', el);
}

// --- DATAS PADRÃO ---
function initDefaultDates() {
    const today = new Date();
    const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const ds = document.getElementById('dashGlobalStart');
    const de = document.getElementById('dashGlobalEnd');
    if(ds) ds.value = startMonth.toISOString().split('T')[0];
    if(de) de.value = today.toISOString().split('T')[0];

    const es = document.getElementById('filterStartDate');
    const ee = document.getElementById('filterEndDate');
    if(es && ee) {
        const lastYear = new Date();
        lastYear.setFullYear(today.getFullYear() - 1);
        es.value = lastYear.toISOString().split('T')[0];
        ee.value = today.toISOString().split('T')[0];
    }
}

// --- CÁLCULOS DE SALDO ---
function getBalances() {
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
    const desc = prompt("Descrição:"); if(!desc) return;
    const valStr = prompt("Valor:"); if(!valStr) return;
    const value = parseFloat(valStr.replace(',','.'));
    if(isNaN(value)) return alert("Valor inválido");

    const newT = {
        dataType: 'transaction', id: Date.now(),
        date: new Date().toISOString().split('T')[0],
        type, wallet, desc, value
    };
    transactions.unshift(newT);

    // LOGICA DE INVESTIMENTO AUTOMÁTICO
    if(wallet === 'personal' && type === 'withdraw' && (desc.toLowerCase().includes('investimento') || desc.toLowerCase().includes('investir'))) {
        const syncT = {
            dataType: 'transaction', id: Date.now()+1,
            date: newT.date, type: 'deposit', wallet: 'reinvest',
            desc: `Origem Pessoal: ${desc}`, value
        };
        transactions.unshift(syncT);
        sendToSheet(syncT);
    }

    saveLocal(); renderAll(); sendToSheet(newT);
}

// --- RENDERIZAÇÃO GERAL ---
function renderAll() {
    const b = getBalances();
    const br = document.getElementById('balanceReinvest');
    const bp = document.getElementById('balancePersonal');
    if(br) br.innerText = formatCurrency(b.reinvest);
    if(bp) bp.innerText = formatCurrency(b.personal);
    
    renderTable('tableBodyReinvest', 'reinvest');
    renderTable('tableBodyPersonal', 'personal');
    updateDashboard();
    renderPlansTable();
    renderHistory();
}

function renderTable(bodyId, walletFilter) {
    const tb = document.getElementById(bodyId);
    if(!tb) return;
    tb.innerHTML = '';
    transactions.filter(t => t.wallet === walletFilter).forEach(t => {
        tb.innerHTML += `<tr>
            <td>${t.date.split('-').reverse().join('/')}</td>
            <td class="${t.type==='deposit'?'text-green':'text-red'}">${t.type==='deposit'?'Entrada':'Saída'}</td>
            <td>${t.desc}</td>
            <td>${formatCurrency(t.value)}</td>
            <td><button class="btn-icon" onclick="deleteTransaction(${t.id})">🗑️</button></td>
        </tr>`;
    });
}

// --- DASHBOARD ---
function updateDashboard() {
    const ds = document.getElementById('dashGlobalStart');
    const de = document.getElementById('dashGlobalEnd');
    if(!ds || !de) return;
    
    const start = new Date(ds.value);
    const end = new Date(de.value);
    const b = getBalances();

    let inc = 0, exp = 0;
    transactions.forEach(t => {
        const d = new Date(t.date);
        if(d >= start && d <= end) {
            if(t.type === 'deposit') inc += t.value;
            else exp += t.value;
        }
    });

    setElText('dashPeriodIncome', formatCurrency(inc));
    setElText('dashPeriodExpense', formatCurrency(exp));
    setElText('dashBalanceReinvest', formatCurrency(b.reinvest));
    const totalInv = investments.reduce((a,b) => a + (parseFloat(b.value)||0), 0);
    setElText('dashTotalInvested', formatCurrency(totalInv));

    renderDashCharts(inc, exp);
}

function renderDashCharts(inc, exp) {
    const ctxB = document.getElementById('barChartDash');
    if(ctxB) {
        if(barChartDash) barChartDash.destroy();
        barChartDash = new Chart(ctxB.getContext('2d'), {
            type:'bar',
            data: { labels:['Receitas','Despesas'], datasets:[{data:[inc, exp], backgroundColor:['#00b894','#ff7675']}]},
            options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}}
        });
    }
    updatePieChart();
}

function updatePieChart() {
    const ctxP = document.getElementById('pieChart');
    if(!ctxP) return;
    const types = {};
    investments.forEach(i => types[i.type] = (types[i.type] || 0) + (parseFloat(i.value)||0));
    if(pieChart) pieChart.destroy();
    pieChart = new Chart(ctxP.getContext('2d'), {
        type:'doughnut',
        data:{ labels:Object.keys(types), datasets:[{data:Object.values(types), backgroundColor:['#0984e3','#00b894','#6c5ce7','#ff7675','#fdcb6e']}]},
        options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{position:'right',labels:{color:'#fff'}}}}
    });
}

// --- ÁRVORE DE DESPESAS ---
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
        node.innerHTML = `<div class="tree-category"><span>📂 ${cat}</span><span>${formatCurrency(categories[cat].total)}</span></div>`;
        categories[cat].items.forEach(item => {
            node.innerHTML += `<div class="tree-item"><span>${item.desc}</span><span>${formatCurrency(item.value)}</span></div>`;
        });
        container.appendChild(node);
    }
}

// --- CORREÇÃO DA EVOLUÇÃO (LÓGICA REAL) ---
function updateEvolutionChart() {
    const ctx = document.getElementById('evolutionChart');
    if(!ctx) return;

    const startStr = document.getElementById('filterStartDate').value;
    const endStr = document.getElementById('filterEndDate').value;
    const typeFilter = document.getElementById('filterType').value;

    const startDate = new Date(startStr);
    const endDate = new Date(endStr);

    const filteredInv = investments.filter(inv => typeFilter === 'all' || inv.type === typeFilter);

    const labels = [];
    const dataPoints = [];
    const tableData = [];

    let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const endLimit = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0);
    let previousValue = 0;

    while (current <= endLimit) {
        const labelDate = `${String(current.getMonth()+1).padStart(2,'0')}/${current.getFullYear()}`;
        let totalValueInMonth = 0;
        
        filteredInv.forEach(inv => {
            const p = inv.date.split('-');
            const invStart = new Date(p[0], p[1]-1, p[2]);

            if (current >= invStart) {
                const diffMonths = (current - invStart) / (1000 * 60 * 60 * 24 * 30.44);
                let rateYearly = 0.10; 
                if (inv.ratePrev) {
                   const r = parseFloat(inv.ratePrev);
                   if (inv.rateTypePrev && inv.rateTypePrev.includes('CDI')) rateYearly = (r/100)*0.1125;
                   else if (inv.rateTypePrev && inv.rateTypePrev.includes('IPCA')) rateYearly = 0.045 + (r/100);
                   else rateYearly = r/100;
                }
                const rateMonthly = Math.pow(1 + rateYearly, 1/12) - 1;
                totalValueInMonth += inv.value * Math.pow(1 + rateMonthly, Math.max(0, diffMonths));
            }
        });

        labels.push(labelDate);
        dataPoints.push(totalValueInMonth);
        const growth = totalValueInMonth - previousValue;
        tableData.push({ date: labelDate, total: totalValueInMonth, growth: dataPoints.length === 1 ? 0 : growth });
        previousValue = totalValueInMonth;
        current.setMonth(current.getMonth() + 1);
    }

    if(evoChart) evoChart.destroy();
    evoChart = new Chart(ctx.getContext('2d'), {
        type:'line',
        data:{labels, datasets:[{label:'Patrimônio Projetado', data:dataPoints, borderColor:'#00b894', backgroundColor:'rgba(0,184,148,0.1)', fill:true, tension:0.3}]},
        options:{responsive:true, maintainAspectRatio:false}
    });

    filteredEvolutionData = tableData;
    evolutionPage = 1;
    renderEvolutionTable();
}

function renderEvolutionTable() {
    const tb = document.querySelector('#evolutionTable tbody');
    if(!tb) return;
    tb.innerHTML = '';
    const start = (evolutionPage - 1) * ITEMS_PER_PAGE;
    const pageData = filteredEvolutionData.slice(start, start + ITEMS_PER_PAGE);

    pageData.forEach(r => {
        tb.innerHTML += `<tr><td>${r.date}</td><td>${formatCurrency(r.total)}</td><td class="${r.growth>=0?'text-green':'text-red'}">${formatCurrency(r.growth)}</td></tr>`;
    });
    setElText('pageIndicator', `Página ${evolutionPage}`);
}

function changeEvoPage(dir) {
    const max = Math.ceil(filteredEvolutionData.length / ITEMS_PER_PAGE);
    if(dir === 1 && evolutionPage < max) { evolutionPage++; renderEvolutionTable(); }
    else if(dir === -1 && evolutionPage > 1) { evolutionPage--; renderEvolutionTable(); }
}

// --- COMPARATIVO ---
function updateComparisonDashboard() {
    const realizedMap = {};
    investments.forEach(inv => {
        const key = inv.date.slice(0, 7);
        realizedMap[key] = (realizedMap[key] || 0) + parseFloat(inv.value);
    });

    const plannedMap = {};
    plans.forEach(p => {
        const key = p.monthYear;
        plannedMap[key] = (plannedMap[key] || 0) + parseFloat(p.targetValue);
    });

    const allMonths = Array.from(new Set([...Object.keys(realizedMap), ...Object.keys(plannedMap)])).sort();
    const totalP = Object.values(plannedMap).reduce((a,b)=>a+b, 0);
    const totalR = Object.values(realizedMap).reduce((a,b)=>a+b, 0);
    
    setElText('compTotalPlanned', formatCurrency(totalP));
    setElText('compTotalRealized', formatCurrency(totalR));
    setElText('compPercentage', totalP > 0 ? ((totalR/totalP)*100).toFixed(1) + '%' : '0%');

    const ctxComp = document.getElementById('compBarChart');
    if(ctxComp) {
        if(compBarChart) compBarChart.destroy();
        compBarChart = new Chart(ctxComp.getContext('2d'), {
            type: 'bar',
            data: {
                labels: allMonths,
                datasets: [
                    { label: 'Planejado', data: allMonths.map(m => plannedMap[m] || 0), backgroundColor: 'rgba(255,255,255,0.1)' },
                    { label: 'Realizado', data: allMonths.map(m => realizedMap[m] || 0), backgroundColor: '#00b894' }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}

// --- APORTES E FORMS ---
const formInv = document.getElementById('investForm');
if(formInv) formInv.addEventListener('submit', (e) => {
    e.preventDefault();
    const b = getBalances();
    const val = parseFloat(document.getElementById('inpValue').value);
    if(val > b.reinvest) return alert("Saldo insuficiente no Giro!");
    
    const newInv = {
        dataType: 'investment', id: Date.now(),
        name: document.getElementById('inpName').value,
        institution: document.getElementById('inpInst').value,
        type: document.getElementById('inpType').value, value: val,
        date: document.getElementById('inpDate').value,
        expiry: document.getElementById('inpExpiry').value,
        ratePrev: document.getElementById('inpRatePrev').value,
        rateTypePrev: document.getElementById('inpRateTypePrev').value,
        status: document.getElementById('inpStatus').value
    };
    const syncT = {
        dataType: 'transaction', id: Date.now()+1,
        date: newInv.date, type: 'withdraw', wallet: 'reinvest',
        desc: `Aporte: ${newInv.name}`, value: val
    };
    investments.push(newInv); transactions.unshift(syncT);
    saveLocal(); renderAll(); sendToSheet(newInv); sendToSheet(syncT);
    alert("Aporte registrado com sucesso!");
    formInv.reset();
});

const formPlan = document.getElementById('planForm');
if(formPlan) formPlan.addEventListener('submit', (e) => {
    e.preventDefault();
    const newP = {
        id: Date.now(),
        monthYear: document.getElementById('inpPlanMonth').value,
        targetValue: parseFloat(document.getElementById('inpPlanValue').value),
        category: document.getElementById('inpPlanCategory').value
    };
    plans.push(newP);
    saveLocal(); renderPlansTable(); alert("Meta salva!");
});

// --- UTILS E PERSISTÊNCIA ---
function formatCurrency(v) { return (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function setElText(id, txt) { const el = document.getElementById(id); if(el) el.innerText = txt; }

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
    const indicator = document.getElementById('syncIndicator');
    try {
        const res = await fetch(GOOGLE_SHEET_URL);
        const d = await res.json();
        if(d.investments) investments = d.investments;
        if(d.transactions) transactions = d.transactions;
        if(indicator) { indicator.innerText = "Online"; indicator.className = "status-indicator status-online"; }
        renderAll();
    } catch(e) {
        if(indicator) { indicator.innerText = "Local"; indicator.className = "status-indicator status-offline"; }
    }
}

function deleteTransaction(id) { if(confirm("Apagar transação?")) { transactions = transactions.filter(t=>t.id!==id); saveLocal(); renderAll(); } }
function deleteInvestment(id) { if(confirm("Apagar ativo?")) { investments = investments.filter(i=>i.id!==id); saveLocal(); renderAll(); } }
function deletePlan(id) { if(confirm("Apagar meta?")) { plans = plans.filter(p=>p.id!==id); renderPlansTable(); saveLocal(); } }
function clearAllData() { if(confirm("Deseja apagar TODOS os dados locais?")) { localStorage.clear(); location.reload(); } }

function renderPlansTable() {
    const tb = document.getElementById('plansTableBody'); if(!tb) return;
    tb.innerHTML = '';
    plans.forEach(p => tb.innerHTML += `<tr><td>${p.monthYear}</td><td>${p.category}</td><td>${formatCurrency(p.targetValue)}</td><td><button class="btn-icon" onclick="deletePlan(${p.id})">🗑️</button></td></tr>`);
}
function renderHistory() {
    const tb = document.getElementById('investTableBody'); if(!tb) return;
    tb.innerHTML = '';
    investments.forEach(i => tb.innerHTML += `<tr><td>${i.name}</td><td>${i.date}</td><td>${i.expiry||'-'}</td><td>${formatCurrency(i.value)}</td><td><button class="btn-icon" onclick="deleteInvestment(${i.id})">🗑️</button></td></tr>`);
}