// ====== CONFIG ======
const CLIENT_ID = "456298054037-lcd94clmm4ctkg55u74kai99a8grdcmt.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";
const DISCOVERY_DOC = "https://sheets.googleapis.com/$discovery/rest?version=v4";

// Your Google Sheet
const SPREADSHEET_ID = "1AiW4RrVANII17O-bi42yLuSMKG1UAz1mU64LA6lvnBk";
const SHEET_TRANSACTIONS = "Transactions";
const SHEET_BUDGETS = "Budgets";
const SHEET_SETTINGS = "Settings";

// ====== STATE ======
let accessToken = null;
let userEmail = null;
let paidByOptions = ["Hilman","Hanis"];
let categoryOptions = ["Rental","Car","Groceries","Entertainment","Mobile Phone","Maid","Minyak Kereta","Credit Card","Others","Transfer Malaysia","Subaru","Subaru Insurance","Sekolah Esraa","Mini Insurance","Cuti2","Air Ticket","Bonus","Salary"];

// ====== UI HELPERS ======
const $ = (sel) => document.querySelector(sel);
const tabs = document.querySelectorAll(".tab");
const pages = document.querySelectorAll(".page");
tabs.forEach(t => t.addEventListener("click", () => {
  tabs.forEach(x => x.classList.remove("active"));
  t.classList.add("active");
  pages.forEach(p => p.classList.remove("active"));
  document.getElementById(t.dataset.tab).classList.add("active");
}));

function chips(container, items) {
  container.innerHTML = "";
  items.forEach(v => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip";
    b.textContent = v;
    b.addEventListener("click", () => {
      [...container.children].forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      container.dataset.value = v;
    });
    container.appendChild(b);
  });
  if (items.length) { container.children[0].click(); }
}

function msg(el, text, ok=true) {
  el.textContent = text;
  el.style.color = ok ? "#22c55e" : "#ef4444";
  setTimeout(() => el.textContent = "", 2500);
}

// ====== AUTH ======
let tokenClient;
window.onload = async () => {
  $("#signin").addEventListener("click", signIn);
  $("#signout").addEventListener("click", signOut);
  $("#submitExp").addEventListener("click", addExpense);
  $("#submitInc").addEventListener("click", addIncome);
  $("#reload1").addEventListener("click", drawChart1);
  $("#reload2").addEventListener("click", drawChart2);

  chips($("#paidByBtnsExp"), paidByOptions);
  chips($("#categoryBtnsExp"), categoryOptions);
  chips($("#paidByBtnsInc"), paidByOptions);
  chips($("#categoryBtnsInc"), categoryOptions);

  await new Promise(res => gapi.load("client", res));
  await gapi.client.init({ discoveryDocs: [DISCOVERY_DOC] });

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    prompt: "",
    callback: async (t) => {
      accessToken = t.access_token;
      gapi.client.setToken({ access_token: accessToken });
      await afterLogin();
    }
  });
};

async function signIn() {
  tokenClient.requestAccessToken();
}

function signOut() {
  accessToken = null;
  gapi.client.setToken(null);
  $("#who").textContent = "";
  $("#signout").classList.add("hidden");
  $("#signin").classList.remove("hidden");
}

async function afterLogin() {
  const info = parseJwt(accessToken);
  userEmail = info.email || "";
  $("#who").textContent = userEmail;
  $("#signout").classList.remove("hidden");
  $("#signin").classList.add("hidden");

  await loadSettings();
  await drawChart1();
  await drawChart2();
}

