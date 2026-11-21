'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { DatabaseSync } = require('node:sqlite');
const { DEFAULT_MEMBERS, createSeedState, createEmptyState, getCurrentMonth } = require('./seed-data');

const DEFAULT_PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function getLanUrls(port) {
  const interfaces = os.networkInterfaces();
  const urls = [];
  for (const name of Object.keys(interfaces)) {
    const entries = interfaces[name] || [];
    for (const info of entries) {
      if (info && info.family === 'IPv4' && !info.internal) {
        urls.push({
          interface: name,
          address: info.address,
          url: `http://${info.address}:${port}`
        });
      }
    }
  }
  return urls;
}

function normalizeMembers(rawMembers) {
  if (!Array.isArray(rawMembers) || rawMembers.length === 0) {
    return DEFAULT_MEMBERS.map((m) => ({ ...m }));
  }
  const seen = new Set();
  const list = [];
  for (const m of rawMembers) {
    if (!m || typeof m !== 'object') continue;
    const id = typeof m.id === 'string' && m.id.trim() ? m.id.trim() : null;
    const name = typeof m.name === 'string' && m.name.trim() ? m.name.trim().slice(0, 48) : null;
    if (!id || !name || seen.has(id)) continue;
    seen.add(id);
    list.push({
      id,
      name,
      role: m.role === 'joint' ? 'joint' : 'personal',
      color: typeof m.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(m.color) ? m.color : '#38bdf8'
    });
  }
  return list.length > 0 ? list : DEFAULT_MEMBERS.map((m) => ({ ...m }));
}

function normalizeState(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('State payload must be a JSON object.');
  }
  const base = createEmptyState();
  const settings = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
  const members = normalizeMembers(raw.members);
  const validMemberIds = new Set(members.map((m) => m.id));
  const fallbackMemberId = members[0].id;

  const entries = (Array.isArray(raw.entries) ? raw.entries : []).map((e) => ({
    ...e,
    memberId: e && validMemberIds.has(e.memberId) ? e.memberId : fallbackMemberId
  }));

  const savingsAccounts = (Array.isArray(raw.savingsAccounts) ? raw.savingsAccounts : []).map((a) => ({
    ...a,
    memberId: a && validMemberIds.has(a.memberId) ? a.memberId : fallbackMemberId
  }));

  const savingsTransactions = (Array.isArray(raw.savingsTransactions) ? raw.savingsTransactions : []).map((tx) => ({
    ...tx,
    frequency: ['one-off', 'weekly', 'monthly'].includes(tx?.frequency) ? tx.frequency : 'one-off',
    memberId: tx && validMemberIds.has(tx.memberId) ? tx.memberId : fallbackMemberId
  }));

  return {
    version: 1,
    settings: {
      currency: ['GBP', 'USD', 'EUR'].includes(settings.currency) ? settings.currency : base.settings.currency,
      weeklyCalcMode: ['exact', 'four_week', 'annualized'].includes(settings.weeklyCalcMode)
        ? settings.weeklyCalcMode
        : base.settings.weeklyCalcMode,
      safetyBuffer: Number.isFinite(Number(settings.safetyBuffer))
        ? Math.max(0, Number(settings.safetyBuffer))
        : base.settings.safetyBuffer,
      householdName: typeof settings.householdName === 'string' && settings.householdName.trim()
        ? settings.householdName.trim().slice(0, 80)
        : base.settings.householdName
    },
    members,
    entries,
    monthOverrides: raw.monthOverrides && typeof raw.monthOverrides === 'object' && !Array.isArray(raw.monthOverrides)
      ? raw.monthOverrides
      : {},
    savingsAccounts,
    savingsTransactions
  };
}

class LocalStorageStore {
  constructor(dataDir) {
    this.dataDir = dataDir;
    fs.mkdirSync(this.dataDir, { recursive: true });
    this.sqlitePath = path.join(this.dataDir, 'household-budget.sqlite');
    this.jsonPath = path.join(this.dataDir, 'household-budget.json');
    this.db = new DatabaseSync(this.sqlitePath);
    this.init();
  }

