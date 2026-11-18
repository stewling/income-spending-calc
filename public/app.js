(() => {
  'use strict';

  const LS_KEY = 'hb_state_cache_v1';
  const IDB_NAME = 'HouseholdBudgetLocalDB';
  const IDB_STORE = 'stateCache';
  const CLIENT_ID = `client_${Math.random().toString(36).slice(2, 10)}`;
  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const CURRENCY_LOCALES = {
    GBP: { locale: 'en-GB', symbol: '£' },
    USD: { locale: 'en-US', symbol: '$' },
    EUR: { locale: 'de-DE', symbol: '€' }
  };
  const ACCOUNT_TYPE_LABELS = {
    savings: 'Savings Account',
    isa: 'ISA / Tax-Free',
    investment: 'Investment',
    cash: 'Cash / Sinking Pot',
    asset: 'Physical Asset'
  };
  const CATEGORY_COLORS = [
    '#38bdf8', '#818cf8', '#10b981', '#f59e0b',
    '#f43f5e', '#a78bfa', '#06b6d4', '#fb7185', '#34d399'
  ];

  // --- DATE & MONTH HELPERS ---
  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function getCurrentMonth(date = new Date()) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;
  }

  function getTodayIso(date = new Date()) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function shiftMonth(monthStr, offset) {
    const [y, m] = monthStr.split('-').map(Number);
    const d = new Date(y, m - 1 + offset, 1);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  }

  function formatMonthLong(monthStr) {
    const [y, m] = monthStr.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }

  function formatMonthShort(monthStr) {
    const [y, m] = monthStr.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
  }

  function getLastDayOfMonthIso(monthStr) {
    const [y, m] = monthStr.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    return `${monthStr}-${pad2(last)}`;
  }

  function getWeekdaysInMonth(monthStr, targetDayOfWeek) {
    const [y, m] = monthStr.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const dates = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(y, m - 1, day);
      if (d.getDay() === Number(targetDayOfWeek)) {
        dates.push(`${monthStr}-${pad2(day)}`);
      }
    }
    return dates;
  }

  function getHorizon(monthStr, currentMonth) {
    if (monthStr < currentMonth) return 'past';
    if (monthStr > currentMonth) return 'future';
    return 'current';
  }

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function uid(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }

  // --- LOCAL BROWSER CACHE (localStorage + IndexedDB) ---
  function openIdb() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        resolve(null);
        return;
      }
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function writeIdbCache(record) {
    try {
      const db = await openIdb();
      if (!db) return;
      await new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(record, 'latest');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch {
      // ignore IndexedDB quota/private mode failures
    }
  }

  async function readIdbCache() {
    try {
      const db = await openIdb();
      if (!db) return null;
      const result = await new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE, 'readonly');
        const req = tx.objectStore(IDB_STORE).get('latest');
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
      db.close();
      return result;
    } catch {
      return null;
    }
  }

  function writeLocalCache(record) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(record));
    } catch {
      // ignore storage quota errors
    }
    writeIdbCache(record);
  }

  async function readLocalCache() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // fallback to IndexedDB
    }
    return await readIdbCache();
  }

  // --- APP STATE ---
  const runtime = {
    state: null,
    revision: 0,
    updatedAt: null,
    network: { port: 3000, lanUrls: [], localUrl: window.location.origin, storageFiles: {} },
    pendingSync: false,
    online: navigator.onLine,
    serverReachable: true,
    selectedMonth: getCurrentMonth(),
    activeTab: 'overview',
    outgoingFilter: 'all',
    plannedAllocations: {},
    syncInFlight: false,
    syncQueued: false,
    entryModalKind: 'outgoing',
    entryModalFreq: 'monthly',
    stxModalType: 'deposit',
    pendingDeleteId: null
  };

  // --- FORMATTING ---
  function formatMoney(amount, showPlus = false) {
    const code = runtime.state?.settings?.currency || 'GBP';
    const meta = CURRENCY_LOCALES[code] || CURRENCY_LOCALES.GBP;
    const num = Number(amount || 0);
    const abs = Math.abs(num);
    const formatted = new Intl.NumberFormat(meta.locale, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(abs);

    if (num < 0) return `-${formatted}`;
    if (showPlus && num > 0) return `+${formatted}`;
    return formatted;
  }

  function showToast(message, variant = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${variant}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3400);
  }

  // --- CALCULATION ENGINE ---
  function isEntryActiveInMonth(entry, monthStr) {
    if (!entry) return false;
    if (entry.frequency === 'one-off') {
      return entry.month === monthStr;
    }
    const afterStart = !entry.startMonth || entry.startMonth <= monthStr;
    const beforeEnd = !entry.endMonth || entry.endMonth >= monthStr;
    return afterStart && beforeEnd;
  }

  function resolveEntryForMonth(entry, monthStr, state = runtime.state) {
    const currentMonth = getCurrentMonth();
    const overrideKey = `${entry.id}_${monthStr}`;
    const override = state.monthOverrides?.[overrideKey] || null;
    const defaultStatus = monthStr < currentMonth ? 'paid' : 'pending';
    const status = override?.status || defaultStatus;
    const weeklyMode = state.settings?.weeklyCalcMode || 'exact';

    let occurrences = [];
    let multiplier = 1;
    let scheduleLabel = '';

    if (entry.frequency === 'one-off') {
      scheduleLabel = entry.date ? `One-Off • ${entry.date}` : `One-Off • ${formatMonthShort(monthStr)}`;
    } else if (entry.frequency === 'monthly') {
      const dom = entry.dayOfMonth || 1;
      scheduleLabel = `Monthly DD • Day ${dom}`;
    } else if (entry.frequency === 'weekly') {
      const dow = entry.dayOfWeek ?? 5;
      occurrences = getWeekdaysInMonth(monthStr, dow);
      if (weeklyMode === 'exact') {
        multiplier = occurrences.length;
        scheduleLabel = `Weekly DD • ${WEEKDAYS[dow]}s (${multiplier}×)`;
      } else if (weeklyMode === 'four_week') {
        multiplier = 4;
        scheduleLabel = `Weekly DD • ${WEEKDAYS[dow]}s (×4)`;
      } else {
        multiplier = 52 / 12;
        scheduleLabel = `Weekly DD • ${WEEKDAYS[dow]}s (×4.33)`;
      }
    }

    const hasAmountOverride = override && override.amount !== undefined && override.amount !== null && override.amount !== '';
    const baseUnitAmount = Number(entry.amount || 0);
    const computedAmount = hasAmountOverride
      ? Number(override.amount)
      : entry.frequency === 'weekly'
        ? Math.round(baseUnitAmount * multiplier * 100) / 100
        : baseUnitAmount;

    const effectiveAmount = status === 'skipped' ? 0 : computedAmount;

    return {
      entry,
      month: monthStr,
      status,
      override,
      hasAmountOverride,
      baseUnitAmount,
      multiplier,
      occurrences,
      scheduleLabel,
      computedAmount,
      effectiveAmount,
      note: override?.note || entry.notes || ''
    };
  }

  function getSignedTxDelta(tx) {
    const amt = Number(tx.amount || 0);
    if (tx.type === 'deposit') return Math.abs(amt);
    if (tx.type === 'withdrawal') return -Math.abs(amt);
    return amt; // adjustment can be + or -
  }

  function getAccountBalanceAtMonth(account, monthStr, state = runtime.state) {
    let balance = Number(account.openingBalance || 0);
    for (const tx of state.savingsTransactions || []) {
      if (tx.accountId === account.id && tx.month <= monthStr) {
        balance += getSignedTxDelta(tx);
      }
    }
    return Math.round(balance * 100) / 100;
  }

  function getAccountMonthActivity(accountId, monthStr, state = runtime.state) {
    let added = 0;
    let removed = 0;
    let adjusted = 0;
    for (const tx of state.savingsTransactions || []) {
      if (tx.accountId === accountId && tx.month === monthStr) {
        if (tx.type === 'deposit') added += Math.abs(Number(tx.amount || 0));
        else if (tx.type === 'withdrawal') removed += Math.abs(Number(tx.amount || 0));
        else adjusted += Number(tx.amount || 0);
      }
    }
    return {
      added,
      removed,
      adjusted,
      net: added - removed + adjusted
    };
  }

  function computeMonthSummary(monthStr, state = runtime.state) {
    const incomes = [];
    const outgoings = [];

    for (const entry of state.entries || []) {
      if (!isEntryActiveInMonth(entry, monthStr)) continue;
      const resolved = resolveEntryForMonth(entry, monthStr, state);
      if (entry.kind === 'income') incomes.push(resolved);
      else outgoings.push(resolved);
    }

    const incBreakdown = { monthly: 0, weekly: 0, 'one-off': 0 };
    let totalIncome = 0;
    for (const r of incomes) {
      totalIncome += r.effectiveAmount;
      incBreakdown[r.entry.frequency] += r.effectiveAmount;
    }

    const outBreakdown = { monthly: 0, weekly: 0, 'one-off': 0 };
    const categoryTotals = {};
    let totalOutgoings = 0;
    let paidOutgoings = 0;
    let upcomingOutgoings = 0;
    let essentialOutgoings = 0;
    let flexibleOutgoings = 0;

    for (const r of outgoings) {
      totalOutgoings += r.effectiveAmount;
      outBreakdown[r.entry.frequency] += r.effectiveAmount;
      const cat = r.entry.category || 'Uncategorized';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + r.effectiveAmount;

      if (r.status === 'paid') paidOutgoings += r.effectiveAmount;
      else if (r.status === 'pending') upcomingOutgoings += r.effectiveAmount;

      if (r.entry.essential !== false) essentialOutgoings += r.effectiveAmount;
      else flexibleOutgoings += r.effectiveAmount;
    }

    // Savings activity in monthStr
    let savingsAdded = 0;
    let savingsRemoved = 0;
    let savingsAdjusted = 0;
    for (const tx of state.savingsTransactions || []) {
      if (tx.month !== monthStr) continue;
      if (tx.type === 'deposit') savingsAdded += Math.abs(Number(tx.amount || 0));
      else if (tx.type === 'withdrawal') savingsRemoved += Math.abs(Number(tx.amount || 0));
      else savingsAdjusted += Number(tx.amount || 0);
    }

    let totalSavingsAtMonth = 0;
    let totalSavingsLive = 0;
    const currentMonth = getCurrentMonth();
    for (const acc of state.savingsAccounts || []) {
      totalSavingsAtMonth += getAccountBalanceAtMonth(acc, monthStr, state);
      totalSavingsLive += getAccountBalanceAtMonth(acc, currentMonth, state);
    }

    const moneyLeftOver = totalIncome - totalOutgoings;
    const safetyBuffer = Number(state.settings?.safetyBuffer || 0);
    const allocatableSurplus = Math.max(0, moneyLeftOver - safetyBuffer - savingsAdded);

    return {
      month: monthStr,
      incomes,
      outgoings,
      totalIncome,
      incBreakdown,
      totalOutgoings,
      outBreakdown,
      categoryTotals,
      paidOutgoings,
      upcomingOutgoings,
      essentialOutgoings,
      flexibleOutgoings,
      moneyLeftOver,
      savingsAdded,
      savingsRemoved,
      savingsAdjusted,
      savingsNet: savingsAdded - savingsRemoved + savingsAdjusted,
      totalSavingsAtMonth,
      totalSavingsLive,
      safetyBuffer,
      allocatableSurplus
    };
  }

  // --- PERSISTENCE & REAL-TIME SYNC ---
  function updateSyncBadge() {
    const btn = document.getElementById('syncStatusBtn');
    const label = document.getElementById('syncStatusText');
    btn.classList.remove('status-online', 'status-offline', 'status-pending');

    if (!runtime.online || !runtime.serverReachable) {
      btn.classList.add('status-offline');
      label.textContent = runtime.pendingSync ? 'Offline • Queued Locally' : 'Offline • Local Cache';
    } else if (runtime.pendingSync) {
      btn.classList.add('status-pending');
      label.textContent = 'Syncing Local Changes...';
    } else {
      btn.classList.add('status-online');
      const lanCount = runtime.network?.lanUrls?.length || 0;
      label.textContent = lanCount > 0 ? `LAN Live (${lanCount}) • Cached` : 'Local + Cache Synced';
    }
  }

  async function flushSyncToServer() {
    if (runtime.syncInFlight) {
      runtime.syncQueued = true;
      return;
    }
    runtime.syncInFlight = true;
    try {
      const res = await fetch('/api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: runtime.state, clientId: CLIENT_ID })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      runtime.revision = data.revision;
      runtime.updatedAt = data.updatedAt;
      runtime.network = data.network || runtime.network;
      runtime.pendingSync = false;
      runtime.serverReachable = true;
      writeLocalCache({
        state: runtime.state,
        revision: runtime.revision,
        updatedAt: runtime.updatedAt,
        pendingSync: false,
        cachedAt: new Date().toISOString()
      });
    } catch {
      runtime.serverReachable = false;
      runtime.pendingSync = true;
    } finally {
      runtime.syncInFlight = false;
      updateSyncBadge();
      if (runtime.syncQueued) {
        runtime.syncQueued = false;
        if (navigator.onLine) flushSyncToServer();
      }
    }
  }

  function persistChange(toastMessage = null) {
    writeLocalCache({
      state: runtime.state,
      revision: runtime.revision,
      updatedAt: new Date().toISOString(),
      pendingSync: true,
      cachedAt: new Date().toISOString()
    });
    runtime.pendingSync = true;
    updateSyncBadge();
    renderAll();
    if (toastMessage) showToast(toastMessage, 'success');
    flushSyncToServer();
  }

  async function fetchServerState(forceCheck = false) {
    try {
      const res = await fetch('/api/state', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      runtime.serverReachable = true;
      runtime.network = data.network || runtime.network;

      if (runtime.pendingSync && !forceCheck) {
        await flushSyncToServer();
        return;
      }

      if (!runtime.state || data.revision !== runtime.revision || forceCheck) {
        runtime.state = data.state;
        runtime.revision = data.revision;
        runtime.updatedAt = data.updatedAt;
        runtime.pendingSync = false;
        writeLocalCache({
          state: runtime.state,
          revision: runtime.revision,
          updatedAt: runtime.updatedAt,
          pendingSync: false,
          cachedAt: new Date().toISOString()
        });
        renderAll();
      }
    } catch {
      runtime.serverReachable = false;
    } finally {
      updateSyncBadge();
    }
  }

  function setupEventStream() {
    if (!('EventSource' in window)) return;
    try {
      const es = new EventSource('/api/events');
      es.addEventListener('state-updated', (ev) => {
        try {
          const payload = JSON.parse(ev.data);
          if (payload.clientId && payload.clientId === CLIENT_ID) return;
          if (payload.revision && payload.revision !== runtime.revision) {
            fetchServerState(true);
            showToast('Updated from another device on your local network', 'info');
          }
        } catch {
          // ignore malformed SSE data
        }
      });
      es.onopen = () => {
        runtime.serverReachable = true;
        updateSyncBadge();
        if (runtime.pendingSync) flushSyncToServer();
      };
      es.onerror = () => {
        runtime.serverReachable = false;
        updateSyncBadge();
      };
    } catch {
      // ignore SSE errors
    }
  }

  // --- RENDERING ---
  function renderTopControls() {
    const state = runtime.state;
    document.getElementById('householdTitle').textContent = state.settings?.householdName || 'Household Finance Hub';
    document.getElementById('currencySelect').value = state.settings?.currency || 'GBP';
    document.getElementById('weeklyModeSelect').value = state.settings?.weeklyCalcMode || 'exact';
    document.getElementById('monthPickerInput').value = runtime.selectedMonth;
  }

  function renderMonthNavigator() {
    const strip = document.getElementById('rollingMonthStrip');
    const currentMonth = getCurrentMonth();
    const pills = [];

    for (let offset = -4; offset <= 4; offset++) {
      const m = shiftMonth(runtime.selectedMonth, offset);
      const summary = computeMonthSummary(m);
      const horizon = getHorizon(m, currentMonth);
      const isSelected = m === runtime.selectedMonth;
      const tagLabel = horizon === 'past' ? 'Past' : horizon === 'current' ? 'Now' : 'Future';
      const netClass = summary.moneyLeftOver >= 0 ? 'text-emerald' : 'text-rose';

      pills.push(`
        <button type="button" class="month-pill ${isSelected ? 'active' : ''}" data-select-month="${m}">
          <div class="month-pill-top">
            <span class="month-pill-name">${escapeHtml(formatMonthShort(m))}</span>
            <span class="month-pill-tag tag-${horizon}">${tagLabel}</span>
          </div>
          <div class="month-pill-net ${netClass}">${escapeHtml(formatMoney(summary.moneyLeftOver, true))}</div>
        </button>
      `);
    }

    strip.innerHTML = pills.join('');

    const horizon = getHorizon(runtime.selectedMonth, currentMonth);
    const badge = document.getElementById('selectedMonthBadge');
    badge.className = `horizon-badge horizon-${horizon}`;
    badge.textContent = horizon === 'past' ? 'Past Saved Month' : horizon === 'current' ? 'Current Month' : 'Future Scheduled Month';
    document.getElementById('selectedMonthLabel').textContent = formatMonthLong(runtime.selectedMonth);
  }

  function renderKpis(summary) {
    document.getElementById('kpiIncomeCount').textContent = `${summary.incomes.length} source${summary.incomes.length === 1 ? '' : 's'}`;
    document.getElementById('kpiIncomeValue').textContent = formatMoney(summary.totalIncome);
    document.getElementById('kpiIncomeSub').textContent =
      `Monthly ${formatMoney(summary.incBreakdown.monthly)} • Weekly ${formatMoney(summary.incBreakdown.weekly)} • One-off ${formatMoney(summary.incBreakdown['one-off'])}`;

    document.getElementById('kpiOutgoingCount').textContent = `${summary.outgoings.length} item${summary.outgoings.length === 1 ? '' : 's'}`;
    document.getElementById('kpiOutgoingValue').textContent = formatMoney(summary.totalOutgoings);
    document.getElementById('kpiOutgoingSub').textContent =
      `Monthly DD ${formatMoney(summary.outBreakdown.monthly)} • Weekly DD ${formatMoney(summary.outBreakdown.weekly)} • One-off ${formatMoney(summary.outBreakdown['one-off'])}`;

    const paidPct = summary.totalOutgoings > 0
      ? Math.min(100, Math.round((summary.paidOutgoings / summary.totalOutgoings) * 100))
      : 0;
    document.getElementById('kpiOutgoingProgress').style.width = `${paidPct}%`;
    document.getElementById('kpiOutgoingPaidNote').textContent =
      `${formatMoney(summary.paidOutgoings)} paid (${paidPct}%) • ${formatMoney(summary.upcomingOutgoings)} upcoming`;

    const leftEl = document.getElementById('kpiLeftoverValue');
    leftEl.textContent = formatMoney(summary.moneyLeftOver, summary.moneyLeftOver < 0);
    leftEl.className = `kpi-value ${summary.moneyLeftOver >= 0 ? 'text-emerald' : 'text-rose'}`;
    const pctLeft = summary.totalIncome > 0
      ? Math.round((summary.moneyLeftOver / summary.totalIncome) * 100)
      : 0;
    document.getElementById('kpiLeftoverPct').textContent = `${pctLeft}% of income`;
    document.getElementById('kpiLeftoverSub').textContent =
      summary.moneyLeftOver >= 0 ? 'Surplus remaining after all outgoings' : 'Deficit — outgoings exceed income';
    document.getElementById('kpiEssentialNote').textContent =
      `Essential ${formatMoney(summary.essentialOutgoings)} • Flexible ${formatMoney(summary.flexibleOutgoings)}`;

    document.getElementById('kpiSavingsNetMonth').textContent = `${formatMoney(summary.savingsAdded)} added`;
    document.getElementById('kpiAllocatableValue').textContent = formatMoney(summary.allocatableSurplus);
    document.getElementById('kpiAllocatableSub').textContent =
      `After ${formatMoney(summary.safetyBuffer)} buffer & ${formatMoney(summary.savingsAdded)} moved`;
    document.getElementById('kpiTotalSavingsFoot').textContent =
      `Savings & Assets (${formatMonthShort(summary.month)}): ${formatMoney(summary.totalSavingsAtMonth)}`;
  }

  function renderEntryRow(r) {
    const e = r.entry;
    const isIncome = e.kind === 'income';
    const amountColor = isIncome ? 'text-emerald' : 'text-rose';
    const statusText = r.status === 'paid'
      ? (isIncome ? 'Received' : 'Paid')
      : r.status === 'skipped'
        ? 'Skipped'
        : 'Upcoming';

    const unitSub = e.frequency === 'weekly' && !r.hasAmountOverride
      ? `${formatMoney(r.baseUnitAmount)}/wk`
      : r.hasAmountOverride
        ? `Base ${formatMoney(r.baseUnitAmount)} (edited)`
        : e.category || '';

    const occPreview = e.frequency === 'weekly' && r.occurrences.length > 0 && !r.hasAmountOverride
      ? `<span>Dates: ${r.occurrences.map((d) => d.slice(8)).join(', ')}</span>`
      : '';

    return `
      <div class="entry-row ${r.status === 'skipped' ? 'is-skipped' : ''}" data-entry-id="${escapeHtml(e.id)}">
        <div class="entry-main">
          <div class="entry-title-line">
            <span class="entry-title">${escapeHtml(e.title)}</span>
            <span class="badge badge-${e.frequency}">${escapeHtml(r.scheduleLabel)}</span>
            ${e.kind === 'outgoing' && e.essential !== false ? '<span class="badge badge-essential">Essential</span>' : ''}
            ${r.hasAmountOverride ? '<span class="badge badge-override">Month Override</span>' : ''}
          </div>
          <div class="entry-meta">
            <span>${escapeHtml(e.category || 'Uncategorized')}</span>
            ${occPreview}
            ${r.note ? `<span>• ${escapeHtml(r.note)}</span>` : ''}
          </div>
        </div>
        <div class="entry-right">
          <div class="entry-amount-wrap">
            <div class="entry-amount ${amountColor}">${isIncome ? '+' : '-'}${escapeHtml(formatMoney(r.effectiveAmount))}</div>
            <div class="entry-amount-sub">${escapeHtml(unitSub)}</div>
          </div>
          <button type="button" class="status-toggle ${r.status}" data-toggle-status="${escapeHtml(e.id)}" title="Click to toggle Paid / Upcoming / Skipped">
            ${statusText}
          </button>
          <button type="button" class="icon-btn" data-edit-entry="${escapeHtml(e.id)}">Edit</button>
          <button type="button" class="icon-btn danger" data-delete-entry="${escapeHtml(e.id)}">Remove</button>
        </div>
      </div>
    `;
  }

  function renderEntriesLists(summary) {
    document.getElementById('outgoingsSubtitle').textContent =
      `${summary.outgoings.length} outgoings active in ${formatMonthLong(summary.month)} • Total ${formatMoney(summary.totalOutgoings)}`;

    const filter = runtime.outgoingFilter;
    const filteredOut = summary.outgoings.filter((r) => {
      if (filter === 'all') return true;
      if (filter === 'paid' || filter === 'pending') return r.status === filter;
      return r.entry.frequency === filter;
    });

    // Sort by frequency priority (monthly, weekly, one-off) then amount desc
    const freqOrder = { monthly: 1, weekly: 2, 'one-off': 3 };
    filteredOut.sort((a, b) => (freqOrder[a.entry.frequency] - freqOrder[b.entry.frequency]) || (b.effectiveAmount - a.effectiveAmount));

    const outEl = document.getElementById('outgoingsList');
    outEl.innerHTML = filteredOut.length
      ? filteredOut.map(renderEntryRow).join('')
      : `<div class="empty-state">No outgoings match this filter for ${escapeHtml(formatMonthLong(summary.month))}. Click <strong>+ Add Outgoing</strong> to add a one-off, weekly DD, or monthly DD.</div>`;

    const sortedInc = [...summary.incomes].sort((a, b) => b.effectiveAmount - a.effectiveAmount);
    const incEl = document.getElementById('incomesList');
    incEl.innerHTML = sortedInc.length
      ? sortedInc.map(renderEntryRow).join('')
      : `<div class="empty-state">No incomes logged for ${escapeHtml(formatMonthLong(summary.month))}. Click <strong>+ Add Income</strong> to add salaries or one-off payments.</div>`;
  }

  function renderOutgoingsBreakdown(summary) {
    const total = summary.totalOutgoings;
    const parts = [
      { key: 'monthly', label: 'Monthly Direct Debits', amount: summary.outBreakdown.monthly, color: '#818cf8' },
      { key: 'weekly', label: 'Weekly Direct Debits', amount: summary.outBreakdown.weekly, color: '#f59e0b' },
      { key: 'one-off', label: 'One-Off Payments', amount: summary.outBreakdown['one-off'], color: '#38bdf8' }
    ];

    const barEl = document.getElementById('scheduleBreakdownBar');
    const legendEl = document.getElementById('scheduleBreakdownLegend');

    if (total <= 0) {
      barEl.innerHTML = '';
      legendEl.innerHTML = '<div class="text-muted" style="font-size:0.82rem;">No outgoings in this month yet.</div>';
    } else {
      barEl.innerHTML = parts
        .filter((p) => p.amount > 0)
        .map((p) => `<div class="stacked-seg" style="width:${(p.amount / total) * 100}%;background:${p.color}" title="${escapeHtml(p.label)}: ${escapeHtml(formatMoney(p.amount))}"></div>`)
        .join('');
      legendEl.innerHTML = parts.map((p) => {
        const pct = Math.round((p.amount / total) * 100);
        return `
          <div class="legend-item">
            <span class="legend-left">
              <span class="legend-dot" style="background:${p.color}"></span>
              <span>${escapeHtml(p.label)}</span>
            </span>
            <strong>${escapeHtml(formatMoney(p.amount))} <span class="text-muted">(${pct}%)</span></strong>
          </div>
        `;
      }).join('');
    }

    const cats = Object.entries(summary.categoryTotals).sort((a, b) => b[1] - a[1]);
    const catEl = document.getElementById('categoryBreakdownList');
    if (!cats.length) {
      catEl.innerHTML = '<div class="text-muted" style="font-size:0.82rem;">Add outgoings to view category totals.</div>';
    } else {
      catEl.innerHTML = cats.map(([cat, amt], idx) => {
        const pct = total > 0 ? Math.round((amt / total) * 100) : 0;
        const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
        return `
          <div class="cat-bar-item">
            <div class="cat-bar-top">
              <span>${escapeHtml(cat)}</span>
              <strong>${escapeHtml(formatMoney(amt))} <span class="text-muted">(${pct}%)</span></strong>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width:${pct}%;background:${color}"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  function computeAutoSplitAllocations(available) {
    const accounts = (runtime.state.savingsAccounts || []).filter((a) => a.type !== 'asset');
    const result = {};
    if (available <= 0 || !accounts.length) {
      for (const a of accounts) result[a.id] = 0;
      return result;
    }

    let totalWeight = accounts.reduce((acc, a) => acc + Math.max(0, Number(a.allocationWeight || 0)), 0);
    if (totalWeight <= 0) totalWeight = accounts.length;

    let remaining = Math.round(available * 100);
    const weighted = accounts.map((a) => ({
      id: a.id,
      weight: totalWeight === accounts.length && Number(a.allocationWeight || 0) <= 0 ? 1 : Math.max(0, Number(a.allocationWeight || 0))
    }));

    const active = weighted.filter((w) => w.weight > 0);
    const denom = active.reduce((s, w) => s + w.weight, 0) || 1;
    let allocatedCents = 0;

    active.forEach((item, index) => {
      if (index === active.length - 1) {
        result[item.id] = Math.max(0, remaining - allocatedCents) / 100;
      } else {
        const shareCents = Math.floor((remaining * item.weight) / denom);
        allocatedCents += shareCents;
        result[item.id] = shareCents / 100;
      }
    });

    for (const a of accounts) {
      if (result[a.id] === undefined) result[a.id] = 0;
    }
    return result;
  }

  function renderSavingsAllocatorAndSnapshot(summary) {
    document.getElementById('allocLeftover').textContent = formatMoney(summary.moneyLeftOver);
    document.getElementById('safetyBufferInput').value = summary.safetyBuffer;
    document.getElementById('allocAlreadyMoved').textContent = formatMoney(summary.savingsAdded);
    document.getElementById('allocAvailable').textContent = formatMoney(summary.allocatableSurplus);

    const savingsOnly = (runtime.state.savingsAccounts || []).filter((a) => a.type !== 'asset');
    const listEl = document.getElementById('allocatorAccountsList');

    // Initialize defaults if none set yet for current month
    const hasValues = savingsOnly.some((a) => runtime.plannedAllocations[a.id] !== undefined);
    if (!hasValues) {
      runtime.plannedAllocations = computeAutoSplitAllocations(summary.allocatableSurplus);
    }

    if (!savingsOnly.length) {
      listEl.innerHTML = '<div class="text-muted" style="font-size:0.82rem;">Add a savings account to allocate leftover funds.</div>';
    } else {
      listEl.innerHTML = savingsOnly.map((acc) => {
        const val = Number(runtime.plannedAllocations[acc.id] ?? 0);
        const bal = getAccountBalanceAtMonth(acc, summary.month);
        return `
          <div class="alloc-acc-row">
            <div class="alloc-acc-info">
              <span class="alloc-acc-name">${escapeHtml(acc.name)}</span>
              <span class="alloc-acc-sub">Bal: ${escapeHtml(formatMoney(bal))} • Weight ${Number(acc.allocationWeight || 0)}%</span>
            </div>
            <input
              type="number"
              class="input-mini alloc-amount-input"
              data-alloc-account="${escapeHtml(acc.id)}"
              min="0"
              step="0.01"
              value="${val.toFixed(2)}"
            />
          </div>
        `;
      }).join('');
    }

    const plannedSum = savingsOnly.reduce((s, a) => s + Math.max(0, Number(runtime.plannedAllocations[a.id] || 0)), 0);
    document.getElementById('allocPlannedTotal').textContent = formatMoney(plannedSum);

    // Quick snapshot card
    document.getElementById('snapshotSubtitle').textContent = `Balances through ${formatMonthShort(summary.month)}`;
    const snapEl = document.getElementById('savingsSnapshotList');
    const allAccounts = runtime.state.savingsAccounts || [];
    if (!allAccounts.length) {
      snapEl.innerHTML = '<div class="text-muted" style="font-size:0.82rem;">No savings or assets added yet.</div>';
    } else {
      snapEl.innerHTML = allAccounts.map((acc) => {
        const bal = getAccountBalanceAtMonth(acc, summary.month);
        return `
          <div class="snapshot-row">
            <div class="snapshot-left">
              <span class="swatch" style="background:${escapeHtml(acc.color || '#38bdf8')}"></span>
              <div style="min-width:0">
                <div class="alloc-acc-name">${escapeHtml(acc.name)}</div>
                <div class="alloc-acc-sub">${escapeHtml(formatMoney(bal))}</div>
              </div>
            </div>
            <div class="snapshot-actions">
              <button type="button" class="icon-btn" title="Add money" data-quick-stx="deposit" data-acc-id="${escapeHtml(acc.id)}">+</button>
              <button type="button" class="icon-btn" title="Remove money" data-quick-stx="withdrawal" data-acc-id="${escapeHtml(acc.id)}">-</button>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  function renderSavingsTab(summary) {
    const accounts = runtime.state.savingsAccounts || [];
    document.getElementById('savBannerTotalLabel').textContent = `Total Savings & Assets (${formatMonthShort(summary.month)})`;
    document.getElementById('savBannerTotalValue').textContent = formatMoney(summary.totalSavingsAtMonth);
    document.getElementById('savBannerLiveNote').textContent = `Live current total (${formatMonthShort(getCurrentMonth())}): ${formatMoney(summary.totalSavingsLive)}`;
    document.getElementById('savBannerAddedMonth').textContent = `+${formatMoney(summary.savingsAdded)}`;
    document.getElementById('savBannerRemovedMonth').textContent = `-${formatMoney(summary.savingsRemoved)}`;
    const netEl = document.getElementById('savBannerNetMonth');
    netEl.textContent = formatMoney(summary.savingsNet, true);
    netEl.className = `stat-value ${summary.savingsNet >= 0 ? 'text-emerald' : 'text-rose'}`;
    document.getElementById('savBannerMonthName').textContent = formatMonthLong(summary.month);

    const gridEl = document.getElementById('savingsAccountsGrid');
    if (!accounts.length) {
      gridEl.innerHTML = `<div class="empty-state">No savings accounts or assets added yet. Click <strong>+ Add Account / Asset</strong> to start tracking.</div>`;
    } else {
      gridEl.innerHTML = accounts.map((acc) => {
        const balAtMonth = getAccountBalanceAtMonth(acc, summary.month);
        const balLive = getAccountBalanceAtMonth(acc, getCurrentMonth());
        const act = getAccountMonthActivity(acc.id, summary.month);
        const target = Number(acc.targetAmount || 0);
        const pct = target > 0 ? Math.min(100, Math.round((balAtMonth / target) * 100)) : 0;
        const typeLabel = ACCOUNT_TYPE_LABELS[acc.type] || 'Account';

        return `
          <article class="savings-card" style="border-top-color:${escapeHtml(acc.color || '#38bdf8')}">
            <div class="savings-card-top">
              <div>
                <span class="badge badge-one-off">${escapeHtml(typeLabel)}</span>
                <h3 class="savings-card-title" style="margin-top:6px;">${escapeHtml(acc.name)}</h3>
              </div>
              <button type="button" class="icon-btn" data-edit-sav-acc="${escapeHtml(acc.id)}">Edit</button>
            </div>

            <div>
              <div class="savings-balance-big">${escapeHtml(formatMoney(balAtMonth))}</div>
              <div class="entry-amount-sub">
                ${summary.month !== getCurrentMonth() ? `Live today: ${escapeHtml(formatMoney(balLive))} • ` : ''}
                Month net: <span class="${act.net >= 0 ? 'text-emerald' : 'text-rose'}">${escapeHtml(formatMoney(act.net, true))}</span>
              </div>
            </div>

            ${target > 0 ? `
              <div>
                <div class="cat-bar-top">
                  <span class="text-muted">Goal ${escapeHtml(formatMoney(target))}</span>
                  <strong>${pct}%</strong>
                </div>
                <div class="progress-track">
                  <div class="progress-fill" style="width:${pct}%;background:${escapeHtml(acc.color || '#38bdf8')}"></div>
                </div>
              </div>
            ` : ''}

            <div class="savings-card-meta">
              ${Number(acc.interestRate || 0) !== 0 ? `<span>Rate: ${Number(acc.interestRate)}%</span>` : ''}
              ${acc.type !== 'asset' ? `<span>Auto-split weight: ${Number(acc.allocationWeight || 0)}%</span>` : ''}
              <span>Opening: ${escapeHtml(formatMoney(acc.openingBalance || 0))}</span>
            </div>
            ${acc.notes ? `<div class="text-muted" style="font-size:0.78rem;">${escapeHtml(acc.notes)}</div>` : ''}

            <div class="savings-card-actions">
              <button type="button" class="btn btn-income btn-sm" data-quick-stx="deposit" data-acc-id="${escapeHtml(acc.id)}">+ Add Money</button>
              <button type="button" class="btn btn-outgoing btn-sm" data-quick-stx="withdrawal" data-acc-id="${escapeHtml(acc.id)}">- Remove</button>
              <button type="button" class="btn btn-ghost btn-sm" data-quick-stx="adjustment" data-acc-id="${escapeHtml(acc.id)}">Adjust</button>
              <button type="button" class="icon-btn danger" data-delete-sav-acc="${escapeHtml(acc.id)}">Delete</button>
            </div>
          </article>
        `;
      }).join('');
    }

    // Update account filter options while preserving selection
    const filterSel = document.getElementById('ledgerAccountFilter');
    const prevVal = filterSel.value || 'all';
    filterSel.innerHTML = `<option value="all">All Accounts & Assets</option>` +
      accounts.map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.name)}</option>`).join('');
    filterSel.value = accounts.some((a) => a.id === prevVal) ? prevVal : 'all';

    renderSavingsLedger();
  }

  function renderSavingsLedger() {
    const accountFilter = document.getElementById('ledgerAccountFilter').value;
    const scopeFilter = document.getElementById('ledgerScopeFilter').value;
    const typeFilter = document.getElementById('ledgerTypeFilter').value;
    const q = document.getElementById('ledgerSearchInput').value.trim().toLowerCase();

    const accountMap = Object.fromEntries((runtime.state.savingsAccounts || []).map((a) => [a.id, a]));
    const rows = (runtime.state.savingsTransactions || [])
      .filter((tx) => {
        if (accountFilter !== 'all' && tx.accountId !== accountFilter) return false;
        if (scopeFilter === 'selected' && tx.month !== runtime.selectedMonth) return false;
        if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
        if (q) {
          const accName = accountMap[tx.accountId]?.name || '';
          const hay = `${accName} ${tx.category || ''} ${tx.note || ''} ${tx.date || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''));

    const wrap = document.getElementById('savingsLedgerTableWrap');
    if (!rows.length) {
      wrap.innerHTML = '<div class="empty-state">No savings or asset transactions match the current filters.</div>';
      return;
    }

    wrap.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Account / Asset</th>
            <th>Movement</th>
            <th>Category</th>
            <th>Notes</th>
            <th class="num">Amount</th>
            <th class="num">Action</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((tx) => {
            const delta = getSignedTxDelta(tx);
            const acc = accountMap[tx.accountId];
            const typeBadge = tx.type === 'deposit'
              ? '<span class="badge badge-one-off">Addition (+)</span>'
              : tx.type === 'withdrawal'
                ? '<span class="badge badge-override">Removal (-)</span>'
                : '<span class="badge badge-weekly">Adjustment</span>';
            return `
              <tr>
                <td>${escapeHtml(tx.date || tx.month)}</td>
                <td><strong>${escapeHtml(acc ? acc.name : 'Deleted Account')}</strong></td>
                <td>${typeBadge}</td>
                <td>${escapeHtml(tx.category || '—')}</td>
                <td style="white-space:normal;min-width:180px;">${escapeHtml(tx.note || '—')}</td>
                <td class="num"><strong class="${delta >= 0 ? 'text-emerald' : 'text-rose'}">${escapeHtml(formatMoney(delta, true))}</strong></td>
                <td class="num"><button type="button" class="icon-btn danger" data-delete-stx="${escapeHtml(tx.id)}">Delete</button></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  function renderRollingHistory() {
    const months = [];
    for (let offset = -5; offset <= 6; offset++) {
      months.push(shiftMonth(runtime.selectedMonth, offset));
    }

    const summaries = months.map((m) => computeMonthSummary(m));
    const maxBar = Math.max(
      1,
      ...summaries.map((s) => Math.max(s.totalIncome, s.totalOutgoings))
    );

    const chartEl = document.getElementById('rollingChartContainer');
    chartEl.innerHTML = summaries.map((s) => {
      const incH = Math.max(3, Math.round((s.totalIncome / maxBar) * 114));
      const outH = Math.max(3, Math.round((s.totalOutgoings / maxBar) * 114));
      const isSelected = s.month === runtime.selectedMonth;
      return `
        <div class="chart-col ${isSelected ? 'active' : ''}" data-select-month="${s.month}" title="Open ${escapeHtml(formatMonthLong(s.month))}">
          <div class="chart-bars">
            <div class="bar-inc" style="height:${incH}px" title="Income: ${escapeHtml(formatMoney(s.totalIncome))}"></div>
            <div class="bar-out" style="height:${outH}px" title="Outgoings: ${escapeHtml(formatMoney(s.totalOutgoings))}"></div>
          </div>
          <div class="chart-label">${escapeHtml(formatMonthShort(s.month))}</div>
          <div class="chart-net ${s.moneyLeftOver >= 0 ? 'text-emerald' : 'text-rose'}">${escapeHtml(formatMoney(s.moneyLeftOver, true))}</div>
        </div>
      `;
    }).join('');

    let runningCarry = 0;
    const tableWrap = document.getElementById('rollingTableWrap');
    tableWrap.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Month</th>
            <th class="num">Income</th>
            <th class="num">Monthly DDs</th>
            <th class="num">Weekly DDs</th>
            <th class="num">One-Offs</th>
            <th class="num">Total Outgoings</th>
            <th class="num">Left Over</th>
            <th class="num">Savings Added</th>
            <th class="num">Rolling Cash Carry</th>
            <th class="num">Total Savings &amp; Assets</th>
          </tr>
        </thead>
        <tbody>
          ${summaries.map((s) => {
            runningCarry += s.moneyLeftOver - s.savingsAdded + s.savingsRemoved;
            const isSelected = s.month === runtime.selectedMonth;
            return `
              <tr class="${isSelected ? 'row-active' : ''}" data-select-month="${s.month}" style="cursor:pointer;">
                <td><strong>${escapeHtml(formatMonthLong(s.month))}</strong></td>
                <td class="num text-emerald">${escapeHtml(formatMoney(s.totalIncome))}</td>
                <td class="num">${escapeHtml(formatMoney(s.outBreakdown.monthly))}</td>
                <td class="num">${escapeHtml(formatMoney(s.outBreakdown.weekly))}</td>
                <td class="num">${escapeHtml(formatMoney(s.outBreakdown['one-off']))}</td>
                <td class="num text-rose">${escapeHtml(formatMoney(s.totalOutgoings))}</td>
                <td class="num"><strong class="${s.moneyLeftOver >= 0 ? 'text-emerald' : 'text-rose'}">${escapeHtml(formatMoney(s.moneyLeftOver, true))}</strong></td>
                <td class="num text-sky">${escapeHtml(formatMoney(s.savingsAdded))}</td>
                <td class="num">${escapeHtml(formatMoney(runningCarry, true))}</td>
                <td class="num"><strong>${escapeHtml(formatMoney(s.totalSavingsAtMonth))}</strong></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  function buildSearchIndex() {
    const state = runtime.state;
    const currentMonth = getCurrentMonth();

    // Collect full range from earliest data/12 months ago through latest data/12 months ahead
    let minMonth = shiftMonth(currentMonth, -12);
    let maxMonth = shiftMonth(currentMonth, 12);

    for (const e of state.entries || []) {
      if (e.month && e.month < minMonth) minMonth = e.month;
      if (e.month && e.month > maxMonth) maxMonth = e.month;
      if (e.startMonth && e.startMonth < minMonth) minMonth = e.startMonth;
      if (e.endMonth && e.endMonth > maxMonth) maxMonth = e.endMonth;
    }
    for (const tx of state.savingsTransactions || []) {
      if (tx.month && tx.month < minMonth) minMonth = tx.month;
      if (tx.month && tx.month > maxMonth) maxMonth = tx.month;
    }

    // Clamp overly wide ranges to +/- 60 months to stay fast
    const floorCap = shiftMonth(currentMonth, -60);
    const ceilCap = shiftMonth(currentMonth, 60);
    if (minMonth < floorCap) minMonth = floorCap;
    if (maxMonth > ceilCap) maxMonth = ceilCap;

    const months = [];
    let cursor = minMonth;
    let guard = 0;
    while (cursor <= maxMonth && guard < 150) {
      months.push(cursor);
      cursor = shiftMonth(cursor, 1);
      guard++;
    }

    const records = [];
    const categories = new Set();

    for (const m of months) {
      const horizon = getHorizon(m, currentMonth);
      for (const e of state.entries || []) {
        if (!isEntryActiveInMonth(e, m)) continue;
        const r = resolveEntryForMonth(e, m, state);
        if (e.category) categories.add(e.category);
        records.push({
          recordKind: e.kind,
          month: m,
          horizon,
          dateLabel: e.date || (e.frequency === 'monthly' ? `${m}-${pad2(e.dayOfMonth || 1)}` : m),
          title: e.title,
          category: e.category || 'Uncategorized',
          frequency: e.frequency,
          status: r.status,
          amount: r.effectiveAmount,
          signedAmount: e.kind === 'income' ? r.effectiveAmount : -r.effectiveAmount,
          note: r.note,
          entryId: e.id
        });
      }
    }

    const accountMap = Object.fromEntries((state.savingsAccounts || []).map((a) => [a.id, a]));
    for (const tx of state.savingsTransactions || []) {
      const acc = accountMap[tx.accountId];
      const delta = getSignedTxDelta(tx);
      if (tx.category) categories.add(tx.category);
      records.push({
        recordKind: 'savings',
        month: tx.month,
        horizon: getHorizon(tx.month, currentMonth),
        dateLabel: tx.date || tx.month,
        title: `${acc ? acc.name : 'Savings'} (${tx.type})`,
        category: tx.category || 'Savings Movement',
        frequency: 'one-off',
        status: tx.month <= currentMonth ? 'paid' : 'pending',
        amount: Math.abs(delta),
        signedAmount: delta,
        note: tx.note || '',
        entryId: null
      });
    }

    return { records, categories: Array.from(categories).sort() };
  }

  function renderGlobalSearch() {
    const { records, categories } = buildSearchIndex();
    const catSel = document.getElementById('searchCategoryFilter');
    const prevCat = catSel.value || 'all';
    catSel.innerHTML = '<option value="all">All Categories</option>' +
      categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    catSel.value = categories.includes(prevCat) ? prevCat : 'all';

    const query = document.getElementById('globalSearchInput').value.trim().toLowerCase();
    const horizonFilter = document.getElementById('searchHorizonFilter').value;
    const kindFilter = document.getElementById('searchKindFilter').value;
    const freqFilter = document.getElementById('searchFreqFilter').value;
    const categoryFilter = catSel.value;
    const statusFilter = document.getElementById('searchStatusFilter').value;
    const fromMonth = document.getElementById('searchFromMonth').value;
    const toMonth = document.getElementById('searchToMonth').value;

    document.getElementById('searchCustomRangeRow').classList.toggle('hidden', horizonFilter !== 'range');

    const matches = records.filter((rec) => {
      if (horizonFilter === 'past' && rec.horizon !== 'past') return false;
      if (horizonFilter === 'current' && rec.horizon !== 'current') return false;
      if (horizonFilter === 'future' && rec.horizon !== 'future') return false;
      if (horizonFilter === 'range') {
        if (fromMonth && rec.month < fromMonth) return false;
        if (toMonth && rec.month > toMonth) return false;
      }
      if (kindFilter !== 'all' && rec.recordKind !== kindFilter) return false;
      if (freqFilter !== 'all' && rec.frequency !== freqFilter) return false;
      if (categoryFilter !== 'all' && rec.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && rec.status !== statusFilter) return false;

      if (query) {
        const hay = `${rec.title} ${rec.category} ${rec.note} ${rec.month} ${rec.dateLabel} ${rec.frequency} ${rec.recordKind}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });

    // Sort chronologically (newest / future first or closest first: descending by month)
    matches.sort((a, b) => b.month.localeCompare(a.month) || b.dateLabel.localeCompare(a.dateLabel));

    let totalIn = 0;
    let totalOut = 0;
    let totalSav = 0;
    for (const m of matches) {
      if (m.recordKind === 'income') totalIn += m.amount;
      else if (m.recordKind === 'outgoing') totalOut += m.amount;
      else totalSav += m.signedAmount;
    }

    document.getElementById('searchSummaryPills').innerHTML = `
      <span class="kpi-tag">${matches.length} matches</span>
      <span class="kpi-tag text-emerald">In: ${escapeHtml(formatMoney(totalIn))}</span>
      <span class="kpi-tag text-rose">Out: ${escapeHtml(formatMoney(totalOut))}</span>
      <span class="kpi-tag text-sky">Savings Net: ${escapeHtml(formatMoney(totalSav, true))}</span>
    `;

    const wrap = document.getElementById('globalSearchResultsWrap');
    const limited = matches.slice(0, 250);

    if (!limited.length) {
      wrap.innerHTML = '<div class="empty-state">No past, current, or future records matched your search criteria.</div>';
      return;
    }

    wrap.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Month / Date</th>
            <th>Horizon</th>
            <th>Description</th>
            <th>Type</th>
            <th>Frequency</th>
            <th>Category</th>
            <th>Status</th>
            <th class="num">Amount</th>
            <th class="num">Inspect</th>
          </tr>
        </thead>
        <tbody>
          ${limited.map((rec) => {
            const amtClass = rec.recordKind === 'income'
              ? 'text-emerald'
              : rec.recordKind === 'outgoing'
                ? 'text-rose'
                : 'text-sky';
            const horizonLabel = rec.horizon === 'past' ? 'Past' : rec.horizon === 'current' ? 'Current' : 'Future';
            return `
              <tr>
                <td><strong>${escapeHtml(formatMonthShort(rec.month))}</strong><br/><span class="text-muted" style="font-size:0.74rem;">${escapeHtml(rec.dateLabel)}</span></td>
                <td><span class="month-pill-tag tag-${rec.horizon}">${horizonLabel}</span></td>
                <td style="white-space:normal;min-width:190px;"><strong>${escapeHtml(rec.title)}</strong>${rec.note ? `<br/><span class="text-muted" style="font-size:0.74rem;">${escapeHtml(rec.note)}</span>` : ''}</td>
                <td>${escapeHtml(rec.recordKind)}</td>
                <td><span class="badge badge-${rec.frequency}">${escapeHtml(rec.frequency)}</span></td>
                <td>${escapeHtml(rec.category)}</td>
                <td><span class="status-toggle ${rec.status}" style="cursor:default;">${escapeHtml(rec.status)}</span></td>
                <td class="num"><strong class="${amtClass}">${escapeHtml(formatMoney(rec.signedAmount, true))}</strong></td>
                <td class="num"><button type="button" class="btn btn-ghost btn-sm" data-open-month="${rec.month}" data-open-kind="${rec.recordKind}">Open Month</button></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
      ${matches.length > 250 ? `<p class="text-muted" style="font-size:0.8rem;margin-top:8px;">Showing first 250 of ${matches.length} matching records. Refine filters to narrow down.</p>` : ''}
    `;
  }

  function renderAll() {
    if (!runtime.state) return;
    renderTopControls();
    renderMonthNavigator();
    const summary = computeMonthSummary(runtime.selectedMonth);
    renderKpis(summary);
    renderEntriesLists(summary);
    renderOutgoingsBreakdown(summary);
    renderSavingsAllocatorAndSnapshot(summary);
    renderSavingsTab(summary);
    renderRollingHistory();
    renderGlobalSearch();
  }

  // --- MODAL HELPERS ---
  function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
  }

  function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
  }

  function syncEntryModalVisibility() {
    document.querySelectorAll('[data-entry-kind]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.entryKind === runtime.entryModalKind);
    });
    document.querySelectorAll('[data-entry-freq]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.entryFreq === runtime.entryModalFreq);
    });

    document.getElementById('scheduleOneOffFields').classList.toggle('hidden', runtime.entryModalFreq !== 'one-off');
    document.getElementById('scheduleWeeklyFields').classList.toggle('hidden', runtime.entryModalFreq !== 'weekly');
    document.getElementById('scheduleMonthlyFields').classList.toggle('hidden', runtime.entryModalFreq !== 'monthly');
    document.getElementById('entryEssentialWrap').classList.toggle('hidden', runtime.entryModalKind === 'income');

    const isEditing = Boolean(document.getElementById('entryIdInput').value);
    const isRecurring = runtime.entryModalFreq !== 'one-off';
    document.getElementById('entryEditScopeWrap').classList.toggle('hidden', !(isEditing && isRecurring));
  }

  function openEntryModal({ entryId = null, defaultKind = 'outgoing', defaultFreq = 'monthly' } = {}) {
    const form = document.getElementById('entryForm');
    form.reset();
    document.getElementById('entryIdInput').value = entryId || '';
    document.getElementById('editScopeMonthName').textContent = formatMonthLong(runtime.selectedMonth);
    document.getElementById('entryStatusMonthLabel').textContent = formatMonthShort(runtime.selectedMonth);
    document.querySelector('input[name="editScope"][value="series"]').checked = true;

    if (entryId) {
      const entry = runtime.state.entries.find((e) => e.id === entryId);
      if (!entry) return;
      const resolved = resolveEntryForMonth(entry, runtime.selectedMonth);
      runtime.entryModalKind = entry.kind;
      runtime.entryModalFreq = entry.frequency;
      document.getElementById('entryModalTitle').textContent = `Edit ${entry.kind === 'income' ? 'Income' : 'Outgoing'}`;
      document.getElementById('entryTitleInput').value = entry.title;
      document.getElementById('entryAmountInput').value = resolved.hasAmountOverride ? resolved.computedAmount : entry.amount;
      document.getElementById('entryCategoryInput').value = entry.category || '';
      document.getElementById('entryEssentialSelect').value = String(entry.essential !== false);
      document.getElementById('entryOneOffMonthInput').value = entry.month || runtime.selectedMonth;
      document.getElementById('entryOneOffDateInput').value = entry.date || '';
      document.getElementById('entryDayOfWeekInput').value = String(entry.dayOfWeek ?? 5);
      document.getElementById('entryWeeklyStartInput').value = entry.startMonth || runtime.selectedMonth;
      document.getElementById('entryWeeklyEndInput').value = entry.endMonth || '';
      document.getElementById('entryDayOfMonthInput').value = String(entry.dayOfMonth || 1);
      document.getElementById('entryMonthlyStartInput').value = entry.startMonth || runtime.selectedMonth;
      document.getElementById('entryMonthlyEndInput').value = entry.endMonth || '';
      document.getElementById('entryStatusInput').value = resolved.status;
      document.getElementById('entryNotesInput').value = resolved.note || '';
    } else {
      runtime.entryModalKind = defaultKind;
      runtime.entryModalFreq = defaultFreq;
      document.getElementById('entryModalTitle').textContent =
        defaultKind === 'income' ? 'Add Income' : 'Add Outgoing / Direct Debit';
      document.getElementById('entryCategoryInput').value = defaultKind === 'income' ? 'Salary' : 'Bills & Utilities';
      document.getElementById('entryOneOffMonthInput').value = runtime.selectedMonth;
      document.getElementById('entryWeeklyStartInput').value = runtime.selectedMonth;
      document.getElementById('entryMonthlyStartInput').value = runtime.selectedMonth;
      document.getElementById('entryDayOfMonthInput').value = '1';
      document.getElementById('entryStatusInput').value = runtime.selectedMonth < getCurrentMonth() ? 'paid' : 'pending';
    }

    syncEntryModalVisibility();
    openModal('entryModal');
    document.getElementById('entryTitleInput').focus();
  }

  function openDeleteEntryModal(entryId) {
    const entry = runtime.state.entries.find((e) => e.id === entryId);
    if (!entry) return;
    runtime.pendingDeleteId = entryId;

    const isRecurring = entry.frequency !== 'one-off';
    document.getElementById('deleteModalTitle').textContent = `Remove "${entry.title}"`;
    document.getElementById('deleteEntryMessage').textContent = isRecurring
      ? `"${entry.title}" is a recurring ${entry.frequency} item. Would you like to stop it starting from ${formatMonthLong(runtime.selectedMonth)} (keeping all earlier months intact), or delete it completely?`
      : `Are you sure you want to delete the one-off ${entry.kind} "${entry.title}" (${formatMoney(entry.amount)})?`;

    document.getElementById('stopMonthText').textContent = formatMonthLong(runtime.selectedMonth);
    document.getElementById('deleteRecurringChoices').classList.toggle('hidden', !isRecurring);
    document.getElementById('deleteOneOffChoices').classList.toggle('hidden', isRecurring);
    openModal('deleteEntryModal');
  }

  function openSavingsAccountModal(accountId = null) {
    const form = document.getElementById('savingsAccountForm');
    form.reset();
    document.getElementById('savAccIdInput').value = accountId || '';

    if (accountId) {
      const acc = runtime.state.savingsAccounts.find((a) => a.id === accountId);
      if (!acc) return;
      document.getElementById('savingsAccountModalTitle').textContent = `Edit ${acc.name}`;
      document.getElementById('savAccNameInput').value = acc.name;
      document.getElementById('savAccTypeInput').value = acc.type || 'savings';
      document.getElementById('savAccOpeningInput').value = acc.openingBalance ?? 0;
      document.getElementById('savAccTargetInput').value = acc.targetAmount ?? 0;
      document.getElementById('savAccRateInput').value = acc.interestRate ?? 0;
      document.getElementById('savAccWeightInput').value = acc.allocationWeight ?? 0;
      document.getElementById('savAccColorInput').value = acc.color || '#10b981';
      document.getElementById('savAccNotesInput').value = acc.notes || '';
    } else {
      document.getElementById('savingsAccountModalTitle').textContent = 'Add Savings Account or Asset';
      document.getElementById('savAccOpeningInput').value = '0';
      document.getElementById('savAccTargetInput').value = '0';
      document.getElementById('savAccRateInput').value = '4.5';
      document.getElementById('savAccWeightInput').value = '20';
      document.getElementById('savAccColorInput').value = '#10b981';
    }
    openModal('savingsAccountModal');
    document.getElementById('savAccNameInput').focus();
  }

  function syncStxTypeUi() {
    document.querySelectorAll('[data-stx-type]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.stxType === runtime.stxModalType);
    });
    const amtLabel = document.getElementById('stxAmountLabel');
    const catInput = document.getElementById('stxCategoryInput');
    if (runtime.stxModalType === 'deposit') {
      amtLabel.textContent = 'Amount to Add *';
      if (!catInput.value || catInput.value === 'Withdrawal' || catInput.value === 'Valuation Update') {
        catInput.value = 'Deposit';
      }
    } else if (runtime.stxModalType === 'withdrawal') {
      amtLabel.textContent = 'Amount to Remove *';
      if (!catInput.value || catInput.value === 'Deposit' || catInput.value === 'Valuation Update') {
        catInput.value = 'Withdrawal';
      }
    } else {
      amtLabel.textContent = 'Adjustment (+/-) *';
      catInput.value = 'Valuation Update';
    }
  }

  function openSavingsTxModal({ type = 'deposit', accountId = null } = {}) {
    const accounts = runtime.state.savingsAccounts || [];
    if (!accounts.length) {
      showToast('Add a savings account or asset first.', 'error');
      openSavingsAccountModal();
      return;
    }

    document.getElementById('savingsTxForm').reset();
    runtime.stxModalType = type;

    const sel = document.getElementById('stxAccountSelect');
    sel.innerHTML = accounts.map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.name)}</option>`).join('');
    if (accountId && accounts.some((a) => a.id === accountId)) {
      sel.value = accountId;
    }

    const defaultDate = runtime.selectedMonth === getCurrentMonth()
      ? getTodayIso()
      : getLastDayOfMonthIso(runtime.selectedMonth);
    document.getElementById('stxDateInput').value = defaultDate;
    document.getElementById('stxCategoryInput').value = type === 'withdrawal' ? 'Withdrawal' : type === 'adjustment' ? 'Valuation Update' : 'Deposit';
    syncStxTypeUi();
    openModal('savingsTxModal');
    document.getElementById('stxAmountInput').focus();
  }

  function openNetworkModal() {
    const net = runtime.network || {};
    const lanList = document.getElementById('lanUrlsList');
    const urls = [
      { label: 'This computer', url: net.localUrl || window.location.origin },
      ...(net.lanUrls || []).map((u) => ({ label: `LAN (${u.interface})`, url: u.url }))
    ];

    lanList.innerHTML = urls.map((item) => `
      <div class="lan-url-item">
        <div>
          <div class="text-muted" style="font-size:0.74rem;">${escapeHtml(item.label)}</div>
          <code class="lan-url-code">${escapeHtml(item.url)}</code>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" data-copy-url="${escapeHtml(item.url)}">Copy URL</button>
      </div>
    `).join('');

    const diagEl = document.getElementById('cacheDiagnostics');
    const swActive = navigator.serviceWorker && navigator.serviceWorker.controller ? 'Active (Offline Ready)' : 'Registered / Caching';
    diagEl.innerHTML = `
      <div class="diag-box"><span class="text-muted">SQLite Database</span><strong>${escapeHtml(net.storageFiles?.sqlite || 'data/household-budget.sqlite')}</strong></div>
      <div class="diag-box"><span class="text-muted">JSON Auto-Backup</span><strong>${escapeHtml(net.storageFiles?.json || 'data/household-budget.json')}</strong></div>
      <div class="diag-box"><span class="text-muted">Browser Cache</span><strong>localStorage + IndexedDB</strong></div>
      <div class="diag-box"><span class="text-muted">Service Worker</span><strong>${escapeHtml(swActive)}</strong></div>
      <div class="diag-box"><span class="text-muted">Synced Revision</span><strong>Rev #${runtime.revision || 0}</strong></div>
      <div class="diag-box"><span class="text-muted">Sync Queue</span><strong>${runtime.pendingSync ? 'Pending Server Sync' : 'Up to Date'}</strong></div>
    `;

    document.getElementById('householdNameInput').value = runtime.state?.settings?.householdName || 'Household Finance Hub';
    openModal('networkModal');
  }

  // --- EVENT HANDLERS ---
  function bindEvents() {
    // Tab switching
    document.querySelectorAll('.view-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        runtime.activeTab = btn.dataset.tab;
        document.querySelectorAll('.view-tab').forEach((b) => {
          b.classList.toggle('active', b === btn);
          b.setAttribute('aria-selected', String(b === btn));
        });
        document.querySelectorAll('.tab-panel').forEach((p) => {
          p.classList.toggle('active', p.id === `tab-${runtime.activeTab}`);
        });
      });
    });

    // Top bar actions
    document.getElementById('currencySelect').addEventListener('change', (e) => {
      runtime.state.settings.currency = e.target.value;
      persistChange('Currency updated');
    });

    document.getElementById('weeklyModeSelect').addEventListener('change', (e) => {
      runtime.state.settings.weeklyCalcMode = e.target.value;
      runtime.plannedAllocations = {};
      persistChange('Weekly direct debit calculation mode updated');
    });

    document.getElementById('topSearchInput').addEventListener('input', (e) => {
      document.getElementById('globalSearchInput').value = e.target.value;
      renderGlobalSearch();
    });
    document.getElementById('topSearchInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        document.querySelector('.view-tab[data-tab="search"]').click();
        document.getElementById('globalSearchInput').focus();
      }
    });

    document.getElementById('syncStatusBtn').addEventListener('click', openNetworkModal);
    document.getElementById('btnQuickAddIncome').addEventListener('click', () => openEntryModal({ defaultKind: 'income', defaultFreq: 'monthly' }));
    document.getElementById('btnAddIncomeInline').addEventListener('click', () => openEntryModal({ defaultKind: 'income', defaultFreq: 'monthly' }));
    document.getElementById('btnQuickAddOutgoing').addEventListener('click', () => openEntryModal({ defaultKind: 'outgoing', defaultFreq: 'monthly' }));
    document.getElementById('btnAddOutgoingInline').addEventListener('click', () => openEntryModal({ defaultKind: 'outgoing', defaultFreq: 'monthly' }));
    document.getElementById('btnQuickAddSavingsTx').addEventListener('click', () => openSavingsTxModal({ type: 'deposit' }));

    // Rolling Month Navigation
    document.getElementById('btnPrevMonth').addEventListener('click', () => {
      runtime.selectedMonth = shiftMonth(runtime.selectedMonth, -1);
      runtime.plannedAllocations = {};
      renderAll();
    });
    document.getElementById('btnNextMonth').addEventListener('click', () => {
      runtime.selectedMonth = shiftMonth(runtime.selectedMonth, 1);
      runtime.plannedAllocations = {};
      renderAll();
    });
    document.getElementById('btnTodayMonth').addEventListener('click', () => {
      runtime.selectedMonth = getCurrentMonth();
      runtime.plannedAllocations = {};
      renderAll();
    });
    document.getElementById('monthPickerInput').addEventListener('change', (e) => {
      if (e.target.value) {
        runtime.selectedMonth = e.target.value;
        runtime.plannedAllocations = {};
        renderAll();
      }
    });

    // Outgoing filter chips
    document.getElementById('outgoingFilterChips').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-filter]');
      if (!chip) return;
      runtime.outgoingFilter = chip.dataset.filter;
      document.querySelectorAll('#outgoingFilterChips .chip').forEach((c) => {
        c.classList.toggle('active', c === chip);
      });
      renderEntriesLists(computeMonthSummary(runtime.selectedMonth));
    });

    // Delegated month select & entry actions
    document.body.addEventListener('click', (e) => {
      const closeBtn = e.target.closest('[data-close-modal]');
      if (closeBtn) {
        closeModal(closeBtn.dataset.closeModal);
        return;
      }

      const monthBtn = e.target.closest('[data-select-month]');
      if (monthBtn) {
        runtime.selectedMonth = monthBtn.dataset.selectMonth;
        runtime.plannedAllocations = {};
        renderAll();
        return;
      }

      const openMonthBtn = e.target.closest('[data-open-month]');
      if (openMonthBtn) {
        runtime.selectedMonth = openMonthBtn.dataset.openMonth;
        runtime.plannedAllocations = {};
        const targetTab = openMonthBtn.dataset.openKind === 'savings' ? 'savings' : 'overview';
        document.querySelector(`.view-tab[data-tab="${targetTab}"]`).click();
        renderAll();
        return;
      }

      const toggleBtn = e.target.closest('[data-toggle-status]');
      if (toggleBtn) {
        const entryId = toggleBtn.dataset.toggleStatus;
        const entry = runtime.state.entries.find((item) => item.id === entryId);
        if (!entry) return;
        const resolved = resolveEntryForMonth(entry, runtime.selectedMonth);
        const nextStatus = resolved.status === 'pending' ? 'paid' : resolved.status === 'paid' ? 'skipped' : 'pending';
        const key = `${entryId}_${runtime.selectedMonth}`;
        runtime.state.monthOverrides[key] = {
          ...(runtime.state.monthOverrides[key] || {}),
          status: nextStatus,
          updatedAt: new Date().toISOString()
        };
        persistChange(`Marked "${entry.title}" as ${nextStatus}`);
        return;
      }

      const editEntryBtn = e.target.closest('[data-edit-entry]');
      if (editEntryBtn) {
        openEntryModal({ entryId: editEntryBtn.dataset.editEntry });
        return;
      }

      const delEntryBtn = e.target.closest('[data-delete-entry]');
      if (delEntryBtn) {
        openDeleteEntryModal(delEntryBtn.dataset.deleteEntry);
        return;
      }

      const quickStxBtn = e.target.closest('[data-quick-stx]');
      if (quickStxBtn) {
        openSavingsTxModal({
          type: quickStxBtn.dataset.quickStx,
          accountId: quickStxBtn.dataset.accId
        });
        return;
      }

      const editSavBtn = e.target.closest('[data-edit-sav-acc]');
      if (editSavBtn) {
        openSavingsAccountModal(editSavBtn.dataset.editSavAcc);
        return;
      }

      const delSavBtn = e.target.closest('[data-delete-sav-acc]');
      if (delSavBtn) {
        const id = delSavBtn.dataset.deleteSavAcc;
        const acc = runtime.state.savingsAccounts.find((a) => a.id === id);
        if (!acc) return;
        if (!window.confirm(`Delete "${acc.name}" and its transaction history?`)) return;
        runtime.state.savingsAccounts = runtime.state.savingsAccounts.filter((a) => a.id !== id);
        runtime.state.savingsTransactions = runtime.state.savingsTransactions.filter((t) => t.accountId !== id);
        persistChange(`Deleted "${acc.name}"`);
        return;
      }

      const delStxBtn = e.target.closest('[data-delete-stx]');
      if (delStxBtn) {
        const txId = delStxBtn.dataset.deleteStx;
        runtime.state.savingsTransactions = runtime.state.savingsTransactions.filter((t) => t.id !== txId);
        persistChange('Removed savings transaction');
        return;
      }

      const copyUrlBtn = e.target.closest('[data-copy-url]');
      if (copyUrlBtn) {
        const url = copyUrlBtn.dataset.copyUrl;
        navigator.clipboard?.writeText(url).then(
          () => showToast(`Copied ${url}`, 'success'),
          () => showToast(`URL: ${url}`, 'info')
        );
      }
    });

    // Savings Allocator controls
    document.getElementById('safetyBufferInput').addEventListener('change', (e) => {
      runtime.state.settings.safetyBuffer = Math.max(0, Number(e.target.value || 0));
      runtime.plannedAllocations = {};
      persistChange('Safety buffer updated');
    });

    document.getElementById('allocatorAccountsList').addEventListener('input', (e) => {
      const inp = e.target.closest('[data-alloc-account]');
      if (!inp) return;
      runtime.plannedAllocations[inp.dataset.allocAccount] = Math.max(0, Number(inp.value || 0));
      const sum = Object.values(runtime.plannedAllocations).reduce((s, v) => s + Math.max(0, Number(v || 0)), 0);
      document.getElementById('allocPlannedTotal').textContent = formatMoney(sum);
    });

    document.getElementById('btnAutoSplitSavings').addEventListener('click', () => {
      const summary = computeMonthSummary(runtime.selectedMonth);
      runtime.plannedAllocations = computeAutoSplitAllocations(summary.allocatableSurplus);
      renderSavingsAllocatorAndSnapshot(summary);
    });

    document.getElementById('btnClearSplitSavings').addEventListener('click', () => {
      for (const acc of runtime.state.savingsAccounts) {
        runtime.plannedAllocations[acc.id] = 0;
      }
      renderSavingsAllocatorAndSnapshot(computeMonthSummary(runtime.selectedMonth));
    });

    document.getElementById('btnCommitAllocation').addEventListener('click', () => {
      const savingsOnly = (runtime.state.savingsAccounts || []).filter((a) => a.type !== 'asset');
      const txDate = runtime.selectedMonth === getCurrentMonth()
        ? getTodayIso()
        : getLastDayOfMonthIso(runtime.selectedMonth);

      let addedCount = 0;
      let totalMoved = 0;
      for (const acc of savingsOnly) {
        const amt = Math.round(Math.max(0, Number(runtime.plannedAllocations[acc.id] || 0)) * 100) / 100;
        if (amt > 0) {
          runtime.state.savingsTransactions.push({
            id: uid('stx'),
            accountId: acc.id,
            type: 'deposit',
            amount: amt,
            date: txDate,
            month: runtime.selectedMonth,
            category: 'Monthly Allocation',
            note: `Allocated from ${formatMonthLong(runtime.selectedMonth)} leftover cash`,
            createdAt: new Date().toISOString()
          });
          addedCount++;
          totalMoved += amt;
        }
      }

      if (addedCount === 0) {
        showToast('Enter at least one allocation amount above 0.', 'error');
        return;
      }

      runtime.plannedAllocations = {};
      persistChange(`Moved ${formatMoney(totalMoved)} into ${addedCount} savings account(s)`);
    });

    document.getElementById('btnGoToSavingsTab').addEventListener('click', () => {
      document.querySelector('.view-tab[data-tab="savings"]').click();
    });

    // Entry modal segmented buttons & submit
    document.querySelectorAll('[data-entry-kind]').forEach((btn) => {
      btn.addEventListener('click', () => {
        runtime.entryModalKind = btn.dataset.entryKind;
        syncEntryModalVisibility();
      });
    });

    document.querySelectorAll('[data-entry-freq]').forEach((btn) => {
      btn.addEventListener('click', () => {
        runtime.entryModalFreq = btn.dataset.entryFreq;
        syncEntryModalVisibility();
      });
    });

    document.getElementById('entryForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const entryId = document.getElementById('entryIdInput').value;
      const title = document.getElementById('entryTitleInput').value.trim();
      const amount = Number(document.getElementById('entryAmountInput').value);
      const category = document.getElementById('entryCategoryInput').value.trim() || 'General';
      const essential = document.getElementById('entryEssentialSelect').value === 'true';
      const status = document.getElementById('entryStatusInput').value;
      const notes = document.getElementById('entryNotesInput').value.trim();

      if (!title || !Number.isFinite(amount) || amount <= 0) {
        showToast('Please enter a valid description and positive amount.', 'error');
        return;
      }

      const freq = runtime.entryModalFreq;
      const kind = runtime.entryModalKind;

      if (entryId) {
        const existing = runtime.state.entries.find((item) => item.id === entryId);
        if (!existing) return;

        const editScope = freq !== 'one-off'
          ? document.querySelector('input[name="editScope"]:checked')?.value || 'series'
          : 'series';

        const overrideKey = `${entryId}_${runtime.selectedMonth}`;
        if (editScope === 'month' && freq !== 'one-off') {
          runtime.state.monthOverrides[overrideKey] = {
            ...(runtime.state.monthOverrides[overrideKey] || {}),
            status,
            amount,
            note: notes,
            updatedAt: new Date().toISOString()
          };
          closeModal('entryModal');
          persistChange(`Updated ${formatMonthShort(runtime.selectedMonth)} override for "${title}"`);
          return;
        }

        existing.kind = kind;
        existing.frequency = freq;
        existing.title = title;
        existing.amount = amount;
        existing.category = category;
        existing.essential = kind === 'income' ? false : essential;
        existing.notes = notes;

        if (freq === 'one-off') {
          const exactDate = document.getElementById('entryOneOffDateInput').value;
          const m = document.getElementById('entryOneOffMonthInput').value || (exactDate ? exactDate.slice(0, 7) : runtime.selectedMonth);
          existing.month = m;
          existing.date = exactDate || null;
          existing.startMonth = null;
          existing.endMonth = null;
        } else if (freq === 'weekly') {
          existing.dayOfWeek = Number(document.getElementById('entryDayOfWeekInput').value);
          existing.startMonth = document.getElementById('entryWeeklyStartInput').value || runtime.selectedMonth;
          existing.endMonth = document.getElementById('entryWeeklyEndInput').value || null;
          existing.month = null;
        } else {
          existing.dayOfMonth = Number(document.getElementById('entryDayOfMonthInput').value || 1);
          existing.startMonth = document.getElementById('entryMonthlyStartInput').value || runtime.selectedMonth;
          existing.endMonth = document.getElementById('entryMonthlyEndInput').value || null;
          existing.month = null;
        }

        const targetMonth = freq === 'one-off' ? existing.month : runtime.selectedMonth;
        runtime.state.monthOverrides[`${entryId}_${targetMonth}`] = {
          ...(runtime.state.monthOverrides[`${entryId}_${targetMonth}`] || {}),
          status,
          updatedAt: new Date().toISOString()
        };
        delete runtime.state.monthOverrides[`${entryId}_${targetMonth}`].amount;

        closeModal('entryModal');
        persistChange(`Updated "${title}"`);
        return;
      }

      // Create new entry
      const newId = uid(kind === 'income' ? 'inc' : 'out');
      let entryMonth = null;
      let exactDate = null;
      let startMonth = null;
      let endMonth = null;
      let dayOfMonth = null;
      let dayOfWeek = null;

      if (freq === 'one-off') {
        exactDate = document.getElementById('entryOneOffDateInput').value || null;
        entryMonth = document.getElementById('entryOneOffMonthInput').value || (exactDate ? exactDate.slice(0, 7) : runtime.selectedMonth);
      } else if (freq === 'weekly') {
        dayOfWeek = Number(document.getElementById('entryDayOfWeekInput').value);
        startMonth = document.getElementById('entryWeeklyStartInput').value || runtime.selectedMonth;
        endMonth = document.getElementById('entryWeeklyEndInput').value || null;
      } else {
        dayOfMonth = Number(document.getElementById('entryDayOfMonthInput').value || 1);
        startMonth = document.getElementById('entryMonthlyStartInput').value || runtime.selectedMonth;
        endMonth = document.getElementById('entryMonthlyEndInput').value || null;
      }

      runtime.state.entries.push({
        id: newId,
        kind,
        title,
        category,
        frequency: freq,
        amount,
        dayOfMonth,
        dayOfWeek,
        month: entryMonth,
        date: exactDate,
        startMonth,
        endMonth,
        essential: kind === 'income' ? false : essential,
        notes,
        createdAt: new Date().toISOString()
      });

      const statusTargetMonth = freq === 'one-off' ? entryMonth : runtime.selectedMonth;
      runtime.state.monthOverrides[`${newId}_${statusTargetMonth}`] = {
        status,
        updatedAt: new Date().toISOString()
      };

      closeModal('entryModal');
      persistChange(`Added ${freq} ${kind}: "${title}"`);
    });

    // Delete modal buttons
    document.getElementById('btnStopFromMonth').addEventListener('click', () => {
      const id = runtime.pendingDeleteId;
      const entry = runtime.state.entries.find((e) => e.id === id);
      if (!entry) return;
      const prevMonth = shiftMonth(runtime.selectedMonth, -1);
      if (entry.startMonth && prevMonth < entry.startMonth) {
        runtime.state.entries = runtime.state.entries.filter((e) => e.id !== id);
      } else {
        entry.endMonth = prevMonth;
      }
      closeModal('deleteEntryModal');
      persistChange(`Stopped "${entry.title}" from ${formatMonthShort(runtime.selectedMonth)} onwards`);
    });

    document.getElementById('btnDeleteAllMonths').addEventListener('click', () => {
      const id = runtime.pendingDeleteId;
      const entry = runtime.state.entries.find((e) => e.id === id);
      runtime.state.entries = runtime.state.entries.filter((e) => e.id !== id);
      closeModal('deleteEntryModal');
      persistChange(`Deleted "${entry ? entry.title : 'item'}" from all months`);
    });

    document.getElementById('btnConfirmOneOffDelete').addEventListener('click', () => {
      const id = runtime.pendingDeleteId;
      const entry = runtime.state.entries.find((e) => e.id === id);
      runtime.state.entries = runtime.state.entries.filter((e) => e.id !== id);
      closeModal('deleteEntryModal');
      persistChange(`Deleted "${entry ? entry.title : 'payment'}"`);
    });

    // Savings account modal & submit
    document.getElementById('btnAddSavingsAccount').addEventListener('click', () => openSavingsAccountModal());
    document.getElementById('btnRecordSavingsTx').addEventListener('click', () => openSavingsTxModal({ type: 'deposit' }));

    document.getElementById('savingsAccountForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('savAccIdInput').value;
      const name = document.getElementById('savAccNameInput').value.trim();
      const type = document.getElementById('savAccTypeInput').value;
      const openingBalance = Number(document.getElementById('savAccOpeningInput').value || 0);
      const targetAmount = Math.max(0, Number(document.getElementById('savAccTargetInput').value || 0));
      const interestRate = Number(document.getElementById('savAccRateInput').value || 0);
      const allocationWeight = Math.max(0, Number(document.getElementById('savAccWeightInput').value || 0));
      const color = document.getElementById('savAccColorInput').value || '#10b981';
      const notes = document.getElementById('savAccNotesInput').value.trim();

      if (!name) return;

      if (id) {
        const acc = runtime.state.savingsAccounts.find((a) => a.id === id);
        if (!acc) return;
        Object.assign(acc, { name, type, openingBalance, targetAmount, interestRate, allocationWeight, color, notes });
        closeModal('savingsAccountModal');
        persistChange(`Updated "${name}"`);
      } else {
        runtime.state.savingsAccounts.push({
          id: uid('sav'),
          name,
          type,
          openingBalance,
          targetAmount,
          interestRate,
          allocationWeight,
          color,
          notes,
          createdAt: new Date().toISOString()
        });
        closeModal('savingsAccountModal');
        persistChange(`Added "${name}"`);
      }
    });

    // Savings transaction modal
    document.querySelectorAll('[data-stx-type]').forEach((btn) => {
      btn.addEventListener('click', () => {
        runtime.stxModalType = btn.dataset.stxType;
        syncStxTypeUi();
      });
    });

    document.getElementById('savingsTxForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const accountId = document.getElementById('stxAccountSelect').value;
      const rawAmount = Number(document.getElementById('stxAmountInput').value);
      const date = document.getElementById('stxDateInput').value || getTodayIso();
      const month = date.slice(0, 7);
      const category = document.getElementById('stxCategoryInput').value.trim() || 'Movement';
      const note = document.getElementById('stxNoteInput').value.trim();

      if (!accountId || !Number.isFinite(rawAmount) || rawAmount === 0) {
        showToast('Enter a valid non-zero amount.', 'error');
        return;
      }

      const amount = runtime.stxModalType === 'adjustment' ? rawAmount : Math.abs(rawAmount);
      runtime.state.savingsTransactions.push({
        id: uid('stx'),
        accountId,
        type: runtime.stxModalType,
        amount,
        date,
        month,
        category,
        note,
        createdAt: new Date().toISOString()
      });

      closeModal('savingsTxModal');
      persistChange(
        runtime.stxModalType === 'deposit'
          ? `Added ${formatMoney(amount)} to savings`
          : runtime.stxModalType === 'withdrawal'
            ? `Removed ${formatMoney(amount)} from savings`
            : `Recorded adjustment of ${formatMoney(amount, true)}`
      );
    });

    // Savings ledger filters
    ['ledgerAccountFilter', 'ledgerScopeFilter', 'ledgerTypeFilter'].forEach((id) => {
      document.getElementById(id).addEventListener('change', renderSavingsLedger);
    });
    document.getElementById('ledgerSearchInput').addEventListener('input', renderSavingsLedger);

    // Global search filters
    ['globalSearchInput', 'searchFromMonth', 'searchToMonth'].forEach((id) => {
      document.getElementById(id).addEventListener('input', renderGlobalSearch);
    });
    ['searchHorizonFilter', 'searchKindFilter', 'searchFreqFilter', 'searchCategoryFilter', 'searchStatusFilter'].forEach((id) => {
      document.getElementById(id).addEventListener('change', renderGlobalSearch);
    });

    // Network modal actions
    document.getElementById('btnForceSyncNow').addEventListener('click', async () => {
      if (runtime.pendingSync) await flushSyncToServer();
      else await fetchServerState(true);
      openNetworkModal();
      showToast('Synced with local server', 'success');
    });

    document.getElementById('btnSaveHouseholdName').addEventListener('click', () => {
      const val = document.getElementById('householdNameInput').value.trim();
      if (val) {
        runtime.state.settings.householdName = val;
        persistChange('Household name updated');
      }
    });

    document.getElementById('importBackupInput').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        if (!parsed || !Array.isArray(parsed.entries) || !Array.isArray(parsed.savingsAccounts)) {
          throw new Error('Backup file is missing required budget structure.');
        }
        runtime.state = parsed;
        runtime.plannedAllocations = {};
        closeModal('networkModal');
        persistChange('Backup imported & synced locally');
      } catch (err) {
        showToast(err.message || 'Invalid backup file.', 'error');
      } finally {
        e.target.value = '';
      }
    });

    document.getElementById('btnResetSampleData').addEventListener('click', async () => {
      if (!window.confirm('Replace current ledger with rich sample household data?')) return;
      try {
        const res = await fetch('/api/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'sample', anchorMonth: getCurrentMonth(), clientId: CLIENT_ID })
        });
        const data = await res.json();
        runtime.state = data.state;
        runtime.revision = data.revision;
        runtime.pendingSync = false;
        runtime.plannedAllocations = {};
        writeLocalCache({ state: runtime.state, revision: runtime.revision, updatedAt: data.updatedAt, pendingSync: false });
        closeModal('networkModal');
        renderAll();
        showToast('Sample household data loaded', 'success');
      } catch {
        showToast('Could not reach server to reset sample data.', 'error');
      }
    });

    document.getElementById('btnResetEmptyData').addEventListener('click', async () => {
      if (!window.confirm('Clear all incomes, outgoings, and savings accounts to start completely blank?')) return;
      try {
        const res = await fetch('/api/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'empty', clientId: CLIENT_ID })
        });
        const data = await res.json();
        runtime.state = data.state;
        runtime.revision = data.revision;
        runtime.pendingSync = false;
        runtime.plannedAllocations = {};
        writeLocalCache({ state: runtime.state, revision: runtime.revision, updatedAt: data.updatedAt, pendingSync: false });
        closeModal('networkModal');
        renderAll();
        showToast('Cleared to blank household ledger', 'success');
      } catch {
        showToast('Could not reach server to reset.', 'error');
      }
    });

    // Online / offline listeners
    window.addEventListener('online', () => {
      runtime.online = true;
      updateSyncBadge();
      if (runtime.pendingSync) flushSyncToServer();
      else fetchServerState();
    });
    window.addEventListener('offline', () => {
      runtime.online = false;
      updateSyncBadge();
      showToast('Offline mode — edits will be cached locally and synced when reconnected.', 'info');
    });

    // Backdrop click closes modals
    document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) backdrop.classList.add('hidden');
      });
    });
  }

  // --- BOOTSTRAP ---
  async function init() {
    bindEvents();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const cached = await readLocalCache();
    if (cached && cached.state) {
      runtime.state = cached.state;
      runtime.revision = cached.revision || 0;
      runtime.updatedAt = cached.updatedAt || null;
      runtime.pendingSync = Boolean(cached.pendingSync);
      renderAll();
      updateSyncBadge();
    }

    await fetchServerState();
    setupEventStream();
  }

  init();
})();
