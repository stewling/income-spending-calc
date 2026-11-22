(() => {
  'use strict';

  const LS_KEY = 'hb_state_cache_v1';
  const THEME_LS_KEY = 'hb_theme_v1';
  const IDB_NAME = 'HouseholdBudgetLocalDB';
  const IDB_STORE = 'stateCache';
  const CLIENT_ID = `client_${Math.random().toString(36).slice(2, 10)}`;
  const THEMES = [
    { id: 'dark', name: 'Dark (Midnight)', group: 'Default Slate Dark', bg: '#0b1120', card: '#162033', text: '#f1f5f9', accent: '#38bdf8', income: '#10b981', outgoing: '#f43f5e' },
    { id: 'oled', name: 'Dark OLED', group: 'Pure Pitch Black', bg: '#000000', card: '#0c0e14', text: '#f8fafc', accent: '#00e5ff', income: '#00e676', outgoing: '#ff4081' },
    { id: 'light', name: 'Light Daylight', group: 'Crisp High Contrast', bg: '#f1f5f9', card: '#ffffff', text: '#0f172a', accent: '#0284c7', income: '#059669', outgoing: '#e11d48' },
    { id: 'dracula', name: 'Dracula', group: 'Vampire Violet & Pink', bg: '#1e1f29', card: '#313444', text: '#f8f8f2', accent: '#bd93f9', income: '#50fa7b', outgoing: '#ff5555' },
    { id: 'emerald', name: 'Emerald Forest', group: 'Deep Pine & Jade', bg: '#04130e', card: '#0d291e', text: '#ecfdf5', accent: '#2dd4bf', income: '#34d399', outgoing: '#fb7185' },
    { id: 'cyberpunk', name: 'Synthwave Neon', group: 'Violet, Cyan & Magenta', bg: '#0c0418', card: '#1d0d36', text: '#faf5ff', accent: '#00f0ff', income: '#00ff9d', outgoing: '#ff2a85' },
    { id: 'nord', name: 'Nordic Frost', group: 'Arctic Slate & Ice Blue', bg: '#242933', card: '#3b4252', text: '#eceff4', accent: '#88c0d0', income: '#a3be8c', outgoing: '#bf616a' },
    { id: 'sunset', name: 'Sunset Amber', group: 'Espresso & Warm Gold', bg: '#160d0a', card: '#2c1b15', text: '#fef3c7', accent: '#fb923c', income: '#34d399', outgoing: '#f43f5e' },
    { id: 'ocean', name: 'Deep Ocean', group: 'Abyssal Navy & Aqua', bg: '#031521', card: '#0b2d44', text: '#f0f9ff', accent: '#38bdf8', income: '#2dd4bf', outgoing: '#fb7185' },
    { id: 'rose', name: 'Rosé Pine', group: 'Plum, Rose & Champagne', bg: '#191724', card: '#26233a', text: '#e0def4', accent: '#c4a7e7', income: '#9ccfd8', outgoing: '#eb6f92' }
  ];
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
  const DEFAULT_MEMBERS = [
    { id: 'mem_joint', name: 'Joint Account', role: 'joint', color: '#38bdf8' },
    { id: 'mem_mine', name: 'My Account', role: 'personal', color: '#10b981' },
    { id: 'mem_partner', name: 'Partner Account', role: 'personal', color: '#a78bfa' }
  ];
  const CATEGORY_COLORS = [
    '#38bdf8', '#818cf8', '#10b981', '#f59e0b',
    '#f43f5e', '#a78bfa', '#06b6d4', '#fb7185', '#34d399'
  ];
  const EMOJI_PRESETS = {
    outgoing: ['🏠', '⚡', '💧', '🌐', '🛒', '🚗', '🛡️', '📺', '📱', '🧒', '🍔', '☕', '💊', '✈️', '🎁', '🛍️', '🔧', '💳', '🧾', '🐾'],
    income: ['💼', '💷', '💰', '💻', '🎨', '🎉', '🧾', '📈', '📦', '🏆', '🤝', '🪙', '🏠', '🛠️', '✨', '🏦'],
    savingsAccount: ['🏦', '📈', '💰', '🪙', '🏡', '🚗', '✈️', '🎓', '💍', '🛠️', '💎', '🚀', '🛡️', '🌴', '📦', '👶'],
    savingsTx: ['🏦', '📈', '💰', '🪙', '✈️', '🏡', '🚗', '💸', '🔧', '⚖️', '🛡️', '🎁', '🏖️', '💳', '🆘', '✨']
  };

  function getEntryIcon(entry, overrideIcon = '') {
    const custom = (overrideIcon || entry?.icon || '').trim();
    if (custom) return custom;
    const text = `${entry?.category || ''} ${entry?.title || ''}`.toLowerCase();
    if (entry?.kind === 'income') {
      if (/salary|wage|payroll|paycheck/.test(text)) return '💼';
      if (/freelance|retainer|gig|design|consult/.test(text)) return '💻';
      if (/bonus|award|prize/.test(text)) return '🎉';
      if (/refund|rebate|hmrc|tax|cashback/.test(text)) return '🧾';
      if (/dividend|interest|stock|share/.test(text)) return '📈';
      if (/sell|sold|sale|vinted|ebay|clearout/.test(text)) return '📦';
      return '💷';
    }
    if (/mortgage|rent|housing|property/.test(text)) return '🏠';
    if (/council|tax|gov/.test(text)) return '🏛️';
    if (/energy|gas|electric|power|fuel oil/.test(text)) return '⚡';
    if (/water|sewer/.test(text)) return '💧';
    if (/broadband|fibre|internet|wifi/.test(text)) return '🌐';
    if (/mobile|phone|sim/.test(text)) return '📱';
    if (/insur|cover|warranty/.test(text)) return '🛡️';
    if (/stream|tv|netflix|spotify|disney|apple|cloud|sub/.test(text)) return '📺';
    if (/grocer|supermarket|food|tesco|asda|aldi|lidl|sainsbury|waitrose/.test(text)) return '🛒';
    if (/coffee|cafe|dining|restaurant|takeaway|pizza|eat/.test(text)) return '🍔';
    if (/child|nursery|school|club|kids/.test(text)) return '🧒';
    if (/car|mot|garage|petrol|diesel|ev|parking|rail|train|bus|commut|transport/.test(text)) return '🚗';
    if (/dent|health|doctor|gym|fitness|swim|med|pharm/.test(text)) return '🏥';
    if (/travel|holiday|flight|hotel|trip|weekend|vacation/.test(text)) return '✈️';
    if (/gift|christmas|xmas|birthday|celebrat/.test(text)) return '🎁';
    if (/shop|coat|cloth|shoe|amazon|gear/.test(text)) return '🛍️';
    if (/boiler|repair|plumb|service|maint/.test(text)) return '🔧';
    if (/pet|dog|cat|vet/.test(text)) return '🐾';
    return '🧾';
  }

  function getSavingsAccountIcon(acc) {
    const custom = (acc?.icon || '').trim();
    if (custom) return custom;
    const text = `${acc?.name || ''}`.toLowerCase();
    if (/car|auto|vehicle|bike|van/.test(text)) return '🚗';
    if (/holiday|travel|trip|flight|vacation/.test(text)) return '✈️';
    if (/home|house|kitchen|garden|property|deposit/.test(text)) return '🏡';
    if (/emerg|cushion|rainy/.test(text)) return '🏦';
    if (/isa|stock|share|invest|pension|sipp/.test(text)) return '📈';
    if (acc?.type === 'isa') return '📈';
    if (acc?.type === 'investment') return '📊';
    if (acc?.type === 'cash') return '🪙';
    if (acc?.type === 'asset') return '🏡';
    return '🏦';
  }

  function getSavingsTxIcon(tx, acc = null, overrideIcon = '') {
    const custom = (overrideIcon || tx?.icon || '').trim();
    if (custom) return custom;
    if (tx?.type === 'withdrawal') return '💸';
    if (tx?.type === 'adjustment') return '⚖️';
    return acc ? getSavingsAccountIcon(acc) : '🏦';
  }

  function renderEmojiPicker(containerId, targetInputId, presets) {
    const container = document.getElementById(containerId);
    const input = document.getElementById(targetInputId);
    if (!container || !input) return;
    const current = input.value.trim();
    container.innerHTML = presets.map((emoji) => `
      <button
        type="button"
        class="emoji-pick-btn ${current === emoji ? 'active' : ''}"
        data-pick-emoji="${escapeHtml(emoji)}"
        data-target-input="${escapeHtml(targetInputId)}"
        data-picker-id="${escapeHtml(containerId)}"
        title="Use ${escapeHtml(emoji)}"
      >${escapeHtml(emoji)}</button>
    `).join('') + (current ? `<button type="button" class="icon-btn" style="padding:2px 7px;font-size:0.7rem;" data-pick-emoji="" data-target-input="${escapeHtml(targetInputId)}" data-picker-id="${escapeHtml(containerId)}" title="Clear custom icon (use auto)">Auto</button>` : '');
  }

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
    savingsFilter: 'all',
    memberFilter: 'all',
    allocMemberId: 'all',
    plannedAllocations: {},
    syncInFlight: false,
    syncQueued: false,
    entryModalKind: 'outgoing',
    entryModalFreq: 'monthly',
    stxModalType: 'deposit',
    stxModalFreq: 'one-off',
    mtrModalFreq: 'monthly',
    plannedJointTransfers: {},
    pendingDeleteId: null,
    pendingDeleteKind: 'entry'
  };

  // --- MEMBER HELPERS ---
  function getMembers(state = runtime.state) {
    return Array.isArray(state?.members) && state.members.length ? state.members : DEFAULT_MEMBERS;
  }

  function ensureValidClientState(state) {
    const base = state && typeof state === 'object' && !Array.isArray(state) ? state : {};
    if (!base.settings || typeof base.settings !== 'object') {
      base.settings = {
        currency: 'GBP',
        weeklyCalcMode: 'exact',
        safetyBuffer: 250,
        householdName: 'Household Finance Hub',
        theme: 'dark'
      };
    }
    if (!base.settings.theme || !THEMES.some((t) => t.id === base.settings.theme)) {
      base.settings.theme = 'dark';
    }
    if (!Array.isArray(base.members) || base.members.length === 0) {
      base.members = DEFAULT_MEMBERS.map((m) => ({ ...m }));
    }
    if (!Array.isArray(base.memberTransfers)) base.memberTransfers = [];
    if (!Array.isArray(base.entries)) base.entries = [];
    if (!Array.isArray(base.savingsAccounts)) base.savingsAccounts = [];
    if (!Array.isArray(base.savingsTransactions)) base.savingsTransactions = [];
    if (!base.monthOverrides || typeof base.monthOverrides !== 'object' || Array.isArray(base.monthOverrides)) {
      base.monthOverrides = {};
    }
    return base;
  }

  function getMemberById(memberId, state = runtime.state) {
    const members = getMembers(state);
    return members.find((m) => m.id === memberId) || members[0];
  }

  function renderMemberBadge(memberId, state = runtime.state) {
    const member = getMemberById(memberId, state);
    const color = member?.color || '#38bdf8';
    return `<span class="badge badge-member" style="border-color:${escapeHtml(color)}55"><span class="member-dot" style="background:${escapeHtml(color)}"></span>${escapeHtml(member?.name || 'Joint Account')}</span>`;
  }

  function populateMemberSelects() {
    const members = getMembers();
    const memberOptionsHtml = members
      .map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.name)}${m.role === 'joint' ? ' (Joint)' : ''}</option>`)
      .join('');

    const allFilterConfigs = [
      { id: 'globalMemberFilter', allLabel: 'All Members & Accounts', stateKey: 'memberFilter' },
      { id: 'allocMemberSelect', allLabel: 'Whole Household (Joint Default)', stateKey: 'allocMemberId' },
      { id: 'ledgerMemberFilter', allLabel: 'All Members' },
      { id: 'searchMemberFilter', allLabel: 'All Members & Accounts' }
    ];

    for (const cfg of allFilterConfigs) {
      const el = document.getElementById(cfg.id);
      if (!el) continue;
      const prev = cfg.stateKey ? runtime[cfg.stateKey] : (el.value || 'all');
      el.innerHTML = `<option value="all">${escapeHtml(cfg.allLabel)}</option>${memberOptionsHtml}`;
      const valid = prev === 'all' || members.some((m) => m.id === prev);
      el.value = valid ? prev : 'all';
      if (cfg.stateKey) runtime[cfg.stateKey] = el.value;
    }

    for (const id of ['entryMemberSelect', 'savAccMemberSelect', 'stxMemberSelect', 'mtrFromMemberSelect', 'mtrToMemberSelect']) {
      const el = document.getElementById(id);
      if (!el) continue;
      const prev = el.value;
      el.innerHTML = memberOptionsHtml;
      if (prev && members.some((m) => m.id === prev)) {
        el.value = prev;
      } else if (members[0]) {
        el.value = members[0].id;
      }
    }
  }

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
  function isItemActiveInMonth(item, monthStr) {
    if (!item) return false;
    const freq = item.frequency || 'one-off';
    if (freq === 'one-off') {
      return item.month === monthStr;
    }
    const afterStart = !item.startMonth || item.startMonth <= monthStr;
    const beforeEnd = !item.endMonth || item.endMonth >= monthStr;
    return afterStart && beforeEnd;
  }

  function resolveScheduleItemForMonth(item, monthStr, state = runtime.state, labelMode = 'dd') {
    const currentMonth = getCurrentMonth();
    const freq = item.frequency || 'one-off';
    const overrideKey = `${item.id}_${monthStr}`;
    const override = state.monthOverrides?.[overrideKey] || null;
    const defaultStatus = monthStr < currentMonth ? 'paid' : 'pending';
    const status = override?.status || defaultStatus;
    const weeklyMode = state.settings?.weeklyCalcMode || 'exact';

    let occurrences = [];
    let multiplier = 1;
    let scheduleLabel = '';
    const prefix = labelMode === 'savings' ? 'Payment' : labelMode === 'transfer' ? 'Transfer' : 'DD';

    if (freq === 'one-off') {
      scheduleLabel = item.date ? `One-Off • ${item.date}` : `One-Off • ${formatMonthShort(monthStr)}`;
    } else if (freq === 'monthly') {
      const dom = item.dayOfMonth || 1;
      scheduleLabel = `Monthly ${prefix} • Day ${dom}`;
    } else if (freq === 'weekly') {
      const dow = item.dayOfWeek ?? 5;
      occurrences = getWeekdaysInMonth(monthStr, dow);
      if (weeklyMode === 'exact') {
        multiplier = occurrences.length;
        scheduleLabel = `Weekly ${prefix} • ${WEEKDAYS[dow]}s (${multiplier}×)`;
      } else if (weeklyMode === 'four_week') {
        multiplier = 4;
        scheduleLabel = `Weekly ${prefix} • ${WEEKDAYS[dow]}s (×4)`;
      } else {
        multiplier = 52 / 12;
        scheduleLabel = `Weekly ${prefix} • ${WEEKDAYS[dow]}s (×4.33)`;
      }
    }

    const hasAmountOverride = override && override.amount !== undefined && override.amount !== null && override.amount !== '';
    const baseUnitAmount = Number(item.amount || 0);
    const computedAmount = hasAmountOverride
      ? Number(override.amount)
      : freq === 'weekly'
        ? Math.round(baseUnitAmount * multiplier * 100) / 100
        : baseUnitAmount;

    const effectiveAmount = status === 'skipped' ? 0 : computedAmount;
    const memberId = override?.memberId || item.memberId || getMembers(state)[0]?.id;
    const icon = (override?.icon !== undefined ? override.icon : item.icon || '').trim();

    return {
      month: monthStr,
      freq,
      status,
      override,
      hasAmountOverride,
      baseUnitAmount,
      multiplier,
      occurrences,
      scheduleLabel,
      computedAmount,
      effectiveAmount,
      memberId,
      icon,
      note: override?.note ?? item.notes ?? item.note ?? ''
    };
  }

  function resolveEntryForMonth(entry, monthStr, state = runtime.state) {
    const resolved = resolveScheduleItemForMonth(entry, monthStr, state, 'dd');
    return {
      entry,
      ...resolved
    };
  }

  function resolveSavingsTxForMonth(tx, monthStr, state = runtime.state) {
    const resolved = resolveScheduleItemForMonth(tx, monthStr, state, 'savings');
    const eff = resolved.effectiveAmount;
    let signedDelta = 0;
    if (resolved.status !== 'skipped') {
      if (tx.type === 'deposit') signedDelta = Math.abs(eff);
      else if (tx.type === 'withdrawal') signedDelta = -Math.abs(eff);
      else signedDelta = eff;
    }
    return {
      tx,
      ...resolved,
      signedDelta: Math.round(signedDelta * 100) / 100
    };
  }

  function resolveMemberTransferForMonth(tr, monthStr, state = runtime.state) {
    const resolved = resolveScheduleItemForMonth(tr, monthStr, state, 'transfer');
    const members = getMembers(state);
    const fallbackJoint = members.find((m) => m.role === 'joint') || members[0];
    return {
      tr,
      ...resolved,
      fromMemberId: tr.fromMemberId || members[0]?.id,
      toMemberId: tr.toMemberId || fallbackJoint?.id
    };
  }

  function getActiveSavingsTxsInMonth(monthStr, state = runtime.state, memberFilter = 'all') {
    const list = [];
    for (const tx of state.savingsTransactions || []) {
      if (!isItemActiveInMonth(tx, monthStr)) continue;
      const r = resolveSavingsTxForMonth(tx, monthStr, state);
      if (memberFilter !== 'all' && r.memberId !== memberFilter) continue;
      list.push(r);
    }
    return list;
  }

  function getAccountBalanceAtMonth(account, monthStr, state = runtime.state) {
    let balance = Number(account.openingBalance || 0);
    for (const tx of state.savingsTransactions || []) {
      if (tx.accountId !== account.id) continue;
      const freq = tx.frequency || 'one-off';
      if (freq === 'one-off') {
        if (tx.month && tx.month <= monthStr) {
          balance += resolveSavingsTxForMonth(tx, tx.month, state).signedDelta;
        }
      } else {
        const start = tx.startMonth || monthStr;
        const end = tx.endMonth && tx.endMonth < monthStr ? tx.endMonth : monthStr;
        if (start <= end) {
          let cursor = start;
          let guard = 0;
          while (cursor <= end && guard < 240) {
            balance += resolveSavingsTxForMonth(tx, cursor, state).signedDelta;
            cursor = shiftMonth(cursor, 1);
            guard++;
          }
        }
      }
    }
    return Math.round(balance * 100) / 100;
  }

  function getAccountMonthActivity(accountId, monthStr, state = runtime.state) {
    let added = 0;
    let removed = 0;
    let adjusted = 0;
    for (const tx of state.savingsTransactions || []) {
      if (tx.accountId !== accountId || !isItemActiveInMonth(tx, monthStr)) continue;
      const r = resolveSavingsTxForMonth(tx, monthStr, state);
      if (r.status === 'skipped') continue;
      if (tx.type === 'deposit') added += Math.abs(r.effectiveAmount);
      else if (tx.type === 'withdrawal') removed += Math.abs(r.effectiveAmount);
      else adjusted += r.effectiveAmount;
    }
    return {
      added: Math.round(added * 100) / 100,
      removed: Math.round(removed * 100) / 100,
      adjusted: Math.round(adjusted * 100) / 100,
      net: Math.round((added - removed + adjusted) * 100) / 100
    };
  }

  function computeMonthSummary(monthStr, state = runtime.state, memberFilter = 'all') {
    const members = getMembers(state);
    const byMember = {};
    for (const m of members) {
      byMember[m.id] = {
        member: m,
        income: 0,
        outgoing: 0,
        paidOutgoing: 0,
        upcomingOutgoing: 0,
        essentialOutgoing: 0,
        flexibleOutgoing: 0,
        savingsAdded: 0,
        savingsRemoved: 0,
        transfersIn: 0,
        transfersOut: 0,
        neededForBills: 0,
        neededTotal: 0,
        neededIncludingTransfersOut: 0,
        availableFunds: 0,
        billsShortfall: 0,
        totalShortfall: 0,
        leftoverAfterBills: 0,
        leftover: 0
      };
    }

    const incomes = [];
    const outgoings = [];

    for (const entry of state.entries || []) {
      if (!isItemActiveInMonth(entry, monthStr)) continue;
      const resolved = resolveEntryForMonth(entry, monthStr, state);
      const bucket = byMember[resolved.memberId];
      if (bucket) {
        if (entry.kind === 'income') {
          bucket.income += resolved.effectiveAmount;
        } else {
          bucket.outgoing += resolved.effectiveAmount;
          if (resolved.status === 'paid') bucket.paidOutgoing += resolved.effectiveAmount;
          else if (resolved.status === 'pending') bucket.upcomingOutgoing += resolved.effectiveAmount;
          if (entry.essential !== false) bucket.essentialOutgoing += resolved.effectiveAmount;
          else bucket.flexibleOutgoing += resolved.effectiveAmount;
        }
      }
      if (memberFilter !== 'all' && resolved.memberId !== memberFilter) continue;
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

    // Savings & asset activity in monthStr (including recurring monthly/weekly & one-off)
    const activeSavingsTxs = [];
    let savingsAdded = 0;
    let savingsRemoved = 0;
    let savingsAdjusted = 0;

    for (const tx of state.savingsTransactions || []) {
      if (!isItemActiveInMonth(tx, monthStr)) continue;
      const r = resolveSavingsTxForMonth(tx, monthStr, state);
      const bucket = byMember[r.memberId];
      if (bucket && r.status !== 'skipped') {
        if (tx.type === 'deposit') bucket.savingsAdded += Math.abs(r.effectiveAmount);
        else if (tx.type === 'withdrawal') bucket.savingsRemoved += Math.abs(r.effectiveAmount);
      }
      if (memberFilter !== 'all' && r.memberId !== memberFilter) continue;
      activeSavingsTxs.push(r);
      if (r.status === 'skipped') continue;
      if (tx.type === 'deposit') savingsAdded += Math.abs(r.effectiveAmount);
      else if (tx.type === 'withdrawal') savingsRemoved += Math.abs(r.effectiveAmount);
      else savingsAdjusted += r.effectiveAmount;
    }

    // Personal <-> Joint Account Transfers in monthStr
    const activeTransfers = [];
    for (const tr of state.memberTransfers || []) {
      if (!isItemActiveInMonth(tr, monthStr)) continue;
      const r = resolveMemberTransferForMonth(tr, monthStr, state);
      if (r.status !== 'skipped' && r.fromMemberId !== r.toMemberId) {
        if (byMember[r.toMemberId]) byMember[r.toMemberId].transfersIn += r.effectiveAmount;
        if (byMember[r.fromMemberId]) byMember[r.fromMemberId].transfersOut += r.effectiveAmount;
      }
      if (memberFilter !== 'all' && r.fromMemberId !== memberFilter && r.toMemberId !== memberFilter) continue;
      activeTransfers.push(r);
    }

    for (const id of Object.keys(byMember)) {
      const b = byMember[id];
      b.neededForBills = Math.round(b.outgoing * 100) / 100;
      b.neededTotal = Math.round((b.outgoing + b.savingsAdded) * 100) / 100;
      b.neededIncludingTransfersOut = Math.round((b.outgoing + b.savingsAdded + b.transfersOut) * 100) / 100;
      b.availableFunds = Math.round((b.income + b.transfersIn - b.transfersOut) * 100) / 100;
      b.billsShortfall = Math.round(Math.max(0, b.neededForBills - b.availableFunds) * 100) / 100;
      b.totalShortfall = Math.round(Math.max(0, b.neededTotal - b.availableFunds) * 100) / 100;
      b.leftoverAfterBills = Math.round((b.availableFunds - b.neededForBills) * 100) / 100;
      b.leftover = Math.round((b.availableFunds - b.neededTotal) * 100) / 100;
    }

    let totalSavingsAtMonth = 0;
    let totalSavingsLive = 0;
    const currentMonth = getCurrentMonth();
    for (const acc of state.savingsAccounts || []) {
      const ownerId = acc.memberId || members[0]?.id;
      if (memberFilter !== 'all' && ownerId !== memberFilter) continue;
      totalSavingsAtMonth += getAccountBalanceAtMonth(acc, monthStr, state);
      totalSavingsLive += getAccountBalanceAtMonth(acc, currentMonth, state);
    }

    const filteredBucket = memberFilter !== 'all' ? byMember[memberFilter] : null;
    const transfersIn = filteredBucket ? filteredBucket.transfersIn : 0;
    const transfersOut = filteredBucket ? filteredBucket.transfersOut : 0;
    const availableIncome = filteredBucket ? filteredBucket.availableFunds : totalIncome;
    const moneyLeftOver = availableIncome - totalOutgoings;
    const safetyBuffer = Number(state.settings?.safetyBuffer || 0);
    const allocatableSurplus = Math.max(0, moneyLeftOver - safetyBuffer - savingsAdded);

    return {
      month: monthStr,
      memberFilter,
      incomes,
      outgoings,
      activeSavingsTxs,
      activeTransfers,
      byMember,
      totalIncome,
      availableIncome,
      transfersIn,
      transfersOut,
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
      if (data.state) runtime.state = ensureValidClientState(data.state);
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
    runtime.state = ensureValidClientState(runtime.state);
    runtime.plannedJointTransfers = {};
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
        runtime.state = ensureValidClientState(data.state);
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

  // --- THEME ENGINE ---
  function getActiveThemeId() {
    const raw = document.documentElement.getAttribute('data-theme') || runtime.state?.settings?.theme || 'dark';
    return THEMES.some((t) => t.id === raw) ? raw : 'dark';
  }

  function renderThemeGallery() {
    const grid = document.getElementById('themeGalleryGrid');
    if (!grid) return;
    const activeId = getActiveThemeId();
    grid.innerHTML = THEMES.map((t) => {
      const isActive = t.id === activeId;
      return `
        <button type="button" class="theme-swatch-card ${isActive ? 'active' : ''}" data-select-theme="${escapeHtml(t.id)}">
          <div class="theme-preview-bar" style="background:${escapeHtml(t.bg)}">
            <div class="theme-preview-card" style="background:${escapeHtml(t.card)};color:${escapeHtml(t.text)}">
              <span>£2,535</span>
              <div class="theme-swatch-dots">
                <span class="theme-swatch-dot" style="background:${escapeHtml(t.income)}"></span>
                <span class="theme-swatch-dot" style="background:${escapeHtml(t.outgoing)}"></span>
                <span class="theme-swatch-dot" style="background:${escapeHtml(t.accent)}"></span>
              </div>
            </div>
          </div>
          <div class="theme-card-meta">
            <div>
              <div class="theme-card-title">${escapeHtml(t.name)}</div>
              <div class="theme-card-sub">${escapeHtml(t.group)}</div>
            </div>
            ${isActive ? '<span class="badge badge-one-off">Active</span>' : ''}
          </div>
        </button>
      `;
    }).join('');
  }

  function applyTheme(themeId, { persist = false, toast = false } = {}) {
    const themeMeta = THEMES.find((t) => t.id === themeId) || THEMES[0];
    document.documentElement.setAttribute('data-theme', themeMeta.id);

    const metaThemeEl = document.querySelector('meta[name="theme-color"]');
    if (metaThemeEl) metaThemeEl.setAttribute('content', themeMeta.bg);

    const sel = document.getElementById('themeSelect');
    if (sel && sel.value !== themeMeta.id) sel.value = themeMeta.id;

    try {
      localStorage.setItem(THEME_LS_KEY, themeMeta.id);
    } catch {
      // ignore storage errors
    }

    renderThemeGallery();

    if (persist && runtime.state) {
      runtime.state = ensureValidClientState(runtime.state);
      runtime.state.settings.theme = themeMeta.id;
      persistChange(toast ? `Theme changed to ${themeMeta.name}` : null);
    }
  }

  // --- RENDERING ---
  function renderTopControls() {
    const state = runtime.state;
    document.getElementById('householdTitle').textContent = state.settings?.householdName || 'Household Finance Hub';
    document.getElementById('currencySelect').value = state.settings?.currency || 'GBP';
    document.getElementById('weeklyModeSelect').value = state.settings?.weeklyCalcMode || 'exact';
    document.getElementById('monthPickerInput').value = runtime.selectedMonth;
    applyTheme(state.settings?.theme || localStorage.getItem(THEME_LS_KEY) || 'dark');
    populateMemberSelects();
  }

  function renderMonthNavigator() {
    const strip = document.getElementById('rollingMonthStrip');
    const currentMonth = getCurrentMonth();
    const pills = [];

    for (let offset = -4; offset <= 4; offset++) {
      const m = shiftMonth(runtime.selectedMonth, offset);
      const summary = computeMonthSummary(m, runtime.state, runtime.memberFilter);
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
    const isFiltered = summary.memberFilter && summary.memberFilter !== 'all';
    const filterName = isFiltered ? (getMemberById(summary.memberFilter)?.name || 'Account') : '';

    document.getElementById('kpiIncomeCount').textContent = isFiltered
      ? `${filterName}`
      : `${summary.incomes.length} source${summary.incomes.length === 1 ? '' : 's'}`;
    document.getElementById('kpiIncomeValue').textContent = formatMoney(summary.availableIncome);
    document.getElementById('kpiIncomeSub').textContent = isFiltered
      ? `Direct ${formatMoney(summary.totalIncome)} • Alloc In +${formatMoney(summary.transfersIn)} • Out -${formatMoney(summary.transfersOut)}`
      : `Monthly ${formatMoney(summary.incBreakdown.monthly)} • Weekly ${formatMoney(summary.incBreakdown.weekly)} • One-off ${formatMoney(summary.incBreakdown['one-off'])}`;

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
    const pctLeft = summary.availableIncome > 0
      ? Math.round((summary.moneyLeftOver / summary.availableIncome) * 100)
      : 0;
    document.getElementById('kpiLeftoverPct').textContent = `${pctLeft}% of available`;
    document.getElementById('kpiLeftoverSub').textContent =
      summary.moneyLeftOver >= 0 ? 'Surplus remaining after all outgoings' : 'Deficit — more needed to cover bills';
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

    const icon = getEntryIcon(e, r.icon);

    return `
      <div class="entry-row ${r.status === 'skipped' ? 'is-skipped' : ''}" data-entry-id="${escapeHtml(e.id)}">
        <div class="entry-main">
          <div class="entry-title-line">
            <span class="item-icon-badge" aria-hidden="true">${escapeHtml(icon)}</span>
            <span class="entry-title">${escapeHtml(e.title)}</span>
            <span class="badge badge-${e.frequency}">${escapeHtml(r.scheduleLabel)}</span>
            ${renderMemberBadge(r.memberId)}
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

  function renderMemberBreakdown(summary) {
    const el = document.getElementById('memberBreakdownList');
    if (!el) return;
    const rows = Object.values(summary.byMember || {});
    if (!rows.length) {
      el.innerHTML = '<div class="text-muted" style="font-size:0.82rem;">No members configured yet.</div>';
      return;
    }

    el.innerHTML = rows.map((item) => {
      const m = item.member;
      const isActive = runtime.memberFilter === m.id;
      const activeStyle = isActive
        ? `border-color:${escapeHtml(m.color || '#38bdf8')};background:rgba(56,189,248,0.08);`
        : '';
      return `
        <div class="member-row ${isActive ? 'is-active' : ''}" data-member-card="${escapeHtml(m.id)}"${activeStyle ? ` style="${activeStyle}"` : ''}>
          <div class="member-row-head">
            <div class="member-row-title">
              <span class="member-dot" style="background:${escapeHtml(m.color || '#38bdf8')}"></span>
              <span>${escapeHtml(m.name)}</span>
            </div>
            <div style="display:flex;gap:4px;">
              <button type="button" class="icon-btn" data-edit-member="${escapeHtml(m.id)}" title="Rename or edit ${escapeHtml(m.name)}">
                Rename
              </button>
              <button type="button" class="icon-btn" data-filter-member="${escapeHtml(m.id)}" title="Filter view to ${escapeHtml(m.name)}">
                ${isActive ? 'Showing ✓' : 'Filter'}
              </button>
            </div>
          </div>
          <div class="member-row-stats">
            <div><span>Available</span><strong class="text-emerald">${escapeHtml(formatMoney(item.availableFunds))}</strong></div>
            <div><span>Bills Needed</span><strong class="text-rose">${escapeHtml(formatMoney(item.neededForBills))}</strong></div>
            <div><span>Left / Sav</span><strong class="${item.leftover >= 0 ? 'text-sky' : 'text-rose'}">${escapeHtml(formatMoney(item.leftoverAfterBills, true))} / ${escapeHtml(formatMoney(item.savingsAdded))}</strong></div>
          </div>
        </div>
      `;
    }).join('');
  }

  function computeJointAutoSplit(shortfall, mode = 'income') {
    const members = getMembers();
    const jointMember = members.find((m) => m.role === 'joint') || members[0];
    const personalMembers = members.filter((m) => m.id !== jointMember?.id);
    const fullSummary = computeMonthSummary(runtime.selectedMonth, runtime.state, 'all');
    const result = {};

    if (shortfall <= 0 || !personalMembers.length) {
      for (const p of personalMembers) result[p.id] = 0;
      return result;
    }

    const totalCents = Math.round(shortfall * 100);
    const weights = personalMembers.map((p) => {
      if (mode === 'equal') return { id: p.id, weight: 1 };
      const b = fullSummary.byMember[p.id];
      return { id: p.id, weight: Math.max(0, b ? (b.income > 0 ? b.income : 0) : 0) };
    });

    const sumWeight = weights.reduce((s, w) => s + w.weight, 0);
    const active = sumWeight > 0 ? weights : personalMembers.map((p) => ({ id: p.id, weight: 1 }));
    const denom = active.reduce((s, w) => s + w.weight, 0) || 1;
    let allocated = 0;

    active.forEach((w, idx) => {
      if (idx === active.length - 1) {
        result[w.id] = Math.max(0, totalCents - allocated) / 100;
      } else {
        const share = Math.floor((totalCents * w.weight) / denom);
        allocated += share;
        result[w.id] = share / 100;
      }
    });
    return result;
  }

  function renderAccountCoverageAndTransfers(summary) {
    const gridEl = document.getElementById('accountCoverageGrid');
    const plannerEl = document.getElementById('jointFundingPlanner');
    const listEl = document.getElementById('memberTransfersList');
    if (!gridEl || !plannerEl || !listEl) return;

    const fullSummary = summary.memberFilter === 'all'
      ? summary
      : computeMonthSummary(summary.month, runtime.state, 'all');

    const members = [...getMembers()].sort((a, b) => (a.role === 'joint' ? -1 : 1) - (b.role === 'joint' ? -1 : 1));
    gridEl.innerHTML = members.map((m) => {
      const b = fullSummary.byMember[m.id] || {
        income: 0, outgoing: 0, savingsAdded: 0, transfersIn: 0, transfersOut: 0,
        neededForBills: 0, neededTotal: 0, availableFunds: 0,
        billsShortfall: 0, totalShortfall: 0, leftoverAfterBills: 0, leftover: 0
      };
      const isJoint = m.role === 'joint';
      const pct = b.neededForBills > 0
        ? Math.min(100, Math.round((Math.max(0, b.availableFunds) / b.neededForBills) * 100))
        : 100;

      let statusPill = '';
      if (b.billsShortfall > 0) {
        statusPill = `<span class="status-toggle pending" style="background:var(--outgoing-soft);color:var(--outgoing-text);border-color:var(--outgoing);cursor:default;">Needs ${escapeHtml(formatMoney(b.billsShortfall))} for bills</span>`;
      } else if (b.totalShortfall > 0) {
        statusPill = `<span class="status-toggle pending" style="cursor:default;">Bills covered • Needs ${escapeHtml(formatMoney(b.totalShortfall))} for savings</span>`;
      } else {
        statusPill = `<span class="status-toggle paid" style="cursor:default;">Bills Covered</span>`;
      }

      return `
        <article class="coverage-card ${b.billsShortfall > 0 ? 'is-shortfall' : ''}" style="border-top-color:${escapeHtml(m.color || '#38bdf8')}">
          <div class="coverage-card-head">
            <div class="coverage-title-wrap">
              <span class="member-dot" style="background:${escapeHtml(m.color || '#38bdf8')}"></span>
              <span class="coverage-name">${escapeHtml(m.name)}</span>
              <span class="badge badge-essential">${isJoint ? 'Joint' : 'Personal'}</span>
            </div>
            ${statusPill}
          </div>

          <div class="coverage-metrics">
            <div class="coverage-metric">
              <span>Needed for Bills</span>
              <strong class="text-rose">${escapeHtml(formatMoney(b.neededForBills))}</strong>
              <span>+ ${escapeHtml(formatMoney(b.savingsAdded))} sav = ${escapeHtml(formatMoney(b.neededTotal))}</span>
            </div>
            <div class="coverage-metric">
              <span>Available in Account</span>
              <strong class="${b.billsShortfall > 0 ? 'text-amber' : 'text-emerald'}">${escapeHtml(formatMoney(b.availableFunds))}</strong>
              <span>After bills: <b class="${b.leftoverAfterBills >= 0 ? 'text-emerald' : 'text-rose'}">${escapeHtml(formatMoney(b.leftoverAfterBills, true))}</b></span>
            </div>
          </div>

          <div class="progress-track" title="Bill coverage: ${pct}%">
            <div class="progress-fill" style="width:${pct}%;background:${b.billsShortfall > 0 ? '#f43f5e' : escapeHtml(m.color || '#10b981')}"></div>
          </div>

          <div class="coverage-subline">
            <span>Direct In: ${escapeHtml(formatMoney(b.income))}</span>
            ${b.transfersIn > 0 ? `<span class="text-emerald">• Alloc In: +${escapeHtml(formatMoney(b.transfersIn))}</span>` : ''}
            ${b.transfersOut > 0 ? `<span class="text-sky">• Sent to Joint: -${escapeHtml(formatMoney(b.transfersOut))}</span>` : ''}
            <span>• Net Left: <b class="${b.leftover >= 0 ? 'text-emerald' : 'text-rose'}">${escapeHtml(formatMoney(b.leftover, true))}</b></span>
          </div>

          <div class="coverage-actions">
            ${!isJoint ? `<button type="button" class="btn btn-primary btn-sm" data-new-mtr-from="${escapeHtml(m.id)}">Allocate &#8594; Joint</button>` : ''}
            <button type="button" class="btn btn-outgoing btn-sm" data-pay-from-member="${escapeHtml(m.id)}">+ Pay Bill</button>
            <button type="button" class="icon-btn" data-filter-member="${escapeHtml(m.id)}">${runtime.memberFilter === m.id ? 'Showing' : 'Filter'}</button>
          </div>
        </article>
      `;
    }).join('');

    // Joint Account Funding Planner
    const jointMember = members.find((m) => m.role === 'joint') || members[0];
    const personalMembers = members.filter((m) => m.id !== jointMember?.id);
    const jb = fullSummary.byMember[jointMember?.id] || {
      neededForBills: 0, neededTotal: 0, savingsAdded: 0, income: 0, transfersIn: 0,
      availableFunds: 0, billsShortfall: 0, totalShortfall: 0, leftover: 0
    };

    if (!personalMembers.length || !jointMember) {
      plannerEl.innerHTML = '<div class="text-muted" style="font-size:0.84rem;">Add both a Joint Account and at least one Personal Account in Members &amp; Accounts to plan personal-to-joint allocations.</div>';
    } else {
      const hasPlanned = personalMembers.some((p) => runtime.plannedJointTransfers[p.id] !== undefined);
      if (!hasPlanned) {
        runtime.plannedJointTransfers = computeJointAutoSplit(jb.totalShortfall, 'income');
      }

      const statusText = jb.totalShortfall > 0
        ? `<strong class="text-rose">Additional ${escapeHtml(formatMoney(jb.totalShortfall))} needed</strong> (${escapeHtml(formatMoney(jb.billsShortfall))} for bills + ${escapeHtml(formatMoney(Math.max(0, jb.totalShortfall - jb.billsShortfall)))} for savings)`
        : `<strong class="text-emerald">Joint Account covered</strong> (+${escapeHtml(formatMoney(jb.leftover))} buffer after ${escapeHtml(formatMoney(jb.neededTotal))} bills &amp; savings)`;

      plannerEl.innerHTML = `
        <div class="joint-planner-top">
          <div>
            <strong>${escapeHtml(jointMember.name)} Funding Planner (${escapeHtml(formatMonthShort(summary.month))})</strong>
            <div class="text-muted" style="font-size:0.8rem;">
              Need ${escapeHtml(formatMoney(jb.neededForBills))} for bills (+ ${escapeHtml(formatMoney(jb.savingsAdded))} sav = ${escapeHtml(formatMoney(jb.neededTotal))}) •
              Have ${escapeHtml(formatMoney(jb.availableFunds))} (Direct ${escapeHtml(formatMoney(jb.income))} + Personal Allocations ${escapeHtml(formatMoney(jb.transfersIn))}) •
              ${statusText}
            </div>
          </div>
          <div class="joint-planner-actions">
            <button type="button" id="btnAutoCoverByIncome" class="btn btn-ghost btn-sm">Auto-Cover Shortfall (By Income %)</button>
            <button type="button" id="btnAutoCoverEqual" class="btn btn-ghost btn-sm">50/50 Equal Split</button>
          </div>
        </div>
        <div class="joint-planner-inputs">
          ${personalMembers.map((p) => {
            const val = Number(runtime.plannedJointTransfers[p.id] ?? 0);
            const pb = fullSummary.byMember[p.id] || { leftover: 0 };
            return `
              <label class="joint-alloc-chip">
                <span class="member-dot" style="background:${escapeHtml(p.color || '#10b981')}"></span>
                <span>${escapeHtml(p.name)} (left: ${escapeHtml(formatMoney(pb.leftover))}):</span>
                <input type="number" class="input-mini" min="0" step="0.01" data-joint-alloc-from="${escapeHtml(p.id)}" value="${val.toFixed(2)}" />
              </label>
            `;
          }).join('')}
          <button type="button" id="btnApplyJointTransfers" class="btn btn-primary btn-sm">
            Allocate Planned Top-Up to ${escapeHtml(jointMember.name)}
          </button>
        </div>
      `;
    }

    // Active Personal -> Joint transfers list
    const transfers = fullSummary.activeTransfers || [];
    document.getElementById('memberTransfersSubtitle').textContent =
      `${transfers.length} active transfer(s) in ${formatMonthLong(summary.month)}`;

    if (!transfers.length) {
      listEl.innerHTML = `<div class="empty-state">No personal-to-joint allocations scheduled in ${escapeHtml(formatMonthLong(summary.month))}. Click <strong>+ Allocate Personal &#8594; Joint</strong> to add a monthly, weekly, or one-off transfer.</div>`;
    } else {
      listEl.innerHTML = transfers.map((r) => {
        const tr = r.tr;
        const statusText = r.status === 'paid' ? 'Transferred' : r.status === 'skipped' ? 'Skipped' : 'Upcoming';
        const unitSub = r.freq === 'weekly' && !r.hasAmountOverride
          ? `${formatMoney(r.baseUnitAmount)}/wk`
          : r.hasAmountOverride
            ? `Base ${formatMoney(r.baseUnitAmount)} (edited)`
            : 'Account Allocation';
        return `
          <div class="entry-row ${r.status === 'skipped' ? 'is-skipped' : ''}" data-mtr-id="${escapeHtml(tr.id)}">
            <div class="entry-main">
              <div class="entry-title-line">
                <span class="entry-title">${escapeHtml(tr.title)}</span>
                <span class="badge badge-${r.freq}">${escapeHtml(r.scheduleLabel)}</span>
                ${renderMemberBadge(r.fromMemberId)}
                <span class="transfer-arrow">&#8594;</span>
                ${renderMemberBadge(r.toMemberId)}
                ${r.hasAmountOverride ? '<span class="badge badge-override">Month Override</span>' : ''}
              </div>
              ${r.note ? `<div class="entry-meta"><span>${escapeHtml(r.note)}</span></div>` : ''}
            </div>
            <div class="entry-right">
              <div class="entry-amount-wrap">
                <div class="entry-amount text-sky">${escapeHtml(formatMoney(r.effectiveAmount))}</div>
                <div class="entry-amount-sub">${escapeHtml(unitSub)}</div>
              </div>
              <button type="button" class="status-toggle ${r.status}" data-toggle-mtr-status="${escapeHtml(tr.id)}" title="Click to toggle Transferred / Upcoming / Skipped">
                ${statusText}
              </button>
              <button type="button" class="icon-btn" data-edit-mtr="${escapeHtml(tr.id)}">Edit</button>
              <button type="button" class="icon-btn danger" data-remove-mtr="${escapeHtml(tr.id)}">Remove</button>
            </div>
          </div>
        `;
      }).join('');
    }
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
    const accounts = runtime.state.savingsAccounts || [];
    const result = {};
    if (available <= 0 || !accounts.length) {
      for (const a of accounts) result[a.id] = 0;
      return result;
    }

    let totalWeight = accounts.reduce((acc, a) => acc + Math.max(0, Number(a.allocationWeight || 0)), 0);
    if (totalWeight <= 0) totalWeight = accounts.length;

    const remaining = Math.round(available * 100);
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

  function getAllocatorSurplusContext(monthStr) {
    const fullSummary = computeMonthSummary(monthStr, runtime.state, 'all');
    const selectedMemberId = runtime.allocMemberId || 'all';
    const members = getMembers();
    const defaultJoint = members.find((m) => m.role === 'joint') || members[0];

    if (selectedMemberId === 'all') {
      return {
        sourceMemberId: defaultJoint ? defaultJoint.id : 'mem_joint',
        label: 'Money left over (Income - Outgoings)',
        leftover: fullSummary.moneyLeftOver,
        alreadyMoved: fullSummary.savingsAdded,
        safetyBuffer: fullSummary.safetyBuffer,
        available: fullSummary.allocatableSurplus
      };
    }

    const member = getMemberById(selectedMemberId);
    const stats = fullSummary.byMember[selectedMemberId] || { availableFunds: 0, outgoing: 0, savingsAdded: 0, leftoverAfterBills: 0 };
    const available = Math.max(0, stats.leftoverAfterBills - fullSummary.safetyBuffer - stats.savingsAdded);
    return {
      sourceMemberId: selectedMemberId,
      label: `Money left over (${member?.name || 'Member'})`,
      leftover: stats.leftoverAfterBills,
      alreadyMoved: stats.savingsAdded,
      safetyBuffer: fullSummary.safetyBuffer,
      available
    };
  }

  function renderSavingsAllocatorAndSnapshot(summary) {
    const ctx = getAllocatorSurplusContext(summary.month);
    document.getElementById('allocLeftoverLabel').textContent = ctx.label;
    document.getElementById('allocLeftover').textContent = formatMoney(ctx.leftover);
    document.getElementById('safetyBufferInput').value = ctx.safetyBuffer;
    document.getElementById('allocAlreadyMoved').textContent = formatMoney(ctx.alreadyMoved);
    document.getElementById('allocAvailable').textContent = formatMoney(ctx.available);

    const accounts = runtime.state.savingsAccounts || [];
    const listEl = document.getElementById('allocatorAccountsList');

    // Initialize defaults if none set yet for current month
    const hasValues = accounts.some((a) => runtime.plannedAllocations[a.id] !== undefined);
    if (!hasValues) {
      runtime.plannedAllocations = computeAutoSplitAllocations(ctx.available);
    }

    if (!accounts.length) {
      listEl.innerHTML = '<div class="text-muted" style="font-size:0.82rem;">Add a savings or asset account to allocate leftover funds.</div>';
    } else {
      listEl.innerHTML = accounts.map((acc) => {
        const val = Number(runtime.plannedAllocations[acc.id] ?? 0);
        const bal = getAccountBalanceAtMonth(acc, summary.month);
        const typeTag = acc.type === 'asset' ? 'Asset' : (ACCOUNT_TYPE_LABELS[acc.type] || 'Savings');
        const accIcon = getSavingsAccountIcon(acc);
        return `
          <div class="alloc-acc-row">
            <div class="alloc-acc-info">
              <span class="alloc-acc-name"><span style="margin-right:5px;">${escapeHtml(accIcon)}</span>${escapeHtml(acc.name)}</span>
              <span class="alloc-acc-sub">${escapeHtml(typeTag)} • Bal: ${escapeHtml(formatMoney(bal))} • Weight ${Number(acc.allocationWeight || 0)}%</span>
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

    const plannedSum = accounts.reduce((s, a) => s + Math.max(0, Number(runtime.plannedAllocations[a.id] || 0)), 0);
    document.getElementById('allocPlannedTotal').textContent = formatMoney(plannedSum);

    // Quick snapshot card
    document.getElementById('snapshotSubtitle').textContent = `Balances through ${formatMonthShort(summary.month)}`;
    const snapEl = document.getElementById('savingsSnapshotList');
    const filteredAccounts = runtime.memberFilter === 'all'
      ? accounts
      : accounts.filter((a) => (a.memberId || getMembers()[0]?.id) === runtime.memberFilter);

    if (!filteredAccounts.length) {
      snapEl.innerHTML = '<div class="text-muted" style="font-size:0.82rem;">No savings or assets match the selected member filter.</div>';
    } else {
      snapEl.innerHTML = filteredAccounts.map((acc) => {
        const bal = getAccountBalanceAtMonth(acc, summary.month);
        const accIcon = getSavingsAccountIcon(acc);
        return `
          <div class="snapshot-row">
            <div class="snapshot-left">
              <span class="swatch" style="background:${escapeHtml(acc.color || '#38bdf8')}"></span>
              <span class="item-icon-badge" aria-hidden="true">${escapeHtml(accIcon)}</span>
              <div style="min-width:0">
                <div class="alloc-acc-name">${escapeHtml(acc.name)}</div>
                <div class="alloc-acc-sub">${escapeHtml(formatMoney(bal))} • ${escapeHtml(getMemberById(acc.memberId)?.name || 'Joint')}</div>
              </div>
            </div>
            <div class="snapshot-actions">
              <button type="button" class="icon-btn" title="Add money / allocate" data-quick-stx="deposit" data-acc-id="${escapeHtml(acc.id)}">+</button>
              <button type="button" class="icon-btn" title="Remove money" data-quick-stx="withdrawal" data-acc-id="${escapeHtml(acc.id)}">-</button>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  function renderSavingsScheduledList(summary) {
    const accountMap = Object.fromEntries((runtime.state.savingsAccounts || []).map((a) => [a.id, a]));
    const filter = runtime.savingsFilter;
    const list = (summary.activeSavingsTxs || []).filter((r) => {
      if (filter === 'all') return true;
      if (filter === 'deposit' || filter === 'withdrawal') return r.tx.type === filter;
      return (r.tx.frequency || 'one-off') === filter;
    });

    const freqOrder = { monthly: 1, weekly: 2, 'one-off': 3 };
    list.sort((a, b) => (freqOrder[a.freq] - freqOrder[b.freq]) || (Math.abs(b.effectiveAmount) - Math.abs(a.effectiveAmount)));

    document.getElementById('savingsScheduledSubtitle').textContent =
      `${summary.activeSavingsTxs.length} savings/asset payment(s) active in ${formatMonthLong(summary.month)}`;

    const el = document.getElementById('savingsScheduledList');
    if (!list.length) {
      el.innerHTML = `<div class="empty-state">No savings or asset payments match this filter in ${escapeHtml(formatMonthLong(summary.month))}. Click <strong>+ Add Savings / Asset Payment</strong> to add a monthly, weekly, or one-off transfer.</div>`;
      return;
    }

    el.innerHTML = list.map((r) => {
      const tx = r.tx;
      const acc = accountMap[tx.accountId];
      const delta = r.signedDelta;
      const isPositive = delta >= 0;
      const amtClass = tx.type === 'deposit' ? 'text-emerald' : tx.type === 'withdrawal' ? 'text-rose' : 'text-sky';
      const statusText = r.status === 'paid' ? 'Paid' : r.status === 'skipped' ? 'Skipped' : 'Upcoming';
      const unitSub = r.freq === 'weekly' && !r.hasAmountOverride
        ? `${formatMoney(r.baseUnitAmount)}/wk`
        : r.hasAmountOverride
          ? `Base ${formatMoney(r.baseUnitAmount)} (edited)`
          : (tx.category || 'Payment');
      const occPreview = r.freq === 'weekly' && r.occurrences.length > 0 && !r.hasAmountOverride
        ? `<span>Dates: ${r.occurrences.map((d) => d.slice(8)).join(', ')}</span>`
        : '';
      const typeLabel = tx.type === 'deposit' ? '+ Addition' : tx.type === 'withdrawal' ? '- Removal' : '± Adjust';
      const stxIcon = getSavingsTxIcon(tx, acc, r.icon);

      return `
        <div class="entry-row ${r.status === 'skipped' ? 'is-skipped' : ''}" data-stx-id="${escapeHtml(tx.id)}">
          <div class="entry-main">
            <div class="entry-title-line">
              <span class="item-icon-badge" aria-hidden="true">${escapeHtml(stxIcon)}</span>
              <span class="entry-title">${escapeHtml(acc ? acc.name : 'Savings / Asset')}</span>
              <span class="badge badge-${r.freq}">${escapeHtml(r.scheduleLabel)}</span>
              ${renderMemberBadge(r.memberId)}
              <span class="badge badge-essential">${escapeHtml(typeLabel)}</span>
              ${r.hasAmountOverride ? '<span class="badge badge-override">Month Override</span>' : ''}
            </div>
            <div class="entry-meta">
              <span>${escapeHtml(tx.category || 'Movement')}</span>
              ${occPreview}
              ${r.note ? `<span>• ${escapeHtml(r.note)}</span>` : ''}
            </div>
          </div>
          <div class="entry-right">
            <div class="entry-amount-wrap">
              <div class="entry-amount ${amtClass}">${isPositive ? '+' : ''}${escapeHtml(formatMoney(delta))}</div>
              <div class="entry-amount-sub">${escapeHtml(unitSub)}</div>
            </div>
            <button type="button" class="status-toggle ${r.status}" data-toggle-stx-status="${escapeHtml(tx.id)}" title="Click to toggle Paid / Upcoming / Skipped">
              ${statusText}
            </button>
            <button type="button" class="icon-btn" data-edit-stx="${escapeHtml(tx.id)}">Edit</button>
            <button type="button" class="icon-btn danger" data-remove-stx="${escapeHtml(tx.id)}">Remove</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderSavingsTab(summary) {
    const accounts = runtime.state.savingsAccounts || [];
    const displayedAccounts = runtime.memberFilter === 'all'
      ? accounts
      : accounts.filter((a) => (a.memberId || getMembers()[0]?.id) === runtime.memberFilter);

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
    if (!displayedAccounts.length) {
      gridEl.innerHTML = `<div class="empty-state">No savings accounts or assets match the current filter. Click <strong>+ Add Account / Asset</strong> to start tracking.</div>`;
    } else {
      gridEl.innerHTML = displayedAccounts.map((acc) => {
        const balAtMonth = getAccountBalanceAtMonth(acc, summary.month);
        const balLive = getAccountBalanceAtMonth(acc, getCurrentMonth());
        const act = getAccountMonthActivity(acc.id, summary.month);
        const target = Number(acc.targetAmount || 0);
        const pct = target > 0 ? Math.min(100, Math.round((balAtMonth / target) * 100)) : 0;
        const typeLabel = ACCOUNT_TYPE_LABELS[acc.type] || 'Account';
        const recurringCount = (runtime.state.savingsTransactions || []).filter(
          (tx) => tx.accountId === acc.id && (tx.frequency === 'monthly' || tx.frequency === 'weekly') && isItemActiveInMonth(tx, summary.month)
        ).length;
        const accIcon = getSavingsAccountIcon(acc);

        return `
          <article class="savings-card" style="border-top-color:${escapeHtml(acc.color || '#38bdf8')}">
            <div class="savings-card-top">
              <div>
                <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
                  <span class="badge badge-one-off">${escapeHtml(typeLabel)}</span>
                  ${renderMemberBadge(acc.memberId)}
                </div>
                <h3 class="savings-card-title" style="margin-top:7px;display:flex;align-items:center;gap:8px;">
                  <span class="item-icon-badge item-icon-lg" aria-hidden="true">${escapeHtml(accIcon)}</span>
                  <span>${escapeHtml(acc.name)}</span>
                </h3>
              </div>
              <button type="button" class="icon-btn" data-edit-sav-acc="${escapeHtml(acc.id)}">Edit</button>
            </div>

            <div>
              <div class="savings-balance-big">${escapeHtml(formatMoney(balAtMonth))}</div>
              <div class="entry-amount-sub">
                ${summary.month !== getCurrentMonth() ? `Live today: ${escapeHtml(formatMoney(balLive))} • ` : ''}
                Month net: <span class="${act.net >= 0 ? 'text-emerald' : 'text-rose'}">${escapeHtml(formatMoney(act.net, true))}</span>
                ${recurringCount > 0 ? ` • ${recurringCount} recurring rule${recurringCount === 1 ? '' : 's'}` : ''}
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
              <span>Auto-split weight: ${Number(acc.allocationWeight || 0)}%</span>
              <span>Opening: ${escapeHtml(formatMoney(acc.openingBalance || 0))}</span>
            </div>
            ${acc.notes ? `<div class="text-muted" style="font-size:0.78rem;">${escapeHtml(acc.notes)}</div>` : ''}

            <div class="savings-card-actions">
              <button type="button" class="btn btn-income btn-sm" data-quick-stx="deposit" data-acc-id="${escapeHtml(acc.id)}">+ Add Money</button>
              <button type="button" class="btn btn-outgoing btn-sm" data-quick-stx="withdrawal" data-acc-id="${escapeHtml(acc.id)}">- Remove</button>
              <button type="button" class="btn btn-savings btn-sm" data-quick-stx="deposit" data-acc-id="${escapeHtml(acc.id)}" data-stx-cat="Monthly Allocation">Allocate</button>
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

    renderSavingsScheduledList(summary);
    renderSavingsLedger();
  }

  function renderSavingsLedger() {
    const accountFilter = document.getElementById('ledgerAccountFilter').value;
    const memberFilter = document.getElementById('ledgerMemberFilter').value;
    const freqFilter = document.getElementById('ledgerFreqFilter').value;
    const scopeFilter = document.getElementById('ledgerScopeFilter').value;
    const typeFilter = document.getElementById('ledgerTypeFilter').value;
    const q = document.getElementById('ledgerSearchInput').value.trim().toLowerCase();

    const accountMap = Object.fromEntries((runtime.state.savingsAccounts || []).map((a) => [a.id, a]));
    const currentMonth = getCurrentMonth();
    const horizonEnd = runtime.selectedMonth > currentMonth ? runtime.selectedMonth : currentMonth;
    const materialized = [];

    for (const tx of runtime.state.savingsTransactions || []) {
      const freq = tx.frequency || 'one-off';
      if (freq === 'one-off') {
        const r = resolveSavingsTxForMonth(tx, tx.month, runtime.state);
        materialized.push({
          ...r,
          sortDate: tx.date || `${tx.month}-01`
        });
      } else {
        const start = tx.startMonth || horizonEnd;
        const end = tx.endMonth && tx.endMonth < horizonEnd ? tx.endMonth : horizonEnd;
        let cursor = start;
        let guard = 0;
        while (cursor <= end && guard < 120) {
          const r = resolveSavingsTxForMonth(tx, cursor, runtime.state);
          const day = freq === 'monthly' ? pad2(tx.dayOfMonth || 1) : (r.occurrences[0]?.slice(8) || '01');
          materialized.push({
            ...r,
            sortDate: `${cursor}-${day}`
          });
          cursor = shiftMonth(cursor, 1);
          guard++;
        }
      }
    }

    const rows = materialized
      .filter((r) => {
        const tx = r.tx;
        if (accountFilter !== 'all' && tx.accountId !== accountFilter) return false;
        if (memberFilter !== 'all' && r.memberId !== memberFilter) return false;
        if (freqFilter !== 'all' && r.freq !== freqFilter) return false;
        if (scopeFilter === 'selected' && r.month !== runtime.selectedMonth) return false;
        if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
        if (q) {
          const accName = accountMap[tx.accountId]?.name || '';
          const memName = getMemberById(r.memberId)?.name || '';
          const hay = `${accName} ${memName} ${tx.category || ''} ${r.note || ''} ${r.sortDate}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.sortDate.localeCompare(a.sortDate) || (b.tx.createdAt || '').localeCompare(a.tx.createdAt || ''));

    const wrap = document.getElementById('savingsLedgerTableWrap');
    if (!rows.length) {
      wrap.innerHTML = '<div class="empty-state">No savings or asset transactions match the current filters.</div>';
      return;
    }

    wrap.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Date / Month</th>
            <th>Account / Asset</th>
            <th>Paid By</th>
            <th>Schedule</th>
            <th>Movement</th>
            <th>Category</th>
            <th>Notes</th>
            <th class="num">Amount</th>
            <th class="num">Action</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => {
            const tx = r.tx;
            const delta = r.signedDelta;
            const acc = accountMap[tx.accountId];
            const typeBadge = tx.type === 'deposit'
              ? '<span class="badge badge-one-off">Addition (+)</span>'
              : tx.type === 'withdrawal'
                ? '<span class="badge badge-override">Removal (-)</span>'
                : '<span class="badge badge-weekly">Adjustment</span>';
            return `
              <tr class="${r.status === 'skipped' ? 'is-skipped' : ''}">
                <td>${escapeHtml(r.sortDate)}</td>
                <td><span style="margin-right:6px;">${escapeHtml(getSavingsTxIcon(tx, acc, r.icon))}</span><strong>${escapeHtml(acc ? acc.name : 'Deleted Account')}</strong></td>
                <td>${renderMemberBadge(r.memberId)}</td>
                <td><span class="badge badge-${r.freq}">${escapeHtml(r.freq)}</span></td>
                <td>${typeBadge}</td>
                <td>${escapeHtml(tx.category || '—')}</td>
                <td style="white-space:normal;min-width:160px;">${escapeHtml(r.note || '—')}</td>
                <td class="num"><strong class="${delta >= 0 ? 'text-emerald' : 'text-rose'}">${escapeHtml(formatMoney(delta, true))}</strong></td>
                <td class="num"><button type="button" class="icon-btn danger" data-remove-stx="${escapeHtml(tx.id)}">Remove</button></td>
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

    const summaries = months.map((m) => computeMonthSummary(m, runtime.state, runtime.memberFilter));
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

    for (const e of [...(state.entries || []), ...(state.savingsTransactions || []), ...(state.memberTransfers || [])]) {
      if (e.month && e.month < minMonth) minMonth = e.month;
      if (e.month && e.month > maxMonth) maxMonth = e.month;
      if (e.startMonth && e.startMonth < minMonth) minMonth = e.startMonth;
      if (e.endMonth && e.endMonth > maxMonth) maxMonth = e.endMonth;
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
    const accountMap = Object.fromEntries((state.savingsAccounts || []).map((a) => [a.id, a]));

    for (const m of months) {
      const horizon = getHorizon(m, currentMonth);
      for (const e of state.entries || []) {
        if (!isItemActiveInMonth(e, m)) continue;
        const r = resolveEntryForMonth(e, m, state);
        if (e.category) categories.add(e.category);
        records.push({
          recordKind: e.kind,
          icon: getEntryIcon(e, r.icon),
          month: m,
          horizon,
          dateLabel: e.date || (e.frequency === 'monthly' ? `${m}-${pad2(e.dayOfMonth || 1)}` : m),
          title: e.title,
          category: e.category || 'Uncategorized',
          frequency: e.frequency,
          memberId: r.memberId,
          status: r.status,
          amount: r.effectiveAmount,
          signedAmount: e.kind === 'income' ? r.effectiveAmount : -r.effectiveAmount,
          note: r.note,
          entryId: e.id
        });
      }

      for (const tx of state.savingsTransactions || []) {
        if (!isItemActiveInMonth(tx, m)) continue;
        const r = resolveSavingsTxForMonth(tx, m, state);
        const acc = accountMap[tx.accountId];
        if (tx.category) categories.add(tx.category);
        records.push({
          recordKind: 'savings',
          icon: getSavingsTxIcon(tx, acc, r.icon),
          month: m,
          horizon,
          dateLabel: tx.date || (r.freq === 'monthly' ? `${m}-${pad2(tx.dayOfMonth || 1)}` : m),
          title: `${acc ? acc.name : 'Savings / Asset'} (${tx.type})`,
          category: tx.category || 'Savings Movement',
          frequency: r.freq,
          memberId: r.memberId,
          status: r.status,
          amount: Math.abs(r.signedDelta),
          signedAmount: r.signedDelta,
          note: r.note,
          entryId: null
        });
      }

      for (const tr of state.memberTransfers || []) {
        if (!isItemActiveInMonth(tr, m)) continue;
        const r = resolveMemberTransferForMonth(tr, m, state);
        const toName = getMemberById(r.toMemberId, state)?.name || 'Joint Account';
        categories.add('Account Transfer');
        records.push({
          recordKind: 'savings',
          icon: '🔁',
          month: m,
          horizon,
          dateLabel: tr.date || (r.freq === 'monthly' ? `${m}-${pad2(tr.dayOfMonth || 1)}` : m),
          title: `${tr.title} (→ ${toName})`,
          category: 'Account Transfer',
          frequency: r.freq,
          memberId: r.fromMemberId,
          status: r.status,
          amount: r.effectiveAmount,
          signedAmount: r.effectiveAmount,
          note: r.note,
          entryId: null
        });
      }
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
    const memberFilter = document.getElementById('searchMemberFilter').value;
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
      if (memberFilter !== 'all' && rec.memberId !== memberFilter) return false;
      if (statusFilter !== 'all' && rec.status !== statusFilter) return false;

      if (query) {
        const memName = getMemberById(rec.memberId)?.name || '';
        const hay = `${rec.title} ${rec.category} ${memName} ${rec.note} ${rec.month} ${rec.dateLabel} ${rec.frequency} ${rec.recordKind}`.toLowerCase();
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
            <th>Paid By</th>
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
                <td style="white-space:normal;min-width:190px;">${rec.icon ? `<span style="margin-right:6px;">${escapeHtml(rec.icon)}</span>` : ''}<strong>${escapeHtml(rec.title)}</strong>${rec.note ? `<br/><span class="text-muted" style="font-size:0.74rem;">${escapeHtml(rec.note)}</span>` : ''}</td>
                <td>${renderMemberBadge(rec.memberId)}</td>
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
    const summary = computeMonthSummary(runtime.selectedMonth, runtime.state, runtime.memberFilter);
    renderKpis(summary);
    renderAccountCoverageAndTransfers(summary);
    renderEntriesLists(summary);
    renderOutgoingsBreakdown(summary);
    renderMemberBreakdown(summary);
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

    const iconInput = document.getElementById('entryIconInput');
    if (iconInput) {
      iconInput.placeholder = runtime.entryModalKind === 'income' ? '💼' : '🧾';
    }
    renderEmojiPicker(
      'entryEmojiPicker',
      'entryIconInput',
      runtime.entryModalKind === 'income' ? EMOJI_PRESETS.income : EMOJI_PRESETS.outgoing
    );
  }

  function openEntryModal({ entryId = null, defaultKind = 'outgoing', defaultFreq = 'monthly', defaultMemberId = null } = {}) {
    const form = document.getElementById('entryForm');
    form.reset();
    populateMemberSelects();
    document.getElementById('entryIdInput').value = entryId || '';
    document.getElementById('editScopeMonthName').textContent = formatMonthLong(runtime.selectedMonth);
    document.getElementById('entryStatusMonthLabel').textContent = formatMonthShort(runtime.selectedMonth);
    document.querySelector('input[name="editScope"][value="series"]').checked = true;

    const members = getMembers();
    const fallbackMember = defaultMemberId || (runtime.memberFilter !== 'all' ? runtime.memberFilter : (members[0]?.id || 'mem_joint'));

    if (entryId) {
      const entry = runtime.state.entries.find((e) => e.id === entryId);
      if (!entry) return;
      const resolved = resolveEntryForMonth(entry, runtime.selectedMonth);
      runtime.entryModalKind = entry.kind;
      runtime.entryModalFreq = entry.frequency;
      document.getElementById('entryModalTitle').textContent = `Edit ${entry.kind === 'income' ? 'Income' : 'Outgoing'}`;
      document.getElementById('entryIconInput').value = resolved.icon || entry.icon || '';
      document.getElementById('entryTitleInput').value = entry.title;
      document.getElementById('entryAmountInput').value = resolved.hasAmountOverride ? resolved.computedAmount : entry.amount;
      document.getElementById('entryCategoryInput').value = entry.category || '';
      document.getElementById('entryMemberSelect').value = resolved.memberId || fallbackMember;
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
      document.getElementById('entryIconInput').value = '';
      document.getElementById('entryCategoryInput').value = defaultKind === 'income' ? 'Salary' : 'Bills & Utilities';
      document.getElementById('entryMemberSelect').value = fallbackMember;
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

  function openDeleteItemModal(kind, itemId) {
    const isStx = kind === 'stx';
    const isMtr = kind === 'mtr';
    const item = isStx
      ? (runtime.state.savingsTransactions || []).find((t) => t.id === itemId)
      : isMtr
        ? (runtime.state.memberTransfers || []).find((t) => t.id === itemId)
        : (runtime.state.entries || []).find((e) => e.id === itemId);
    if (!item) return;

    runtime.pendingDeleteKind = kind;
    runtime.pendingDeleteId = itemId;

    const freq = item.frequency || 'one-off';
    const isRecurring = freq !== 'one-off';
    let label = item.title;
    if (isStx) {
      const acc = (runtime.state.savingsAccounts || []).find((a) => a.id === item.accountId);
      label = `${acc ? acc.name : 'Savings/Asset'} (${item.type})`;
    }

    document.getElementById('deleteModalTitle').textContent = `Remove "${label}"`;
    document.getElementById('deleteEntryMessage').textContent = isRecurring
      ? `"${label}" is a recurring ${freq} ${isMtr ? 'transfer' : 'payment'}. Would you like to stop it starting from ${formatMonthLong(runtime.selectedMonth)} (keeping all earlier months intact), or delete it completely?`
      : `Are you sure you want to delete "${label}" (${formatMoney(item.amount)})?`;

    document.getElementById('stopMonthText').textContent = formatMonthLong(runtime.selectedMonth);
    document.getElementById('deleteRecurringChoices').classList.toggle('hidden', !isRecurring);
    document.getElementById('deleteOneOffChoices').classList.toggle('hidden', isRecurring);
    openModal('deleteEntryModal');
  }

  function syncMtrModalVisibility() {
    document.querySelectorAll('[data-mtr-freq]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mtrFreq === runtime.mtrModalFreq);
    });
    document.getElementById('mtrOneOffFields').classList.toggle('hidden', runtime.mtrModalFreq !== 'one-off');
    document.getElementById('mtrWeeklyFields').classList.toggle('hidden', runtime.mtrModalFreq !== 'weekly');
    document.getElementById('mtrMonthlyFields').classList.toggle('hidden', runtime.mtrModalFreq !== 'monthly');

    const isEditing = Boolean(document.getElementById('mtrIdInput').value);
    const isRecurring = runtime.mtrModalFreq !== 'one-off';
    document.getElementById('mtrEditScopeWrap').classList.toggle('hidden', !(isEditing && isRecurring));
  }

  function openMemberTransferModal({ transferId = null, fromMemberId = null, toMemberId = null, defaultFreq = 'monthly' } = {}) {
    const members = getMembers();
    if (members.length < 2) {
      showToast('Add at least two member/joint accounts first.', 'error');
      openMembersModal();
      return;
    }

    document.getElementById('memberTransferForm').reset();
    populateMemberSelects();
    document.getElementById('mtrIdInput').value = transferId || '';
    document.getElementById('mtrEditScopeMonthName').textContent = formatMonthLong(runtime.selectedMonth);
    document.getElementById('mtrStatusMonthLabel').textContent = formatMonthShort(runtime.selectedMonth);
    document.querySelector('input[name="mtrEditScope"][value="series"]').checked = true;

    const jointMember = members.find((m) => m.role === 'joint') || members[0];
    const personalMember = members.find((m) => m.id !== jointMember.id) || members[0];

    if (transferId) {
      const tr = (runtime.state.memberTransfers || []).find((t) => t.id === transferId);
      if (!tr) return;
      const resolved = resolveMemberTransferForMonth(tr, runtime.selectedMonth);
      runtime.mtrModalFreq = tr.frequency || 'monthly';
      document.getElementById('memberTransferModalTitle').textContent = 'Edit Account Allocation / Transfer';
      document.getElementById('mtrFromMemberSelect').value = tr.fromMemberId;
      document.getElementById('mtrToMemberSelect').value = tr.toMemberId;
      document.getElementById('mtrTitleInput').value = tr.title;
      document.getElementById('mtrAmountInput').value = resolved.hasAmountOverride ? resolved.computedAmount : tr.amount;
      document.getElementById('mtrOneOffMonthInput').value = tr.month || runtime.selectedMonth;
      document.getElementById('mtrOneOffDateInput').value = tr.date || '';
      document.getElementById('mtrDayOfWeekInput').value = String(tr.dayOfWeek ?? 5);
      document.getElementById('mtrWeeklyStartInput').value = tr.startMonth || runtime.selectedMonth;
      document.getElementById('mtrWeeklyEndInput').value = tr.endMonth || '';
      document.getElementById('mtrDayOfMonthInput').value = String(tr.dayOfMonth || 28);
      document.getElementById('mtrMonthlyStartInput').value = tr.startMonth || runtime.selectedMonth;
      document.getElementById('mtrMonthlyEndInput').value = tr.endMonth || '';
      document.getElementById('mtrStatusInput').value = resolved.status;
      document.getElementById('mtrNotesInput').value = resolved.note || '';
    } else {
      runtime.mtrModalFreq = defaultFreq;
      const chosenFrom = fromMemberId || personalMember.id;
      const chosenTo = toMemberId || (chosenFrom === jointMember.id ? personalMember.id : jointMember.id);
      const fromName = getMemberById(chosenFrom)?.name || 'Personal';
      const toName = getMemberById(chosenTo)?.name || 'Joint Account';
      document.getElementById('memberTransferModalTitle').textContent = 'Allocate Money Between Accounts';
      document.getElementById('mtrFromMemberSelect').value = chosenFrom;
      document.getElementById('mtrToMemberSelect').value = chosenTo;
      document.getElementById('mtrTitleInput').value = `${fromName} → ${toName} Bills Allocation`;
      document.getElementById('mtrOneOffMonthInput').value = runtime.selectedMonth;
      document.getElementById('mtrOneOffDateInput').value = runtime.selectedMonth === getCurrentMonth() ? getTodayIso() : getLastDayOfMonthIso(runtime.selectedMonth);
      document.getElementById('mtrWeeklyStartInput').value = runtime.selectedMonth;
      document.getElementById('mtrMonthlyStartInput').value = runtime.selectedMonth;
      document.getElementById('mtrDayOfMonthInput').value = '28';
      document.getElementById('mtrStatusInput').value = runtime.selectedMonth < getCurrentMonth() ? 'paid' : 'pending';
    }

    syncMtrModalVisibility();
    openModal('memberTransferModal');
    document.getElementById('mtrAmountInput').focus();
  }

  function openSavingsAccountModal(accountId = null) {
    const form = document.getElementById('savingsAccountForm');
    form.reset();
    populateMemberSelects();
    document.getElementById('savAccIdInput').value = accountId || '';
    const members = getMembers();
    const fallbackMember = runtime.memberFilter !== 'all' ? runtime.memberFilter : (members[0]?.id || 'mem_joint');

    if (accountId) {
      const acc = runtime.state.savingsAccounts.find((a) => a.id === accountId);
      if (!acc) return;
      document.getElementById('savingsAccountModalTitle').textContent = `Edit ${acc.name}`;
      document.getElementById('savAccIconInput').value = acc.icon || '';
      document.getElementById('savAccNameInput').value = acc.name;
      document.getElementById('savAccTypeInput').value = acc.type || 'savings';
      document.getElementById('savAccMemberSelect').value = acc.memberId || fallbackMember;
      document.getElementById('savAccOpeningInput').value = acc.openingBalance ?? 0;
      document.getElementById('savAccTargetInput').value = acc.targetAmount ?? 0;
      document.getElementById('savAccRateInput').value = acc.interestRate ?? 0;
      document.getElementById('savAccWeightInput').value = acc.allocationWeight ?? 0;
      document.getElementById('savAccColorInput').value = acc.color || '#10b981';
      document.getElementById('savAccNotesInput').value = acc.notes || '';
    } else {
      document.getElementById('savingsAccountModalTitle').textContent = 'Add Savings Account or Asset';
      document.getElementById('savAccIconInput').value = '';
      document.getElementById('savAccMemberSelect').value = fallbackMember;
      document.getElementById('savAccOpeningInput').value = '0';
      document.getElementById('savAccTargetInput').value = '0';
      document.getElementById('savAccRateInput').value = '4.5';
      document.getElementById('savAccWeightInput').value = '20';
      document.getElementById('savAccColorInput').value = '#10b981';
    }
    renderEmojiPicker('savAccEmojiPicker', 'savAccIconInput', EMOJI_PRESETS.savingsAccount);
    openModal('savingsAccountModal');
    document.getElementById('savAccNameInput').focus();
  }

  function syncStxModalVisibility() {
    document.querySelectorAll('[data-stx-type]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.stxType === runtime.stxModalType);
    });
    document.querySelectorAll('[data-stx-freq]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.stxFreq === runtime.stxModalFreq);
    });

    document.getElementById('stxOneOffFields').classList.toggle('hidden', runtime.stxModalFreq !== 'one-off');
    document.getElementById('stxWeeklyFields').classList.toggle('hidden', runtime.stxModalFreq !== 'weekly');
    document.getElementById('stxMonthlyFields').classList.toggle('hidden', runtime.stxModalFreq !== 'monthly');

    const isEditing = Boolean(document.getElementById('stxIdInput').value);
    const isRecurring = runtime.stxModalFreq !== 'one-off';
    document.getElementById('stxEditScopeWrap').classList.toggle('hidden', !(isEditing && isRecurring));

    const amtLabel = document.getElementById('stxAmountLabel');
    const catInput = document.getElementById('stxCategoryInput');
    if (runtime.stxModalType === 'deposit') {
      amtLabel.textContent = 'Amount to Add *';
      if (!catInput.value || ['Withdrawal', 'Valuation Update'].includes(catInput.value)) {
        catInput.value = runtime.stxModalFreq === 'monthly'
          ? 'Monthly Standing Order'
          : runtime.stxModalFreq === 'weekly'
            ? 'Weekly Savings Rule'
            : 'Deposit';
      }
    } else if (runtime.stxModalType === 'withdrawal') {
      amtLabel.textContent = 'Amount to Remove *';
      if (!catInput.value || ['Deposit', 'Monthly Standing Order', 'Weekly Savings Rule', 'Valuation Update'].includes(catInput.value)) {
        catInput.value = 'Withdrawal';
      }
    } else {
      amtLabel.textContent = 'Adjustment (+/-) *';
      catInput.value = 'Valuation Update';
    }
  }

  function openSavingsTxModal({ txId = null, type = 'deposit', freq = 'one-off', accountId = null, defaultCategory = null } = {}) {
    const accounts = runtime.state.savingsAccounts || [];
    if (!accounts.length) {
      showToast('Add a savings account or asset first.', 'error');
      openSavingsAccountModal();
      return;
    }

    document.getElementById('savingsTxForm').reset();
    populateMemberSelects();
    document.getElementById('stxIdInput').value = txId || '';
    document.getElementById('stxEditScopeMonthName').textContent = formatMonthLong(runtime.selectedMonth);
    document.getElementById('stxStatusMonthLabel').textContent = formatMonthShort(runtime.selectedMonth);
    document.querySelector('input[name="stxEditScope"][value="series"]').checked = true;

    const sel = document.getElementById('stxAccountSelect');
    sel.innerHTML = accounts.map((a) => `<option value="${escapeHtml(a.id)}">${escapeHtml(a.name)}</option>`).join('');

    const members = getMembers();
    const fallbackMember = runtime.memberFilter !== 'all' ? runtime.memberFilter : (members[0]?.id || 'mem_joint');

    if (txId) {
      const tx = (runtime.state.savingsTransactions || []).find((t) => t.id === txId);
      if (!tx) return;
      const resolved = resolveSavingsTxForMonth(tx, runtime.selectedMonth);
      runtime.stxModalType = tx.type || 'deposit';
      runtime.stxModalFreq = tx.frequency || 'one-off';
      document.getElementById('savingsTxModalTitle').textContent = 'Edit Savings / Asset Payment';
      sel.value = tx.accountId;
      document.getElementById('stxIconInput').value = resolved.icon || tx.icon || '';
      document.getElementById('stxMemberSelect').value = resolved.memberId || fallbackMember;
      document.getElementById('stxAmountInput').value = resolved.hasAmountOverride ? resolved.computedAmount : tx.amount;
      document.getElementById('stxCategoryInput').value = tx.category || '';
      document.getElementById('stxOneOffMonthInput').value = tx.month || runtime.selectedMonth;
      document.getElementById('stxDateInput').value = tx.date || getLastDayOfMonthIso(runtime.selectedMonth);
      document.getElementById('stxDayOfWeekInput').value = String(tx.dayOfWeek ?? 5);
      document.getElementById('stxWeeklyStartInput').value = tx.startMonth || runtime.selectedMonth;
      document.getElementById('stxWeeklyEndInput').value = tx.endMonth || '';
      document.getElementById('stxDayOfMonthInput').value = String(tx.dayOfMonth || 1);
      document.getElementById('stxMonthlyStartInput').value = tx.startMonth || runtime.selectedMonth;
      document.getElementById('stxMonthlyEndInput').value = tx.endMonth || '';
      document.getElementById('stxStatusInput').value = resolved.status;
      document.getElementById('stxNoteInput').value = resolved.note || '';
    } else {
      runtime.stxModalType = type;
      runtime.stxModalFreq = freq;
      document.getElementById('savingsTxModalTitle').textContent = 'Add Savings / Asset Payment or Movement';
      document.getElementById('stxIconInput').value = '';
      if (accountId && accounts.some((a) => a.id === accountId)) {
        sel.value = accountId;
      }
      const chosenAcc = accounts.find((a) => a.id === sel.value);
      document.getElementById('stxMemberSelect').value = runtime.memberFilter !== 'all'
        ? runtime.memberFilter
        : (chosenAcc?.memberId || fallbackMember);

      const defaultDate = runtime.selectedMonth === getCurrentMonth()
        ? getTodayIso()
        : getLastDayOfMonthIso(runtime.selectedMonth);
      document.getElementById('stxOneOffMonthInput').value = runtime.selectedMonth;
      document.getElementById('stxDateInput').value = defaultDate;
      document.getElementById('stxWeeklyStartInput').value = runtime.selectedMonth;
      document.getElementById('stxMonthlyStartInput').value = runtime.selectedMonth;
      document.getElementById('stxDayOfMonthInput').value = '1';
      document.getElementById('stxStatusInput').value = runtime.selectedMonth < getCurrentMonth() ? 'paid' : 'pending';
      document.getElementById('stxCategoryInput').value = defaultCategory || (
        type === 'withdrawal' ? 'Withdrawal' : type === 'adjustment' ? 'Valuation Update' : 'Deposit'
      );
    }

    syncStxModalVisibility();
    renderEmojiPicker('stxEmojiPicker', 'stxIconInput', EMOJI_PRESETS.savingsTx);
    openModal('savingsTxModal');
    document.getElementById('stxAmountInput').focus();
  }

  function renderMembersManageList() {
    ensureValidClientState(runtime.state);
    const members = getMembers();
    const listEl = document.getElementById('membersManageList');
    if (!listEl) return;
    listEl.innerHTML = members.map((m) => `
      <div class="member-manage-item" data-member-row="${escapeHtml(m.id)}">
        <input type="text" value="${escapeHtml(m.name)}" data-member-name="${escapeHtml(m.id)}" aria-label="Member name" />
        <select data-member-role="${escapeHtml(m.id)}" aria-label="Account type">
          <option value="personal" ${m.role !== 'joint' ? 'selected' : ''}>Personal</option>
          <option value="joint" ${m.role === 'joint' ? 'selected' : ''}>Joint</option>
        </select>
        <input type="color" value="${escapeHtml(m.color || '#38bdf8')}" class="input-color" data-member-color="${escapeHtml(m.id)}" aria-label="Member color" />
        <div style="display:flex;gap:6px;">
          <button type="button" class="icon-btn" data-save-member="${escapeHtml(m.id)}">Save</button>
          <button type="button" class="icon-btn danger" data-delete-member="${escapeHtml(m.id)}" ${members.length <= 1 ? 'disabled' : ''}>Remove</button>
        </div>
      </div>
    `).join('');
  }

  function saveAllMemberRowsFromDom({ toast = true, close = false, reRenderList = true, explicit = false } = {}) {
    runtime.state = ensureValidClientState(runtime.state);
    const listEl = document.getElementById('membersManageList');
    if (!listEl) return false;
    const rows = Array.from(listEl.querySelectorAll('.member-manage-item[data-member-row]'));
    let changedCount = 0;

    for (const row of rows) {
      const id = row.dataset.memberRow;
      const member = runtime.state.members.find((m) => m.id === id);
      if (!member) continue;
      const nameInput = row.querySelector(`[data-member-name="${id}"]`);
      const roleSelect = row.querySelector(`[data-member-role="${id}"]`);
      const colorInput = row.querySelector(`[data-member-color="${id}"]`);
      const newName = nameInput?.value.trim();
      if (!newName) {
        if (nameInput) nameInput.value = member.name;
        showToast('Member / account name cannot be empty.', 'error');
        nameInput?.focus();
        return false;
      }
      const newRole = roleSelect?.value === 'joint' ? 'joint' : 'personal';
      const newColor = colorInput?.value || member.color;
      if (member.name !== newName || member.role !== newRole || member.color !== newColor) {
        member.name = newName;
        member.role = newRole;
        member.color = newColor;
        changedCount++;
      }
    }

    if (changedCount > 0) {
      if (reRenderList) renderMembersManageList();
      persistChange(toast ? 'Saved account & member changes' : null);
    } else if (toast && explicit) {
      showToast('Account names saved', 'success');
    }

    if (close) closeModal('membersModal');
    return true;
  }

  function openMembersModal(focusMemberId = null) {
    ensureValidClientState(runtime.state);
    renderMembersManageList();
    openModal('membersModal');
    if (typeof focusMemberId === 'string' && focusMemberId) {
      const inp = Array.from(document.querySelectorAll('#membersManageList [data-member-name]'))
        .find((el) => el.dataset.memberName === focusMemberId);
      if (inp) {
        inp.focus();
        inp.select();
      }
    }
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

    document.getElementById('themeSelect').addEventListener('change', (e) => {
      applyTheme(e.target.value, { persist: true, toast: true });
    });

    document.getElementById('btnOpenThemeModal').addEventListener('click', () => {
      renderThemeGallery();
      openModal('themeModal');
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

    document.getElementById('btnManageMembers').addEventListener('click', () => openMembersModal());
    document.getElementById('btnEditMembersInline').addEventListener('click', () => openMembersModal());
    document.getElementById('btnSaveAllMembers')?.addEventListener('click', () => {
      saveAllMemberRowsFromDom({ toast: true, close: true, reRenderList: true, explicit: true });
    });

    const membersListEl = document.getElementById('membersManageList');
    if (membersListEl) {
      membersListEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.closest('[data-member-name]')) {
          e.preventDefault();
          saveAllMemberRowsFromDom({ toast: true, close: false, reRenderList: true, explicit: true });
        }
      });
      membersListEl.addEventListener('change', (e) => {
        if (e.target.closest('[data-member-name], [data-member-role], [data-member-color]')) {
          saveAllMemberRowsFromDom({ toast: true, close: false, reRenderList: false, explicit: false });
        }
      });
    }
    document.getElementById('globalMemberFilter').addEventListener('change', (e) => {
      runtime.memberFilter = e.target.value;
      renderAll();
    });
    document.getElementById('allocMemberSelect').addEventListener('change', (e) => {
      runtime.allocMemberId = e.target.value;
      runtime.plannedAllocations = {};
      renderSavingsAllocatorAndSnapshot(computeMonthSummary(runtime.selectedMonth, runtime.state, runtime.memberFilter));
    });

    document.getElementById('syncStatusBtn').addEventListener('click', openNetworkModal);
    document.getElementById('btnQuickAddIncome').addEventListener('click', () => openEntryModal({ defaultKind: 'income', defaultFreq: 'monthly' }));
    document.getElementById('btnAddIncomeInline').addEventListener('click', () => openEntryModal({ defaultKind: 'income', defaultFreq: 'monthly' }));
    document.getElementById('btnQuickAddOutgoing').addEventListener('click', () => openEntryModal({ defaultKind: 'outgoing', defaultFreq: 'monthly' }));
    document.getElementById('btnAddOutgoingInline').addEventListener('click', () => openEntryModal({ defaultKind: 'outgoing', defaultFreq: 'monthly' }));
    document.getElementById('btnQuickAddSavingsTx').addEventListener('click', () => openSavingsTxModal({ type: 'deposit', freq: 'one-off' }));
    document.getElementById('btnAddSavingsSchedule').addEventListener('click', () => openSavingsTxModal({ type: 'deposit', freq: 'monthly' }));
    document.getElementById('btnAddMemberTransfer').addEventListener('click', () => openMemberTransferModal({ defaultFreq: 'monthly' }));

    // Rolling Month Navigation
    document.getElementById('btnPrevMonth').addEventListener('click', () => {
      runtime.selectedMonth = shiftMonth(runtime.selectedMonth, -1);
      runtime.plannedAllocations = {};
      runtime.plannedJointTransfers = {};
      renderAll();
    });
    document.getElementById('btnNextMonth').addEventListener('click', () => {
      runtime.selectedMonth = shiftMonth(runtime.selectedMonth, 1);
      runtime.plannedAllocations = {};
      runtime.plannedJointTransfers = {};
      renderAll();
    });
    document.getElementById('btnTodayMonth').addEventListener('click', () => {
      runtime.selectedMonth = getCurrentMonth();
      runtime.plannedAllocations = {};
      runtime.plannedJointTransfers = {};
      renderAll();
    });
    document.getElementById('monthPickerInput').addEventListener('change', (e) => {
      if (e.target.value) {
        runtime.selectedMonth = e.target.value;
        runtime.plannedAllocations = {};
        runtime.plannedJointTransfers = {};
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
      renderEntriesLists(computeMonthSummary(runtime.selectedMonth, runtime.state, runtime.memberFilter));
    });

    // Savings schedule filter chips
    document.getElementById('savingsFilterChips').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-sav-filter]');
      if (!chip) return;
      runtime.savingsFilter = chip.dataset.savFilter;
      document.querySelectorAll('#savingsFilterChips .chip').forEach((c) => {
        c.classList.toggle('active', c === chip);
      });
      renderSavingsScheduledList(computeMonthSummary(runtime.selectedMonth, runtime.state, runtime.memberFilter));
    });

    // Delegated month select & entry actions
    document.body.addEventListener('click', (e) => {
      const closeBtn = e.target.closest('[data-close-modal]');
      if (closeBtn) {
        closeModal(closeBtn.dataset.closeModal);
        return;
      }

      const selectThemeBtn = e.target.closest('[data-select-theme]');
      if (selectThemeBtn) {
        applyTheme(selectThemeBtn.dataset.selectTheme, { persist: true, toast: true });
        return;
      }

      const pickEmojiBtn = e.target.closest('[data-pick-emoji]');
      if (pickEmojiBtn) {
        const targetId = pickEmojiBtn.dataset.targetInput;
        const pickerId = pickEmojiBtn.dataset.pickerId;
        const inp = document.getElementById(targetId);
        if (inp) {
          inp.value = pickEmojiBtn.dataset.pickEmoji;
          const presets = pickerId === 'entryEmojiPicker'
            ? (runtime.entryModalKind === 'income' ? EMOJI_PRESETS.income : EMOJI_PRESETS.outgoing)
            : pickerId === 'savAccEmojiPicker'
              ? EMOJI_PRESETS.savingsAccount
              : EMOJI_PRESETS.savingsTx;
          renderEmojiPicker(pickerId, targetId, presets);
        }
        return;
      }

      const monthBtn = e.target.closest('[data-select-month]');
      if (monthBtn) {
        runtime.selectedMonth = monthBtn.dataset.selectMonth;
        runtime.plannedAllocations = {};
        runtime.plannedJointTransfers = {};
        renderAll();
        return;
      }

      const openMonthBtn = e.target.closest('[data-open-month]');
      if (openMonthBtn) {
        runtime.selectedMonth = openMonthBtn.dataset.openMonth;
        runtime.plannedAllocations = {};
        runtime.plannedJointTransfers = {};
        const targetTab = openMonthBtn.dataset.openKind === 'savings' ? 'savings' : 'overview';
        document.querySelector(`.view-tab[data-tab="${targetTab}"]`).click();
        renderAll();
        return;
      }

      const newMtrBtn = e.target.closest('[data-new-mtr-from]');
      if (newMtrBtn) {
        openMemberTransferModal({ fromMemberId: newMtrBtn.dataset.newMtrFrom, defaultFreq: 'monthly' });
        return;
      }

      const payFromMemberBtn = e.target.closest('[data-pay-from-member]');
      if (payFromMemberBtn) {
        openEntryModal({ defaultKind: 'outgoing', defaultFreq: 'one-off', defaultMemberId: payFromMemberBtn.dataset.payFromMember });
        return;
      }

      if (e.target.id === 'btnAutoCoverByIncome' || e.target.id === 'btnAutoCoverEqual') {
        const fullSummary = computeMonthSummary(runtime.selectedMonth, runtime.state, 'all');
        const jointMember = getMembers().find((m) => m.role === 'joint') || getMembers()[0];
        const jb = fullSummary.byMember[jointMember?.id] || { totalShortfall: 0 };
        const mode = e.target.id === 'btnAutoCoverEqual' ? 'equal' : 'income';
        runtime.plannedJointTransfers = computeJointAutoSplit(jb.totalShortfall, mode);
        renderAccountCoverageAndTransfers(computeMonthSummary(runtime.selectedMonth, runtime.state, runtime.memberFilter));
        return;
      }

      if (e.target.id === 'btnApplyJointTransfers') {
        const members = getMembers();
        const jointMember = members.find((m) => m.role === 'joint') || members[0];
        const personalMembers = members.filter((m) => m.id !== jointMember?.id);
        const txDate = runtime.selectedMonth === getCurrentMonth() ? getTodayIso() : getLastDayOfMonthIso(runtime.selectedMonth);
        if (!Array.isArray(runtime.state.memberTransfers)) runtime.state.memberTransfers = [];

        let count = 0;
        let totalMoved = 0;
        for (const p of personalMembers) {
          const amt = Math.round(Math.max(0, Number(runtime.plannedJointTransfers[p.id] || 0)) * 100) / 100;
          if (amt > 0) {
            const trId = uid('mtr');
            runtime.state.memberTransfers.push({
              id: trId,
              fromMemberId: p.id,
              toMemberId: jointMember.id,
              title: `${p.name} → ${jointMember.name} Top-Up`,
              frequency: 'one-off',
              amount: amt,
              dayOfMonth: null,
              dayOfWeek: null,
              month: runtime.selectedMonth,
              date: txDate,
              startMonth: null,
              endMonth: null,
              notes: `Allocated to cover ${formatMonthShort(runtime.selectedMonth)} joint bills`,
              createdAt: new Date().toISOString()
            });
            runtime.state.monthOverrides[`${trId}_${runtime.selectedMonth}`] = {
              status: runtime.selectedMonth < getCurrentMonth() ? 'paid' : 'pending',
              updatedAt: new Date().toISOString()
            };
            count++;
            totalMoved += amt;
          }
        }

        if (count === 0) {
          showToast('Enter at least one personal contribution above 0 (or use Auto-Cover if there is a shortfall).', 'error');
          return;
        }
        runtime.plannedJointTransfers = {};
        persistChange(`Allocated ${formatMoney(totalMoved)} from ${count} personal account(s) to ${jointMember.name}`);
        return;
      }

      const toggleMtrBtn = e.target.closest('[data-toggle-mtr-status]');
      if (toggleMtrBtn) {
        const trId = toggleMtrBtn.dataset.toggleMtrStatus;
        const tr = (runtime.state.memberTransfers || []).find((item) => item.id === trId);
        if (!tr) return;
        const resolved = resolveMemberTransferForMonth(tr, runtime.selectedMonth);
        const nextStatus = resolved.status === 'pending' ? 'paid' : resolved.status === 'paid' ? 'skipped' : 'pending';
        const key = `${trId}_${runtime.selectedMonth}`;
        runtime.state.monthOverrides[key] = {
          ...(runtime.state.monthOverrides[key] || {}),
          status: nextStatus,
          updatedAt: new Date().toISOString()
        };
        persistChange(`Marked transfer "${tr.title}" as ${nextStatus}`);
        return;
      }

      const editMtrBtn = e.target.closest('[data-edit-mtr]');
      if (editMtrBtn) {
        openMemberTransferModal({ transferId: editMtrBtn.dataset.editMtr });
        return;
      }

      const removeMtrBtn = e.target.closest('[data-remove-mtr]');
      if (removeMtrBtn) {
        openDeleteItemModal('mtr', removeMtrBtn.dataset.removeMtr);
        return;
      }

      const editMemberBtn = e.target.closest('[data-edit-member]');
      if (editMemberBtn) {
        openMembersModal(editMemberBtn.dataset.editMember);
        return;
      }

      const filterMemberBtn = e.target.closest('[data-filter-member]');
      if (filterMemberBtn) {
        const targetId = filterMemberBtn.dataset.filterMember;
        runtime.memberFilter = runtime.memberFilter === targetId ? 'all' : targetId;
        renderAll();
        return;
      }

      const saveMemberBtn = e.target.closest('[data-save-member]');
      if (saveMemberBtn) {
        saveAllMemberRowsFromDom({ toast: true, close: false, reRenderList: true, explicit: true });
        return;
      }

      const delMemberBtn = e.target.closest('[data-delete-member]');
      if (delMemberBtn) {
        runtime.state = ensureValidClientState(runtime.state);
        const id = delMemberBtn.dataset.deleteMember;
        if (runtime.state.members.length <= 1) {
          showToast('At least one member/account is required.', 'error');
          return;
        }
        const removed = runtime.state.members.find((m) => m.id === id);
        const remaining = runtime.state.members.filter((m) => m.id !== id);
        const fallbackId = remaining[0].id;
        runtime.state.members = remaining;
        for (const item of runtime.state.entries || []) {
          if (item.memberId === id) item.memberId = fallbackId;
        }
        for (const acc of runtime.state.savingsAccounts || []) {
          if (acc.memberId === id) acc.memberId = fallbackId;
        }
        for (const tx of runtime.state.savingsTransactions || []) {
          if (tx.memberId === id) tx.memberId = fallbackId;
        }
        for (const tr of runtime.state.memberTransfers || []) {
          if (tr.fromMemberId === id) tr.fromMemberId = fallbackId;
          if (tr.toMemberId === id) tr.toMemberId = fallbackId;
        }
        if (runtime.memberFilter === id) runtime.memberFilter = 'all';
        if (runtime.allocMemberId === id) runtime.allocMemberId = 'all';
        renderMembersManageList();
        persistChange(`Removed "${removed?.name || 'member'}" and reassigned items to ${remaining[0].name}`);
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

      const toggleStxBtn = e.target.closest('[data-toggle-stx-status]');
      if (toggleStxBtn) {
        const txId = toggleStxBtn.dataset.toggleStxStatus;
        const tx = runtime.state.savingsTransactions.find((item) => item.id === txId);
        if (!tx) return;
        const resolved = resolveSavingsTxForMonth(tx, runtime.selectedMonth);
        const nextStatus = resolved.status === 'pending' ? 'paid' : resolved.status === 'paid' ? 'skipped' : 'pending';
        const key = `${txId}_${runtime.selectedMonth}`;
        runtime.state.monthOverrides[key] = {
          ...(runtime.state.monthOverrides[key] || {}),
          status: nextStatus,
          updatedAt: new Date().toISOString()
        };
        persistChange(`Marked savings payment as ${nextStatus}`);
        return;
      }

      const editEntryBtn = e.target.closest('[data-edit-entry]');
      if (editEntryBtn) {
        openEntryModal({ entryId: editEntryBtn.dataset.editEntry });
        return;
      }

      const delEntryBtn = e.target.closest('[data-delete-entry]');
      if (delEntryBtn) {
        openDeleteItemModal('entry', delEntryBtn.dataset.deleteEntry);
        return;
      }

      const editStxBtn = e.target.closest('[data-edit-stx]');
      if (editStxBtn) {
        openSavingsTxModal({ txId: editStxBtn.dataset.editStx });
        return;
      }

      const removeStxBtn = e.target.closest('[data-remove-stx]');
      if (removeStxBtn) {
        openDeleteItemModal('stx', removeStxBtn.dataset.removeStx);
        return;
      }

      const quickStxBtn = e.target.closest('[data-quick-stx]');
      if (quickStxBtn) {
        openSavingsTxModal({
          type: quickStxBtn.dataset.quickStx,
          accountId: quickStxBtn.dataset.accId,
          defaultCategory: quickStxBtn.dataset.stxCat || null
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

      const copyUrlBtn = e.target.closest('[data-copy-url]');
      if (copyUrlBtn) {
        const url = copyUrlBtn.dataset.copyUrl;
        navigator.clipboard?.writeText(url).then(
          () => showToast(`Copied ${url}`, 'success'),
          () => showToast(`URL: ${url}`, 'info')
        );
      }
    });

    // Add Member form
    document.getElementById('addMemberForm').addEventListener('submit', (e) => {
      e.preventDefault();
      runtime.state = ensureValidClientState(runtime.state);
      saveAllMemberRowsFromDom({ toast: false, close: false, reRenderList: false });
      const name = document.getElementById('newMemberNameInput').value.trim();
      const role = document.getElementById('newMemberRoleInput').value === 'joint' ? 'joint' : 'personal';
      const color = document.getElementById('newMemberColorInput').value || '#f59e0b';
      if (!name) return;
      runtime.state.members.push({
        id: uid('mem'),
        name,
        role,
        color
      });
      e.target.reset();
      document.getElementById('newMemberColorInput').value = '#f59e0b';
      renderMembersManageList();
      persistChange(`Added member "${name}"`);
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
      const ctx = getAllocatorSurplusContext(runtime.selectedMonth);
      runtime.plannedAllocations = computeAutoSplitAllocations(ctx.available);
      renderSavingsAllocatorAndSnapshot(computeMonthSummary(runtime.selectedMonth, runtime.state, runtime.memberFilter));
    });

    document.getElementById('btnClearSplitSavings').addEventListener('click', () => {
      for (const acc of runtime.state.savingsAccounts) {
        runtime.plannedAllocations[acc.id] = 0;
      }
      renderSavingsAllocatorAndSnapshot(computeMonthSummary(runtime.selectedMonth, runtime.state, runtime.memberFilter));
    });

    document.getElementById('btnCommitAllocation').addEventListener('click', () => {
      const accounts = runtime.state.savingsAccounts || [];
      const ctx = getAllocatorSurplusContext(runtime.selectedMonth);
      const sourceMember = getMemberById(ctx.sourceMemberId);
      const txDate = runtime.selectedMonth === getCurrentMonth()
        ? getTodayIso()
        : getLastDayOfMonthIso(runtime.selectedMonth);

      let addedCount = 0;
      let totalMoved = 0;
      for (const acc of accounts) {
        const amt = Math.round(Math.max(0, Number(runtime.plannedAllocations[acc.id] || 0)) * 100) / 100;
        if (amt > 0) {
          runtime.state.savingsTransactions.push({
            id: uid('stx'),
            accountId: acc.id,
            memberId: ctx.sourceMemberId,
            type: 'deposit',
            frequency: 'one-off',
            amount: amt,
            date: txDate,
            month: runtime.selectedMonth,
            dayOfMonth: null,
            dayOfWeek: null,
            startMonth: null,
            endMonth: null,
            category: 'Monthly Allocation',
            note: `Allocated from ${sourceMember?.name || 'Household'} (${formatMonthLong(runtime.selectedMonth)} leftover)`,
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
      persistChange(`Allocated ${formatMoney(totalMoved)} from ${sourceMember?.name || 'Household'} into ${addedCount} account(s)`);
    });

    document.getElementById('btnGoToSavingsTab').addEventListener('click', () => {
      document.querySelector('.view-tab[data-tab="savings"]').click();
    });

    // Entry modal segmented buttons & submit
    document.getElementById('entryIconInput').addEventListener('input', () => {
      renderEmojiPicker(
        'entryEmojiPicker',
        'entryIconInput',
        runtime.entryModalKind === 'income' ? EMOJI_PRESETS.income : EMOJI_PRESETS.outgoing
      );
    });
    document.getElementById('savAccIconInput').addEventListener('input', () => {
      renderEmojiPicker('savAccEmojiPicker', 'savAccIconInput', EMOJI_PRESETS.savingsAccount);
    });
    document.getElementById('stxIconInput').addEventListener('input', () => {
      renderEmojiPicker('stxEmojiPicker', 'stxIconInput', EMOJI_PRESETS.savingsTx);
    });

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
      const icon = document.getElementById('entryIconInput').value.trim().slice(0, 16);
      const title = document.getElementById('entryTitleInput').value.trim();
      const amount = Number(document.getElementById('entryAmountInput').value);
      const category = document.getElementById('entryCategoryInput').value.trim() || 'General';
      const memberId = document.getElementById('entryMemberSelect').value || getMembers()[0]?.id;
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
            memberId,
            icon,
            note: notes,
            updatedAt: new Date().toISOString()
          };
          closeModal('entryModal');
          persistChange(`Updated ${formatMonthShort(runtime.selectedMonth)} override for "${title}"`);
          return;
        }

        existing.kind = kind;
        existing.frequency = freq;
        existing.icon = icon;
        existing.title = title;
        existing.amount = amount;
        existing.category = category;
        existing.memberId = memberId;
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
        icon,
        title,
        category,
        memberId,
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

    // Delete / Stop modal buttons (handles entries, savingsTransactions, and memberTransfers)
    document.getElementById('btnStopFromMonth').addEventListener('click', () => {
      const id = runtime.pendingDeleteId;
      const kind = runtime.pendingDeleteKind;
      const list = kind === 'stx'
        ? runtime.state.savingsTransactions
        : kind === 'mtr'
          ? (runtime.state.memberTransfers || [])
          : runtime.state.entries;
      const item = list.find((x) => x.id === id);
      if (!item) return;

      const prevMonth = shiftMonth(runtime.selectedMonth, -1);
      if (item.startMonth && prevMonth < item.startMonth) {
        if (kind === 'stx') runtime.state.savingsTransactions = list.filter((x) => x.id !== id);
        else if (kind === 'mtr') runtime.state.memberTransfers = list.filter((x) => x.id !== id);
        else runtime.state.entries = list.filter((x) => x.id !== id);
      } else {
        item.endMonth = prevMonth;
      }
      closeModal('deleteEntryModal');
      persistChange(`Stopped payment from ${formatMonthShort(runtime.selectedMonth)} onwards`);
    });

    document.getElementById('btnDeleteAllMonths').addEventListener('click', () => {
      const id = runtime.pendingDeleteId;
      const kind = runtime.pendingDeleteKind;
      if (kind === 'stx') {
        runtime.state.savingsTransactions = runtime.state.savingsTransactions.filter((t) => t.id !== id);
      } else if (kind === 'mtr') {
        runtime.state.memberTransfers = (runtime.state.memberTransfers || []).filter((t) => t.id !== id);
      } else {
        runtime.state.entries = runtime.state.entries.filter((e) => e.id !== id);
      }
      closeModal('deleteEntryModal');
      persistChange('Deleted recurring item from all months');
    });

    document.getElementById('btnConfirmOneOffDelete').addEventListener('click', () => {
      const id = runtime.pendingDeleteId;
      const kind = runtime.pendingDeleteKind;
      if (kind === 'stx') {
        runtime.state.savingsTransactions = runtime.state.savingsTransactions.filter((t) => t.id !== id);
      } else if (kind === 'mtr') {
        runtime.state.memberTransfers = (runtime.state.memberTransfers || []).filter((t) => t.id !== id);
      } else {
        runtime.state.entries = runtime.state.entries.filter((e) => e.id !== id);
      }
      closeModal('deleteEntryModal');
      persistChange('Deleted payment');
    });

    // Joint Funding Planner manual inputs
    document.getElementById('jointFundingPlanner').addEventListener('input', (e) => {
      const inp = e.target.closest('[data-joint-alloc-from]');
      if (!inp) return;
      runtime.plannedJointTransfers[inp.dataset.jointAllocFrom] = Math.max(0, Number(inp.value || 0));
    });

    // Member Transfer modal segmented buttons & submit
    document.querySelectorAll('[data-mtr-freq]').forEach((btn) => {
      btn.addEventListener('click', () => {
        runtime.mtrModalFreq = btn.dataset.mtrFreq;
        syncMtrModalVisibility();
      });
    });

    document.getElementById('memberTransferForm').addEventListener('submit', (e) => {
      e.preventDefault();
      if (!Array.isArray(runtime.state.memberTransfers)) runtime.state.memberTransfers = [];

      const trId = document.getElementById('mtrIdInput').value;
      const fromMemberId = document.getElementById('mtrFromMemberSelect').value;
      const toMemberId = document.getElementById('mtrToMemberSelect').value;
      const title = document.getElementById('mtrTitleInput').value.trim();
      const amount = Number(document.getElementById('mtrAmountInput').value);
      const status = document.getElementById('mtrStatusInput').value;
      const notes = document.getElementById('mtrNotesInput').value.trim();

      if (!fromMemberId || !toMemberId || fromMemberId === toMemberId) {
        showToast('Please select different source and target accounts.', 'error');
        return;
      }
      if (!title || !Number.isFinite(amount) || amount <= 0) {
        showToast('Please enter a valid description and positive amount.', 'error');
        return;
      }

      const freq = runtime.mtrModalFreq;

      if (trId) {
        const existing = runtime.state.memberTransfers.find((t) => t.id === trId);
        if (!existing) return;

        const editScope = freq !== 'one-off'
          ? document.querySelector('input[name="mtrEditScope"]:checked')?.value || 'series'
          : 'series';

        const overrideKey = `${trId}_${runtime.selectedMonth}`;
        if (editScope === 'month' && freq !== 'one-off') {
          runtime.state.monthOverrides[overrideKey] = {
            ...(runtime.state.monthOverrides[overrideKey] || {}),
            status,
            amount,
            note: notes,
            updatedAt: new Date().toISOString()
          };
          closeModal('memberTransferModal');
          persistChange(`Updated ${formatMonthShort(runtime.selectedMonth)} transfer override`);
          return;
        }

        existing.fromMemberId = fromMemberId;
        existing.toMemberId = toMemberId;
        existing.title = title;
        existing.frequency = freq;
        existing.amount = amount;
        existing.notes = notes;

        if (freq === 'one-off') {
          const exactDate = document.getElementById('mtrOneOffDateInput').value;
          const m = document.getElementById('mtrOneOffMonthInput').value || (exactDate ? exactDate.slice(0, 7) : runtime.selectedMonth);
          existing.month = m;
          existing.date = exactDate || null;
          existing.startMonth = null;
          existing.endMonth = null;
        } else if (freq === 'weekly') {
          existing.dayOfWeek = Number(document.getElementById('mtrDayOfWeekInput').value);
          existing.startMonth = document.getElementById('mtrWeeklyStartInput').value || runtime.selectedMonth;
          existing.endMonth = document.getElementById('mtrWeeklyEndInput').value || null;
          existing.month = null;
          existing.date = null;
        } else {
          existing.dayOfMonth = Number(document.getElementById('mtrDayOfMonthInput').value || 28);
          existing.startMonth = document.getElementById('mtrMonthlyStartInput').value || runtime.selectedMonth;
          existing.endMonth = document.getElementById('mtrMonthlyEndInput').value || null;
          existing.month = null;
          existing.date = null;
        }

        const targetMonth = freq === 'one-off' ? existing.month : runtime.selectedMonth;
        runtime.state.monthOverrides[`${trId}_${targetMonth}`] = {
          ...(runtime.state.monthOverrides[`${trId}_${targetMonth}`] || {}),
          status,
          updatedAt: new Date().toISOString()
        };
        delete runtime.state.monthOverrides[`${trId}_${targetMonth}`].amount;

        closeModal('memberTransferModal');
        runtime.plannedJointTransfers = {};
        persistChange(`Updated transfer "${title}"`);
        return;
      }

      const newId = uid('mtr');
      let trMonth = null;
      let trDate = null;
      let startMonth = null;
      let endMonth = null;
      let dayOfMonth = null;
      let dayOfWeek = null;

      if (freq === 'one-off') {
        trDate = document.getElementById('mtrOneOffDateInput').value || null;
        trMonth = document.getElementById('mtrOneOffMonthInput').value || (trDate ? trDate.slice(0, 7) : runtime.selectedMonth);
      } else if (freq === 'weekly') {
        dayOfWeek = Number(document.getElementById('mtrDayOfWeekInput').value);
        startMonth = document.getElementById('mtrWeeklyStartInput').value || runtime.selectedMonth;
        endMonth = document.getElementById('mtrWeeklyEndInput').value || null;
      } else {
        dayOfMonth = Number(document.getElementById('mtrDayOfMonthInput').value || 28);
        startMonth = document.getElementById('mtrMonthlyStartInput').value || runtime.selectedMonth;
        endMonth = document.getElementById('mtrMonthlyEndInput').value || null;
      }

      runtime.state.memberTransfers.push({
        id: newId,
        fromMemberId,
        toMemberId,
        title,
        frequency: freq,
        amount,
        dayOfMonth,
        dayOfWeek,
        month: trMonth,
        date: trDate,
        startMonth,
        endMonth,
        notes,
        createdAt: new Date().toISOString()
      });

      const statusTargetMonth = freq === 'one-off' ? trMonth : runtime.selectedMonth;
      runtime.state.monthOverrides[`${newId}_${statusTargetMonth}`] = {
        status,
        updatedAt: new Date().toISOString()
      };

      closeModal('memberTransferModal');
      runtime.plannedJointTransfers = {};
      persistChange(`Added ${freq} transfer "${title}"`);
    });

    // Savings account modal & submit
    document.getElementById('btnAddSavingsAccount').addEventListener('click', () => openSavingsAccountModal());
    document.getElementById('btnRecordSavingsTx').addEventListener('click', () => openSavingsTxModal({ type: 'deposit', freq: 'one-off' }));

    document.getElementById('savingsAccountForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const id = document.getElementById('savAccIdInput').value;
      const icon = document.getElementById('savAccIconInput').value.trim().slice(0, 16);
      const name = document.getElementById('savAccNameInput').value.trim();
      const type = document.getElementById('savAccTypeInput').value;
      const memberId = document.getElementById('savAccMemberSelect').value || getMembers()[0]?.id;
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
        Object.assign(acc, { icon, name, type, memberId, openingBalance, targetAmount, interestRate, allocationWeight, color, notes });
        closeModal('savingsAccountModal');
        persistChange(`Updated "${name}"`);
      } else {
        runtime.state.savingsAccounts.push({
          id: uid('sav'),
          icon,
          name,
          type,
          memberId,
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

    // Savings transaction modal segmented buttons & submit
    document.querySelectorAll('[data-stx-type]').forEach((btn) => {
      btn.addEventListener('click', () => {
        runtime.stxModalType = btn.dataset.stxType;
        syncStxModalVisibility();
      });
    });

    document.querySelectorAll('[data-stx-freq]').forEach((btn) => {
      btn.addEventListener('click', () => {
        runtime.stxModalFreq = btn.dataset.stxFreq;
        syncStxModalVisibility();
      });
    });

    document.getElementById('savingsTxForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const txId = document.getElementById('stxIdInput').value;
      const icon = document.getElementById('stxIconInput').value.trim().slice(0, 16);
      const accountId = document.getElementById('stxAccountSelect').value;
      const memberId = document.getElementById('stxMemberSelect').value || getMembers()[0]?.id;
      const rawAmount = Number(document.getElementById('stxAmountInput').value);
      const category = document.getElementById('stxCategoryInput').value.trim() || 'Movement';
      const status = document.getElementById('stxStatusInput').value;
      const note = document.getElementById('stxNoteInput').value.trim();

      if (!accountId || !Number.isFinite(rawAmount) || rawAmount === 0) {
        showToast('Enter a valid non-zero amount.', 'error');
        return;
      }

      const freq = runtime.stxModalFreq;
      const type = runtime.stxModalType;
      const amount = type === 'adjustment' ? rawAmount : Math.abs(rawAmount);

      if (txId) {
        const existing = runtime.state.savingsTransactions.find((t) => t.id === txId);
        if (!existing) return;

        const editScope = freq !== 'one-off'
          ? document.querySelector('input[name="stxEditScope"]:checked')?.value || 'series'
          : 'series';

        const overrideKey = `${txId}_${runtime.selectedMonth}`;
        if (editScope === 'month' && freq !== 'one-off') {
          runtime.state.monthOverrides[overrideKey] = {
            ...(runtime.state.monthOverrides[overrideKey] || {}),
            status,
            amount,
            memberId,
            icon,
            note,
            updatedAt: new Date().toISOString()
          };
          closeModal('savingsTxModal');
          persistChange(`Updated ${formatMonthShort(runtime.selectedMonth)} savings payment override`);
          return;
        }

        existing.accountId = accountId;
        existing.memberId = memberId;
        existing.icon = icon;
        existing.type = type;
        existing.frequency = freq;
        existing.amount = amount;
        existing.category = category;
        existing.note = note;

        if (freq === 'one-off') {
          const exactDate = document.getElementById('stxDateInput').value || getTodayIso();
          const m = document.getElementById('stxOneOffMonthInput').value || exactDate.slice(0, 7);
          existing.month = m;
          existing.date = exactDate;
          existing.startMonth = null;
          existing.endMonth = null;
        } else if (freq === 'weekly') {
          existing.dayOfWeek = Number(document.getElementById('stxDayOfWeekInput').value);
          existing.startMonth = document.getElementById('stxWeeklyStartInput').value || runtime.selectedMonth;
          existing.endMonth = document.getElementById('stxWeeklyEndInput').value || null;
          existing.month = null;
          existing.date = null;
        } else {
          existing.dayOfMonth = Number(document.getElementById('stxDayOfMonthInput').value || 1);
          existing.startMonth = document.getElementById('stxMonthlyStartInput').value || runtime.selectedMonth;
          existing.endMonth = document.getElementById('stxMonthlyEndInput').value || null;
          existing.month = null;
          existing.date = null;
        }

        const targetMonth = freq === 'one-off' ? existing.month : runtime.selectedMonth;
        runtime.state.monthOverrides[`${txId}_${targetMonth}`] = {
          ...(runtime.state.monthOverrides[`${txId}_${targetMonth}`] || {}),
          status,
          updatedAt: new Date().toISOString()
        };
        delete runtime.state.monthOverrides[`${txId}_${targetMonth}`].amount;

        closeModal('savingsTxModal');
        persistChange('Updated savings/asset payment');
        return;
      }

      // Create new savings/asset payment or movement
      const newId = uid('stx');
      let txMonth = null;
      let txDate = null;
      let startMonth = null;
      let endMonth = null;
      let dayOfMonth = null;
      let dayOfWeek = null;

      if (freq === 'one-off') {
        txDate = document.getElementById('stxDateInput').value || getTodayIso();
        txMonth = document.getElementById('stxOneOffMonthInput').value || txDate.slice(0, 7);
      } else if (freq === 'weekly') {
        dayOfWeek = Number(document.getElementById('stxDayOfWeekInput').value);
        startMonth = document.getElementById('stxWeeklyStartInput').value || runtime.selectedMonth;
        endMonth = document.getElementById('stxWeeklyEndInput').value || null;
      } else {
        dayOfMonth = Number(document.getElementById('stxDayOfMonthInput').value || 1);
        startMonth = document.getElementById('stxMonthlyStartInput').value || runtime.selectedMonth;
        endMonth = document.getElementById('stxMonthlyEndInput').value || null;
      }

      runtime.state.savingsTransactions.push({
        id: newId,
        accountId,
        memberId,
        icon,
        type,
        frequency: freq,
        amount,
        date: txDate,
        month: txMonth,
        dayOfMonth,
        dayOfWeek,
        startMonth,
        endMonth,
        category,
        note,
        createdAt: new Date().toISOString()
      });

      const statusTargetMonth = freq === 'one-off' ? txMonth : runtime.selectedMonth;
      runtime.state.monthOverrides[`${newId}_${statusTargetMonth}`] = {
        status,
        updatedAt: new Date().toISOString()
      };

      closeModal('savingsTxModal');
      persistChange(
        freq !== 'one-off'
          ? `Added ${freq} ${type === 'withdrawal' ? 'removal' : 'payment'} (${formatMoney(amount)})`
          : type === 'deposit'
            ? `Added ${formatMoney(amount)} to savings/asset`
            : type === 'withdrawal'
              ? `Removed ${formatMoney(amount)} from savings/asset`
              : `Recorded adjustment of ${formatMoney(amount, true)}`
      );
    });

    // Savings ledger filters
    ['ledgerAccountFilter', 'ledgerMemberFilter', 'ledgerFreqFilter', 'ledgerScopeFilter', 'ledgerTypeFilter'].forEach((id) => {
      document.getElementById(id).addEventListener('change', renderSavingsLedger);
    });
    document.getElementById('ledgerSearchInput').addEventListener('input', renderSavingsLedger);

    // Global search filters
    ['globalSearchInput', 'searchFromMonth', 'searchToMonth'].forEach((id) => {
      document.getElementById(id).addEventListener('input', renderGlobalSearch);
    });
    ['searchHorizonFilter', 'searchKindFilter', 'searchFreqFilter', 'searchCategoryFilter', 'searchMemberFilter', 'searchStatusFilter'].forEach((id) => {
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
        runtime.state = ensureValidClientState(parsed);
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
        runtime.state = ensureValidClientState(data.state);
        runtime.revision = data.revision;
        runtime.pendingSync = false;
        runtime.plannedAllocations = {};
        runtime.plannedJointTransfers = {};
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
        runtime.state = ensureValidClientState(data.state);
        runtime.revision = data.revision;
        runtime.pendingSync = false;
        runtime.plannedAllocations = {};
        runtime.plannedJointTransfers = {};
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
    applyTheme(localStorage.getItem(THEME_LS_KEY) || 'dark');
    bindEvents();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const cached = await readLocalCache();
    if (cached && cached.state) {
      runtime.state = ensureValidClientState(cached.state);
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