  init() {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS budget_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        state_json TEXT NOT NULL,
        revision INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS state_snapshots (
        revision INTEGER PRIMARY KEY,
        state_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    const row = this.db.prepare('SELECT state_json, revision, updated_at FROM budget_state WHERE id = 1').get();
    if (!row) {
      let initialState = null;
      if (fs.existsSync(this.jsonPath)) {
        try {
          const parsed = JSON.parse(fs.readFileSync(this.jsonPath, 'utf8'));
          initialState = normalizeState(parsed);
        } catch {
          initialState = null;
        }
      }
      if (!initialState) {
        initialState = createSeedState(getCurrentMonth());
      }
      const now = new Date().toISOString();
      const jsonStr = JSON.stringify(initialState);
      this.db.prepare(
        'INSERT INTO budget_state (id, state_json, revision, updated_at) VALUES (1, ?, 1, ?)'
      ).run(jsonStr, now);
      this.db.prepare(
        'INSERT OR REPLACE INTO state_snapshots (revision, state_json, updated_at) VALUES (1, ?, ?)'
      ).run(jsonStr, now);
      this.writeJsonBackup(initialState);
    } else if (!fs.existsSync(this.jsonPath)) {
      this.writeJsonBackup(JSON.parse(row.state_json));
    }
  }

  writeJsonBackup(state) {
    const tmpPath = `${this.jsonPath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(tmpPath, this.jsonPath);
  }

  getState() {
    const row = this.db.prepare('SELECT state_json, revision, updated_at FROM budget_state WHERE id = 1').get();
    return {
      state: normalizeState(JSON.parse(row.state_json)),
      revision: row.revision,
      updatedAt: row.updated_at
    };
  }

  saveState(rawState) {
    const normalized = normalizeState(rawState);
    const current = this.db.prepare('SELECT revision FROM budget_state WHERE id = 1').get();
    const nextRevision = (current ? current.revision : 0) + 1;
    const now = new Date().toISOString();
    const jsonStr = JSON.stringify(normalized);

    this.db.prepare(
      'UPDATE budget_state SET state_json = ?, revision = ?, updated_at = ? WHERE id = 1'
    ).run(jsonStr, nextRevision, now);
    this.db.prepare(
      'INSERT OR REPLACE INTO state_snapshots (revision, state_json, updated_at) VALUES (?, ?, ?)'
    ).run(nextRevision, jsonStr, now);
    this.db.prepare(
      'DELETE FROM state_snapshots WHERE revision <= ?'
    ).run(nextRevision - 30);

    this.writeJsonBackup(normalized);

    return {
      state: normalized,
      revision: nextRevision,
      updatedAt: now
    };
  }

  close() {
    this.db.close();
  }
}

function readJsonBody(req, limitBytes = 5 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > limitBytes) {
        reject(new Error('Request body too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8').trim();
        resolve(text ? JSON.parse(text) : {});
      } catch {
        reject(new Error('Invalid JSON request body.'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(body);
}

function createBudgetServer(options = {}) {
  const port = options.port ?? DEFAULT_PORT;
  const dataDir = options.dataDir || process.env.DATA_DIR || path.join(__dirname, 'data');
  const publicDir = options.publicDir || path.join(__dirname, 'public');
  const store = new LocalStorageStore(dataDir);
  const sseClients = new Set();

  function getNetworkPayload(activePort, req = null) {
    const lanUrls = [...getLanUrls(activePort)];
    const seenUrls = new Set(lanUrls.map((u) => u.url));

    if (process.env.HOST_IP) {
      const hostIp = process.env.HOST_IP.trim();
      const hostIpUrl = `http://${hostIp}:${activePort}`;
      if (hostIp && !seenUrls.has(hostIpUrl)) {
        lanUrls.unshift({ interface: 'host-ip', address: hostIp, url: hostIpUrl });
        seenUrls.add(hostIpUrl);
      }
    }

    if (process.env.PUBLIC_URL) {
      const pubUrl = process.env.PUBLIC_URL.trim().replace(/\/$/, '');
      if (pubUrl && !seenUrls.has(pubUrl)) {
        lanUrls.unshift({ interface: 'public', address: pubUrl, url: pubUrl });
        seenUrls.add(pubUrl);
      }
    }

    if (req && req.headers && req.headers.host) {
      const rawHost = String(req.headers.host).trim();
      const hostnameOnly = rawHost.split(':')[0].toLowerCase();
      if (hostnameOnly && hostnameOnly !== 'localhost' && hostnameOnly !== '127.0.0.1') {
        const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
        const remoteUrl = `${proto}://${rawHost}`;
        if (!seenUrls.has(remoteUrl)) {
          lanUrls.unshift({ interface: 'remote-host', address: rawHost, url: remoteUrl });
          seenUrls.add(remoteUrl);
        }
      }
    }

    return {
      port: activePort,
      hostname: os.hostname(),
      localUrl: `http://localhost:${activePort}`,
      lanUrls,
      storageFiles: {
        sqlite: path.relative(__dirname, store.sqlitePath) || store.sqlitePath,
        json: path.relative(__dirname, store.jsonPath) || store.jsonPath
      }
    };
  }