function parseJwt(token) {
  try {
    const [, payload] = token.split(".");
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch { return {}; }
}

// ====== SHEETS HELPERS ======
async function sheetsAppend(rangeA1, values) {
  return gapi.client.sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_TRANSACTIONS}!A:L`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    resource: { values: [values] }
  });
}

async function sheetsGet(rangeA1) {
  const r = await gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: rangeA1
  });
  return r.result.values || [];
}

async function loadSettings() {
  try {
    const settings = await sheetsGet(`${SHEET_SETTINGS}!A1:B50`);
    const map = Object.fromEntries(settings.slice(1).filter(r => r[0]).map(r => [r[0], r[1]]));
    if (map.PaidBy) paidByOptions = map.PaidBy.split(",").map(s => s.trim()).filter(Boolean);
    if (map.Categories) categoryOptions = map.Categories.split(",").map(s => s.trim()).filter(Boolean);
  } catch (e) {}
  chips($("#paidByBtnsExp"), paidByOptions);
  chips($("#categoryBtnsExp"), categoryOptions);
  chips($("#paidByBtnsInc"), paidByOptions);
  chips($("#categoryBtnsInc"), categoryOptions);
}

// ====== FORMS ======
function nowIso() {
  return new Date().toISOString();
}
function uuid() {
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2,8);
}

async function addExpense() {
  const paidBy = $("#paidByBtnsExp").dataset.value;
  const category = $("#categoryBtnsExp").dataset.value;
  const currency = $("#currencyExp").value;
  const amount = $("#amountExp").valueAsNumber;
  const notes = $("#notesExp").value.trim();
  if (!amount || amount <= 0) { msg($("#expMsg"), "Enter a valid amount", false); return; }

  const row = [uuid(), nowIso(), "", "Expense", category, currency, amount, "", "", "", paidBy, notes];

  try {
    await sheetsAppend(`${SHEET_TRANSACTIONS}!A:L`, row);
    $("#amountExp").value = "";
    $("#notesExp").value = "";
    msg($("#expMsg"), "Expense added");
    await drawChart1();
    await drawChart2();
  } catch (e) {
    msg($("#expMsg"), "Failed to add. Check login & sheet access.", false);
  }
}

async function addIncome() {
  const paidBy = $("#paidByBtnsInc").dataset.value;
  const category = $("#categoryBtnsInc").dataset.value;
  const currency = $("#currencyInc").value;
  const amount = $("#amountInc").valueAsNumber;
  const notes = $("#notesInc").value.trim();
  if (!amount || amount <= 0) { msg($("#incMsg"), "Enter a valid amount", false); return; }

  const row = [uuid(), nowIso(), "", "Income", category, currency, amount, "", "", "", paidBy, notes];

  try {
    await sheetsAppend(`${SHEET_TRANSACTIONS}!A:L`, row);
    $("#amountInc").value = "";
    $("#notesInc").value = "";
    msg($("#incMsg"), "Income added");
    await drawChart1();
    await drawChart2();
  } catch (e) {
    msg($("#incMsg"), "Failed to add. Check login & sheet access.", false);
  }
}
// ====== CHARTS ======
let chart1, chart2;

function monthKey(d) {
  const dt = new Date(d);
  if (isNaN(dt)) return null;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-01`;
}

function inRange(key, from, to) {
  if (!from && !to) return true;
  if (from && key < from) return false;
  if (to && key > to) return false;
  return true;
}