  function broadcastEvent(eventName, payload) {
    const data = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(data);
      } catch {
        sseClients.delete(client);
      }
    }
  }

  const keepAliveTimer = setInterval(() => {
    for (const client of sseClients) {
      try {
        client.write(': keepalive\n\n');
      } catch {
        sseClients.delete(client);
      }
    }
  }, 25000);
  keepAliveTimer.unref();

  const server = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = reqUrl.pathname;
    const activePort = server.address()?.port || port;

    // Allow CORS for local network devices/tools if accessed via different local origin
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // --- API ROUTES ---
    if (pathname === '/api/health' && req.method === 'GET') {
      const current = store.getState();
      sendJson(res, 200, {
        status: 'ok',
        revision: current.revision,
        updatedAt: current.updatedAt,
        network: getNetworkPayload(activePort, req)
      });
      return;
    }

    if (pathname === '/api/network-info' && req.method === 'GET') {
      sendJson(res, 200, getNetworkPayload(activePort, req));
      return;
    }

    if (pathname === '/api/state' && req.method === 'GET') {
      const current = store.getState();
      sendJson(res, 200, {
        ...current,
        network: getNetworkPayload(activePort, req)
      });
      return;
    }

    if (pathname === '/api/state' && req.method === 'PUT') {
      try {
        const body = await readJsonBody(req);
        const stateInput = body && body.state ? body.state : body;
        const clientId = body && typeof body.clientId === 'string' ? body.clientId : null;
        const saved = store.saveState(stateInput);

        broadcastEvent('state-updated', {
          revision: saved.revision,
          updatedAt: saved.updatedAt,
          clientId
        });

        sendJson(res, 200, {
          ok: true,
          ...saved,
          network: getNetworkPayload(activePort, req)
        });
      } catch (err) {
        sendJson(res, 400, { error: err.message || 'Failed to save state.' });
      }
      return;
    }

    if (pathname === '/api/reset' && req.method === 'POST') {
      try {
        const body = await readJsonBody(req);
        const mode = body.mode === 'empty' ? 'empty' : 'sample';
        const anchorMonth = typeof body.anchorMonth === 'string' && /^\d{4}-\d{2}$/.test(body.anchorMonth)
          ? body.anchorMonth
          : getCurrentMonth();
        const nextState = mode === 'empty' ? createEmptyState() : createSeedState(anchorMonth);
        const saved = store.saveState(nextState);

        broadcastEvent('state-updated', {
          revision: saved.revision,
          updatedAt: saved.updatedAt,
          clientId: body.clientId || null
        });

        sendJson(res, 200, {
          ok: true,
          ...saved,
          network: getNetworkPayload(activePort, req)
        });
      } catch (err) {
        sendJson(res, 400, { error: err.message || 'Failed to reset state.' });
      }
      return;
    }

    if (pathname === '/api/export' && req.method === 'GET') {
      const current = store.getState();
      const dateStr = new Date().toISOString().slice(0, 10);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="household-budget-backup-${dateStr}.json"`,
        'Cache-Control': 'no-store'
      });
      res.end(JSON.stringify(current.state, null, 2));
      return;
    }

    if (pathname === '/api/events' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive'
      });
      res.write(`event: connected\ndata: ${JSON.stringify({ revision: store.getState().revision })}\n\n`);
      sseClients.add(res);
      req.on('close', () => {
        sseClients.delete(res);
      });
      return;
    }

    // --- STATIC ASSETS ---
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return;
    }

    const safePath = pathname === '/' ? '/index.html' : pathname;
    const resolvedPath = path.resolve(publicDir, `.${safePath}`);
    if (!resolvedPath.startsWith(path.resolve(publicDir))) {
      sendJson(res, 403, { error: 'Forbidden' });
      return;
    }

    let targetFile = resolvedPath;
    if (!fs.existsSync(targetFile) || fs.statSync(targetFile).isDirectory()) {
      targetFile = path.join(publicDir, 'index.html');
    }

    const ext = path.extname(targetFile).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const cacheControl = path.basename(targetFile) === 'sw.js'
      ? 'no-cache, no-store, must-revalidate'
      : 'public, max-age=300';

    try {
      const content = fs.readFileSync(targetFile);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': cacheControl
      });
      if (req.method === 'HEAD') {
        res.end();
      } else {
        res.end(content);
      }
    } catch {
      sendJson(res, 500, { error: 'Unable to read requested asset.' });
    }
  });

  function closeSseClients() {
    clearInterval(keepAliveTimer);
    for (const client of sseClients) {
      try {
        client.end();
      } catch {
        // ignore
      }
    }
    sseClients.clear();
  }

  server.on('close', () => {
    closeSseClients();
    store.close();
  });

  function shutdown() {
    closeSseClients();
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    return new Promise((resolve) => {
      server.close(() => resolve());
    });
  }

  return { server, store, getNetworkPayload, shutdown };
}

if (require.main === module) {
  const { server, getNetworkPayload, shutdown } = createBudgetServer({ port: DEFAULT_PORT });
  server.listen(DEFAULT_PORT, HOST, () => {
    const net = getNetworkPayload(server.address().port);
    console.log('\n======================================================');
    console.log('  Household Income, Outgoings & Savings Tracker');
    console.log('======================================================');
    console.log(`  Local access:   ${net.localUrl}`);
    if (net.lanUrls.length > 0) {
      console.log('  Local network (LAN) access from phones/tablets/PCs:');
      for (const item of net.lanUrls) {
        console.log(`    - ${item.url}  (${item.interface})`);
      }
    } else {
      console.log('  Local network:  No external LAN IPv4 interface detected.');
    }
    console.log(`  Local SQLite:   ${net.storageFiles.sqlite}`);
    console.log(`  JSON Backup:    ${net.storageFiles.json}`);
    console.log('======================================================\n');
  });

  let shuttingDown = false;
  const handleSignal = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\nReceived ${signal}, shutting down cleanly...`);
    const forceTimer = setTimeout(() => process.exit(0), 3000);
    forceTimer.unref();
    shutdown().then(() => process.exit(0));
  };

  process.on('SIGTERM', () => handleSignal('SIGTERM'));
  process.on('SIGINT', () => handleSignal('SIGINT'));
}

module.exports = {
  createBudgetServer,
  LocalStorageStore,
  normalizeState,
  getLanUrls
};