async function drawChart1() {
  const tx = await sheetsGet(`${SHEET_TRANSACTIONS}!A2:L`);
  const budgets = await sheetsGet(`${SHEET_BUDGETS}!A2:C`);
  const from = $("#fromMonth1").value ? $("#fromMonth1").value + "-01" : null;
  const to = $("#toMonth1").value ? $("#toMonth1").value + "-01" : null;

  const actual = {};
  tx.forEach(r => {
    const ts = r[1];
    const m = r[2];
    const expense = parseFloat(r[8] || "0");
    const key = m || monthKey(ts);
    if (!key) return;
    if (!inRange(key, from, to)) return;
    actual[key] = (actual[key] || 0) + expense;
  });

  const budget = {};
  budgets.forEach(r => {
    const m = r[0];
    const amt = parseFloat(r[2] || "0");
    if (!m) return;
    const key = monthKey(m);
    if (!inRange(key, from, to)) return;
    budget[key] = (budget[key] || 0) + amt;
  });

  const labels = Array.from(new Set([...Object.keys(actual), ...Object.keys(budget)])).sort();
  const dataActual = labels.map(k => +(actual[k] || 0).toFixed(2));
  const dataBudget = labels.map(k => +(budget[k] || 0).toFixed(2));

  const ctx = document.getElementById("canvas1").getContext("2d");
  if (chart1) chart1.destroy();
  chart1 = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels.map(k => new Date(k + "T00:00:00").toLocaleString(undefined, { month: "short", year: "numeric" })),
      datasets: [
        { label: "Actual expenses (base)", data: dataActual, backgroundColor: "rgba(96,165,250,0.5)", borderColor: "#60a5fa", borderWidth: 1 },
        { label: "Budget (base)", type: "line", data: dataBudget, borderColor: "#22c55e", backgroundColor: "rgba(34,197,94,0.15)", tension: 0.3, fill: false }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: "#e5e7eb" } } },
      scales: {
        x: { ticks: { color: "#9ca3af" }, grid: { color: "rgba(55,65,81,0.3)" } },
        y: { ticks: { color: "#9ca3af" }, grid: { color: "rgba(55,65,81,0.3)" } }
      }
    }
  });
}
async function drawChart2() {
  const tx = await sheetsGet(`${SHEET_TRANSACTIONS}!A2:L`);
  const settings = await sheetsGet(`${SHEET_SETTINGS}!A1:B50`);
  const map = Object.fromEntries((settings || []).slice(1).filter(r => r[0]).map(r => [r[0], r[1]]));
  const opening = parseFloat(map.OpeningBalance || "0");

  const from = $("#fromMonth2").value ? $("#fromMonth2").value + "-01" : null;
  const to = $("#toMonth2").value ? $("#toMonth2").value + "-01" : null;

  const byMonth = {};
  tx.forEach(r => {
    const ts = r[1];
    const m = r[2];
    const inc = parseFloat(r[9] || "0");
    const exp = parseFloat(r[8] || "0");
    const key = m || monthKey(ts);
    if (!key) return;
    if (!inRange(key, from, to)) return;
    if (!byMonth[key]) byMonth[key] = { income: 0, expense: 0 };
    byMonth[key].income += inc;
    byMonth[key].expense += exp;
  });

  const labels = Object.keys(byMonth).sort();
  const incomes = labels.map(k => +(byMonth[k].income || 0).toFixed(2));
  const expenses = labels.map(k => +(byMonth[k].expense || 0).toFixed(2));

  const balances = [];
  let bal = opening;
  labels.forEach((k, i) => {
    bal += incomes[i] - expenses[i];
    balances.push(+bal.toFixed(2));
  });

  const projMonths = 3;
  const avgWindow = 3;
  const nets = labels.map((k, i) => incomes[i] - expenses[i]);
  const recent = nets.slice(-avgWindow);
  const avgNet = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;

  const projLabels = [];
  const projBalances = [];
  let lastMonth = labels.length ? new Date(labels[labels.length - 1] + "T00:00:00") : null;
  let projBalStart = balances.length ? balances[balances.length - 1] : opening;
  for (let i = 1; i <= projMonths; i++) {
    if (!lastMonth) break;
    const next = new Date(lastMonth);
    next.setMonth(next.getMonth() + i);
    const key = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
    projBalStart += avgNet;
    projLabels.push(key);
    projBalances.push(+projBalStart.toFixed(2));
  }

  const ctx = document.getElementById("canvas2").getContext("2d");
  if (chart2) chart2.destroy();
  chart2 = new Chart(ctx, {
    data: {
      labels: [...labels, ...projLabels].map(k => new Date(k + "T00:00:00").toLocaleString(undefined, { month: "short", year: "numeric" })),
      datasets: [
        {
          label: "Expenses (base)",
          type: "bar",
          data: [...expenses, ...Array(projLabels.length).fill(0)],
          backgroundColor: "rgba(239,68,68,0.4)",
          borderColor: "#ef4444",
          borderWidth: 1,
          yAxisID: "y"
        },
        {
          label: "Balance (base)",
          type: "line",
          data: balances.concat(projLabels.map(() => null)),
          borderColor: "#22c55e",
          backgroundColor: "rgba(34,197,94,0.18)",
          fill: true,
          tension: 0.3,
          yAxisID: "y1"
        },
        {
          label: "Projected balance",
          type: "line",
          data: Array(labels.length).fill(null).concat(projBalances),
          borderColor: "#60a5fa",
          borderDash: [6, 4],
          fill: false,
          tension: 0.3,
          yAxisID: "y1"
        }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: "#e5e7eb" } } },
      scales: {
        x: { ticks: { color: "#9ca3af" }, grid: { color: "rgba(55,65,81,0.3)" } },
        y: { position: "left", ticks: { color: "#9ca3af" }, grid: { color: "rgba(55,65,81,0.2)" } },
        y1: { position: "right", ticks: { color: "#9ca3af" }, grid: { drawOnChartArea: false } }
      }
    }
  });
}
// ====== END ======
// You can add more helper functions here in the future if needed.
// For now, everything ends cleanly after drawChart2().
